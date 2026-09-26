const { pool } = require('../db');

// A booking counts as "played" once its start time has passed and it wasn't
// cancelled. Only players who actually played can rate the ground.
function hasPlayedGround(userId, groundId) {
  return pool
    .query(
      `SELECT 1 FROM bookings
       WHERE user_id = $1 AND ground_id = $2
         AND status NOT IN ('cancelled', 'late_cancelled')
         AND (booking_date + start_time) < NOW()
       LIMIT 1`,
      [userId, groundId]
    )
    .then((r) => r.rows.length > 0);
}

function getRatingSummary(groundId) {
  return pool
    .query(
      `SELECT COALESCE(AVG(rating), 0)::float AS average, COUNT(*)::int AS count
       FROM ground_ratings WHERE ground_id = $1`,
      [groundId]
    )
    .then((r) => ({
      average: Number(r.rows[0].average),
      count: Number(r.rows[0].count),
    }));
}

exports.getRatingInfo = async (req, res) => {
  const { id } = req.params;
  try {
    const summary = await getRatingSummary(id);
    const mine = await pool.query(
      'SELECT rating FROM ground_ratings WHERE ground_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({
      ...summary,
      myRating: mine.rows.length ? Number(mine.rows[0].rating) : null,
      canRate: await hasPlayedGround(req.user.id, id),
    });
  } catch (error) {
    console.error('Get rating info error:', error);
    res.status(500).json({ message: 'Failed to load ratings.' });
  }
};

exports.rateGround = async (req, res) => {
  const { id } = req.params;
  const rating = Math.round(Number(req.body.rating));
  const client = await pool.connect();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
  }

  try {
    const groundRes = await client.query('SELECT id FROM grounds WHERE id = $1', [id]);
    if (!groundRes.rows.length) {
      return res.status(404).json({ message: 'Ground not found.' });
    }

    if (!(await hasPlayedGround(req.user.id, id))) {
      return res.status(403).json({ message: 'You can rate this ground only after playing there.' });
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ground_ratings (ground_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (ground_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating`,
      [id, req.user.id, rating]
    );

    await client.query(
      `UPDATE grounds SET rating = (SELECT COALESCE(AVG(rating), 0) FROM ground_ratings WHERE ground_id = $1)
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    const summary = await getRatingSummary(id);
    res.json({
      message: 'Thanks for rating this ground!',
      ...summary,
      myRating: rating,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rate ground error:', error);
    res.status(500).json({ message: 'Failed to save rating.' });
  } finally {
    client.release();
  }
};