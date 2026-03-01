const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const localizationController = require('../../controllers/localizationController');

// Require admin authentication for all routes in this file
router.use(authenticateToken, requireAdmin);

// Admin CRUD for localization strings
router.get('/strings', localizationController.adminListStrings);
router.put('/strings', localizationController.adminUpsertString);
router.delete('/strings', localizationController.adminDeleteString);

// Bulk operations
router.post('/bulk-upsert', localizationController.adminBulkUpsert);

// Import/Export JSON
router.post('/import/json', localizationController.adminImportJSON);
router.get('/export/json', localizationController.adminExportJSON);

// Import/Export XLIFF
router.post('/import/xliff', localizationController.adminImportXLIFF);
router.get('/export/xliff', localizationController.adminExportXLIFF);

// Missing key check
router.get('/missing', localizationController.adminCheckMissing);

// Version bump
router.post('/bump-version', localizationController.adminBumpVersion);

module.exports = router;
