/**
 * Pixel Info API Endpoint
 *
 * Provides detailed pixel information including:
 * - User information (avatar, country, city)
 * - Alliance information (name, flag)
 * - Like status and count
 * - Geographic location data
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/pixels/:lat/:lng/info
 * Get detailed pixel information by coordinates
 *
 * Query parameters:
 * - lat: Latitude (decimal)
 * - lng: Longitude (decimal)
 *
 * Returns:
 * - Full pixel details with user, alliance, and geographic info
 */
async function getPixelInfo(req, res) {
  const { lat, lng } = req.params;
  const userId = req.user?.id;

  try {
    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    logger.info(`🔍 Fetching pixel info for: ${latitude}, ${longitude}, userId: ${userId || 'none'}`);

    // 🔥 FIX: Handle null/undefined userId by dynamically building the query
    // When userId is not available, skip the user_likes subquery
    let query;
    let params;

    if (userId) {
      // Full query with user like status
      query = `
        SELECT
          p.grid_id,
          p.user_id,
          p.color,
          p.pattern_id,
          p.created_at,
          p.updated_at,
          p.latitude,
          p.longitude,
          -- Privacy: Mask username
          CASE WHEN ps.hide_nickname = true THEN '匿名用户' ELSE COALESCE(u.username, '游客') END AS username,
          -- Privacy: Mask avatar
          CASE WHEN ps.hide_nickname = true THEN NULL ELSE u.avatar END AS avatar,
          CASE WHEN ps.hide_nickname = true THEN NULL ELSE u.avatar_url END AS avatar_url,
          u.country,
          u.city,
          u.province,
          am.alliance_id,
          -- Privacy: Mask alliance name
          CASE WHEN ps.hide_alliance = true THEN NULL ELSE a.name END AS alliance_name,
          -- Privacy: Mask alliance flag
          CASE WHEN (ps.hide_alliance = true OR ps.hide_alliance_flag = true) THEN NULL ELSE a.flag_unicode_char END AS alliance_flag,
          CASE WHEN (ps.hide_alliance = true OR ps.hide_alliance_flag = true) THEN NULL ELSE a.flag_pattern_id END AS alliance_flag_pattern_id,
          COALESCE(like_counts.like_count, 0) AS likes_count,
          CASE WHEN user_likes.pixel_id IS NOT NULL THEN true ELSE false END AS is_liked
        FROM pixels p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
        LEFT JOIN alliance_members am ON p.user_id = am.user_id AND am.status = 'active'
        LEFT JOIN alliances a ON am.alliance_id = a.id
        LEFT JOIN (
          SELECT
            pl.pixel_id,
            COUNT(*)::integer AS like_count
          FROM pixel_likes pl
          INNER JOIN pixels p2 ON pl.pixel_id = p2.grid_id
          WHERE ABS(p2.latitude - ?) < 0.000001
            AND ABS(p2.longitude - ?) < 0.000001
          GROUP BY pl.pixel_id
        ) like_counts ON p.grid_id = like_counts.pixel_id
        LEFT JOIN (
          SELECT
            pl.pixel_id
          FROM pixel_likes pl
          INNER JOIN pixels p2 ON pl.pixel_id = p2.grid_id
          WHERE pl.user_id = ?
            AND ABS(p2.latitude - ?) < 0.000001
            AND ABS(p2.longitude - ?) < 0.000001
        ) user_likes ON p.grid_id = user_likes.pixel_id
        WHERE ABS(p.latitude - ?) < 0.000001
          AND ABS(p.longitude - ?) < 0.000001
        LIMIT 1
      `;
      params = [latitude, longitude, userId, latitude, longitude, latitude, longitude];
    } else {
      // Simplified query without user like status (for guest users)
      query = `
        SELECT
          p.grid_id,
          p.user_id,
          p.color,
          p.pattern_id,
          p.created_at,
          p.updated_at,
          p.latitude,
          p.longitude,
          -- Privacy: Mask username
          CASE WHEN ps.hide_nickname = true THEN '匿名用户' ELSE COALESCE(u.username, '游客') END AS username,
          -- Privacy: Mask avatar
          CASE WHEN ps.hide_nickname = true THEN NULL ELSE u.avatar END AS avatar,
          CASE WHEN ps.hide_nickname = true THEN NULL ELSE u.avatar_url END AS avatar_url,
          u.country,
          u.city,
          u.province,
          am.alliance_id,
          -- Privacy: Mask alliance name
          CASE WHEN ps.hide_alliance = true THEN NULL ELSE a.name END AS alliance_name,
          -- Privacy: Mask alliance flag
          CASE WHEN (ps.hide_alliance = true OR ps.hide_alliance_flag = true) THEN NULL ELSE a.flag_unicode_char END AS alliance_flag,
          CASE WHEN (ps.hide_alliance = true OR ps.hide_alliance_flag = true) THEN NULL ELSE a.flag_pattern_id END AS alliance_flag_pattern_id,
          COALESCE(like_counts.like_count, 0) AS likes_count,
          false AS is_liked
        FROM pixels p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
        LEFT JOIN alliance_members am ON p.user_id = am.user_id AND am.status = 'active'
        LEFT JOIN alliances a ON am.alliance_id = a.id
        LEFT JOIN (
          SELECT
            pl.pixel_id,
            COUNT(*)::integer AS like_count
          FROM pixel_likes pl
          INNER JOIN pixels p2 ON pl.pixel_id = p2.grid_id
          WHERE ABS(p2.latitude - ?) < 0.000001
            AND ABS(p2.longitude - ?) < 0.000001
          GROUP BY pl.pixel_id
        ) like_counts ON p.grid_id = like_counts.pixel_id
        WHERE ABS(p.latitude - ?) < 0.000001
          AND ABS(p.longitude - ?) < 0.000001
        LIMIT 1
      `;
      params = [latitude, longitude, latitude, longitude];
    }

    const result = await db.raw(query, params);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pixel not found at these coordinates'
      });
    }

    const pixel = result.rows[0];

    // Format response
    const response = {
      success: true,
      pixel: {
        grid_id: pixel.grid_id,
        user_id: pixel.user_id,
        username: pixel.username,
        avatar: pixel.avatar,
        avatar_url: pixel.avatar_url,
        color: pixel.color,
        pattern_id: pixel.pattern_id,
        country: pixel.country || 'cn',
        city: pixel.city,
        province: pixel.province,
        alliance_id: pixel.alliance_id,
        alliance_name: pixel.alliance_name,
        alliance_flag: pixel.alliance_flag,
        likes_count: pixel.likes_count || 0,
        is_liked: pixel.is_liked || false,
        created_at: pixel.created_at,
        updated_at: pixel.updated_at,
        lat: pixel.latitude,
        lng: pixel.longitude
      }
    };

    logger.info(`✅ Pixel info retrieved: ${pixel.grid_id} by ${pixel.username}`);

    res.json(response);

  } catch (error) {
    logger.error(`❌ Error fetching pixel info:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

module.exports = {
  getPixelInfo
};