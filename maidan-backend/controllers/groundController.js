const { pool } = require('../db');
const { generateSlotsForGround } = require('../services/slotGenerator');
const { kycEnabled } = require('../utils/schemaFlags');

// DB columns are snake_case; the API contract (and frontend types) use camelCase.
function serializeGround(row) {
  if (!row) return row;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    address: row.address,
    city: row.city,
    contact: row.contact,
    description: row.description,
    basePrice: row.base_price != null ? Number(row.base_price) : null,
    peakPrice: row.peak_price != null ? Number(row.peak_price) : null,
    sportType: row.sport_type,
    imageUrl: row.image_url,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: row.rating_count != null ? Number(row.rating_count) : 0,
    operatingHoursStart: row.operating_start,
    operatingHoursEnd: row.operating_end,
    latitude: row.latitude,
    longitude: row.longitude,
    isActive: row.is_active,
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    createdAt: row.created_at,
  };
}

exports.getAll = async (req, res) => {
  const { city, search, sportType, isActive, ownerId, sort, page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT g.*,
             (SELECT COUNT(*) FROM ground_ratings gr WHERE gr.ground_id = g.id) AS rating_count
      FROM grounds g
      WHERE 1=1`;
    const conditions = [];
    const params = [];

    if (city) {
      params.push(city);
      conditions.push(`g.city = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(g.name ILIKE $${params.length} OR g.address ILIKE $${params.length})`);
    }
    if (sportType) {
      params.push(sportType);
      conditions.push(`g.sport_type = $${params.length}`);
    }
    if (ownerId) {
      params.push(ownerId);
      conditions.push(`g.owner_id = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive === 'true');
      conditions.push(`g.is_active = $${params.length}`);
    } else {
      conditions.push('g.is_active = TRUE');
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) FROM grounds g WHERE 1=1` +
      (conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    if (sort === 'rating') {
      query += ' ORDER BY g.rating DESC, g.created_at DESC';
    } else {
      query += ' ORDER BY g.created_at DESC';
    }
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json({ grounds: result.rows.map(serializeGround), total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get grounds error:', error);
    res.status(500).json({ message: 'Failed to fetch grounds.' });
  }
};

exports.getById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT g.*,
              (SELECT COUNT(*) FROM ground_ratings gr WHERE gr.ground_id = g.id) AS rating_count
       FROM grounds g
       WHERE g.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ground not found.' });
    }
    res.json(serializeGround(result.rows[0]));
  } catch (error) {
    console.error('Get ground error:', error);
    res.status(500).json({ message: 'Failed to fetch ground.' });
  }
};

exports.create = async (req, res) => {
  const { name, address, city, contact, basePrice, peakPrice, sportType, operatingStart, operatingEnd, description, imageUrl, latitude, longitude, gallery, isActive } = req.body;
  const ownerId = req.user.id;
  const client = await pool.connect();

  try {
    // Sellers can only list grounds once their KYC is approved.
    if (req.user.role !== 'admin' && (await kycEnabled())) {
      const ownerCheck = await pool.query('SELECT kyc_status FROM users WHERE id = $1', [ownerId]);
      if (ownerCheck.rows[0]?.kyc_status !== 'approved') {
        client.release();
        return res.status(403).json({ message: 'Your seller account is awaiting KYC approval. You can list grounds once an admin approves your documents.' });
      }
    }

    await client.query('BEGIN');

    const kycReady = await kycEnabled();
    const active = isActive !== false;
    const result = kycReady
      ? await client.query(
          `INSERT INTO grounds (owner_id, name, address, city, contact, base_price, peak_price, sport_type,
                                operating_start, operating_end, description, image_url, latitude, longitude, gallery, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16)
           RETURNING *`,
          [
            ownerId, name, address || `${name}, ${city || 'Kathmandu'}`, city || 'Kathmandu', contact, basePrice,
            peakPrice || null, sportType || 'futsal',
            operatingStart || '06:00', operatingEnd || '22:00',
            description, imageUrl, latitude || null, longitude || null,
            JSON.stringify(Array.isArray(gallery) ? gallery : []),
            active,
          ]
        )
      : await client.query(
          `INSERT INTO grounds (owner_id, name, address, city, contact, base_price, peak_price, sport_type,
                                operating_start, operating_end, description, image_url, latitude, longitude, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            ownerId, name, address || `${name}, ${city || 'Kathmandu'}`, city || 'Kathmandu', contact, basePrice,
            peakPrice || null, sportType || 'futsal',
            operatingStart || '06:00', operatingEnd || '22:00',
            description, imageUrl, latitude || null, longitude || null,
            active,
          ]
        );

    const ground = result.rows[0];

    // Auto-generate 7 days of slots
    const today = new Date().toISOString().split('T')[0];
    const { generated, skipped } = await generateSlotsForGround(ground.id, today, 7, client);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Ground created with ${generated} slots (${skipped} already existed).`,
      ground: serializeGround(ground),
      slotsGenerated: generated,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create ground error:', error);
    res.status(500).json({ message: 'Failed to create ground.' });
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, address, city, contact, basePrice, peakPrice, sportType, operatingStart, operatingEnd, description, imageUrl, isActive, latitude, longitude, gallery } = req.body;

  try {
    const existing = await pool.query('SELECT id, owner_id FROM grounds WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Ground not found.' });
    }

    if (existing.rows[0].owner_id !== req.user.id && !['admin', 'subadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only edit your own grounds.' });
    }

    const kycReady = await kycEnabled();
    const galleryClause = kycReady ? ', gallery = COALESCE($15::jsonb, gallery)' : '';
    const params = [name, address, city, contact, basePrice, peakPrice, sportType, operatingStart, operatingEnd, description, imageUrl, isActive, latitude, longitude];
    if (kycReady) params.push(gallery ? JSON.stringify(gallery) : null);
    params.push(id);

    const result = await pool.query(
      `UPDATE grounds SET
       name = COALESCE($1, name), address = COALESCE($2, address), city = COALESCE($3, city),
       contact = COALESCE($4, contact), base_price = COALESCE($5, base_price),
       peak_price = COALESCE($6, peak_price), sport_type = COALESCE($7, sport_type),
       operating_start = COALESCE($8, operating_start), operating_end = COALESCE($9, operating_end),
       description = COALESCE($10, description), image_url = COALESCE($11, image_url),
       is_active = COALESCE($12, is_active),
       latitude = COALESCE($13, latitude), longitude = COALESCE($14, longitude)${galleryClause}
       WHERE id = $${params.length} RETURNING *`,
      params
    );

    res.json({ message: 'Ground updated successfully.', ground: serializeGround(result.rows[0]) });
  } catch (error) {
    console.error('Update ground error:', error);
    res.status(500).json({ message: 'Failed to update ground.' });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT id, owner_id FROM grounds WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Ground not found.' });
    }

    if (existing.rows[0].owner_id !== req.user.id && !['admin', 'subadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only delete your own grounds.' });
    }

    // Data integrity: grounds with any booking history must never be hard
    // deleted, because slots -> bookings -> payments cascade. Owners/admins
    // should hide or deactivate the ground instead.
    const bookingCheck = await pool.query('SELECT 1 FROM bookings WHERE ground_id = $1 LIMIT 1', [id]);
    if (bookingCheck.rows.length > 0) {
      return res.status(409).json({
        message: 'This ground has booking history and cannot be permanently deleted. Hide or deactivate it instead.',
      });
    }

    await pool.query('DELETE FROM grounds WHERE id = $1', [id]);
    res.json({ message: 'Ground deleted successfully.' });
  } catch (error) {
    console.error('Delete ground error:', error);
    res.status(500).json({ message: 'Failed to delete ground.' });
  }
};
