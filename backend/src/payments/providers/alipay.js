class AlipayPaymentProvider {
  constructor() {
    // 支付宝配置
    this.config = {
      appId: process.env.ALIPAY_APP_ID || 'mock_app_id',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || 'mock_private_key',
      publicKey: process.env.ALIPAY_PUBLIC_KEY || 'mock_public_key',
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipaydev.com/gateway.do'
    };
  }

  async createOrder(userId, amountRmb, points, idempotencyKey) {
    // 模拟支付宝订单创建
    const orderId = `ali_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      orderId,
      qrData: `alipays://platformapi/startapp?saId=10000007&qrcode=${orderId}`,
      channel: 'alipay'
    };
  }

  async verifyCallback(rawBody, headers) {
    // 模拟支付宝回调验证
    try {
      const body = JSON.parse(rawBody);
      return {
        orderId: body.out_trade_no,
        success: body.trade_status === 'TRADE_SUCCESS',
        channel: 'alipay'
      };
    } catch (error) {
      throw new Error('支付宝回调验证失败');
    }
  }

  getChannel() {
    return 'alipay';
  }
}

module.exports = { AlipayPaymentProvider };
