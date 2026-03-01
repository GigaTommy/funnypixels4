/**
 * Production MVT Tile Query with Zoom-based Thinning
 *
 * Critical Features:
 * - ST_AsMVT for native MVT encoding (10x faster than geojson-vt)
 * - FULL PIXEL DISPLAY: No sampling at zoom 12-17 (like wplace.live)
 * - Separate source-layers for color/emoji/complex/ad
 * - Grid-snapped coordinates to prevent jitter
 *
 * Zoom Strategy:
 * - z < 12: 1% sampling (pixels not visible)
 * - z 12-17: 100% sampling (full pixel display)
 * - z > 17: 100% sampling (maintained resolution)
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

/**
 * Convert tile coordinates (z/x/y) to WGS84 bounding box
 * Used for B-Tree BETWEEN pre-filter (replaces GiST ST_Intersects)
 */
function tileBoundsWGS84(z, x, y) {
  const n = Math.pow(2, z);
  const west = x / n * 360 - 180;
  const east = (x + 1) / n * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  return { north, south, east, west };
}

/**
 * Get MVT tile with zoom-based thinning
 *
 * @param {number} z - Zoom level (8-20)
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @returns {Promise<Buffer>} - MVT PBF buffer
 */
async function getMVTTile(z, x, y) {
  const startTime = Date.now();

  // Zoom-based thinning strategy
  // 🔧 wplace.live 风格：full pixel display at zoom 12-18 (no sampling)
  let samplingRate = 1.0; // 100% = no thinning
  let maxFeatures = 10000;

  if (z < 12) {
    // Below minimum pixel display zoom - ultra-sparse (prevent overload)
    samplingRate = 0.01; // 1% sampling
    maxFeatures = 500;
  } else if (z >= 12 && z <= 18) {
    // 🔧 Full pixel display zoom range - 100% sampling for complete visibility
    // 前端 maxZoom = 17.75，瓦片请求使用整数zoom，最高请求zoom 17
    // 保留 z <= 18 边界作为安全缓冲
    samplingRate = 1.0; // No sampling - show ALL pixels
    maxFeatures = 100000; // Increased limit for high-density areas
  } else {
    // Above max zoom (z > 18) - ultra-sparse sampling for performance
    samplingRate = 0.01; // 1% sampling
    maxFeatures = 500;
  }

  try {
    // B-Tree pre-filter: convert tile coords to WGS84 bounds
    const bounds = tileBoundsWGS84(z, x, y);

    // Use PostGIS ST_AsMVT for native MVT encoding
    // B-Tree BETWEEN replaces GiST ST_Intersects (no GiST index dependency)
    const result = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
          p.user_id,
          COALESCE(u.username, '游客') AS username,
          u.avatar,
          u.avatar_url,
          COALESCE(p.country, 'cn') AS country,
          p.city,
          p.alliance_id,
          a.name AS alliance_name,
          COALESCE(a.flag_unicode_char, a.flag_pattern_id) AS alliance_flag,
          CASE
          -- 优先使用pixels.pixel_type字段判断（特殊类型）
          WHEN p.pixel_type = 'ad' THEN 'ad'  -- 广告像素
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          WHEN p.pixel_type = 'alliance' THEN
            -- 联盟像素：根据旗帜类型分类
            CASE
              WHEN a.flag_unicode_char IS NOT NULL AND a.flag_unicode_char != '' THEN 'emoji'
              WHEN a.flag_render_type = 'complex' THEN 'complex'
              ELSE 'color'
            END
          WHEN p.pixel_type = 'event' THEN 'event'  -- 活动像素
          WHEN p.pixel_type = 'bomb' THEN
            -- 炸弹像素：根据pattern_assets的render_type重新分类到对应渲染层
            CASE
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              ELSE 'color'
            END
          -- 对于basic类型，根据pattern_assets.render_type重新分类
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              -- 🔧 高效检测：通过字段组合识别用户头像（无需LIKE模糊匹配）
              -- 用户头像特征：color='custom_pattern' AND alliance_id IS NULL
              WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              WHEN pa.render_type = 'default' THEN 'color'  -- default类型归类为color
              ELSE 'color'  -- 如果没有pattern_asset，则为color
            END
          -- 兼容旧数据：如果pattern_id为空，则为color
          WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
          ELSE 'color'  -- 默认为color
        END AS pixel_type,
          -- color类型：使用pattern_assets.color，回退到pixels.color（防止pa.color为NULL时丢失像素）
          CASE
            WHEN pa.render_type = 'color' THEN COALESCE(pa.color, p.color)
            WHEN p.pixel_type = 'alliance' AND a.flag_render_type = 'color' THEN COALESCE(a.color, p.color)
            -- 🔧 用户头像兜底：如果 color='custom_pattern'，fallback 到默认绿色
            WHEN p.color = 'custom_pattern' THEN '#4ECDC4'
            ELSE p.color
          END AS display_color,
          COALESCE(p.pattern_id, a.flag_pattern_id) AS pattern_id,
          p.related_id,  -- 添加related_id字段，广告像素关联的广告放置ID
          ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326) AS geom,
          p.created_at,
          ps.hide_nickname,
          ps.hide_alliance,
          ps.hide_alliance_flag,
          -- emoji类型的unicode字符（包括pattern_assets和alliance旗帜）
          COALESCE(
            CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
            a.flag_unicode_char
          ) AS emoji_char,
          -- complex类型的图片URL
          CASE
            -- 用户头像：通过字段组合识别（color='custom_pattern' AND alliance_id IS NULL）
            -- 动态从 users.avatar_url 获取（不预存在 pattern_assets）
            WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
            -- pattern_assets 中的 complex 图案
            WHEN pa.render_type = 'complex' THEN
              CASE
                WHEN pa.file_url IS NOT NULL THEN pa.file_url
                WHEN pa.file_path IS NOT NULL THEN pa.file_path
                ELSE NULL
              END
            ELSE NULL
          END AS image_url
        FROM pixels p
        LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE
          -- B-Tree pre-filter (uses idx_pixels_lat_lng_created)
          p.longitude BETWEEN ? AND ?
          AND p.latitude BETWEEN ? AND ?
          -- Zoom-based sampling (deterministic based on grid_id hash)
          AND (
            ? >= 1.0 OR
            (hashtext(p.grid_id::text)::bigint % 100) < ?
          )
        LIMIT ?
      ),
      -- Separate layers for color/emoji/complex
      mvt_color AS (
        SELECT ST_AsMVT(tile, 'pixels-color', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            user_id,
            -- Privacy: Hide username
            CASE WHEN hide_nickname = true THEN '匿名用户' ELSE COALESCE(username, '游客') END AS username,
            -- Privacy: Hide avatar
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar END AS avatar,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar_url END AS avatar_url,
            country,
            city,
            alliance_id,
            -- Privacy: Hide alliance info
            CASE WHEN hide_alliance = true THEN NULL ELSE alliance_name END AS alliance_name,
            -- Privacy: Hide alliance flag
            CASE WHEN (hide_alliance = true OR hide_alliance_flag = true) THEN NULL ELSE alliance_flag END AS alliance_flag,
            COALESCE(display_color, '#4ECDC4') AS color,  -- 使用display_color，fallback为默认绿色
            pattern_id,
            ST_AsMVTGeom(
              geom,
              (SELECT geom FROM tile_bounds),
              4096,
              8,  -- reduced buffer to prevent extent errors
              true  -- clip to tile bounds
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'color'
            AND display_color IS NOT NULL
            AND geom IS NOT NULL
        ) AS tile
      ),
      mvt_emoji AS (
        SELECT ST_AsMVT(tile, 'pixels-emoji', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            user_id,
            -- Privacy: Hide username
            CASE WHEN hide_nickname = true THEN '匿名用户' ELSE COALESCE(username, '游客') END AS username,
            -- Privacy: Hide avatar
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar END AS avatar,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar_url END AS avatar_url,
            country,
            city,
            alliance_id,
            -- Privacy: Hide alliance info
            CASE WHEN hide_alliance = true THEN NULL ELSE alliance_name END AS alliance_name,
            -- Privacy: Hide alliance flag
            CASE WHEN (hide_alliance = true OR hide_alliance_flag = true) THEN NULL ELSE alliance_flag END AS alliance_flag,
            emoji_char AS emoji,  -- 使用emoji_char字段
            pattern_id,
            ST_AsMVTGeom(
              geom,
              (SELECT geom FROM tile_bounds),
              4096,
              8,  -- buffer to match color layer
              true  -- clip to tile bounds
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'emoji'
            AND geom IS NOT NULL
            AND emoji_char IS NOT NULL
        ) AS tile
      ),
      mvt_complex AS (
        SELECT ST_AsMVT(tile, 'pixels-complex', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            user_id,
            -- Privacy: Hide username
            CASE WHEN hide_nickname = true THEN '匿名用户' ELSE COALESCE(username, '游客') END AS username,
            -- Privacy: Hide avatar
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar END AS avatar,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar_url END AS avatar_url,
            country,
            city,
            alliance_id,
            -- Privacy: Hide alliance info
            CASE WHEN hide_alliance = true THEN NULL ELSE alliance_name END AS alliance_name,
            -- Privacy: Hide alliance flag
            CASE WHEN (hide_alliance = true OR hide_alliance_flag = true) THEN NULL ELSE alliance_flag END AS alliance_flag,
            pattern_id,
            image_url,  -- 添加图片URL字段
            ST_AsMVTGeom(
              geom,
              (SELECT geom FROM tile_bounds),
              4096,
              8,  -- buffer to match color layer
              true  -- clip to tile bounds
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'complex'
            AND pattern_id IS NOT NULL
            AND geom IS NOT NULL
        ) AS tile
      ),
      mvt_ad AS (
        SELECT ST_AsMVT(tile, 'pixels-ad', 4096, 'mvt_geom') AS mvt
        FROM (
          SELECT
            id,
            grid_id,
            user_id,
            -- Privacy: Hide username
            CASE WHEN hide_nickname = true THEN '匿名用户' ELSE COALESCE(username, '游客') END AS username,
            -- Privacy: Hide avatar
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar END AS avatar,
            CASE WHEN hide_nickname = true THEN NULL ELSE avatar_url END AS avatar_url,
            country,
            city,
            alliance_id,
            -- Privacy: Hide alliance info
            CASE WHEN hide_alliance = true THEN NULL ELSE alliance_name END AS alliance_name,
            -- Privacy: Hide alliance flag
            CASE WHEN (hide_alliance = true OR hide_alliance_flag = true) THEN NULL ELSE alliance_flag END AS alliance_flag,
            COALESCE(display_color, '#4ECDC4') AS color,  -- fallback为默认绿色
            related_id AS ad_placement_id,
            pattern_id,
            ST_AsMVTGeom(
              geom,
              (SELECT geom FROM tile_bounds),
              4096,
              8,  -- reduced buffer to prevent extent errors
              true  -- clip to tile bounds
            ) AS mvt_geom
          FROM pixels_in_tile
          WHERE pixel_type = 'ad'
            AND display_color IS NOT NULL
            AND geom IS NOT NULL
        ) AS tile
      )
      -- Combine all layers with debug sizes
      -- 🔧 FIX: Use COALESCE to handle NULL layers (prevent NULL concatenation)
      -- When a layer has no features, ST_AsMVT returns NULL
      -- NULL || anything = NULL in PostgreSQL, so we need COALESCE
      SELECT
        COALESCE((SELECT mvt FROM mvt_color), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_emoji), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_complex), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_ad), ''::bytea)
      AS mvt,
      LENGTH(COALESCE((SELECT mvt FROM mvt_color), ''::bytea)) AS color_size,
      LENGTH(COALESCE((SELECT mvt FROM mvt_emoji), ''::bytea)) AS emoji_size,
      LENGTH(COALESCE((SELECT mvt FROM mvt_complex), ''::bytea)) AS complex_size,
      LENGTH(COALESCE((SELECT mvt FROM mvt_ad), ''::bytea)) AS ad_size
    `, [z, x, y, bounds.west, bounds.east, bounds.south, bounds.north, samplingRate, Math.floor(samplingRate * 100), maxFeatures]);

    const elapsed = Date.now() - startTime;

    if (elapsed > 200) {
      logger.warn(`⚠️ Slow MVT query: ${z}/${x}/${y} took ${elapsed}ms`);
    }

    const row = result.rows[0];
    const mvtBuffer = row?.mvt;

    // 🔧 DEBUG: Log MVT buffer size and layer sizes for diagnostics
    if (mvtBuffer) {
      logger.info(`🔍 [MVT Debug] ${z}/${x}/${y} - Total: ${mvtBuffer.length}B | Color: ${row.color_size}B | Emoji: ${row.emoji_size}B | Complex: ${row.complex_size}B | Ad: ${row.ad_size}B`);
    } else {
      logger.warn(`⚠️ [MVT Debug] ${z}/${x}/${y} - Buffer is NULL or undefined`);
    }

    return mvtBuffer || Buffer.alloc(0);

  } catch (error) {
    logger.error(`❌ MVT query failed: ${z}/${x}/${y}`, error);
    throw error;
  }
}

/**
 * Get affected tiles for cache invalidation
 */
function getAffectedTiles(lat, lng, minZoom = 12, maxZoom = 18) {
  const tiles = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const n = Math.pow(2, z);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    tiles.push({ z, x, y });
  }

  return tiles;
}

module.exports = {
  getMVTTile,
  getAffectedTiles
};
