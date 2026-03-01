export type StoreItemType = "pixel_boost" | "pattern" | "frame" | "ad" | "bomb";
export type PaymentChannel = "wechat" | "alipay" | "mock";
export type OrderStatus = "pending" | "paid" | "failed";

export interface StoreItem {
  id: string;
  name: string;
  type: StoreItemType;
  price_points: number;         // 积分价（=0 表示仅现金）
  require_cash?: boolean;       // 仅现金可购
  metadata?: Record<string, any>; // 例如 patternCode, size, usageLimit 等
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RechargeOrder {
  id: string;
  user_id: string;
  amount_rmb: number;
  points: number;               // 到账积分
  channel: PaymentChannel;
  status: OrderStatus;
  idempotency_key: string;      // 幂等键
  created_at: string;
  paid_at?: string;
}

export interface UserInventory {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  consumed: boolean;
}

export interface WalletLedger {
  id: string;
  user_id: string;
  delta_points: number;
  reason: string;
  ref_id?: string;
  created_at: string;
}

export interface UserWallet {
  points: number;
  recent_ledger: WalletLedger[];
}

export interface PurchaseRequest {
  itemId: string;
  quantity?: number;
}

export interface RechargeRequest {
  channel: PaymentChannel;
  amountRmb: number;
  points: number;
  idempotencyKey: string;
}

export interface PaymentOrder {
  orderId: string;
  payUrl?: string;
  qrData?: string;
  qrCodeDataUrl?: string;
  channel: PaymentChannel;
}

export interface PaymentCallback {
  orderId: string;
  success: boolean;
  channel: PaymentChannel;
}
