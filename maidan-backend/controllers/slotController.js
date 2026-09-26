const { pool } = require('../db');

exports.getSlots = async (req, res) => {
  const { groundId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: 'Date is required.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, ground_id, slot_date, start_time, end_time, status, price, is_blocked
       FROM slots
       WHERE ground_id = $1 AND slot_date = $2
       ORDER BY start_time`,
      [groundId, date]
    );

    const slots = result.rows.map((s) => ({
      id: s.id,
      groundId: s.ground_id,
      date: s.slot_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      status: s.is_blocked ? 'maintenance' : s.status,
      price: parseFloat(s.price),
    }));

    res.json(slots);
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ message: 'Failed to fetch slots.' });
  }
};

exports.updateSlots = async (req, res) => {
  const { groundId } = req.params;
  const { date, slots } = req.body;

  if (!date || !slots || !Array.isArray(slots)) {
    return res.status(400).json({ message: 'Date and slots array are required.' });
  }

  const client = await pool.connect();

  try {
    const existing = await client.query('SELECT owner_id FROM grounds WHERE id = $1', [groundId]);
    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Ground not found.' });
    }
    if (existing.rows[0].owner_id !== req.user.id && !['admin', 'subadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only manage your own grounds.' });
    }

    await client.query('BEGIN');

    for (const slot of slots) {
      if (slot.status === 'maintenance' || slot.status === 'unavailable') {
        // Close only *currently available* slots. Booked and held slots are
        // never flipped to maintenance, so active holds and confirmed/walk-in
        // bookings are left untouched.
        await client.query(
          `UPDATE slots SET status = 'maintenance', is_blocked = TRUE, block_reason = 'Owner blocked'
           WHERE ground_id = $1 AND slot_date = $2 AND start_time = $3
             AND status NOT IN ('booked', 'held')`,
          [groundId, date, slot.startTime]
        );
      } else if (slot.status === 'available') {
        // Reopen only closed (maintenance) slots. Held slots stay held with
        // their hold metadata intact; booked slots stay booked.
        await client.query(
          `UPDATE slots SET status = 'available', is_blocked = FALSE, block_reason = NULL
           WHERE ground_id = $1 AND slot_date = $2 AND start_time = $3
             AND status NOT IN ('booked', 'held')`,
          [groundId, date, slot.startTime]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Slots updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update slots error:', error);
    res.status(500).json({ message: 'Failed to update slots.' });
  } finally {
    client.release();
  }
};

exports.getAvailableToday = async (req, res) => {
  const { city } = req.query;

  try {
    let query = `
      SELECT
        g.id, g.name, g.city, g.address, g.base_price, g.rating, g.image_url,
        json_agg(
          json_build_object(
            'time', to_char(s.start_time, 'HH24:MI'),
            'available', CASE WHEN s.status = 'available' AND NOT s.is_blocked THEN 1 ELSE 0 END
          ) ORDER BY s.start_time
        ) AS slots_today,
        COUNT(*) FILTER (WHERE s.status = 'available' AND NOT s.is_blocked) AS available_count
      FROM grounds g
      INNER JOIN slots s ON s.ground_id = g.id AND s.slot_date = CURRENT_DATE
      WHERE g.is_active = TRUE
    `;
    const params = [];

    if (city) {
      params.push(city);
      query += ` AND g.city = $1`;
    }

    query += `
      GROUP BY g.id
      HAVING COUNT(*) FILTER (WHERE s.status = 'available' AND NOT s.is_blocked) > 0
      ORDER BY available_count DESC
      LIMIT 20
    `;

    const result = await pool.query(query, params);
    res.json(result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      address: row.address,
      basePrice: row.base_price != null ? Number(row.base_price) : null,
      rating: row.rating != null ? Number(row.rating) : null,
      imageUrl: row.image_url,
      slotsToday: row.slots_today,
      availableCount: Number(row.available_count),
    })));
  } catch (error) {
    console.error('Get available today error:', error);
    res.status(500).json({ message: 'Failed to fetch available slots.' });
  }
};
