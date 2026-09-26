-- 008_notifications.sql
-- In-app notification inbox shared by every role (player, owner, admin, subadmin).
--
-- One row per event the user should see in their bell. `link` is a client-side
-- route (e.g. '/bookings/<id>') so the frontend can deep-link from the bell.
-- `dedupe_key` makes the reminder job idempotent: the 24h/2h reminder sweep can
-- re-run as often as we like without double-notifying, thanks to the unique
-- index below. One-off event notifications leave it NULL (NULLs never collide
-- in a unique index, so every event still inserts).

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

COMMENT ON TABLE notifications IS 'In-app notification inbox for all roles. Rows cascade-delete with the user or the related booking.';
