import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
// 🔧 添加地图错误处理工具
import { getMapErrorHandler } from '../utils/mapErrorHandler';
import {
  dialogBackdropStyle,
  dialogMediumStyle,
  closeButtonStyle,
  cancelButtonStyle,
  COLORS
} from '../styles/dialogStyles';

// =======================
// ✅ 最终解决方案：彻底隐藏高德默认报错 UI
// =======================
/**
 * 彻底移除或隐藏高德 SDK 默认错误提示
 * - 处理网络错误 / key 无效 / 白名单错误
 * - 会多次检测 DOM，直到确认移除
 */
function removeAmapDefaultErrorUI(retry = 5) {
  const keywords = [
    "地图加载失败",
    "高德开放平台",
    "AMap",
    "控制台",
    "amap.com",
    "加载地图失败"
  ];

  const hideErrorDom = () => {
    const nodes = document.querySelectorAll("body *");
    for (const el of nodes) {
      try {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.innerText?.trim?.() ?? "";
        if (
          keywords.some((k) => text.includes(k)) &&
          htmlEl.offsetWidth > 100 &&
          htmlEl.offsetHeight > 30
        ) {
          htmlEl.style.display = "none";
          htmlEl.remove?.(); // 如果允许则直接移除
        }
      } catch {}
    }
  };

  // 第一次立即清理
  hideErrorDom();

  // 高德 SDK 可能延迟插入，我们延迟多次再清理
  let count = 0;
  const timer = setInterval(() => {
    hideErrorDom();
    count++;
    if (count >= retry) clearInterval(timer);
  }, 500);

  // 防御式样式覆盖
  if (!document.getElementById("amap-hide-style")) {
    const style = document.createElement("style");
    style.id = "amap-hide-style";
    style.innerHTML = `
      /* 覆盖高德地图的默认错误提示容器 */
      body div[style*="高德"],
      body div[style*="amap"],
      body div:has(span:contains("高德")),
      .amap-error, .AMap-error, .amap-logo, .amap-copyright,
      .amap-info, .amap-warning, .amap-container .error,
      .amap-container .warning {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* 更强力的选择器，覆盖可能的动态生成元素 */
      div[class*="amap"][class*="error"],
      div[class*="AMap"][class*="error"],
      div[id*="amap"][id*="error"],
      div[id*="AMap"][id*="error"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  logger.info('[Amap MapSelector] 已启动延迟清理机制，彻底移除高德默认错误UI');
}

interface MapSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapSelector({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialLat = 23.109,
  initialLng = 113.319 
}: MapSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selectedLat, setSelectedLat] = useState(initialLat);
  const [selectedLng, setSelectedLng] = useState(initialLng);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  // 获取用户当前位置 - 使用与GPS绘制模式一致的高德地图定位API
  const getCurrentLocation = useCallback(() => {
    return new Promise<{lat: number, lng: number}>((resolve, reject) => {
      // 优先使用高德地图定位API
      if ((window as any).AMap && (window as any).AMap.plugin) {
        // 5秒超时，与AmapCanvas保持一致
        const timeout = setTimeout(() => {
          logger.warn('⚠️ GPS定位超时，使用广州塔作为默认位置');
          const defaultLocation = { lat: initialLat, lng: initialLng };
          setCurrentLocation(defaultLocation);
          resolve(defaultLocation);
        }, 5000);

        (window as any).AMap.plugin('AMap.Geolocation', () => {
          const geolocation = new (window as any).AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 5000,
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
            clearTimeout(timeout);
            if (status === 'complete' && result && result.position) {
              const { lat, lng } = result.position;
              const location = { lat, lng };
              logger.info('✅ GPS定位成功:', location);
              setCurrentLocation(location);
              resolve(location);
            } else {
              logger.warn('⚠️ GPS定位失败，使用广州塔作为默认位置:', status, result);
              const defaultLocation = { lat: initialLat, lng: initialLng };
              setCurrentLocation(defaultLocation);
              resolve(defaultLocation);
            }
          });
        });
      } else if (navigator.geolocation) {
        // 降级到浏览器原生定位API
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const location = { lat: latitude, lng: longitude };
            logger.info('✅ 浏览器GPS定位成功:', location);
            setCurrentLocation(location);
            resolve(location);
          },
          (error) => {
            logger.warn('⚠️ 获取当前位置失败，使用广州塔作为默认位置:', error);
            // 如果获取位置失败，使用广州塔位置
            const defaultLocation = { lat: initialLat, lng: initialLng };
            setCurrentLocation(defaultLocation);
            resolve(defaultLocation);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000
          }
        );
      } else {
        logger.warn('⚠️ 浏览器不支持地理位置功能，使用广州塔作为默认位置');
        const defaultLocation = { lat: initialLat, lng: initialLng };
        setCurrentLocation(defaultLocation);
        resolve(defaultLocation);
      }
    });
  }, [initialLat, initialLng]);

  // 🚫 屏蔽高德SDK默认错误提示：加载高德地图API脚本（带超时控制）
  const loadAMapAPI = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // 如果已经加载了，直接返回
      if ((window as any).AMap) {
        resolve(true);
        return;
      }

      // 获取API密钥
      const apiKey = import.meta.env.VITE_AMAP_API_KEY;
      if (!apiKey) {
        logger.error('高德地图API密钥未配置');
        reject(new Error('高德地图API密钥未配置'));
        return;
      }

      const errorHandler = getMapErrorHandler();

      // 创建自定义加载界面
      const showMapSelectorLoading = () => {
        const existingContainer = mapContainerRef.current;
        if (existingContainer) {
          existingContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 320px; background: #f8f9fa; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="width: 32px; height: 32px; border: 3px solid #e3e3e3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
              <div style="color: #666; font-size: 13px;">正在加载地图选择器...</div>
              <div style="color: #999; font-size: 11px; margin-top: 6px;">请稍候</div>
              <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
          `;
        }
      };

      // 创建自定义错误界面
      const showMapSelectorError = (userMessage: string) => {
        const existingContainer = mapContainerRef.current;
        if (existingContainer) {
          existingContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 320px; background: #f8f9fa; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px;">
              <div style="width: 48px; height: 48px; background: #fee; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 20px;">⚠️</span>
              </div>
              <div style="color: #333; font-size: 14px; font-weight: 500; margin-bottom: 6px;">地图选择器加载失败</div>
              <div style="color: #666; font-size: 12px; text-align: center; margin-bottom: 16px;">${userMessage}</div>
              <button onclick="window.location.reload()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">重新加载页面</button>
            </div>
          `;
        }
      };

      showMapSelectorLoading();

      const script = document.createElement('script');
      const timeoutId = setTimeout(() => {
        // 超时处理：移除脚本，显示自定义错误界面
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        const timeoutMessage = '地图选择器加载超时，请检查网络连接';
        logger.warn('地图选择器高德地图脚本加载超时:', timeoutMessage);
        showMapSelectorError(timeoutMessage);
        removeAmapDefaultErrorUI(); // 移除高德默认错误面板
        reject(new Error(timeoutMessage));
      }, 12000); // 12秒超时，比主地图稍短

      // 只加载实际使用的插件，避免未使用插件导致的SDK内部错误
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&plugin=AMap.GeometryUtil,AMap.Geolocation&WebGLParams=false`;
      script.onload = () => {
        clearTimeout(timeoutId);
        logger.info('✅ 地图选择器高德地图API脚本加载成功');
        resolve(true);
      };
      script.onerror = (error) => {
        clearTimeout(timeoutId);
        // 移除脚本
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        const userFriendlyMessage = errorHandler.handleScriptError();
        logger.error('❌ 地图选择器高德地图API脚本加载失败:', userFriendlyMessage);
        showMapSelectorError(userFriendlyMessage);
        removeAmapDefaultErrorUI(); // 移除高德默认错误面板
        reject(new Error(userFriendlyMessage));
      };

      // 添加网络错误监听
      script.addEventListener('error', () => {
        clearTimeout(timeoutId);
        const networkMessage = '网络连接不稳定，地图选择器功能暂时不可用';
        logger.error('❌ 地图选择器高德地图脚本网络错误:', networkMessage);
        showMapSelectorError(networkMessage);
        removeAmapDefaultErrorUI(); // 移除高德默认错误面板
        reject(new Error(networkMessage));
      });

      document.head.appendChild(script);
    });
  }, []);

  // 等待高德地图API加载
  const waitForAMapAPI = useCallback(async (timeoutMs: number = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkAMap = () => {
        if ((window as any).AMap) {
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          logger.warn('高德地图API加载超时');
          resolve(false);
        } else {
          setTimeout(checkAMap, 100);
        }
      };
      checkAMap();
    });
  }, []);

  // 初始化地图
  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      // 先尝试加载高德地图API
      logger.info('🗺️ 开始加载高德地图API...');
      try {
        await loadAMapAPI();
        logger.info('✅ 高德地图API加载成功');
      } catch (loadError) {
        const errorHandler = getMapErrorHandler();
        const userFriendlyMessage = errorHandler.handleError(loadError);
        logger.warn('地图选择器高德地图API加载失败，尝试等待现有API:', userFriendlyMessage);
        // 如果加载失败，尝试等待现有的API
        const isAMapLoaded = await waitForAMapAPI(5000);
        if (!isAMapLoaded) {
          logger.error('地图选择器高德地图API不可用:', userFriendlyMessage);
          // 这里可以设置错误状态或显示用户友好提示
          return;
        }
      }

      // 先获取用户当前位置
      const location = await getCurrentLocation();
      logger.info('🗺️ 地图选择器使用位置:', location);

      // 创建地图实例，使用当前位置作为中心
      const map = new (window as any).AMap.Map(mapContainerRef.current, {
        zoom: 12,
        center: [location.lng, location.lat],
        mapStyle: 'amap://styles/light', // 地图选择器使用固定的月光银样式
        viewMode: '2D',
        resizeEnable: true,
        dragEnable: true,
        zoomEnable: true,
        doubleClickZoom: true,
        keyboardEnable: false,
        jogEnable: true,
        scrollWheel: true,
        touchZoom: true,
        showIndoorMap: false,
        showToolBar: false,
        showZoomBar: false,
        showScale: false
      });

      mapRef.current = map;

      // 创建标记点，使用当前位置
      const marker = new (window as any).AMap.Marker({
        position: [location.lng, location.lat],
        title: '炸弹位置',
        icon: new (window as any).AMap.Icon({
          size: new (window as any).AMap.Size(32, 32),
          image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#ff0000" stroke="#ffffff" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold">📍</text>
            </svg>
          `),
          imageSize: new (window as any).AMap.Size(32, 32)
        })
      });

      markerRef.current = marker;
      map.add(marker);

      // 设置初始选中位置为当前位置
      setSelectedLat(location.lat);
      setSelectedLng(location.lng);

      // 地图点击事件
      map.on('click', (e: any) => {
        const { lng, lat } = e.lnglat;
        setSelectedLat(lat);
        setSelectedLng(lng);
        
        // 更新标记位置
        marker.setPosition([lng, lat]);
      });

      // 地图加载完成
      map.on('complete', () => {
        setIsMapLoaded(true);
      });

    } catch (error) {
      logger.error('地图初始化失败:', error);
    }
  }, [getCurrentLocation, loadAMapAPI, waitForAMapAPI]);

  // 清理地图资源
  const destroyMap = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.destroy();
      mapRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current = null;
    }
    setIsMapLoaded(false);
  }, []);

  // 组件挂载时初始化地图
  useEffect(() => {
    if (isOpen) {
      // 延迟初始化，确保DOM已渲染
      const timer = setTimeout(() => {
        initMap();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      destroyMap();
    }
  }, [isOpen, initMap, destroyMap]);

  // 处理确认选择
  const handleConfirm = () => {
    onSelect(selectedLat, selectedLng);
    onClose();
  };

  // 处理取消
  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        key="map-selector"
        style={dialogBackdropStyle}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={dialogMediumStyle}
        >
          {/* 头部 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: '24px'
                  }}
                >
                  📍
                </span>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: COLORS.textDark,
                    margin: '0'
                  }}
                >
                  选择使用位置
                </h3>
                <p
                  style={{
                    fontSize: '12px',
                    color: COLORS.textMuted,
                    margin: '2px 0 0 0'
                  }}
                >
                  点击地图选择中心位置
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              style={closeButtonStyle}
            >
              <span
                style={{
                  fontSize: '18px'
                }}
              >
                ×
              </span>
            </button>
          </div>

          {/* 地图容器 */}
          <div
            style={{
              marginBottom: '12px'
            }}
          >
            <div
              ref={mapContainerRef}
              style={{
                width: '100%',
                height: '240px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.borderGray}`
              }}
            />
            {!isMapLoaded && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px'
                }}
              >
                <div
                  style={{
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid #e5e7eb',
                      borderTopColor: '#3b82f6',
                      margin: '0 auto 8px',
                      animation: 'spin 0.8s linear infinite'
                    }}
                  />
                  <p
                    style={{
                      fontSize: '14px',
                      color: COLORS.textMuted
                    }}
                  >
                    地图加载中...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 坐标显示 */}
          <div
            style={{
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: COLORS.textDark,
                    margin: '0'
                  }}
                >
                  选中坐标
                </p>
                <p
                  style={{
                    fontSize: '11px',
                    color: COLORS.textMuted,
                    margin: '2px 0 0 0'
                  }}
                >
                  纬度: {selectedLat.toFixed(6)} | 经度: {selectedLng.toFixed(6)}
                </p>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '12px'
                }}
              >
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: COLORS.textDark,
                    margin: '0'
                  }}
                >
                  使用范围
                </p>
                <p
                  style={{
                    fontSize: '11px',
                    color: COLORS.textMuted,
                    margin: '2px 0 0 0'
                  }}
                >
                  中心位置
                </p>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div
            style={{
              display: 'flex',
              gap: '10px'
            }}
          >
            <button
              onClick={handleCancel}
              style={{
                ...cancelButtonStyle,
                flex: 1,
                padding: '10px 12px',
                fontSize: '13px'
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: '13px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.3s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
            >
              确认位置
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
