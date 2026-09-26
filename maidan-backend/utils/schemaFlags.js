const { pool } = require('../db');

let _kyc = null;

/** True once users.kyc_status exists (i.e., migrations/003 has been applied). Cached per process. */
async function kycEnabled() {
  if (_kyc !== null) return _kyc;
  try {
    const r = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_status') AS ok"
    );
    _kyc = r.rows[0].ok;
  } catch {
    _kyc = false;
  }
  return _kyc;
}

let _notifications = null;

/** True once the notifications table exists (migrations/008). Cached per process. */
async function notificationsEnabled() {
  if (_notifications !== null) return _notifications;
  try {
    const r = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') AS ok"
    );
    _notifications = r.rows[0].ok;
  } catch {
    _notifications = false;
  }
  return _notifications;
}

module.exports = { kycEnabled, notificationsEnabled };
