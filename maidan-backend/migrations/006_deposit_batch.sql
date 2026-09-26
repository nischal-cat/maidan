-- ============================================
-- MAIDAN MIGRATION 006: Deposit + Batch Bookings
-- Single-slot bookings collect a 40% online deposit
-- (balance at venue). Multi-slot bookings pay 100%
-- online as one atomic batch payment.
--
-- NOTE: does NOT extend the payment_status enum (type is
-- owned by a superuser role, out of our grant).
-- 'partial' is represented by deposit_amount/deposit_paid.
-- Idempotent; safe to run multiple times.
-- Run: psql $DATABASE_URL -f migrations/006_deposit_batch.sql
-- ============================================

-- 1. bookings: deposit tracking + batch membership
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_refunded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS batch_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_bookings_batch_group ON bookings(batch_group_id);

-- 2. payments: batch membership for multi-slot online payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS batch_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_payments_batch_group ON payments(batch_group_id);

COMMENT ON COLUMN bookings.deposit_amount IS 'Online deposit collected upfront (40% of total for single-slot). Balance is due at venue.';
COMMENT ON COLUMN bookings.deposit_paid IS 'True once the online deposit has been verified by the gateway.';
COMMENT ON COLUMN bookings.deposit_refunded IS 'True when an admin refunds the deposit (free-cancellation refund).';
COMMENT ON COLUMN bookings.batch_group_id IS 'Shared by bookings created/paid together in one multi-slot online payment.';
COMMENT ON COLUMN payments.batch_group_id IS 'Set when one gateway payment confirms multiple bookings (multi-slot).';