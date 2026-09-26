const { pool } = require('../db');
const { notificationsEnabled } = require('../utils/schemaFlags');

const FEATURE_MISSING = {
  message:
    'Notifications are not enabled on this database yet. Run migrations/008_notifications.sql, then restart the server.',
};

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    bookingId: row.booking_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * GET /api/notifications
 * Inbox for the signed-in user, newest first, plus the unread count so the bell
 * badge and the list never disagree.
 */
exports.listNotifications = async (req, res) => {
  if (!(await notificationsEnabled())) return res.status(503).json(FEATURE_MISSING);

  const { page = 1, limit = 20, unreadOnly } = req.query;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  try {
    const filters = ['user_id = $1'];
    const params = [req.user.id];
    if (unreadOnly === 'true') filters.push('is_read = FALSE');

    const where = `WHERE ${filters.join(' AND ')}`;

    const [countResult, unreadResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM notifications ${where}`, params),
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [req.user.id]),
      pool.query(
        `SELECT * FROM notifications ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, safeLimit, offset]
      ),
    ]);

    res.json({
      notifications: result.rows.map(serialize),
      unreadCount: parseInt(unreadResult.rows[0].count, 10),
      total: parseInt(countResult.rows[0].count, 10),
      page: safePage,
      limit: safeLimit,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
};

/** GET /api/notifications/unread-count — cheap poll target for the bell badge. */
exports.getUnreadCount = async (req, res) => {
  if (!(await notificationsEnabled())) return res.json({ count: 0, notificationsEnabled: false });

  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ message: 'Failed to fetch unread count.' });
  }
};

/** PATCH /api/notifications/:id/read */
exports.markRead = async (req, res) => {
  if (!(await notificationsEnabled())) return res.status(503).json(FEATURE_MISSING);

  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification: serialize(result.rows[0]) });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Failed to update the notification.' });
  }
};

/** PATCH /api/notifications/read-all */
exports.markAllRead = async (req, res) => {
  if (!(await notificationsEnabled())) return res.status(503).json(FEATURE_MISSING);

  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.', updated: result.rowCount });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
};

/** DELETE /api/notifications/:id */
exports.dismiss = async (req, res) => {
  if (!(await notificationsEnabled())) return res.status(503).json(FEATURE_MISSING);

  try {
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (!result.rowCount) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ message: 'Notification dismissed.' });
  } catch (error) {
    console.error('Dismiss notification error:', error);
    res.status(500).json({ message: 'Failed to dismiss the notification.' });
  }
};

/** DELETE /api/notifications — clear the whole inbox. */
exports.clearAll = async (req, res) => {
  if (!(await notificationsEnabled())) return res.status(503).json(FEATURE_MISSING);

  try {
    const result = await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Notifications cleared.', deleted: result.rowCount });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ message: 'Failed to clear notifications.' });
  }
};
