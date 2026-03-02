const express = require('express');
const router = express.Router();
const QuickStatsController = require('../controllers/quickStatsController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Quick Stats Routes
 *
 * Endpoints for map quick stats popover
 */

// Get today's stats
router.get('/today',
  authenticateToken,
  QuickStatsController.getTodayStats
);

module.exports = router;
