const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

class RegionInfoController {
  /**
   * GET /api/map-social/region-info?lat=&lng=
   * Returns region info for the given coordinates
   */
  static async getRegionInfo(req, res) {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'lat and lng are required'
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      // Get region name from recent pixels in this area (bounding box ~500m)
      const delta = 0.005; // ~500m
      const recentPixel = await db('pixels')
        .whereBetween('latitude', [latitude - delta, latitude + delta])
        .whereBetween('longitude', [longitude - delta, longitude + delta])
        .whereNotNull('city')
        .select('city', 'district', 'province', 'country')
        .orderBy('created_at', 'desc')
        .first();

      const regionName = recentPixel
        ? (recentPixel.district || recentPixel.city || recentPixel.province || '')
        : '';
      const cityName = recentPixel?.city || '';
      const countryName = recentPixel?.country || '';

      // Count total pixels in this area
      const pixelStats = await db('pixels')
        .whereBetween('latitude', [latitude - delta, latitude + delta])
        .whereBetween('longitude', [longitude - delta, longitude + delta])
        .count('id as total_pixels')
        .first();

      // Count active players from Redis
      let activePlayers = 0;
      try {
        const redis = getRedis();
        if (redis) {
          const results = await redis.geoSearch(
            'active_players:geo',
            { longitude, latitude },
            { radius: 1000, unit: 'm' },
            { COUNT: 100 }
          );
          activePlayers = results ? results.length : 0;
        }
      } catch (e) {
        // Redis not available, skip
      }

      // Find dominant alliance in this area
      let controllingAlliance = null;
      try {
        const alliancePixels = await db('pixels')
          .whereBetween('latitude', [latitude - delta, latitude + delta])
          .whereBetween('longitude', [longitude - delta, longitude + delta])
          .whereNotNull('alliance_id')
          .select('alliance_id')
          .count('id as pixel_count')
          .groupBy('alliance_id')
          .orderBy('pixel_count', 'desc')
          .first();

        if (alliancePixels && alliancePixels.alliance_id) {
          const alliance = await db('alliances')
            .where('id', alliancePixels.alliance_id)
            .select('id', 'name', 'flag_pattern_id', 'flag_colors')
            .first();

          if (alliance) {
            controllingAlliance = {
              id: alliance.id,
              name: alliance.name,
              flagPatternId: alliance.flag_pattern_id,
              flagColors: alliance.flag_colors,
              pixelCount: parseInt(alliancePixels.pixel_count)
            };
          }
        }
      } catch (e) {
        // alliance_id column may not exist on pixels, skip
      }

      res.json({
        success: true,
        data: {
          region_name: regionName,
          city: cityName,
          country: countryName,
          total_pixels: parseInt(pixelStats?.total_pixels) || 0,
          active_players: activePlayers,
          controlling_alliance: controllingAlliance
        }
      });
    } catch (error) {
      logger.error('获取区域信息失败:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get region info'
      });
    }
  }
}

module.exports = RegionInfoController;
