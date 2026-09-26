-- ============================================
-- CLEANUP: Remove demo grounds seeded by the old seed_slots.sql
-- Safe to re-run. Deletes dependent slots and bookings first.
-- psql $DATABASE_URL -f db/cleanup_demo_grounds.sql
-- ============================================

DELETE FROM bookings
WHERE ground_id IN (
  SELECT id FROM grounds
  WHERE name IN ('Thamel Futsal Arena', 'New Baneshwor FC', 'Chitwan Indoor Arena', 'Patan Sports Complex', 'Lakeside Sports Hub')
);

DELETE FROM slots
WHERE ground_id IN (
  SELECT id FROM grounds
  WHERE name IN ('Thamel Futsal Arena', 'New Baneshwor FC', 'Chitwan Indoor Arena', 'Patan Sports Complex', 'Lakeside Sports Hub')
);

DELETE FROM grounds
WHERE name IN ('Thamel Futsal Arena', 'New Baneshwor FC', 'Chitwan Indoor Arena', 'Patan Sports Complex', 'Lakeside Sports Hub');