const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, name, email, phone, role, is_phone_verified, kyc_status, permissions FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireVerified(req, res, next) {
  if (!req.user.is_phone_verified) {
    return res.status(403).json({ message: 'Please verify your phone number before booking.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// Ground Owners must have an approved seller application before managing grounds,
// slots or creating walk-in bookings. Admin/subadmin are unaffected.
function requireApprovedSeller(req, res, next) {
  if (req.user.role === 'owner' && req.user.kyc_status !== 'approved') {
    return res
      .status(403)
      .json({ message: 'Your seller application is still under review. Ground management unlocks once it is approved.' });
  }
  next();
}

module.exports = { authenticate, requireVerified, requireRole, requireApprovedSeller };
