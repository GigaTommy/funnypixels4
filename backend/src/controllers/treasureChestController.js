const TreasureChest = require('../models/TreasureChest');
const logger = require('../utils/logger');

/**
 * Treasure Chest Controller
 *
 * Handles auto-spawning treasure chest system
 */

class TreasureChestController {
  /**
   * Get nearby treasure chests
   * GET /api/treasure-chests/nearby
   */
  static async getNearbyChests(req, res) {
    try {
      const userId = req.user?.id;
      const { lat, lng, radius = 5000 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude required'
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusMeters = parseInt(radius);

      const chests = await TreasureChest.getNearby(latitude, longitude, radiusMeters, userId);

      // Group by distance ranges for client-side rendering
      const grouped = {
        near: chests.filter(c => c.distance <= 500),
        medium: chests.filter(c => c.distance > 500 && c.distance <= 2000),
        far: chests.filter(c => c.distance > 2000)
      };

      res.json({
        success: true,
        data: {
          chests: chests.map(chest => ({
            id: chest.id,
            latitude: parseFloat(chest.latitude),
            longitude: parseFloat(chest.longitude),
            rarity: chest.rarity,
            distance: chest.distance,
            can_pickup: chest.can_pickup !== undefined ? chest.can_pickup : null,
            cooldown_remaining: chest.cooldown_remaining || 0,
            expires_at: chest.expires_at
          })),
          grouped,
          total: chests.length
        }
      });
    } catch (error) {
      logger.error('Failed to get nearby chests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get treasure chests'
      });
    }
  }

  /**
   * Pickup a treasure chest
   * POST /api/treasure-chests/:id/pickup
   */
  static async pickupChest(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'User location required'
        });
      }

      const result = await TreasureChest.pickup(
        parseInt(id),
        userId,
        parseFloat(latitude),
        parseFloat(longitude)
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Send notification to update map task progress
      const MapNotification = require('../models/MapNotification');
      if (result.rarity === 'epic' || result.rarity === 'limited') {
        // Create notification for rare pickups
        await MapNotification.createTreasureRefresh(
          'treasure_picked',
          1,
          { lat: latitude, lng: longitude }
        );
      }

      res.json({
        success: true,
        data: {
          points_awarded: result.pointsAwarded,
          rarity: result.rarity,
          chest_id: result.chestId
        },
        message: `获得 ${result.pointsAwarded} 积分！`
      });
    } catch (error) {
      logger.error('Failed to pickup chest:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pickup treasure chest'
      });
    }
  }

  /**
   * Spawn treasure chests (admin/scheduled job)
   * POST /api/treasure-chests/spawn
   */
  static async spawnChests(req, res) {
    try {
      // TODO: Add admin authentication
      const {
        latitude,
        longitude,
        radius,
        rarity,
        quantity,
        duration_minutes,
        region_name,
        city
      } = req.body;

      const chests = await TreasureChest.spawn({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius) || 5000,
        rarity: rarity || 'normal',
        quantity: parseInt(quantity) || 1,
        durationMinutes: parseInt(duration_minutes) || 60,
        regionName: region_name,
        city: city || 'global'
      });

      res.json({
        success: true,
        data: { chests },
        message: `Spawned ${chests.length} treasure chests`
      });
    } catch (error) {
      logger.error('Failed to spawn chests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to spawn treasure chests'
      });
    }
  }

  /**
   * Get treasure chest statistics
   * GET /api/treasure-chests/stats
   */
  static async getStats(req, res) {
    try {
      const userId = req.user?.id;

      const { db } = require('../config/database');

      const stats = await db('treasure_chest_pickups')
        .select(
          db.raw('COUNT(*) as total_pickups'),
          db.raw('SUM(points_awarded) as total_points'),
          db.raw('COUNT(DISTINCT DATE(picked_up_at)) as days_active')
        )
        .where('user_id', userId)
        .first();

      const rarityStats = await db('treasure_chest_pickups as tcp')
        .join('treasure_chests as tc', 'tcp.chest_id', 'tc.id')
        .select('tc.rarity')
        .count('* as count')
        .where('tcp.user_id', userId)
        .groupBy('tc.rarity');

      res.json({
        success: true,
        data: {
          total_pickups: parseInt(stats?.total_pickups || 0),
          total_points: parseInt(stats?.total_points || 0),
          days_active: parseInt(stats?.days_active || 0),
          by_rarity: rarityStats.reduce((acc, r) => {
            acc[r.rarity] = parseInt(r.count);
            return acc;
          }, {})
        }
      });
    } catch (error) {
      logger.error('Failed to get treasure stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stats'
      });
    }
  }
}

module.exports = TreasureChestController;
