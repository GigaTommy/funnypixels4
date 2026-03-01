import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Bomb, MapPin, Target, X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { StoreAPI } from '../services/store';
import MapSelector from './MapSelector';
import { toast } from 'react-hot-toast';
import { ItemUsageToast } from './ItemUsageToast';
import { replaceAlert, friendlyMessages } from '../utils/toastHelper';
// import { getAddressByCoordinate, isValidCoordinate } from '../utils/amapGeocoderHelper'; // Removed - AMap dependency

// Temporary stub functions to replace AMap functionality
const isValidCoordinate = (lat: number, lng: number): boolean => {
  return typeof lat === 'number' && typeof lng === 'number' &&
         !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
};

const getAddressByCoordinate = async (lat: number, lng: number, scope?: string): Promise<{poiName?: string, address?: string}> => {
  // Simple placeholder that returns coordinates instead of real address
  return {
    poiName: `位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    address: `坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})`
  };
};

interface BombUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  bombItem: any;
  onUseBomb: (lat: number, lng: number) => void;
}

export default function BombUsageModal({ isOpen, onClose, bombItem, onUseBomb }: BombUsageModalProps) {
  const [selectedLat, setSelectedLat] = useState(39.9042); // 默认北京坐标
  const [selectedLng, setSelectedLng] = useState(116.4074);
  const [isUsing, setIsUsing] = useState(false);
  const [useMode, setUseMode] = useState<'select' | 'use'>('select');
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cooldownInfo, setCooldownInfo] = useState<{remainingMinutes: number, isOnCooldown: boolean} | null>(null);
  const [locationName, setLocationName] = useState<string>('位置加载中');

  // 使用useMemo来缓存bombItem的元数据，避免重复计算
  const bombMetadata = useMemo(() => {
    if (!bombItem) return {};
    const metadata = bombItem.metadata || {};
    return {
      radius: metadata.radius || 6,
      cooldownMinutes: metadata.cooldown_minutes || 30,
      bombType: metadata.bomb_type || 'unknown'
    };
  }, [bombItem]);

  // 使用useMemo来缓存炸弹描述，避免重复计算
  const bombDescription = useMemo(() => {
    const { bombType } = bombMetadata;
    switch (bombType) {
      case 'color_bomb':
        return '将指定区域染成随机颜色';
      case 'pattern_bomb':
        return '在指定区域应用随机图案';
      case 'clear_bomb':
        return '清除指定区域的所有像素';
      case 'alliance_bomb':
        return '将指定区域染成联盟颜色';
      case 'emoji_bomb':
        return '在指定区域放置随机表情符号';
      default:
        return '在指定区域产生特殊效果';
    }
  }, [bombMetadata.bombType]);

  // 获取坐标对应的地点名称（逆向地理编码）
  const getLocationName = useCallback((lat: number, lng: number) => {
    // 验证坐标有效性
    if (!isValidCoordinate(lat, lng)) {
      logger.error('💣 坐标无效:', { lat, lng });
      setLocationName('坐标无效');
      return;
    }

    // 使用增强的Geocoder工具
    getAddressByCoordinate(lat, lng, '全国')
      .then((result) => {
        setLocationName(result.poiName || result.address || '位置加载中');
        logger.info(`✅ 炸弹位置信息获取成功: ${result.poiName || result.address}`);
      })
      .catch((error) => {
        logger.error('💣 获取位置名称失败:', error);

        // 根据错误类型设置用户提示
        if (error.message?.includes?.('INVALID_USER_SCODE')) {
          setLocationName('安全密钥配置错误');
        } else if (error.message?.includes?.('未加载')) {
          setLocationName('地图API加载中');
        } else {
          setLocationName(`查询失败`);
        }
      });
  }, []);

  // 监听坐标变化，自动获取位置名称
  useEffect(() => {
    if (isOpen) {
      // 延迟100ms以确保高德地图API已加载
      const timer = setTimeout(() => {
        getLocationName(selectedLat, selectedLng);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedLat, selectedLng, isOpen, getLocationName]);

  // 只在开发环境下打印渲染日志
  if (process.env.NODE_ENV === 'development') {
    logger.info('💣 BombUsageModal渲染:', { isOpen, bombItem: bombItem?.name });
  }

  const handleUseBomb = useCallback(async () => {
    if (isUsing || !bombItem) return;
    
    try {
      setIsUsing(true);
      setErrorMessage('');
      setCooldownInfo(null);
      
      // 调试日志：打印请求参数
      logger.info('💣 使用炸弹请求参数:', {
        itemId: bombItem.item_id,
        quantity: 1,
        targetId: `${selectedLat},${selectedLng}`,
        bombItem: bombItem
      });
      
      // 调用商店API使用炸弹，传递经纬度坐标
      const response = await StoreAPI.useItem(bombItem.item_id, 1, {
        targetId: `${selectedLat},${selectedLng}`
      });
      
      if (response.success) {
        // 显示成功提示
        const bombEffect = response.effects;
        if (bombEffect) {
          ItemUsageToast.showSuccess(bombItem.name, bombEffect);
        }
        
        // 触发地图像素更新事件
        if (bombEffect && bombEffect.bombType === 'color_bomb') {
          // 计算6x6像素网格的所有坐标
          const pixelSpacing = 0.0001; // 与后端保持一致
          const areaSize = bombEffect.areaSize || 6;
          const startLat = selectedLat + (areaSize / 2 - 0.5) * pixelSpacing;
          const startLng = selectedLng - (areaSize / 2 - 0.5) * pixelSpacing;
          
          // 为每个像素触发更新事件
          for (let row = 0; row < areaSize; row++) {
            for (let col = 0; col < areaSize; col++) {
              const pixelLat = startLat - row * pixelSpacing;
              const pixelLng = startLng + col * pixelSpacing;
              
              const pixelUpdateEvent = new CustomEvent('pixel-updated', {
                detail: {
                  lat: pixelLat,
                  lng: pixelLng,
                  color: bombEffect.randomColor || bombEffect.allianceColor || '#FF0000',
                  grid_id: `grid_${Math.floor((pixelLng + 180) / 0.0001)}_${Math.floor((pixelLat + 90) / 0.0001)}`,
                  timestamp: Date.now(),
                  bombEffect: true,
                  areaSize: 1 // 单个像素
                }
              });
              window.dispatchEvent(pixelUpdateEvent);
            }
          }
          
          logger.info(`💣 前端触发了 ${areaSize * areaSize} 个像素更新事件`);
        }
        
        // 调用地图组件的炸弹使用函数
        await onUseBomb(selectedLat, selectedLng);
        onClose();
      }
    } catch (error: any) {
      logger.error('使用炸弹失败:', error);
      
      // 解析错误信息
      let errorMsg = '使用炸弹失败，请稍后重试';
      let isCooldownError = false;
      let remainingMinutes = 0;
      
      if (error.message) {
        errorMsg = error.message;
        
        // 检查是否是冷却时间错误 - 支持多种格式
        const cooldownPatterns = [
          /还需等待(\d+)分钟/,
          /道具冷却中，还需等待(\d+)分钟/,
          /冷却中，还需等待(\d+)分钟/
        ];
        
        for (const pattern of cooldownPatterns) {
          const cooldownMatch = error.message.match(pattern);
          if (cooldownMatch) {
            isCooldownError = true;
            remainingMinutes = parseInt(cooldownMatch[1]);
            setCooldownInfo({ remainingMinutes, isOnCooldown: true });
            break;
          }
        }
      }
      
      setErrorMessage(errorMsg);
      
      // 显示错误提示 - 冷却错误不显示Toast，避免与模态框中的提示重复
      if (!isCooldownError) {
        ItemUsageToast.showError(errorMsg, bombItem.name);
      }
    } finally {
      setIsUsing(false);
    }
  }, [isUsing, bombItem, selectedLat, selectedLng, onUseBomb, onClose]);

  const handleCoordinateSelect = useCallback(() => {
    setUseMode('select');
  }, []);

  const handleDirectUse = useCallback(() => {
    setUseMode('use');
  }, []);

  const handleGetCurrentLocation = useCallback(() => {
    // 使用与GPS绘制模式一致的高德地图定位API
    if (!(window as any).AMap || !(window as any).AMap.plugin) {
      replaceAlert.warning('高德地图API未加载，无法进行GPS定位');
      return;
    }

    (window as any).AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new (window as any).AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        showButton: false,
        showMarker: false,
        showCircle: false,
        panToLocation: false,
        zoomToAccuracy: false,
        convert: true, // 自动转换为高德坐标系
        extensions: 'all', // 获取所有扩展信息
        maximumAge: 30000, // 缓存时间30秒
        cacheTimeout: 60000 // 缓存超时60秒
      });

      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete' && result && result.position) {
          const { lat, lng } = result.position;
          setSelectedLat(lat);
          setSelectedLng(lng);
          setUseMode('select');
          setErrorMessage(''); // 清除错误信息
        } else {
          logger.error('高德地图定位失败:', status, result);
          replaceAlert.warning(`获取当前位置失败: ${result?.message || status}`);
        }
      });
    });
  }, []);

  const handleMapSelect = useCallback((lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setUseMode('select');
    setShowMapSelector(false);
  }, []);

  const handleOpenMapSelector = useCallback(() => {
    setShowMapSelector(true);
  }, []);

  if (!bombItem) return null;

  const { radius, cooldownMinutes } = bombMetadata;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          key="bomb-usage-modal"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            style={{ 
              backgroundColor: 'white', 
              borderRadius: '16px', 
              padding: '24px', 
              width: '100%', 
              maxWidth: '448px',
              position: 'relative',
              zIndex: 10001
            }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Bomb className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{bombItem.name}</h3>
                  <p className="text-sm text-gray-500">{bombDescription}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* 炸弹信息 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">影响范围:</span>
                  <span className="ml-2 font-medium">{radius}x{radius} 像素</span>
                </div>
                <div>
                  <span className="text-gray-500">冷却时间:</span>
                  <span className="ml-2 font-medium">{cooldownMinutes} 分钟</span>
                </div>
              </div>
            </div>

            {/* 使用模式选择 */}
            <div className="mb-4">
              <div className="flex gap-2">
                <button
                  onClick={handleOpenMapSelector}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: '#ede9fe',
                    color: '#4f46e5',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <MapPin className="w-4 h-4 inline mr-1" />
                  地图选择
                </button>
                <button
                  onClick={handleGetCurrentLocation}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  📍 当前位置
                </button>
              </div>
            </div>

            {/* 坐标显示 */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">坐标显示</p>
                  <p className="text-xs text-gray-500">
                    纬度: {selectedLat.toFixed(6)}, 经度: {selectedLng.toFixed(6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">定位位置</p>
                  <p className="text-xs text-gray-500 max-w-xs overflow-hidden text-overflow-ellipsis whitespace-nowrap" title={locationName}>
                    {locationName}
                  </p>
                </div>
              </div>
            </div>

            {/* 状态提示 - 统一显示冷却、错误或正常状态 */}
            {cooldownInfo && cooldownInfo.isOnCooldown ? (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800">道具冷却中</p>
                    <p className="text-xs text-orange-600">
                      还需等待 {cooldownInfo.remainingMinutes} 分钟才能再次使用
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      影响范围: {radius}x{radius} 像素
                    </p>
                  </div>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">使用失败</p>
                    <p className="text-xs text-red-600">{errorMessage}</p>
                    <p className="text-xs text-red-500 mt-1">
                      影响范围: {radius}x{radius} 像素
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">使用说明</p>
                    <p className="text-xs text-blue-600">
                      冷却时间: {cooldownMinutes} 分钟 | 影响范围: {radius}x{radius} 像素
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                取消
              </button>
              <button
                onClick={handleUseBomb}
                disabled={isUsing || (cooldownInfo?.isOnCooldown ?? false)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: isUsing || (cooldownInfo?.isOnCooldown ?? false) ? '#d1d5db' : '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: isUsing || (cooldownInfo?.isOnCooldown ?? false) ? 'not-allowed' : 'pointer',
                  opacity: isUsing || (cooldownInfo?.isOnCooldown ?? false) ? 0.6 : 1,
                  boxShadow: isUsing || (cooldownInfo?.isOnCooldown ?? false) ? 'none' : '0 4px 12px rgba(79,70,229,0.2)',
                  transition: 'all 0.3s ease'
                }}
              >
                {isUsing ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    使用中...
                  </span>
                ) : (cooldownInfo?.isOnCooldown) ? (
                  <span className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2" />
                    冷却中 ({cooldownInfo.remainingMinutes}分钟)
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Bomb className="w-4 h-4 mr-2" />
                    使用炸弹
                  </span>
                )}
              </button>
            </div>

            {/* 警告信息 */}
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-700">
                ⚠️ 使用炸弹会立即生效，请确认位置后再使用。炸弹有 {cooldownMinutes} 分钟的冷却时间。
              </p>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* 地图选择器 */}
      <MapSelector
        isOpen={showMapSelector}
        onClose={() => setShowMapSelector(false)}
        onSelect={handleMapSelect}
        initialLat={selectedLat}
        initialLng={selectedLng}
      />
    </AnimatePresence>
  );
}
