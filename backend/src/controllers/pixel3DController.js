/**
 * Pixel 3D Controller
 * Task: #11
 * Purpose: API endpoints for 3D pixel rendering with LOD support
 *
 * Features:
 * - Viewport-based data fetching with LOD strategy
 * - Redis caching for performance
 * - Layer detail queries for individual pixels
 * - Visual height calculation with logarithmic scaling
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { getRedis } = require('../config/redis');

class Pixel3DController {
  /**
   * Get 3D viewport data with LOD strategy
   * GET /api/pixels-3d/viewport
   *
   * Query params:
   * - minLat, maxLat, minLng, maxLng: Viewport bounds
   * - zoom: Zoom level (8-20)
   * - limit: Max results (default 10000)
   */
  static async getViewport3DData(req, res) {
    const startTime = Date.now();
    try {
      const {
        minLat,
        maxLat,
        minLng,
        maxLng,
        zoom = 14,
        limit = 10000
      } = req.query;

      // Validate parameters
      if (!minLat || !maxLat || !minLng || !maxLng) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: minLat, maxLat, minLng, maxLng'
        });
      }

      const bounds = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLng: parseFloat(minLng),
        maxLng: parseFloat(maxLng)
      };

      const zoomLevel = parseInt(zoom);
      const maxResults = parseInt(limit);

      // Validate bounds
      if (bounds.minLat >= bounds.maxLat || bounds.minLng >= bounds.maxLng) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bounds: min values must be less than max values'
        });
      }

      // Check Redis cache
      const cacheKey = `3d:viewport:${zoomLevel}:${minLat}:${maxLat}:${minLng}:${maxLng}:${maxResults}`;
      const redis = getRedis();

      if (redis && redis.isOpen) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const duration = Date.now() - startTime;
            logger.info(`[Performance] 3D viewport cache HIT in ${duration}ms`, { zoom: zoomLevel });
            return res.json(JSON.parse(cached));
          }
        } catch (redisError) {
          logger.warn('Redis cache read error', { error: redisError.message });
          // Continue without cache
        }
      }

      // Determine LOD strategy based on zoom level
      let data;
      if (zoomLevel <= 12) {
        // Low zoom: Use city-level aggregation (L2)
        data = await Pixel3DController.queryCityLevel(
          bounds.minLat,
          bounds.maxLat,
          bounds.minLng,
          bounds.maxLng,
          maxResults
        );
      } else if (zoomLevel <= 16) {
        // Medium zoom: Use block-level aggregation (L3)
        data = await Pixel3DController.queryBlockLevel(
          bounds.minLat,
          bounds.maxLat,
          bounds.minLng,
          bounds.maxLng,
          maxResults
        );
      } else {
        // High zoom: Use pixel-level data (L1)
        data = await Pixel3DController.queryPixelLevel(
          bounds.minLat,
          bounds.maxLat,
          bounds.minLng,
          bounds.maxLng,
          maxResults
        );
      }

      // Transform to rendering format
      const renderData = data.map(item => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lng),
        height: Pixel3DController.calculateVisualHeight(item.layer_count),
        rawHeight: parseInt(item.layer_count),
        color: item.color || '#808080',
        allianceId: item.alliance_id || null,
        gridId: item.grid_id || null
      }));

      const response = {
        success: true,
        data: {
          pixels: renderData,
          lodLevel: zoomLevel <= 12 ? 'L2' : (zoomLevel <= 16 ? 'L3' : 'L1'),
          zoom: zoomLevel,
          bounds,
          count: renderData.length
        }
      };

      // Cache the response (TTL: 5 minutes)
      if (redis && redis.isOpen) {
        try {
          await redis.setEx(cacheKey, 300, JSON.stringify(response));
        } catch (redisError) {
          logger.warn('Redis cache write error', { error: redisError.message });
          // Continue without caching
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`[Performance] 3D viewport query completed`, {
        lodLevel: response.data.lodLevel,
        zoom: zoomLevel,
        count: renderData.length,
        duration: `${duration}ms`,
        cached: false
      });

      res.json(response);

    } catch (error) {
      logger.error('Error fetching 3D viewport data', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch 3D viewport data',
        error: error.message
      });
    }
  }

  /**
   * Get layer details for a specific pixel column
   * GET /api/pixels-3d/column/:gridId/layers
   *
   * Query params:
   * - page: Page number (default 1)
   * - limit: Results per page (default 20)
   */
  static async getColumnLayers(req, res) {
    try {
      const { gridId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!gridId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: gridId'
        });
      }

      const pageNum = parseInt(page);
      const pageSize = parseInt(limit);
      const offset = (pageNum - 1) * pageSize;

      // Query layer history with user information
      const layersQuery = `
        SELECT
          ph.id,
          ph.created_at,
          ph.color,
          ph.user_id,
          ph.alliance_id,
          u.username,
          u.avatar_url
        FROM pixels_history ph
        LEFT JOIN users u ON ph.user_id = u.id
        WHERE ph.grid_id = ?
          AND ph.action_type = 'draw'
        ORDER BY ph.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM pixels_history
        WHERE grid_id = ?
          AND action_type = 'draw'
      `;

      const [layersResult, countResult] = await Promise.all([
        db.raw(layersQuery, [gridId, pageSize, offset]),
        db.raw(countQuery, [gridId])
      ]);

      const layers = layersResult.rows.map(row => ({
        id: row.id,
        timestamp: row.created_at,
        color: row.color,
        userId: row.user_id,
        username: row.username || 'Unknown',
        avatarUrl: row.avatar_url,
        allianceId: row.alliance_id
      }));

      const total = parseInt(countResult.rows[0]?.total || 0);

      res.json({
        success: true,
        data: {
          gridId,
          layers,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching column layers', {
        error: error.message,
        gridId: req.params.gridId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch column layers',
        error: error.message
      });
    }
  }

  /**
   * Query city-level aggregation (L2, ~1km resolution)
   * @private
   */
  static async queryCityLevel(minLat, maxLat, minLng, maxLng, limit) {
    const query = `
      SELECT
        lat_L2 as lat,
        lng_L2 as lng,
        total_layers as layer_count,
        representative_color as color,
        representative_alliance_id as alliance_id,
        NULL as grid_id
      FROM pixel_layer_stats_city
      WHERE lat_L2 >= ?
        AND lat_L2 <= ?
        AND lng_L2 >= ?
        AND lng_L2 <= ?
      ORDER BY total_layers DESC
      LIMIT ?
    `;

    const result = await db.raw(query, [minLat, maxLat, minLng, maxLng, limit]);
    return result.rows;
  }

  /**
   * Query block-level aggregation (L3, ~100m resolution)
   * @private
   */
  static async queryBlockLevel(minLat, maxLat, minLng, maxLng, limit) {
    const query = `
      SELECT
        lat_L3 as lat,
        lng_L3 as lng,
        total_layers as layer_count,
        representative_color as color,
        representative_alliance_id as alliance_id,
        NULL as grid_id
      FROM pixel_layer_stats_block
      WHERE lat_L3 >= ?
        AND lat_L3 <= ?
        AND lng_L3 >= ?
        AND lng_L3 <= ?
      ORDER BY total_layers DESC
      LIMIT ?
    `;

    const result = await db.raw(query, [minLat, maxLat, minLng, maxLng, limit]);
    return result.rows;
  }

  /**
   * Query pixel-level data (L1, ~1m resolution)
   * @private
   */
  static async queryPixelLevel(minLat, maxLat, minLng, maxLng, limit) {
    const query = `
      SELECT
        lat_L5 as lat,
        lng_L5 as lng,
        layer_count,
        dominant_color as color,
        dominant_alliance_id as alliance_id,
        grid_id
      FROM pixel_layer_stats
      WHERE lat_L5 >= ?
        AND lat_L5 <= ?
        AND lng_L5 >= ?
        AND lng_L5 <= ?
      ORDER BY layer_count DESC
      LIMIT ?
    `;

    const result = await db.raw(query, [minLat, maxLat, minLng, maxLng, limit]);
    return result.rows;
  }

  /**
   * Calculate visual height for 3D rendering
   * Uses logarithmic scaling to prevent extreme height differences
   *
   * Formula: min(log10(rawHeight + 1) * 10, 100)
   * - Single layer: ~0.3 units
   * - 10 layers: ~10 units
   * - 100 layers: ~20 units
   * - 1000 layers: ~30 units
   * - Max capped at 100 units
   *
   * @param {number} rawHeight - Raw layer count
   * @returns {number} Visual height for rendering
   */
  static calculateVisualHeight(rawHeight) {
    const height = parseInt(rawHeight) || 0;
    if (height === 0) return 0;

    // Logarithmic scaling with base 10
    const logHeight = Math.log10(height + 1) * 10;

    // Cap at 100 to prevent extreme heights
    return Math.min(logHeight, 100);
  }
}

module.exports = Pixel3DController;
