const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Treasure Chest Model
 *
 * Auto-spawning treasure chests on the map
 * - System-driven (different from QR treasure hunt)
 * - 4 rarity levels
 * - Distance-based visibility
 * - Cooldown system
 */

const RARITY_LEVELS = {
  NORMAL: 'normal',
  RARE: 'rare',
  EPIC: 'epic',
  LIMITED: 'limited'
};

const PICKUP_RANGE_METERS = 50; // Must be within 50m to pickup
const COOLDOWN_MINUTES = 30; // 30 minutes cooldown per chest location

class TreasureChest {
  /**
   * Spawn treasure chests in a region
   */
  static async spawn(config) {
    const {
      latitude,
      longitude,
      radius = 5000, // 5km radius
      rarity = RARITY_LEVELS.NORMAL,
      quantity = 1,
      durationMinutes = 60,
      regionName = null,
      city = null
    } = config;

    const chests = [];

    for (let i = 0; i < quantity; i++) {
      // Generate random location within radius
      const location = this.randomLocationInRadius(latitude, longitude, radius);

      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Get reward range from config
      const rewardConfig = await this.getRewardConfig(rarity, city);

      const chest = await db('treasure_chests').insert({
        latitude: location.lat,
        longitude: location.lng,
        location: db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)`, [location.lng, location.lat]),
        rarity,
        points_min: rewardConfig.points_min,
        points_max: rewardConfig.points_max,
        spawned_at: db.fn.now(),
        expires_at: expiresAt,
        is_active: true,
        region_name: regionName,
        city: city || 'global',
        metadata: JSON.stringify({})
      }).returning('*');

      chests.push(chest[0]);
    }

    logger.info(`✅ Spawned ${quantity} ${rarity} treasure chests in ${city || 'global'}`);
    return chests;
  }

  /**
   * Get active chests near a location
   */
  static async getNearby(latitude, longitude, radiusMeters = 5000, userId = null) {
    try {
      const point = `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;

      // Get active chests within radius
      const chests = await db('treasure_chests')
        .select(
          'treasure_chests.*',
          db.raw(`ST_Distance(location::geography, ${point}::geography) as distance`)
        )
        .where('is_active', true)
        .where('expires_at', '>', db.fn.now())
        .whereRaw(`ST_DWithin(location::geography, ${point}::geography, ?)`, [radiusMeters])
        .orderBy('distance', 'asc');

      // If userId provided, check cooldowns and filter
      if (userId) {
        const chestsWithCooldown = await Promise.all(
          chests.map(async (chest) => {
            const canPickup = await this.canUserPickup(userId, chest.id, chest.latitude, chest.longitude);
            return {
              ...chest,
              can_pickup: canPickup.allowed,
              cooldown_remaining: canPickup.cooldownRemaining,
              distance: parseFloat(chest.distance)
            };
          })
        );
        return chestsWithCooldown;
      }

      return chests.map(chest => ({
        ...chest,
        distance: parseFloat(chest.distance)
      }));
    } catch (error) {
      logger.error('Failed to get nearby chests:', error);
      throw error;
    }
  }

  /**
   * Pickup a treasure chest
   */
  static async pickup(chestId, userId, userLatitude, userLongitude) {
    try {
      // Get chest
      const chest = await db('treasure_chests')
        .where('id', chestId)
        .where('is_active', true)
        .where('expires_at', '>', db.fn.now())
        .first();

      if (!chest) {
        return { success: false, error: 'Chest not found or expired' };
      }

      // Check distance
      const distance = this.calculateDistance(
        userLatitude,
        userLongitude,
        parseFloat(chest.latitude),
        parseFloat(chest.longitude)
      );

      if (distance > PICKUP_RANGE_METERS) {
        return { success: false, error: 'Too far from chest', distance, required: PICKUP_RANGE_METERS };
      }

      // Check cooldown
      const cooldownCheck = await this.canUserPickup(userId, chestId, chest.latitude, chest.longitude);
      if (!cooldownCheck.allowed) {
        return {
          success: false,
          error: 'Cooldown active',
          cooldownRemaining: cooldownCheck.cooldownRemaining
        };
      }

      // Calculate reward
      const pointsAwarded = Math.floor(
        Math.random() * (chest.points_max - chest.points_min + 1) + chest.points_min
      );

      // Record pickup and award points
      await db.transaction(async (trx) => {
        // Record pickup
        await trx('treasure_chest_pickups').insert({
          chest_id: chestId,
          user_id: userId,
          points_awarded: pointsAwarded,
          picked_up_at: trx.fn.now(),
          chest_key: this.generateChestKey(chest.latitude, chest.longitude)
        });

        // Award points
        await trx('users')
          .where('id', userId)
          .increment('points', pointsAwarded);

        // Update daily task progress (collect_treasures)
        const DailyTaskController = require('../controllers/dailyTaskController');
        await DailyTaskController.updateTaskProgress(userId, 'collect_treasures', 1);
      });

      logger.info(`✅ User ${userId} picked up ${chest.rarity} chest, awarded ${pointsAwarded} points`);

      return {
        success: true,
        pointsAwarded,
        rarity: chest.rarity,
        chestId
      };
    } catch (error) {
      logger.error('Failed to pickup chest:', error);
      return { success: false, error: 'Failed to pickup chest' };
    }
  }

  /**
   * Check if user can pickup a chest (cooldown check)
   */
  static async canUserPickup(userId, chestId, chestLat, chestLng) {
    const chestKey = this.generateChestKey(chestLat, chestLng);
    const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);

    const recentPickup = await db('treasure_chest_pickups')
      .where('user_id', userId)
      .where('chest_key', chestKey)
      .where('picked_up_at', '>', cooldownTime)
      .orderBy('picked_up_at', 'desc')
      .first();

    if (recentPickup) {
      const elapsed = (Date.now() - new Date(recentPickup.picked_up_at).getTime()) / 1000;
      const remaining = Math.ceil(COOLDOWN_MINUTES * 60 - elapsed);
      return {
        allowed: false,
        cooldownRemaining: remaining
      };
    }

    return { allowed: true, cooldownRemaining: 0 };
  }

  /**
   * Expire old chests
   */
  static async expireOldChests() {
    const result = await db('treasure_chests')
      .where('is_active', true)
      .where('expires_at', '<', db.fn.now())
      .update({ is_active: false });

    if (result > 0) {
      logger.info(`✅ Expired ${result} old treasure chests`);
    }
    return result;
  }

  /**
   * Get reward configuration
   */
  static async getRewardConfig(rarity, city = 'global') {
    const config = await db('treasure_spawn_config')
      .where({ city, rarity, is_enabled: true })
      .first();

    if (!config) {
      // Fallback to global config
      const globalConfig = await db('treasure_spawn_config')
        .where({ city: 'global', rarity, is_enabled: true })
        .first();

      return globalConfig || {
        points_min: 10,
        points_max: 30
      };
    }

    return config;
  }

  /**
   * Generate chest key for cooldown tracking (location-based)
   */
  static generateChestKey(lat, lng) {
    // Round to ~100m precision for cooldown zones
    const latRounded = Math.round(lat * 1000) / 1000;
    const lngRounded = Math.round(lng * 1000) / 1000;
    return `${latRounded},${lngRounded}`;
  }

  /**
   * Generate random location within radius
   */
  static randomLocationInRadius(centerLat, centerLng, radiusMeters) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusMeters;

    const latOffset = (distance * Math.cos(angle)) / 111320;
    const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));

    return {
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset
    };
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

module.exports = TreasureChest;
module.exports.RARITY_LEVELS = RARITY_LEVELS;
module.exports.PICKUP_RANGE_METERS = PICKUP_RANGE_METERS;
module.exports.COOLDOWN_MINUTES = COOLDOWN_MINUTES;
