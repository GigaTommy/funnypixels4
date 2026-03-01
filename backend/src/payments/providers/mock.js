const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

class MockPaymentProvider {
  constructor() {
    this.orders = new Map();
  }

  async createOrder(userId, amountRmb, points, idempotencyKey) {
    const orderId = uuidv4();
    
    // 存储订单信息用于模拟回调
    this.orders.set(orderId, { userId, amountRmb, points });
    
    // 生成模拟二维码数据
    const qrData = `qr://mock-payment/${orderId}`;
    
    // 生成真实的二维码图片
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return {
      orderId,
      qrData,
      qrCodeDataUrl,
      channel: 'mock'
    };
  }

  async verifyCallback(rawBody, headers) {
    try {
      const body = JSON.parse(rawBody);
      const { orderId, success = true } = body;
      
      if (!orderId || !this.orders.has(orderId)) {
        throw new Error('订单不存在');
      }
      
      return {
        orderId,
        success,
        channel: 'mock'
      };
    } catch (error) {
      throw new Error('回调验证失败');
    }
  }

  getChannel() {
    return 'mock';
  }

  /**
   * 模拟支付成功（开发环境使用）
   */
  async simulatePayment(orderId) {
    if (!this.orders.has(orderId)) {
      return false;
    }
    
    // 这里可以添加延迟模拟真实支付流程
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }
}

module.exports = { MockPaymentProvider };
