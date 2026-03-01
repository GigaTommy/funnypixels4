const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class StorePayment {
  /**
   * 创建充值订单
   */
  static async createRechargeOrder(userId, amountRmb, points, channel, idempotencyKey) {
    const orderId = uuidv4();

    await db('recharge_orders').insert({
      id: orderId,
      user_id: userId,
      amount_rmb: amountRmb,
      points: points,
      channel: channel,
      status: 'pending',
      idempotency_key: idempotencyKey
    });

    return orderId;
  }

  /**
   * 更新充值订单状态
   */
  static async updateRechargeOrderStatus(orderId, status, paidAt = null) {
    const updateData = { status };
    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    await db('recharge_orders')
      .where('id', orderId)
      .update(updateData);
  }

  /**
   * 获取充值订单
   */
  static async getRechargeOrder(orderId) {
    return await db('recharge_orders')
      .where('id', orderId)
      .first();
  }

  /**
   * 获取用户的充值订单列表
   */
  static async getUserRechargeOrders(userId, limit = 20) {
    return await db('recharge_orders')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select(
        'id',
        'user_id',
        'amount_rmb',
        'points as amount_points',
        'channel',
        'status',
        'created_at',
        'paid_at'
      );
  }

  /**
   * 增加用户积分
   */
  static async addUserPoints(userId, points, reason, refId = null) {
    await db.transaction(async (trx) => {
      // 获取或创建用户积分记录
      let userPoints = await trx('user_points')
        .where('user_id', userId)
        .first();

      if (!userPoints) {
        await trx('user_points').insert({
          user_id: userId,
          total_points: points,
          created_at: new Date(),
          updated_at: new Date()
        });
      } else {
        // 更新积分
        await trx('user_points')
          .where('user_id', userId)
          .update({
            total_points: userPoints.total_points + points,
            updated_at: new Date()
          });
      }

      // 记录账本
      await trx('wallet_ledger').insert({
        id: uuidv4(),
        user_id: userId,
        delta_points: points,
        reason: reason,
        ref_id: refId
      });
    });
  }

  /**
   * 扣除用户积分
   */
  static async deductUserPoints(userId, points, reason, refId = null) {
    const result = await db.transaction(async (trx) => {
      // 检查用户积分是否足够
      const userPoints = await trx('user_points')
        .where('user_id', userId)
        .select('total_points')
        .first();

      if (!userPoints || userPoints.total_points < points) {
        throw new Error('积分不足');
      }

      // 扣除积分
      await trx('user_points')
        .where('user_id', userId)
        .decrement('total_points', points);

      // 记录账本
      await trx('wallet_ledger').insert({
        id: uuidv4(),
        user_id: userId,
        delta_points: -points,
        reason: reason,
        ref_id: refId
      });

      return userPoints.total_points - points;
    });

    return result;
  }

  /**
   * 获取用户钱包信息
   */
  static async getUserWallet(userId) {
    const userPoints = await db('user_points')
      .where('user_id', userId)
      .select('total_points')
      .first();

    const recentLedger = await db('wallet_ledger')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(10);

    return {
      points: userPoints?.total_points || 0,
      recent_ledger: recentLedger
    };
  }

  /**
   * 获取用户积分
   */
  static async getUserPoints(userId) {
    const userPoints = await db('user_points')
      .where('user_id', userId)
      .select('total_points')
      .first();

    return userPoints?.total_points || 0;
  }

  /**
   * 购买商品
   */
  static async purchaseItem(userId, itemId, quantity = 1) {
    return await db.transaction(async (trx) => {
      // 获取商品信息
      const item = await trx('store_items')
        .where('id', itemId)
        .where('active', true)
        .first();

      if (!item) {
        throw new Error('商品不存在或已下架');
      }

      const totalPrice = item.price_points * quantity;

      // 检查用户积分是否足够
      const userPoints = await trx('user_points')
        .where('user_id', userId)
        .select('total_points')
        .first();

      if (!userPoints || userPoints.total_points < totalPrice) {
        throw new Error('积分不足');
      }

      // 扣除积分
      await trx('user_points')
        .where('user_id', userId)
        .decrement('total_points', totalPrice);

      // 记录账本
      await trx('wallet_ledger').insert({
        id: uuidv4(),
        user_id: userId,
        delta_points: -totalPrice,
        reason: '购买商品',
        ref_id: itemId
      });

      // 添加到用户库存
      const existingInventory = await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: itemId
        })
        .first();

      if (existingInventory) {
        await trx('user_inventory')
          .where({
            user_id: userId,
            item_id: itemId
          })
          .increment('quantity', quantity);
      } else {
        await trx('user_inventory').insert({
          user_id: userId,
          item_id: itemId,
          quantity: quantity,
          consumed: false
        });
      }

      return {
        item: item,
        quantity: quantity,
        totalPrice: totalPrice,
        remainingPoints: userPoints.total_points - totalPrice
      };
    });
  }

  /**
   * 获取用户库存
   */
  static async getUserInventory(userId) {
    // 获取普通商品库存
    const regularInventory = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', userId)
      .where('user_inventory.quantity', '>', 0)
      .select(
        'user_inventory.id',
        'user_inventory.quantity',
        'user_inventory.consumed',
        'user_inventory.acquired_at',
        'store_items.id as item_id',
        'store_items.name',
        'store_items.description',
        'store_items.item_type',
        'store_items.category',
        'store_items.price_points',
        'store_items.metadata'
      )
      .orderBy('user_inventory.acquired_at', 'desc');

    // 获取广告库存
    const adInventory = await db('user_ad_inventory')
      .join('ad_products', 'user_ad_inventory.ad_product_id', 'ad_products.id')
      .where('user_ad_inventory.user_id', userId)
      .where('user_ad_inventory.is_used', false) // 只获取未使用的广告
      .select(
        'user_ad_inventory.id',
        'user_ad_inventory.created_at as acquired_at',
        'user_ad_inventory.ad_product_id as item_id',
        'user_ad_inventory.ad_title',
        'user_ad_inventory.processed_image_data',
        'user_ad_inventory.width',
        'user_ad_inventory.height',
        'ad_products.name as ad_product_name',
        'ad_products.description',
        'ad_products.price as price_points'
      )
      .orderBy('user_ad_inventory.created_at', 'desc');

    // 转换广告库存格式以匹配普通库存格式
    const formattedAdInventory = adInventory.map(ad => ({
      id: ad.id,
      quantity: 1, // 广告库存固定为1
      acquired_at: ad.acquired_at,
      consumed: false, // 广告库存没有使用状态
      item_id: ad.item_id,
      name: ad.ad_title || ad.ad_product_name, // 使用广告标题作为显示名称
      description: ad.description || `广告尺寸: ${ad.width}x${ad.height}`,
      item_type: 'advertisement',
      category: 'advertisement',
      price_points: ad.price_points,
      metadata: {
        width: ad.width,
        height: ad.height,
        processed_image_data: ad.processed_image_data,
        ad_title: ad.ad_title
      }
    }));

    // 合并两种库存
    const allInventory = [...regularInventory, ...formattedAdInventory];

    // 按类型和名称排序
    return allInventory.sort((a, b) => {
      if (a.item_type !== b.item_type) {
        return a.item_type.localeCompare(b.item_type);
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 获取用户交易记录 (从 wallet_ledger)
   */
  static async getUserTransactions(userId, limit = 20, offset = 0, filter = {}) {
    const query = db('wallet_ledger')
      .leftJoin('store_items', function () {
        // Only try to join with store_items if ref_id is numeric
        this.on(db.raw("CASE WHEN wallet_ledger.ref_id ~ '^[0-9]+$' THEN CAST(wallet_ledger.ref_id AS INTEGER) ELSE NULL END"), '=', 'store_items.id')
      })
      .leftJoin('ad_products', function () {
        // Only try to join with ad_products if ref_id is a valid UUID
        this.on(db.raw("CASE WHEN wallet_ledger.ref_id ~ '^[0-9a-fA-F-]{36}$' THEN CAST(wallet_ledger.ref_id AS UUID) ELSE NULL END"), '=', 'ad_products.id')
      })
      .where('wallet_ledger.user_id', userId);

    if (filter.type === 'purchase') {
      // Consumption: delta_points < 0
      query.where('wallet_ledger.delta_points', '<', 0);
    } else if (filter.type === 'recharge') {
      // Recharge: delta_points > 0 and reason contains '充值'
      query.where('wallet_ledger.delta_points', '>', 0)
        .where('wallet_ledger.reason', 'like', '%充值%');
    }

    if (filter.startDate) {
      query.where('wallet_ledger.created_at', '>=', filter.startDate);
    }
    if (filter.endDate) {
      query.where('wallet_ledger.created_at', '<=', filter.endDate);
    }

    const transactions = await query
      .orderBy('wallet_ledger.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'wallet_ledger.*',
        'store_items.name as store_item_name',
        'ad_products.name as ad_product_name'
      );

    const countQuery = db('wallet_ledger')
      .where('user_id', userId);

    if (filter.type === 'purchase') {
      countQuery.where('delta_points', '<', 0);
    } else if (filter.type === 'recharge') {
      countQuery.where('delta_points', '>', 0)
        .where('reason', 'like', '%充值%');
    }

    if (filter.startDate) {
      countQuery.where('created_at', '>=', filter.startDate);
    }
    if (filter.endDate) {
      countQuery.where('created_at', '<=', filter.endDate);
    }

    const totalResult = await countQuery
      .count('* as total')
      .first();

    // 格式化交易记录
    const formattedTransactions = transactions.map(t => {
      let type = 'other';
      let itemName = t.reason || '未知交易';
      let status = 'completed'; // 账本记录默认为已完成

      // 优先显示商品名称
      if (t.store_item_name) {
        itemName = t.store_item_name;
      } else if (t.ad_product_name) {
        itemName = t.ad_product_name;
      }

      if (t.delta_points < 0) {
        type = 'purchase';
      } else {
        type = (t.reason && t.reason.includes('充值')) ? 'recharge' : 'refund';
      }

      return {
        id: t.id,
        user_id: t.user_id,
        item_id: t.ref_id, // Add item_id mapping from ref_id
        type: type,
        item_name: itemName,
        quantity: 1,
        price: Math.abs(t.delta_points),
        total_price: Math.abs(t.delta_points),
        status: status,
        created_at: t.created_at
      };
    });

    return {
      items: formattedTransactions,
      pagination: {
        total: parseInt(totalResult.total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(totalResult.total / limit)
      }
    };
  }

  /**
   * 使用道具
   */
  static async useItem(userId, itemId, quantity = 1) {
    return await db.transaction(async (trx) => {
      // 检查库存
      const inventory = await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: itemId
        })
        .first();

      if (!inventory || inventory.quantity < quantity) {
        throw new Error('道具数量不足');
      }

      // 减少库存
      await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: itemId
        })
        .decrement('quantity', quantity);

      // 如果库存为0，删除记录
      const updatedInventory = await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: itemId
        })
        .first();

      if (updatedInventory && updatedInventory.quantity <= 0) {
        await trx('user_inventory')
          .where({
            user_id: userId,
            item_id: itemId
          })
          .del();
      }

      return {
        success: true,
        remainingQuantity: updatedInventory ? Math.max(0, updatedInventory.quantity) : 0
      };
    });
  }
}

module.exports = StorePayment;
