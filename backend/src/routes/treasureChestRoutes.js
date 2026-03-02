const express = require('express');
const router = express.Router();
const TreasureChestController = require('../controllers/treasureChestController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Treasure Chest Routes
 *
 * Auto-spawning treasure chest system endpoints
 */

// Get nearby chests (optional auth for guest view)
router.get('/nearby',
  (req, res, next) => {
    authenticateToken(req, res, (err) => {
      // Continue even if auth fails (for guest users)
      next();
    });
  },
  TreasureChestController.getNearbyChests
);

// Pickup a chest (requires auth)
router.post('/:id/pickup',
  authenticateToken,
  TreasureChestController.pickupChest
);

// Get user stats (requires auth)
router.get('/stats',
  authenticateToken,
  TreasureChestController.getStats
);

// Spawn chests (admin/scheduled)
router.post('/spawn',
  authenticateToken,
  // TODO: Add admin middleware
  TreasureChestController.spawnChests
);

module.exports = router;
