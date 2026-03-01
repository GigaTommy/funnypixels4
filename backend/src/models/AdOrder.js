const { db } = require('../config/database');

/**
 * 广告订单模型
 */
class AdOrder {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.adProductId = data.ad_product_id;
    this.adTitle = data.ad_title;
    this.adDescription = data.ad_description;
    this.originalImageUrl = data.original_image_url;
    this.processedImageData = data.processed_image_data;
    this.status = data.status;
    this.price = data.price;
    this.adminNotes = data.admin_notes;
    this.targetLocation = data.target_location;
    this.scheduledTime = data.scheduled_time;
    this.processedBy = data.processed_by;
    this.processedAt = data.processed_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * 创建广告订单
   */
  static async create(orderData) {
    const insertData = {
      user_id: orderData.userId,
      ad_product_id: orderData.adProductId,
      ad_title: orderData.adTitle,
      ad_description: orderData.adDescription,
      original_image_url: orderData.originalImageUrl,
      status: orderData.status || 'pending',
      price: orderData.price
    };

    // Include target_location and scheduled_time if provided
    if (orderData.targetLocation !== undefined) {
      let parsedLocation = orderData.targetLocation;
      if (typeof parsedLocation === 'string' && parsedLocation.trim()) {
        try { parsedLocation = JSON.parse(parsedLocation); } catch (e) { parsedLocation = null; }
      }
      insertData.target_location = parsedLocation || null;
    }
    if (orderData.scheduledTime !== undefined) {
      insertData.scheduled_time = orderData.scheduledTime;
    }

    const [order] = await db('ad_orders')
      .insert(insertData)
      .returning('*');

    return new AdOrder(order);
  }

  /**
   * 根据ID查找订单
   */
  static async findById(id) {
    const order = await db('ad_orders')
      .where('id', id)
      .first();

    return order ? new AdOrder(order) : null;
  }

  /**
   * 获取用户的广告订单
   */
  static async getUserOrders(userId, status = null) {
    let query = db('ad_orders')
      .join('ad_products', 'ad_orders.ad_product_id', 'ad_products.id')
      .where('ad_orders.user_id', userId)
      .select(
        'ad_orders.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.width as product_width',
        'ad_products.height as product_height'
      )
      .orderBy('ad_orders.created_at', 'desc');

    if (status) {
      query = query.where('ad_orders.status', status);
    }

    const orders = await query;
    return orders.map(order => new AdOrder(order));
  }

  /**
   * 获取待审核的订单
   */
  static async getPendingOrders() {
    const orders = await db('ad_orders')
      .join('ad_products', 'ad_orders.ad_product_id', 'ad_products.id')
      .join('users', 'ad_orders.user_id', 'users.id')
      .where('ad_orders.status', 'pending')
      .select(
        'ad_orders.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.width as product_width',
        'ad_products.height as product_height',
        'users.username',
        'users.display_name',
        'users.avatar_url'
      )
      .orderBy('ad_orders.created_at', 'asc');

    return orders.map(order => new AdOrder(order));
  }

  /**
   * 更新订单状态
   */
  async updateStatus(status, adminId, adminNotes = null, processedImageData = null) {
    const updateData = {
      status,
      processed_by: adminId,
      processed_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    if (processedImageData) {
      updateData.processed_image_data = processedImageData;
    }

    const [updated] = await db('ad_orders')
      .where('id', this.id)
      .update(updateData)
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
    }

    return this;
  }

  /**
   * 获取订单详情（包含用户和商品信息）
   */
  static async getOrderDetails(orderId, userId = null) {
    let query = db('ad_orders')
      .join('ad_products', 'ad_orders.ad_product_id', 'ad_products.id')
      .join('users', 'ad_orders.user_id', 'users.id')
      .where('ad_orders.id', orderId)
      .select(
        'ad_orders.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.width as product_width',
        'ad_products.height as product_height',
        'users.username',
        'users.display_name',
        'users.avatar_url'
      );

    const order = await query.first();
    if (!order) return null;

    // 检查权限：只有订单所有者或管理员可以查看
    if (userId && order.user_id !== userId) {
      // 这里需要检查用户是否是管理员，暂时跳过权限检查
      // 在实际实现中应该添加管理员权限检查
    }

    return new AdOrder(order);
  }

  /**
   * 获取所有订单（支持状态筛选和分页）
   */
  static async getAllOrders({ status, current = 1, pageSize = 10 } = {}) {
    let query = db('ad_orders')
      .join('ad_products', 'ad_orders.ad_product_id', 'ad_products.id')
      .join('users', 'ad_orders.user_id', 'users.id')
      .leftJoin('users as admin_users', 'ad_orders.processed_by', 'admin_users.id')
      .select(
        'ad_orders.*',
        'ad_products.name as product_name',
        'ad_products.size_type',
        'ad_products.width as product_width',
        'ad_products.height as product_height',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'admin_users.username as processed_by_name'
      )
      .orderBy('ad_orders.created_at', 'desc');

    if (status) {
      query = query.where('ad_orders.status', status);
    }

    // Count total
    const countQuery = db('ad_orders');
    if (status) {
      countQuery.where('status', status);
    }
    const [{ count: total }] = await countQuery.count('* as count');

    // Paginate
    const offset = (current - 1) * pageSize;
    const orders = await query.limit(pageSize).offset(offset);

    return {
      orders: orders.map(order => new AdOrder(order)),
      total: parseInt(total),
      current,
      pageSize
    };
  }

  /**
   * 获取订单统计信息
   */
  static async getStats() {
    const stats = await db('ad_orders')
      .select('status')
      .count('* as count')
      .groupBy('status');

    return stats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.count);
      return acc;
    }, {});
  }

  /**
   * 获取用户订单统计
   */
  static async getUserOrderStats(userId) {
    const stats = await db('ad_orders')
      .where('user_id', userId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    return stats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.count);
      return acc;
    }, {});
  }
}

module.exports = AdOrder;
