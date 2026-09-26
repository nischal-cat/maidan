const { pool } = require('../db');

/**
 * Generate hourly slots for a ground over a date range.
 *
 * @param {string} groundId - The ground UUID
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {number} days - Number of days to generate (default 7)
 * @param {object} client - Optional pg client for transactions
 * @returns {{ generated: number, skipped: number }}
 */
async function generateSlotsForGround(groundId, startDate, days = 7, client = null) {
  const q = client || pool;

  const groundResult = await q.query(
    `SELECT id, base_price, peak_price, operating_start, operating_end
     FROM grounds WHERE id = $1`,
    [groundId]
  );

  if (!groundResult.rows.length) {
    throw new Error('Ground not found');
  }

  const ground = groundResult.rows[0];
  const basePrice = parseFloat(ground.base_price);
  const peakPrice = ground.peak_price ? parseFloat(ground.peak_price) : Math.round(basePrice * 1.3);
  const opStart = parseInt(ground.operating_start.slice(0, 2), 10);
  const opEnd = parseInt(ground.operating_end.slice(0, 2), 10);

  let generated = 0;
  let skipped = 0;

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    for (let hour = opStart; hour < opEnd; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

      // Peak hours: 17:00-20:00
      const isPeak = hour >= 17 && hour < 20;
      const price = isPeak ? peakPrice : basePrice;

      const result = await q.query(
        `INSERT INTO slots (ground_id, slot_date, start_time, end_time, price, status)
         VALUES ($1, $2, $3, $4, $5, 'available')
         ON CONFLICT (ground_id, slot_date, start_time) DO NOTHING`,
        [groundId, dateStr, startTime, endTime, price]
      );

      if (result.rowCount > 0) {
        generated++;
      } else {
        skipped++;
      }
    }
  }

  return { generated, skipped };
}

module.exports = { generateSlotsForGround };
