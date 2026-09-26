-- ============================================
-- MAIDAN MIGRATION 004: External login identities
-- Adds Google/Firebase-first accounts (no local
-- password, no phone) and links external logins
-- (verified via Firebase Authentication) to local
-- user accounts.
-- Run: psql $DATABASE_URL -f migrations/004_auth_google.sql
-- ============================================

-- ============================================
-- 1. USERS TABLE — Google-first accounts
-- ============================================

-- Email/password users keep their credentials; Google-only users skip both
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- When the email was verified by an external IdP (Google) or local OTP
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN users.email_verified_at IS 'Set when identity provider confirms email ownership';

-- ============================================
-- 2. CREATE AUTH IDENTITIES TABLE
-- ============================================

-- One row per external identity (provider + subject), linked to a local user
CREATE TABLE IF NOT EXISTS auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,                    -- 'google'
    provider_sub VARCHAR(255),                        -- idp subject id (Google 'sub')
    provider_email VARCHAR(255),                      -- idp email at link time
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    name VARCHAR(100),                                -- idp display name
    picture_url TEXT,                                 -- idp avatar
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_sub UNIQUE (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);

-- Add updated_at trigger for auth_identities
CREATE TRIGGER trg_auth_identities_updated_at BEFORE UPDATE ON auth_identities
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE auth_identities IS 'External login identities (Google) linked to local user accounts';