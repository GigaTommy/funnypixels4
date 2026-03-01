import { PaymentChannel, PaymentOrder, PaymentCallback } from '../shared/types/store';

export interface PaymentProvider {
  /**
   * 创建支付订单
   */
  createOrder(
    userId: string, 
    amountRmb: number, 
    points: number, 
    idempotencyKey: string
  ): Promise<PaymentOrder>;

  /**
   * 验证支付回调
   */
  verifyCallback(rawBody: string, headers: Record<string, string>): Promise<PaymentCallback>;

  /**
   * 获取支付渠道名称
   */
  getChannel(): PaymentChannel;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly canFallback: boolean = false
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}
