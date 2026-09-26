const { pool } = require('../db');
const { notificationsEnabled } = require('../utils/schemaFlags');

// Notification types. Kept as a frozen map rather than a free string so a typo
// in a call site shows up as `undefined` in the payload rather than silently
// creating a row the frontend cannot style.
const NOTIFICATION_TYPES = {
  BOOKING_HELD: 'booking_held',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_REQUEST: 'booking_request',
  APPROVAL_APPROVED: 'approval_approved',
  APPROVAL_REJECTED: 'approval_rejected',
  PAYMENT_PAID: 'payment_paid',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_RECORDED: 'payment_recorded',
  REFUND_RECORDED: 'refund_recorded',
  REMINDER: 'reminder',
  KYC_STATUS: 'kyc_status',
};

/**
 * Fire-and-forget notification insert.
 *
 * Never throws and never rejects: notifications are secondary to the business
 * action that triggered them, so a missing table or a dead connection must not
 * turn a successful booking into a 500. Failures are logged instead.
 *
 * @param {object} opts
 * @param {string} opts.userId  recipient; ignored when null/undefined
 * @param {string} opts.type    one of NOTIFICATION_TYPES
 * @param {string} opts.title   short headline, shown bold in the bell
 * @param {string} [opts.body]  one line of supporting detail
 * @param {string} [opts.link]  client route to open when the row is clicked
 * @param {string} [opts.bookingId]
 * @param {string} [opts.dedupeKey] makes the insert idempotent; see 008 migration
 * @param {import('pg').PoolClient} [opts.client] reuse a caller's transaction
 * @returns {Promise<boolean>} whether a row was written
 */
async function notify(opts) {
  const {
    userId, type, title, body = null, link = null,
    bookingId = null, dedupeKey = null, client = null,
  } = opts;

  if (!userId) return false;
  if (!(await notificationsEnabled())) return false;

  const runner = client ? client.query.bind(client) : pool.query.bind(pool);

  try {
    await runner(
      `INSERT INTO notifications (user_id, type, title, body, link, booking_id, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [userId, type, title, body, link, bookingId, dedupeKey]
    );
    return true;
  } catch (error) {
    // 23505 = dedupe collision, which is the expected "already notified" path.
    if (error.code !== '23505') {
      console.error('Notification insert failed:', error.message);
    }
    return false;
  }
}

/**
 * Look up every user who can act on a ground: the owner plus active admins.
 * Used to route approval requests and walk-in alerts to the right desk.
 *
 * @param {string} groundId
 * @returns {Promise<Array<{id: string, role: string}>>}
 */
async function groundActors(groundId) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.role
       FROM users u
       WHERE u.id IN (SELECT owner_id FROM grounds WHERE id = $1)
          OR u.role IN ('admin', 'subadmin')`,
      [groundId]
    );
    return result.rows.map((r) => ({ id: r.id, role: r.role }));
  } catch (error) {
    console.error('Approver lookup failed:', error.message);
    return [];
  }
}

/**
 * Fan one event out to everyone who can act on a ground, giving each recipient
 * a link to the screen THEY can actually open.
 *
 * This exists because a single shared `link` is wrong the moment the audience
 * is mixed: an admin and a subadmin reading a notification that deep-links to
 * /owner/bookings/:id land on a route their role guard rejects. Pass `linkFor`
 * and it is resolved per role; fall back to a flat `link` if you do not.
 *
 * @param {string} groundId
 * @param {object} message see notify(), plus:
 * @param {(role: string) => string} [message.linkFor]
 * @returns {Promise<string[]>} recipients actually written
 */
async function notifyGroundActors(groundId, message) {
  const actors = await groundActors(groundId);
  if (actors.length === 0) return [];

  const written = [];
  for (const actor of actors) {
    const link = message.linkFor ? message.linkFor(actor.role) : message.link;
    if (await notify({ ...message, userId: actor.id, link })) written.push(actor.id);
  }
  return written;
}

/**
 * Create the booking's client route so every role's bell links somewhere real.
 * Players have their own detail page; owners and admins reuse theirs.
 *
 * @param {string} role
 * @param {string} bookingId
 * @returns {string}
 */
function bookingLink(role, bookingId) {
  if (role === 'player') return `/bookings/${bookingId}`;
  if (role === 'owner') return `/owner/bookings/${bookingId}`;
  return `/admin/bookings/${bookingId}`;
}

module.exports = {
  NOTIFICATION_TYPES,
  notify,
  groundActors,
  notifyGroundActors,
  bookingLink,
};
