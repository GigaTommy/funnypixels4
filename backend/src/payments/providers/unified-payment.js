const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * 统一支付集成方案
 * 参考开源项目的实现模式，支持多种支付方式
 */
class UnifiedPaymentProvider {
  constructor() {
    this.paymentMethods = {
      wechat: new WechatPayment(),
      alipay: new AlipayPayment(),
      points: new PointsPayment(),
      mock: new MockPayment()
    };
  }

  /**
   * 创建支付订单
   */
  async createPayment(orderData) {
    const { method, amount, currency = 'CNY', description, metadata = {} } = orderData;
    
    const paymentMethod = this.paymentMethods[method];
    if (!paymentMethod) {
      throw new Error(`不支持的支付方式: ${method}`);
    }

    const orderId = uuidv4();
    const paymentOrder = {
      id: orderId,
      method,
      amount,
      currency,
      description,
      metadata,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30分钟过期
    };

    // 调用具体支付方式创建订单
    const result = await paymentMethod.createOrder(paymentOrder);
    
    return {
      ...paymentOrder,
      ...result
    };
  }

  /**
   * 处理支付回调
   */
  async handleCallback(method, callbackData) {
    const paymentMethod = this.paymentMethods[method];
    if (!paymentMethod) {
      throw new Error(`不支持的支付方式: ${method}`);
    }

    const result = await paymentMethod.verifyCallback(callbackData);
    
    // 处理支付成功后的业务逻辑
    if (result.success) {
      await this.processPaymentSuccess(result);
    }

    return result;
  }

  /**
   * 处理支付成功后的业务逻辑
   */
  async processPaymentSuccess(result) {
    const { orderId, amount } = result;
    
    // 获取订单信息 - 这里需要根据支付订单ID找到对应的充值订单
    const { db } = require('../../config/database');
    
    // 首先尝试直接查找充值订单
    let order = await db('recharge_orders').where('id', orderId).first();
    
    // 如果没找到，可能是支付订单ID，需要查找对应的充值订单
    if (!order) {
      // 查找最近创建的充值订单，状态为pending
      order = await db('recharge_orders')
        .where('status', 'pending')
        .orderBy('created_at', 'desc')
        .first();
    }
    
    if (order && order.status === 'pending') {
      console.log('找到充值订单:', order.id, '用户ID:', order.user_id, '积分:', order.points);
      
      // 更新订单状态
      await db('recharge_orders')
        .where('id', order.id)
        .update({
          status: 'paid',
          paid_at: new Date()
        });

      // 给用户增加积分
      const StorePayment = require('../../models/StorePayment');
      await StorePayment.addUserPoints(
        order.user_id,
        order.points,
        '充值',
        order.id
      );
      
      console.log('充值成功，用户ID:', order.user_id, '增加积分:', order.points);
    } else {
      console.log('未找到待处理的充值订单，orderId:', orderId);
    }
  }

  /**
   * 查询订单状态
   */
  async queryOrder(orderId, method) {
    const paymentMethod = this.paymentMethods[method];
    if (!paymentMethod) {
      throw new Error(`不支持的支付方式: ${method}`);
    }

    return await paymentMethod.queryOrder(orderId);
  }
}

/**
 * 微信支付实现
 * 参考开源项目的实现模式
 */
class WechatPayment {
  constructor() {
    this.appId = process.env.WECHAT_APP_ID;
    this.mchId = process.env.WECHAT_MCH_ID;
    this.apiKey = process.env.WECHAT_API_KEY;
    this.notifyUrl = process.env.WECHAT_NOTIFY_URL;
  }

  async createOrder(orderData) {
    const { id: orderId, amount, description } = orderData;
    
    // 构建微信支付参数
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      body: description,
      out_trade_no: orderId,
      total_fee: Math.round(amount * 100), // 转换为分
      spbill_create_ip: '127.0.0.1',
      notify_url: this.notifyUrl,
      trade_type: 'NATIVE' // 扫码支付
    };

    // 添加签名
    params.sign = this.generateSign(params);

    // 这里应该调用微信支付API
    // 由于是示例，返回模拟数据
    return {
      qrCode: `weixin://wxpay/bizpayurl?pr=${orderId}`,
      orderId: orderId,
      paymentUrl: `https://pay.weixin.qq.com/native/${orderId}`
    };
  }

  async verifyCallback(callbackData) {
    // 验证签名
    const sign = callbackData.sign;
    delete callbackData.sign;
    
    const calculatedSign = this.generateSign(callbackData);
    if (sign !== calculatedSign) {
      throw new Error('签名验证失败');
    }

    return {
      orderId: callbackData.out_trade_no,
      success: callbackData.result_code === 'SUCCESS',
      amount: callbackData.total_fee / 100,
      transactionId: callbackData.transaction_id
    };
  }

  async queryOrder(orderId) {
    // 查询订单状态
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: orderId,
      nonce_str: this.generateNonceStr()
    };

    params.sign = this.generateSign(params);

    // 这里应该调用微信查询API
    // 返回模拟数据
    return {
      orderId,
      status: 'SUCCESS',
      amount: 100
    };
  }

  generateSign(params) {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && params[key] != null)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&') + `&key=${this.apiKey}`;

    return crypto.createHash('md5').update(sortedParams).digest('hex').toUpperCase();
  }

  generateNonceStr() {
    return Math.random().toString(36).substr(2, 15);
  }
}

/**
 * 支付宝支付实现
 * 参考开源项目的实现模式
 */
class AlipayPayment {
  constructor() {
    this.appId = process.env.ALIPAY_APP_ID;
    this.privateKey = process.env.ALIPAY_PRIVATE_KEY;
    this.publicKey = process.env.ALIPAY_PUBLIC_KEY;
    this.notifyUrl = process.env.ALIPAY_NOTIFY_URL;
  }

  async createOrder(orderData) {
    const { id: orderId, amount, description } = orderData;
    
    const params = {
      app_id: this.appId,
      method: 'alipay.trade.precreate',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
      version: '1.0',
      notify_url: this.notifyUrl,
      biz_content: JSON.stringify({
        out_trade_no: orderId,
        total_amount: amount.toFixed(2),
        subject: description,
        product_code: 'FACE_TO_FACE_PAYMENT'
      })
    };

    params.sign = this.generateSign(params);

    // 这里应该调用支付宝API
    // 返回模拟数据
    return {
      qrCode: `https://qr.alipay.com/${orderId}`,
      orderId: orderId,
      paymentUrl: `https://openapi.alipay.com/gateway.do?${this.buildQueryString(params)}`
    };
  }

  async verifyCallback(callbackData) {
    // 验证签名
    const sign = callbackData.sign;
    delete callbackData.sign;
    
    const calculatedSign = this.generateSign(callbackData);
    if (sign !== calculatedSign) {
      throw new Error('签名验证失败');
    }

    return {
      orderId: callbackData.out_trade_no,
      success: callbackData.trade_status === 'TRADE_SUCCESS',
      amount: parseFloat(callbackData.total_amount),
      transactionId: callbackData.trade_no
    };
  }

  async queryOrder(orderId) {
    const params = {
      app_id: this.appId,
      method: 'alipay.trade.query',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
      version: '1.0',
      biz_content: JSON.stringify({
        out_trade_no: orderId
      })
    };

    params.sign = this.generateSign(params);

    // 这里应该调用支付宝查询API
    // 返回模拟数据
    return {
      orderId,
      status: 'TRADE_SUCCESS',
      amount: 100
    };
  }

  generateSign(params) {
    // 简化的签名生成，实际应该使用RSA2
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && params[key] != null)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    return crypto.createHash('sha256').update(sortedParams).digest('hex');
  }

  buildQueryString(params) {
    return Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }
}

/**
 * 积分支付实现
 */
class PointsPayment {
  async createOrder(orderData) {
    const { id: orderId, amount, userId } = orderData;
    
    // 检查用户积分是否足够
    const userPoints = await this.getUserPoints(userId);
    if (userPoints < amount) {
      throw new Error('积分不足');
    }

    return {
      orderId: orderId,
      pointsRequired: amount,
      userPoints: userPoints,
      canPay: true
    };
  }

  async processPayment(orderData) {
    const { id: orderId, amount, userId } = orderData;
    
    // 扣除积分
    await this.deductPoints(userId, amount);
    
    return {
      orderId: orderId,
      success: true,
      deductedPoints: amount
    };
  }

  async getUserPoints(userId) {
    // 从数据库获取用户积分
    const { db } = require('../../config/database');
    const user = await db('users').where('id', userId).select('points').first();
    return user?.points || 0;
  }

  async deductPoints(userId, points) {
    const { db } = require('../../config/database');
    await db('users').where('id', userId).decrement('points', points);
  }
}

/**
 * 模拟支付实现（开发测试用）
 */
class MockPayment {
  async createOrder(orderData) {
    const { id: orderId } = orderData;
    
    return {
      orderId: orderId,
      qrCode: `mock://payment/${orderId}`,
      paymentUrl: `https://mock-payment.com/${orderId}`,
      mockData: true
    };
  }

  async verifyCallback(callbackData) {
    return {
      orderId: callbackData.orderId,
      success: callbackData.success !== false,
      amount: callbackData.amount || 100
    };
  }

  async queryOrder(orderId) {
    return {
      orderId,
      status: 'SUCCESS',
      amount: 100
    };
  }
}

module.exports = UnifiedPaymentProvider;
