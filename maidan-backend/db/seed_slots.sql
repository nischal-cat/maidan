-- ============================================
-- SEED DATA: Demo Users + 7 Days of Slots for active grounds
-- Grounds are created by owners/admins via the app, never seeded here.
-- OPTIONAL: Run AFTER schema is set up
-- psql $DATABASE_URL -f db/seed_slots.sql
-- ============================================

-- Create admin user (password: admin123)
INSERT INTO users (name, email, phone, password_hash, role, is_phone_verified)
VALUES (
    'Maidan Admin',
    'admin@maidan.com.np',
    '9800000000',
    '$2b$10$rQEY5z1gGz0k5Lz1qGz1qOeXKz0k5Lz1qGz1qOeXKz0k5Lz1qGz1q',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Create ground owner (password: owner123)
INSERT INTO users (name, email, phone, password_hash, role, is_phone_verified)
VALUES (
    'Ground Owner',
    'owner@maidan.com.np',
    '9800000001',
    '$2b$10$rQEY5z1gGz0k5Lz1qGz1qOeXKz0k5Lz1qGz1qOeXKz0k5Lz1qGz1q',
    'owner',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Generate 7 days of hourly slots for ALL active grounds
INSERT INTO slots (ground_id, slot_date, start_time, end_time, status, price)
SELECT
    g.id,
    d.slot_date,
    make_time(h, 0, 0)                          AS start_time,
    make_time(h + 1, 0, 0)                      AS end_time,
    'available'::slot_status                     AS status,
    CASE
        WHEN make_time(h, 0, 0) BETWEEN '17:00'::TIME AND '20:00'::TIME
        THEN COALESCE(g.peak_price, g.base_price * 1.3)
        ELSE g.base_price
    END                                          AS price
FROM grounds g
CROSS JOIN generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '6 days',
    INTERVAL '1 day'
) AS d(slot_date)
CROSS JOIN generate_series(6, 20) AS h(h)
WHERE g.is_active = TRUE
ON CONFLICT (ground_id, slot_date, start_time) DO NOTHING;

-- Verify
DO $$
DECLARE
    slot_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO slot_count FROM slots;
    RAISE NOTICE 'Total slots in database: %', slot_count;
END $$;
