const { db } = require('../config/database');

class UserInventory {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.item_id = data.item_id || data.sku_id; // 兼容两种字段名
    this.sku_id = data.sku_id || data.item_id; // 兼容两种字段名
    this.quantity = data.quantity;
    this.consumable = data.consumable;
    this.consumed_at = data.consumed_at;
    this.owned_at = data.owned_at || data.acquired_at; // 兼容两种字段名
  }

  // 创建库存项
  static async create(inventoryData) {
    const {
      user_id,
      sku_id,
      quantity = 1,
      consumable = true
    } = inventoryData;

    // 验证必需字段
    if (!user_id || !sku_id) {
      throw new Error('缺少必需字段');
    }

    // 检查是否已存在
    const existing = await this.getByUserAndSku(user_id, sku_id);
    if (existing) {
      // 更新数量
      return await this.addQuantity(user_id, sku_id, quantity);
    }

    const [inventory] = await db('user_inventory')
      .insert({
        user_id,
        item_id: sku_id, // 使用数据库中的字段名
        quantity
      })
      .returning('*');

    return new UserInventory(inventory);
  }

  // 根据用户ID和SKU ID获取库存
  static async getByUserAndSku(userId, skuId) {
    const inventory = await db('user_inventory')
      .where('user_id', userId)
      .where('item_id', skuId) // 使用数据库中的字段名
      .first();

    return inventory ? new UserInventory(inventory) : null;
  }

  // 获取用户的所有库存
  static async getByUser(userId) {
    const inventory = await db('user_inventory')
      .where('user_id', userId)
      .where('quantity', '>', 0)
      .orderBy('owned_at', 'desc');

    return inventory.map(item => new UserInventory(item));
  }

  // 获取用户拥有的特定类型物品
  static async getByUserAndType(userId, type) {
    const inventory = await db('user_inventory')
      .join('shop_skus', 'user_inventory.item_id', 'shop_skus.id') // 使用数据库中的字段名
      .where('user_inventory.user_id', userId)
      .where('shop_skus.type', type)
      .where('user_inventory.quantity', '>', 0)
      .select('user_inventory.*', 'shop_skus.name', 'shop_skus.type', 'shop_skus.price')
      .orderBy('user_inventory.acquired_at', 'desc'); // 使用数据库中的字段名

    return inventory.map(item => new UserInventory(item));
  }

  // 增加库存数量
  static async addQuantity(userId, skuId, quantity) {
    // 先检查是否存在
    const existing = await this.getByUserAndSku(userId, skuId);
    
    if (existing) {
      // 如果存在，增加数量
      const [inventory] = await db('user_inventory')
        .where('user_id', userId)
        .where('item_id', skuId)
        .increment('quantity', quantity)
        .returning('*');

      return inventory ? new UserInventory(inventory) : null;
    } else {
      // 如果不存在，创建新记录
      return await this.create({
        user_id: userId,
        sku_id: skuId,
        quantity: quantity
      });
    }
  }

  // 消耗库存
  static async consume(userId, skuId, quantity = 1) {
    const inventory = await this.getByUserAndSku(userId, skuId);
    if (!inventory || inventory.quantity < quantity) {
      throw new Error('库存不足');
    }

    const [updated] = await db('user_inventory')
      .where('user_id', userId)
      .where('item_id', skuId) // 使用数据库中的字段名
      .decrement('quantity', quantity)
      .update({
        consumed_at: db.fn.now()
      })
      .returning('*');

    return updated ? new UserInventory(updated) : null;
  }

  // 检查用户是否有足够的库存
  static async hasEnough(userId, skuId, quantity = 1) {
    const inventory = await this.getByUserAndSku(userId, skuId);
    return inventory && inventory.quantity >= quantity;
  }

  // 获取用户拥有的旗帜图案
  static async getFlagPatterns(userId) {
    return await this.getByUserAndType(userId, 'flag_pattern');
  }

  // 获取用户拥有的炸弹
  static async getBombs(userId) {
    return await this.getByUserAndType(userId, 'bomb');
  }

  // 获取用户拥有的广告位
  static async getAdSlots(userId) {
    return await this.getByUserAndType(userId, 'ad_slot');
  }

  // 检查用户是否拥有特定SKU
  static async hasSku(userId, skuId) {
    const inventory = await this.getByUserAndSku(userId, skuId);
    return inventory && inventory.quantity > 0;
  }

  // 获取库存详情（包含SKU信息）
  async getDetails() {
    const details = await db('user_inventory')
      .join('shop_skus', 'user_inventory.sku_id', 'shop_skus.id')
      .where('user_inventory.id', this.id)
      .select('user_inventory.*', 'shop_skus.name', 'shop_skus.type', 'shop_skus.price', 'shop_skus.description')
      .first();

    return details;
  }

  // 检查是否已消耗
  isConsumed() {
    return this.consumable && this.quantity === 0;
  }

  // 检查是否可用
  isAvailable() {
    return this.quantity > 0 && !this.isConsumed();
  }
}

module.exports = UserInventory;
