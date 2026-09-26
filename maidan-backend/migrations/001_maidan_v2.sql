-- ============================================
-- MAIDAN DATABASE SCHEMA v2.0 (Production)
-- Multi-Sport Facility Booking System
-- Run: psql $DATABASE_URL -f migrations/001_maidan_v2.sql
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS (safe to re-run)
DO $$ BEGIN
  CREATE TYPE role_enum AS ENUM ('player', 'owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed', 'late_cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'partial_refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE slot_status AS ENUM ('available', 'booked', 'maintenance', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sport_type AS ENUM ('futsal', 'cricket', 'badminton', 'tennis', 'football');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 1. MIGRATE USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Convert TIMESTAMP to TIMESTAMPTZ
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN verification_code_expires TYPE TIMESTAMPTZ USING verification_code_expires AT TIME ZONE 'UTC';

-- Fix role column to use ENUM (safe migration)
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(30);  -- temporarily widen
UPDATE users SET role = 'player' WHERE role NOT IN ('player', 'owner', 'admin');
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE role_enum USING role::role_enum;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'player'::role_enum;

-- Drop old CHECK constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Index for case-insensitive email uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

COMMENT ON TABLE users IS 'All system users: players, ground owners, and admins';

-- ============================================
-- 2. MIGRATE GROUNDS TABLE
-- ============================================
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS sport_type sport_type DEFAULT 'futsal';
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS peak_price DECIMAL(10,2);
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6);
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Convert timestamps
ALTER TABLE grounds ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Fix rating constraint
ALTER TABLE grounds DROP CONSTRAINT IF EXISTS grounds_rating_check;
ALTER TABLE grounds ADD CONSTRAINT grounds_rating_check CHECK (rating >= 0 AND rating <= 5);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grounds_owner ON grounds(owner_id);
CREATE INDEX IF NOT EXISTS idx_grounds_city_active ON grounds(city) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_grounds_sport_type ON grounds(sport_type);

COMMENT ON TABLE grounds IS 'Bookable facilities - futsal courts, cricket nets, badminton halls, etc.';

-- ============================================
-- 3. CREATE SLOTS TABLE (NEW - CRITICAL)
-- ============================================
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ground_id UUID NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status slot_status DEFAULT 'available',
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_slot UNIQUE (ground_id, slot_date, start_time),
    CONSTRAINT valid_slot_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_ground_date ON slots(ground_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_available ON slots(ground_id, slot_date)
    WHERE status = 'available' AND is_blocked = FALSE;

COMMENT ON TABLE slots IS 'Pre-generated hourly time slots per ground per date';

-- ============================================
-- 4. MIGRATE BOOKINGS TABLE
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES slots(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'unpaid';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref VARCHAR(20) UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Generate booking_ref for existing rows
UPDATE bookings SET booking_ref = 'MN-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8))
WHERE booking_ref IS NULL;

-- Make booking_ref NOT NULL after backfill
ALTER TABLE bookings ALTER COLUMN booking_ref SET NOT NULL;

-- Convert timestamps
ALTER TABLE bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bookings ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'UTC';

-- Migrate status column to ENUM
ALTER TABLE bookings ALTER COLUMN status TYPE VARCHAR(30);
UPDATE bookings SET status = 'confirmed' WHERE status NOT IN ('confirmed', 'cancelled', 'completed', 'late_cancelled');
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING status::booking_status;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'confirmed'::booking_status;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ground_date ON bookings(ground_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_active ON bookings(user_id, status, booking_date)
    WHERE status = 'confirmed';

COMMENT ON TABLE bookings IS 'All reservations - double-booking prevented by unique_booking_slot constraint';

-- ============================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_grounds_updated_at ON grounds;
CREATE TRIGGER trg_grounds_updated_at
    BEFORE UPDATE ON grounds FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
