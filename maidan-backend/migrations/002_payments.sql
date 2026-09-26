-- ============================================
-- MAIDAN MIGRATION 002: Payment Gateway Support
-- Adds payments table, slot holds, pending bookings
-- Run: psql $DATABASE_URL -f migrations/002_payments.sql
-- ============================================

-- ============================================
-- 1. UPDATE ENUMS
-- ============================================

-- Add 'held' to slot_status
DO $$ BEGIN
  ALTER TYPE slot_status ADD VALUE IF NOT EXISTS 'held';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'pending' to booking_status
DO $$ BEGIN
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'pending' to payment_status
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. UPDATE SLOTS TABLE — hold support
-- ============================================

ALTER TABLE slots ADD COLUMN IF NOT EXISTS held_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE slots ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

-- ============================================
-- 3. CREATE PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    gateway VARCHAR(20) NOT NULL,                    -- 'khalti', 'esewa'
    provider_order_id VARCHAR(100),                  -- our order ID sent to gateway
    provider_pidx VARCHAR(100),                      -- Khalti pidx
    provider_transaction_id VARCHAR(100),            -- gateway transaction ID
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'NPR',
    payment_status payment_status DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    failure_reason TEXT,
    raw_response JSONB,                              -- redacted gateway response for audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id)
    WHERE provider_order_id IS NOT NULL;

COMMENT ON TABLE payments IS 'Payment attempts linked to bookings - one per gateway initiation';

-- Add updated_at trigger for payments
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. UPDATE BOOKINGS TABLE — payment_deadline
-- ============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- ============================================
-- 5. CLEANUP FUNCTION — release expired holds
-- ============================================

CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS void AS $$
BEGIN
  -- Release slots where hold has expired
  UPDATE slots
  SET status = 'available', held_by_user_id = NULL, hold_expires_at = NULL
  WHERE status = 'held' AND hold_expires_at < NOW();

  -- Cancel bookings that are pending and past their payment deadline
  UPDATE bookings
  SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Payment deadline expired'
  WHERE status = 'pending'
    AND payment_deadline IS NOT NULL
    AND payment_deadline < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_expired_holds IS 'Call periodically or before booking attempts to clean up expired holds and unpaid bookings';
