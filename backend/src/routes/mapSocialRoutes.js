const express = require('express');
const MapSocialController = require('../controllers/mapSocialController');
const RegionInfoController = require('../controllers/regionInfoController');
const TerritoryController = require('../controllers/territoryController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public/optional auth routes
router.get('/region-info', optionalAuth, RegionInfoController.getRegionInfo);
router.get('/territories', optionalAuth, TerritoryController.getTerritories);
router.get('/territory-detail', optionalAuth, TerritoryController.getTerritoryDetail);

// Authenticated routes
router.use(authenticateToken);

// Get nearby players
router.get('/nearby-players', MapSocialController.getNearbyPlayers);

// Update own location
router.post('/update-location', MapSocialController.updateLocation);

// Leave map (remove from active players)
router.post('/leave', MapSocialController.leaveMap);

module.exports = router;
