import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { driftBottleService, DriftBottle, DriftBottleStats } from '../../services/driftBottleService';

interface DriftBottleProductProps {
  onPurchaseComplete?: (bottle: DriftBottle) => void;
}

/**
 * 漂流瓶商品组件
 */
export const DriftBottleProduct: React.FC<DriftBottleProductProps> = ({ onPurchaseComplete }) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // 获取用户位置
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('您的浏览器不支持定位功能');
      return;
    }

    setIsPurchasing(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setShowLocationModal(true);
        setIsPurchasing(false);
      },
      (error) => {
        logger.error('获取位置失败:', error);
        toast.error('无法获取您的位置，请检查定位权限');
        setIsPurchasing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5分钟缓存
      }
    );
  };

  // 购买漂流瓶
  const handlePurchase = async () => {
    if (!userLocation) {
      toast.error('请先选择位置');
      return;
    }

    setIsPurchasing(true);

    try {
      const result = await driftBottleService.purchaseAndCreate(
        userLocation.lat,
        userLocation.lng
      );

      if (result.success && result.data) {
        toast.success(`🍾 漂流瓶创建成功！\n瓶号: ${result.data.bottle.bottle_id}`);
        setShowLocationModal(false);
        setUserLocation(null);

        if (onPurchaseComplete) {
          onPurchaseComplete(result.data.bottle);
        }
      } else {
        toast.error(result.message || '购买失败');
      }
    } catch (error) {
      logger.error('购买漂流瓶失败:', error);
      toast.error('购买漂流瓶失败，请稍后重试');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.3s'
    }}>
      {/* 商品头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px'
        }}>
          🍾
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '8px'
          }}>神秘漂流瓶</h3>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>特殊商品</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#2563eb'
          }}>100 积分</div>
          <div style={{
            fontSize: '12px',
            color: '#9ca3af'
          }}>无限库存</div>
        </div>
      </div>

      {/* 商品描述 */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
          fontSize: '16px'
        }}>商品描述</h4>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.6'
        }}>
          抛出一个神秘的漂流瓶，它会在地图上随机漂流。其他用户可以捡起它，写下纸条，然后继续漂流。
          每个漂流瓶都记录着它的旅程和所有遇见过它的人的故事。
        </p>
      </div>

      {/* 功能特点 */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{
          fontWeight: '600',
          color: '#111827',
          marginBottom: '12px',
          fontSize: '16px'
        }}>功能特点</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <span style={{ color: '#2563eb' }}>🌊</span>
            <span>随机漂流机制，模拟真实海流</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <span style={{ color: '#2563eb' }}>📝</span>
            <span>支持多人添加纸条，记录故事</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <span style={{ color: '#2563eb' }}>📍</span>
            <span>记录完整的漂流轨迹和统计</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <span style={{ color: '#2563eb' }}>💎</span>
            <span>可以保存在个人库存中</span>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{
          fontWeight: '600',
          color: '#111827',
          marginBottom: '12px',
          fontSize: '16px'
        }}>使用说明</h4>
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <ol style={{
            fontSize: '14px',
            color: '#1e40af',
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.8'
          }}>
            <li>点击购买，选择抛出位置</li>
            <li>漂流瓶开始在海图上随机漂流</li>
            <li>其他用户发现并捡起你的漂流瓶</li>
            <li>他们可以添加纸条并继续漂流</li>
            <li>在库存中查看你持有和抛出的瓶子</li>
          </ol>
        </div>
      </div>

      {/* 购买按钮 */}
      <button
        onClick={getUserLocation}
        disabled={isPurchasing}
        style={{
          width: '100%',
          background: isPurchasing ? '#9ca3af' : 'linear-gradient(to right, #3b82f6, #06b6d4)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: '600',
          border: 'none',
          cursor: isPurchasing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          fontSize: '16px',
          opacity: isPurchasing ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (!isPurchasing) {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,130,246,0.3)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {isPurchasing ? (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid white',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            正在处理...
          </span>
        ) : (
          '🍾 购买漂流瓶'
        )}
      </button>

      {/* 位置确认弹窗 */}
      {showLocationModal && userLocation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '448px',
            width: '100%',
            margin: '0 16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>确认抛出位置</h3>
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  marginBottom: '8px'
                }}>选择的位置：</div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}>
                  纬度: {userLocation.lat.toFixed(6)}<br/>
                  经度: {userLocation.lng.toFixed(6)}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '24px'
            }}>
              漂流瓶将从这里开始它的旅程，随海流漂向世界各地...
            </div>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setUserLocation(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
              >
                取消
              </button>
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                style={{
                  flex: 1,
                  backgroundColor: isPurchasing ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isPurchasing ? 'not-allowed' : 'pointer',
                  opacity: isPurchasing ? 0.5 : 1,
                  transition: 'background-color 0.2s',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  if (!isPurchasing) e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  if (!isPurchasing) e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                {isPurchasing ? '购买中...' : '确认购买'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriftBottleProduct;