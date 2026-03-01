const express = require('express');
const router = express.Router();
const localizationController = require('../controllers/localizationController');

// GET /api/v1/localization?lang=xx&version=yy - public bundle endpoint
router.get('/', localizationController.getBundle);

// GET /api/v1/localization/languages - supported languages list
router.get('/languages', localizationController.getLanguages);

module.exports = router;
