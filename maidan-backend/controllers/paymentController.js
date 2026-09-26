const { pool } = require('../db');
const paymentService = require('../services/paymentService');

/**
 * POST /api/payments/initiate
 * Creates a payment and returns gateway-specific redirect data.
 * For Khalti: { redirectUrl, paymentId }
 * For eSewa: { formUrl, formFields, paymentId }
 */
exports.initiatePayment = async (req, res) => {
  const { bookingId, batchGroupId, gateway = 'esewa' } = req.body;
  const userId = req.user.id;

  try {
    // Multi-slot: one gateway payment covering the whole batch.
    if (batchGroupId) {
      const batchResult = await pool.query(
        `SELECT b.*, g.name as ground_name
         FROM bookings b
         JOIN grounds g ON b.ground_id = g.id
         WHERE b.batch_group_id = $1 AND b.user_id = $2 AND b.status = 'pending'`,
        [batchGroupId, userId]
      );

      if (!batchResult.rows.length) {
        return res.status(404).json({ message: 'Pending batch booking not found.' });
      }

      const expired = batchResult.rows.some(
        (b) => b.payment_deadline && new Date(b.payment_deadline) < new Date()
      );
      if (expired) {
        return res.status(400).json({ message: 'Payment deadline expired. Please book again.' });
      }

      const first = batchResult.rows[0];
      const total = batchResult.rows.reduce((sum, b) => sum + Number(b.total_price), 0);

      const result = await paymentService.createPayment(
        first,
        req.user,
        gateway,
        { amountOverride: total, batchGroupId }
      );

      return res.json({
        ...result,
        bookingRef: first.booking_ref,
        batchGroupId,
        totalPrice: total,
        depositOnly: false,
      });
    }

    const bookingResult = await pool.query(
      `SELECT b.*, g.name as ground_name
       FROM bookings b
       JOIN grounds g ON b.ground_id = g.id
       WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'pending'`,
      [bookingId, userId]
    );

    if (!bookingResult.rows.length) {
      return res.status(404).json({ message: 'Pending booking not found.' });
    }

    const booking = bookingResult.rows[0];

    if (booking.payment_deadline && new Date(booking.payment_deadline) < new Date()) {
      return res.status(400).json({ message: 'Payment deadline expired. Please book again.' });
    }

    // Single-slot: collect the 40% deposit online; balance is due at the venue.
    const totalPrice = Number(booking.total_price);
    const depositAmount = Number(booking.deposit_amount);
    const depositOnly = depositAmount > 0 && depositAmount < totalPrice;
    const amountOverride = depositOnly ? depositAmount : totalPrice;

    const result = await paymentService.createPayment(
      booking,
      req.user,
      gateway,
      { amountOverride }
    );

    res.json({
      ...result,
      bookingRef: booking.booking_ref,
      totalPrice,
      depositAmount,
      depositOnly,
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ message: 'Failed to initiate payment. Please try again.' });
  }
};

/**
 * GET /api/payments/khalti/return
 * Khalti redirects here after payment.
 */
exports.khaltiReturn = async (req, res) => {
  const { pidx } = req.query;

  try {
    const result = await paymentService.handleCallback('khalti', { pidx });
    const frontendUrl = process.env.APP_BASE_URL?.replace(':5000', ':5173') || 'http://localhost:5173';

    if (result.status === 'success') {
      res.redirect(`${frontendUrl}/payment/success?bookingId=${result.booking.id}`);
    } else if (result.status === 'failed') {
      res.redirect(`${frontendUrl}/payment/failed?bookingId=${result.booking.id}`);
    } else {
      res.redirect(`${frontendUrl}/payment/pending?bookingId=${result.booking.id}`);
    }
  } catch (error) {
    console.error('Khalti return error:', error);
    const frontendUrl = process.env.APP_BASE_URL?.replace(':5000', ':5173') || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/payment/failed?error=verification_failed`);
  }
};

/**
 * GET /api/payments/esewa/success
 * eSewa redirects here after successful payment with Base64-encoded response.
 */
exports.esewaSuccess = async (req, res) => {
  const { encodedResponse } = req.query;

  try {
    const result = await paymentService.handleCallback('esewa', { encodedResponse });
    const frontendUrl = process.env.APP_BASE_URL?.replace(':5000', ':5173') || 'http://localhost:5173';

    if (result.status === 'success') {
      res.redirect(`${frontendUrl}/payment/success?bookingId=${result.booking.id}`);
    } else if (result.status === 'failed') {
      res.redirect(`${frontendUrl}/payment/failed?bookingId=${result.booking.id}`);
    } else {
      res.redirect(`${frontendUrl}/payment/pending?bookingId=${result.booking.id}`);
    }
  } catch (error) {
    console.error('eSewa success callback error:', error);
    const frontendUrl = process.env.APP_BASE_URL?.replace(':5000', ':5173') || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/payment/failed?error=verification_failed`);
  }
};

/**
 * GET /api/payments/esewa/failure
 * eSewa redirects here after failed/cancelled payment.
 */
exports.esewaFailure = async (req, res) => {
  const frontendUrl = process.env.APP_BASE_URL?.replace(':5000', ':5173') || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/payment/failed?error=payment_failed`);
};

/**
 * GET /api/payments/status/:bookingId
 * Check the current payment status for a booking.
 */
exports.getPaymentStatus = async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user.id;

  try {
    const bookingCheck = await pool.query(
      `SELECT id FROM bookings WHERE id = $1 AND user_id = $2`,
      [bookingId, userId]
    );

    if (!bookingCheck.rows.length) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const payment = await paymentService.getPaymentStatus(bookingId);

    if (!payment) {
      return res.json({ payment: null, message: 'No payment initiated yet.' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: 'Failed to get payment status.' });
  }
};
