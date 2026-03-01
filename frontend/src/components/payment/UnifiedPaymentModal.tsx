import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, Smartphone, Coins, QrCode, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

export default function UnifiedPaymentModal({
  isOpen,
  onClose,
  amount,
  description,
  onSuccess,
  onError
}: PaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  useEffect(() => {
    if (orderId && selectedMethod !== 'points') {
      // 轮询支付状态
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [orderId, selectedMethod]);

  const loadPaymentMethods = async () => {
    try {
      const response = await api.get('/payment/methods');
      setPaymentMethods(response.data.data);
    } catch (error) {
      logger.error('加载支付方式失败:', error);
    }
  };

  const createPayment = async () => {
    if (!selectedMethod) {
      onError('请选择支付方式');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/payment/create', {
        method: selectedMethod,
        amount,
        description
      });

      const paymentData = response.data.data;
      setOrderId(paymentData.id);

      if (selectedMethod === 'points') {
        // 积分支付直接处理
        handlePointsPayment();
      } else {
        // 显示二维码
        setQrCode(paymentData.qrCode || paymentData.paymentUrl);
      }
    } catch (error) {
      logger.error('创建支付订单失败:', error);
      onError('创建支付订单失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePointsPayment = async () => {
    try {
      const response = await api.post('/payment/points', {
        amount,
        description
      });

      setPaymentStatus('success');
      onSuccess(response.data.data);
    } catch (error) {
      logger.error('积分支付失败:', error);
      setPaymentStatus('failed');
      onError('积分支付失败');
    }
  };

  const checkPaymentStatus = async () => {
    if (!orderId || !selectedMethod) return;

    try {
      const response = await api.get(`/payment/order/${selectedMethod}/${orderId}`);
      const status = response.data.data.status;

      if (status === 'SUCCESS' || status === 'TRADE_SUCCESS') {
        setPaymentStatus('success');
        onSuccess(response.data.data);
      } else if (status === 'FAILED' || status === 'TRADE_CLOSED') {
        setPaymentStatus('failed');
        onError('支付失败');
      }
    } catch (error) {
      logger.error('查询支付状态失败:', error);
    }
  };

  const simulatePayment = async () => {
    if (!orderId || !selectedMethod) return;

    try {
      await api.post(`/payment/simulate/${selectedMethod}/${orderId}`);
      setPaymentStatus('success');
      onSuccess({ orderId, success: true });
    } catch (error) {
      logger.error('模拟支付失败:', error);
      onError('模拟支付失败');
    }
  };

  const getMethodIcon = (icon: string) => {
    switch (icon) {
      case 'wechat':
        return <Smartphone className="w-6 h-6 text-green-500" />;
      case 'alipay':
        return <CreditCard className="w-6 h-6 text-blue-500" />;
      case 'points':
        return <Coins className="w-6 h-6 text-yellow-500" />;
      default:
        return <CreditCard className="w-6 h-6 text-gray-500" />;
    }
  };

  const resetModal = () => {
    setSelectedMethod('');
    setQrCode('');
    setOrderId('');
    setPaymentStatus('pending');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold text-gray-800">选择支付方式</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 支付金额 */}
          <div className="p-6 border-b">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">¥{amount.toFixed(2)}</div>
              <div className="text-gray-500 mt-1">{description}</div>
            </div>
          </div>

          {/* 支付方式选择 */}
          {!qrCode && paymentStatus === 'pending' && (
            <div className="p-6">
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full p-4 border rounded-xl flex items-center space-x-3 transition-all ${
                      selectedMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {getMethodIcon(method.icon)}
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-800">{method.name}</div>
                      <div className="text-sm text-gray-500">{method.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={createPayment}
                disabled={!selectedMethod || loading}
                className="w-full mt-6 bg-blue-500 text-white py-3 px-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                {loading ? '处理中...' : '确认支付'}
              </button>
            </div>
          )}

          {/* 二维码支付 */}
          {qrCode && paymentStatus === 'pending' && (
            <div className="p-6 text-center">
              <div className="mb-4">
                <QrCode className="w-32 h-32 mx-auto text-gray-400" />
              </div>
              <div className="text-lg font-medium text-gray-800 mb-2">请扫码支付</div>
              <div className="text-sm text-gray-500 mb-4">
                使用{selectedMethod === 'wechat' ? '微信' : '支付宝'}扫描二维码完成支付
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={simulatePayment}
                  className="bg-green-500 text-white py-2 px-4 rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  模拟支付成功
                </button>
              )}
            </div>
          )}

          {/* 支付结果 */}
          {paymentStatus !== 'pending' && (
            <div className="p-6 text-center">
              {paymentStatus === 'success' ? (
                <div>
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <div className="text-xl font-medium text-gray-800 mb-2">支付成功</div>
                  <div className="text-gray-500 mb-4">感谢您的购买！</div>
                  <button
                    onClick={handleClose}
                    className="bg-blue-500 text-white py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    完成
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="text-xl font-medium text-gray-800 mb-2">支付失败</div>
                  <div className="text-gray-500 mb-4">请重试或选择其他支付方式</div>
                  <button
                    onClick={resetModal}
                    className="bg-gray-500 text-white py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    重新支付
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
