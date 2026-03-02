const TreasureChest = require('../models/TreasureChest');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Treasure Spawn Service
 *
 * Scheduled service to spawn treasure chests
 * - Runs via cron or Bull queue
 * - Spawns based on configuration
 * - Cleans up expired chests
 */

class TreasureSpawnService {
  /**
   * Spawn normal chests (every hour)
   */
  static async spawnNormalChests() {
    try {
      const config = await db('treasure_spawn_config')
        .where({ rarity: 'normal', is_enabled: true })
        .first();

      if (!config) {
        logger.warn('No configuration found for normal chests');
        return;
      }

      // Get major cities or use default global spawn
      const cities = await this.getSpawnCities();

      for (const city of cities) {
        await TreasureChest.spawn({
          latitude: city.lat,
          longitude: city.lng,
          radius: city.radius || 10000, // 10km
          rarity: 'normal',
          quantity: config.quantity_per_spawn,
          durationMinutes: config.duration_minutes,
          city: city.name
        });
      }

      logger.info(`✅ Spawned normal chests for ${cities.length} cities`);
    } catch (error) {
      logger.error('Failed to spawn normal chests:', error);
    }
  }

  /**
   * Spawn rare chests (every 6 hours)
   */
  static async spawnRareChests() {
    try {
      const config = await db('treasure_spawn_config')
        .where({ rarity: 'rare', is_enabled: true })
        .first();

      if (!config) {
        logger.warn('No configuration found for rare chests');
        return;
      }

      const cities = await this.getSpawnCities();

      for (const city of cities) {
        await TreasureChest.spawn({
          latitude: city.lat,
          longitude: city.lng,
          radius: city.radius || 15000, // 15km
          rarity: 'rare',
          quantity: config.quantity_per_spawn,
          durationMinutes: config.duration_minutes,
          city: city.name
        });
      }

      logger.info(`✅ Spawned rare chests for ${cities.length} cities`);
    } catch (error) {
      logger.error('Failed to spawn rare chests:', error);
    }
  }

  /**
   * Spawn epic chests (daily)
   */
  static async spawnEpicChests() {
    try {
      const config = await db('treasure_spawn_config')
        .where({ rarity: 'epic', is_enabled: true })
        .first();

      if (!config) {
        logger.warn('No configuration found for epic chests');
        return;
      }

      const cities = await this.getSpawnCities();

      for (const city of cities) {
        await TreasureChest.spawn({
          latitude: city.lat,
          longitude: city.lng,
          radius: city.radius || 20000, // 20km
          rarity: 'epic',
          quantity: config.quantity_per_spawn,
          durationMinutes: config.duration_minutes,
          city: city.name
        });
      }

      logger.info(`✅ Spawned epic chests for ${cities.length} cities`);

      // Create notification for epic spawns
      const MapNotification = require('../models/MapNotification');
      for (const city of cities) {
        await MapNotification.createTreasureRefresh(
          city.name,
          config.quantity_per_spawn,
          { lat: city.lat, lng: city.lng }
        );
      }
    } catch (error) {
      logger.error('Failed to spawn epic chests:', error);
    }
  }

  /**
   * Cleanup expired chests
   */
  static async cleanupExpiredChests() {
    try {
      const count = await TreasureChest.expireOldChests();
      if (count > 0) {
        logger.info(`✅ Cleaned up ${count} expired treasure chests`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired chests:', error);
    }
  }

  /**
   * Get cities for spawning
   * TODO: Integrate with regions or user activity hotspots
   */
  static async getSpawnCities() {
    // For now, return default major cities
    // TODO: Query from city_hotspot_stats or regions table
    return [
      { name: 'Beijing', lat: 39.9042, lng: 116.4074, radius: 20000 },
      { name: 'Shanghai', lat: 31.2304, lng: 121.4737, radius: 20000 },
      { name: 'San Francisco', lat: 37.7749, lng: -122.4194, radius: 15000 },
      { name: 'New York', lat: 40.7128, lng: -74.0060, radius: 15000 },
      { name: 'London', lat: 51.5074, lng: -0.1278, radius: 15000 },
      { name: 'Tokyo', lat: 35.6762, lng: 139.6503, radius: 20000 }
    ];
  }

  /**
   * Initialize scheduled spawning
   * Call this from server.js or a separate cron service
   */
  static initializeScheduledSpawning() {
    // Spawn normal chests every hour
    setInterval(() => {
      this.spawnNormalChests();
    }, 60 * 60 * 1000);

    // Spawn rare chests every 6 hours
    setInterval(() => {
      this.spawnRareChests();
    }, 6 * 60 * 60 * 1000);

    // Spawn epic chests daily
    setInterval(() => {
      this.spawnEpicChests();
    }, 24 * 60 * 60 * 1000);

    // Cleanup expired chests every 10 minutes
    setInterval(() => {
      this.cleanupExpiredChests();
    }, 10 * 60 * 1000);

    // Initial spawns
    this.spawnNormalChests();
    this.cleanupExpiredChests();

    logger.info('✅ Treasure spawn service initialized');
  }
}

module.exports = TreasureSpawnService;
