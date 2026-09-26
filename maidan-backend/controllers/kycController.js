const { pool } = require('../db');
const { kycEnabled } = require('../utils/schemaFlags');
const { NOTIFICATION_TYPES, notify } = require('../services/notificationService');

// Block non-admin/sub-admin callers (defense in depth; the admin router also
// restricts this to admin + subadmin with the 'sellers' permission).
function requireStaffRole(req, res) {
  if (!['admin', 'subadmin'].includes(req.user.role)) {
    res.status(403).json({ message: 'You do not have permission to perform this action.' });
    return false;
  }
  return true;
}

function serializeSeller(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    businessName: row.business_name,
    businessType: Array.isArray(row.business_type) ? row.business_type : [],
    businessCity: row.business_city,
    businessAddress: row.business_address,
    businessContact: row.business_contact,
    registrationNumber: row.registration_number,
    businessDescription: row.business_description,
    kycStatus: row.kyc_status,
    kycDocumentUrl: row.kyc_document_url,
    kycNote: row.kyc_note,
    kycReviewedAt: row.kyc_reviewed_at,
    createdAt: row.created_at,
    groundCount: parseInt(row.ground_count),
  };
}

const SELLER_SELECT = `
  SELECT u.id, u.name, u.email, u.phone, u.business_name, u.kyc_status,
         u.kyc_document_url, u.kyc_note, u.kyc_reviewed_at, u.created_at,
         u.business_type, u.business_city, u.business_address, u.business_contact,
         u.registration_number, u.business_description,
         (SELECT COUNT(*) FROM grounds g WHERE g.owner_id = u.id) AS ground_count
  FROM users u
`;

// Admin-only: list seller accounts with their KYC state.
exports.listSellers = async (req, res) => {
  if (!(await kycEnabled())) {
    return res.status(503).json({ message: 'KYC schema not applied yet. Run migrations/003_kyc_gallery.sql, then restart the server.' });
  }
  if (!requireStaffRole(req, res)) return;

  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    let query = SELLER_SELECT + ` WHERE u.role = 'owner'`;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND u.kyc_status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.business_name ILIKE $${params.length})`;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM users/, 'SELECT COUNT(*) FROM users');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY CASE u.kyc_status WHEN 'pending' THEN 0 ELSE 1 END, u.created_at DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      sellers: result.rows.map(serializeSeller),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('List sellers error:', error);
    res.status(500).json({ message: 'Failed to fetch sellers.' });
  }
};

// Admin-only: fetch a single seller by ID (same shape as listSellers) so a
// detail page can be opened directly or refreshed by URL.
exports.getSellerById = async (req, res) => {
  if (!(await kycEnabled())) {
    return res.status(503).json({ message: 'KYC schema not applied yet. Run migrations/003_kyc_gallery.sql, then restart the server.' });
  }
  if (!requireStaffRole(req, res)) return;

  const { id } = req.params;

  try {
    const result = await pool.query(SELLER_SELECT + ` WHERE u.role = 'owner' AND u.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Seller not found.' });
    }
    res.json({ seller: serializeSeller(result.rows[0]) });
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({ message: 'Failed to fetch seller.' });
  }
};

// Admin-only: approve / decline / re-open a seller's KYC.
exports.reviewKyc = async (req, res) => {
  if (!(await kycEnabled())) {
    return res.status(503).json({ message: 'KYC schema not applied yet. Run migrations/003_kyc_gallery.sql, then restart the server.' });
  }
  if (!requireStaffRole(req, res)) return;
  const { id } = req.params;
  const { status, note } = req.body;

  if (!['approved', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved, declined or pending.' });
  }

  try {
    const existing = await pool.query("SELECT id, role FROM users WHERE id = $1 AND role = 'owner'", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET kyc_status = $1,
           kyc_note = $2,
           kyc_reviewed_at = CASE WHEN $1 IN ('approved', 'declined') THEN NOW() ELSE kyc_reviewed_at END
       WHERE id = $3
       RETURNING id, name, email, kyc_status, kyc_note`,
      [status, note || null, id]
    );

    res.json({
      message: `Seller ${status}.`,
      seller: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        kycStatus: result.rows[0].kyc_status,
        kycNote: result.rows[0].kyc_note,
      },
    });

    if (status === 'approved' || status === 'declined') {
      const approved = status === 'approved';
      await notify({
        userId: result.rows[0].id,
        type: NOTIFICATION_TYPES.KYC_STATUS,
        title: approved ? 'Business verified' : 'Business verification declined',
        body: approved
          ? 'Your seller application is approved. You can now add grounds, manage slots and take bookings.'
          : `Your seller application was declined.${note ? ` Reason: ${note}` : ' Please resubmit from your verification page.'}`,
        link: approved ? '/owner/grounds/new' : '/owner/kyc',
      });
    }
  } catch (error) {
    console.error('KYC review error:', error);
    res.status(500).json({ message: 'Failed to update KYC status.' });
  }
};
