const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, delete: deleteGround } = require('../controllers/groundController');
const groundRatings = require('../controllers/groundRatingsController');
const { authenticate, requireRole, requireApprovedSeller } = require('../middleware/auth');
const { validate, groundSchema } = require('../middleware/validation');

router.get('/', getAll);
router.get('/:id/rating', authenticate, groundRatings.getRatingInfo);
router.post('/:id/rate', authenticate, groundRatings.rateGround);
router.get('/:id', getById);
router.post('/', authenticate, requireRole('owner', 'admin'), requireApprovedSeller, validate(groundSchema), create);
router.put('/:id', authenticate, requireRole('owner', 'admin'), requireApprovedSeller, validate(groundSchema.partial()), update);
router.delete('/:id', authenticate, requireRole('owner', 'admin'), requireApprovedSeller, deleteGround);

module.exports = router;
