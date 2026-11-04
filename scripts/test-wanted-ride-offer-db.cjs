// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite package:
//   PGLITE_MODULE=<path-to-pglite> node --test scripts/test-wanted-ride-offer-db.cjs
// Uses an in-memory database; never connects to Supabase. The base ride tables, accept_ride_request
// and the notification triggers were created in the Supabase dashboard, so copies are set up here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const DRIVER = 1, PASSENGER = 2, UNVERIFIED = 3, OTHER = 4;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to authenticated;
    create table profiles(id uuid primary key, full_name text, profile_picture text);
    create table driver_profiles(profile_id uuid primary key, verification_status text);
    create table activities(id uuid primary key, title text, location text, date_time timestamptz);
    create table rides_offered(id uuid primary key default gen_random_uuid(), driver_id uuid, activity_id uuid,
      status text, pickup_location text not null, pickup_latitude float8, pickup_longitude float8,
      destination text, destination_latitude float8, destination_longitude float8, date_time timestamptz,
      available_seats int, notes text);
    create table ride_requests(id uuid primary key default gen_random_uuid(), ride_id uuid, activity_id uuid,
      requester_id uuid, driver_id uuid,
      status text check (status in ('pending','accepted','rejected','cancelled','completed')));
    create unique index ride_requests_one_active_request_per_activity on ride_requests(requester_id, activity_id)
      where activity_id is not null and status in ('pending','accepted');
    create table ride_locations(ride_id uuid, driver_id uuid, is_active boolean, updated_at timestamptz);
    create table ride_wanted_requests(id uuid primary key, requester_id uuid, activity_id uuid,
      pickup_location text, destination text, date_time timestamptz, notes text,
      status text check (status in ('open','fulfilled','cancelled')), created_at timestamptz default now(),
      offered_ride_id uuid references rides_offered(id) on delete set null);
    grant select, insert, update on profiles, driver_profiles, activities, rides_offered, ride_requests,
      ride_locations, ride_wanted_requests to authenticated;

    -- accept_ride_request and the ride_requests notification triggers as they exist in Supabase
    -- (2026-11-03), including the duplicate insert trigger and the 'confirmed' check the
    -- migration fixes.
    create table notifications(user_id uuid, actor_id uuid, activity_id uuid, type text, message text);
    grant select, insert on notifications to authenticated;
    create function accept_ride_request(p_request_id uuid) returns jsonb language plpgsql security definer
    set search_path to 'public' as $$
    declare v_request ride_requests%rowtype; v_ride rides_offered%rowtype; v_new_seats integer;
    begin
      select * into v_request from ride_requests where id = p_request_id for update;
      if not found then raise exception 'Ride request not found'; end if;
      if v_request.driver_id <> auth.uid() then raise exception 'You cannot manage this ride request'; end if;
      if v_request.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
      select * into v_ride from rides_offered where id = v_request.ride_id for update;
      if not found then raise exception 'Ride not found'; end if;
      if v_ride.driver_id <> auth.uid() then raise exception 'You do not own this ride'; end if;
      if v_ride.status <> 'open' then raise exception 'This ride is no longer open'; end if;
      if v_ride.available_seats < 1 then raise exception 'No seats remain'; end if;
      update ride_requests set status = 'accepted' where id = p_request_id;
      v_new_seats := v_ride.available_seats - 1;
      update rides_offered set available_seats = v_new_seats,
        status = case when v_new_seats = 0 then 'full' else 'open' end where id = v_ride.id;
      return jsonb_build_object('request_id', p_request_id, 'ride_id', v_ride.id, 'available_seats', v_new_seats, 'status', 'accepted');
    end $$;
    create function notify_on_ride_request() returns trigger language plpgsql security definer
    set search_path to 'public' as $$
    declare v_offerer_id uuid; v_destination text;
    begin
      if new.status <> 'pending' then return new; end if;
      select driver_id, destination into v_offerer_id, v_destination from rides_offered where id = new.ride_id;
      if v_offerer_id is null then return new; end if;
      insert into notifications values (v_offerer_id, new.requester_id, new.activity_id, 'ride_request',
        'Someone requested a seat for your ride to ' || coalesce(v_destination, 'your destination'));
      return new;
    end $$;
    create function notify_on_ride_confirmed() returns trigger language plpgsql security definer as $$
    begin
      if new.status = 'confirmed' and old.status = 'pending' then
        insert into notifications(user_id, message) values (new.requester_id, 'confirmed');
      end if;
      return new;
    end $$;
    create trigger notify_on_ride_request_trigger after insert on ride_requests for each row execute function notify_on_ride_request();
    create trigger on_ride_request_insert after insert on ride_requests for each row execute function notify_on_ride_request();
    create trigger on_ride_request_confirmed after update on ride_requests for each row execute function notify_on_ride_confirmed();

    insert into profiles(id, full_name) values ('${id(DRIVER)}','Dana Driver'),('${id(PASSENGER)}','Pat'),
      ('${id(UNVERIFIED)}','Una'),('${id(OTHER)}','Oli');
    insert into driver_profiles values ('${id(DRIVER)}','verified'),('${id(UNVERIFIED)}','pending');
    insert into activities values ('${id(30)}','Game','Stadium', now() + interval '3 days');
    insert into ride_wanted_requests(id, requester_id, activity_id, pickup_location, destination, date_time, notes, status) values
      ('${id(40)}','${id(PASSENGER)}',null,'Library','Airport', now() + interval '1 day', 'Two bags', 'open'),
      ('${id(41)}','${id(PASSENGER)}',null,'Dorm','Mall', now() - interval '1 hour', null, 'open'),
      ('${id(42)}','${id(PASSENGER)}',null,'Gym','Station', now() + interval '2 days', null, 'cancelled'),
      ('${id(43)}','${id(PASSENGER)}','${id(30)}','Dorm','Stadium', now() + interval '3 days', null, 'open');
  `);
  for (const file of [
    '20260919090000_ride_ratings_and_pickups.sql',
    '20261013120000_verified_driver_gating_and_badge.sql',
    '20261102120000_ride_seats_and_cancelled_activity_rides.sql',
    '20261103120000_offer_ride_for_wanted_request.sql',
  ]) {
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  const as = async n => db.exec(`reset role; set request.jwt.claim.sub = '${id(n)}'; set role authenticated;`);
  const row = async sql => (await db.query(sql)).rows[0];
  const offer = (requestId, seats = 3) =>
    db.query(`select offer_ride_for_wanted_request('${requestId}', ${seats}, ' Blue car ', 32.5, -92.6, 32.4, -92.1) as ride_id`);
  return { db, as, row, offer };
}

test('offering on a request creates the requested ride with the passenger accepted', async () => {
  const { as, row, offer, db } = await setup();
  await as(DRIVER);
  const rideId = (await offer(id(40))).rows[0].ride_id;

  const ride = await row(`select * from rides_offered where id = '${rideId}'`);
  assert.equal(ride.driver_id, id(DRIVER));
  assert.equal(ride.pickup_location, 'Library');
  assert.equal(ride.destination, 'Airport');
  assert.equal(ride.status, 'open');
  assert.equal(ride.available_seats, 2, 'the passenger takes one of the three offered seats');
  assert.equal(ride.notes, 'Blue car');

  const request = await row(`select * from ride_requests where ride_id = '${rideId}'`);
  assert.equal(request.requester_id, id(PASSENGER));
  assert.equal(request.status, 'accepted');
  assert.equal(request.pickup_address, 'Library', 'pickup copied from the ride, like a fixed-pickup seat request');

  const wanted = await row(`select status, offered_ride_id from ride_wanted_requests where id = '${id(40)}'`);
  assert.deepEqual(wanted, { status: 'fulfilled', offered_ride_id: rideId });

  const notifications = (await db.query('select user_id, type, message from notifications')).rows;
  assert.equal(notifications.length, 1, 'the driver is not told about a seat request for their own offer');
  assert.equal(notifications[0].user_id, id(PASSENGER));
  assert.equal(notifications[0].message, 'Dana Driver accepted you on their ride to Airport.');
});

test('normal seat requests notify the driver once and the passenger on acceptance', async () => {
  const { as, row, db } = await setup();
  await as(DRIVER);
  await db.exec(`insert into rides_offered(id, driver_id, status, pickup_location, pickup_latitude, pickup_longitude, destination, available_seats)
    values ('${id(50)}','${id(DRIVER)}','open','Union',32.5,-92.6,'Campus',3)`);
  await as(OTHER);
  await db.exec(`insert into ride_requests(id, ride_id, requester_id, driver_id, status) values ('${id(60)}','${id(50)}','${id(OTHER)}','${id(DRIVER)}','pending')`);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select user_id, message from notifications')).rows,
    [{ user_id: id(DRIVER), message: 'Oli requested a seat for your ride to Campus' }]);

  await as(DRIVER);
  await db.exec(`select accept_ride_request('${id(60)}')`);
  await db.exec('reset role');
  const accepted = await row(`select message from notifications where user_id = '${id(OTHER)}'`);
  assert.equal(accepted.message, 'Dana Driver accepted you on their ride to Campus.');
});

test('an activity request keeps the activity link and the one-ride-per-activity rule', async () => {
  const { as, row, offer, db } = await setup();
  await as(DRIVER);
  const rideId = (await offer(id(43))).rows[0].ride_id;
  assert.equal((await row(`select activity_id from rides_offered where id = '${rideId}'`)).activity_id, id(30));
  assert.equal((await row(`select activity_id from ride_requests where ride_id = '${rideId}'`)).activity_id, id(30));

  // A second open request for the same activity can't give the passenger a second active ride.
  await db.exec(`reset role; insert into ride_wanted_requests(id, requester_id, activity_id, pickup_location, destination, date_time, status)
    values ('${id(44)}','${id(PASSENGER)}','${id(30)}','Library','Stadium', now() + interval '3 days', 'open')`);
  await as(DRIVER);
  await assert.rejects(offer(id(44)), /already has a ride for this activity/);
});

test('one seat offered makes the ride full, and the passenger cancelling reopens it', async () => {
  const { as, row, offer, db } = await setup();
  await as(DRIVER);
  const rideId = (await offer(id(40), 1)).rows[0].ride_id;
  assert.deepEqual(await row(`select status, available_seats from rides_offered where id = '${rideId}'`),
    { status: 'full', available_seats: 0 });

  await as(PASSENGER);
  await db.exec(`update ride_requests set status = 'cancelled' where ride_id = '${rideId}'`);
  assert.deepEqual(await row(`select status, available_seats from rides_offered where id = '${rideId}'`),
    { status: 'open', available_seats: 1 });
});

test('a request can only be fulfilled once', async () => {
  const { as, offer } = await setup();
  await as(DRIVER);
  await offer(id(40));
  await assert.rejects(offer(id(40)), /no longer open/);
});

test('rejects invalid offers and leaves nothing behind', async () => {
  const { as, row, offer, db } = await setup();
  await as(PASSENGER);
  await assert.rejects(offer(id(40)), /own request/);
  await as(UNVERIFIED);
  await assert.rejects(offer(id(40)), /verified license/);
  await as(DRIVER);
  await assert.rejects(offer(id(41)), /already passed/);
  await assert.rejects(offer(id(42)), /no longer open/);
  await assert.rejects(offer(id(40), 0), /at least one seat/);
  await assert.rejects(db.query(`select offer_ride_for_wanted_request('${id(40)}', 2, null, null, null, 32.4, -92.1)`), /Could not locate/);

  assert.equal((await row('select count(*)::int as n from rides_offered')).n, 0);
  assert.equal((await row('select count(*)::int as n from ride_requests')).n, 0);
  assert.equal((await row(`select status from ride_wanted_requests where id = '${id(40)}'`)).status, 'open');
});

test('clients still cannot add someone else to a ride directly', async () => {
  const { as, db } = await setup();
  await as(DRIVER);
  await db.exec(`insert into rides_offered(id, driver_id, status, pickup_location, pickup_latitude, pickup_longitude, destination, available_seats)
    values ('${id(50)}','${id(DRIVER)}','open','Union',32.5,-92.6,'Campus',3)`);
  await assert.rejects(
    db.exec(`insert into ride_requests(ride_id, requester_id, driver_id, status) values ('${id(50)}','${id(OTHER)}','${id(DRIVER)}','pending')`),
    /Invalid ride participants/,
  );
  // The flag only matches the exact requester and is cleared after use; a stale or forged value fails too.
  await assert.rejects(
    db.exec(`select set_config('rollin.wanted_request_offer', '${id(PASSENGER)}', false);
      insert into ride_requests(ride_id, requester_id, driver_id, status) values ('${id(50)}','${id(OTHER)}','${id(DRIVER)}','pending')`),
    /Invalid ride participants/,
  );
});
