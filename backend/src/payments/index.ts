import { PaymentProvider, PaymentError } from './PaymentProvider';
import { MockPaymentProvider } from './providers/mock';
import { WechatPaymentProvider } from './providers/wechat';
import { AlipayPaymentProvider } from './providers/alipay';
import { PaymentChannel } from '../shared/types/store';

class PaymentFactory {
  private static instance: PaymentFactory;
  private providers = new Map<PaymentChannel, PaymentProvider>();

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): PaymentFactory {
    if (!PaymentFactory.instance) {
      PaymentFactory.instance = new PaymentFactory();
    }
    return PaymentFactory.instance;
  }

  private initializeProviders() {
    // 总是初始化mock提供者
    this.providers.set('mock', new MockPaymentProvider());

    // 根据环境变量初始化真实支付提供者
    const paymentMode = process.env.PAYMENT_MODE || 'sandbox';

    if (paymentMode === 'prod') {
      try {
        this.providers.set('wechat', new WechatPaymentProvider());
      } catch (error) {
        console.warn('微信支付初始化失败，将使用mock模式:', error.message);
      }

      try {
        this.providers.set('alipay', new AlipayPaymentProvider());
      } catch (error) {
        console.warn('支付宝初始化失败，将使用mock模式:', error.message);
      }
    } else {
      console.log('当前为沙箱模式，仅使用mock支付');
    }
  }

  getProvider(channel: PaymentChannel): PaymentProvider {
    const provider = this.providers.get(channel);
    
    if (!provider) {
      // 如果请求的渠道不可用，降级到mock
      console.warn(`支付渠道 ${channel} 不可用，降级到mock模式`);
      return this.providers.get('mock')!;
    }

    return provider;
  }

  getAvailableChannels(): PaymentChannel[] {
    return Array.from(this.providers.keys());
  }

  isChannelAvailable(channel: PaymentChannel): boolean {
    return this.providers.has(channel);
  }
}

export const paymentFactory = PaymentFactory.getInstance();
