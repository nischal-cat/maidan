-- ============================================
-- MAIDAN MIGRATION 003: Walk-in / Phone Bookings
-- Allows owners & admins to create bookings on
-- behalf of customers (e.g. phone reservations)
-- Run: psql $DATABASE_URL -f migrations/003_walkin_bookings.sql
-- ============================================

-- ============================================
-- 1. BOOKINGS TABLE — walk-in support
-- ============================================

-- Walk-in / phone bookings may have no registered user account
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;

-- Where the booking came from: 'online' (default) or 'walk_in'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'online';

-- Owner/admin who created the booking on the customer's behalf
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Guest customer details (used when user_id is NULL)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(15);

CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(source);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_by ON bookings(booked_by_user_id);

COMMENT ON COLUMN bookings.source IS 'Booking channel: online (self-service) or walk_in (created by owner/admin for a caller)';
