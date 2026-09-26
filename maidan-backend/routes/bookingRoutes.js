const express = require('express');
const router = express.Router();
const {
  createBooking,
  createBatchBooking,
  createWalkInBooking,
  getMyBookings,
  getMyBookingById,
  getActiveCount,
  cancelBooking,
  getAllBookings,
  adminCancelBooking,
  approveBooking,
  markPaid,
  adminRefundDeposit,
  getDashboardStats,
} = require('../controllers/bookingController');
const { authenticate, requireVerified, requireRole, requireApprovedSeller } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, bookingSchema, batchBookingSchema, walkInBookingSchema } = require('../middleware/validation');

router.post('/', authenticate, requireVerified, validate(bookingSchema), createBooking);
router.post('/batch', authenticate, requireVerified, validate(batchBookingSchema), createBatchBooking);
router.post('/walk-in', authenticate, requireRole('owner', 'admin', 'subadmin'), requireApprovedSeller, requirePermission('bookings'), validate(walkInBookingSchema), createWalkInBooking);
router.get('/', authenticate, getMyBookings);
router.get('/active-count', authenticate, getActiveCount);
router.get('/admin', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), getAllBookings);
router.get('/dashboard/stats', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), getDashboardStats);
// '/:id' must stay AFTER every literal GET path above. Express matches in
// registration order, so registering it first would capture 'active-count' or
// 'admin' as an id and those endpoints would 404.
router.get('/:id', authenticate, getMyBookingById);
router.patch('/:id/cancel', authenticate, cancelBooking);
router.patch('/:id/admin-cancel', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), adminCancelBooking);
router.patch('/:id/approve', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), approveBooking);
router.patch('/:id/mark-paid', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), markPaid);
router.patch('/:id/refund-deposit', authenticate, requireRole('owner', 'admin', 'subadmin'), requirePermission('bookings'), adminRefundDeposit);

module.exports = router;
