/**
 * Regression tests for the player booking scope and per-role notification links.
 *
 * Two bugs motivated this file, and both were invisible at the HTTP layer:
 *
 *  1. Walk-in bookings store `user_id = NULL` and identify the guest by
 *     `customer_phone`. The walk-in handler notifies the user whose phone
 *     matches, deep-linking to /bookings/:id — but the list only matched
 *     `b.user_id` and the detail only matched `user_id OR booked_by_user_id`.
 *     The notification therefore pointed at a booking the player could not
 *     open, and it was missing from their list entirely.
 *
 *  2. notifyMany() sent one shared `link` to a mixed audience. Admins and
 *     subadmins received approval/cancellation alerts linking to
 *     /owner/bookings/:id, which their role guard rejects.
 *
 * These assert on the SQL and the bound INSERT parameters the controllers
 * produce, so they need no database.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../db');

/** Every SQL string the code under test ran, in order. */
let executed = [];
/** Registered query stubs, matched against the SQL in registration order. */
let stubs = [];
/** Value returned as COUNT(*) for the list's count query. */
let countTotal = '1';
/** INSERT parameter arrays captured for assertion. */
let inserts = [];

function stub(matcher, rows) {
  stubs.push({ matcher, rows });
}

function reset() {
  executed = [];
  stubs = [];
  inserts = [];
  countTotal = '1';
}

/** Normalised single-line form, so assertions survive reformatting. */
function flat(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function lastMatch(pattern) {
  return executed.filter((sql) => pattern.test(sql)).pop();
}

function row(overrides = {}) {
  return {
    id: 'b1',
    ground_id: 'g1',
    user_id: 'u1',
    slot_id: 's1',
    booking_date: '2026-10-01',
    start_time: '18:00:00',
    end_time: '19:00:00',
    total_price: '1200',
    players_count: 5,
    special_requests: '',
    status: 'confirmed',
    source: 'online',
    payment_status: 'unpaid',
    payment_method: 'online',
    booking_ref: 'MN-ABC123',
    payment_deadline: null,
    cancelled_at: null,
    cancellation_reason: null,
    is_late_cancellation: false,
    late_cancellation_fee: null,
    requires_approval: false,
    completed_at: null,
    customer_name: 'Walk In',
    customer_phone: '9800000000',
    deposit_amount: '480',
    deposit_paid: false,
    deposit_refunded: false,
    batch_group_id: null,
    created_at: '2026-09-20T10:00:00.000Z',
    ground_name: 'Test Ground',
    ground_contact: '9800000001',
    ground_address: 'Main Road',
    ground_city: 'Kathmandu',
    ground_latitude: 27.7,
    ground_longitude: 85.3,
    ground_sport_type: 'futsal',
    operating_start: '06:00',
    operating_end: '22:00',
    ground_description: null,
    ground_image_url: null,
    ground_owner_name: null,
    ground_owner_phone: null,
    ground_owner_email: null,
    ground_owner_business: null,
    user_name: 'Player One',
    user_email: 'player@example.com',
    user_phone: '9800000000',
    ...overrides,
  };
}

async function queryStub(sql, params = []) {
  const s = flat(sql);
  executed.push(s);

  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)) return { rows: [] };
  if (s.includes('information_schema')) return { rows: [{ ok: true }] };
  if (/SELECT release_expired_holds/.test(s)) return { rows: [] };
  if (/^INSERT INTO notifications/.test(s)) {
    inserts.push(params);
    return { rowCount: 1, rows: [] };
  }
  if (/^SELECT COUNT\(\*\)/.test(s)) return { rows: [{ count: countTotal }] };
  if (/FROM payments/.test(s)) return { rows: [] };

  const hit = stubs.find((candidate) => candidate.matcher.test(s));
  if (hit) return { rows: hit.rows };

  throw new Error('Unhandled query in stub: ' + s);
}

pool.query = queryStub;
pool.connect = async () => ({ query: queryStub, release: () => {} });

const bookingController = require('../controllers/bookingController');
const { notifyGroundActors, bookingLink } = require('../services/notificationService');

/**
 * Minimal req/res pair. The controllers only touch req.user/params/query and
 * res.status().json(), so there is no reason to stand up express here.
 */
async function call(handler, { user = { id: 'u1', name: 'Player One' }, params = {}, query = {} } = {}) {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  await handler({ user, params, query }, res);
  return { status: res.statusCode, body: res.body };
}

const LIST_SQL = /SELECT b\.id, b\.ground_id, b\.user_id, b\.slot_id/;
const DETAIL_SQL = /LEFT JOIN users ow ON ow\.id = g\.owner_id/;
const ACTORS_SQL = /SELECT DISTINCT u\.id, u\.role FROM users u/;

// ---------------------------------------------------------------------------
// 1. Player booking ownership
// ---------------------------------------------------------------------------

test('getMyBookings matches a booking three ways: self, staff-recorded, and walk-in phone', async () => {
  reset();
  stub(LIST_SQL, [row()]);

  const res = await call(bookingController.getMyBookings);
  assert.equal(res.status, 200);

  const sql = lastMatch(LIST_SQL);

  // All three ownership paths, each bound to the same single user id.
  assert.match(sql, /b\.user_id = \$1/);
  assert.match(sql, /b\.booked_by_user_id = \$1/);
  assert.match(
    sql,
    /b\.customer_phone = \(SELECT phone FROM users WHERE id = \$1\)/,
    'walk-in bookings store user_id NULL, so the phone path is what makes them reachable'
  );
});

test('getMyBookings exposes search, pagination and a total', async () => {
  reset();
  stub(LIST_SQL, [row()]);
  countTotal = '37';

  const res = await call(bookingController.getMyBookings, {
    query: { search: 'test', page: '2', limit: '10' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.page, 2);
  assert.equal(res.body.limit, 10);
  assert.equal(res.body.total, 37, 'the count query must be built from the same WHERE as the page');
  assert.equal(res.body.bookings.length, 1);

  const sql = lastMatch(LIST_SQL);
  assert.match(sql, /g\.name ILIKE/, 'search should match the ground name');
  assert.match(sql, /b\.booking_ref ILIKE/, 'search should match the booking reference');
  assert.match(sql, /LIMIT \$\d+ OFFSET \$\d+/, 'the list must be paginated');
});

test('getMyBookings sorts upcoming first, and past bookings newest first', async () => {
  reset();
  stub(LIST_SQL, [row()]);

  await call(bookingController.getMyBookings);

  const sql = lastMatch(LIST_SQL);

  // Grouping: not-past before past.
  assert.match(sql, /\(b\.booking_date < CURRENT_DATE\) ASC/);
  // Future group ascending (soonest first).
  assert.match(sql, /CASE WHEN b\.booking_date >= CURRENT_DATE THEN b\.booking_date END ASC/);
  // Past group descending (most recent first). The bug was ASC here, which
  // pushed the player's most recent game to the bottom of the list.
  assert.match(sql, /CASE WHEN b\.booking_date < CURRENT_DATE THEN b\.booking_date END DESC/);
  // Within one past date, the later slot leads.
  assert.match(sql, /CASE WHEN b\.booking_date < CURRENT_DATE THEN b\.start_time END DESC/);
  assert.doesNotMatch(
    sql,
    /ORDER BY \(b\.booking_date < CURRENT_DATE\) ASC, b\.booking_date ASC/,
    'the old single-direction sort must be gone'
  );
});

test('getMyBookings clamps a hostile limit instead of trusting it', async () => {
  reset();
  stub(LIST_SQL, [row()]);

  const res = await call(bookingController.getMyBookings, { query: { limit: '99999' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.limit, 100, 'limit is capped');
});

test('getMyBookingById uses the same ownership predicate as the list', async () => {
  reset();
  stub(DETAIL_SQL, [row()]);

  const res = await call(bookingController.getMyBookingById, { params: { id: 'b1' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.booking.id, 'b1');

  // The detail page's map, countdown and calendar all read these.
  assert.equal(res.body.booking.groundAddress, 'Main Road');
  assert.equal(res.body.booking.groundLatitude, 27.7);
  assert.equal(res.body.booking.groundLongitude, 85.3);
  assert.equal(res.body.booking.operatingStart, '06:00');
  assert.ok(Array.isArray(res.body.payments));

  const sql = lastMatch(DETAIL_SQL);
  assert.match(sql, /b\.user_id = \$2/);
  assert.match(sql, /b\.booked_by_user_id = \$2/);
  assert.match(
    sql,
    /b\.customer_phone = \(SELECT phone FROM users WHERE id = \$2\)/,
    'detail must accept the same walk-in phone path the list does'
  );
});

test('getMyBookingById 404s rather than 403s so ids cannot be probed', async () => {
  reset();
  // The row is not owned by this player: the stub resolves to no rows.
  stub(DETAIL_SQL, []);

  const res = await call(bookingController.getMyBookingById, { params: { id: 'someone-elses' } });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Booking not found.');
});

// ---------------------------------------------------------------------------
// 2. Per-role notification links
// ---------------------------------------------------------------------------

test('notifyGroundActors fans out one insert per actor', async () => {
  reset();
  stub(ACTORS_SQL, [
    { id: 'owner-1', role: 'owner' },
    { id: 'admin-1', role: 'admin' },
    { id: 'sub-1', role: 'subadmin' },
  ]);

  const written = await notifyGroundActors('g1', {
    type: 'booking_request',
    title: 'New pay-at-counter request',
    body: 'Someone wants Test Ground.',
    linkFor: (role) => bookingLink(role, 'b1'),
    bookingId: 'b1',
  });

  assert.deepEqual(written, ['owner-1', 'admin-1', 'sub-1']);
  assert.equal(inserts.length, 3, 'one insert per recipient');
});

test('notifyGroundActors resolves the link per role, not once for everyone', async () => {
  reset();
  stub(ACTORS_SQL, [
    { id: 'owner-1', role: 'owner' },
    { id: 'admin-1', role: 'admin' },
  ]);

  await notifyGroundActors('g1', {
    type: 'booking_request',
    title: 'New pay-at-counter request',
    linkFor: (role) => bookingLink(role, 'b1'),
    bookingId: 'b1',
  });

  assert.equal(inserts.length, 2);

  // Bound params are [user_id, type, title, body, link, booking_id, dedupe_key].
  const linkFor = (userId) => inserts.find((p) => p[0] === userId)[4];
  const ownerLink = linkFor('owner-1');
  const adminLink = linkFor('admin-1');

  assert.equal(ownerLink, '/owner/bookings/b1');
  assert.equal(adminLink, '/admin/bookings/b1');
  assert.notEqual(
    ownerLink,
    adminLink,
    'a shared link is the bug: an admin following /owner/bookings/:id hits their role guard'
  );

  // The player route used by player-facing notifications.
  assert.equal(bookingLink('player', 'b1'), '/bookings/b1');

  // Every recipient still points at the same booking.
  for (const p of inserts) assert.equal(p[5], 'b1');
});

test('notifyGroundActors falls back to a flat link when no linkFor is given', async () => {
  reset();
  stub(ACTORS_SQL, [{ id: 'admin-1', role: 'admin' }]);

  await notifyGroundActors('g1', {
    type: 'kyc_status',
    title: 'KYC reviewed',
    link: '/admin/sellers',
  });

  assert.equal(inserts[0][4], '/admin/sellers');
});

test('notifyGroundActors survives a ground with no resolvable actors', async () => {
  reset();
  stub(ACTORS_SQL, []);

  const written = await notifyGroundActors('g1', { type: 'booking_request', title: 'x' });

  assert.deepEqual(written, []);
  assert.equal(inserts.length, 0, 'nobody to notify means no inserts, and definitely no throw');
});
