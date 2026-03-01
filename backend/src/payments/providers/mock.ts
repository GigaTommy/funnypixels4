import { PaymentProvider, PaymentError } from '../PaymentProvider';
import { PaymentChannel, PaymentOrder, PaymentCallback } from '../../../shared/types/store';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export class MockPaymentProvider implements PaymentProvider {
  private orders = new Map<string, { userId: string; amountRmb: number; points: number }>();

  async createOrder(
    userId: string, 
    amountRmb: number, 
    points: number, 
    idempotencyKey: string
  ): Promise<PaymentOrder> {
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

  async verifyCallback(rawBody: string, headers: Record<string, string>): Promise<PaymentCallback> {
    try {
      const body = JSON.parse(rawBody);
      const { orderId, success = true } = body;
      
      if (!orderId || !this.orders.has(orderId)) {
        throw new PaymentError('订单不存在', 'ORDER_NOT_FOUND');
      }
      
      return {
        orderId,
        success,
        channel: 'mock'
      };
    } catch (error) {
      throw new PaymentError('回调验证失败', 'CALLBACK_VERIFY_FAILED');
    }
  }

  getChannel(): PaymentChannel {
    return 'mock';
  }

  /**
   * 模拟支付成功（开发环境使用）
   */
  async simulatePayment(orderId: string): Promise<boolean> {
    if (!this.orders.has(orderId)) {
      return false;
    }
    
    // 这里可以添加延迟模拟真实支付流程
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }
}
