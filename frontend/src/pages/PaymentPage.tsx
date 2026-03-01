import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { motion } from 'framer-motion';
import { config } from '../config/env';
import { 
  CreditCard, 
  Smartphone, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Loader
} from 'lucide-react';
// Removed Buffer import - using browser native atob instead

interface PaymentData {
  orderId: string;
  userId: string;
  amount: number;
  points: number;
  channel: string;
  qrCodeDataUrl?: string;
  timestamp: number;
  signature: string;
}

export default function PaymentPage() {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    logger.info('🔍 支付页面初始化:', { dataParam: dataParam ? dataParam.substring(0, 50) + '...' : 'null' });
    
    if (dataParam) {
      try {
        logger.info('🔍 开始解码支付数据...');
        // Use browser native atob for base64 decoding instead of Node.js Buffer
        const decodedData = JSON.parse(atob(dataParam));
        logger.info('✅ 支付数据解码成功:', decodedData);
        setPaymentData(decodedData);
        
        // 验证签名（这里应该在后端验证）
        setIsValid(true);
      } catch (error) {
        logger.error('❌ 支付数据解码失败:', error);
        setError(`支付链接无效: ${error instanceof Error ? error.message : '未知错误'}`);
        setIsValid(false);
      }
    } else {
      logger.info('❌ 缺少支付参数');
      setError('缺少支付参数');
      setIsValid(false);
    }
  }, []);

  // 支付状态轮询
  useEffect(() => {
    if (!paymentData || paymentData.channel !== 'mock') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/store-payment/orders/${paymentData.orderId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`
          }
        });

        if (response.ok) {
          const result = await response.json();
                     if (result.data.status === 'paid') {
             setPaymentStatus('success');
             clearInterval(pollInterval);
                         // 支付成功，自动跳转
              setTimeout(() => {
                // 使用状态管理跳转到商店页面
                window.history.pushState({}, '', '/store?payment=success');
                // 触发URL变化检测
                window.dispatchEvent(new PopStateEvent('popstate'));
              }, 2000);
           } else if (result.data.status === 'failed') {
            setPaymentStatus('failed');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        logger.error('轮询支付状态失败:', error);
      }
    }, 3000); // 每3秒轮询一次

    return () => clearInterval(pollInterval);
  }, [paymentData]);

  const handlePayment = async () => {
    if (!paymentData) return;
    
    logger.info('🔍 开始支付流程:', {
      orderId: paymentData.orderId,
      channel: paymentData.channel,
      amount: paymentData.amount,
      token: localStorage.getItem('funnypixels_token') ? '存在' : '不存在'
    });
    
    setIsProcessing(true);
    setError(null);
    
    try {
      if (paymentData.channel === 'mock') {
        // Mock支付：直接调用确认接口
        const response = await fetch(`${config.API_BASE_URL}/api/store-payment/orders/${paymentData.orderId}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`
          }
        });
        
        if (response.ok) {
          setPaymentStatus('success');
          // 支付成功，返回商店页面
          setTimeout(() => {
            // 使用状态管理跳转到商店页面
            window.history.pushState({}, '', '/store?payment=success');
            // 触发URL变化检测
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, 2000);
        } else {
          throw new Error('支付确认失败');
        }
      } else {
        // 真实支付：模拟支付处理
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 调用后端确认支付
        const response = await fetch(`${config.API_BASE_URL}/api/store-payment/orders/${paymentData.orderId}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`
          }
        });
        
        if (response.ok) {
          // 支付成功，返回商店页面
          window.history.pushState({}, '', '/store?payment=success');
          // 触发URL变化检测
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          throw new Error('支付确认失败');
        }
      }
    } catch (error) {
      setError('支付处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    // 直接导航回商店页面
    window.location.href = '/store';
  };

  if (!isValid) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          padding: '32px',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <AlertCircle style={{
            width: '64px',
            height: '64px',
            color: '#ef4444',
            margin: '0 auto 16px'
          }} />
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px'
          }}>支付链接无效</h1>
          <p style={{
            color: '#4b5563',
            marginBottom: '24px'
          }}>{error}</p>
          <button
            onClick={handleBack}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#16a34a',
              color: 'white',
              borderRadius: '12px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
          >
            返回商店
          </button>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Loader style={{
          width: '32px',
          height: '32px',
          animation: 'spin 1s linear infinite',
          color: '#16a34a'
        }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* 顶部导航 */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '16px' }}>
          <button
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#4b5563',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'color 0.3s ease',
              padding: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#4b5563'}
          >
            <ArrowLeft style={{ width: '20px', height: '20px', marginRight: '8px' }} />
            返回商店
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '32rem', margin: '0 auto', padding: '24px 16px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* 订单信息面板 - WeChat风格 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            padding: '16px'
          }}>
            {/* 订单ID */}
            <div style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              订单号：{paymentData.orderId.substring(0, 12)}
            </div>

            {/* 支付金额 - 突出显示 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginBottom: '4px'
                }}>充值金额</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#1f2937'
                }}>¥{paymentData.amount}</div>
              </div>
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginBottom: '4px'
                }}>获得积分</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#16a34a'
                }}>{paymentData.points.toLocaleString()}</div>
              </div>
            </div>

            {/* 支付方式选择 */}
            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '12px'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '8px',
                fontWeight: '500'
              }}>支付方式</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                <button
                  onClick={() => setSelectedMethod('wechat')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedMethod === 'wechat' ? '1px solid #16a34a' : '1px solid #e5e7eb',
                    backgroundColor: selectedMethod === 'wechat' ? '#f0fdf4' : 'white',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: selectedMethod === 'wechat' ? '#16a34a' : '#4b5563',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMethod !== 'wechat') {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMethod !== 'wechat') {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  微信支付
                </button>
                <button
                  onClick={() => setSelectedMethod('alipay')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedMethod === 'alipay' ? '1px solid #16a34a' : '1px solid #e5e7eb',
                    backgroundColor: selectedMethod === 'alipay' ? '#f0fdf4' : 'white',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: selectedMethod === 'alipay' ? '#16a34a' : '#4b5563',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMethod !== 'alipay') {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMethod !== 'alipay') {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  支付宝
                </button>
              </div>
            </div>
          </div>

          {/* Mock支付二维码 */}
          {paymentData.channel === 'mock' && paymentData.qrCodeDataUrl && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '12px'
              }}>扫描二维码完成支付</div>
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '8px',
                display: 'inline-block'
              }}>
                <img
                  src={paymentData.qrCodeDataUrl}
                  alt="支付二维码"
                  style={{ width: '120px', height: '120px', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}

          {/* 支付按钮 */}
          <div style={{ marginTop: '8px' }}>
            {paymentStatus === 'success' ? (
              <div style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#16a34a',
                color: 'white',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '16px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <CheckCircle style={{ width: '20px', height: '20px' }} />
                支付成功！正在跳转...
              </div>
            ) : paymentStatus === 'failed' ? (
              <div style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '16px',
                textAlign: 'center'
              }}>
                支付失败，请重试
              </div>
            ) : (
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: isProcessing ? '#d1d5db' : '#16a34a',
                  color: isProcessing ? '#9ca3af' : 'white',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '16px',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.backgroundColor = '#15803d';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                  }
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader style={{
                      width: '16px',
                      height: '16px',
                      animation: 'spin 1s linear infinite'
                    }} />
                    处理中...
                  </>
                ) : paymentData.channel === 'mock' ? (
                  '模拟支付完成'
                ) : (
                  `立即支付 ¥${paymentData.amount}`
                )}
              </button>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle style={{
                width: '16px',
                height: '16px',
                color: '#dc2626',
                flexShrink: 0
              }} />
              <span style={{
                color: '#991b1b',
                fontSize: '12px'
              }}>{error}</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
