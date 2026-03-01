const UnifiedPaymentProvider = require('../payments/providers/unified-payment');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const paymentProvider = new UnifiedPaymentProvider();

class UnifiedPaymentController {
  /**
   * 创建支付订单
   */
  static async createPayment(req, res) {
    try {
      const { method, amount, description, metadata = {} } = req.body;
      const userId = req.user.id;

      if (!method || !amount || !description) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      // 创建支付订单
      const orderData = {
        method,
        amount: parseFloat(amount),
        description,
        metadata: {
          ...metadata,
          userId,
          orderId: uuidv4()
        }
      };

      const paymentOrder = await paymentProvider.createPayment(orderData);

      res.json({
        success: true,
        data: paymentOrder
      });

    } catch (error) {
      console.error('创建支付订单失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '创建支付订单失败'
      });
    }
  }

  /**
   * 处理支付回调
   */
  static async handleCallback(req, res) {
    try {
      const { method } = req.params;
      const callbackData = req.body;

      const result = await paymentProvider.handleCallback(method, callbackData);

      // 根据支付方式返回不同的响应格式
      if (method === 'wechat') {
        res.json({ return_code: 'SUCCESS', return_msg: 'OK' });
      } else if (method === 'alipay') {
        res.send('success');
      } else {
        res.json({ success: true, data: result });
      }

    } catch (error) {
      console.error('处理支付回调失败:', error);
      
      if (req.params.method === 'wechat') {
        res.json({ return_code: 'FAIL', return_msg: error.message });
      } else if (req.params.method === 'alipay') {
        res.send('fail');
      } else {
        res.status(500).json({ success: false, message: error.message });
      }
    }
  }

  /**
   * 查询订单状态
   */
  static async queryOrder(req, res) {
    try {
      const { orderId, method } = req.params;
      const userId = req.user.id;

      const result = await paymentProvider.queryOrder(orderId, method);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('查询订单失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '查询订单失败'
      });
    }
  }

  /**
   * 积分支付
   */
  static async payWithPoints(req, res) {
    try {
      const { amount, description } = req.body;
      const userId = req.user.id;

      if (!amount || !description) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const orderData = {
        id: uuidv4(),
        method: 'points',
        amount: parseFloat(amount),
        description,
        userId
      };

      // 创建积分支付订单
      const paymentOrder = await paymentProvider.paymentMethods.points.createOrder(orderData);
      
      if (!paymentOrder.canPay) {
        return res.status(400).json({
          success: false,
          message: '积分不足'
        });
      }

      // 处理积分支付
      const result = await paymentProvider.paymentMethods.points.processPayment(orderData);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('积分支付失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '积分支付失败'
      });
    }
  }

  /**
   * 获取支付方式列表
   */
  static async getPaymentMethods(req, res) {
    try {
      const methods = [
        {
          id: 'wechat',
          name: '微信支付',
          icon: 'wechat',
          description: '使用微信扫码支付',
          enabled: true
        },
        {
          id: 'alipay',
          name: '支付宝',
          icon: 'alipay',
          description: '使用支付宝扫码支付',
          enabled: true
        },
        {
          id: 'points',
          name: '积分支付',
          icon: 'points',
          description: '使用账户积分支付',
          enabled: true
        }
      ];

      res.json({
        success: true,
        data: methods
      });

    } catch (error) {
      console.error('获取支付方式失败:', error);
      res.status(500).json({
        success: false,
        message: '获取支付方式失败'
      });
    }
  }

  /**
   * 模拟支付成功（开发环境）
   */
  static async simulatePayment(req, res) {
    try {
      const { orderId, method } = req.params;
      
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: '生产环境不允许模拟支付'
        });
      }

      // 模拟支付成功回调
      const callbackData = {
        orderId,
        success: true,
        amount: 100,
        transactionId: uuidv4()
      };

      const result = await paymentProvider.handleCallback(method, callbackData);

      res.json({
        success: true,
        data: result,
        message: '模拟支付成功'
      });

    } catch (error) {
      console.error('模拟支付失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '模拟支付失败'
      });
    }
  }
}

module.exports = UnifiedPaymentController;
