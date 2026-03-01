const { db } = require('../config/database');

/**
 * 广告商品模型
 */
class AdProduct {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.sizeType = data.size_type;
    this.width = data.width;
    this.height = data.height;
    this.price = data.price;
    this.description = data.description;
    this.active = data.active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * 创建广告商品
   */
  static async create(productData) {
    const [product] = await db('ad_products')
      .insert({
        name: productData.name,
        size_type: productData.sizeType,
        width: productData.width,
        height: productData.height,
        price: productData.price,
        description: productData.description,
        active: productData.active !== undefined ? productData.active : true
      })
      .returning('*');

    return new AdProduct(product);
  }

  /**
   * 根据ID查找广告商品
   */
  static async findById(id) {
    const product = await db('ad_products')
      .where('id', id)
      .first();

    return product ? new AdProduct(product) : null;
  }

  /**
   * 获取所有活跃的广告商品
   */
  static async getActiveProducts() {
    const products = await db('ad_products')
      .where('active', true)
      .orderBy('size_type')
      .orderBy('width');

    return products.map(product => new AdProduct(product));
  }

  /**
   * 根据尺寸类型获取商品
   */
  static async getBySizeType(sizeType) {
    const products = await db('ad_products')
      .where('size_type', sizeType)
      .where('active', true)
      .orderBy('width');

    return products.map(product => new AdProduct(product));
  }

  /**
   * 更新广告商品
   */
  async update(updateData) {
    const [updated] = await db('ad_products')
      .where('id', this.id)
      .update({
        ...updateData,
        updated_at: db.fn.now()
      })
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
    }

    return this;
  }

  /**
   * 删除广告商品
   */
  async delete() {
    await db('ad_products')
      .where('id', this.id)
      .del();
  }

  /**
   * 获取商品统计信息
   */
  static async getStats() {
    const stats = await db('ad_products')
      .select('size_type')
      .count('* as count')
      .where('active', true)
      .groupBy('size_type');

    return stats.reduce((acc, stat) => {
      acc[stat.size_type] = parseInt(stat.count);
      return acc;
    }, {});
  }
}

module.exports = AdProduct;
