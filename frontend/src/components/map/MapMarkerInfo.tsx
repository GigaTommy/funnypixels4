/**
 * 地图标记信息弹窗组件
 *
 * 功能：
 * - 显示宝藏和漂流瓶的详细地址信息
 * - 支持悬停时快速预览
 * - 支持点击时显示完整详情
 * - 风格与项目现有UI保持一致
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { getAddressByCoordinate, formatAddress, GeocoderResult } from '../../utils/amapGeocoderHelper'; // Removed - AMap dependency

// Temporary types and functions to replace AMap functionality
interface GeocoderResult {
  address: string;
  district?: string;
  city?: string;
  province?: string;
}

const getAddressByCoordinate = async (lat: number, lng: number, scope?: string): Promise<GeocoderResult> => {
  // Simple placeholder that returns coordinates instead of real address
  return {
    address: `位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: '未知区域',
    city: '未知城市',
    province: '未知省份'
  };
};

const formatAddress = (result: GeocoderResult): string => {
  return result.address;
};
import { logger } from '../../utils/logger';

export interface MapMarkerInfoProps {
  // 标记信息
  type: 'treasure' | 'drift-bottle';
  position: { lat: number; lng: number };
  title: string;
  itemId: string;

  // 漂流瓶特有属性
  bottleInfo?: {
    pickupCount: number;
    totalDistance: number;
    messageCount: number;
    currentCity?: string;
    currentCountry?: string;
    originCity?: string;
    originCountry?: string;
    createdAt: string;
  };

  // 宝藏特有属性
  treasureInfo?: {
    treasureType: 'fixed' | 'mobile';
    moveCount?: number;
    description?: string;
    hint?: string;
    rewardValue?: string;
    hiderName?: string;
    hiddenAt: string;
  };

  // 显示控制
  isVisible: boolean;
  anchorPoint: { x: number; y: number };
  mode: 'hover' | 'click';
  onClose: () => void;
}

export const MapMarkerInfo: React.FC<MapMarkerInfoProps> = ({
  type,
  position,
  title,
  itemId,
  bottleInfo,
  treasureInfo,
  isVisible,
  anchorPoint,
  mode,
  onClose
}) => {
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressData, setAddressData] = useState<GeocoderResult | null>(null);
  const addressCacheRef = useRef<Map<string, GeocoderResult>>(new Map());

  // 获取地址信息
  useEffect(() => {
    if (!isVisible || !position) return;

    const cacheKey = `${position.lat.toFixed(6)}_${position.lng.toFixed(6)}`;

    // 检查缓存
    if (addressCacheRef.current.has(cacheKey)) {
      setAddressData(addressCacheRef.current.get(cacheKey)!);
      return;
    }

    // 获取地址
    const fetchAddress = async () => {
      setAddressLoading(true);
      try {
        const result = await getAddressByCoordinate(position.lat, position.lng);
        setAddressData(result);
        addressCacheRef.current.set(cacheKey, result);
        logger.debug(`[MapMarkerInfo] 获取地址成功: ${result.address}`);
      } catch (error) {
        logger.warn('[MapMarkerInfo] 获取地址失败:', error);
        // 使用默认地址
        const defaultAddress = {
          address: bottleInfo?.currentCity || treasureInfo?.hiderName ?
            `${bottleInfo?.currentCity || '未知城市'}${treasureInfo?.hiderName ? ' - ' + treasureInfo.hiderName : ''}` :
            '位置信息获取中',
          district: bottleInfo?.currentCity || '未知'
        };
        setAddressData(defaultAddress);
      } finally {
        setAddressLoading(false);
      }
    };

    fetchAddress();
  }, [isVisible, position, bottleInfo?.currentCity, treasureInfo?.hiderName]);

  // 格式化距离
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}米`;
    }
    return `${(meters / 1000).toFixed(1)}公里`;
  };

  // 格式化时间
  const formatRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };

  // 格式化积分奖励
  const formatRewardPoints = (rewardValue?: string): number => {
    if (!rewardValue) return 0;
    try {
      const parsed = JSON.parse(rewardValue);
      return parsed.amount || 0;
    } catch {
      return 0;
    }
  };

  // 获取显示内容
  const getDisplayContent = () => {
    if (mode === 'hover') {
      // 悬停模式：显示简洁信息
      return (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '8px 12px',
          minWidth: '160px',
          maxWidth: '200px',
          fontSize: '13px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          {/* 标题 */}
          <div style={{
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>{type === 'treasure' ? '💎' : '🍾'}</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title}
            </span>
          </div>

          {/* 地址 */}
          <div style={{
            color: '#6b7280',
            fontSize: '11px',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {addressLoading ? '📍 位置获取中...' : `📍 ${addressData?.address || '未知位置'}`}
          </div>

          {/* 特有信息 */}
          {type === 'drift-bottle' && bottleInfo && (
            <div style={{
              fontSize: '11px',
              color: '#6b7280'
            }}>
              <span>漂流了 {formatRelativeTime(bottleInfo.createdAt)}</span>
            </div>
          )}

          {type === 'treasure' && treasureInfo && (
            <div style={{
              fontSize: '11px',
              color: '#6b7280'
            }}>
              <span>{treasureInfo.treasureType === 'mobile' ? '🚲 移动宝藏' : '📦 固定宝藏'}</span>
              {treasureInfo.treasureType === 'mobile' && treasureInfo.moveCount && (
                <span> · {treasureInfo.moveCount}次移动</span>
              )}
            </div>
          )}
        </div>
      );
    } else {
      // 点击模式：显示详细信息
      return (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          minWidth: '280px',
          maxWidth: '320px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}>
          {/* 头部 */}
          <div style={{
            padding: '12px 16px',
            background: type === 'treasure' ?
              'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)' :
              'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>
                {type === 'treasure' ? '💎' : '🍾'}
              </span>
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '1.2'
                }}>
                  {title}
                </div>
                <div style={{
                  fontSize: '11px',
                  opacity: 0.9
                }}>
                  {type === 'treasure' ?
                    (treasureInfo?.treasureType === 'mobile' ? '移动宝藏' : '固定宝藏') :
                    '漂流瓶'
                  }
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          {/* 内容区域 */}
          <div style={{ padding: '16px' }}>
            {/* 位置信息 */}
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>📍</span>
                <span>当前位置</span>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6b7280',
                lineHeight: '1.4'
              }}>
                {addressLoading ? '地址获取中...' : (addressData?.address || '未知位置')}
              </div>
            </div>

            {/* 漂流瓶特有信息 */}
            {type === 'drift-bottle' && bottleInfo && (
              <>
                {/* 统计信息 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    border: '1px solid #dbeafe'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1d4ed8'
                    }}>
                      {bottleInfo.pickupCount}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#64748b'
                    }}>
                      被捡次数
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '6px',
                    border: '1px solid #dcfce7'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#16a34a'
                    }}>
                      {formatDistance(bottleInfo.totalDistance)}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#64748b'
                    }}>
                      漂流距离
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: '#faf5ff',
                    borderRadius: '6px',
                    border: '1px solid #f3e8ff'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#9333ea'
                    }}>
                      {bottleInfo.messageCount}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#64748b'
                    }}>
                      纸条数量
                    </div>
                  </div>
                </div>

                {/* 起始和当前位置 */}
                <div style={{
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, marginRight: '4px' }}>🎯 起始地:</span>
                    <span>{bottleInfo.originCity || '未知'}, {bottleInfo.originCountry || '未知'}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, marginRight: '4px' }}>⏰ 漂流时长:</span>
                    <span>{formatRelativeTime(bottleInfo.createdAt)}</span>
                  </div>
                </div>
              </>
            )}

            {/* 宝藏特有信息 */}
            {type === 'treasure' && treasureInfo && (
              <>
                {/* 移动次数 */}
                {treasureInfo.treasureType === 'mobile' && treasureInfo.moveCount && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '6px',
                    border: '1px solid #d1fae5',
                    fontSize: '12px',
                    color: '#065f46'
                  }}>
                    <span style={{ fontWeight: 600, marginRight: '4px' }}>🚲</span>
                    <span>已移动 {treasureInfo.moveCount} 次</span>
                  </div>
                )}

                {/* 积分奖励 */}
                {formatRewardPoints(treasureInfo.rewardValue) > 0 && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                    fontSize: '12px',
                    color: '#92400e'
                  }}>
                    <span style={{ fontWeight: 600, marginRight: '4px' }}>💰</span>
                    <span>积分奖励: {formatRewardPoints(treasureInfo.rewardValue)}</span>
                  </div>
                )}

                {/* 宝藏描述 */}
                {treasureInfo.description && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                    color: '#374151',
                    lineHeight: '1.4'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>📄 描述</div>
                    <div>{treasureInfo.description}</div>
                  </div>
                )}

                {/* 宝藏线索 */}
                {treasureInfo.hint && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#f3e8ff',
                    borderRadius: '6px',
                    border: '1px solid #e9d5ff',
                    fontSize: '12px',
                    color: '#581c87',
                    lineHeight: '1.4'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>💡 线索</div>
                    <div>{treasureInfo.hint}</div>
                  </div>
                )}

                {/* 藏宝信息 */}
                {treasureInfo.hiderName && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, marginRight: '4px' }}>👤 藏宝者:</span>
                      <span>{treasureInfo.hiderName}</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, marginRight: '4px' }}>📅 藏宝时间:</span>
                      <span>{new Date(treasureInfo.hiddenAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 提示信息 */}
            <div style={{
              marginTop: '12px',
              padding: '8px',
              backgroundColor: type === 'treasure' ? '#fef3c7' : '#eff6ff',
              borderRadius: '6px',
              border: `1px solid ${type === 'treasure' ? '#fde68a' : '#dbeafe'}`,
              fontSize: '11px',
              color: type === 'treasure' ? '#92400e' : '#1e40af',
              textAlign: 'center'
            }}>
              {type === 'treasure' ?
                '💎 扫描二维码即可拾取此宝藏' :
                '🍾 点击即可拾取此漂流瓶'
              }
            </div>
          </div>
        </div>
      );
    }
  };

  // 计算位置以确保不超出视口
  const calculatePosition = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = anchorPoint.x;
    let y = anchorPoint.y;

    // 获取内容尺寸估算
    const contentWidth = mode === 'hover' ? 180 : 300;
    const contentHeight = mode === 'hover' ? 80 : 400;

    // 调整水平位置
    if (x + contentWidth > viewportWidth - 20) {
      x = viewportWidth - contentWidth - 20;
    }

    // 调整垂直位置
    if (y + contentHeight > viewportHeight - 20) {
      y = anchorPoint.y - contentHeight - 10;
    }

    // 确保不超出左上边界
    x = Math.max(20, x);
    y = Math.max(20, y);

    return { x, y };
  };

  const calculatedPosition = calculatePosition();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 0,
            scale: mode === 'hover' ? 0.8 : 0.9,
            y: mode === 'hover' ? 5 : 20
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: mode === 'hover' ? 0.8 : 0.9,
            y: mode === 'hover' ? 5 : 20
          }}
          transition={{
            duration: mode === 'hover' ? 0.15 : 0.2,
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
          style={{
            position: 'fixed',
            left: calculatedPosition.x,
            top: calculatedPosition.y,
            zIndex: mode === 'hover' ? 210 : 220, // 🔥 优化：使用标准z-index规范，标记信息
            pointerEvents: 'auto'
          }}
          onMouseLeave={mode === 'hover' ? onClose : undefined}
        >
          {getDisplayContent()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapMarkerInfo;