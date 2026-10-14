const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'schema-fixture.json'),'utf8'));
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create type public.event_type as enum('public','private');create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,owner uuid);alter table storage.objects enable row level security;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public,storage to authenticated,anon,service_role;`);
 const tables=[...new Set(fixture.columns.map(c=>c.table_name))].filter(t=>!['upcoming_campus_events','past_campus_events'].includes(t));
 for(const table of tables){const columns=fixture.columns.filter(c=>c.table_name===table).map(c=>`"${c.column_name}" ${c.data_type==='USER-DEFINED'?(c.column_name==='event_type'?'public.event_type':'text'):c.data_type==='ARRAY'?'text[]':c.data_type}`);await db.exec(`create table public.${table}(${columns.join(',')});`);}
 for(const key of fixture.constraints.filter(c=>/^(PRIMARY KEY|UNIQUE|FOREIGN KEY)/.test(c.definition)).sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY')))) await db.exec(`alter table public.${key.table_name} add constraint "${key.name}" ${key.definition};`);
 for(const table of tables) await db.exec(`alter table public.${table} enable row level security;grant all on public.${table} to service_role;grant select,insert,update,delete on public.${table} to authenticated;create policy existing_read on public.${table} for select to public using(true);`);
 await db.exec(`alter table activities alter id set default gen_random_uuid();alter table activities alter status set default 'active';create policy own_insert on activities for insert to authenticated with check(host_id=auth.uid());create policy own_update on activities for update to authenticated using(host_id=auth.uid()) with check(host_id=auth.uid());create policy own_delete on activities for delete to authenticated using(host_id=auth.uid());`);
 await db.exec('alter table universities alter enabled set default true;alter table university_event_sources alter enabled set default true;drop policy existing_read on campus_events;');
 await db.exec(fs.readFileSync(path.join(__dirname,'multi-university-fixture.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'account-center-fixture.sql'),'utf8'));
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610130002_host_campus_event.sql'),'utf8');
 await db.exec(migration);await db.exec(migration);
 const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');const a=uid(1),b=uid(2),c=uid(3),d=uid(4);
 for(const [id,email] of [[a,'a@latech.edu'],[b,'b@latech.edu'],[c,'c@ulm.edu'],[d,'d@gmail.com']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query('insert into profiles(id,email,full_name,is_private) values($1,$2,$2,false)',[id,email]);}
 async function as(id,work){await db.exec('begin;set local role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);try{const result=await work();await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}}
 const [future,other,ended,canceled,academic,allDay]=[20,21,22,23,24,25].map(uid);
 for(const [id,campus,status,category] of [[future,'latech','CONFIRMED','Athletics'],[other,'ulm','CONFIRMED','Social'],[ended,'latech','CONFIRMED','Social'],[canceled,'latech','CANCELLED','Social'],[academic,'latech','CONFIRMED','Academic Calendar'],[allDay,'latech','CONFIRMED','Social']])await db.query(`insert into campus_events(id,campus,source_id,title,category,tags,location,image_url,status,date_only,starts_at,ends_at,start_date,end_date,time_zone,official_url) values($1::uuid,$2,$1::uuid::text,'Campus gathering',$4,'{}','Blue Gym','https://example.test/photo.jpg',$3,$5,now()+interval '1 day',now()+interval '2 days',current_date+1,current_date+1,'America/Chicago','https://www.latech.edu/events.php')`,[id,campus,status,category,id===allDay]);
 await db.query(`update campus_events set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where id=$1`,[ended]);
 const meeting=(await db.query("select to_char((now()+interval '1 day') at time zone 'America/Chicago','YYYY-MM-DD HH24:MI') value")).rows[0].value;
 async function host(actor,event= future,overrides={}){const p={owner:actor,meeting,location:'Blue Gym',category:'sports',capacity:20,sharing:true,visibility:'public',description:'Come join our group',...overrides};return as(actor,async()=> (await db.query('select public.host_campus_event($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[event,p.owner,p.meeting,p.location,p.category,p.capacity,p.sharing,p.visibility,p.description])).rows[0].id);}
 assert.equal((await db.query('select count(*)::int n from activities')).rows[0].n,0);
 const id=await host(a);assert.equal(await host(a),id);
 const row=(await db.query('select * from activities where id=$1',[id])).rows[0];assert.equal(row.host_id,a);assert.equal(row.source_campus_event_id,future);assert.equal(row.ride_sharing,true);assert.equal(row.max_attendees,20);assert.equal(row.event_type,'public');assert.equal(row.title,'Campus gathering');assert.equal(row.location,'Blue Gym');assert.equal(row.image_url,'https://example.test/photo.jpg');
 const another=await host(b,future,{visibility:'private'});assert.notEqual(another,id);assert.equal((await db.query('select count(*)::int n from activities')).rows[0].n,2);
 await assert.rejects(()=>host(c,future));await assert.rejects(()=>host(a,other));await assert.rejects(()=>host(d,future));await assert.rejects(()=>host(b,other,{owner:a}));
 await assert.rejects(()=>host(a,ended));await assert.rejects(()=>host(a,canceled));await assert.rejects(()=>host(a,academic));await assert.rejects(()=>host(b,academic,{capacity:0}));
 await assert.rejects(()=>host(a,allDay,{location:''}));await assert.rejects(()=>host(a,allDay,{meeting:'2020-01-01 12:00'}));await assert.rejects(()=>host(a,allDay,{capacity:0}));
 await as(a,()=>db.query('select rollin_set_deactivated(true,$1)',[a]));await assert.rejects(()=>host(a,allDay));await as(a,()=>db.query('select rollin_set_deactivated(false,$1)',[a]));
 await assert.rejects(()=>as(a,()=>db.query(`insert into activities(id,host_id,title,source_campus_event_id) values($1,$2,'Forged',$3)`,[uid(70),a,other])));
 await as(a,()=>db.query(`insert into activities(id,host_id,title) values($1,$2,'Ordinary activity')`,[uid(71),a]));
 await host(a,allDay);
 await db.query('delete from campus_events where id=$1',[future]);assert.equal((await db.query('select source_campus_event_id from activities where id=$1',[id])).rows[0].source_campus_event_id,null);
 console.log('PASS: migration rerun, no automatic activities, normal activity creation, duplicate retry, separate hosts, school/identity isolation, canceled/past/academic rejection, settings validation, deactivation guard, ordinary posts, source deletion preserves hosted activities.');
 await db.close();
})().catch(error=>{console.error(error.message,error.query);process.exit(1);});
