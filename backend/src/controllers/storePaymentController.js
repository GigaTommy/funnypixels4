const StorePayment = require('../models/StorePayment');
const UnifiedPaymentProvider = require('../payments/providers/unified-payment');
const IdempotencyManager = require('../utils/idempotency');
const RateLimiter = require('../utils/rateLimit');

const paymentProvider = new UnifiedPaymentProvider();

// 创建速率限制器
const purchaseLimiter = new RateLimiter(10000, 5); // 10秒内最多5次购买
const rechargeLimiter = new RateLimiter(10000, 3); // 10秒内最多3次充值

/**
 * 根据商品类型和分类获取图标
 */
function getItemIcon(itemType, category) {
  const iconMap = {
    'consumable': '🧪',
    'cosmetic': '📿',
    'special': '💎',
    'advertisement': '📢',
    'custom_flag': '🎨',
    'flag_color': '🏳️',
    'flag_pattern': '🏴',
    'alliance_flags': '🏴'
  };

  // 优先使用分类，其次使用类型
  return iconMap[category] || iconMap[itemType] || '🎁';
}

class StorePaymentController {
  /**
   * 获取商店商品列表
   */
  static async getStoreItems(req, res) {
    try {
      const { db } = require('../config/database');
      const { active = '1' } = req.query;

      // 获取普通商品
      const regularItems = await db('store_items')
        .where('active', active === '1')
        .orderBy('price_points', 'asc');

      // 获取广告商品
      const adProducts = await db('ad_products')
        .where('active', active === '1')
        .orderBy('price', 'asc');

      // 获取自定义旗帜商品（仅保留自定义旗帜）
      const customFlagSkus = await db('shop_skus')
        .where('active', active === '1')
        .where('item_type', 'custom_flag')
        .orderBy('price', 'asc');

      // 将普通商品转换为统一格式
      const mappedRegularItems = regularItems.map(item => ({
        id: `item_${item.id}`,
        name: item.name,
        description: item.description,
        price: item.price_points || item.price || 0,
        price_points: item.price_points || item.price || 0,
        item_type: item.item_type || 'consumable',
        type: item.item_type || 'consumable',
        category: item.category || 'consumable',
        icon: getItemIcon(item.item_type, item.category),
        active: item.active,
        created_at: item.created_at,
        updated_at: item.updated_at,
        // 普通商品特有属性
        currency: item.currency_type || 'points',
        metadata: item.metadata
      }));

      // 将广告商品转换为商店商品格式
      const adItems = adProducts.map(product => ({
        id: `ad_${product.id}`,
        name: product.name,
        description: product.description,
        price: product.price,
        price_points: product.price,
        item_type: 'advertisement',
        type: 'advertisement',
        category: 'advertisement',
        icon: '📢',
        active: product.active,
        created_at: product.created_at,
        updated_at: product.updated_at,
        // 广告商品特有属性
        ad_product_id: product.id,
        size_type: product.size_type,
        width: product.width,
        height: product.height,
        currency: 'points'
      }));

      // 将自定义旗帜商品转换为商店商品格式
      const customFlagItems = customFlagSkus.map(sku => ({
        id: `custom_flag_${sku.id}`,
        name: sku.name,
        description: sku.description,
        price: sku.price,
        price_points: sku.price,
        item_type: 'custom_flag',
        type: 'custom_flag',
        category: 'custom-flags',
        icon: '🎨',
        active: sku.active,
        created_at: sku.created_at,
        updated_at: sku.updated_at,
        // 自定义旗帜商品特有属性
        sku_id: sku.id,
        pattern_id: sku.pattern_id,
        currency: sku.currency || 'points',
        metadata: sku.metadata,
        // 添加效果和要求字段（从metadata中提取）
        effects: sku.metadata?.effects || [],
        requirements: sku.metadata?.requirements || []
      }));

      // 合并所有商品（不包含普通旗帜）
      const allItems = [...mappedRegularItems, ...adItems, ...customFlagItems];

      res.json({
        ok: true,
        data: allItems
      });
    } catch (error) {
      console.error('获取商店商品失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户钱包信息
   */
  static async getWallet(req, res) {
    try {
      const userId = req.user.id;
      const wallet = await StorePayment.getUserWallet(userId);

      res.json({
        ok: true,
        data: wallet
      });
    } catch (error) {
      console.error('获取钱包信息失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户积分信息
   */
  static async getUserPoints(req, res) {
    try {
      const userId = req.user.id;
      const points = await StorePayment.getUserPoints(userId);

      res.json({
        ok: true,
        data: {
          points: points,
          totalEarned: 0, // TODO: 从wallet_ledger计算
          totalSpent: 0,  // TODO: 从wallet_ledger计算
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('获取用户积分失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 购买商品
   */
  static async buyItem(req, res) {
    try {
      const userId = req.user.id;
      const { itemId, quantity = 1, adTitle, adDescription, imageData } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'];

      if (!itemId) {
        return res.status(400).json({
          ok: false,
          error: '商品ID为必填项'
        });
      }

      if (!idempotencyKey) {
        return res.status(400).json({
          ok: false,
          error: '缺少幂等键'
        });
      }

      // 检查幂等性
      const isNewRequest = await IdempotencyManager.checkAndSet(idempotencyKey, 3600);
      if (!isNewRequest) {
        // 重复请求，返回上次的结果
        return res.status(409).json({
          ok: false,
          error: '重复请求'
        });
      }

      // 检查速率限制
      const isAllowed = await purchaseLimiter.isAllowed(`purchase:${userId}`);
      if (!isAllowed) {
        return res.status(429).json({
          ok: false,
          error: '请求过于频繁，请稍后再试'
        });
      }

      // 使用Store模型的购买方法，支持广告商品
      const Store = require('../models/Store');
      const additionalData = {
        adTitle,
        adDescription,
        imageData
      };

      const result = await Store.purchaseWithPoints(userId, itemId, quantity, additionalData);

      if (result.isAdOrder) {
        res.json({
          ok: true,
          data: {
            message: '广告订单创建成功，等待管理员审核',
            item: result.item,
            quantity: result.quantity,
            totalPrice: result.totalPrice,
            remainingPoints: result.remainingPoints,
            order: result.order,
            isAdOrder: true
          }
        });
      } else {
        res.json({
          ok: true,
          data: {
            message: '购买成功',
            item: result.item,
            quantity: result.quantity,
            totalPrice: result.totalPrice,
            remainingPoints: result.remainingPoints,
            isAdOrder: false
          }
        });
      }
    } catch (error) {
      console.error('购买商品失败:', error);
      res.status(400).json({
        ok: false,
        error: error.message || '购买失败'
      });
    }
  }

  /**
   * 创建充值会话
   */
  static async createRechargeSession(req, res) {
    try {
      const userId = req.user.id;
      const { channel, amountRmb } = req.body;

      console.log('🔍 充值请求参数:', { userId, channel, amountRmb, body: req.body });

      if (!channel || !amountRmb) {
        console.log('❌ 参数验证失败:', { channel, amountRmb });
        return res.status(400).json({
          ok: false,
          error: '缺少必要参数'
        });
      }

      // 计算积分：1元 = 20积分
      const points = amountRmb * 20;

      // 生成幂等键
      const idempotencyKey = `recharge_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 检查幂等性
      const isNewRequest = await IdempotencyManager.checkAndSet(idempotencyKey, 3600);
      if (!isNewRequest) {
        return res.status(409).json({
          ok: false,
          error: '重复请求'
        });
      }

      // 检查速率限制
      const isAllowed = await rechargeLimiter.isAllowed(`recharge:${userId}`);
      if (!isAllowed) {
        return res.status(429).json({
          ok: false,
          error: '请求过于频繁，请稍后再试'
        });
      }

      // 创建充值订单
      const orderId = await StorePayment.createRechargeOrder(
        userId,
        amountRmb,
        points,
        channel,
        idempotencyKey
      );

      // 根据支付渠道生成不同的支付数据
      let paymentData, paymentUrl;

      if (channel === 'mock') {
        // Mock支付：直接生成二维码
        const mockProvider = new UnifiedPaymentProvider();
        const paymentOrder = await mockProvider.createPayment({
          method: 'mock',
          amount: amountRmb,
          currency: 'CNY',
          description: `充值${amountRmb}元获得${points}积分`,
          metadata: { userId, points, idempotencyKey }
        });

        paymentData = {
          orderId: orderId,
          userId: userId,
          amount: amountRmb,
          points: points,
          channel: channel,
          qrCodeDataUrl: paymentOrder.qrCode,
          timestamp: Date.now(),
          signature: require('crypto').createHmac('sha256', process.env.PAYMENT_SECRET || 'default_secret')
            .update(`${orderId}${userId}${amountRmb}${Date.now()}`)
            .digest('hex')
        };

        paymentUrl = `${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/payment?data=${Buffer.from(JSON.stringify(paymentData)).toString('base64')}`;
      } else {
        // 真实支付：生成支付页面URL
        paymentData = {
          orderId: orderId,
          userId: userId,
          amount: amountRmb,
          points: points,
          channel: channel,
          timestamp: Date.now(),
          signature: require('crypto').createHmac('sha256', process.env.PAYMENT_SECRET || 'default_secret')
            .update(`${orderId}${userId}${amountRmb}${Date.now()}`)
            .digest('hex')
        };

        paymentUrl = `${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/payment?data=${Buffer.from(JSON.stringify(paymentData)).toString('base64')}`;
      }

      res.json({
        ok: true,
        data: {
          orderId: orderId,
          amountRmb: amountRmb,
          points: points,
          channel: channel,
          paymentUrl: paymentUrl,
          qrCodeDataUrl: paymentData.qrCodeDataUrl,
          paymentInstructions: [
            '1. 点击"前往支付"按钮',
            '2. 在支付页面确认订单信息',
            '3. 选择支付方式并完成支付',
            '4. 支付成功后自动返回',
            `5. 订单号：${orderId.substring(0, 8)}...`
          ]
        }
      });
    } catch (error) {
      console.error('创建充值会话失败:', error);
      res.status(400).json({
        ok: false,
        error: error.message || '创建充值会话失败'
      });
    }
  }

  /**
   * 手动确认支付（开发环境使用）
   */
  static async confirmPayment(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await StorePayment.getRechargeOrder(orderId);

      if (!order) {
        return res.status(404).json({
          ok: false,
          error: '订单不存在'
        });
      }

      // 检查订单是否属于当前用户
      if (order.user_id !== userId) {
        return res.status(403).json({
          ok: false,
          error: '无权访问此订单'
        });
      }

      // 更新订单状态为已支付
      await StorePayment.updateRechargeOrderStatus(orderId, 'paid', new Date());

      // 给用户增加积分
      await StorePayment.addUserPoints(userId, order.points, `充值订单 ${orderId}`, orderId);

      res.json({
        ok: true,
        data: {
          orderId: order.id,
          status: 'paid',
          points: order.points
        }
      });
    } catch (error) {
      console.error('确认支付失败:', error);
      res.status(500).json({
        ok: false,
        error: error.message || '确认支付失败'
      });
    }
  }

  /**
   * 获取订单状态
   */
  static async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await StorePayment.getRechargeOrder(orderId);

      if (!order) {
        return res.status(404).json({
          ok: false,
          error: '订单不存在'
        });
      }

      // 检查订单是否属于当前用户
      if (order.user_id !== userId) {
        return res.status(403).json({
          ok: false,
          error: '无权访问此订单'
        });
      }

      res.json({
        ok: true,
        data: {
          orderId: order.id,
          status: order.status,
          amountRmb: order.amount_rmb,
          points: order.points,
          channel: order.channel,
          createdAt: order.created_at,
          paidAt: order.paid_at
        }
      });
    } catch (error) {
      console.error('获取订单状态失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取充值订单列表
   */
  static async getRechargeOrders(req, res) {
    try {
      const userId = req.user.id;
      const orders = await StorePayment.getUserRechargeOrders(userId);

      res.json({
        ok: true,
        data: orders
      });
    } catch (error) {
      console.error('获取充值订单列表失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户交易记录
   */
  static async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;

      const filter = {};
      if (type) {
        filter.type = type;
      }
      if (startDate) {
        filter.startDate = startDate;
      }
      if (endDate) {
        filter.endDate = endDate;
      }

      const result = await StorePayment.getUserTransactions(userId, limit, offset, filter);

      res.json({
        ok: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('获取交易记录失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户库存
   */
  static async getInventory(req, res) {
    try {
      const userId = req.user.id;
      const inventory = await StorePayment.getUserInventory(userId);

      res.json({
        ok: true,
        data: inventory
      });
    } catch (error) {
      console.error('获取库存失败:', error);
      res.status(500).json({
        ok: false,
        error: '服务器内部错误'
      });
    }
  }

  /**
   * 使用道具
   */
  static async useItem(req, res) {
    console.log('🚀 使用道具API被调用');
    console.log('🚀 请求体:', req.body);
    console.log('🚀 用户信息:', req.user);

    try {
      const userId = req.user.id;
      const { itemId, quantity = 1, targetId } = req.body;

      console.log(`🔍 使用道具API请求: userId=${userId}, itemId=${itemId}, quantity=${quantity}, targetId=${targetId}`);

      if (!itemId) {
        console.error('❌ 道具ID为必填项');
        return res.status(400).json({
          ok: false,
          error: '道具ID为必填项'
        });
      }

      // 导入Store模型来执行道具效果
      const Store = require('../models/Store');

      // 调用Store.useItem来执行道具效果（包括颜色炸弹等）
      const result = await Store.useItem(userId, itemId, quantity, targetId);

      console.log('✅ 道具使用成功:', result);

      res.json({
        ok: true,
        data: {
          message: '道具使用成功',
          remainingQuantity: result.remainingQuantity,
          effects: result.effects
        }
      });
    } catch (error) {
      console.error('❌ 使用道具失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        userId: req.user?.id,
        itemId: req.body?.itemId,
        targetId: req.body?.targetId
      });
      res.status(400).json({
        ok: false,
        error: error.message || '使用道具失败'
      });
    }
  }

  /**
   * 微信支付回调
   */
  static async wechatCallback(req, res) {
    try {
      const paymentProvider = new UnifiedPaymentProvider();
      const callback = await paymentProvider.verifyCallback(
        JSON.stringify(req.body),
        req.headers
      );

      await this.handlePaymentCallback(callback);

      res.json({ code: 'SUCCESS', message: '成功' });
    } catch (error) {
      console.error('微信支付回调处理失败:', error);
      res.status(400).json({ code: 'FAIL', message: '失败' });
    }
  }

  /**
   * 支付宝回调
   */
  static async alipayCallback(req, res) {
    try {
      const paymentProvider = new UnifiedPaymentProvider();
      const callback = await paymentProvider.verifyCallback(
        JSON.stringify(req.body),
        req.headers
      );

      await this.handlePaymentCallback(callback);

      res.send('success');
    } catch (error) {
      console.error('支付宝回调处理失败:', error);
      res.send('fail');
    }
  }

  /**
   * 处理支付回调
   */
  static async handlePaymentCallback(callback) {
    const { orderId, success, channel } = callback;

    if (!success) {
      await StorePayment.updateRechargeOrderStatus(orderId, 'failed');
      return;
    }

    // 获取订单信息
    const order = await StorePayment.getRechargeOrder(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'paid') {
      // 订单已处理，幂等返回
      return;
    }

    // 更新订单状态并给用户加积分
    await StorePayment.updateRechargeOrderStatus(orderId, 'paid', new Date());
    await StorePayment.addUserPoints(
      order.user_id,
      order.points,
      '充值',
      orderId
    );
  }

  /**
   * 模拟支付成功（开发环境）
   */
  static async simulatePayment(req, res) {
    try {
      const { orderId } = req.params;

      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          ok: false,
          error: '生产环境不允许模拟支付'
        });
      }

      const mockProvider = new UnifiedPaymentProvider();
      const success = await mockProvider.simulatePayment(orderId);

      if (success) {
        await this.handlePaymentCallback({
          orderId,
          success: true,
          channel: 'mock'
        });

        res.json({
          ok: true,
          data: { message: '模拟支付成功' }
        });
      } else {
        res.status(400).json({
          ok: false,
          error: '订单不存在'
        });
      }
    } catch (error) {
      console.error('模拟支付失败:', error);
      res.status(500).json({
        ok: false,
        error: '模拟支付失败'
      });
    }
  }

  /**
   * 验证 Apple In-App Purchase 并发放积分
   * POST /store-payment/apple/verify
   */
  static async verifyAppleIAP(req, res) {
    const logger = require('../utils/logger');
    const { db } = require('../config/database');

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }

      const { receipt, transaction_id, product_id, points, environment } = req.body;

      if (!receipt || !transaction_id || !product_id || !points) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      logger.info('Apple IAP verification request', {
        userId,
        transactionId: transaction_id,
        productId: product_id,
        points,
        environment
      });

      // 检查交易是否已处理（防止重复发放）
      const existingTransaction = await db('apple_iap_transactions')
        .where('transaction_id', transaction_id)
        .first();

      if (existingTransaction) {
        logger.warn('Duplicate Apple IAP transaction', { transactionId: transaction_id });
        return res.status(200).json({
          success: true,
          message: '交易已处理',
          points_added: existingTransaction.points,
          new_balance: await StorePayment.getUserPoints(userId)
        });
      }

      // 验证商品ID和积分数量映射
      // 新版统一定价: $1 ≈ 100 积分, 大额递增赠送
      const validProductPoints = {
        'com.funnypixels.points.100': 100,    // $0.99
        'com.funnypixels.points.330': 330,    // $2.99 (+10%)
        'com.funnypixels.points.580': 580,    // $4.99 (+16%)
        'com.funnypixels.points.1200': 1200,  // $9.99 (+20%)
        'com.funnypixels.points.3800': 3800,  // $29.99 (+27%)
        'com.funnypixels.points.6500': 6500,  // $49.99 (+30%)
        // 旧版兼容（处理未升级客户端的待完成交易）
        'com.funnypixels.points.60': 60,
        'com.funnypixels.points.300': 300,
        'com.funnypixels.points.680': 680,
        'com.funnypixels.points.1280': 1280,
        'com.funnypixels.points.3280': 3280,
        'com.funnypixels.points.6480': 6480
      };

      const expectedPoints = validProductPoints[product_id];
      if (!expectedPoints || expectedPoints !== points) {
        logger.error('Invalid product/points mapping', { productId: product_id, requestedPoints: points, expectedPoints });
        return res.status(400).json({
          success: false,
          message: '无效的商品或积分数量'
        });
      }

      // TODO: 在生产环境中，应该向 Apple 服务器验证 receipt
      // 使用 App Store Server API 或 App Store Receipts API
      // 这里简化处理，直接记录交易
      // 生产环境应该:
      // 1. 验证 receipt 签名
      // 2. 检查 bundle_id 是否匹配
      // 3. 检查交易是否有效
      // 4. 检查是否是沙盒环境

      const isSandbox = environment === 'sandbox' || environment === 'xcode';

      // 记录交易
      await db('apple_iap_transactions').insert({
        user_id: userId,
        transaction_id,
        product_id,
        points,
        receipt: receipt.substring(0, 500), // 只存储部分receipt用于记录
        environment: isSandbox ? 'sandbox' : 'production',
        status: 'completed',
        created_at: new Date()
      });

      // 发放积分
      await StorePayment.addUserPoints(userId, points, 'apple_iap', `Apple IAP: ${product_id}`);

      // 获取新余额
      const newBalance = await StorePayment.getUserPoints(userId);

      logger.info('Apple IAP verified and points added', {
        userId,
        transactionId: transaction_id,
        points,
        newBalance
      });

      res.json({
        success: true,
        message: '验证成功',
        points_added: points,
        new_balance: newBalance
      });

    } catch (error) {
      logger.error('Apple IAP verification failed:', error);
      res.status(500).json({
        success: false,
        message: '验证失败，请稍后重试'
      });
    }
  }
}

module.exports = StorePaymentController;
