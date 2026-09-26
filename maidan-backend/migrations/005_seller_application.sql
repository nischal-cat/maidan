-- ============================================
-- MAIDAN MIGRATION 005: Seller Application Fields
-- Richer Ground Owner application so we can review
-- business details before approving the account.
-- Idempotent; safe to run multiple times.
-- Run: psql $DATABASE_URL -f migrations/005_seller_application.sql
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_type JSONB,
  ADD COLUMN IF NOT EXISTS business_city VARCHAR(50),
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_contact VARCHAR(15),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS business_description TEXT;

COMMENT ON COLUMN users.business_type IS 'Array of sports this business runs (e.g. ["Futsal","Cricket"])';
COMMENT ON COLUMN users.business_city IS 'Seller business city';
COMMENT ON COLUMN users.business_address IS 'Seller business street address';
COMMENT ON COLUMN users.business_contact IS 'Seller business phone contact';
COMMENT ON COLUMN users.registration_number IS 'Optional business registration / VAT / PAN number';
COMMENT ON COLUMN users.business_description IS 'Short seller application notes';