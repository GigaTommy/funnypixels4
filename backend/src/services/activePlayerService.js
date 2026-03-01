const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

const ACTIVE_PLAYERS_KEY = 'active_players:geo';
const PLAYER_DATA_PREFIX = 'active_player:';
const PLAYER_TTL = 300; // 5 minutes

class ActivePlayerService {
  /**
   * Update player location in Redis GEO
   */
  static async updatePlayerLocation(userId, lat, lng, playerData = {}) {
    const redis = getRedis();
    if (!redis) return;

    try {
      // Store location in GEO set
      await redis.geoAdd(ACTIVE_PLAYERS_KEY, {
        longitude: lng,
        latitude: lat,
        member: userId
      });

      // Store player metadata with TTL
      const dataKey = `${PLAYER_DATA_PREFIX}${userId}`;
      await redis.set(dataKey, JSON.stringify({
        userId,
        username: playerData.username || '',
        displayName: playerData.displayName || '',
        avatarUrl: playerData.avatarUrl || '',
        avatar: playerData.avatar || '',
        rankTier: playerData.rankTier || null,
        allianceName: playerData.allianceName || '',
        totalPixels: playerData.totalPixels || 0,
        isDrawing: playerData.isDrawing || false,
        updatedAt: Date.now()
      }), { EX: PLAYER_TTL });
    } catch (error) {
      logger.error('Failed to update player location:', error.message);
    }
  }

  /**
   * Get nearby players within radius (meters)
   */
  static async getNearbyPlayers(lat, lng, radius = 500, excludeUserId = null) {
    const redis = getRedis();
    if (!redis) return [];

    try {
      // Search nearby players using GEOSEARCH
      const results = await redis.geoSearch(
        ACTIVE_PLAYERS_KEY,
        { longitude: lng, latitude: lat },
        { radius, unit: 'm' },
        { SORT: 'ASC', COUNT: 50 }
      );

      if (!results || results.length === 0) return [];

      // Get player data for each result
      const players = [];
      for (const memberId of results) {
        if (excludeUserId && memberId === excludeUserId) continue;

        const dataKey = `${PLAYER_DATA_PREFIX}${memberId}`;
        const data = await redis.get(dataKey);

        if (data) {
          const playerData = JSON.parse(data);
          // Check if data is still fresh (within TTL)
          if (Date.now() - playerData.updatedAt < PLAYER_TTL * 1000) {
            // Get distance
            const dist = await redis.geoDist(ACTIVE_PLAYERS_KEY, excludeUserId || 'origin', memberId, 'm');

            // Get position
            const positions = await redis.geoPos(ACTIVE_PLAYERS_KEY, memberId);
            const pos = positions && positions[0] ? positions[0] : null;

            players.push({
              ...playerData,
              latitude: pos ? parseFloat(pos.latitude) : lat,
              longitude: pos ? parseFloat(pos.longitude) : lng,
              distance: dist ? parseFloat(dist) : 0
            });
          }
        }
      }

      return players;
    } catch (error) {
      logger.error('Failed to get nearby players:', error.message);
      return [];
    }
  }

  /**
   * Remove player from active tracking
   */
  static async removePlayer(userId) {
    const redis = getRedis();
    if (!redis) return;

    try {
      await redis.zRem(ACTIVE_PLAYERS_KEY, userId);
      await redis.del(`${PLAYER_DATA_PREFIX}${userId}`);
    } catch (error) {
      logger.error('Failed to remove player:', error.message);
    }
  }

  /**
   * Cleanup stale players (those whose data TTL has expired)
   */
  static async cleanupStalePlayers() {
    const redis = getRedis();
    if (!redis) return;

    try {
      // Get all members in the GEO set
      const members = await redis.zRange(ACTIVE_PLAYERS_KEY, 0, -1);

      for (const memberId of members) {
        const dataKey = `${PLAYER_DATA_PREFIX}${memberId}`;
        const exists = await redis.exists(dataKey);
        if (!exists) {
          // Data expired, remove from GEO set
          await redis.zRem(ACTIVE_PLAYERS_KEY, memberId);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup stale players:', error.message);
    }
  }
}

module.exports = ActivePlayerService;
