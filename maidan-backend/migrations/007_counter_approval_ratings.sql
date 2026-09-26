-- ============================================
-- MAIDAN MIGRATION 007: Pay-at-Counter approval + Ground ratings
-- 1) Bookings get a requires_approval flag so "pay at counter"
--    bookings wait for the ground owner to accept or reject.
--    Status stays 'pending' (the booking_status enum is owned by a
--    superuser role, out of our grant) — we distinguish via
--    payment_method='counter' + requires_approval=TRUE. The booking's
--    payment_deadline doubles as the approval deadline (min(now+24h,
--    slot start)), so release_expired_holds() auto-cancels a request
--    the owner never answered and releases the slot.
-- 2) New ground_ratings table so players can rate grounds after
--    playing; grounds.rating is recomputed as the AVG on each submit.
-- Idempotent; safe to run multiple times.
-- Run: node db/run-migration.js migrations/007_counter_approval_ratings.sql
-- ============================================

-- 1. bookings: mark counter bookings awaiting owner approval
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN bookings.requires_approval IS
  'TRUE when a "pay at counter" booking is waiting for the ground owner to accept or reject it.';

-- 2. ground ratings
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ground_ratings_updated_at') THEN
    CREATE TRIGGER trg_ground_ratings_updated_at
      BEFORE UPDATE ON ground_ratings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

COMMENT ON TABLE ground_ratings IS
  'Player ratings (1-5) per ground, one per user. grounds.rating is the running average.';