const express = require('express');
const router = express.Router();
const {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  dismiss,
  clearAll,
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Every notification route is self-scoped to req.user.id, so this router is
// mounted for all four roles (player, owner, admin, subadmin).
router.use(authenticate);

// Literal paths must be registered before '/:id' or Express would treat
// 'unread-count' and 'read-all' as an id.
router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.delete('/', clearAll);
router.patch('/:id/read', markRead);
router.delete('/:id', dismiss);

module.exports = router;
