const crypto = require('crypto');
const { pool } = require('../db');
const { computeDeposit, computeCancellationFee } = require('../services/depositRules');
const {
  NOTIFICATION_TYPES,
  notify,
  notifyGroundActors,
  bookingLink,
} = require('../services/notificationService');

const MAX_ACTIVE_BOOKINGS = 3;
const FREE_CANCELLATION_HOURS = 24;
const HOLD_DURATION_MINUTES = 10;

// Shorthand for "HH:MM" from a TIME column that may arrive as '18:00:00'.
const hhmm = (t) => String(t || '').slice(0, 5);

// node-postgres returns DATE columns as JS Date objects set to local midnight,
// and booking_date/created_at timestamps are stored at the local date's
// midnight instant. Normalize to a plain yyyy-MM-dd key for the API WITHOUT
// going through toISOString(): that converts to UTC and shifts the local date
// one day back for any timezone east of UTC (e.g. Nepal, +05:45), which would
// make tomorrow's slots look like they already started.
function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

// Reject slots that already started — a booking can never be made for a
// time in the past (e.g. booking the 6 AM slot at 2 PM the same day).
function slotStartIsPast(slot) {
  const dateKey = toDateKey(slot.slot_date);
  if (!dateKey) return false;
  const start = String(slot.start_time).slice(0, 8); // 'HH:MM:SS' or 'HH:MM'
  const slotStart = new Date(`${dateKey}T${start}`);
  if (Number.isNaN(slotStart.getTime())) return false;
  // Allow a small grace window so "now" bookings still go through.
  return slotStart.getTime() < Date.now() - 60 * 1000;
}

exports.createBooking = async (req, res) => {
  const { groundId, slotId, bookingDate, startTime, playersCount: pcFromReq, numberOfPlayers, specialRequests } = req.body;
  const paymentMethod = req.body.paymentMethod || 'online';
  const playersCount = pcFromReq || numberOfPlayers;
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Release any expired holds first
    await client.query('SELECT release_expired_holds()');

    if (!req.user.is_phone_verified) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Please verify your phone number to book.' });
    }

    let slot;
    if (slotId) {
      const slotRes = await client.query(
        `SELECT id, ground_id, slot_date, start_time, end_time, price, status, is_blocked
         FROM slots WHERE id = $1 FOR UPDATE`,
        [slotId]
      );
      if (!slotRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Slot not found.' });
      }
      slot = slotRes.rows[0];
      if (slot.status !== 'available' || slot.is_blocked) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Slot already booked or unavailable. Please select another time.' });
      }
    } else {
      const groundResult = await client.query(
        'SELECT id, name, base_price, operating_start, operating_end FROM grounds WHERE id = $1',
        [groundId]
      );
      if (!groundResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Ground not found.' });
      }

      const [hours, minutes] = startTime.split(':').map(Number);
      const endTime = `${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      slot = {
        ground_id: groundId,
        slot_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        price: groundResult.rows[0].base_price,
      };
    }

    if (slotStartIsPast(slot)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'That time has already passed. Please pick an upcoming time slot.' });
    }

    const activeCount = await client.query(
      `SELECT COUNT(*) FROM bookings
       WHERE user_id = $1 AND status IN ('confirmed', 'pending') AND booking_date >= CURRENT_DATE`,
      [userId]
    );
    if (parseInt(activeCount.rows[0].count) >= MAX_ACTIVE_BOOKINGS) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `You have reached the maximum of ${MAX_ACTIVE_BOOKINGS} active bookings. Please cancel one to book more.`,
      });
    }

    const groundResult = await client.query(
      'SELECT id, name, owner_id, address, city FROM grounds WHERE id = $1',
      [slot.ground_id]
    );
    const ground = groundResult.rows[0] || {};
    const groundName = ground.name || 'Unknown Ground';

    const bookingRef = 'MN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // "Pay at counter" — create a pending booking and ask the ground owner
    // to accept or reject it. On approval the slot becomes booked and the
    // customer pays at the venue. The approval auto-expires after 24h (or at
    // slot start, whichever comes first) via release_expired_holds().
    if (paymentMethod === 'counter' || paymentMethod === 'cash') {
      const slotStartMs = new Date(`${toDateKey(slot.slot_date)}T${String(slot.start_time).slice(0, 8)}`).getTime();
      const approvalWindowMs = 24 * 60 * 60 * 1000;
      const approvalExpiresAt = new Date(
        Math.min(Date.now() + approvalWindowMs, Number.isNaN(slotStartMs) ? Date.now() + approvalWindowMs : slotStartMs)
      );

      const insertResult = await client.query(
        `INSERT INTO bookings
         (ground_id, user_id, slot_id, booking_date, start_time, end_time, total_price,
          players_count, special_requests, status, payment_status, payment_method, booking_ref,
          payment_deadline, requires_approval)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'unpaid', 'counter', $10, $11, TRUE)
         RETURNING id, ground_id, user_id, booking_date, start_time, end_time, total_price,
                   status, payment_status, payment_method, booking_ref, payment_deadline,
                   requires_approval, created_at`,
        [
          slot.ground_id, userId, slot.id || null, slot.slot_date, slot.start_time, slot.end_time,
          slot.price, playersCount || 1, specialRequests || '', bookingRef, approvalExpiresAt,
        ]
      );

      if (slot.id) {
        await client.query(
          `UPDATE slots SET status = 'held', held_by_user_id = $1, hold_expires_at = $2
           WHERE id = $3 AND status = 'available'`,
          [userId, approvalExpiresAt, slot.id]
        );
      }

      await client.query('COMMIT');

      const booking = insertResult.rows[0];
      const when = `${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)}`;

      // The owner (and any staff watching the desk) has to act on this one, so
      // it is the event worth pushing. Emitted after COMMIT so a notification
      // failure can never undo the hold. linkFor keeps the bell's deep link
      // inside the recipient's own role: admins land on /admin/bookings/:id,
      // the owner on /owner/bookings/:id.
      await notifyGroundActors(slot.ground_id, {
        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
        title: 'New pay-at-counter request',
        body: `${req.user.name || 'A player'} wants ${groundName} on ${when}.`,
        linkFor: (role) => bookingLink(role, booking.id),
        bookingId: booking.id,
      });

      return res.status(201).json({
        message: 'Booking request sent! The ground owner will confirm shortly. Please pay at the counter.',
        paymentRequired: false,
        requiresApproval: true,
        booking: {
          id: booking.id,
          groundId: booking.ground_id,
          userId: booking.user_id,
          groundName,
          date: toDateKey(booking.booking_date),
          startTime: booking.start_time,
          endTime: booking.end_time,
          totalPrice: parseFloat(booking.total_price),
          status: booking.status,
          paymentStatus: booking.payment_status,
          paymentMethod: booking.payment_method,
          bookingRef: booking.booking_ref,
          paymentDeadline: booking.payment_deadline,
          requiresApproval: booking.requires_approval,
          createdAt: booking.created_at,
        },
      });
    }

const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
    const paymentDeadline = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);

    // Single-slot customer bookings pay a deposit online; the balance is due at the venue.
    const { deposit, balance } = computeDeposit(slot.price);

    // Hold the slot
    if (slot.id) {
      await client.query(
        `UPDATE slots SET status = 'held', held_by_user_id = $1, hold_expires_at = $2
         WHERE id = $3 AND status = 'available'`,
        [userId, holdExpiresAt, slot.id]
      );
    }

    // Create booking as pending
    const insertResult = await client.query(
      `INSERT INTO bookings
       (ground_id, user_id, slot_id, booking_date, start_time, end_time, total_price,
        players_count, special_requests, status, payment_status, booking_ref, payment_deadline,
        deposit_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'unpaid', $10, $11, $12)
       RETURNING id, ground_id, user_id, booking_date, start_time, end_time, total_price,
                 status, payment_status, booking_ref, payment_deadline, deposit_amount, created_at`,
      [
        slot.ground_id, userId, slot.id || null, slot.slot_date, slot.start_time, slot.end_time,
        slot.price, playersCount || 1, specialRequests || '', bookingRef, paymentDeadline, deposit,
      ]
    );

    await client.query('COMMIT');

    const booking = insertResult.rows[0];
    const when = `${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)}`;

    await notify({
      userId,
      type: NOTIFICATION_TYPES.BOOKING_HELD,
      title: 'Slot held — pay the deposit',
      body: `${groundName} on ${when}. Complete the Rs ${deposit} deposit within ${HOLD_DURATION_MINUTES} minutes or the slot is released.`,
      link: `/bookings/${booking.id}`,
      bookingId: booking.id,
    });

    res.status(201).json({
      message: 'Slot held! Complete the ' + deposit + ' deposit within ' + HOLD_DURATION_MINUTES + ' minutes.',
      paymentRequired: true,
      holdExpiresAt: holdExpiresAt.toISOString(),
      booking: {
        id: booking.id,
        groundId: booking.ground_id,
        userId: booking.user_id,
        groundName,
        date: toDateKey(booking.booking_date),
        startTime: booking.start_time,
        endTime: booking.end_time,
        totalPrice: parseFloat(booking.total_price),
        status: booking.status,
        paymentStatus: booking.payment_status,
        paymentMethod: booking.payment_method,
        bookingRef: booking.booking_ref,
        paymentDeadline: booking.payment_deadline,
        createdAt: booking.created_at,
        depositAmount: parseFloat(booking.deposit_amount),
        balanceAmount: parseFloat(balance),
        depositOnly: true,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Slot already booked! Please select another time.',
      });
    }
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Booking failed. Please try again.' });
  } finally {
    client.release();
  }
};

// Multi-slot customer booking: several slots paid 100% online as ONE gateway payment.
// All bookings share a batch_group_id and are confirmed atomically on payment success.
exports.createBatchBooking = async (req, res) => {
  const { slotIds, playersCount: pcFromReq, numberOfPlayers, specialRequests } = req.body;
  const playersCount = pcFromReq || numberOfPlayers;
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('SELECT release_expired_holds()');

    if (!req.user.is_phone_verified) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Please verify your phone number to book.' });
    }

    const slots = [];
    for (const slotId of slotIds) {
      const slotRes = await client.query(
        `SELECT s.id, s.ground_id, s.slot_date, s.start_time, s.end_time, s.price, s.status, s.is_blocked
         FROM slots s WHERE s.id = $1 FOR UPDATE`,
        [slotId]
      );
      if (!slotRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Slot ${slotId} not found.` });
      }
      const slot = slotRes.rows[0];
      if (slot.status !== 'available' || slot.is_blocked) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: `Slot ${slot.start_time} on ${toDateKey(slot.slot_date)} is no longer available. Please refresh and try again.`,
        });
      }
      if (slotStartIsPast(slot)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Slot ${slot.start_time} on ${toDateKey(slot.slot_date)} has already passed. Please pick an upcoming time slot.`,
        });
      }
      slots.push(slot);
    }

    const activeCount = await client.query(
      `SELECT COUNT(*) FROM bookings
       WHERE user_id = $1 AND status IN ('confirmed', 'pending') AND booking_date >= CURRENT_DATE`,
      [userId]
    );
    if (parseInt(activeCount.rows[0].count) + slots.length > MAX_ACTIVE_BOOKINGS) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `You can have at most ${MAX_ACTIVE_BOOKINGS} active bookings. Please cancel one to book more.`,
      });
    }

    const groundRes = await client.query('SELECT name FROM grounds WHERE id = $1', [slots[0].ground_id]);
    const groundName = groundRes.rows[0]?.name || 'Unknown Ground';

    const batchGroupId = crypto.randomUUID();
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
    const totalPrice = slots.reduce((sum, s) => sum + Number(s.price), 0);

    const created = [];
    for (const slot of slots) {
      const bookingRef = 'MN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
      const insertResult = await client.query(
        `INSERT INTO bookings
         (ground_id, user_id, slot_id, booking_date, start_time, end_time, total_price,
          players_count, special_requests, status, payment_status, payment_method, booking_ref,
          payment_deadline, batch_group_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'unpaid', 'online', $10, $11, $12)
         RETURNING id, ground_id, user_id, booking_date, start_time, end_time, total_price,
                   status, payment_status, payment_method, booking_ref, payment_deadline, created_at`,
        [
          slot.ground_id, userId, slot.id, slot.slot_date, slot.start_time, slot.end_time,
          slot.price, playersCount || 1, specialRequests || '', bookingRef, holdExpiresAt, batchGroupId,
        ]
      );
      await client.query(
        `UPDATE slots SET status = 'held', held_by_user_id = $1, hold_expires_at = $2
         WHERE id = $3 AND status = 'available'`,
        [userId, holdExpiresAt, slot.id]
      );
      created.push(insertResult.rows[0]);
    }

    await client.query('COMMIT');

    // One notification for the whole batch, linked to the first booking.
    await notify({
      userId,
      type: NOTIFICATION_TYPES.BOOKING_HELD,
      title: `${created.length} slots held — pay now`,
      body: `${groundName} · Rs ${totalPrice}. Complete the combined payment within ${HOLD_DURATION_MINUTES} minutes or the slots are released.`,
      link: `/bookings/${created[0].id}`,
      bookingId: created[0].id,
    });

    res.status(201).json({
      message: `${created.length} slots held! Complete the combined payment within ${HOLD_DURATION_MINUTES} minutes.`,
      paymentRequired: true,
      holdExpiresAt: holdExpiresAt.toISOString(),
      batchGroupId,
      totalPrice,
      bookings: created.map((b) => ({
        id: b.id,
        groundId: b.ground_id,
        userId: b.user_id,
        groundName,
        date: toDateKey(b.booking_date),
        startTime: b.start_time,
        endTime: b.end_time,
        totalPrice: parseFloat(b.total_price),
        status: b.status,
        paymentStatus: b.payment_status,
        paymentMethod: b.payment_method,
        bookingRef: b.booking_ref,
        paymentDeadline: b.payment_deadline,
        createdAt: b.created_at,
        depositAmount: 0,
        balanceAmount: 0,
        depositOnly: false,
      })),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Slot already booked! Please select another time.' });
    }
    console.error('Batch booking error:', error);
    res.status(500).json({ message: 'Booking failed. Please try again.' });
  } finally {
    client.release();
  }
};

// Owner/admin books a slot on behalf of a customer (phone call / walk-in).
// No user account, phone verification, or booking cap required for the guest.
exports.createWalkInBooking = async (req, res) => {
  const { groundId, slotId, bookingDate, startTime, playersCount: pcFromReq, numberOfPlayers,
          specialRequests, customerName, customerPhone } = req.body;
  const playersCount = pcFromReq || numberOfPlayers;
  const paymentMethod = req.body.paymentMethod || 'unpaid';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Release any expired holds first
    await client.query('SELECT release_expired_holds()');

    let slot;
    if (slotId) {
      const slotRes = await client.query(
        `SELECT s.id, s.ground_id, s.slot_date, s.start_time, s.end_time, s.price, s.status, s.is_blocked
         FROM slots s WHERE s.id = $1 FOR UPDATE`,
        [slotId]
      );
      if (!slotRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Slot not found.' });
      }
      slot = slotRes.rows[0];
      if (slot.status !== 'available' || slot.is_blocked) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Slot already booked or unavailable. Please select another time.' });
      }
    } else {
      const groundResult = await client.query(
        'SELECT id, name, base_price FROM grounds WHERE id = $1',
        [groundId]
      );
      if (!groundResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Ground not found.' });
      }

      const [hours, minutes] = startTime.split(':').map(Number);
      const endTime = `${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      slot = {
        id: null,
        ground_id: groundId,
        slot_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        price: groundResult.rows[0].base_price,
      };
    }

    if (slotStartIsPast(slot)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'That time has already passed. Please pick an upcoming time slot.' });
    }

    // Owners may only book on their own grounds; admins can book anywhere
    const groundOwnerRes = await client.query(
      'SELECT name, owner_id FROM grounds WHERE id = $1',
      [slot.ground_id]
    );
    if (!groundOwnerRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ground not found.' });
    }
    const ground = groundOwnerRes.rows[0];
    if (!['admin', 'subadmin'].includes(req.user.role) && ground.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only create bookings for your own grounds.' });
    }
    const groundName = ground.name;

    // Prevent double-booking when no pre-generated slot exists
    if (!slot.id) {
      const conflictRes = await client.query(
        `SELECT id FROM bookings
         WHERE ground_id = $1 AND booking_date = $2 AND start_time = $3 AND status IN ('pending', 'confirmed')`,
        [slot.ground_id, slot.slot_date, slot.start_time]
      );
      if (conflictRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Slot already booked! Please select another time.' });
      }
    }

    const bookingRef = 'MN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const isPaidNow = paymentMethod === 'cash';

    const insertResult = await client.query(
      `INSERT INTO bookings
       (ground_id, user_id, slot_id, booking_date, start_time, end_time, total_price,
        players_count, special_requests, status, payment_status, payment_method,
        booking_ref, source, booked_by_user_id, customer_name, customer_phone)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10, $11, 'walk_in', $12, $13, $14)
       RETURNING id, ground_id, user_id, booking_date, start_time, end_time, total_price,
                 status, payment_status, payment_method, booking_ref, created_at`,
      [
        slot.ground_id, slot.id || null, slot.slot_date, slot.start_time, slot.end_time,
        slot.price, playersCount || 1, specialRequests || '',
        isPaidNow ? 'paid' : 'unpaid', isPaidNow ? 'cash' : null,
        bookingRef, req.user.id, customerName, customerPhone,
      ]
    );

    // Mark the slot as booked immediately — no hold/payment window needed
    if (slot.id) {
      await client.query(
        `UPDATE slots SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
         WHERE id = $1`,
        [slot.id]
      );
    }

    await client.query('COMMIT');

    const booking = insertResult.rows[0];
    const when = `${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)}`;

    // A walk-in has no user account, so the bell goes to whoever can act on it:
    // the ground owner (when staff booked on someone else's ground) and, if the
    // guest's phone matches a registered account, that player.
    if (ground.owner_id && ground.owner_id !== req.user.id) {
      await notify({
        userId: ground.owner_id,
        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        title: 'Walk-in booking added',
        body: `${customerName} booked ${groundName} on ${when}. Reference ${booking.booking_ref}.`,
        link: bookingLink('owner', booking.id),
        bookingId: booking.id,
      });
    }

    if (customerPhone) {
      const match = await client.query(
        'SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1',
        [customerPhone, req.user.id]
      );
      if (match.rows.length) {
        await notify({
          userId: match.rows[0].id,
          type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
          title: 'You have a booking',
          body: `${groundName} on ${when}, reference ${booking.booking_ref}.`,
          link: bookingLink('player', booking.id),
          bookingId: booking.id,
        });
      }
    }

    res.status(201).json({
      message: `Booking confirmed for ${customerName}.`,
      booking: {
        id: booking.id,
        groundId: booking.ground_id,
        userId: booking.user_id,
        groundName,
        date: toDateKey(booking.booking_date),
        startTime: booking.start_time,
        endTime: booking.end_time,
        totalPrice: parseFloat(booking.total_price),
        status: booking.status,
        paymentStatus: booking.payment_status,
        paymentMethod: booking.payment_method,
        bookingRef: booking.booking_ref,
        source: 'walk_in',
        customerName: booking.customer_name ?? customerName,
        customerPhone: booking.customer_phone ?? customerPhone,
        createdAt: booking.created_at,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Slot already booked! Please select another time.',
      });
    }
    console.error('Walk-in booking error:', error);
    res.status(500).json({ message: 'Booking failed. Please try again.' });
  } finally {
    client.release();
  }
};

// Ground owner / admin accepts a "pay at counter" booking. The slot is
// already reserved (held without expiry) — approving books it for real.
exports.approveBooking = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `SELECT b.*, g.owner_id, g.name as ground_name FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 FOR UPDATE`,
      [id]
    );

    if (!bookingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    // Tenant isolation: owners may only approve bookings on their own grounds.
    if (!['admin', 'subadmin'].includes(req.user.role) && booking.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only approve bookings for your own grounds.' });
    }

    if (!booking.requires_approval) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This booking is not awaiting approval.' });
    }
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `This booking is already ${booking.status}.` });
    }

    const updated = await client.query(
      `UPDATE bookings SET status = 'confirmed', requires_approval = FALSE, payment_deadline = NULL
       WHERE id = $1
       RETURNING id, status, requires_approval, payment_status, payment_method`,
      [id]
    );

    if (booking.slot_id) {
      await client.query(
        `UPDATE slots SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
         WHERE id = $1`,
        [booking.slot_id]
      );
    }

    await client.query('COMMIT');

    const row = updated.rows[0];

    await notify({
      userId: booking.user_id,
      type: NOTIFICATION_TYPES.APPROVAL_APPROVED,
      title: 'Booking confirmed',
      body: `${booking.ground_name} on ${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)} is yours. Pay at the counter.`,
      link: bookingLink('player', booking.id),
      bookingId: booking.id,
    });

    res.json({
      message: 'Booking confirmed. The player pays at the counter.',
      booking: {
        id: row.id,
        status: row.status,
        requiresApproval: row.requires_approval,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        groundName: booking.ground_name,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve booking error:', error);
    res.status(500).json({ message: 'Failed to approve booking.' });
  } finally {
    client.release();
  }
};

// Called by payment service after successful gateway verification
exports.confirmBooking = async (bookingId, paymentId, client) => {  const result = await client.query(
    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_method = gateway
     FROM (SELECT gateway FROM payments WHERE id = $2) p
     WHERE bookings.id = $1 AND bookings.status = 'pending'
     RETURNING bookings.id, bookings.slot_id`,
    [bookingId, paymentId]
  );

  if (result.rows.length && result.rows[0].slot_id) {
    await client.query(
      `UPDATE slots SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
       WHERE id = $1`,
      [result.rows[0].slot_id]
    );
  }

  return result.rows.length > 0;
};

// Release hold on booking (payment failed/expired)
exports.releaseBookingHold = async (bookingId, client) => {
  const result = await client.query(
    `SELECT slot_id FROM bookings WHERE id = $1 AND status = 'pending'`,
    [bookingId]
  );

  if (result.rows.length && result.rows[0].slot_id) {
    await client.query(
      `UPDATE slots SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
       WHERE id = $1`,
      [result.rows[0].slot_id]
    );
  }

  await client.query(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Payment failed or expired'
     WHERE id = $1 AND status = 'pending'`,
    [bookingId]
  );
};

exports.getMyBookings = async (req, res) => {
  const userId = req.user.id;
  const { status, date, groundId, search } = req.query;
  const safePage = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (safePage - 1) * safeLimit;

  try {
    // Release expired holds before querying
    await pool.query('SELECT release_expired_holds()');

    // Filter clauses are accumulated into a shared WHERE so the count query is
    // built from exactly the same conditions. The previous version derived it
    // with query.replace(/SELECT[\s\S]*?FROM/, ...), which silently corrupts as
    // soon as the SELECT list gains a nested FROM (a subquery, a UNION, ...).
    // A booking is "mine" in three different ways, and the list has to agree
    // with the detail endpoint or players get a bell notification that 404s:
    //  1. user_id          — booked while signed in as a player
    //  2. booked_by_user_id— staff recorded it for me on their account
    //  3. customer_phone   — booked as a walk-in guest, matched on my phone
    //                          (walk-ins store user_id NULL, so without this
    //                           clause the walk-in notification has no target)
    const conditions = [
      `(b.user_id = $1
        OR b.booked_by_user_id = $1
        OR b.customer_phone = (SELECT phone FROM users WHERE id = $1))`,
    ];
    const params = [userId];

    const bind = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (status) conditions.push(`b.status = ${bind(status)}`);
    if (date) conditions.push(`b.booking_date = ${bind(date)}`);
    if (groundId) conditions.push(`b.ground_id = ${bind(groundId)}`);
    if (search) {
      // Ground name or booking reference, case-insensitive.
      const ref = bind(`%${search}%`);
      params.push(`%${search}%`);
      conditions.push(`(g.name ILIKE ${ref} OR b.booking_ref ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');
    const FROM = 'FROM bookings b JOIN grounds g ON b.ground_id = g.id';

    // Upcoming bookings first (soonest at the top), then past ones newest-first.
    // Both groups need a different direction, so the date is sorted through a
    // CASE per group: the group that does not apply yields NULL, which ties and
    // lets the next sort key decide. Nulls sort last under ASC by default, so
    // within the future group `start_time ASC` is the final tiebreaker.
    const ORDER_BY = `
      ORDER BY
        (b.booking_date < CURRENT_DATE) ASC,
        CASE WHEN b.booking_date >= CURRENT_DATE THEN b.booking_date END ASC,
        CASE WHEN b.booking_date <  CURRENT_DATE THEN b.booking_date END DESC,
        CASE WHEN b.booking_date <  CURRENT_DATE THEN b.start_time END DESC,
        b.start_time ASC`;

    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) ${FROM} WHERE ${where}`, params),
      pool.query(
        `SELECT b.id, b.ground_id, b.user_id, b.slot_id, b.booking_date, b.start_time, b.end_time,
                b.total_price, b.players_count, b.special_requests, b.status,
                b.payment_status, b.payment_method, b.booking_ref, b.payment_deadline,
                b.cancelled_at, b.cancellation_reason, b.is_late_cancellation, b.late_cancellation_fee,
                b.requires_approval, b.completed_at,
                b.deposit_amount, b.deposit_paid, b.deposit_refunded, b.batch_group_id,
                b.created_at,
                g.name as ground_name, g.contact as ground_contact, g.address as ground_address,
                g.city as ground_city, g.latitude as ground_latitude, g.longitude as ground_longitude,
                g.sport_type as ground_sport_type, g.operating_start, g.operating_end
         ${FROM}
         WHERE ${where}
         ${ORDER_BY}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, safeLimit, offset]
      ),
    ]);

    const bookings = result.rows.map((b) => ({
      id: b.id,
      groundId: b.ground_id,
      userId: b.user_id,
      slotId: b.slot_id,
      groundName: b.ground_name,
      groundContact: b.ground_contact,
      groundAddress: b.ground_address,
      groundCity: b.ground_city,
      groundLatitude: b.ground_latitude == null ? null : parseFloat(b.ground_latitude),
      groundLongitude: b.ground_longitude == null ? null : parseFloat(b.ground_longitude),
      groundSportType: b.ground_sport_type,
      operatingStart: b.operating_start,
      operatingEnd: b.operating_end,
      date: toDateKey(b.booking_date),
      startTime: b.start_time,
      endTime: b.end_time,
      totalPrice: parseFloat(b.total_price),
      numberOfPlayers: b.players_count,
      specialRequests: b.special_requests,
      status: b.status,
      paymentStatus: b.payment_status,
      paymentMethod: b.payment_method,
      bookingRef: b.booking_ref,
      paymentDeadline: b.payment_deadline,
      cancelledAt: b.cancelled_at,
      cancellationReason: b.cancellation_reason,
      isLateCancellation: b.is_late_cancellation,
      requiresApproval: b.requires_approval,
      lateCancellationFee: parseFloat(b.late_cancellation_fee),
      depositAmount: parseFloat(b.deposit_amount),
      depositPaid: b.deposit_paid,
      depositRefunded: b.deposit_refunded,
      batchGroupId: b.batch_group_id,
      completedAt: b.completed_at,
      createdAt: b.created_at,
    }));

    res.json({ bookings, total: parseInt(countResult.rows[0].count, 10), page: safePage, limit: safeLimit });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
};

/**
 * Player-scoped single booking.
 *
 * Scoped to the signed-in player. Returns 404 (not 403) when the row exists but
 * belongs to someone else, so booking ids cannot be probed for existence.
 *
 * The ownership predicate is deliberately identical to getMyBookings: a booking
 * is reachable via user_id (self-booked), booked_by_user_id (staff recorded it
 * against the player) or customer_phone (a walk-in guest who has since
 * registered). If these two ever drift apart, a notification sent to a player
 * links to a page that 404s.
 */
exports.getMyBookingById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await pool.query('SELECT release_expired_holds()');

    const result = await pool.query(
      `SELECT b.id, b.ground_id, b.user_id, b.slot_id, b.booking_date, b.start_time, b.end_time,
              b.total_price, b.players_count, b.special_requests, b.status, b.source,
              b.payment_status, b.payment_method, b.booking_ref, b.payment_deadline,
              b.cancelled_at, b.cancellation_reason, b.is_late_cancellation, b.late_cancellation_fee,
              b.requires_approval, b.completed_at, b.customer_name, b.customer_phone,
              b.deposit_amount, b.deposit_paid, b.deposit_refunded, b.batch_group_id, b.created_at,
              g.name as ground_name, g.contact as ground_contact, g.address as ground_address,
              g.city as ground_city, g.latitude as ground_latitude, g.longitude as ground_longitude,
              g.sport_type as ground_sport_type, g.operating_start, g.operating_end,
              g.description as ground_description, g.image_url as ground_image_url,
              ow.name as ground_owner_name, ow.phone as ground_owner_phone,
              ow.email as ground_owner_email, ow.business_name as ground_owner_business,
              u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       LEFT JOIN users ow ON ow.id = g.owner_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = $1
         AND (b.user_id = $2
              OR b.booked_by_user_id = $2
              OR b.customer_phone = (SELECT phone FROM users WHERE id = $2))`,
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const b = result.rows[0];

    // Payment attempts for this booking, newest first. Scoped to the booking we
    // already proved the caller owns, so this cannot leak another user's rows.
    const payments = await pool.query(
      `SELECT id, gateway, amount, currency, payment_status, failure_reason,
              provider_transaction_id, verified_at, created_at
       FROM payments
       WHERE booking_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      booking: {
        id: b.id,
        groundId: b.ground_id,
        userId: b.user_id,
        slotId: b.slot_id,
        groundName: b.ground_name,
        groundContact: b.ground_contact,
        groundAddress: b.ground_address,
        groundCity: b.ground_city,
        groundLatitude: b.ground_latitude == null ? null : parseFloat(b.ground_latitude),
        groundLongitude: b.ground_longitude == null ? null : parseFloat(b.ground_longitude),
        groundSportType: b.ground_sport_type,
        groundDescription: b.ground_description,
        groundImageUrl: b.ground_image_url,
        operatingStart: b.operating_start,
        operatingEnd: b.operating_end,
        groundOwner: b.ground_owner_name ? {
          name: b.ground_owner_name,
          phone: b.ground_owner_phone,
          email: b.ground_owner_email,
          business: b.ground_owner_business,
        } : null,
        userName: b.user_name,
        userEmail: b.user_email,
        userPhone: b.user_phone,
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        source: b.source || 'online',
        date: toDateKey(b.booking_date),
        startTime: b.start_time,
        endTime: b.end_time,
        totalPrice: parseFloat(b.total_price),
        numberOfPlayers: b.players_count,
        specialRequests: b.special_requests,
        status: b.status,
        paymentStatus: b.payment_status,
        paymentMethod: b.payment_method,
        bookingRef: b.booking_ref,
        paymentDeadline: b.payment_deadline,
        cancelledAt: b.cancelled_at,
        cancellationReason: b.cancellation_reason,
        isLateCancellation: b.is_late_cancellation,
        lateCancellationFee: parseFloat(b.late_cancellation_fee),
        requiresApproval: b.requires_approval,
        depositAmount: parseFloat(b.deposit_amount),
        depositPaid: b.deposit_paid,
        depositRefunded: b.deposit_refunded,
        batchGroupId: b.batch_group_id,
        completedAt: b.completed_at,
        createdAt: b.created_at,
      },
      payments: payments.rows.map((p) => ({
        id: p.id,
        gateway: p.gateway,
        amount: parseFloat(p.amount),
        currency: p.currency,
        status: p.payment_status,
        failureReason: p.failure_reason,
        providerTransactionId: p.provider_transaction_id,
        verifiedAt: p.verified_at,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('Get my booking by id error:', error);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
};

exports.getActiveCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM bookings
       WHERE user_id = $1 AND status IN ('confirmed', 'pending') AND booking_date >= CURRENT_DATE`,
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get active count error:', error);
    res.status(500).json({ message: 'Failed to get booking count.' });
  }
};

exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { reason } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT b.*, g.name as ground_name FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 AND b.user_id = $2 FOR UPDATE`,
      [id, userId]
    );

    if (!bookingResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This booking cannot be cancelled.' });
    }

    // Pending bookings can be cancelled without fee
    if (booking.status === 'pending') {
      if (booking.slot_id) {
        await client.query(
          `UPDATE slots SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
           WHERE id = $1`,
          [booking.slot_id]
        );
      }
      await client.query(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
         WHERE id = $2`,
        [reason || 'Cancelled by user', id]
      );
      await client.query('COMMIT');

      await notifyGroundActors(booking.ground_id, {
        type: NOTIFICATION_TYPES.BOOKING_CANCELLED,
        title: 'Player cancelled a request',
        body: `${booking.ground_name} on ${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)} is free again.`,
        linkFor: (role) => bookingLink(role, booking.id),
        bookingId: booking.id,
      });

      return res.json({ message: 'Pending booking cancelled. No charge applied.' });
    }

    // Confirmed bookings — deposit / batch cancellation policy
    const slotDateTime = new Date(`${booking.booking_date.toISOString().split('T')[0]}T${booking.start_time}`);
    const now = new Date();
    const hoursUntil = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLate = hoursUntil < FREE_CANCELLATION_HOURS;
    const isBatch = !!booking.batch_group_id;
    const totalPrice = parseFloat(booking.total_price);

    let fee = 0;
    let refundAmount = 0;
    const { fee: computedFee, refundAmount: computedRefund } = computeCancellationFee({
      totalPrice,
      depositAmount: booking.deposit_amount,
      isBatch,
      isLate,
    });
    fee = computedFee;
    refundAmount = computedRefund;

    const newStatus = isLate ? 'late_cancelled' : 'cancelled';

    const updateResult = await client.query(
      `UPDATE bookings SET
       status = $1, cancelled_at = NOW(), cancellation_reason = $2,
       is_late_cancellation = $3, late_cancellation_fee = $4
       WHERE id = $5
       RETURNING id, status, is_late_cancellation, late_cancellation_fee, cancelled_at`,
      [newStatus, reason || null, isLate, fee, id]
    );

    if (booking.slot_id) {
      await client.query(
        `UPDATE slots SET status = 'available' WHERE id = $1`,
        [booking.slot_id]
      );
    }

    await client.query('COMMIT');

    const updated = updateResult.rows[0];

    await notifyGroundActors(booking.ground_id, {
      type: NOTIFICATION_TYPES.BOOKING_CANCELLED,
      title: isLate ? 'Late cancellation — slot released' : 'Player cancelled a booking',
      body: `${booking.ground_name} on ${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)} is free again.${isLate ? ` Rs ${fee} retained as the fee.` : ''}`,
      linkFor: (role) => bookingLink(role, booking.id),
      bookingId: booking.id,
    });

    let message;
    if (isLate) {
      message = isBatch
        ? `Booking cancelled with a late fee of Rs. ${fee} (40% of the total). The remaining Rs. ${Math.max(0, totalPrice - fee)} will be refunded by the venue.`
        : `Booking cancelled with a late fee of Rs. ${fee} (your online deposit).`;
    } else {
      message = refundAmount > 0
        ? `Booking cancelled. Free cancellation — your online payment of Rs. ${refundAmount} will be refunded by the venue.`
        : 'Booking cancelled successfully. No penalty applied.';
    }
    res.json({
      message,
      booking: {
        id: updated.id,
        status: updated.status,
        isLateCancellation: updated.is_late_cancellation,
        lateCancellationFee: parseFloat(updated.late_cancellation_fee),
        cancelledAt: updated.cancelled_at,
        refundAmount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  } finally {
    client.release();
  }
};

exports.adminCancelBooking = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT b.*, g.name as ground_name, g.owner_id FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 FOR UPDATE`,
      [id]
    );

    if (!bookingResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];

    // Tenant isolation: owners may only cancel bookings on their own grounds.
    if (!['admin', 'subadmin'].includes(req.user.role) && booking.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only cancel bookings on your own grounds.' });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This booking cannot be cancelled.' });
    }

    // Release slot for any non-cancelled booking
    if (booking.slot_id) {
      await client.query(
        `UPDATE slots SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
         WHERE id = $1`,
        [booking.slot_id]
      );
    }

    const rejectionReason = reason || (booking.requires_approval ? 'Rejected by ground owner' : 'Cancelled by admin');
    await client.query(
      `UPDATE bookings SET status = 'cancelled', requires_approval = FALSE, cancelled_at = NOW(), cancellation_reason = $1
       WHERE id = $2`,
      [rejectionReason, id]
    );

    await client.query('COMMIT');

    // An approval that turns into a rejection is the one the player most needs
    // to hear about, so it always notifies — even for staff-initiated cancels.
    const wasApproval = booking.requires_approval;
    await notify({
      userId: booking.user_id,
      type: wasApproval ? NOTIFICATION_TYPES.APPROVAL_REJECTED : NOTIFICATION_TYPES.BOOKING_CANCELLED,
      title: wasApproval ? 'Pay-at-counter request rejected' : 'Your booking was cancelled',
      body: wasApproval
        ? `${booking.ground_name} on ${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)} could not be approved. ${rejectionReason}`
        : `${booking.ground_name} on ${toDateKey(booking.booking_date)} at ${hhmm(booking.start_time)} was cancelled. ${rejectionReason}`,
      link: bookingLink('player', booking.id),
      bookingId: booking.id,
    });

    res.json({
      message: booking.requires_approval ? 'Booking request rejected. The slot is free again.' : 'Booking cancelled by admin.',
      booking: { id: booking.id, status: 'cancelled', requiresApproval: false },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin cancel error:', error);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  } finally {
    client.release();
  }
};

exports.markPaid = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `SELECT b.*, g.owner_id FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 FOR UPDATE`,
      [id]
    );

    if (!bookingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    if (!['admin', 'subadmin'].includes(req.user.role) && booking.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only mark paid bookings on your own grounds.' });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only confirmed bookings can be marked as paid.' });
    }

    if (booking.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This booking is already paid.' });
    }

    const updated = await client.query(
      `UPDATE bookings SET payment_status = 'paid', payment_method = COALESCE(payment_method, 'counter')
       WHERE id = $1
       RETURNING id, payment_status, payment_method`,
      [id]
    );

    await client.query('COMMIT');

    await notify({
      userId: booking.user_id,
      type: NOTIFICATION_TYPES.PAYMENT_RECORDED,
      title: 'Payment recorded',
      body: `Your payment for ${booking.booking_ref} was recorded at the venue. Nothing more is due.`,
      link: bookingLink('player', booking.id),
      bookingId: booking.id,
    });

    res.json({
      message: 'Marked as paid at the counter.',
      booking: {
        id: updated.rows[0].id,
        paymentStatus: updated.rows[0].payment_status,
        paymentMethod: updated.rows[0].payment_method,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mark paid error:', error);
    res.status(500).json({ message: 'Failed to mark booking as paid.' });
  } finally {
    client.release();
  }
};

// Admin/owner: record that a deposit (single) or balance remainder (batch)
// was refunded through the gateway after a cancellation.
exports.adminRefundDeposit = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `SELECT b.*, g.owner_id FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 FOR UPDATE`,
      [id]
    );

    if (!bookingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    if (!['admin', 'subadmin'].includes(req.user.role) && booking.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only refund bookings on your own grounds.' });
    }

    if (booking.status !== 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only cancelled bookings can be refunded.' });
    }

    if (booking.deposit_amount <= 0 && !booking.batch_group_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No online payment was made for this booking.' });
    }

    if (booking.is_late_cancellation && !booking.batch_group_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'The deposit was retained as the late cancellation fee — nothing to refund.' });
    }

    const totalPrice = parseFloat(booking.total_price);
    const { deposit } = computeDeposit(totalPrice);
    const refundAmount = booking.is_late_cancellation
      ? Math.max(0, totalPrice - deposit) // batch: remainder after 40% fee
      : booking.batch_group_id ? totalPrice : parseFloat(booking.deposit_amount);

    const updated = await client.query(
      `UPDATE bookings SET deposit_refunded = TRUE, payment_status = 'refunded'
       WHERE id = $1
       RETURNING id, deposit_refunded, payment_status`,
      [id]
    );

    // If this is a batch, refund every member booking and free their slots if needed.
    if (booking.batch_group_id) {
      await client.query(
        `UPDATE bookings SET deposit_refunded = TRUE, payment_status = 'refunded'
         WHERE batch_group_id = $1 AND status = 'cancelled'`,
        [booking.batch_group_id]
      );
      await client.query(
        `UPDATE slots s SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
         FROM bookings b
         WHERE b.batch_group_id = $1 AND b.slot_id = s.id`,
        [booking.batch_group_id]
      );
    }

    await client.query('COMMIT');

    await notify({
      userId: booking.user_id,
      type: NOTIFICATION_TYPES.REFUND_RECORDED,
      title: 'Refund recorded',
      body: `A refund of Rs ${refundAmount} for booking ${booking.booking_ref} was recorded.`,
      link: bookingLink('player', booking.id),
      bookingId: booking.id,
    });

    res.json({
      message: `Refund of Rs. ${refundAmount} recorded for booking ${booking.booking_ref}.`,
      refundAmount,
      booking: {
        id: updated.rows[0].id,
        depositRefunded: updated.rows[0].deposit_refunded,
        paymentStatus: updated.rows[0].payment_status,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refund deposit error:', error);
    res.status(500).json({ message: 'Failed to record refund.' });
  } finally {
    client.release();
  }
};

exports.getAllBookings = async (req, res) => {
  const { status, date, groundId, search, requiresApproval, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT b.id, b.ground_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.players_count, b.special_requests, b.status,
             b.payment_status, b.payment_method, b.booking_ref,
             b.payment_deadline, b.source, b.customer_name, b.customer_phone, b.created_at,
             b.requires_approval,
b.deposit_amount, b.deposit_paid, b.deposit_refunded, b.batch_group_id,
             b.is_late_cancellation, b.late_cancellation_fee,
             g.name as ground_name, g.contact as ground_contact,
             u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM bookings b
      JOIN grounds g ON b.ground_id = g.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (requiresApproval !== undefined && requiresApproval !== '') {
      query += ` AND b.requires_approval = $${paramIndex}`;
      params.push(requiresApproval === 'true');
      paramIndex++;
    }
    if (date) {
      query += ` AND b.booking_date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    if (groundId) {
      query += ` AND b.ground_id = $${paramIndex}`;
      params.push(groundId);
      paramIndex++;
    }
    if (search) {
      query += ` AND (b.booking_ref ILIKE $${paramIndex} OR g.name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR b.customer_name ILIKE $${paramIndex} OR b.customer_phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (req.user.role === 'owner') {
      query += ` AND g.owner_id = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY b.created_at DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const bookings = result.rows.map((b) => ({
      id: b.id,
      groundId: b.ground_id,
      userId: b.user_id,
      groundName: b.ground_name,
      groundContact: b.ground_contact,
      userName: b.user_name,
      userEmail: b.user_email,
      userPhone: b.user_phone,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      source: b.source || 'online',
      date: toDateKey(b.booking_date),
      startTime: b.start_time,
      endTime: b.end_time,
      totalPrice: parseFloat(b.total_price),
      numberOfPlayers: b.players_count,
      specialRequests: b.special_requests,
      status: b.status,
      paymentStatus: b.payment_status,
      paymentMethod: b.payment_method,
      bookingRef: b.booking_ref,
      paymentDeadline: b.payment_deadline,
      depositAmount: parseFloat(b.deposit_amount),
      depositPaid: b.deposit_paid,
      depositRefunded: b.deposit_refunded,
      batchGroupId: b.batch_group_id,
      isLateCancellation: b.is_late_cancellation,
      requiresApproval: b.requires_approval,
      lateCancellationFee: parseFloat(b.late_cancellation_fee),
      createdAt: b.created_at,
    }));

    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
};

exports.getBookingById = async (req, res) => {
  const { id } = req.params;

  try {
    let query = `
      SELECT b.id, b.ground_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.players_count, b.special_requests, b.status,
             b.payment_status, b.payment_method, b.booking_ref,
             b.payment_deadline, b.source, b.customer_name, b.customer_phone, b.created_at,
             b.cancelled_at, b.cancellation_reason, b.is_late_cancellation, b.late_cancellation_fee,
             b.requires_approval,
b.deposit_amount, b.deposit_paid, b.deposit_refunded, b.batch_group_id,
             g.name as ground_name, g.contact as ground_contact,
             ow.id as ground_owner_id, ow.name as ground_owner_name, ow.phone as ground_owner_phone,
             ow.email as ground_owner_email, ow.business_name as ground_owner_business,
             u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM bookings b
      JOIN grounds g ON b.ground_id = g.id
      LEFT JOIN users ow ON g.owner_id = ow.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = $1
    `;
    const params = [id];

    if (req.user.role === 'owner') {
      query += ' AND g.owner_id = $2';
      params.push(req.user.id);
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const b = result.rows[0];
    res.json({
      booking: {
        id: b.id,
        groundId: b.ground_id,
        userId: b.user_id,
        groundName: b.ground_name,
        groundContact: b.ground_contact,
        groundOwner: b.ground_owner_id ? {
          id: b.ground_owner_id,
          name: b.ground_owner_name,
          phone: b.ground_owner_phone,
          email: b.ground_owner_email,
          business: b.ground_owner_business,
        } : null,
        userName: b.user_name,
        userEmail: b.user_email,
        userPhone: b.user_phone,
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        source: b.source || 'online',
        date: toDateKey(b.booking_date),
        startTime: b.start_time,
        endTime: b.end_time,
        totalPrice: parseFloat(b.total_price),
        numberOfPlayers: b.players_count,
        specialRequests: b.special_requests,
        status: b.status,
        paymentStatus: b.payment_status,
        paymentMethod: b.payment_method,
        bookingRef: b.booking_ref,
        paymentDeadline: b.payment_deadline,
        cancelledAt: b.cancelled_at,
        cancellationReason: b.cancellation_reason,
        depositAmount: parseFloat(b.deposit_amount),
        depositPaid: b.deposit_paid,
        depositRefunded: b.deposit_refunded,
        batchGroupId: b.batch_group_id,
        isLateCancellation: b.is_late_cancellation,
      requiresApproval: b.requires_approval,
        lateCancellationFee: parseFloat(b.late_cancellation_fee),
        createdAt: b.created_at,
      },
    });
  } catch (error) {
    console.error('Get booking by id error:', error);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    // Release expired holds first
    await pool.query('SELECT release_expired_holds()');

    let result;
    if (req.user.role === 'owner') {
      result = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE b.booking_date = CURRENT_DATE AND b.status = 'confirmed') AS today_bookings,
          COALESCE(SUM(b.total_price) FILTER (WHERE b.booking_date = CURRENT_DATE AND b.status = 'confirmed'), 0) AS today_revenue,
          (SELECT COUNT(*) FROM grounds WHERE owner_id = $1 AND is_active = TRUE) AS total_grounds,
          COUNT(*) FILTER (WHERE b.booking_date >= CURRENT_DATE AND b.status = 'confirmed') AS upcoming_bookings
        FROM bookings b
        JOIN grounds g ON b.ground_id = g.id
        WHERE g.owner_id = $1`,
        [req.user.id]
      );
    } else {
      result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE booking_date = CURRENT_DATE AND status = 'confirmed') AS today_bookings,
          COALESCE(SUM(total_price) FILTER (WHERE booking_date = CURRENT_DATE AND status = 'confirmed'), 0) AS today_revenue,
          (SELECT COUNT(*) FROM grounds WHERE is_active = TRUE) AS total_grounds,
          COUNT(*) FILTER (WHERE booking_date >= CURRENT_DATE AND status = 'confirmed') AS upcoming_bookings
        FROM bookings
      `);
    }

    const row = result.rows[0];
    res.json({
      totalBookingsToday: parseInt(row.today_bookings),
      revenueToday: parseFloat(row.today_revenue),
      totalGrounds: parseInt(row.total_grounds),
      upcomingBookings: parseInt(row.upcoming_bookings),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats.' });
  }
};

exports.getAllUsers = async (req, res) => {
  // Tenant isolation (defense in depth): the global user directory is
  // platform-level and must never be reachable by ground owners.
  if (!['admin', 'subadmin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  }

  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT id, name, email, phone, role, is_phone_verified, kyc_status, business_name, permissions, created_at
      FROM users WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const users = result.rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isPhoneVerified: u.is_phone_verified,
      kycStatus: u.kyc_status,
      businessName: u.business_name,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      createdAt: u.created_at,
    }));

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
};
