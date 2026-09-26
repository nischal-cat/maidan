const express = require('express');
const router = express.Router();
const { listCities } = require('../controllers/citiesController');

router.get('/', listCities);

module.exports = router;