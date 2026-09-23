// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite package.
// Uses an in-memory database; never connects to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to authenticated;
    create table profiles(id uuid primary key, full_name text);
    create table rides_offered(id uuid primary key, driver_id uuid, status text, pickup_location text not null,
      pickup_latitude float8, pickup_longitude float8, destination text);
    create table ride_requests(id uuid primary key, ride_id uuid, requester_id uuid, driver_id uuid, status text);
    create table ride_locations(ride_id uuid, driver_id uuid, is_active boolean, updated_at timestamptz);
    grant select, insert, update on profiles, rides_offered, ride_requests, ride_locations to authenticated;
    insert into profiles values ('${id(1)}','Driver'),('${id(2)}','Passenger'),('${id(3)}','Stranger'),('${id(4)}','Passenger 2');
    insert into rides_offered values ('${id(10)}','${id(1)}','in_progress','Meetup',32,-92,'Campus');
    insert into ride_requests values ('${id(20)}','${id(10)}','${id(2)}','${id(1)}','accepted');
    insert into ride_requests values ('${id(21)}','${id(10)}','${id(4)}','${id(1)}','accepted');
    insert into ride_locations values ('${id(10)}','${id(1)}',true,now());
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20260919090000_ride_ratings_and_pickups.sql', 'utf8'));
  async function as(n) { await db.exec(`reset role; set request.jwt.claim.sub = '${id(n)}'; set role authenticated;`); }
  const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
  await as(1);
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(2)}',5,'Too early')`));
  await db.exec(`select mark_passenger_picked_up('${id(20)}')`);
  await assert.rejects(db.exec(`select set_pickup_order('${id(10)}',array['${id(20)}']::uuid[])`));
  await db.exec(`select set_pickup_order('${id(10)}',array['${id(21)}']::uuid[])`);
  await as(2);
  await assert.rejects(db.exec(`update ride_requests set status='completed' where id='${id(20)}'`));
  await assert.rejects(db.exec(`select finish_ride('${id(10)}')`));
  await assert.rejects(db.exec(`select mark_passenger_picked_up('${id(21)}')`));
  await assert.rejects(db.exec(`update ride_requests set pickup_address='New house', pickup_latitude=33, pickup_longitude=-92 where id='${id(20)}'`));
  await as(1);
  await db.exec(`select finish_ride('${id(10)}')`);
  assert.equal(await scalar(`select status from ride_requests where id='${id(20)}'`), 'completed');
  assert.equal(await scalar(`select is_active from ride_locations where ride_id='${id(10)}'`), false);
  await db.exec(`select save_ride_rating('${id(10)}','${id(2)}',5,'Private feedback')`);
  await db.exec(`select save_ride_rating('${id(10)}','${id(2)}',4,'Edited feedback')`);
  assert.equal(await scalar('select count(*)::int from ride_ratings'), 1);
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(2)}',6,'Invalid')`));
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(1)}',5,'Self')`));
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(3)}',5,'Stranger')`));
  await as(2);
  assert.equal(await scalar('select comment from ride_ratings'), 'Edited feedback');
  await db.exec(`select save_ride_rating('${id(10)}','${id(1)}',5,'Thanks')`);
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(4)}',5,'Passenger to passenger')`));
  await as(3);
  assert.equal(await scalar('select count(*)::int from ride_ratings'), 0);
  assert.equal(Number(await scalar(`select average from ride_rating_summary('${id(2)}')`)), 4);
  assert.equal(await scalar('select count(*)::int from ride_rating_targets(null)'), 0);
  await assert.rejects(db.exec(`select save_ride_rating('${id(10)}','${id(1)}',1,'Unrelated')`));
  await assert.rejects(db.exec(`insert into ride_ratings values('${id(10)}','${id(3)}','${id(1)}',5,'Bypass',now())`));
  await as(4);
  assert.equal(await scalar('select count(*)::int from ride_rating_targets(null)'), 1);
  await db.exec(`insert into rides_offered(id,driver_id,status,pickup_mode,destination) values('${id(11)}','${id(1)}','open','individual','Campus')`);
  await assert.rejects(db.exec(`insert into ride_requests(id,ride_id,requester_id,driver_id,status) values('${id(22)}','${id(11)}','${id(4)}','${id(1)}','pending')`));
  await db.exec(`insert into ride_requests(id,ride_id,requester_id,driver_id,status,pickup_address,pickup_latitude,pickup_longitude)
    values('${id(22)}','${id(11)}','${id(4)}','${id(1)}','pending','My house',32.5,-92.5)`);
  await db.close();
  console.log('Database checks passed: rating eligibility, edits, privacy, averages, completion, pickup approval and order.');
})().catch(e => { console.error(e); process.exitCode = 1; });
