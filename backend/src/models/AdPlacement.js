const { db } = require('../config/database');

/**
 * 广告放置记录模型
 */
class AdPlacement {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.adInventoryId = data.ad_inventory_id;
    this.centerLat = parseFloat(data.center_lat);
    this.centerLng = parseFloat(data.center_lng);
    this.width = data.width;
    this.height = data.height;
    this.pixelData = data.pixel_data;
    this.pixelCount = data.pixel_count;
    this.isActive = data.is_active;
    this.expiresAt = data.expires_at;
    this.createdAt = data.created_at;
  }

  /**
   * 创建广告放置记录
   */
  static async create(placementData) {
    const [placement] = await db('ad_placements')
      .insert({
        user_id: placementData.userId,
        ad_inventory_id: placementData.adInventoryId,
        center_lat: placementData.centerLat,
        center_lng: placementData.centerLng,
        width: placementData.width,
        height: placementData.height,
        pixel_data: placementData.pixelData,
        pixel_count: placementData.pixelCount,
        is_active: placementData.isActive !== undefined ? placementData.isActive : true,
        expires_at: placementData.expiresAt
      })
      .returning('*');

    return new AdPlacement(placement);
  }

  /**
   * 根据ID查找放置记录
   */
  static async findById(id) {
    const placement = await db('ad_placements')
      .where('id', id)
      .first();

    return placement ? new AdPlacement(placement) : null;
  }

  /**
   * 获取用户的广告放置记录
   */
  static async getUserPlacements(userId, includeInactive = false) {
    let query = db('ad_placements')
      .join('user_ad_inventory', 'ad_placements.ad_inventory_id', 'user_ad_inventory.id')
      .where('ad_placements.user_id', userId)
      .select(
        'ad_placements.*',
        'user_ad_inventory.ad_title',
        'user_ad_inventory.width as ad_width',
        'user_ad_inventory.height as ad_height'
      )
      .orderBy('ad_placements.created_at', 'desc');

    if (!includeInactive) {
      query = query.where('ad_placements.is_active', true);
    }

    const placements = await query;
    return placements.map(placement => new AdPlacement(placement));
  }

  /**
   * 获取指定区域内的广告放置记录
   */
  static async getPlacementsInArea(minLat, maxLat, minLng, maxLng) {
    const placements = await db('ad_placements')
      .join('user_ad_inventory', 'ad_placements.ad_inventory_id', 'user_ad_inventory.id')
      .where('ad_placements.is_active', true)
      .where('ad_placements.center_lat', '>=', minLat)
      .where('ad_placements.center_lat', '<=', maxLat)
      .where('ad_placements.center_lng', '>=', minLng)
      .where('ad_placements.center_lng', '<=', maxLng)
      .select(
        'ad_placements.*',
        'user_ad_inventory.ad_title',
        'user_ad_inventory.width as ad_width',
        'user_ad_inventory.height as ad_height'
      );

    return placements.map(placement => new AdPlacement(placement));
  }

  /**
   * 检查位置是否被占用
   */
  static async isLocationOccupied(centerLat, centerLng, width, height, excludeId = null) {
    // 计算广告覆盖的区域范围
    const pixelSpacing = 0.0001; // 像素间距
    const halfWidth = (width / 2) * pixelSpacing;
    const halfHeight = (height / 2) * pixelSpacing;
    
    const minLat = centerLat - halfHeight;
    const maxLat = centerLat + halfHeight;
    const minLng = centerLng - halfWidth;
    const maxLng = centerLng + halfWidth;

    let query = db('ad_placements')
      .where('is_active', true)
      .where(function() {
        this.where(function() {
          // 检查新广告的中心是否在现有广告范围内
          this.where('center_lat', '>=', minLat)
            .where('center_lat', '<=', maxLat)
            .where('center_lng', '>=', minLng)
            .where('center_lng', '<=', maxLng);
        }).orWhere(function() {
          // 检查现有广告的中心是否在新广告范围内
          this.where('center_lat', '>=', minLat)
            .where('center_lat', '<=', maxLat)
            .where('center_lng', '>=', minLng)
            .where('center_lng', '<=', maxLng);
        });
      });

    if (excludeId) {
      query = query.where('id', '!=', excludeId);
    }

    const count = await query.count('* as count').first();
    return parseInt(count.count) > 0;
  }

  /**
   * 停用广告放置
   */
  async deactivate() {
    const [updated] = await db('ad_placements')
      .where('id', this.id)
      .update({
        is_active: false,
        updated_at: db.fn.now()
      })
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
    }

    return this;
  }

  /**
   * 删除广告放置记录
   */
  async delete() {
    await db('ad_placements')
      .where('id', this.id)
      .del();
  }

  /**
   * 获取广告放置统计信息
   */
  static async getPlacementStats() {
    const stats = await db('ad_placements')
      .select('is_active')
      .count('* as count')
      .groupBy('is_active');

    return stats.reduce((acc, stat) => {
      acc[stat.is_active ? 'active' : 'inactive'] = parseInt(stat.count);
      return acc;
    }, { active: 0, inactive: 0 });
  }

  /**
   * 获取用户广告放置统计
   */
  static async getUserPlacementStats(userId) {
    const stats = await db('ad_placements')
      .where('user_id', userId)
      .select('is_active')
      .count('* as count')
      .groupBy('is_active');

    return stats.reduce((acc, stat) => {
      acc[stat.is_active ? 'active' : 'inactive'] = parseInt(stat.count);
      return acc;
    }, { active: 0, inactive: 0 });
  }

  /**
   * 清理过期的广告放置
   */
  static async cleanupExpiredPlacements() {
    const result = await db('ad_placements')
      .where('expires_at', '<', db.fn.now())
      .where('is_active', true)
      .update({
        is_active: false,
        updated_at: db.fn.now()
      });

    return result;
  }
}

module.exports = AdPlacement;
