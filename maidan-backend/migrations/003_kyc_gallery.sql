-- 003: Seller KYC + ground photo gallery
-- Idempotent; safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_document_url TEXT,
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS kyc_note TEXT,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ;

-- kyc_status values: 'none' (players) | 'pending' | 'approved' | 'declined'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_kyc_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
      CHECK (kyc_status IN ('none', 'pending', 'approved', 'declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status) WHERE role = 'owner';

ALTER TABLE grounds
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]';
