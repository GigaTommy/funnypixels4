/**
 * Pixel 3D Routes
 * Task: #12
 * Purpose: API routes for 3D pixel rendering
 *
 * Routes:
 * - GET /viewport - Fetch viewport data with LOD strategy
 * - GET /column/:gridId/layers - Get layer details for a pixel column
 */

const express = require('express');
const router = express.Router();
const Pixel3DController = require('../controllers/pixel3DController');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/pixels-3d/viewport
 * Fetch 3D viewport data with LOD strategy
 *
 * Query params:
 * - minLat: Minimum latitude
 * - maxLat: Maximum latitude
 * - minLng: Minimum longitude
 * - maxLng: Maximum longitude
 * - zoom: Zoom level (8-20, default 14)
 * - limit: Max results (default 10000)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     pixels: [{ lat, lng, height, rawHeight, color, allianceId, gridId }],
 *     lodLevel: 'L1' | 'L2' | 'L3',
 *     zoom: number,
 *     bounds: { minLat, maxLat, minLng, maxLng },
 *     count: number
 *   }
 * }
 */
router.get('/viewport', optionalAuth, Pixel3DController.getViewport3DData);

/**
 * GET /api/pixels-3d/column/:gridId/layers
 * Get layer details for a specific pixel column
 *
 * Path params:
 * - gridId: Grid ID of the pixel column
 *
 * Query params:
 * - page: Page number (default 1)
 * - limit: Results per page (default 20)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     gridId: string,
 *     layers: [{ id, timestamp, color, userId, username, avatarUrl, allianceId }],
 *     pagination: { page, limit, total, totalPages }
 *   }
 * }
 */
router.get('/column/:gridId/layers', optionalAuth, Pixel3DController.getColumnLayers);

module.exports = router;
