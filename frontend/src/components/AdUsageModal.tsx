import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, MapPin, Target, X, AlertCircle, CheckCircle } from 'lucide-react';
import MapSelector from './MapSelector';
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
import {
  dialogBackdropStyle,
  dialogSmallStyle,
  closeButtonStyle,
  infoPanelBlueStyle,
  errorPanelStyle,
  warningPanelStyle,
  cancelButtonStyle,
  primaryButtonBlueStyle,
  headerIconBgBlueStyle,
  COLORS
} from '../styles/dialogStyles';

interface AdUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  adItem: any;
  onUseAd: (lat: number, lng: number) => void;
}

export default function AdUsageModal({ isOpen, onClose, adItem, onUseAd }: AdUsageModalProps) {
  const [selectedLat, setSelectedLat] = useState(39.9042); // 默认北京坐标
  const [selectedLng, setSelectedLng] = useState(116.4074);
  const [isUsing, setIsUsing] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('北京市 中国国家博物馆');

  // 获取坐标对应的地点名称（逆向地理编码）
  const getLocationName = useCallback((lat: number, lng: number) => {
    // 验证坐标有效性
    if (!isValidCoordinate(lat, lng)) {
      logger.error('📍 坐标无效:', { lat, lng });
      setLocationName('坐标无效');
      return;
    }

    // 使用增强的Geocoder工具
    getAddressByCoordinate(lat, lng, '全国')
      .then((result) => {
        setLocationName(result.poiName || result.address || '位置加载中');
        logger.info(`✅ 广告位置信息获取成功: ${result.poiName || result.address}`);
      })
      .catch((error) => {
        logger.error('📍 获取位置名称失败:', error);

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

  const handleUseAd = useCallback(async () => {
    if (isUsing || !adItem) return;
    
    try {
      setIsUsing(true);
      setErrorMessage('');
      
      // 调用广告使用函数
      await onUseAd(selectedLat, selectedLng);
      onClose();
    } catch (error: any) {
      logger.error('使用广告失败:', error);
      setErrorMessage(error.message || '使用广告失败，请稍后重试');
    } finally {
      setIsUsing(false);
    }
  }, [isUsing, adItem, selectedLat, selectedLng, onUseAd, onClose]);

  const handleGetCurrentLocation = useCallback(() => {
    // 使用与GPS绘制模式一致的高德地图定位API
    if (!(window as any).AMap || !(window as any).AMap.plugin) {
      setErrorMessage('高德地图API未加载，无法进行GPS定位');
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
          setErrorMessage(''); // 清除错误信息
        } else {
          logger.error('高德地图定位失败:', status, result);
          setErrorMessage(`获取当前位置失败: ${result?.message || status}`);
        }
      });
    });
  }, []);

  const handleMapSelect = useCallback((lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setShowMapSelector(false);
  }, []);

  const handleOpenMapSelector = useCallback(() => {
    setShowMapSelector(true);
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

  if (!adItem) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="ad-usage-modal"
          style={dialogBackdropStyle}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={dialogSmallStyle}
          >
            {/* 头部 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={headerIconBgBlueStyle}>
                  <Megaphone className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: COLORS.textDark
                    }}
                  >
                    {adItem.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: COLORS.textMuted,
                      marginTop: '4px'
                    }}
                  >
                    在地图上放置广告
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                style={closeButtonStyle}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 广告信息 */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  fontSize: '14px'
                }}
              >
                <div>
                  <span
                    style={{
                      color: COLORS.textMuted
                    }}
                  >
                    广告尺寸:
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontWeight: 500
                    }}
                  >
                    {adItem.width || 0}×{adItem.height || 0} 像素
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      color: COLORS.textMuted
                    }}
                  >
                    广告类型:
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontWeight: 500
                    }}
                  >
                    {adItem.size_type === 'rectangle' ? '长方形' : '方形'}
                  </span>
                </div>
              </div>
            </div>

            {/* 位置选择 */}
            <div
              style={{
                marginBottom: '16px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <button
                  onClick={handleOpenMapSelector}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#bfdbfe')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
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
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#bbf7d0')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dcfce7')}
                >
                  📍 当前位置
                </button>
              </div>
            </div>

            {/* 坐标显示 */}
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: COLORS.textDark
                    }}
                  >
                    广告位置
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: COLORS.textMuted
                    }}
                  >
                    纬度: {selectedLat.toFixed(6)}, 经度: {selectedLng.toFixed(6)}
                  </p>
                </div>
                <div
                  style={{
                    textAlign: 'right'
                  }}
                >
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: COLORS.textDark
                    }}
                  >
                    广告地点
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: COLORS.textMuted,
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={locationName}
                  >
                    {locationName}
                  </p>
                </div>
              </div>
            </div>

            {/* 错误信息提示 */}
            {errorMessage && (
              <div
                style={{
                  ...errorPanelStyle,
                  marginBottom: '16px'
                }}
              >
                <AlertCircle
                  className="w-5 h-5"
                  style={{
                    color: '#991b1b',
                    flexShrink: 0
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#7f1d1d'
                    }}
                  >
                    操作失败
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#991b1b'
                    }}
                  >
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div
              style={{
                display: 'flex',
                gap: '12px'
              }}
            >
              <button
                onClick={onClose}
                style={{
                  ...cancelButtonStyle,
                  flex: 1
                }}
              >
                取消
              </button>
              <button
                onClick={handleUseAd}
                disabled={isUsing}
                style={{
                  ...primaryButtonBlueStyle,
                  flex: 1,
                  opacity: isUsing ? 0.5 : 1,
                  cursor: isUsing ? 'not-allowed' : 'pointer'
                }}
              >
                {isUsing ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}
                    />
                    使用中...
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Megaphone
                      className="w-4 h-4"
                      style={{
                        marginRight: '8px'
                      }}
                    />
                    使用广告
                  </span>
                )}
              </button>
            </div>

            {/* 警告信息 */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px'
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#78350f'
                }}
              >
                ⚠️ 广告放置后无法撤销，请谨慎选择位置。放置后广告将转换为像素点集合显示在地图上。
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
