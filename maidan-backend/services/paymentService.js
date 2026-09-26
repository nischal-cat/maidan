const { pool } = require('../db');
const khalti = require('./khaltiAdapter');
const esewa = require('./esewaAdapter');
const { NOTIFICATION_TYPES, notify } = require('./notificationService');

const hhmm = (t) => String(t || '').slice(0, 5);

/**
 * Tell the player their money moved. Called after the gateway callback has been
 * committed, so the notification can never affect the payment state machine.
 *
 * @param {'paid'|'failed'|'pending'} outcome
 * @param {object} payment  the payments row joined with bookings
 * @param {string[]} confirmedIds  bookings the callback just confirmed
 */
async function notifyPaymentOutcome(outcome, payment, confirmedIds = []) {
  const bookingId = payment.booking_id;
  const when = `${String(payment.booking_date || '').slice(0, 10)} at ${hhmm(payment.start_time)}`;

  if (outcome === 'paid') {
    const isBatch = !!payment.batch_group_id;
    await notify({
      userId: payment.user_id,
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      title: isBatch ? `${confirmedIds.length || 'Your'} slots confirmed` : 'Booking confirmed',
      body: `Payment of Rs ${Number(payment.amount)} received via ${payment.gateway}. ${payment.ground_name || 'Your ground'}${when ? ` on ${when}` : ''}.`,
      link: `/bookings/${bookingId}`,
      bookingId,
    });
    return;
  }

  if (outcome === 'failed') {
    await notify({
      userId: payment.user_id,
      type: NOTIFICATION_TYPES.PAYMENT_FAILED,
      title: 'Payment failed',
      body: `We could not confirm your ${payment.gateway} payment of Rs ${Number(payment.amount)}. The slot has been released — you can book again.`,
      link: `/bookings/${bookingId}`,
      bookingId,
    });
  }
}

/**
 * Load the fields notifyPaymentOutcome needs. Kept separate so the callback
 * handlers can enrich their existing payment row with one extra query.
 */
async function loadPaymentForNotification(paymentId) {
  const result = await pool.query(
    `SELECT p.id, p.booking_id, p.batch_group_id, p.gateway, p.amount, p.user_id,
            b.booking_date, b.start_time,
            g.name AS ground_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN grounds g ON g.id = b.ground_id
     WHERE p.id = $1`,
    [paymentId]
  );
  return result.rows[0] || null;
}

/**
 * Create a payment record and initiate the gateway request.
 * amountOverride lets a deposit (40%) or full batch sum be charged instead
 * of the single booking's total_price.
 * For Khalti: returns { redirectUrl, paymentId }.
 * For eSewa: returns { formUrl, formFields, paymentId }.
 */
async function createPayment(booking, user, gateway = 'esewa', opts = {}) {
  const amount = opts.amountOverride != null && opts.amountOverride !== undefined ? Number(opts.amountOverride) : Number(booking.total_price);
  const batchGroupId = opts.batchGroupId || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (booking_id, gateway, amount, payment_status, batch_group_id)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id`,
      [booking.id, gateway, amount, batchGroupId]
    );
    const paymentId = paymentResult.rows[0].id;

    if (gateway === 'khalti') {
      const { redirectUrl, pidx, providerOrderId } = await khalti.initiatePayment({
        bookingId: booking.booking_ref || booking.id,
        amountNpr: amount,
        customerInfo: { name: user.name, email: user.email, phone: user.phone },
      });

      await client.query(
        `UPDATE payments SET provider_order_id = $1, provider_pidx = $2 WHERE id = $3`,
        [providerOrderId, pidx, paymentId]
      );

      await client.query('COMMIT');
      return { redirectUrl, paymentId };

    } else if (gateway === 'esewa') {
      const { formUrl, fields, transactionUuid } = esewa.buildFormFields({
        bookingId: booking.booking_ref || booking.id,
        amountNpr: amount,
      });

      await client.query(
        `UPDATE payments SET provider_order_id = $1 WHERE id = $2`,
        [transactionUuid, paymentId]
      );

      await client.query('COMMIT');
      return { formUrl, formFields: fields, paymentId, transactionUuid };

    } else {
      throw new Error(`Unsupported gateway: ${gateway}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atomically confirm all pending bookings that share a batch_group_id
 * (multi-slot) or a single booking (single-slot deposit / full online).
 */
async function confirmBookings(client, gateway, batchGroupId, bookingId, amount, totalPrice) {
  let confirmedIds;
  if (batchGroupId) {
    const r = await client.query(
      `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_method = $1
       WHERE batch_group_id = $2 AND status = 'pending'
       RETURNING id`,
      [gateway, batchGroupId]
    );
    confirmedIds = r.rows.map((x) => x.id);
    await client.query(
      `UPDATE slots s SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
       FROM bookings b
       WHERE b.batch_group_id = $1 AND b.slot_id = s.id AND s.status = 'held'`,
      [batchGroupId]
    );
  } else if (Number(amount) < Number(totalPrice)) {
    // Deposit-only (single slot): balance is collected at the venue.
    const r = await client.query(
      `UPDATE bookings SET status = 'confirmed', deposit_paid = TRUE, payment_method = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING id`,
      [gateway, bookingId]
    );
    confirmedIds = r.rows.map((x) => x.id);
    await client.query(
      `UPDATE slots SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
       WHERE id = (SELECT slot_id FROM bookings WHERE id = $1) AND status = 'held'`,
      [bookingId]
    );
  } else {
    // Full online payment (single slot)
    const r = await client.query(
      `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_method = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING id`,
      [gateway, bookingId]
    );
    confirmedIds = r.rows.map((x) => x.id);
    await client.query(
      `UPDATE slots SET status = 'booked', held_by_user_id = NULL, hold_expires_at = NULL
       WHERE id = (SELECT slot_id FROM bookings WHERE id = $1) AND status = 'held'`,
      [bookingId]
    );
  }
  return confirmedIds;
}

/**
 * Atomically cancel all pending bookings in a batch (or a single booking)
 * and release their slots when a gateway payment fails/expires.
 */
async function failBookings(client, reason, batchGroupId, bookingId) {
  if (batchGroupId) {
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
       WHERE batch_group_id = $2 AND status = 'pending'`,
      [reason, batchGroupId]
    );
    await client.query(
      `UPDATE slots s SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
       FROM bookings b
       WHERE b.batch_group_id = $1 AND b.slot_id = s.id AND s.status = 'held'`,
      [batchGroupId]
    );
  } else {
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
       WHERE id = $2 AND status = 'pending'`,
      [reason, bookingId]
    );
    await client.query(
      `UPDATE slots SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
       WHERE id = (SELECT slot_id FROM bookings WHERE id = $1) AND status = 'held'`,
      [bookingId]
    );
  }
}

/**
 * Handle a gateway callback/return. Verifies the payment with the gateway,
 * then confirms or releases the booking (or whole batch).
 */
async function handleCallback(gateway, callbackData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Khalti callback ---
    if (gateway === 'khalti') {
      const pidx = callbackData.pidx;
      if (!pidx) {
        await client.query('ROLLBACK');
        return { status: 'failed', message: 'No pidx in callback' };
      }

      const paymentResult = await client.query(
        `SELECT p.*, b.total_price, b.booking_ref FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.provider_pidx = $1 ORDER BY p.created_at DESC LIMIT 1`,
        [pidx]
      );
      if (!paymentResult.rows.length) {
        await client.query('ROLLBACK');
        return { status: 'failed', message: 'Payment not found' };
      }

      const payment = paymentResult.rows[0];
      if (payment.payment_status === 'paid') {
        await client.query('ROLLBACK');
        return { status: 'success', payment, booking: { id: payment.booking_id } };
      }
      if (payment.payment_status === 'failed') {
        await client.query('ROLLBACK');
        return { status: 'failed', payment, booking: { id: payment.booking_id } };
      }

      const lookupResult = await khalti.lookupPayment(pidx);
      const normalized = khalti.normalizeStatus(lookupResult.status);

      if (normalized === 'success') {
        // Verify the gateway charged exactly the payment record's amount.
        const gatewayAmountPaisa = lookupResult.amount || 0;
        const expectedAmountPaisa = Math.round(Number(payment.amount) * 100);
        if (gatewayAmountPaisa !== expectedAmountPaisa) {
          await client.query(
            `UPDATE payments SET payment_status = 'failed', failure_reason = 'Amount mismatch', verified_at = NOW() WHERE id = $1`,
            [payment.id]
          );
          await client.query('COMMIT');
          return { status: 'failed', message: 'Amount mismatch' };
        }

        await client.query(
          `UPDATE payments SET payment_status = 'paid', provider_transaction_id = $1, verified_at = NOW(), raw_response = $2 WHERE id = $3`,
          [lookupResult.transaction_id || lookupResult.uid, JSON.stringify(lookupResult), payment.id]
        );
        const confirmedIds = await confirmBookings(
          client,
          'khalti',
          payment.batch_group_id,
          payment.booking_id,
          Number(payment.amount),
          Number(payment.total_price)
        );
        await client.query('COMMIT');
        await notifyPaymentOutcome('paid', (await loadPaymentForNotification(payment.id)) || payment, confirmedIds);
        return { status: 'success', payment, booking: { id: payment.booking_id }, confirmedBookingIds: confirmedIds };

      } else if (normalized === 'failed') {
        await client.query(
          `UPDATE payments SET payment_status = 'failed', failure_reason = $1, verified_at = NOW(), raw_response = $2 WHERE id = $3`,
          [lookupResult.status, JSON.stringify(lookupResult), payment.id]
        );
        await failBookings(client, `Payment ${lookupResult.status}`, payment.batch_group_id, payment.booking_id);
        await client.query('COMMIT');
        await notifyPaymentOutcome('failed', (await loadPaymentForNotification(payment.id)) || payment);
        return { status: 'failed', payment, booking: { id: payment.booking_id } };

      } else {
        await client.query('COMMIT');
        return { status: 'pending', payment, booking: { id: payment.booking_id } };
      }
    }

    // --- eSewa callback ---
    if (gateway === 'esewa') {
      const encodedResponse = callbackData.encodedResponse;
      if (!encodedResponse) {
        await client.query('ROLLBACK');
        return { status: 'failed', message: 'No encoded response in callback' };
      }

      const { verified, data, reason } = esewa.verifyCallback(encodedResponse);
      if (!verified) {
        await client.query('ROLLBACK');
        return { status: 'failed', message: `Verification failed: ${reason}` };
      }

      const transactionUuid = data.transaction_uuid;

      const paymentResult = await client.query(
        `SELECT p.*, b.total_price, b.booking_ref FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.provider_order_id = $1 ORDER BY p.created_at DESC LIMIT 1`,
        [transactionUuid]
      );
      if (!paymentResult.rows.length) {
        await client.query('ROLLBACK');
        return { status: 'failed', message: 'Payment not found for transaction' };
      }

      const payment = paymentResult.rows[0];
      if (payment.payment_status === 'paid') {
        await client.query('ROLLBACK');
        return { status: 'success', payment, booking: { id: payment.booking_id } };
      }
      if (payment.payment_status === 'failed') {
        await client.query('ROLLBACK');
        return { status: 'failed', payment, booking: { id: payment.booking_id } };
      }

      // Verify status is COMPLETE
      const esewaStatus = data.status;
      const normalized = esewa.normalizeStatus(esewaStatus);

      if (normalized === 'success') {
        // Verify the gateway charged exactly the payment record's amount.
        const gatewayAmount = Number(data.total_amount);
        const expectedAmount = Number(payment.amount);
        if (Math.abs(gatewayAmount - expectedAmount) > 0.01) {
          await client.query(
            `UPDATE payments SET payment_status = 'failed', failure_reason = 'Amount mismatch', verified_at = NOW() WHERE id = $1`,
            [payment.id]
          );
          await client.query('COMMIT');
          return { status: 'failed', message: 'Amount mismatch' };
        }

        await client.query(
          `UPDATE payments SET payment_status = 'paid', provider_transaction_id = $1, verified_at = NOW(), raw_response = $2 WHERE id = $3`,
          [data.ref_id || data.transaction_code, JSON.stringify(data), payment.id]
        );
        const confirmedIds = await confirmBookings(
          client,
          'esewa',
          payment.batch_group_id,
          payment.booking_id,
          Number(payment.amount),
          Number(payment.total_price)
        );
        await client.query('COMMIT');
        await notifyPaymentOutcome('paid', (await loadPaymentForNotification(payment.id)) || payment, confirmedIds);
        return { status: 'success', payment, booking: { id: payment.booking_id }, confirmedBookingIds: confirmedIds };

      } else if (normalized === 'failed') {
        await client.query(
          `UPDATE payments SET payment_status = 'failed', failure_reason = $1, verified_at = NOW(), raw_response = $2 WHERE id = $3`,
          [esewaStatus, JSON.stringify(data), payment.id]
        );
        await failBookings(client, `Payment ${esewaStatus}`, payment.batch_group_id, payment.booking_id);
        await client.query('COMMIT');
        await notifyPaymentOutcome('failed', (await loadPaymentForNotification(payment.id)) || payment);
        return { status: 'failed', payment, booking: { id: payment.booking_id } };

      } else {
        // PENDING or ambiguous — do status check
        try {
          const statusCheck = await esewa.checkStatus({
            transactionUuid,
            totalAmount: payment.amount,
          });
          const checkNormalized = esewa.normalizeStatus(statusCheck.status);

          if (checkNormalized === 'success') {
            await client.query(
              `UPDATE payments SET payment_status = 'paid', provider_transaction_id = $1, verified_at = NOW(), raw_response = $2 WHERE id = $3`,
              [statusCheck.ref_id, JSON.stringify(statusCheck), payment.id]
            );
            const confirmedIds = await confirmBookings(
              client,
              'esewa',
              payment.batch_group_id,
              payment.booking_id,
              Number(payment.amount),
              Number(payment.total_price)
            );
            await client.query('COMMIT');
            await notifyPaymentOutcome('paid', (await loadPaymentForNotification(payment.id)) || payment, confirmedIds);
            return { status: 'success', payment, booking: { id: payment.booking_id }, confirmedBookingIds: confirmedIds };
          }
        } catch (statusErr) {
          console.error('eSewa status check failed:', statusErr.message);
        }

        await client.query('COMMIT');
        return { status: 'pending', payment, booking: { id: payment.booking_id } };
      }
    }

    await client.query('ROLLBACK');
    return { status: 'failed', message: 'Unknown gateway' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Callback handling error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check payment status for a booking.
 */
async function getPaymentStatus(bookingId) {
  const result = await pool.query(
    `SELECT p.*, b.status as booking_status, b.total_price, b.payment_status as booking_payment_status,
            b.deposit_amount, b.deposit_paid, b.batch_group_id as booking_batch_group
     FROM payments p
     JOIN bookings b ON p.booking_id = b.id
     WHERE p.booking_id = $1
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [bookingId]
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    bookingId: row.booking_id,
    gateway: row.gateway,
    providerOrderId: row.provider_order_id,
    providerPidx: row.provider_pidx,
    providerTransactionId: row.provider_transaction_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.payment_status,
    verifiedAt: row.verified_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    bookingStatus: row.booking_status,
    batchGroupId: row.batch_group_id,
    bookingTotalPrice: parseFloat(row.total_price),
    bookingDepositAmount: parseFloat(row.deposit_amount),
    bookingDepositPaid: row.deposit_paid,
  };
}

module.exports = {
  createPayment,
  handleCallback,
  getPaymentStatus,
};