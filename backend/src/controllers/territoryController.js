const { db } = require('../config/database');
const logger = require('../utils/logger');

class TerritoryController {
  /**
   * GET /api/map-social/territories?swLat=&swLng=&neLat=&neLng=
   * Returns territory control data for the visible map bounds
   */
  static async getTerritories(req, res) {
    try {
      const { swLat, swLng, neLat, neLng } = req.query;

      if (!swLat || !swLng || !neLat || !neLng) {
        return res.status(400).json({
          success: false,
          message: 'Map bounds required (swLat, swLng, neLat, neLng)'
        });
      }

      // Query territory control data
      // We use a simplified grid approach: pixels grouped by rounded lat/lng
      const gridSize = 0.005; // ~500m cells

      const territories = await db.raw(`
        SELECT
          ROUND(latitude / ? ) * ? as cell_lat,
          ROUND(longitude / ?) * ? as cell_lng,
          alliance_id,
          COUNT(*) as pixel_count
        FROM pixels
        WHERE latitude BETWEEN ? AND ?
          AND longitude BETWEEN ? AND ?
          AND alliance_id IS NOT NULL
        GROUP BY cell_lat, cell_lng, alliance_id
        ORDER BY pixel_count DESC
      `, [gridSize, gridSize, gridSize, gridSize,
          parseFloat(swLat), parseFloat(neLat),
          parseFloat(swLng), parseFloat(neLng)]);

      // Group by cell and find dominant alliance
      const cellMap = new Map();
      const rows = territories.rows || territories;

      for (const row of rows) {
        const cellKey = `${row.cell_lat},${row.cell_lng}`;
        if (!cellMap.has(cellKey)) {
          cellMap.set(cellKey, {
            lat: parseFloat(row.cell_lat),
            lng: parseFloat(row.cell_lng),
            allianceId: row.alliance_id,
            pixelCount: parseInt(row.pixel_count),
            totalPixels: parseInt(row.pixel_count)
          });
        } else {
          const existing = cellMap.get(cellKey);
          existing.totalPixels += parseInt(row.pixel_count);
          if (parseInt(row.pixel_count) > existing.pixelCount) {
            existing.allianceId = row.alliance_id;
            existing.pixelCount = parseInt(row.pixel_count);
          }
        }
      }

      // Get alliance info for dominant alliances
      const allianceIds = [...new Set([...cellMap.values()].map(c => c.allianceId).filter(Boolean))];
      const allianceMap = new Map();

      if (allianceIds.length > 0) {
        const alliances = await db('alliances')
          .whereIn('id', allianceIds)
          .select('id', 'name', 'flag_pattern_id', 'flag_colors');

        for (const a of alliances) {
          allianceMap.set(a.id, a);
        }
      }

      // Build response
      const cells = [];
      for (const [, cell] of cellMap) {
        const alliance = allianceMap.get(cell.allianceId);
        if (alliance && cell.pixelCount >= 5) { // Minimum 5 pixels to show territory
          cells.push({
            lat: cell.lat,
            lng: cell.lng,
            alliance_id: cell.allianceId,
            alliance_name: alliance.name,
            flag_colors: alliance.flag_colors,
            pixel_count: cell.pixelCount,
            total_pixels: cell.totalPixels,
            control: cell.totalPixels > 0 ? (cell.pixelCount / cell.totalPixels) : 0
          });
        }
      }

      res.json({
        success: true,
        data: {
          territories: cells,
          grid_size: gridSize,
          count: cells.length
        }
      });
    } catch (error) {
      logger.error('获取领地数据失败:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get territory data'
      });
    }
  }

  /**
   * GET /api/map-social/territory-detail?lat=&lng=
   * Returns detailed territory info for a specific cell
   */
  static async getTerritoryDetail(req, res) {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'lat and lng are required'
        });
      }

      const gridSize = 0.005;
      const cellLat = Math.round(parseFloat(lat) / gridSize) * gridSize;
      const cellLng = Math.round(parseFloat(lng) / gridSize) * gridSize;
      const delta = gridSize / 2;

      // Get all alliances in this cell
      const allianceStats = await db('pixels')
        .whereBetween('latitude', [cellLat - delta, cellLat + delta])
        .whereBetween('longitude', [cellLng - delta, cellLng + delta])
        .whereNotNull('alliance_id')
        .select('alliance_id')
        .count('id as pixel_count')
        .groupBy('alliance_id')
        .orderBy('pixel_count', 'desc');

      const totalPixels = allianceStats.reduce((sum, a) => sum + parseInt(a.pixel_count), 0);

      // Get alliance details
      const allianceIds = allianceStats.map(a => a.alliance_id);
      const alliances = allianceIds.length > 0
        ? await db('alliances').whereIn('id', allianceIds).select('id', 'name', 'flag_pattern_id', 'flag_colors')
        : [];

      const allianceMap = new Map(alliances.map(a => [a.id, a]));

      const breakdown = allianceStats.map(a => {
        const info = allianceMap.get(a.alliance_id);
        return {
          alliance_id: a.alliance_id,
          alliance_name: info?.name || 'Unknown',
          flag_colors: info?.flag_colors,
          pixel_count: parseInt(a.pixel_count),
          percentage: totalPixels > 0 ? (parseInt(a.pixel_count) / totalPixels * 100).toFixed(1) : 0
        };
      });

      res.json({
        success: true,
        data: {
          cell_lat: cellLat,
          cell_lng: cellLng,
          total_pixels: totalPixels,
          alliances: breakdown
        }
      });
    } catch (error) {
      logger.error('获取领地详情失败:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get territory detail'
      });
    }
  }
}

module.exports = TerritoryController;
