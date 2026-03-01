/**
 * 漂流瓶详情弹窗组件
 *
 * 功能：
 * - 展示漂流瓶详细信息
 * - 支持拾取操作
 * - 显示漂流历史和消息
 * - 响应式设计，适配移动端
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriftBottle, driftBottleService } from '../../services/driftBottleService';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';

export interface DriftBottleModalProps {
  bottle: DriftBottle | null;
  isOpen: boolean;
  onClose: () => void;
  onPickupSuccess?: (bottle: DriftBottle) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export const DriftBottleModal: React.FC<DriftBottleModalProps> = ({
  bottle,
  isOpen,
  onClose,
  onPickupSuccess,
  userLocation
}) => {
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // 加载漂流瓶消息
  useEffect(() => {
    if (isOpen && bottle) {
      loadMessages();
    }
  }, [isOpen, bottle]);

  const loadMessages = async () => {
    if (!bottle) return;

    setLoadingMessages(true);
    try {
      const result = await driftBottleService.getBottleDetails(bottle.bottle_id);
      if (result.success && result.data) {
        setMessages(result.data.bottle.messages || []);
      }
    } catch (error) {
      logger.error('加载漂流瓶消息失败:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handlePickup = async () => {
    if (!bottle || !userLocation) {
      toast.error('无法获取当前位置');
      return;
    }

    setIsPickingUp(true);
    try {
      const result = await driftBottleService.pickupBottle(
        bottle.bottle_id,
        userLocation.lat,
        userLocation.lng
      );

      if (result.success && result.data) {
        toast.success(`🎉 成功拾取漂流瓶！\n已添加到百宝箱`, {
          duration: 3000,
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 'bold',
            padding: '16px',
            borderRadius: '12px'
          }
        });

        onPickupSuccess?.(result.data.bottle);
        onClose();
      } else {
        toast.error(result.message || '拾取失败');
      }
    } catch (error) {
      logger.error('拾取漂流瓶失败:', error);
      toast.error('拾取漂流瓶失败');
    } finally {
      setIsPickingUp(false);
    }
  };

  const calculateDistance = (bottle: DriftBottle) => {
    if (!userLocation) return null;

    const R = 6371000; // 地球半径（米）
    const dLat = (bottle.current_lat - userLocation.lat) * Math.PI / 180;
    const dLng = (bottle.current_lng - userLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(bottle.current_lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters}米`;
    }
    return `${(meters / 1000).toFixed(1)}公里`;
  };

  const formatRelativeTime = (dateString: string) => {
    return driftBottleService.formatRelativeTime(dateString);
  };

  if (!bottle) return null;

  const distance = calculateDistance(bottle);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={onClose}
          />

          {/* 弹窗内容 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-lg mx-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* 头部 */}
              <div className="p-6 bg-gradient-to-r from-blue-500 to-cyan-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-3xl">🍾</span>
                    </div>
                    <div className="text-white">
                      <h3 className="text-xl font-bold">发现漂流瓶！</h3>
                      <p className="text-sm text-blue-100">瓶号: {bottle.bottle_id.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:text-blue-100 transition-colors text-2xl w-8 h-8 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>

                {distance !== null && (
                  <div className="bg-white bg-opacity-20 rounded-lg p-3 text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📍</span>
                      <span className="font-medium">距离您: {formatDistance(distance)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 内容区域（可滚动） */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* 统计信息 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">{bottle.pickup_count}</div>
                    <div className="text-xs text-gray-600 mt-1">被捡次数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">
                      {formatDistance(bottle.total_distance)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">漂流距离</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">{bottle.message_count}</div>
                    <div className="text-xs text-gray-600 mt-1">纸条数量</div>
                  </div>
                </div>

                {/* 详细信息 */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">📍</span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">当前位置</div>
                      <div className="font-medium text-gray-900">
                        {bottle.current_city || '未知城市'}, {bottle.current_country || '未知'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">🎯</span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">起始地</div>
                      <div className="font-medium text-gray-900">
                        {bottle.origin_city || '未知城市'}, {bottle.origin_country || '未知'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">⏰</span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">漂流时长</div>
                      <div className="font-medium text-gray-900">
                        {formatRelativeTime(bottle.created_at)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 最新消息 */}
                {messages.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span>📝</span>
                      <span>瓶中纸条</span>
                      <span className="text-xs text-gray-500">({messages.length})</span>
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {messages.slice(-3).map((msg, index) => (
                        <div key={index} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{msg.author_name}</span>
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loadingMessages && (
                  <div className="text-center py-4">
                    <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* 底部操作按钮 */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={handlePickup}
                  disabled={isPickingUp || !userLocation}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 px-6 rounded-xl font-semibold
                           hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105
                           active:scale-95 flex items-center justify-center gap-2"
                >
                  {isPickingUp ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>拾取中...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🎉</span>
                      <span>拾取这个漂流瓶</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  拾取后，您可以添加纸条或继续漂流
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DriftBottleModal;
