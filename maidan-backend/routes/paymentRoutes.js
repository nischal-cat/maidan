const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  khaltiReturn,
  esewaSuccess,
  esewaFailure,
  getPaymentStatus,
} = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// Initiate payment — user clicks "Pay with eSewa" or "Pay with Khalti"
router.post('/initiate', authenticate, initiatePayment);

// Khalti callback — GET redirect after payment
router.get('/khalti/return', khaltiReturn);

// eSewa callbacks — GET redirect after payment
router.get('/esewa/success', esewaSuccess);
router.get('/esewa/failure', esewaFailure);

// Check payment status for a booking
router.get('/status/:bookingId', authenticate, getPaymentStatus);

module.exports = router;
