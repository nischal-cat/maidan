const { pool } = require('../db');
const { hashPassword } = require('../utils/hashPassword');

function serializeStaff(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    createdAt: row.created_at,
  };
}

exports.listStaff = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, permissions, created_at
       FROM users WHERE role = 'subadmin'
       ORDER BY created_at DESC`
    );
    res.json({ staff: result.rows.map(serializeStaff) });
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ message: 'Failed to fetch staff.' });
  }
};

exports.createStaff = async (req, res) => {
  const { name, email, phone, password, permissions } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_phone_verified, permissions)
       VALUES ($1, $2, $3, $4, 'subadmin', TRUE, $5::jsonb)
       RETURNING id, name, email, phone, role, permissions, created_at`,
      [name, email, phone || null, passwordHash, JSON.stringify(permissions || [])]
    );

    res.status(201).json({ message: 'Sub-admin created.', user: serializeStaff(result.rows[0]) });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Failed to create sub-admin.' });
  }
};

exports.updateStaff = async (req, res) => {
  const { id } = req.params;
  const { permissions, password } = req.body;

  try {
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot edit your own account here.' });
    }

    const existing = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (existing.rows[0].role !== 'subadmin') {
      return res.status(400).json({ message: 'Only sub-admin accounts can be edited here.' });
    }

    const sets = [];
    const params = [];
    if (permissions !== undefined) {
      params.push(JSON.stringify(permissions));
      sets.push(`permissions = $${params.length}::jsonb`);
    }
    if (password) {
      params.push(await hashPassword(password));
      sets.push(`password_hash = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, email, phone, role, permissions, created_at`,
      params
    );

    res.json({ message: 'Sub-admin updated.', user: serializeStaff(result.rows[0]) });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Failed to update sub-admin.' });
  }
};

exports.deleteStaff = async (req, res) => {
  const { id } = req.params;

  try {
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot remove your own account.' });
    }

    const existing = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (existing.rows[0].role !== 'subadmin') {
      return res.status(400).json({ message: 'Only sub-admin accounts can be removed here.' });
    }

    await pool.query('UPDATE bookings SET booked_by_user_id = NULL WHERE booked_by_user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'Sub-admin removed.' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ message: 'Failed to remove sub-admin.' });
  }
};