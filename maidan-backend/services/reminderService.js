const { pool } = require('../db');
const { notificationsEnabled } = require('../utils/schemaFlags');
const { NOTIFICATION_TYPES, notify } = require('./notificationService');

// Kick-off reminders, in hours before the slot starts. The spec calls for 24h
// and 2h; 24h is skipped for bookings made inside that window, which is why the
// job checks the remaining distance per row rather than assuming a schedule.
const REMINDER_OFFSETS_HOURS = [24, 2];

const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const REMINDER_TOLERANCE_MINUTES = 20;

/**
 * Insert one reminder per confirmed booking whose kick-off falls inside the
 * current sweep window for one of REMINDER_OFFSETS_HOURS.
 *
 * Idempotent: each row carries a `dedupe_key` of
 * `<bookingId>:<hours>h` behind a partial unique index, so re-running the sweep
 * (or two workers racing) cannot double-notify.
 *
 * @returns {Promise<number>} reminders created
 */
async function sweepBookingReminders() {
  if (!(await notificationsEnabled())) return 0;

  const result = await pool.query(
    `SELECT b.id, b.user_id, b.booking_date, b.start_time, b.booking_ref,
            u.name AS player_name,
            g.name AS ground_name, g.address, g.city, g.owner_id,
            EXTRACT(EPOCH FROM (b.booking_date + b.start_time - NOW())) / 3600 AS hours_until
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed'
       AND b.booking_date + b.start_time > NOW()
       AND b.booking_date + b.start_time <= NOW() + (INTERVAL '25 hours')
     ORDER BY b.booking_date, b.start_time`
  );

  let created = 0;

  for (const b of result.rows) {
    for (const hours of REMINDER_OFFSETS_HOURS) {
      const hoursUntil = Number(b.hours_until);
      if (!Number.isFinite(hoursUntil)) continue;

      // Only fire inside the window [offset - tolerance, offset + tolerance].
      // Slots already inside 24h skip the 24h nudge entirely.
      if (hoursUntil > hours + REMINDER_TOLERANCE_MINUTES / 60) continue;
      if (hoursUntil < hours - REMINDER_TOLERANCE_MINUTES / 60) continue;

      const isSoon = hours <= 2;
      const when = isSoon ? 'starts soon' : 'tomorrow';
      const body = isSoon
        ? `${b.ground_name} · ${b.booking_date} at ${String(b.start_time).slice(0, 5)}. Pay the balance at the venue.`
        : `${b.ground_name} · ${b.booking_date} at ${String(b.start_time).slice(0, 5)}.`;

      const wrote = await notify({
        userId: b.user_id,
        type: NOTIFICATION_TYPES.REMINDER,
        title: isSoon ? `Your match ${when}` : `Your match is ${when}`,
        body,
        link: `/bookings/${b.id}`,
        bookingId: b.id,
        dedupeKey: `${b.id}:${hours}h`,
      });

      if (wrote) created += 1;
    }
  }

  return created;
}

/**
 * Start the reminder sweep. Called once from server.js on boot.
 * @returns {{ stop: () => void }}
 */
function startReminderJob() {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const created = await sweepBookingReminders();
      if (created > 0) console.log(`[reminders] created ${created} reminder notification(s)`);
    } catch (error) {
      console.error('[reminders] sweep failed:', error.message);
    }
  };

  // First run shortly after boot so a restart does not lose the window, then
  // on a fixed interval.
  const initialDelay = setTimeout(tick, 10 * 1000);
  const interval = setInterval(tick, SWEEP_INTERVAL_MS);

  return {
    stop() {
      stopped = true;
      clearTimeout(initialDelay);
      clearInterval(interval);
    },
  };
}

module.exports = { sweepBookingReminders, startReminderJob, REMINDER_OFFSETS_HOURS };
