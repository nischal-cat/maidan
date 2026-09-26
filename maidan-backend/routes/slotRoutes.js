const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireApprovedSeller } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { getSlots, updateSlots, getAvailableToday } = require('../controllers/slotController');

router.get('/available-today', getAvailableToday);
router.get('/:groundId/slots', getSlots);
router.put('/:groundId/slots', authenticate, requireRole('owner', 'admin', 'subadmin'), requireApprovedSeller, requirePermission('slots'), updateSlots);

module.exports = router;
