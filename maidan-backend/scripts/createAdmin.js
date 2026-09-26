// One-off admin bootstrap:
//   node scripts/createAdmin.js <email> <password> [name]
require('dotenv').config();
const { pool } = require('../db');
const { hashPassword } = require('../utils/hashPassword');

(async () => {
  const [email, password, name = 'Maidan Admin'] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  const phone = `9800${Date.now()}`.slice(0, 15); // unique placeholder; admins log in via email
  const hash = await hashPassword(password);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE users SET role = 'admin', password_hash = $2, is_phone_verified = TRUE WHERE id = $1",
      [existing.rows[0].id, hash]
    );
    console.log(`Promoted existing user to admin: ${email}`);
  } else {
    await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role, is_phone_verified) VALUES ($1, $2, $3, $4, 'admin', TRUE)",
      [name, email, phone, hash]
    );
    console.log(`Admin created: ${email}`);
  }

  const check = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [email]);
  console.log(JSON.stringify(check.rows[0], null, 2));
  await pool.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
