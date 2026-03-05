/**
 * System Brush Service
 *
 * Provides functions to programmatically draw pixel art patterns on the map.
 * Used for pre-seeding the world with official pixel art at key cities,
 * so the map is not empty when users first open the app.
 *
 * This service bypasses the normal pixel drawing pipeline (no user validation,
 * no point consumption, no geocoding, no websocket broadcasts) and writes
 * directly to the database in batches for maximum efficiency.
 */

const { db } = require('../config/database');
const { calculateGridId, snapToGrid, GRID_CONFIG } = require('../../shared/utils/gridUtils');
const logger = require('../utils/logger');

// System user UUID - a well-known constant for pixels placed by the system
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Batch insert chunk size
const BATCH_CHUNK_SIZE = 500;

/**
 * Ensure the system user exists in the users table.
 * Creates the user if it does not already exist.
 * This is required because the pixels table has a foreign key to users.
 *
 * @returns {string} The system user ID
 */
async function ensureSystemUser() {
  const existing = await db('users')
    .where('id', SYSTEM_USER_ID)
    .first();

  if (existing) {
    logger.info(`System user already exists: ${SYSTEM_USER_ID}`);
    return SYSTEM_USER_ID;
  }

  // Create the system user
  await db('users').insert({
    id: SYSTEM_USER_ID,
    username: 'system',
    email: 'system@funnypixels.app',
    password_hash: 'SYSTEM_USER_NO_LOGIN',
    display_name: 'FunnyPixels Official',
    bio: 'Official system account for pre-seeded pixel art',
    role: 'system',
    is_guest: false,
    is_banned: false,
    total_pixels: 0,
    current_pixels: 0,
    created_at: new Date(),
    updated_at: new Date()
  });

  // Create user_pixel_states entry for the system user
  await db('user_pixel_states').insert({
    user_id: SYSTEM_USER_ID,
    pixel_points: 999999,
    item_pixel_points: 999999,
    natural_pixel_points: 999999,
    max_natural_pixel_points: 999999,
    freeze_until: 0,
    is_in_natural_accumulation: false,
    last_activity_time: Math.floor(Date.now() / 1000),
    created_at: new Date(),
    updated_at: new Date()
  });

  logger.info(`System user created: ${SYSTEM_USER_ID}`);
  return SYSTEM_USER_ID;
}

/**
 * Draw a 2D pixel art pattern on the map at the given geographic center.
 *
 * Each cell in the pattern array maps to one pixel on the grid.
 * The GRID_SIZE (0.0001 degrees) determines the physical spacing.
 *
 * @param {Array<Array<string|null>>} pattern - 2D array of hex color strings (null = skip)
 * @param {number} centerLat - Latitude of the center point
 * @param {number} centerLng - Longitude of the center point
 * @param {Object} options - Drawing options
 * @param {string} options.userId - User ID to assign pixels to (default: SYSTEM_USER_ID)
 * @param {string|null} options.allianceId - Alliance ID to assign pixels to (default: null)
 * @param {number} options.scale - Scale factor: 1 = one grid cell per pixel (default: 1)
 * @param {string} options.patternId - Pattern asset key to assign (default: null)
 * @returns {Object} Result with count of pixels drawn
 */
async function drawPattern(pattern, centerLat, centerLng, options = {}) {
  const {
    userId = SYSTEM_USER_ID,
    allianceId = null,
    scale = 1,
    patternId = null
  } = options;

  if (!pattern || !Array.isArray(pattern) || pattern.length === 0) {
    throw new Error('Pattern must be a non-empty 2D array');
  }

  const height = pattern.length;
  const width = Math.max(...pattern.map(row => row.length));

  // Calculate the offset so that the pattern is centered on the given coordinates
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  const gridStep = GRID_CONFIG.GRID_SIZE * scale;

  const pixelsToInsert = [];
  const now = new Date();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      const color = pattern[row][col];
      if (!color) continue; // null = skip this cell

      // Calculate geographic position
      // Row 0 is at the top (higher latitude), increasing rows go south
      const lat = centerLat + (halfHeight - row) * gridStep;
      const lng = centerLng + (col - halfWidth) * gridStep;

      // Snap to the grid to ensure alignment
      const snapped = snapToGrid(lat, lng);

      pixelsToInsert.push({
        grid_id: snapped.gridId,
        latitude: snapped.lat,
        longitude: snapped.lng,
        color: color,
        user_id: userId,
        pattern_id: patternId,
        pattern_anchor_x: 0,
        pattern_anchor_y: 0,
        pattern_rotation: 0,
        pattern_mirror: false,
        pixel_type: 'basic',
        related_id: null,
        alliance_id: allianceId,
        session_id: null,
        version: 1,
        geocoded: false,
        created_at: now,
        updated_at: now
      });
    }
  }

  if (pixelsToInsert.length === 0) {
    return { success: true, pixelsDrawn: 0, message: 'Pattern contained no pixels' };
  }

  // Batch insert using ON CONFLICT to make it idempotent
  let totalInserted = 0;

  for (let i = 0; i < pixelsToInsert.length; i += BATCH_CHUNK_SIZE) {
    const chunk = pixelsToInsert.slice(i, i + BATCH_CHUNK_SIZE);

    const result = await db('pixels')
      .insert(chunk)
      .onConflict('grid_id')
      .merge({
        color: db.raw('EXCLUDED.color'),
        user_id: db.raw('EXCLUDED.user_id'),
        pattern_id: db.raw('EXCLUDED.pattern_id'),
        alliance_id: db.raw('EXCLUDED.alliance_id'),
        updated_at: db.raw('EXCLUDED.updated_at')
      })
      .returning('id');

    totalInserted += result.length;
  }

  logger.info(`Pattern drawn at (${centerLat}, ${centerLng}): ${totalInserted} pixels`, {
    patternSize: `${width}x${height}`,
    scale,
    userId,
    allianceId
  });

  return {
    success: true,
    pixelsDrawn: totalInserted,
    center: { lat: centerLat, lng: centerLng },
    patternSize: { width, height }
  };
}

/**
 * Check if a pattern has already been placed at a given location.
 * Used for idempotency: skip drawing if already placed.
 *
 * Checks by looking for system-user pixels within a small bounding box
 * around the given center coordinates.
 *
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} radius - Search radius in grid cells (default: 20)
 * @param {string} userId - User ID to check for (default: SYSTEM_USER_ID)
 * @returns {boolean} True if pixels already exist at this location
 */
async function hasPatternAt(centerLat, centerLng, radius = 20, userId = SYSTEM_USER_ID) {
  const gridStep = GRID_CONFIG.GRID_SIZE;
  const latRange = radius * gridStep;
  const lngRange = radius * gridStep;

  const count = await db('pixels')
    .where('user_id', userId)
    .whereBetween('latitude', [centerLat - latRange, centerLat + latRange])
    .whereBetween('longitude', [centerLng - lngRange, centerLng + lngRange])
    .count('* as count')
    .first();

  return parseInt(count.count) > 0;
}

/**
 * Remove all system-placed pixels at a given location.
 * Useful for re-seeding or cleanup.
 *
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} radius - Search radius in grid cells (default: 20)
 * @param {string} userId - User ID to filter (default: SYSTEM_USER_ID)
 * @returns {number} Number of pixels removed
 */
async function clearPatternAt(centerLat, centerLng, radius = 20, userId = SYSTEM_USER_ID) {
  const gridStep = GRID_CONFIG.GRID_SIZE;
  const latRange = radius * gridStep;
  const lngRange = radius * gridStep;

  const deletedCount = await db('pixels')
    .where('user_id', userId)
    .whereBetween('latitude', [centerLat - latRange, centerLat + latRange])
    .whereBetween('longitude', [centerLng - lngRange, centerLng + lngRange])
    .del();

  logger.info(`Cleared ${deletedCount} system pixels at (${centerLat}, ${centerLng})`);
  return deletedCount;
}

/**
 * Update the system user's total_pixels count to reflect all placed pixels.
 * Should be called after all patterns are drawn.
 */
async function updateSystemUserStats() {
  const result = await db('pixels')
    .where('user_id', SYSTEM_USER_ID)
    .count('* as count')
    .first();

  const totalPixels = parseInt(result.count) || 0;

  await db('users')
    .where('id', SYSTEM_USER_ID)
    .update({
      total_pixels: totalPixels,
      current_pixels: totalPixels,
      updated_at: new Date()
    });

  logger.info(`System user stats updated: total_pixels = ${totalPixels}`);
  return totalPixels;
}

module.exports = {
  SYSTEM_USER_ID,
  ensureSystemUser,
  drawPattern,
  hasPatternAt,
  clearPatternAt,
  updateSystemUserStats
};
