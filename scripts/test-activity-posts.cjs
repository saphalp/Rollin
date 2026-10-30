const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function load(file,mocks) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,console,AbortController,require:name=>{
    if(!(name in mocks))throw Error(`Missing mock ${name}`);return mocks[name];
  }});return exports;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const post=(id,extra={})=>({id,createdAt:'2026-10-29T12:00:00.000001Z',...extra});

test('post service scopes requests, preserves timestamp precision, maps images and fails closed',async()=>{
  let params,signal,error=null,rows=Array.from({length:7},(_,i)=>({id:String(i),activity_id:'activity',user_id:'author',author_name:'Author',created_at:'2026-10-29T12:00:00.000001Z',image_paths:['first','second'],like_count:'3',liked_by_me:true}));
  const service=load('services/activity-posts-service.ts',{
    '@/lib/profile/resolve-avatar-uri':{resolveAvatarUri:()=> 'avatar'},
    '@/lib/supabase':{supabase:{rpc(name,args){assert.equal(name,'get_activity_explore_posts');params=args;return{abortSignal(value){signal=value;return Promise.resolve({data:rows,error});}};},storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'image/'+path}})})}}},
  });
  const controller=new AbortController();let page=await service.loadActivityPosts('activity',null,controller.signal);
  assert.equal(params.p_activity_id,'activity');assert.equal(params.p_limit,7);assert.equal(signal,controller.signal);
  assert.equal(page.posts.length,6);assert.equal(page.hasMore,true);assert.equal(page.cursor.id,'5');
  assert.deepEqual(Array.from(page.posts[0].imageUrls),['image/first','image/second']);assert.equal(page.posts[0].likeCount,3);
  rows=[];await service.loadActivityPosts('activity',page.cursor,controller.signal);
  assert.equal(params.p_before_created_at,'2026-10-29T12:00:00.000001Z');assert.equal(params.p_before_id,'5');
  assert.equal(await service.loadExplorePost('specific',controller.signal),null);assert.equal(params.p_post_id,'specific');
  error={message:'function missing'};await assert.rejects(service.loadActivityPosts('activity',null,controller.signal),/Could not load/);
});

function harness(loader) {
  const slots=[];let index=0,user='me',activity='activity',focused=true,effect,accountChange,appChange;
  const exports=load('hooks/use-activity-posts.ts',{
    react:{useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
      useRef(initial){const i=index++;return slots[i]??={current:initial};},
      useCallback(fn,deps){const i=index++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn;}},
    'expo-router':{useFocusEffect(fn){if(!effect||effect.fn!==fn||effect.focused!==focused){effect?.cleanup?.();effect={fn,focused,pending:focused};}}},
    'react-native':{AppState:{addEventListener:(_,fn)=>{appChange=fn;return{remove(){appChange=null;}};}}},
    '@/hooks/use-auth-context':{useAuthContext:()=>({claims:user?{sub:user}:null})},
    '@/lib/account-center':{subscribeAccountChanges:fn=>{accountChange=fn;return()=>{accountChange=null;};}},
    '@/services/activity-posts-service':{loadActivityPosts:loader},
  });
  function render(){index=0;const state=exports.useActivityPosts(activity);if(effect?.pending){effect.pending=false;effect.cleanup=effect.fn();}return state;}
  return {render,account(value){user=value;render();},activity(value){activity=value;render();},focus(value){focused=value;render();},privacy(){accountChange?.();},app(value){appChange?.(value);}};
}
test('activity section pages, deduplicates, clears failed refreshes and reloads on return/privacy changes',async()=>{
  let calls=0,fail=false;
  const hook=harness(async(activity,cursor)=>{calls++;if(fail)throw Error('offline');return cursor
    ?{posts:[post('1'),post('2')],cursor:post('2'),hasMore:false}
    :{posts:[post('1')],cursor:post('1'),hasMore:true};});
  hook.render();await settle();let state=hook.render();assert.equal(state.posts.length,1);assert.equal(state.hasMore,true);
  state.loadMore();state.loadMore();await settle();state=hook.render();assert.equal(calls,2);assert.deepEqual(Array.from(state.posts,p=>p.id),['1','2']);
  fail=true;state.refresh();assert.equal(hook.render().posts.length,0);await settle();state=hook.render();assert.ok(state.error);assert.equal(state.loading,false);
  fail=false;state.refresh();await settle();assert.equal(hook.render().posts.length,1);
  hook.privacy();assert.equal(hook.render().posts.length,0);await settle();
  hook.focus(false);assert.equal(hook.render().posts.length,0);hook.focus(true);await settle();assert.equal(hook.render().posts.length,1);
  hook.app('background');assert.equal(hook.render().posts.length,0);hook.app('active');await settle();assert.equal(hook.render().posts.length,1);
  hook.focus(false);
});
test('changing account/activity or leaving cancels requests and ignores stale results',async()=>{
  const pending=[];const hook=harness((activity,cursor,signal)=>new Promise(resolve=>pending.push({activity,signal,resolve})));
  hook.render();hook.account('someone-else');assert.equal(pending[0].signal.aborted,true);
  pending[1].resolve({posts:[post('new')],hasMore:false,cursor:null});await settle();
  pending[0].resolve({posts:[post('old-private')],hasMore:false,cursor:null});await settle();assert.equal(hook.render().posts[0].id,'new');
  hook.activity('different');assert.equal(pending[2].activity,'different');assert.equal(hook.render().posts.length,0);
  hook.account(null);assert.equal(pending[2].signal.aborted,true);assert.equal(hook.render().loading,false);
  hook.focus(false);
});
