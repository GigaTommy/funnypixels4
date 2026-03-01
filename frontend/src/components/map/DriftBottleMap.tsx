import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { driftBottleService, DriftBottle } from '../../services/driftBottleService';

interface DriftBottleMapProps {
  userLocation: { lat: number; lng: number } | null;
  onBottlePickup?: (bottle: DriftBottle) => void;
}

/**
 * 地图上的漂流瓶可视化组件
 */
export const DriftBottleMap: React.FC<DriftBottleMapProps> = ({
  userLocation,
  onBottlePickup
}) => {
  const [nearbyBottles, setNearbyBottles] = useState<DriftBottle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<DriftBottle | null>(null);
  const [showBottleModal, setShowBottleModal] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (userLocation) {
      loadNearbyBottles();
      // 每30秒刷新一次附近的瓶子
      refreshIntervalRef.current = setInterval(loadNearbyBottles, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [userLocation]);

  const loadNearbyBottles = async () => {
    if (!userLocation) return;

    try {
      setIsLoading(true);
      const result = await driftBottleService.getNearbyBottles(
        userLocation.lat,
        userLocation.lng,
        50 // 50公里范围
      );

      if (result.success && result.data) {
        setNearbyBottles(result.data.bottles);
      }
    } catch (error) {
      logger.error('加载附近漂流瓶失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBottleClick = (bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowBottleModal(true);
  };

  const handlePickupBottle = async () => {
    if (!selectedBottle || !userLocation) return;

    setIsPickingUp(true);
    try {
      const result = await driftBottleService.pickupBottle(
        selectedBottle.bottle_id,
        userLocation.lat,
        userLocation.lng
      );

      if (result.success && result.data) {
        toast.success(`🎉 成功捡起漂流瓶！\n瓶号: ${selectedBottle.bottle_id}`);
        setShowBottleModal(false);
        setSelectedBottle(null);

        // 从附近瓶子列表中移除
        setNearbyBottles(prev => prev.filter(b => b.bottle_id !== selectedBottle.bottle_id));

        if (onBottlePickup) {
          onBottlePickup(result.data.bottle);
        }
      } else {
        toast.error(result.message || '捡起失败');
      }
    } catch (error) {
      logger.error('捡起漂流瓶失败:', error);
      toast.error('捡起漂流瓶失败');
    } finally {
      setIsPickingUp(false);
    }
  };

  const calculateDistance = (bottle: DriftBottle) => {
    if (!userLocation) return 0;

    const R = 6371000; // 地球半径（米）
    const dLat = (bottle.current_lat - userLocation.lat) * Math.PI / 180;
    const dLng = (bottle.current_lng - userLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(bottle.current_lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const formatRelativeTime = (dateString: string) => {
    return driftBottleService.formatRelativeTime(dateString);
  };

  if (!userLocation) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3 text-blue-800">
          <span className="text-2xl">🍾</span>
          <div>
            <div className="font-medium">开启定位发现漂流瓶</div>
            <div className="text-sm">允许定位后，附近的漂流瓶会显示在这里</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 附近漂流瓶统计 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">附近的漂流瓶</h3>
          <button
            onClick={loadNearbyBottles}
            disabled={isLoading}
            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isLoading ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-3">
          搜索范围: 50公里 | 发现 {nearbyBottles.length} 个瓶子
        </div>

        {nearbyBottles.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🌊</div>
            <div>附近暂无漂流瓶</div>
            <div className="text-sm">等待其他人的瓶子漂过来吧...</div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* 漂流瓶列表 */}
      <div className="space-y-3">
        {nearbyBottles.map((bottle) => {
          const distance = calculateDistance(bottle);
          return (
            <div
              key={bottle.bottle_id}
              onClick={() => handleBottleClick(bottle)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-300"
            >
              <div className="flex items-start gap-3">
                {/* 瓶子图标 */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🍾</span>
                </div>

                {/* 瓶子信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-semibold text-gray-900 truncate">
                      瓶号: {bottle.bottle_id}
                    </div>
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {driftBottleService.formatDistance(distance)}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    📍 {bottle.current_city || '未知城市'}, {bottle.current_country || '未知'}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div>
                      🎯 被捡 {bottle.pickup_count} 次
                    </div>
                    <div>
                      📝 {bottle.message_count || 0} 条纸条
                    </div>
                    <div>
                      ⏰ {formatRelativeTime(bottle.last_drift_time)}
                    </div>
                  </div>

                  {/* 最新纸条预览 */}
                  {bottle.latest_message && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <div className="font-medium text-gray-800 mb-1">
                        {bottle.latest_message.author_name}:
                      </div>
                      <div className="truncate">
                        {bottle.latest_message.message}
                      </div>
                    </div>
                  )}

                  {/* 起始信息 */}
                  <div className="mt-2 text-xs text-gray-500">
                    起始: {bottle.origin_city || '未知'} · 由 {bottle.original_owner_name || '匿名'} 抛出
                  </div>
                </div>

                {/* 捡起按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBottleClick(bottle);
                  }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                >
                  捡起
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 瓶子详情弹窗 */}
      {showBottleModal && selectedBottle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* 头部 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">发现漂流瓶！</h3>
                <button
                  onClick={() => {
                    setShowBottleModal(false);
                    setSelectedBottle(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🍾</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    瓶号: {selectedBottle.bottle_id}
                  </div>
                  <div className="text-sm text-gray-600">
                    距离您: {driftBottleService.formatDistance(calculateDistance(selectedBottle))}
                  </div>
                </div>
              </div>
            </div>

            {/* 瓶子信息 */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {selectedBottle.pickup_count}
                  </div>
                  <div className="text-xs text-gray-600">被捡次数</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {driftBottleService.formatDistance(selectedBottle.total_distance)}
                  </div>
                  <div className="text-xs text-gray-600">总漂流距离</div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <span className="text-gray-700">
                    当前位置: {selectedBottle.current_city || '未知'}, {selectedBottle.current_country || '未知'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎯</span>
                  <span className="text-gray-700">
                    起始地: {selectedBottle.origin_city || '未知'}, {selectedBottle.origin_country || '未知'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👤</span>
                  <span className="text-gray-700">
                    最初由: {selectedBottle.original_owner_name || '匿名'} 抛出
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span className="text-gray-700">
                    漂流时长: {driftBottleService.formatDuration(
                      Date.now() - new Date(selectedBottle.created_at).getTime()
                    )}
                  </span>
                </div>
              </div>

              {/* 最新纸条 */}
              {selectedBottle.latest_message && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">最新纸条:</div>
                  <div className="text-sm text-gray-700 mb-1">
                    <span className="font-medium">{selectedBottle.latest_message.author_name}: </span>
                    {selectedBottle.latest_message.message}
                  </div>
                  <div className="text-xs text-gray-500">
                    {driftBottleService.formatRelativeTime(selectedBottle.latest_message.created_at)}
                  </div>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={handlePickupBottle}
                disabled={isPickingUp}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 px-6 rounded-lg font-semibold
                         hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
              >
                {isPickingUp ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    捡起中...
                  </span>
                ) : (
                  '🎉 捡起这个漂流瓶'
                )}
              </button>
              <div className="text-xs text-gray-500 text-center mt-3">
                捡起后，您可以添加纸条或继续漂流
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriftBottleMap;