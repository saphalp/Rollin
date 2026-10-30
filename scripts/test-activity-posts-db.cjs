// Isolated PostgreSQL; never connects to or changes the shared Supabase project.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../.expo/login-security-validation/node_modules/@electric-sql/pglite');
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('activity posts enforce host/author privacy, private activity membership, direct access and deterministic paging', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create function public.login_email_verified() returns boolean language sql stable as $$select coalesce(current_setting('test.verified',true),'false')='true'$$;
    create table profiles(id uuid primary key, full_name text, profile_picture text, is_private boolean default false);
    create table account_settings(user_id uuid, deactivated_at timestamptz, deletion_started_at timestamptz);
    create table follows(following_id uuid, follower_id uuid, status text);
    create table activities(id uuid primary key, host_id uuid, event_type text default 'public', hidden boolean default false);
    create table rsvps(id uuid primary key, activity_id uuid, user_id uuid);
    create table activity_photos(id uuid primary key, activity_id uuid, user_id uuid, caption text, created_at timestamptz, image_path text);
    create table activity_photo_images(id uuid primary key, post_id uuid, user_id uuid, image_path text, position integer);
    create table post_likes(id uuid primary key, post_id uuid, user_id uuid);
    grant usage on schema auth, public to authenticated, anon;
    grant select on all tables in schema public to authenticated;
    alter table activities enable row level security;
    create policy existing_activity_access on activities for select to authenticated using (not hidden);
    alter table rsvps enable row level security;
    create policy own_rsvp on rsvps for select to authenticated using(user_id=auth.uid());
    create policy existing_photos on activity_photos for select to authenticated using(true);
    create policy existing_images on activity_photo_images for select to authenticated using(true);
    create policy existing_likes on post_likes for select to authenticated using(true);
  `);
  // Use the actual account privacy helpers, not a permissive stand-in.
  const account = fs.readFileSync('tests/account-center-fixture.sql','utf8');
  await db.exec(account.slice(account.indexOf('create or replace function public.rollin_account_active'), account.indexOf('create or replace function public.rollin_can_view_social')));
  await db.exec(`alter table profiles enable row level security;
    create policy profile_access on profiles for select to authenticated using(rollin_can_view_profile(id));`);
  const migration=fs.readFileSync('supabase/migrations/20261029160000_activity_explore_posts.sql','utf8');
  await db.exec(migration); await db.exec(migration);
  const host=uid(1), author=uid(2), viewer=uid(3), activity=uid(10), another=uid(11), post=uid(20);
  for(const id of [host,author,viewer]) {
    await db.query('insert into auth.users values($1)',[id]);
    await db.query('insert into profiles(id,full_name) values($1,$2)',[id,`User ${id}`]);
  }
  await db.query('insert into activities(id,host_id) values($1,$2),($3,$2)',[activity,host,another]);
  await db.query('insert into activity_photos values($1,$2,$3,$4,$5,$6)',[post,activity,author,'Visible caption','2026-10-29T12:00:00Z','legacy.jpg']);
  await db.query('insert into post_likes values($1,$2,$3)',[uid(40),post,viewer]);
  async function admin(sql,params=[]) { await db.exec('reset role'); if(sql) return db.query(sql,params); }
  async function as(user=viewer,verified=true) {
    await admin(); await db.query("select set_config('test.user',$1,false),set_config('test.verified',$2,false)",[user,String(verified)]);
    await db.exec('set role authenticated');
  }
  const posts=async()=> (await db.query('select * from get_activity_explore_posts($1)',[activity])).rows;
  const direct=async()=> (await db.query('select * from get_activity_explore_posts(p_post_id=>$1)',[post])).rows;
  async function hidden() {
    assert.equal((await posts()).length,0);
    assert.equal((await direct()).length,0);
    for(const table of ['activity_photos','activity_photo_images','post_likes'])
      assert.equal((await db.query(`select * from ${table}`)).rows.length,0,table+' must not bypass post privacy');
  }
  await as(); let result=await posts(); assert.equal(result.length,1);
  assert.deepEqual(result[0].image_paths,['legacy.jpg']);assert.equal(Number(result[0].like_count),1);assert.equal(result[0].liked_by_me,true);
  await admin('insert into activity_photo_images values($1,$2,$3,$4,1),($5,$2,$3,$6,0)',[uid(30),post,author,'second.jpg',uid(31),'first.jpg']);
  await as(); assert.deepEqual((await posts())[0].image_paths,['first.jpg','second.jpg']);
  await admin('update profiles set is_private=true where id=$1',[host]); await as();await hidden();
  await admin('insert into follows values($1,$2,$3)',[host,viewer,'pending']); await as();await hidden();
  await admin("update follows set status='accepted'"); await as();assert.equal((await posts()).length,1);
  await admin('update profiles set is_private=true where id=$1',[author]); await as();await hidden();
  await admin('insert into follows values($1,$2,$3)',[author,viewer,'accepted']); await as();assert.equal((await posts()).length,1);
  await admin('delete from follows where following_id=$1',[host]); await as();await hidden();
  await admin('insert into follows values($1,$2,$3)',[host,viewer,'accepted']); await as();assert.equal((await posts()).length,1);
  await as(author);assert.equal((await direct()).length,1,'author can view their own post without following host');
  await admin("update activities set event_type='private' where id=$1",[activity]);await as();await hidden();
  await admin('insert into rsvps values($1,$2,$3)',[uid(50),activity,viewer]);await as();assert.equal((await posts()).length,1);
  await admin('delete from rsvps');await as();await hidden();
  await admin('update profiles set is_private=false');await as(host);assert.equal((await posts()).length,1,'host sees private activity posts from visible authors');
  await admin("update activities set event_type='public',hidden=true");await as();await hidden();
  await admin('update activities set hidden=false');await as(viewer,false);await hidden();
  await admin("insert into account_settings values($1,now(),null)",[author]);await as();await hidden();
  await admin('delete from account_settings');await as();assert.equal((await posts()).length,1);
  await admin('insert into account_settings values($1,now(),null)',[viewer]);await as();await hidden();
  await admin('delete from account_settings');await as('');await hidden();
  await admin();await db.exec('set role anon');await assert.rejects(posts(),/permission denied/);

  // Keyset pagination handles equal timestamps and microseconds without duplicates.
  await admin();
  for(let n=0;n<18;n++)await db.query('insert into activity_photos values($1,$2,$3,null,$4,null)',
    [uid(100+n),activity,author,`2026-10-29T13:00:00.${String(Math.floor(n/2)).padStart(6,'0')}Z`]);
  await db.query('insert into activity_photos values($1,$2,$3,null,now(),null)',[uid(200),another,author]);
  await as();
  let page=(await db.query('select * from get_activity_explore_posts(p_activity_id=>$1,p_limit=>6)',[activity])).rows;
  const seen=new Set();
  while(page.length) {
    for(const row of page){ assert.ok(!seen.has(row.id));seen.add(row.id);assert.equal(row.activity_id,activity); }
    const last=page.at(-1);
    page=(await db.query(`select * from get_activity_explore_posts(
      p_activity_id=>$1,p_before_created_at=>(select created_at from activity_photos where id=$2),p_before_id=>$2,p_limit=>6)`,[activity,last.id])).rows;
  }
  assert.equal(seen.size,19);
  assert.equal((await db.query('select * from get_activity_explore_posts()')).rows.length,0,'no accidental global feed');
});
