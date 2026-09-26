const { pool } = require('../db');

function mapCity(row) {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    isActive: Boolean(row.is_active),
  };
}

function validateCoords(latitude, longitude) {
  const lat = latitude == null || latitude === '' ? null : Number(latitude);
  const lng = longitude == null || longitude === '' ? null : Number(longitude);
  if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    return { error: 'Latitude must be between -90 and 90.' };
  }
  if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
    return { error: 'Longitude must be between -180 and 180.' };
  }
  return { lat, lng };
}

async function listCities(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await pool.query(
      `SELECT id, name, latitude, longitude, is_active
       FROM cities
       WHERE $1::boolean OR is_active = TRUE
       ORDER BY name ASC`,
      [includeInactive]
    );
    res.json({ cities: result.rows.map(mapCity) });
  } catch (error) {
    console.error('List cities error:', error);
    res.status(500).json({ message: 'Failed to fetch cities.' });
  }
}

async function createCity(req, res) {
  const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ message: 'City name is required.' });
  }
  if (name.length > 50) {
    return res.status(400).json({ message: 'City name must be 50 characters or less.' });
  }
  const { lat, lng, error } = validateCoords(req.body.latitude, req.body.longitude);
  if (error) return res.status(400).json({ message: error });

  try {
    const result = await pool.query(
      `INSERT INTO cities (name, latitude, longitude)
       VALUES ($1, $2, $3)
       RETURNING id, name, latitude, longitude, is_active`,
      [name, lat, lng]
    );
    res.status(201).json({ city: mapCity(result.rows[0]) });
  } catch (dbError) {
    if (dbError.code === '23505') {
      return res.status(409).json({ message: 'That city already exists.' });
    }
    console.error('Create city error:', dbError);
    res.status(500).json({ message: 'Failed to add city.' });
  }
}

async function updateCity(req, res) {
  const { name: rawName, latitude, longitude, isActive } = req.body || {};
  const name = typeof rawName === 'string' ? rawName.trim() : undefined;
  if (name && name.length > 50) {
    return res.status(400).json({ message: 'City name must be 50 characters or less.' });
  }
  const { lat, lng, error } = validateCoords(latitude, longitude);
  if (error) return res.status(400).json({ message: error });

  try {
    const result = await pool.query(
      `UPDATE cities
       SET name = COALESCE($1, name),
           latitude = COALESCE($2, latitude),
           longitude = COALESCE($3, longitude),
           is_active = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING id, name, latitude, longitude, is_active`,
      [name || null, lat ?? null, lng ?? null, isActive == null ? null : Boolean(isActive), req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'City not found.' });
    }
    res.json({ city: mapCity(result.rows[0]) });
  } catch (dbError) {
    if (dbError.code === '23505') {
      return res.status(409).json({ message: 'A city with that name already exists.' });
    }
    console.error('Update city error:', dbError);
    res.status(500).json({ message: 'Failed to update city.' });
  }
}

module.exports = { listCities, createCity, updateCity };