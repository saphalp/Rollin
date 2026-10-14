const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

function load(file, modules={}, globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,console,crypto:webcrypto,TextEncoder,Response,Request,AbortSignal,setTimeout,clearTimeout,...globals,require(name){
      if(!(name in modules)) throw Error(`Unexpected import ${name}`);
      return modules[name];
    }});
  return exports;
}
const codes=load('supabase/functions/login-email/code.ts');
const session='20000000-0000-4000-8000-000000000001';
const challenge='30000000-0000-4000-8000-000000000001';
const user={id:'10000000-0000-4000-8000-000000000001',email:'real@example.com',email_confirmed_at:'2026-01-01'};
const secret='test-only-not-a-deployed-secret-0123456789';

test('code hashes are bound to session, recipient and challenge',async()=>{
  const args=[secret,session,user.email,challenge,'123456'];
  const hash=await codes.hashCode(...args);
  assert.equal(await codes.hashCode(...args),hash);
  for(let i=1;i<5;i++) {
    const changed=[...args]; changed[i]+='different';
    assert.notEqual(await codes.hashCode(...changed),hash);
  }
  for(let i=0;i<100;i++) assert.match(codes.generateCode(),/^\d{6}$/);
});

function endpoint({valid=true,begin={sent:true},finish=true,delivery=200}={}) {
  let handler;
  const calls=[],emails=[];
  load('supabase/functions/login-email/index.ts',{
    './code.ts':codes,
    'npm:@supabase/supabase-js@2.110.2':{createClient(_url,key){
      if(key==='service') return {rpc:async(name,args)=>{calls.push({name,args});return {data:name==='begin_login_email'?begin:finish,error:null};}};
      return {auth:{getUser:async()=>({data:{user:valid?user:null},error:valid?null:Error('invalid')}),getClaims:async()=>({data:{claims:{session_id:session,sub:user.id}},error:null})}};
    }},
  },{
    Deno:{serve:fn=>{handler=fn;},env:{get:name=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',LOGIN_CODE_SECRET:secret,RESEND_API_KEY:'test-provider-key',LOGIN_EMAIL_FROM:'Rollin <no-reply@example.com>'})[name]}},
    fetch:async(_url,options)=>{emails.push(JSON.parse(options.body));return new Response('',{status:delivery});},
  });
  return {calls,emails,request:body=>handler(new Request('https://example.invalid/login-email',{method:'POST',headers:{Authorization:'Bearer test-user-token','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
test('only a validated session can send, and recipient is never taken from the request',async()=>{
  const invalid=endpoint({valid:false});
  assert.equal((await invalid.request({action:'send'})).status,401);
  assert.equal(invalid.calls.length,0);assert.equal(invalid.emails.length,0);
  const good=endpoint();
  const response=await good.request({action:'send',email:'attacker@example.com',session_id:'attacker-session'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.sent,true);assert.ok(body.challengeId);assert.equal(body.code,undefined);
  assert.deepEqual(good.emails[0].to,[user.email]);
  assert.equal(good.calls[0].args.p_session,session);
  const sentCode=good.emails[0].text.match(/code is (\d{6})/)[1];
  assert.notEqual(good.calls[0].args.p_hash,sentCode);
  assert.equal(good.calls[0].args.p_hash,await codes.hashCode(secret,session,user.email,body.challengeId,sentCode));
});
test('resends during cooldown reattach the challenge without sending another email',async()=>{
  const api=endpoint({begin:{retryAfter:40,challengeId:challenge}});
  const response=await (await api.request({action:'send'})).json();
  assert.equal(response.challengeId,challenge);assert.equal(response.retryAfter,40);assert.equal(api.emails.length,0);
});
test('invalid codes, verification failure, send limits and provider failure fail closed',async()=>{
  const api=endpoint({finish:false});
  assert.equal((await api.request({action:'verify',challengeId:challenge,code:'123'})).status,400);
  assert.equal(api.calls.length,0);
  assert.equal((await api.request({action:'verify',challengeId:challenge,code:'123456'})).status,400);
  const limited=endpoint({begin:{error:'Too many emails requested.'}});
  assert.equal((await limited.request({action:'send'})).status,429);assert.equal(limited.emails.length,0);
  assert.equal((await endpoint({delivery:500}).request({action:'send'})).status,503);
  const verified=endpoint();
  assert.equal((await (await verified.request({action:'verify',challengeId:challenge,code:'123456'})).json()).verified,true);
});
test('shared Edge Function guard rejects missing approval and database errors',async()=>{
  const {requireVerifiedLogin}=load('supabase/functions/_shared/login-verification.ts');
  for(const data of [false,null,undefined,'true']) assert.equal(await requireVerifiedLogin({rpc:async()=>({data,error:null})}),false);
  assert.equal(await requireVerifiedLogin({rpc:async()=>({data:true,error:Error('offline')})}),false);
  assert.equal(await requireVerifiedLogin({rpc:async()=>({data:true,error:null})}),true);
});

function provider({approved=false,verificationError=null}={}) {
  const states=[],refs=[],effects=[],timers=[];let cursor=0,refCursor=0,callback;
  let claims={sub:user.id,email:user.email,session_id:session};let reads=0;
  const jsx=(type,props)=>({type,props});
  const supabase={auth:{getClaims:async()=>({data:{claims},error:null}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};}},rpc:async()=>({data:approved,error:verificationError}),from:()=>{reads++;return {select:()=>({eq:()=>({single:async()=>({data:{profile_completed:true}})})})};}};
  const {default:AuthProvider}=load('providers/auth-provider.tsx',{
    '@/hooks/use-auth-context':{AuthContext:{Provider:'Provider'}},'@/lib/supabase':{supabase},
    'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>states[i]=value];},useRef(initial){const i=refCursor++;return refs[i]??={current:initial};},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},
  },{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
  const render=()=>{cursor=0;refCursor=0;return AuthProvider({children:null}).props.value;};
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
  return {render,async mount(){render();effects[0]();await flush();},reads:()=>reads,setApproved:value=>approved=value,async event(next){claims=next;callback(next?'SIGNED_IN':'SIGNED_OUT',next?{}:null);for(const fn of timers.splice(0))fn();await flush();}};
}
test('unverified and unavailable checks withhold profile data and logged-in state',async()=>{
  for(const options of [{approved:false},{approved:true,verificationError:Error('missing function')}]) {
    const app=provider(options);await app.mount();
    assert.equal(app.render().isLoggedIn,false);assert.equal(app.render().needsEmailVerification,true);assert.equal(app.reads(),0);
  }
});
test('approval survives session refresh but a new session and signout reset access',async()=>{
  const app=provider({approved:true});await app.mount();
  assert.equal(app.render().isLoggedIn,true);
  await app.event({sub:user.id,session_id:session});assert.equal(app.render().isLoggedIn,true);
  app.setApproved(false);await app.event({sub:user.id,session_id:'new-device'});
  assert.equal(app.render().isLoggedIn,false);assert.equal(app.render().needsEmailVerification,true);
  app.setApproved(true);await app.render().refreshLoginVerification();
  assert.equal(app.render().isLoggedIn,true);
  await app.event(null);assert.equal(app.render().isLoggedIn,false);assert.equal(app.render().needsEmailVerification,false);
});
