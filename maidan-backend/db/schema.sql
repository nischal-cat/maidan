-- ============================================
-- MAIDAN DATABASE SCHEMA v2.0 (Production)
-- Multi-Sport Facility Booking System
-- For fresh DB: node db/setup.js
-- For existing DB: psql $DATABASE_URL -f migrations/001_maidan_v2.sql
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN CREATE TYPE role_enum AS ENUM ('player', 'owner', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'late_cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('unpaid', 'pending', 'paid', 'refunded', 'partial_refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE slot_status AS ENUM ('available', 'held', 'booked', 'maintenance', 'blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sport_type AS ENUM ('futsal', 'cricket', 'badminton', 'tennis', 'football'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role role_enum DEFAULT 'player',
    is_phone_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires TIMESTAMPTZ,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
COMMENT ON TABLE users IS 'All system users: players, ground owners, and admins';

-- 2. Grounds Table
CREATE TABLE IF NOT EXISTS grounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL DEFAULT 'Kathmandu',
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    contact VARCHAR(15),
    sport_type sport_type DEFAULT 'futsal',
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
    peak_price DECIMAL(10,2) CHECK (peak_price >= 0),
    operating_start TIME DEFAULT '06:00:00',
    operating_end TIME DEFAULT '22:00:00',
    description TEXT,
    image_url TEXT,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grounds_owner_id ON grounds(owner_id);
CREATE INDEX IF NOT EXISTS idx_grounds_city_active ON grounds(city) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_grounds_sport_type ON grounds(sport_type);
COMMENT ON TABLE grounds IS 'Bookable facilities - futsal courts, cricket nets, badminton halls';

-- Cities Table (admin-managed location list)
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
COMMENT ON TABLE cities IS 'Supported cities shown across filters and ground/host forms';

-- 3. Slots Table (NEW)
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
    held_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_slot UNIQUE (ground_id, slot_date, start_time),
    CONSTRAINT valid_slot_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_ground_date ON slots(ground_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_available ON slots(ground_id, slot_date)
    WHERE status = 'available' AND is_blocked = FALSE;
COMMENT ON TABLE slots IS 'Pre-generated hourly time slots per ground per date';

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ground_id UUID NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
    players_count INTEGER DEFAULT 1 CHECK (players_count > 0),
    special_requests TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'online',
    booked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(15),
    status booking_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'unpaid',
    payment_method VARCHAR(30),
    booking_ref VARCHAR(20) UNIQUE NOT NULL,
    payment_deadline TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    is_late_cancellation BOOLEAN DEFAULT FALSE,
    late_cancellation_fee DECIMAL(10,2) DEFAULT 0,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_booking_slot UNIQUE (ground_id, booking_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ground_date ON bookings(ground_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(source);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_by ON bookings(booked_by_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_active ON bookings(user_id, status, booking_date)
    WHERE status = 'confirmed';
COMMENT ON TABLE bookings IS 'All reservations - double-booking prevented by unique_booking_slot';

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    gateway VARCHAR(20) NOT NULL,
    provider_order_id VARCHAR(100),
    provider_pidx VARCHAR(100),
    provider_transaction_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'NPR',
    payment_status payment_status DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    failure_reason TEXT,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id)
    WHERE provider_order_id IS NOT NULL;
COMMENT ON TABLE payments IS 'Payment attempts linked to bookings - one per gateway initiation';

-- 5b. Ground Ratings Table (player ratings, one per user per ground)
CREATE TABLE IF NOT EXISTS ground_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ground_id UUID NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_ground_user_rating UNIQUE (ground_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ground_ratings_ground ON ground_ratings(ground_id);
CREATE INDEX IF NOT EXISTS idx_ground_ratings_user ON ground_ratings(user_id);
COMMENT ON TABLE ground_ratings IS 'Player ratings (1-5) per ground, one per user. grounds.rating is the running average.';

-- 6. Updated_at Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_grounds_updated_at BEFORE UPDATE ON grounds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ground_ratings_updated_at BEFORE UPDATE ON ground_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Cleanup Function — release expired holds
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS void AS $$
BEGIN
  UPDATE slots
  SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
  WHERE status = 'held' AND hold_expires_at < NOW();

  UPDATE bookings
  SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Payment deadline expired'
  WHERE status = 'pending'
    AND payment_deadline IS NOT NULL
    AND payment_deadline < NOW();
END;
$$ LANGUAGE plpgsql;
