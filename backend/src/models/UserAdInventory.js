const { db } = require('../config/database');

/**
 * 用户广告库存模型
 */
class UserAdInventory {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.adOrderId = data.ad_order_id;
    this.adProductId = data.ad_product_id;
    this.adTitle = data.ad_title;
    this.processedImageData = data.processed_image_data;
    this.width = data.width;
    this.height = data.height;
    this.isUsed = data.is_used;
    this.usedAt = data.used_at;
    this.createdAt = data.created_at;
    // Join 查询时的额外字段
    this.product_name = data.product_name;
    this.size_type = data.size_type;
    this.product_description = data.product_description;
  }

  /**
   * 创建广告库存记录
   */
  static async create(inventoryData) {
    const [inventory] = await db('user_ad_inventory')
      .insert({
        user_id: inventoryData.userId,
        ad_order_id: inventoryData.adOrderId,
        ad_product_id: inventoryData.adProductId,
        ad_title: inventoryData.adTitle,
        processed_image_data: inventoryData.processedImageData,
        width: inventoryData.width,
        height: inventoryData.height
      })
      .returning('*');

    return new UserAdInventory(inventory);
  }

  /**
   * 根据ID查找库存记录
   */
  static async findById(id) {
    const inventory = await db('user_ad_inventory')
      .where('id', id)
      .first();

    return inventory ? new UserAdInventory(inventory) : null;
  }

  /**
   * 获取用户的广告库存
   */
  static async getUserInventory(userId, includeUsed = false) {
    let query = db('user_ad_inventory')
      .join('ad_products', 'user_ad_inventory.ad_product_id', 'ad_products.id')
      .where('user_ad_inventory.user_id', userId)
      .select(
        'user_ad_inventory.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.description as product_description'
      )
      .orderBy('user_ad_inventory.created_at', 'desc');

    if (!includeUsed) {
      query = query.where('user_ad_inventory.is_used', false);
    }

    const inventory = await query;
    return inventory.map(item => new UserAdInventory(item));
  }

  /**
   * 获取用户可用的广告库存
   */
  static async getAvailableInventory(userId) {
    const inventory = await db('user_ad_inventory')
      .join('ad_products', 'user_ad_inventory.ad_product_id', 'ad_products.id')
      .where('user_ad_inventory.user_id', userId)
      .where('user_ad_inventory.is_used', false)
      .select(
        'user_ad_inventory.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.description as product_description'
      )
      .orderBy('user_ad_inventory.created_at', 'desc');

    return inventory.map(item => new UserAdInventory(item));
  }

  /**
   * 标记广告为已使用
   */
  async markAsUsed() {
    const [updated] = await db('user_ad_inventory')
      .where('id', this.id)
      .update({
        is_used: true,
        used_at: db.fn.now()
      })
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
    }

    return this;
  }

  /**
   * 检查用户是否有可用的广告
   */
  static async hasAvailableAd(userId, adProductId = null) {
    let query = db('user_ad_inventory')
      .where('user_id', userId)
      .where('is_used', false);

    if (adProductId) {
      query = query.where('ad_product_id', adProductId);
    }

    const count = await query.count('* as count').first();
    return parseInt(count.count) > 0;
  }

  /**
   * 获取用户广告库存统计
   */
  static async getUserInventoryStats(userId) {
    const stats = await db('user_ad_inventory')
      .join('ad_products', 'user_ad_inventory.ad_product_id', 'ad_products.id')
      .where('user_ad_inventory.user_id', userId)
      .select('ad_products.size_type', 'user_ad_inventory.is_used')
      .count('* as count')
      .groupBy('ad_products.size_type', 'user_ad_inventory.is_used');

    const result = {
      total: 0,
      available: 0,
      used: 0,
      bySize: {
        rectangle: { total: 0, available: 0, used: 0 },
        square: { total: 0, available: 0, used: 0 }
      }
    };

    stats.forEach(stat => {
      const count = parseInt(stat.count);
      result.total += count;
      
      if (stat.is_used) {
        result.used += count;
        result.bySize[stat.size_type].used += count;
      } else {
        result.available += count;
        result.bySize[stat.size_type].available += count;
      }
      
      result.bySize[stat.size_type].total += count;
    });

    return result;
  }

  /**
   * 根据订单ID获取库存记录
   */
  static async getByOrderId(orderId) {
    const inventory = await db('user_ad_inventory')
      .where('ad_order_id', orderId)
      .first();

    return inventory ? new UserAdInventory(inventory) : null;
  }
}

module.exports = UserAdInventory;
