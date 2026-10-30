// Isolated PostgreSQL tests; never connect to the project's Supabase database.
// npm install --prefix .expo/login-security-validation --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.9
// node --test scripts/test-login-email-db.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('../.expo/login-security-validation/node_modules/@electric-sql/pglite');
const user = '10000000-0000-4000-8000-000000000001';
const session = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const challenge = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('email-login SQL enforces session isolation, expiration, guesses, cooldowns, permissions and rollout', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;
    create schema auth; create schema storage; create schema realtime;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    grant usage on schema auth,public,storage,realtime to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key,note text);
    alter table public.profiles enable row level security;
    create policy own_profile on public.profiles to authenticated using (id=auth.uid()) with check (id=auth.uid());
    create table public.legacy_data(note text);
    create table storage.objects(note text);
    create table realtime.messages(note text);
    grant select,insert,update,delete on public.profiles,public.legacy_data,storage.objects,realtime.messages to authenticated;
    insert into auth.users values ('${user}','student@example.com',now());
    insert into auth.sessions values ('${session(1)}','${user}',null);
    insert into public.profiles values ('${user}','private');
    insert into public.legacy_data values ('legacy');
    insert into storage.objects values ('file');
    insert into realtime.messages values ('message');
  `);
  await db.exec(readFileSync('supabase/migrations/202610140001_login_email.sql','utf8'));
  const privateTables = await db.query("select relname,relrowsecurity from pg_class where relnamespace='login_security'::regnamespace and relkind='r'");
  assert.equal(privateTables.rows.length,2);
  assert.ok(privateTables.rows.every(table => table.relrowsecurity),'private verification tables enable RLS explicitly');
  for (let i=2;i<=8;i++) await db.query('insert into auth.sessions values ($1,$2,null)',[session(i),user]);
  await db.exec(readFileSync('supabase/migrations/202610140002_enforce_login_email.sql','utf8'));
  const value = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
  const login = async n => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session(n),role:'authenticated'})]);
    await db.exec('set role authenticated');
  };
  const admin = async () => { await db.exec('reset role'); await db.exec('set role service_role'); };
  const begin = async (n,c=n) => { await admin(); return value('select public.begin_login_email($1,$2,$3,$4,$5)',[session(n),user,'student@example.com',challenge(c),'good']); };
  const finish = async (n,hash='good',c=n) => { await admin(); return value('select public.finish_login_email($1,$2,$3,$4,$5)',[session(n),user,'student@example.com',challenge(c),hash]); };
  const clearSends = async () => { await db.exec('reset role; delete from login_security.sends'); };

  await login(1);
  assert.equal(await value('select public.login_email_verified()'),true,'existing sessions preserved');
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  await login(2);
  assert.equal(await value('select public.login_email_verified()'),false,'new session requires email');
  for (const table of ['public.profiles','public.legacy_data','storage.objects','realtime.messages']) {
    assert.equal((await db.query(`select * from ${table}`)).rows.length,0,`unverified RLS: ${table}`);
  }
  await assert.rejects(db.exec("insert into public.legacy_data values ('bypass')"),/row-level security/);
  await assert.rejects(db.exec('select * from login_security.sessions'),/permission denied/);
  await assert.rejects(db.query('select public.begin_login_email($1,$2,$3,$4,$5)',[session(2),user,'student@example.com',challenge(2),'good']),/permission denied/);
  await assert.rejects(db.query('select public.finish_login_email($1,$2,$3,$4,$5)',[session(2),user,'student@example.com',challenge(2),'good']),/permission denied/);
  await db.query("select set_config('request.path','/rest/v1/profiles',false)");
  await assert.rejects(db.exec('select public.enforce_login_email()'),/Complete email/);
  await db.query("select set_config('request.path','/rpc/login_email_verified',false)");
  await db.exec('select public.enforce_login_email()');

  assert.equal((await begin(2)).sent,true);
  const cooldown=await begin(2,9);
  assert.ok(cooldown.retryAfter>0);
  assert.equal(cooldown.challengeId,challenge(2),'reattach existing challenge during cooldown');
  assert.equal(await finish(3,'good',2),false,'another session cannot use the code');
  assert.equal(await finish(2,'good',9),false,'wrong challenge');
  assert.equal(await finish(2),true);
  assert.equal(await finish(2),false,'single use');
  await login(2);
  assert.equal(await value('select public.login_email_verified()'),true);
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  await db.query("select set_config('request.path','/rpc/other',false)");
  await db.exec('select public.enforce_login_email()');
  await clearSends(); await begin(3);
  for(let i=0;i<5;i++) assert.equal(await finish(3,'bad'),false);
  assert.equal(await finish(3),false,'correct code fails after five wrong guesses');
  await clearSends(); await begin(3,10);
  assert.equal(await finish(3,'good',3),false,'old challenge invalid after resend');
  assert.equal(await finish(3,'good',10),true);
  await clearSends(); await begin(4);
  await db.exec(`reset role; update login_security.sessions set expires_at=now()-interval '1 second' where session_id='${session(4)}'`);
  assert.equal(await finish(4),false,'expired code rejected');
  await clearSends();
  await db.exec(`insert into login_security.sends select '${user}',now()-interval '2 minutes' from generate_series(1,5)`);
  assert.match((await begin(5)).error,/Too many/);
  await clearSends();
  await db.exec(`insert into login_security.sends select '${user}',now()-interval '1 hour' from generate_series(1,20)`);
  assert.match((await begin(5)).error,/Too many/);
  await db.exec(`reset role; update auth.users set email='changed@example.com' where id='${user}'`);
  await login(2);
  assert.equal(await value('select public.login_email_verified()'),false,'email change invalidates approval');
  await db.exec(`reset role; update auth.users set email='student@example.com' where id='${user}'; delete from auth.sessions where id='${session(2)}'`);
  await login(2);
  assert.equal(await value('select public.login_email_verified()'),false,'deleted session cannot access data');
  await login(1);
  await assert.rejects(db.exec("insert into public.profiles values ('10000000-0000-4000-8000-000000000099','other')"),/row-level security/,'existing ownership policies still apply');

  // The login-code switch: on by default, and turning it off approves any live session.
  await db.exec('reset role');
  const toggle = readFileSync('supabase/migrations/20261030130000_login_code_toggle.sql','utf8');
  await db.exec(toggle); await db.exec(toggle); // safe to re-run in SQL editor
  await db.query('insert into auth.sessions values ($1,$2,null)',[session(9),user]);
  await login(9);
  assert.equal(await value('select public.login_email_verified()'),false,'code still required by default');
  await db.exec('reset role; update login_security.settings set require_login_code = false');
  await login(9);
  assert.equal(await value('select public.login_email_verified()'),true,'password-only login when switched off');
  assert.equal((await db.query('select * from public.profiles')).rows.length,1,'switched off: data reachable without a code');
  await db.exec(`reset role; delete from auth.sessions where id='${session(9)}'`);
  await login(9);
  assert.equal(await value('select public.login_email_verified()'),false,'switched off: signed-out sessions stay blocked');
  await db.exec('reset role; update login_security.settings set require_login_code = true');
  await db.query('insert into auth.sessions values ($1,$2,null)',[session(9),user]);
  await login(9);
  assert.equal(await value('select public.login_email_verified()'),false,'switching back on requires a code again');
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select * from login_security.settings'),/permission denied/,'clients cannot read or change the switch');
});
