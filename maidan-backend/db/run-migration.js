const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function run() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node db/run-migration.js <migration.sql>');
    process.exit(1);
  }
  const file = path.resolve(target);
  try {
    const sql = fs.readFileSync(file, 'utf8');
    await pool.query(sql);
    console.log(`Migration applied: ${path.basename(file)}`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

run();