// Isolated PostgreSQL test: does not connect to Supabase or change project data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../.expo/login-security-validation/node_modules/@electric-sql/pglite');
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('chat SQL enforces membership, verified sessions, unread counts, monotonic receipts and history paging', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create function public.login_email_verified() returns boolean language sql stable as $$select coalesce(current_setting('test.verified',true),'false')='true'$$;
    grant usage on schema auth, public to authenticated, anon;
    create table profiles(id uuid primary key, full_name text, profile_picture text);
    create table activities(id uuid primary key, title text, image_url text, category text);
    create table conversations(id uuid primary key, type text, activity_id uuid, created_at timestamptz default now(), is_archived boolean default false);
    create table conversation_participants(conversation_id uuid references conversations on delete cascade, user_id uuid,
      joined_at timestamptz default '2026-01-01', primary key(conversation_id,user_id));
    create table messages(id uuid primary key, conversation_id uuid references conversations, sender_id uuid,
      content text, type text default 'text', created_at timestamptz default now());
    create table deleted_conversations(conversation_id uuid, user_id uuid, deleted_at timestamptz not null default now(), primary key(conversation_id,user_id));
    create function member_of(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.conversation_participants where conversation_id=cid and user_id=auth.uid())$$;
    alter table conversations enable row level security;
    alter table messages enable row level security;
    alter table conversation_participants enable row level security;
    alter table deleted_conversations enable row level security;
    create policy members on conversations for select to authenticated using(member_of(id));
    create policy members on messages for select to authenticated using(member_of(conversation_id));
    create policy members on conversation_participants for select to authenticated using(member_of(conversation_id));
    create policy own_hidden on deleted_conversations for select to authenticated using(user_id=auth.uid());
    grant select on profiles,activities,conversations,conversation_participants,messages,deleted_conversations to authenticated;
    create publication supabase_realtime;
  `);
  const migration = fs.readFileSync('supabase/migrations/20261029120000_chat_read_status.sql', 'utf8');
  await db.exec(migration); await db.exec(migration); // safe to re-run in SQL editor
  const reopen = fs.readFileSync('supabase/migrations/20261030120000_reopen_deleted_conversations.sql', 'utf8');
  await db.exec(reopen); await db.exec(reopen);
  const me = uid(1), other = uid(2), stranger = uid(3), convo = uid(10), secret = uid(11);
  await db.exec(`insert into profiles values('${me}','Me',null),('${other}','Other',null),('${stranger}','Stranger',null);
    insert into conversations(id,type) values('${convo}','direct'),('${secret}','direct');
    insert into conversation_participants(conversation_id,user_id) values('${convo}','${me}'),('${convo}','${other}'),('${secret}','${stranger}');`);
  async function admin() { await db.exec('reset role'); }
  async function as(user, verified = true) {
    await admin(); await db.query("select set_config('test.user',$1,false),set_config('test.verified',$2,false)", [user, String(verified)]);
    await db.exec('set role authenticated');
  }
  const summary = async () => (await db.query('select * from get_conversation_summaries()')).rows;
  const mark = id => db.query('select mark_conversation_read($1,$2)', [convo,id]);
  // Equal timestamps and distinct microseconds must remain individually pageable.
  for (let n=0;n<125;n++) await db.query('insert into messages values($1,$2,$3,$4,$5,$6)', [uid(100+n),convo,other,`Message ${n}`,'text',`2026-10-29T12:00:00.${String(n).padStart(6,'0')}Z`]);
  await db.query('insert into messages values($1,$2,$3,$4,$5,$6)', [uid(500),convo,me,'My message','text','2026-10-29T12:01:00Z']);
  await db.query('insert into messages values($1,$2,$3,$4,$5,$6)', [uid(501),convo,other,'Before joining','text','2025-12-31T23:59:00Z']);
  await db.query('insert into messages values($1,$2,$3,$4,$5,$6)', [uid(502),secret,stranger,'Private','text','2026-10-29T12:01:00Z']);
  await as(me);
  let rows = await summary(); assert.equal(rows.length,1); assert.equal(Number(rows[0].unread_count),125); assert.equal(rows[0].last_message,'My message');
  await mark(uid(150)); rows=await summary(); assert.equal(Number(rows[0].unread_count),74);
  await mark(uid(120)); assert.equal(Number((await summary())[0].unread_count),74,'older device must not rewind read state');
  await assert.rejects(mark(uid(502)), /Message unavailable/);
  await assert.rejects(db.query('insert into conversation_read_state values($1,$2,now(),$3)',[convo,other,uid(500)]), /permission denied/);
  await as(other);
  assert.equal((await db.query('select * from conversation_read_state')).rows[0].user_id,me,'members can see receipts');
  await as(stranger);
  assert.equal((await db.query('select * from conversation_read_state')).rows.length,0);
  await assert.rejects(mark(uid(224)), /Conversation unavailable/);
  assert.equal((await db.query('select * from get_chat_messages($1)',[convo])).rows.length,0);
  await as(me,false); assert.equal((await summary()).length,0);
  await assert.rejects(mark(uid(224)), /verification/);
  assert.equal((await db.query('select * from conversation_read_state')).rows.length,0);
  await as(me);
  let page = (await db.query('select * from get_chat_messages($1)',[convo])).rows;
  assert.equal(page.length,50); assert.equal(page[0].id,uid(500));
  const seen=new Set(page.map(m=>m.id));
  while(page.length) {
    const cursor=page.at(-1);
    // PostgreSQL driver JS dates lose micros: ask PostgreSQL for the exact cursor instead.
    page=(await db.query('select * from get_chat_messages($1,(select created_at from messages where id=$2),$2,false)',[convo,cursor.id])).rows;
    for(const m of page){assert.ok(!seen.has(m.id));seen.add(m.id);}
  }
  assert.equal(seen.size,127,'all history survives beyond a page');
  const newer=(await db.query('select * from get_chat_messages($1,(select created_at from messages where id=$2),$2,true)',[convo,uid(150)])).rows;
  assert.equal(newer.length,50);assert.equal(newer[0].id,uid(151));
  await mark(uid(500)); assert.equal(Number((await summary())[0].unread_count),0);
  await admin(); await db.query(`insert into deleted_conversations values($1,$2,'9999-01-01')`,[convo,me]);
  await as(me); assert.equal((await summary()).length,0);
  await admin(); await db.query(`update deleted_conversations set deleted_at='2000-01-01' where user_id=$1`,[me]);
  await as(me); assert.equal((await summary()).length,1,'a message newer than the delete reopens the chat');
  await admin(); await db.query(`update deleted_conversations set deleted_at='9999-01-01' where user_id=$1`,[me]);
  await as(me); assert.equal((await summary()).length,0);
  await as(other); assert.equal((await summary()).length,1,'deleting for me must not hide it for others');
  await admin();await db.query('delete from conversation_participants where conversation_id=$1 and user_id=$2',[convo,me]);
  assert.equal((await db.query('select * from conversation_read_state')).rows.length,0,'leaving deletes old read position');
  await db.exec('set role anon'); await assert.rejects(mark(uid(500)),/permission denied/);
});
