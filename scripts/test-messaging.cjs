const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks={}, globals={}) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,console,Date,Map,Set,Error,AbortController,...globals,require:name=>{
    if(!(name in mocks))throw Error(`Missing mock ${name}`);return mocks[name];
  }}); return exports;
}
const pure=load('lib/messaging.ts');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const message=(id, extra={})=>({id:String(id),created_at:`2026-10-29T12:00:${String(id).padStart(2,'0')}.000000+00:00`,sender_id:'other',conversation_id:'chat',type:'text',content:`Message ${id}`,...extra});
const info={type:'direct',is_archived:false,receipts:[],otherUserId:'other'};

test('messages deduplicate and order with microsecond precision; receipts exclude the sender',()=>{
  const a=message(1,{created_at:'2026-10-29T12:00:00.000001Z'}),b=message(2,{created_at:'2026-10-29T12:00:00.000002Z'});
  assert.deepEqual(Array.from(pure.mergeMessages([b,a],[{...a,content:'updated'}]),m=>m.content),['updated','Message 2']);
  assert.equal(pure.messageReadLabel({...a,sender_id:'me'},'me','direct',[{user_id:'other',last_read_at:b.created_at,last_read_message_id:b.id}]),'Read');
  assert.equal(pure.messageReadLabel({...b,sender_id:'me'},'me','direct',[{user_id:'other',last_read_at:a.created_at,last_read_message_id:a.id}]),'Sent');
  assert.equal(pure.messageReadLabel({...a,sender_id:'me'},'me','group',[{user_id:'me',last_read_at:b.created_at,last_read_message_id:b.id},{user_id:'other',last_read_at:b.created_at,last_read_message_id:b.id}]),'Read by 1');
  assert.equal(pure.messageReadLabel(a,'me','direct',[]),undefined);
  assert.equal(pure.conversationPreview(null,'post',false),'Shared a post');
  assert.equal(pure.conversationPreview(null,'activity',true),'Shared an activity');
});

function harness(kind, service) {
  const slots=[],timers=new Map(),intervals=new Map();let cursor=0,token=0,userId='me',focused=true,effect,listener,live,subscriptions=0;
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){const i=cursor++;return slots[i]??={current:value};},
    useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn;},
  };
  const exports=load(`hooks/${kind==='list'?'use-conversations':'use-chat-conversation'}.ts`,{
    react,'@/lib/messaging':pure,
    'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{listener=fn;return{remove(){listener=null;}};}}},
    'expo-router':{useFocusEffect(fn){if(!effect||effect.fn!==fn||effect.focused!==focused){effect?.cleanup?.();effect={fn,focused,pending:focused};}}},
    '@/hooks/use-auth-context':{useAuthContext:()=>({claims:userId?{sub:userId}:null})},
    '@/services/messaging-service':{...service,subscribeToChats(fn){live=fn;subscriptions++;return()=>{live=null;subscriptions--;};}},
  },{setTimeout:fn=>{const id=++token;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{const id=++token;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)});
  function render(){cursor=0;const result=kind==='list'?exports.useConversations():exports.useChatConversation('chat');if(effect?.pending){effect.pending=false;effect.cleanup=effect.fn();}return result;}
  return{render,live(){live?.();},debounce(){const fns=[...timers.values()];timers.clear();fns.forEach(fn=>fn());},poll(){intervals.forEach(fn=>fn());},
    app(state){listener?.(state);},focus(value){focused=value;return render();},account(value){userId=value;return render();},subscriptions:()=>subscriptions,timers:()=>timers.size+intervals.size};
}
const row=(id,archived=false,unreadCount=1)=>({id,isArchived:archived,unreadCount});
test('conversation list refreshes live, on focus/resume and fallback; failures preserve data and retry',async()=>{
  let calls=0,fail=false;
  const hook=harness('list',{loadConversations:async()=>{calls++;if(fail)throw Error('offline');return[row('active'),row('archive',true)];}});
  hook.render();await settle();let state=hook.render();assert.equal(state.activeConversations.length,1);assert.equal(state.archivedConversations.length,1);assert.equal(state.activeConversations[0].unreadCount,1);
  hook.live();hook.live();hook.debounce();await settle();assert.equal(calls,2);
  fail=true;await hook.render().refresh();state=hook.render();assert.equal(state.activeConversations.length,1);assert.ok(state.error);assert.equal(state.loading,false);
  fail=false;await state.refresh();assert.equal(hook.render().error,'');
  hook.app('background');const before=calls;hook.poll();await settle();assert.equal(calls,before);
  hook.app('active');await settle();assert.equal(calls,before+1);
  hook.focus(false);assert.equal(hook.subscriptions(),0);assert.equal(hook.timers(),0);
  hook.focus(true);await settle();assert.equal(calls,before+2);hook.focus(false);
});
test('account switch cancels stale list loads and deletion failures leave the list intact',async()=>{
  const pending=[];const hook=harness('list',{loadConversations:signal=>new Promise(resolve=>pending.push({signal,resolve})),hideConversation:async()=>{throw Error('offline');}});
  hook.render();hook.account('another');assert.equal(pending[0].signal.aborted,true);
  pending[1].resolve([row('new-user')]);await settle();pending[0].resolve([row('private-old-user')]);await settle();
  assert.equal(hook.render().activeConversations[0].id,'new-user');
  await assert.rejects(hook.render().deleteConversation('new-user'),/offline/);assert.equal(hook.render().activeConversations.length,1);
  assert.equal(hook.account(null).activeConversations.length,0);hook.focus(false);
});
test('chat paginates older history, catches up every newer page, deduplicates and updates receipts',async()=>{
  let phase=0;const calls=[];
  const hook=harness('chat',{
    loadChatInfo:async()=>({...info,receipts:phase?[{user_id:'other',last_read_at:message(5).created_at,last_read_message_id:'5'}]:[]}),
    loadMessagePage:async(_id,_signal,cursor,newer)=>{
      calls.push({cursor:cursor?.id,newer});if(!cursor)return[message(3),message(2)];
      if(!newer)return cursor.id==='2'?[message(1)]:[];
      if(!phase)return[];
      return cursor.id==='3'?[message(4)]:cursor.id==='4'?[message(5)]:[];
    },markChatRead:async()=>{},sendChatMessage:async()=>message(6),
  });
  hook.render();await settle();assert.deepEqual(Array.from(hook.render().messages,m=>m.id),['2','3']);
  await hook.render().loadOlder();assert.deepEqual(Array.from(hook.render().messages,m=>m.id),['1','2','3']);
  await hook.render().loadOlder();assert.equal(hook.render().hasOlder,false);
  phase=1;hook.live();hook.debounce();await settle();
  assert.deepEqual(Array.from(hook.render().messages,m=>m.id),['1','2','3','4','5']);assert.equal(hook.render().info.receipts.length,1);
  await hook.render().refresh();assert.equal(hook.render().messages.length,5);
  assert.ok(calls.some(c=>c.cursor==='4'&&c.newer));hook.focus(false);
});
test('read acknowledgments require active foreground chat and a loaded message, and retry after failure',async()=>{
  let reads=0,fail=true;
  const hook=harness('chat',{loadChatInfo:async()=>info,loadMessagePage:async(_id,_s,c)=>c?[]:[message(1)],markChatRead:async()=>{reads++;if(fail)throw Error('read failed');}});
  hook.render();await settle();await hook.render().markRead('not-loaded');assert.equal(reads,0);
  await hook.render().markRead('1');assert.equal(hook.render().readError,'read failed');
  fail=false;await hook.render().markRead('1');await hook.render().markRead('1');assert.equal(reads,2);assert.equal(hook.render().readError,'');
  hook.app('background');await hook.render().markRead('1');assert.equal(reads,2);
  hook.focus(false);await hook.render().markRead('1');assert.equal(reads,2);
});
test('send is guarded, failures remain actionable, acknowledgments display without realtime and do not skip missed messages',async()=>{
  let fail=true,sends=0,resolveSend;const reads=[];
  const hook=harness('chat',{
    loadChatInfo:async()=>info,
    loadMessagePage:async(_id,_s,c)=>{reads.push(c?.id);return !c?[message(1)]:c.id==='1'?[message(2),message(3)]:[];},
    sendChatMessage:async()=>{sends++;if(fail)throw Error('not sent');return new Promise(resolve=>{resolveSend=resolve;});},markChatRead:async()=>{},
  });
  hook.render();await settle();assert.equal(await hook.render().send('hello'),false);assert.equal(hook.render().sendError,'not sent');
  fail=false;const sending=hook.render().send('hello');assert.equal(await hook.render().send('duplicate'),false);assert.equal(sends,2);
  resolveSend(message(3,{sender_id:'me'}));assert.equal(await sending,true);assert.equal(hook.render().messages.at(-1).id,'3');
  await hook.render().refresh();assert.ok(reads.includes('1'));assert.deepEqual(Array.from(hook.render().messages,m=>m.id),['1','2','3']);hook.focus(false);
});
test('messages observed during an in-flight read are acknowledged afterward',async()=>{
  const reads=[];let finish;
  const hook=harness('chat',{loadChatInfo:async()=>info,loadMessagePage:async(_id,_s,c)=>c?[]:[message(2),message(1)],
    markChatRead:async(_id,messageId)=>{reads.push(messageId);if(messageId==='1')await new Promise(resolve=>{finish=resolve;});}});
  hook.render();await settle();const first=hook.render().markRead('1');await hook.render().markRead('2');
  finish();await first;assert.deepEqual(reads,['1','2']);hook.focus(false);
});
test('archive prevents sending; late chat loads cannot expose the previous account',async()=>{
  const requests=[];let sends=0;
  const hook=harness('chat',{loadChatInfo:async()=>({...info,is_archived:true}),loadMessagePage:(_id,signal)=>new Promise(resolve=>requests.push({signal,resolve})),sendChatMessage:async()=>{sends++;return message(1);}});
  hook.render();await settle();hook.account('another');await settle();assert.equal(requests[0].signal.aborted,true);
  requests[1].resolve([message(2)]);await settle();requests[0].resolve([message(1)]);await settle();
  assert.deepEqual(Array.from(hook.render().messages,m=>m.id),['2']);assert.equal(await hook.render().send('hi'),false);assert.equal(sends,0);hook.focus(false);
});

test('service pages summaries without downloading all messages and surfaces missing setup/errors',async()=>{
  let fail=false;const ranges=[];
  const api=load('services/messaging-service.ts',{
    '@/lib/supabase':{supabase:{rpc(name){assert.equal(name,'get_conversation_summaries');const query={order(){return query;},range(a,b){ranges.push([a,b]);return query;},abortSignal(){const start=ranges.at(-1)[0];return Promise.resolve(fail?{error:{message:'missing RPC'}}:{data:start<3?[{id:String(start),type:'direct',title:'Peer',last_message:'Hi',last_message_at:`2026-10-29T12:00:0${start}Z`,unread_count:2}]:[]});}};return query;}}},
    '@/lib/profile/resolve-avatar-uri':{resolveAvatarUri:()=>''},'@/lib/messaging':pure,
  });
  const rows=await api.loadConversations(new AbortController().signal);
  assert.deepEqual(Array.from(rows,r=>r.id),['2','1','0']);assert.equal(rows[0].unreadCount,2);assert.deepEqual(ranges.map(r=>r[0]),[0,1,2,3]);
  fail=true;await assert.rejects(api.loadConversations(new AbortController().signal),/Could not load conversations/);
});
test('chat subscription covers messages, receipts, membership, archive/delete and reconnect with cleanup',()=>{
  const tables=[];let change,subscribe,removed=0,notifications=0;
  const channel={on(_event,config,fn){tables.push(config);change=fn;return channel;},subscribe(fn){subscribe=fn;return channel;}};
  const api=load('services/messaging-service.ts',{'@/lib/supabase':{supabase:{channel:()=>channel,removeChannel:()=>{removed++;}}},'@/lib/profile/resolve-avatar-uri':{},'@/lib/messaging':pure});
  const cleanup=api.subscribeToChats(()=>notifications++,'chat');assert.equal(tables.length,5);
  assert.ok(tables.some(t=>t.table==='conversation_read_state'));change();subscribe('SUBSCRIBED');api.notifyChatChanged();assert.equal(notifications,3);
  cleanup();api.notifyChatChanged();assert.equal(notifications,3);assert.equal(removed,1);
});
