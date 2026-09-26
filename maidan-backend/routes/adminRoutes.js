const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole, requireApprovedSeller } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, groundSchema, staffCreateSchema, staffUpdateSchema } = require('../middleware/validation');
const groundController = require('../controllers/groundController');
const { getDashboardStats, adminCancelBooking, getAllBookings, getBookingById, getAllUsers } = require('../controllers/bookingController');
const { listSellers, getSellerById, reviewKyc } = require('../controllers/kycController');
const staffController = require('../controllers/staffController');
const { generateSlotsForGround } = require('../services/slotGenerator');
const citiesController = require('../controllers/citiesController');

router.use(authenticate, requireRole('owner', 'admin', 'subadmin'));

// Staff (sub-admin) management is strictly admin-only.
router.use('/staff', requireRole('admin'));
router.get('/staff', staffController.listStaff);
router.post('/staff', validate(staffCreateSchema), staffController.createStaff);
router.patch('/staff/:id', validate(staffUpdateSchema), staffController.updateStaff);
router.delete('/staff/:id', staffController.deleteStaff);

// City management is strictly admin-only.
router.use('/cities', requireRole('admin'));
router.post('/cities', citiesController.createCity);
router.patch('/cities/:id', citiesController.updateCity);

// Ground photo upload (local disk storage).
const GROUND_PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'grounds');
fs.mkdirSync(GROUND_PHOTO_DIR, { recursive: true });
const groundPhotosUpload = multer({
  storage: multer.diskStorage({
    destination: GROUND_PHOTO_DIR,
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed (5 MB max each).'), ok);
  },
});

// KYC review: admin (always) or sub-admin granted the 'sellers' permission.
// Ground owners are intentionally excluded — seller/KYC administration is a
// platform function, not a per-owner resource.
router.use('/sellers', requireRole('admin', 'subadmin'), requirePermission('sellers'));
router.get('/sellers', listSellers);
router.get('/sellers/:id', getSellerById);
router.patch('/sellers/:id/kyc', reviewKyc);

router.get('/dashboard', getDashboardStats);

// User management is view-only for sub-admins granted 'users'. Ground owners
// are excluded — the global user directory is platform-level data.
router.use('/users', requireRole('admin', 'subadmin'), requirePermission('users'));
router.get('/users', getAllUsers);

router.get('/reports', requirePermission('reports'), async (req, res) => {
  const { startDate, endDate, groundId } = req.query;

  try {
    let query = `
      SELECT
        b.booking_date as date,
        COUNT(*) as count,
        COALESCE(SUM(b.total_price), 0) as revenue,
        COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'confirmed'), 0) as net_revenue
      FROM bookings b
      JOIN grounds g ON b.ground_id = g.id
      WHERE b.status IN ('confirmed', 'completed', 'late_cancelled')
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND b.booking_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND b.booking_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    if (groundId) {
      query += ` AND b.ground_id = $${paramIndex}`;
      params.push(groundId);
      paramIndex++;
    }
    if (req.user.role === 'owner') {
      query += ` AND g.owner_id = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    }

    query += ' GROUP BY b.booking_date ORDER BY b.booking_date DESC';

    const result = await pool.query(query, params);

    const totalRevenue = result.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0);
    const totalBookings = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

    res.json({
      totalRevenue,
      totalBookings,
      bookingsPerDay: result.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count),
        revenue: parseFloat(row.revenue),
      })),
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ message: 'Failed to fetch reports.' });
  }
});

router.use('/grounds', requirePermission('grounds'));
router.get('/bookings', requirePermission('bookings'), getAllBookings);
router.get('/bookings/:id', requirePermission('bookings'), getBookingById);

router.post('/grounds', requireApprovedSeller, validate(groundSchema), groundController.create);
router.put('/grounds/:id', requireApprovedSeller, validate(groundSchema.partial()), groundController.update);
router.delete('/grounds/:id', requireApprovedSeller, groundController.delete);

router.post('/grounds/upload', (req, res, next) => {
  groundPhotosUpload.array('photos', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ message: 'No image files were received. Upload JPG, PNG or WEBP images (5 MB max each).' });
  }
  res.json({ urls: files.map((f) => `/uploads/grounds/${f.filename}`) });
});

router.post('/grounds/:id/slots/generate', requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  const { startDate, days = 7 } = req.body;

  try {
    const groundCheck = await pool.query('SELECT id, owner_id FROM grounds WHERE id = $1', [id]);
    if (!groundCheck.rows.length) {
      return res.status(404).json({ message: 'Ground not found.' });
    }
    if (groundCheck.rows[0].owner_id !== req.user.id && !['admin', 'subadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only manage your own grounds.' });
    }

    const start = startDate || new Date().toISOString().split('T')[0];
    const numDays = Math.min(Math.max(parseInt(days) || 7, 1), 90);

    const { generated, skipped } = await generateSlotsForGround(id, start, numDays);

    res.json({
      message: `Generated ${generated} new slots (${skipped} already existed).`,
      generated,
      skipped,
      startDate: start,
      days: numDays,
    });
  } catch (error) {
    console.error('Generate slots error:', error);
    res.status(500).json({ message: 'Failed to generate slots.' });
  }
});

router.patch('/bookings/:id/cancel', requirePermission('bookings'), adminCancelBooking);

module.exports = router;
