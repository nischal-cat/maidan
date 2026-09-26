const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { pool } = require('./db');
const authRoutes = require('./routes/authRoutes');
const groundRoutes = require('./routes/groundRoutes');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const citiesRoutes = require('./routes/citiesRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startReminderJob } = require('./services/reminderService');

const app = express();
const PORT = process.env.PORT || 5000;

// KYC document uploads (local disk storage)
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'kyc');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Idempotent schema ensure for columns added after the base migrations.
async function ensureSchema() {
  // Extend the role enum so sub-admin accounts are allowed (best-effort; the
  // users.role column may already be plain text, in which case this is a no-op).
  try {
    const enumResult = await pool.query(
      `SELECT enumlabel FROM pg_enum pe
       JOIN pg_type pt ON pe.enumtypid = pt.oid WHERE pt.typname = 'role_enum'`
    );
    if (!enumResult.rows.some((r) => r.enumlabel === 'subadmin')) {
      await pool.query(`ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'subadmin'`);
      console.log('[schema] role_enum extended with subadmin');
    }
  } catch (error) {
    console.warn('[schema] Could not extend role_enum (non-fatal):', error.message);
  }

  const ddl = `
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS kyc_document_url TEXT,
      ADD COLUMN IF NOT EXISTS business_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS kyc_note TEXT,
      ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS permissions JSONB;
    ALTER TABLE grounds
      ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'online',
      ADD COLUMN IF NOT EXISTS booked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(15);
    CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(source);
    CREATE INDEX IF NOT EXISTS idx_bookings_booked_by ON bookings(booked_by_user_id);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_kyc_status_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
          CHECK (kyc_status IN ('none', 'pending', 'approved', 'declined'));
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status) WHERE role = 'owner';
    CREATE TABLE IF NOT EXISTS cities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(50) UNIQUE NOT NULL,
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO cities (name, latitude, longitude) VALUES
      ('Kathmandu', 27.7172, 85.3240),
      ('Lalitpur', 27.6588, 85.3247),
      ('Bhaktapur', 27.6710, 85.4298),
      ('Pokhara', 28.2096, 83.9856),
      ('Chitwan', 27.5291, 84.3542),
      ('Biratnagar', 26.4525, 87.2718),
      ('Dharan', 26.8121, 87.2840),
      ('Itahari', 26.6638, 87.2750),
      ('Janakpur', 26.7289, 85.9250),
      ('Butwal', 27.6901, 83.4551),
      ('Nepalgunj', 28.0537, 81.6195),
      ('Birgunj', 27.0056, 84.8758),
      ('Hetauda', 27.4312, 85.0386),
      ('Dhangadhi', 28.7051, 80.5958)
    ON CONFLICT (name) DO NOTHING;
    CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active) WHERE is_active = TRUE;

    -- In-app notification inbox for all roles (migrations/008_notifications.sql).
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(40) NOT NULL,
      title VARCHAR(160) NOT NULL,
      body TEXT,
      link VARCHAR(200),
      booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      dedupe_key VARCHAR(120),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
      ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
      ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
  `;
  await pool.query(ddl);
}

app.use(helmet());
app.use(cors());
app.use(express.json());

// Behind Cloudflare the real visitor IP arrives in CF-Connecting-IP and in
// X-Forwarded-For. Without this, req.ip is the loopback address, so every
// visitor shares one rate-limit bucket. It is also required by
// express-rate-limit v7, which throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR when
// X-Forwarded-For is present but trust proxy is false. A hop count of 1 (not
// `true`) keeps the setting from being fully permissive.
app.set('trust proxy', 1);

// Prefer Cloudflare's CF-Connecting-IP: the edge overwrites it on every
// request, so a visitor cannot spoof it. Falls back to req.ip for local runs.
const clientKey = (req) => req.headers['cf-connecting-ip'] || req.ip || 'unknown';
// Key an OTP-send bucket by client AND the destination being messaged, so one
// visitor cannot burn the allowance for a phone number they do not own.
const otpSendKey = (req) => `${clientKey(req)}:${req.body?.phone || req.body?.email || 'na'}`;

const limiterDefaults = {
  standardHeaders: true,
  legacyHeaders: false,
};
// Keep tests unthrottled; real limits only apply outside the test env.
const cap = (n) => (process.env.NODE_ENV === 'test' ? 100000 : n);
const tooMany = (message) => ({ status: 429, message });

// Login counts only FAILED attempts, so a user who mistypes twice is never
// locked out of their own account.
const loginLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: cap(10),
  skipSuccessfulRequests: true,
  keyGenerator: clientKey,
  handler: (_req, res) => res.status(429).json(tooMany('Too many failed sign-in attempts. Please try again in 15 minutes.')),
});

const registerLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 60 * 1000,
  max: cap(5),
  keyGenerator: clientKey,
  handler: (_req, res) => res.status(429).json(tooMany('Too many accounts created from this device. Please try again later.')),
});

// Sending an OTP: bounded per client AND per destination (SMS cost / harassment).
const otpSendLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: cap(3),
  keyGenerator: otpSendKey,
  handler: (_req, res) => res.status(429).json(tooMany('Too many codes requested. Please try again in 15 minutes.')),
});

// Confirming a 6-digit code: this is the brute-force surface, so it is capped
// per client and per issued code.
const otpVerifyLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: cap(5),
  keyGenerator: clientKey,
  handler: (_req, res) => res.status(429).json(tooMany('Too many code attempts. Please request a new code.')),
});

const bookingWriteLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max: cap(15),
  keyGenerator: clientKey,
  handler: (_req, res) => res.status(429).json(tooMany('Too many booking requests. Please slow down.')),
});

// Exact paths via app.post, not app.use: app.use() matches by prefix, so
// /verify-phone and /verify-phone/confirm would both apply their limiter to
// the same request and the stricter cap would win. All of these are POST-only.
app.post('/api/auth/login', loginLimiter);
app.post('/api/auth/register', registerLimiter);
app.post('/api/auth/verify-phone', otpSendLimiter);
app.post('/api/auth/verify-phone/confirm', otpVerifyLimiter);
app.post('/api/auth/resend-otp', otpSendLimiter);
app.post('/api/auth/forgot-password', otpSendLimiter);
app.post('/api/auth/reset-password', otpVerifyLimiter);
app.post('/api/auth/firebase/google', loginLimiter);
// Mutations only: reading booking history must not consume a write allowance.
app.use('/api/bookings', (req, res, next) =>
  req.method === 'GET' ? next() : bookingWriteLimiter(req, res, next)
);

app.use('/api/auth', authRoutes);
app.use('/api/grounds', slotRoutes); // mounted first so /available-today and /:id/slots are not shadowed by /:id
app.use('/api/grounds', groundRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, async () => {
    try {
      await ensureSchema();
      console.log('Schema ensure: OK');
    } catch (err) {
      console.error('Schema ensure skipped (run ALTER TABLE OWNER as postgres, then restart):', err.message);
    }
    // Kick-off reminders (24h / 2h before a confirmed slot).
    startReminderJob();
    console.log(`Maidan backend running on port ${PORT}`);
  });
}

module.exports = app;
