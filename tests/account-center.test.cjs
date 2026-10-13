const fs=require('fs'),assert=require('assert/strict'),ts=require('typescript');const {PGlite}=require('@electric-sql/pglite');
const path=require('path');const root=path.resolve(__dirname,'../')+'/';
const schema=JSON.parse(fs.readFileSync(__dirname+'/schema-fixture.json','utf8'));
const sql=fs.readFileSync(root+'supabase/migrations/202610130001_account_center.sql','utf8');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,owner uuid);alter table storage.objects enable row level security;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public,storage to authenticated,anon,service_role;`);
 const excluded=new Set(['upcoming_campus_events','past_campus_events']);const tables=[...new Set(schema.columns.map(c=>c.table_name))].filter(t=>!excluded.has(t));
 for(const table of tables){const cols=schema.columns.filter(c=>c.table_name===table).map(c=>`"${c.column_name}" ${c.data_type==='USER-DEFINED'?'text':c.data_type==='ARRAY'?'text[]':c.data_type}`);await db.exec(`create table public.${table}(${cols.join(',')});`);}
 // Preserve actual keys and ON DELETE actions; omit unrelated source-specific CHECK/default types.
 for(const key of schema.constraints.filter(c=>/^(PRIMARY KEY|UNIQUE)/.test(c.definition)))await db.exec(`alter table public.${key.table_name} add constraint "${key.name}" ${key.definition};`);
 for(const key of schema.constraints.filter(c=>/^FOREIGN KEY/.test(c.definition)))await db.exec(`alter table public.${key.table_name} add constraint "${key.name}" ${key.definition};`);
 // Intentionally permissive SELECT rules mirror the existing USING(true) policies.
 for(const table of tables){await db.exec(`alter table ${table} enable row level security;grant all on ${table} to service_role;grant select,insert,update,delete on ${table} to authenticated;grant select on ${table} to anon;create policy existing_read_all on ${table} for select to public using(true);`);}
 await db.exec(`create policy own_profile_write on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());create policy own_activity_write on activities for insert to authenticated with check(host_id=auth.uid());create policy own_photo_write on activity_photos for insert to authenticated with check(user_id=auth.uid());create policy own_follow_write on follows for insert to authenticated with check(follower_id=auth.uid());create policy existing_storage_insert on storage.objects for insert to authenticated with check(true);grant select,insert,delete on storage.objects to authenticated;create policy existing_storage_read on storage.objects for select to authenticated using(true);create policy existing_storage_delete on storage.objects for delete to authenticated using(true);create policy target_follow_update on follows for update to authenticated using(following_id=auth.uid()) with check(following_id=auth.uid());`);
 await db.exec(sql);await db.exec(sql);
 const preflight=await db.query(fs.readFileSync(root+'supabase/account-center-preflight.sql','utf8'));assert(preflight.rows.every(row=>row.result==='PASS'));console.log('Read-only installation preflight checks passed.');
 const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');const [a,b,c]=[1,2,3].map(uid);const activity=uid(20),ride=uid(30);
 for(const [id,email] of [[a,'a@example.test'],[b,'b@example.test'],[c,'c@example.test']]){await db.query('insert into auth.users values($1,$2)',[id,email]);await db.query('insert into profiles(id,email,full_name,is_private) values($1,$2,$2,false)',[id,email]);}
 await db.query(`insert into activities(id,host_id,title,status) values($1,$2,'Hosted','active')`,[activity,a]);
 async function as(id,fn){await db.exec('begin;set local role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);try{const r=await fn();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
 const account=async id=>as(id,async()=> (await db.query('select * from rollin_my_account()')).rows[0]);
 await as(a,()=>db.query('select rollin_update_privacy(true,false,$1)',[a]));
 assert.equal((await account(a)).is_private,true);
 await assert.rejects(()=>as(a,()=>db.query('select rollin_update_privacy(false,true,$1)',[b])));
 await assert.rejects(()=>as(a,()=>db.query('select rollin_set_deactivated(true,$1)',[b])));
 await as(b,async()=>{assert.equal((await db.query('select * from profiles where id=$1',[a])).rows.length,0);const brief=(await db.query('select * from rollin_profile_access($1)',[a])).rows[0];assert.equal(brief.can_view,false);assert(!('email' in brief));});
 await as(a,()=>db.query(`insert into profile_social_links values($1,'instagram','https://instagram.com/sandip')`,[a]));
 await assert.rejects(()=>as(b,()=>db.query(`insert into follows(id,follower_id,following_id,status) values($1,$2,$3,'accepted')`,[uid(11),b,a])));
 await as(b,()=>db.query(`insert into follows(id,follower_id,following_id,status) values($1,$2,$3,'pending')`,[uid(11),b,a]));
 await as(b,async()=>{await db.query("update follows set status='accepted' where id=$1",[uid(11)]);assert.equal((await db.query('select status from follows where id=$1',[uid(11)])).rows[0].status,'pending');});
 await as(a,()=>db.query("update follows set status='accepted' where id=$1",[uid(11)]));
 await db.query('delete from follows where id=$1',[uid(11)]);
 await db.query(`insert into follows(id,follower_id,following_id,status) values($1,$2,$3,'accepted')`,[uid(10),b,a]);
 await as(b,async()=>{assert.equal((await db.query('select * from profiles where id=$1',[a])).rows.length,1);assert.equal((await db.query('select * from profile_social_links')).rows.length,0);});
 await as(a,()=>db.query('select rollin_update_privacy(true,true,$1)',[a]));
 await as(b,async()=>assert.equal((await db.query('select * from profile_social_links')).rows.length,1));
 await as(c,async()=>assert.equal((await db.query('select * from profile_social_links')).rows.length,0));
 await assert.rejects(()=>as(b,()=>db.query(`insert into profile_social_links values($1,'facebook','https://facebook.com/test')`,[a])));
 await assert.rejects(()=>as(a,()=>db.query(`insert into profile_social_links values($1,'facebook','https://facebook.com.evil.test/a')`,[a])));
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values('avatars','retained.jpg',$1)",[a]);
 await as(a,()=>db.query('select rollin_set_deactivated(true,$1)',[a]));
 assert.equal((await account(a)).deactivated,true);
 await as(a,()=>db.query("delete from storage.objects where name='retained.jpg'"));
 assert.equal((await db.query("select * from storage.objects where name='retained.jpg'")).rows.length,1);
 await db.query("delete from storage.objects where name='retained.jpg'");
 await as(b,async()=>{assert.equal((await db.query('select * from profiles where id=$1',[a])).rows.length,0);assert.equal((await db.query('select * from activities where id=$1',[activity])).rows.length,0);});
 await assert.rejects(()=>as(a,()=>db.query(`insert into activities(id,host_id,title) values($1,$2,'Blocked')`,[uid(21),a])));
 await assert.rejects(()=>as(a,()=>db.query(`insert into storage.objects(bucket_id,name) values('avatars','blocked')`)));
 await as(a,()=>db.query('select rollin_set_deactivated(false,$1)',[a]));
 assert.equal((await account(a)).deactivated,false);
 await db.query(`insert into rides_offered(id,driver_id,status) values($1,$2,'in_progress')`,[ride,a]);
 await assert.rejects(()=>as(a,()=>db.query('select rollin_set_deactivated(true,$1)',[a])));
 await assert.rejects(()=>db.query('select rollin_begin_delete($1)',[a]));
 await db.query(`update rides_offered set status='completed' where id=$1`,[ride]);
 await assert.rejects(()=>as(a,()=>db.query('select rollin_begin_delete($1)',[b])));
 await db.query('select rollin_begin_delete($1)',[a]);
 assert.equal((await account(a)).deleting,true);
 await assert.rejects(()=>as(a,()=>db.query('select rollin_set_deactivated(false,$1)',[a])));
 await db.query(`insert into storage.objects(bucket_id,name,owner_id) values('avatars',$1,$2),('avatars',$3,$4)`,[a+'/avatar.jpg',a,b+'/avatar.jpg',b]);
 const files=(await db.query('select * from rollin_delete_files($1,$2)',[a,'https://project.supabase.co'])).rows;assert.equal(files.length,1);assert.equal(files[0].name,a+'/avatar.jpg');
 await db.query('delete from auth.users where id=$1',[a]);
 assert.equal((await db.query('select * from activities where id=$1',[activity])).rows.length,0);
 assert.equal((await db.query('select * from profiles where id=$1',[a])).rows.length,0);
 await as(a,async()=>assert.equal((await db.query('select * from profiles')).rows.length,0));
 await assert.rejects(()=>as(a,()=>db.query(`insert into activities(id,host_id,title) values($1,$2,'Old JWT')`,[uid(22),a])));
 console.log('PostgreSQL tests passed: migration rerun, private profile and accepted followers, hidden social links, URL/owner checks, deactivation/reactivation, write/upload blocking, ongoing ride protection, backend-only deletion, cascades, stale-token access.');
 // Pure helpers and destructive workflow: failure MUST NOT delete Auth before files.
 const transpile=p=>ts.transpileModule(fs.readFileSync(root+p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 fs.writeFileSync(__dirname+'/social.cjs',transpile('lib/social-links.ts'));const social=require(__dirname+'/social.cjs');assert.equal(social.normalizeSocialLink('instagram','instagram.com/sandip'),'https://instagram.com/sandip');for(const url of ['https://instagram.com.evil.test/u','https://user:pass@instagram.com/u','https://instagram.com/u?x=1','https://instagram.com:8443/u'])assert.throws(()=>social.normalizeSocialLink('instagram',url));
 fs.writeFileSync(__dirname+'/delete.cjs',transpile('supabase/functions/account-actions/delete-account.ts'));const {deleteAccount}=require(__dirname+'/delete.cjs');let left=250,removed=0,authDeleted=0;const fake={rpc:async name=>({data:name==='rollin_delete_files'?Array.from({length:Math.min(left,200)},(_,i)=>({bucket_id:'avatars',name:'f'+i})):null}),storage:{from:()=>({remove:async paths=>{left-=paths.length;removed+=paths.length;return {};}})},auth:{admin:{deleteUser:async()=>{authDeleted++;return {};}}}};await deleteAccount(fake,'a','https://project.supabase.co');assert.equal(removed,250);assert.equal(authDeleted,1);
 authDeleted=0;left=1;fake.storage.from=()=>({remove:async()=>({error:{message:'test failure'}})});await assert.rejects(()=>deleteAccount(fake,'a','https://project.supabase.co'));assert.equal(authDeleted,0);
 fs.writeFileSync(__dirname+'/authorize.cjs',transpile('supabase/functions/account-actions/authorize-delete.ts'));
 const {authorizeDeletion}=require(__dirname+'/authorize.cjs');let proved=0;
 const authDB={auth:{getUser:async()=>({data:{user:{id:a,email:'a@example.test'}}})}};
 const proof={auth:{signInWithPassword:async payload=>{proved++;assert.equal(payload.email,'a@example.test');return {data:{user:{id:a}}};},signOut:async()=>({})}};
 const body={action:'delete',expected_user_id:a,password:'temporary test value',confirmation:'DELETE',email:'attacker@example.test'};
 assert.equal(await authorizeDeletion(authDB,proof,'validated-by-auth',body),a);
 await assert.rejects(()=>authorizeDeletion(authDB,proof,'token',{...body,expected_user_id:b}));
 await assert.rejects(()=>authorizeDeletion(authDB,proof,'token',{...body,confirmation:'delete'}));
 assert.equal(proved,1);
 proof.auth.signInWithPassword=async()=>({error:{message:'invalid password'}});
 await assert.rejects(()=>authorizeDeletion(authDB,proof,'token',body));
 authDB.auth.getUser=async()=>({error:{message:'invalid token'}});
 await assert.rejects(()=>authorizeDeletion(authDB,proof,'forged',body));
 console.log('Deletion identity, expected-account and password reauthentication tests passed.');
 console.log('Social-link validation and deletion ordering/retry failure tests passed.');await db.close();
})().catch(err=>{console.error(err.message,err.query);process.exit(1)});
