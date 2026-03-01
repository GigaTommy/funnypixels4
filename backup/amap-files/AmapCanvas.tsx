import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';

// 全局类型声明
declare global {
  interface Window {
    loadNearbyTreasuresAt?: (location?: {lat: number, lng: number}) => Promise<void>;
    updateTreasureMarkers?: (treasures?: any[]) => void;
    // 🔧 修复：暴露AmapLayerService到全局，供调试使用
    AmapLayerService?: any;
    getAmapLayerService?: (map?: any) => any;
    destroyAmapLayerService?: () => void;
    amapLayerService?: any; // 实例引用
    mapInstance?: any; // 地图实例引用，供诊断工具使用
    amap?: any; // 兼容性别名
  }
}
import { PixelAPI } from '../../services/api';
import { UserService } from '../../services/api';
import { AllianceAPI } from '../../services/alliance';
import { pixelDrawService } from '../../services/pixelDrawService';
import { getAmapLayerService, destroyAmapLayerService } from '../../services/amapLayerService';
import { AmapLayerService } from '../../services/amapLayerService';
import { snapToGrid, calculateGridId, GRID_CONFIG as GRID_CONFIG_UTILS } from '../../utils/grid';
import { AuthService } from '../../services/auth';
import { tokenManager } from '../../services/tokenManager';
import { PixelService } from '../../services/pixel';
import { socket } from '../../services/socket';
import { config as envConfig } from '../../config/env';
import PixelInfoCard from './PixelInfoCard';
import type { PixelInfo } from '../../types/pixel';
import MapMoveManager from '../../utils/mapMoveManager';
// 🔧 修复：添加坐标转换工具导入
import { convertCoordinate } from '../../utils/coordinateConverter';
import { logger } from '../../utils/logger';
// 🗺️ 添加GPS模拟器支持
import { gpsSimulator, GPSPosition, GPSSimulator } from '../../utils/gpsSimulator';
// 🔧 添加地图错误处理工具
import { getMapErrorHandler, MapErrorType } from '../../utils/mapErrorHandler';
// 🎨 添加瓦片渲染支持
import TileLayerManager, { TileLayerMetrics } from '../../services/tileLayerManager';
import TileService from '../../services/tileService';
import TileUtils from '../../utils/tileUtils';
// 🧠 添加智能渲染模式管理器
import IntelligentRenderModeManager from '../../services/intelligentRenderModeManager';
import TileCache from '../../cache/tileCache';
import PendingTileLayer, { PendingPixel } from '../../render/pendingTileLayer';
import tileSocketManager, { TileRenderedEvent, PixelDiffEvent } from '../../ws/tileSocket';
// 🎯 添加增强GPS服务
import { enhancedGpsService, EnhancedGPSPosition, GPSDrawResult } from '../../services/enhancedGpsService';
import { sessionDataManager } from '../../services/sessionDataManager';
// 🍾 添加漂流瓶服务
import { driftBottleService, DriftBottle } from '../../services/driftBottleService';
// 💎 添加QR宝藏服务
import QRTreasureMapService, { QRTreasure } from '../../services/qrTreasureMapService';
import { QRTreasureLayerManager } from '../../services/qrTreasureLayerManager';
import { MapMarkerInfo } from './MapMarkerInfo';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import MapSearchBar from './MapSearchBar';

// 🚀 性能优化：预加载定位模块，避免首次动态import延迟
const locationModulePromise = import('../../utils/locationTest');

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

  logger.info('[Amap] 已启动延迟清理机制，彻底移除高德默认错误UI');
}

// 高德地图配置
const getMapConfig = () => {
  const apiKey = import.meta.env.VITE_AMAP_API_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;

  if (!apiKey) {
    throw new Error('高德地图API密钥未配置');
  }

  // 验证安全密钥配置
  if (!securityJsCode) {
    logger.warn('[Amap] 安全密钥未配置，某些接口（如Geocoder）可能不可用，请添加VITE_AMAP_SECURITY_JS_CODE到.env');
  }

  // 确保window._AMapSecurityConfig已设置
  if (typeof window !== 'undefined' && securityJsCode) {
    if (!(window as any)._AMapSecurityConfig) {
      (window as any)._AMapSecurityConfig = {};
    }
    (window as any)._AMapSecurityConfig.securityJsCode = securityJsCode;
  }

  return {
    apiKey,
    version: '2.0',
    // 只加载实际使用的插件，避免未使用插件导致的SDK内部错误
    // GeometryUtil: 用于距离和面积计算
    // Geolocation: 用于GPS定位
    // AutoComplete & PlaceSearch: 用于地图搜索功能
    plugins: ['AMap.GeometryUtil', 'AMap.Geolocation', 'AMap.AutoComplete', 'AMap.PlaceSearch']
  };
};

// 网格系统配置 - 使用统一的配置
const GRID_CONFIG = {
  PIXEL_SIZE_METERS: 11, // 11米 x 11米的像素
  EARTH_RADIUS: 6371000, // 地球半径（米）
  PIXELS_PER_DEGREE_LAT: 1000000 / 11, // 纬度方向每度的像素数
  PIXELS_PER_DEGREE_LNG: 1000000 / 11, // 经度方向每度的像素数
  TOTAL_PIXELS: 4e12, // 4万亿像素
  GRID_SIZE: GRID_CONFIG_UTILS.GRID_SIZE, // 使用统一的网格大小
  GRID_PRECISION: 1000000 // 网格精度
};

// 像素数据结构
interface Pixel {
  lat: number;
  lng: number;
  color: string;
  owner: string;
  gridId: string;
  timestamp: number;
  version?: number;
}

type AllianceFlagInfo = {
  pattern_id: string;
  anchor_x: number;
  anchor_y: number;
  rotation: number;
  mirror: boolean;
  unicode_char?: string;
  render_type?: string;
  color?: string;
  payload?: string;  // 添加payload字段，用于渲染complex图案
  encoding?: string;  // 添加encoding字段
};

// 组件属性接口
interface AmapCanvasProps {
  onMapReady?: (map: any) => void;
  onGpsToggle?: (enabled: boolean) => void;
  gpsEnabled?: boolean;
  manualModeEnabled?: boolean;
  currentSessionId?: string | null; // 🆕 当前绘制会话ID
  canDraw?: boolean; // 🆕 是否可以绘制
  manualConsumePixel?: () => void;
  onPixelUpdate?: (pixel: any) => void; // 添加像素更新回调
  isAuthenticated?: boolean; // 添加用户认证状态
  targetLocation?: { lat: number; lng: number } | null; // 🔗 分享链接目标位置
  onTargetLocationHandled?: () => void; // 🔗 目标位置处理完成回调
}

// 高德地图组件 - 基于JS API 2.0
export default function AmapCanvas({
  onMapReady,
  onGpsToggle,
  gpsEnabled: externalGpsEnabled,
  manualModeEnabled,
  currentSessionId,
  manualConsumePixel,
  onPixelUpdate,
  isAuthenticated = false,
  targetLocation,
  onTargetLocationHandled
}: AmapCanvasProps) {
  // 🍾 添加CSS动画样式
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }

      .drift-bottle-marker {
        animation: pulse 2s infinite;
      }

      .drift-bottle-marker:hover {
        animation: float 1s ease-in-out infinite;
        transform: scale(1.1);
        filter: brightness(1.2);
        transition: all 0.3s ease;
      }

      .treasure-marker {
        animation: pulse 2.5s infinite;
      }

      .treasure-marker:hover {
        animation: float 1.5s ease-in-out infinite;
        transform: scale(1.15);
        filter: brightness(1.3) saturate(1.2);
        transition: all 0.3s ease;
      }

      @keyframes treasureGlow {
        0% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.5); }
        50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.8); }
        100% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.5); }
      }

      @keyframes mobileTreasurePulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pixelsRef = useRef<Map<string, any>>(new Map());
  const isDrawingRef = useRef(false);
  const colorRef = useRef('#ff0000');
  const userStateRef = useRef<any>(null);
  const layerServiceRef = useRef<any>(null);
  const mapMoveManagerRef = useRef<MapMoveManager | null>(null);
  const allianceFlagRef = useRef<AllianceFlagInfo | null>(null);
  
  // 瓦片渲染相关
  const tileLayerManagerRef = useRef<TileLayerManager | null>(null);
  const tileServiceRef = useRef<TileService | null>(null);
  const tileCacheRef = useRef<TileCache | null>(null);
  const pendingTileLayerRef = useRef<PendingTileLayer | null>(null);
  const [tileModeEnabled, setTileModeEnabled] = useState(false);
  const [tilePerformanceMetrics, setTilePerformanceMetrics] = useState<TileLayerMetrics | null>(null);
  const [renderStrategy, setRenderStrategy] = useState<'tile' | 'dom' | 'hybrid'>('hybrid');
  const pendingPixelsRef = useRef<Map<string, PendingPixel>>(new Map());
  const pendingPixelsByTileRef = useRef<Map<string, Set<string>>>(new Map());
  
  // 🧠 智能渲染模式管理器
  const intelligentRenderManagerRef = useRef<IntelligentRenderModeManager | null>(null);
  const [currentRenderMode, setCurrentRenderMode] = useState<'normal' | 'tile' | 'hybrid'>('normal');
  
  // GPS相关状态
  // 移除内部GPS状态，直接使用外部状态 externalGpsEnabled
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'tracking' | 'error'>('idle');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // 🔗 分享链接处理状态标记
  const [shareLinkProcessed, setShareLinkProcessed] = useState(false);

  // 绘制相关状态
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff0000');
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // API相关状态
  const [userState, setUserState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // 模态框状态
  const [modalInfo, setModalInfo] = useState({
    message: '',
    type: 'info' as 'info' | 'warning' | 'error',
    isVisible: false
  });

  
  // 像素信息卡片状态
  const [pixelInfoCard, setPixelInfoCard] = useState<{
    isVisible: boolean;
    pixel: PixelInfo | null;
    position: { x: number; y: number };
  }>({
    isVisible: false,
    pixel: null,
    position: { x: 0, y: 0 }
  });

  // 🍾 漂流瓶相关状态
  const [nearbyBottles, setNearbyBottles] = useState<DriftBottle[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<DriftBottle | null>(null);
  const [showBottleModal, setShowBottleModal] = useState(false);
  const [isPickingUpBottle, setIsPickingUpBottle] = useState(false);
  const [showBottleFoundAnimation, setShowBottleFoundAnimation] = useState(false);
  const [foundBottleInfo, setFoundBottleInfo] = useState<DriftBottle | null>(null);

  // 🍾 漂流瓶地图标记引用
  const bottleMarkersRef = useRef<Map<string, any>>(new Map());

  // 💎 QR宝藏相关状态
  const [nearbyTreasures, setNearbyTreasures] = useState<QRTreasure[]>([]);
  const [selectedTreasure, setSelectedTreasure] = useState<QRTreasure | null>(null);
  const [showTreasureModal, setShowTreasureModal] = useState(false);
  const [isClaimingTreasure, setIsClaimingTreasure] = useState(false);
  const [showTreasureFoundAnimation, setShowTreasureFoundAnimation] = useState(false);
  const [foundTreasureInfo, setFoundTreasureInfo] = useState<QRTreasure | null>(null);

  // 📍 信息窗口状态
  const [hoverInfo, setHoverInfo] = useState<{
    type: 'treasure' | 'drift-bottle';
    item: any;
    position: { x: number; y: number };
  } | null>(null);
  const [clickInfo, setClickInfo] = useState<{
    type: 'treasure' | 'drift-bottle';
    item: any;
    position: { x: number; y: number };
  } | null>(null);

  // 💎 QR宝藏图层管理器引用
  const treasureLayerManagerRef = useRef<QRTreasureLayerManager | null>(null);

  // 🔥 并发控制：防止多个请求同时进行
  const loadingStateRef = useRef({
    bottles: false,
    treasures: false,
    abortController: null as AbortController | null
  });

  // 🔥 性能监控：检测异常频繁切换
  const performanceMonitor = useRef({
    lastGPSToggle: 0,
    toggleCount: 0,
    windowStart: Date.now()
  });

  // 获取地图配置
  const config = useMemo(() => getMapConfig(), []);

  // 网格可视化状态
  const [showGrid, setShowGrid] = useState(false);
  const gridOverlaysRef = useRef<Map<string, any>>(new Map());

  // 搜索标记管理
  const searchMarkersRef = useRef<any[]>([]);

  // 处理搜索位置
  const handleLocationSearch = useCallback((keyword: string, location: { lng: number; lat: number }) => {
    if (mapRef.current) {
      const map = mapRef.current;

      // 确保地图已完全加载
      if (!isMapLoaded) {
        logger.warn('地图尚未完全加载，延迟执行搜索定位');
        setTimeout(() => handleLocationSearch(keyword, location), 500);
        return;
      }

      // 验证坐标有效性
      if (!location.lng || !location.lat || isNaN(location.lng) || isNaN(location.lat)) {
        logger.error('搜索定位失败：无效的坐标', { location });
        return;
      }

      // 验证坐标范围（经度：-180 到 180，纬度：-90 到 90）
      if (location.lng < -180 || location.lng > 180 || location.lat < -90 || location.lat > 90) {
        logger.error('搜索定位失败：坐标超出范围', { location });
        return;
      }

      // 清理之前的搜索标记
      searchMarkersRef.current.forEach(marker => {
        map.remove(marker);
      });
      searchMarkersRef.current = [];

      logger.info('开始搜索定位:', { keyword, location });

      // 使用更可靠的定位方法：先设置缩放级别，再设置中心点
      map.setZoom(15, false, 300); // 搜索时设置合适的缩放级别，300ms动画

      // 延迟设置中心点，确保缩放完成后再定位
      setTimeout(() => {
        // 使用 panTo 方法而不是 setCenter，提供更平滑的定位体验
        map.panTo([location.lng, location.lat], 500); // 500ms平滑移动动画

        logger.info('地图定位到搜索位置:', { keyword, location });

        // 验证定位是否成功
        setTimeout(() => {
          const currentCenter = map.getCenter();
          const distance = Math.sqrt(
            Math.pow(currentCenter.getLng() - location.lng, 2) +
            Math.pow(currentCenter.getLat() - location.lat, 2)
          );

          if (distance > 0.01) { // 如果距离误差很大
            logger.warn('搜索定位可能不准确:', {
              expected: location,
              actual: { lng: currentCenter.getLng(), lat: currentCenter.getLat() },
              distance
            });

            // 尝试重新定位
            map.setCenter([location.lng, location.lat], false, 200);
          }
        }, 600);
      }, 100);

      // 添加搜索标记
      const AMap = (window as any).AMap;
      const marker = new AMap.Marker({
        position: [location.lng, location.lat],
        title: keyword,
        icon: new AMap.Icon({
          size: new AMap.Size(25, 34),
          imageSize: new AMap.Size(25, 34),
          image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAyNSAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEM1LjU5NjQ0IDAgMCA1LjU5NjQ0IDAgMTIuNUMwIDE2LjM3NjggMi44NzUgMjIuMjUgMTIuNSAzNEMyMi4xMjUgMjIuMjUgMjUgMTYuMzc2OCAyNSAxMi41QzI1IDUuNTk2NDQgMTkuNDAzNiAwIDEyLjUgMFoiIGZpbGw9IiNGRjQ0NDQiLz4KPGNpcmNsZSBjeD0iMTIuNSIgY3k9IjEyLjUiIHI9IjgiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo='
        }),
        offset: new AMap.Pixel(-12, -34),
        zIndex: 200 // 🔥 优化：使用标准z-index规范，搜索标记
      });

      map.add(marker);
      searchMarkersRef.current.push(marker);
    } else {
      logger.warn('地图引用不存在，无法执行搜索定位');
    }
  }, [isMapLoaded]);

  // 切换网格显示
  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  // 显示网格
  const showGridLines = useCallback(() => {
    if (!mapRef.current || !(window as any).AMap) return;

    const AMap = (window as any).AMap;
    const bounds = mapRef.current.getBounds();
    
    if (!bounds) return;

    // 清除现有网格
    gridOverlaysRef.current.forEach(overlay => {
      mapRef.current.remove(overlay);
    });
    gridOverlaysRef.current.clear();

    const { north, south, east, west } = {
      north: bounds.getNorthEast().lat,
      south: bounds.getSouthWest().lat,
      east: bounds.getNorthEast().lng,
      west: bounds.getSouthWest().lng
    };

    const gridSize = GRID_CONFIG.GRID_SIZE;
    
    // 绘制网格线
    for (let lat = Math.floor(south / gridSize) * gridSize; lat <= north; lat += gridSize) {
      const line = new AMap.Polyline({
        path: [[west, lat], [east, lat]],
        strokeColor: '#CCCCCC',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        zIndex: 500
      });
      mapRef.current.add(line);
      gridOverlaysRef.current.set(`lat_${lat}`, line);
    }

    for (let lng = Math.floor(west / gridSize) * gridSize; lng <= east; lng += gridSize) {
      const line = new AMap.Polyline({
        path: [[lng, south], [lng, north]],
        strokeColor: '#CCCCCC',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        zIndex: 500
      });
      mapRef.current.add(line);
      gridOverlaysRef.current.set(`lng_${lng}`, line);
    }

    logger.debug('✅ 网格线显示完成');
  }, []);

  // 隐藏网格
  const hideGridLines = useCallback(() => {
    if (!mapRef.current) return;

    gridOverlaysRef.current.forEach(overlay => {
      mapRef.current.remove(overlay);
    });
    gridOverlaysRef.current.clear();

    logger.debug('✅ 网格线隐藏完成');
  }, []);

  const queuePendingPixel = useCallback((lat: number, lng: number, color: string) => {
    if (!pendingTileLayerRef.current || !mapRef.current) return null;

    const zoom = Math.round(mapRef.current.getZoom?.() ?? 15);
    const tileCoord = TileUtils.latLngToTile(lat, lng, zoom);
    const tileId = TileUtils.getTileId(tileCoord.x, tileCoord.y, tileCoord.z);

    const pending: PendingPixel = {
      id: `${tileId}:${lat.toFixed(6)}:${lng.toFixed(6)}:${Date.now()}`,
      tileId,
      lat,
      lng,
      color,
      createdAt: Date.now()
    };

    pendingTileLayerRef.current.addPendingPixel(pending);
    pendingPixelsRef.current.set(pending.id, pending);
    const tileSet = pendingPixelsByTileRef.current.get(tileId);
    if (tileSet) {
      tileSet.add(pending.id);
    } else {
      pendingPixelsByTileRef.current.set(tileId, new Set([pending.id]));
    }

    return { pending, tileId };
  }, []);

  const clearPendingByTile = useCallback((tileId: string) => {
    pendingTileLayerRef.current?.removeByTile(tileId);
    const ids = pendingPixelsByTileRef.current.get(tileId);
    if (ids) {
      ids.forEach(id => {
        pendingPixelsRef.current.delete(id);
      });
      pendingPixelsByTileRef.current.delete(tileId);
    }
  }, []);

  const clearPendingById = useCallback((pendingId: string, tileId?: string) => {
    const pending = pendingPixelsRef.current.get(pendingId);
    if (!pending) return;

    const resolvedTile = tileId ?? pending.tileId;
    pendingPixelsRef.current.delete(pendingId);

    const ids = pendingPixelsByTileRef.current.get(resolvedTile);
    if (ids) {
      ids.delete(pendingId);
      if (ids.size === 0) {
        pendingPixelsByTileRef.current.delete(resolvedTile);
      }
    }

    pendingTileLayerRef.current?.removeById(pendingId);
  }, []);

  // 🍾 漂流瓶相关功能函数

  // 🔥 优化版：加载附近漂流瓶（带并发控制）
  const loadNearbyBottles = useCallback(async () => {
    // 防止重复加载
    if (loadingStateRef.current.bottles) {
      logger.debug('🍾 漂流瓶正在加载中，跳过重复请求');
      return;
    }

    if (!currentLocation) return;

    loadingStateRef.current.bottles = true;

    try {
      const startTime = performance.now();

      const result = await driftBottleService.getNearbyBottles(
        currentLocation.lat,
        currentLocation.lng,
        50 // 50公里范围
      );

      if (result.success && result.data) {
        setNearbyBottles(result.data.bottles);
        updateBottleMarkers(result.data.bottles);

        const loadTime = performance.now() - startTime;
        logger.debug(`🍾 加载完成: ${result.data.bottles.length}个, 耗时: ${loadTime.toFixed(2)}ms`);
      }
    } catch (error) {
      logger.error('加载附近漂流瓶失败:', error);
    } finally {
      loadingStateRef.current.bottles = false;
    }
  }, [currentLocation]);

  // 🍾 通用漂流瓶加载函数（可接受任意位置）
  const loadNearbyBottlesAt = useCallback(async (location: { lat: number; lng: number }) => {
    try {
      const result = await driftBottleService.getNearbyBottles(
        location.lat,
        location.lng,
        50 // 50公里范围
      );

      if (result.success && result.data) {
        setNearbyBottles(result.data.bottles);
        updateBottleMarkers(result.data.bottles);
        logger.info(`🍾 加载到 ${result.data.bottles.length} 个附近漂流瓶 (${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`);
      }
    } catch (error: any) {
      // 检查是否是认证错误，减少认证失败的日志噪音
      if (error.message?.includes('请先登录') || error.message?.includes('认证失败')) {
        logger.debug('🍾 用户未登录，跳过加载附近漂流瓶');
      } else {
        logger.error('加载附近漂流瓶失败:', error);
      }
    }
  }, []);

  // 更新地图上的漂流瓶标记
  const updateBottleMarkers = useCallback((bottles: DriftBottle[]) => {
    if (!mapRef.current || !(window as any).AMap) return;

    const AMap = (window as any).AMap;

    // 清除现有标记
    bottleMarkersRef.current.forEach((marker, bottleId) => {
      mapRef.current.remove(marker);
    });
    bottleMarkersRef.current.clear();

    // 🔧 修复：检查缩放级别，与像素格子渲染逻辑保持一致（12-20级）
    const zoom = mapRef.current.getZoom();
    if (zoom < 8 || zoom > 20) {
      logger.debug(`🍾 当前缩放级别 ${zoom.toFixed(2)} 不在显示范围（8-20），跳过漂流瓶标记渲染`);
      return;
    }

    logger.debug(`🍾 更新地图漂流瓶标记: ${bottles.length} 个`);

    // 创建新标记
    bottles.forEach(bottle => {
      // 创建漂流瓶HTML标记（使用HTML而不是SVG，确保渲染）
      const content = `
        <div style="
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          <div style="
            position: absolute;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3B82F6, #60A5FA);
            border-radius: 50%;
            border: 3px solid white;
            animation: pulse 2s infinite;
          "></div>
          <div style="
            position: relative;
            font-size: 24px;
            z-index: 2;
            animation: float 3s ease-in-out infinite;
          ">🍾</div>
          <div style="
            position: absolute;
            top: 0;
            right: 0;
            width: 16px;
            height: 16px;
            background: #EF4444;
            border-radius: 50%;
            border: 2px solid white;
            font-size: 10px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
          ">!</div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-5px); }
          }
        </style>
      `;

      const marker = new AMap.Marker({
        position: [bottle.current_lng, bottle.current_lat],
        map: mapRef.current,
        content: content,
        offset: new AMap.Pixel(-24, -24),
        zIndex: 200, // 🔥 优化：使用标准z-index规范，漂流瓶标记
        title: `漂流瓶 ${bottle.bottle_id}`,
        extData: { bottleId: bottle.bottle_id, bottle }
      });

      // 添加事件监听
      marker.on('click', (e: any) => {
        const clickedBottle = e.target.getExtData().bottle;
        handleBottleClick(clickedBottle);

        // 显示点击信息窗口
        const clientX = e.originalEvent?.clientX || e.clientX || 0;
        const clientY = e.originalEvent?.clientY || e.clientY || 0;
        setClickInfo({
          type: 'drift-bottle',
          item: clickedBottle,
          position: { x: clientX, y: clientY }
        });
      });

      marker.on('mouseover', (e: any) => {
        const bottle = e.target.getExtData().bottle;

        // 显示悬停信息窗口
        const clientX = e.originalEvent?.clientX || e.clientX || 0;
        const clientY = e.originalEvent?.clientY || e.clientY || 0;
        setHoverInfo({
          type: 'drift-bottle',
          item: bottle,
          position: { x: clientX + 10, y: clientY - 10 }
        });
      });

      marker.on('mouseout', () => {
        // 隐藏悬停信息窗口
        setHoverInfo(null);
      });

      bottleMarkersRef.current.set(bottle.bottle_id, marker);
      logger.debug(`🍾 已添加漂流瓶标记: ${bottle.bottle_id} at (${bottle.current_lat}, ${bottle.current_lng})`);
    });
  }, []);

  // 处理漂流瓶点击
  const handleBottleClick = useCallback((bottle: DriftBottle) => {
    setSelectedBottle(bottle);
    setShowBottleModal(true);
    logger.debug(`🍾 点击漂流瓶: ${bottle.bottle_id}`);
  }, []);

  // 检查当前位置是否有漂流瓶并自动拾取（用于GPS绘制）
  const checkAndPickupBottleAtLocation = useCallback(async (lat: number, lng: number): Promise<boolean> => {
    if (!externalGpsEnabled) return false;

    try {
      // 检查同一格子内是否有漂流瓶（使用非常小的范围，约等于一个格子）
      const gridSize = 0.0001; // 约10米，接近一个格子的大小
      const nearbyBottles = await driftBottleService.getNearbyBottles(lat, lng, gridSize);

      if (nearbyBottles.success && nearbyBottles.data && nearbyBottles.data.bottles.length > 0) {
        const nearestBottle = nearbyBottles.data.bottles[0];

        // 计算距离
        const distance = calculateBottleDistance(lat, lng, nearestBottle.current_lat, nearestBottle.current_lng);

        // 如果在同一格子内（距离很近），自动拾取
        if (distance <= 15) { // 15米内视为同一格子
          logger.info(`🎉 GPS路过时发现漂流瓶! 距离: ${distance}米, 瓶号: ${nearestBottle.bottle_id}`);

          // 先显示发现动画
          setFoundBottleInfo(nearestBottle);
          setShowBottleFoundAnimation(true);

          // 显示发现提示
          toast.success(`🍾 发现漂流瓶！正在拾取...`, {
            duration: 2000,
            position: 'top-center'
          });

          // 延迟500ms后自动拾取（让用户看到发现动画）
          setTimeout(async () => {
            try {
              const pickupResult = await driftBottleService.pickupBottle(
                nearestBottle.bottle_id,
                lat,
                lng
              );

              if (pickupResult.success) {
                // 拾取成功的动画和提示
                toast.success(`🎉 成功拾取漂流瓶！\n瓶号: ${nearestBottle.bottle_id}\n已添加到背囊`, {
                  duration: 3000,
                  position: 'top-center',
                  style: {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    padding: '16px',
                    borderRadius: '12px'
                  }
                });

                // 从地图上移除标记
                const marker = bottleMarkersRef.current.get(nearestBottle.bottle_id);
                if (marker && mapRef.current) {
                  mapRef.current.remove(marker);
                  bottleMarkersRef.current.delete(nearestBottle.bottle_id);
                }

                // 从附近瓶子列表中移除
                setNearbyBottles(prev => prev.filter(b => b.bottle_id !== nearestBottle.bottle_id));

                logger.info(`✅ 成功自动拾取漂流瓶: ${nearestBottle.bottle_id}`);

                // 延迟隐藏动画
                setTimeout(() => {
                  setShowBottleFoundAnimation(false);
                  setFoundBottleInfo(null);
                }, 1500);
              } else {
                toast.error(`拾取失败: ${pickupResult.message}`);
                setTimeout(() => {
                  setShowBottleFoundAnimation(false);
                  setFoundBottleInfo(null);
                }, 1000);
              }
            } catch (error) {
              logger.error('自动拾取漂流瓶失败:', error);
              toast.error('拾取漂流瓶失败');
              setTimeout(() => {
                setShowBottleFoundAnimation(false);
                setFoundBottleInfo(null);
              }, 1000);
            }
          }, 500);

          return true;
        }
      }
    } catch (error) {
      logger.error('检查位置漂流瓶失败:', error);
    }

    return false;
  }, [externalGpsEnabled]);

  // 拾取漂流瓶
  const handlePickupBottle = useCallback(async (bottle: DriftBottle) => {
    if (!currentLocation) return;

    setIsPickingUpBottle(true);
    try {
      const result = await driftBottleService.pickupBottle(
        bottle.bottle_id,
        currentLocation.lat,
        currentLocation.lng
      );

      if (result.success) {
        toast.success(`🎉 成功捡起漂流瓶！\n瓶号: ${bottle.bottle_id}`);
        setShowBottleModal(false);
        setSelectedBottle(null);

        // 从列表中移除
        setNearbyBottles(prev => prev.filter(b => b.bottle_id !== bottle.bottle_id));

        // 清除地图标记
        const marker = bottleMarkersRef.current.get(bottle.bottle_id);
        if (marker && mapRef.current) {
          mapRef.current.remove(marker);
          bottleMarkersRef.current.delete(bottle.bottle_id);
        }

        logger.info(`🍾 成功捡起漂流瓶: ${bottle.bottle_id}`);
      } else {
        toast.error(result.message || '捡起漂流瓶失败');
      }
    } catch (error) {
      logger.error('捡起漂流瓶失败:', error);
      toast.error('捡起漂流瓶失败');
    } finally {
      setIsPickingUpBottle(false);
    }
  }, [currentLocation]);

  // 计算两点间距离（米）
  const calculateBottleDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // 更新地图上的QR宝藏标记
  const updateTreasureMarkers = useCallback((treasures: QRTreasure[]) => {
    if (!treasureLayerManagerRef.current) return;

    treasureLayerManagerRef.current.updateTreasures(treasures);
    logger.debug(`💎 更新地图QR宝藏标记: ${treasures.length} 个`);
  }, []);

  // 💎 QR宝藏相关函数
  // 🔥 优化版：加载附近QR宝藏（带并发控制）
  const loadNearbyTreasures = useCallback(async () => {
    // 防止重复加载
    if (loadingStateRef.current.treasures) {
      logger.debug('💎 宝藏正在加载中，跳过重复请求');
      return;
    }

    if (!currentLocation) return;

    loadingStateRef.current.treasures = true;

    try {
      const startTime = performance.now();

      const result = await QRTreasureMapService.getNearbyTreasures({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        radius: 50, // 50公里范围
        limit: 100,
        includeFound: false,
        treasureType: 'all'
      });

      if (result.success && result.data) {
        setNearbyTreasures(result.data.treasures);
        updateTreasureMarkers(result.data.treasures);

        const loadTime = performance.now() - startTime;
        logger.info(`💎 加载完成: ${result.data.treasures.length}个, 耗时: ${loadTime.toFixed(2)}ms`);
      }
    } catch (error) {
      logger.error('加载附近QR宝藏失败:', error);
    } finally {
      loadingStateRef.current.treasures = false;
    }
  }, [currentLocation]);

  // 💎 通用宝藏加载函数（可接受任意位置）
  const loadNearbyTreasuresAt = useCallback(async (location: { lat: number; lng: number }) => {
    try {
      const result = await QRTreasureMapService.getNearbyTreasures({
        lat: location.lat,
        lng: location.lng,
        radius: 50, // 🔧 修复：增加到50公里范围，确保能找到附近的宝藏
        limit: 100,
        includeFound: false,
        treasureType: 'all'
      });

      if (result.success && result.data) {
        setNearbyTreasures(result.data.treasures);
        updateTreasureMarkers(result.data.treasures);
        logger.info(`💎 加载到 ${result.data.treasures.length} 个附近QR宝藏 (${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`);
      }
    } catch (error: any) {
      // 检查是否是认证错误，减少认证失败的日志噪音
      if (error.message?.includes('请先登录') || error.message?.includes('认证失败')) {
        logger.debug('💎 用户未登录，跳过加载附近QR宝藏');
      } else {
        logger.error('加载附近QR宝藏失败:', error);
      }
    }
  }, []);

  // 🔥 清除所有标记（立即执行，无延迟）
  const clearAllMarkers = useCallback(() => {
    const startTime = performance.now();

    // 取消所有进行中的请求
    if (loadingStateRef.current.abortController) {
      loadingStateRef.current.abortController.abort();
      loadingStateRef.current.abortController = null;
    }

    // 重置加载状态
    loadingStateRef.current.bottles = false;
    loadingStateRef.current.treasures = false;

    // 清除标记
    updateBottleMarkers([]);
    updateTreasureMarkers([]);
    setNearbyBottles([]);
    setNearbyTreasures([]);

    const clearTime = performance.now() - startTime;
    logger.debug(`🧹 清除所有标记完成, 耗时: ${clearTime.toFixed(2)}ms`);
  }, []);

  // 处理QR宝藏点击
  const handleTreasureClick = useCallback((treasure: QRTreasure) => {
    setSelectedTreasure(treasure);
    setShowTreasureModal(true);
    logger.debug(`💎 点击QR宝藏: ${treasure.treasure_id} - ${treasure.title}`);
  }, []);

  // 处理首次藏宝位置点击
  const handleFirstHideClick = useCallback((treasure: QRTreasure) => {
    toast.success(`💎 移动宝藏"${treasure.title}"的首次藏宝位置`);

    // 获取宝藏轨迹
    if (treasure.treasure_type === 'mobile') {
      QRTreasureMapService.getMobileTreasureTrail(treasure.treasure_id)
        .then(result => {
          if (result.success && result.data) {
            logger.debug(`💎 获取宝藏轨迹成功: ${result.data.trail.length} 个位置点`);
          }
        })
        .catch(error => {
          logger.error('获取宝藏轨迹失败:', error);
        });
    }
  }, []);

  // 处理QR宝藏悬浮
  const handleTreasureHover = useCallback((treasure: QRTreasure | null) => {
    // 这里可以添加悬浮提示逻辑
    logger.debug(`💎 悬浮QR宝藏: ${treasure?.treasure_id || '离开'}`);
  }, []);

  // 暴露QR宝藏调试函数到全局作用域
  useEffect(() => {
    window.loadNearbyTreasuresAt = loadNearbyTreasuresAt;
    window.updateTreasureMarkers = updateTreasureMarkers;
    logger.debug('💎 QR宝藏调试函数已暴露到全局作用域');

    return () => {
      delete window.loadNearbyTreasuresAt;
      delete window.updateTreasureMarkers;
    };
  }, [loadNearbyTreasuresAt, updateTreasureMarkers]);

  // 初始化QR宝藏图层管理器
  const initializeTreasureLayerManager = useCallback(() => {
    if (!mapRef.current || !(window as any).AMap) return;

    const AMap = (window as any).AMap;

    treasureLayerManagerRef.current = new QRTreasureLayerManager(
      mapRef.current,
      AMap,
      {
        onClick: handleTreasureClick,
        onHover: handleTreasureHover,
        onFirstHideClick: handleFirstHideClick,
        enableClustering: true,
        showFirstHideLocations: true,
        treasureTypes: ['fixed', 'mobile'],
        enableInfoWindow: true,
        infoWindowContainer: document.body
      }
    );

    logger.info('💎 QR宝藏图层管理器已初始化');
  }, [handleTreasureClick, handleTreasureHover, handleFirstHideClick]);

  const setupTileLayer = useCallback(() => {
    if (!mapRef.current) return;

    if (!tileServiceRef.current) {
      tileServiceRef.current = new TileService();
    }

    if (!tileCacheRef.current) {
      tileCacheRef.current = new TileCache();
    }

    if (!tileLayerManagerRef.current && tileServiceRef.current && tileCacheRef.current) {
      tileLayerManagerRef.current = new TileLayerManager(mapRef.current, tileServiceRef.current, tileCacheRef.current, {
        format: 'png', // 🔧 修复：使用PNG格式，后端支持更好
        prefetchPadding: 2,
        minZoom: 8, // 🔧 修改：支持8-20级缩放范围
        maxZoom: 20, // 🔧 修改：支持20级最大缩放，提供更精细的像素级别
        onVisibleTilesChange: (tileIds) => {
          tileSocketManager.updateTileSubscription(tileIds);
        },
        onMetrics: (metrics) => {
          setTilePerformanceMetrics(metrics);
        }
      });
    }

    if (!pendingTileLayerRef.current) {
      pendingTileLayerRef.current = new PendingTileLayer(mapRef.current, { zIndex: 610 });
    }
  }, [setTilePerformanceMetrics]);

  const teardownTileLayer = useCallback(() => {
    if (tileLayerManagerRef.current) {
      tileLayerManagerRef.current.destroy();
      tileLayerManagerRef.current = null;
    }

    if (pendingTileLayerRef.current) {
      pendingTileLayerRef.current.destroy();
      pendingTileLayerRef.current = null;
    }

    tileSocketManager.updateTileSubscription([]);
    pendingPixelsRef.current.clear();
    pendingPixelsByTileRef.current.clear();
    setTilePerformanceMetrics(null);
  }, [setTilePerformanceMetrics]);

  // 显示自定义模态框
  const showCustomModal = useCallback((message: string, type: 'info' | 'warning' | 'error') => {
    setModalInfo({ message, type, isVisible: true });
  }, []);

  // 关闭模态框
  const closeModal = useCallback(() => {
    setModalInfo(prev => ({ ...prev, isVisible: false }));
  }, []);

  // 关闭像素信息卡片
  const closePixelInfoCard = useCallback(() => {
    setPixelInfoCard(prev => ({ ...prev, isVisible: false }));
  }, []);

  const derivePixelColorFromFlag = useCallback((flag: AllianceFlagInfo | null | undefined): string => {
    if (!flag) {
      return 'color_black';
    }

    if (flag.unicode_char && (flag.render_type === 'emoji' || flag.pattern_id?.startsWith('emoji_'))) {
      return flag.unicode_char;
    }

    if (flag.color) {
      return flag.color;
    }

    if (flag.pattern_id) {
      if (flag.pattern_id.startsWith('color_')) {
        return flag.pattern_id;
      }

      if (flag.pattern_id.startsWith('emoji_')) {
        return flag.pattern_id;
      }

      return 'custom_pattern';
    }

    return 'color_black';
  }, []);

  // 获取用户联盟旗帜
  const getUserAllianceFlag = useCallback(async (): Promise<AllianceFlagInfo> => {
    try {
      // 检查用户是否已登录
      const token = tokenManager.getToken();
      if (!token) {
        logger.debug('🎨 用户未登录，使用默认图案: color_black');
        const defaultFlag: AllianceFlagInfo = {
          pattern_id: 'color_black',
          anchor_x: 0,
          anchor_y: 0,
          rotation: 0,
          mirror: false
        };
        allianceFlagRef.current = defaultFlag;
        return defaultFlag;
      }

      const response = await AllianceAPI.getUserAllianceFlag();
      if (response.success && response.flag) {
        logger.debug('🎨 获取到用户联盟旗帜:', response.flag);
        const flag: AllianceFlagInfo = {
          pattern_id: response.flag.pattern_id,
          anchor_x: response.flag.anchor_x || 0,
          anchor_y: response.flag.anchor_y || 0,
          rotation: response.flag.rotation || 0,
          mirror: response.flag.mirror || false,
          unicode_char: response.flag.unicode_char,
          render_type: response.flag.render_type,
          payload: response.flag.payload,  // 添加payload，用于渲染complex图案
          encoding: response.flag.encoding  // 添加encoding
        };
        allianceFlagRef.current = flag;
        return flag;
      }

      // 🔧 修复：返回默认值而不是null
      logger.debug('🎨 使用默认图案: color_black');
      const fallbackFlag: AllianceFlagInfo = {
        pattern_id: 'color_black',
        anchor_x: 0,
        anchor_y: 0,
        rotation: 0,
        mirror: false
      };
      allianceFlagRef.current = fallbackFlag;
      return fallbackFlag;
    } catch (error) {
      logger.error('获取用户联盟旗帜失败:', error);

      // 🔧 修复：错误时也返回默认值
      logger.debug('🎨 错误时使用默认图案: color_black');
      const defaultFlag: AllianceFlagInfo = {
        pattern_id: 'color_black',
        anchor_x: 0,
        anchor_y: 0,
        rotation: 0,
        mirror: false
      };
      allianceFlagRef.current = defaultFlag;
      return defaultFlag;
    }
  }, []);

  // 获取用户像素颜色
  const getUserPixelColor = useCallback(async (flagOverride?: AllianceFlagInfo | null): Promise<string> => {
    try {
      const flag = flagOverride ?? allianceFlagRef.current ?? await getUserAllianceFlag();
      const resolvedColor = derivePixelColorFromFlag(flag);
      logger.debug('🎨 解析联盟旗帜颜色:', {
        pattern: flag?.pattern_id,
        renderType: flag?.render_type,
        color: resolvedColor
      });
      return resolvedColor;
    } catch (error) {
      logger.error('获取用户像素颜色失败:', error);
      return 'color_black'; // 🔧 修复：错误时也使用黑色
    }
  }, [derivePixelColorFromFlag, getUserAllianceFlag]);

  // 请求GPS权限 - 检查高德地图API，使用用户友好提示
  const requestGpsPermission = useCallback(() => {
    if (!(window as any).AMap || !(window as any).AMap.plugin) {
      const errorHandler = getMapErrorHandler();
      const userFriendlyMessage = errorHandler.handleNetworkError({ message: '高德地图API未加载' });
      setGpsError(userFriendlyMessage);
      return false;
    }
    return true;
  }, []);

  // 使用统一的网格对齐函数
  const snapToGridLocal = useCallback((lat: number, lng: number) => {
    return snapToGrid(lat, lng);
  }, []);

  // 加载已有像素数据
  const loadExistingPixels = useCallback(async (mapInstance: any) => {
    try {
      logger.debug('🔄 开始加载已有像素数据...');
      
      // 检查地图对象是否完全准备好
      if (!mapInstance) {
        logger.warn('⚠️ 地图对象为空，跳过像素加载');
        return;
      }

      // 检查地图方法是否可用
      if (typeof mapInstance.getCenter !== 'function') {
        logger.warn('⚠️ 地图getCenter方法不可用，跳过像素加载');
        return;
      }

      if (typeof mapInstance.getZoom !== 'function') {
        logger.warn('⚠️ 地图getZoom方法不可用，跳过像素加载');
        return;
      }

      // 获取地图中心点和缩放级别
      let center, zoom;
      try {
        center = mapInstance.getCenter();
        zoom = mapInstance.getZoom();
      } catch (error) {
        logger.warn('⚠️ 获取地图中心点或缩放级别失败，跳过像素加载:', error);
        return;
      }
      
      if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        logger.warn('⚠️ 地图中心点无效，跳过像素加载');
        return;
      }
      
      logger.debug(`🗺️ 地图中心: (${center.lat}, ${center.lng}), 缩放级别: ${zoom}`);
      
              // 检查缩放级别是否满足像素显示条件（12级以上）
      if (zoom < 12) {
        logger.warn(`⚠️ 缩放级别过低 (${zoom})，需要12级以上才显示像素，跳过像素加载`);
        return;
      }

      logger.debug(`✅ 缩放级别满足条件 (${zoom} >= 12)，开始加载像素`);

      // 🚀 重构：等待图层服务就绪，而不是直接跳过
      if (!layerServiceRef.current) {
        logger.warn('⚠️ 图层服务未初始化，等待初始化...');

        // 等待图层服务初始化（最多等待3秒）
        let waitCount = 0;
        const maxWait = 30; // 3秒

        while (!layerServiceRef.current && waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }

        if (!layerServiceRef.current) {
          logger.error('❌ 图层服务初始化等待超时，跳过像素加载');
          return;
        }

        logger.info('✅ 图层服务初始化等待完成');
      }

      // 再次检查图层服务是否完全就绪
      if (!layerServiceRef.current.isLayerReady()) {
        logger.warn('⚠️ 图层服务未完全就绪，等待...');
        await layerServiceRef.current.waitForReady();

        if (!layerServiceRef.current.isLayerReady()) {
          logger.error('❌ 图层服务就绪等待失败，跳过像素加载');
          return;
        }
      }
      
      // 手动触发一次像素更新
      logger.debug('🔄 触发图层服务更新...');
      
      // 方法1: 通过触发地图移动事件来加载像素
      if (typeof mapInstance.emit === 'function') {
        try {
          mapInstance.emit('moveend');
          logger.debug('✅ 地图moveend事件触发成功');
        } catch (error) {
          logger.warn('⚠️ 地图moveend事件触发失败:', error);
        }
      }
      
      // 方法2: 直接调用图层服务的更新方法
      setTimeout(async () => {
        try {
          if (layerServiceRef.current && typeof layerServiceRef.current.triggerUpdate === 'function') {
            await layerServiceRef.current.triggerUpdate();
            logger.debug('✅ 图层服务更新完成');
          } else {
            logger.warn('⚠️ 图层服务triggerUpdate方法不可用');
          }
        } catch (error) {
          logger.error('❌ 图层服务更新失败:', error);
        }
      }, 300);
      
      logger.debug('✅ 已有像素数据加载完成');
      
    } catch (error) {
      logger.error('❌ 加载已有像素数据失败:', error);
    }
  }, []);

  // 计算两点间距离
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // 检查移动是否有效
  const isValidMovement = useCallback((
    currentLat: number, 
    currentLng: number, 
    previousLat: number, 
    previousLng: number
  ): boolean => {
    const distance = calculateDistance(currentLat, currentLng, previousLat, previousLng);
    return distance >= 5; // 最小移动距离5米
  }, [calculateDistance]);

  // 检查位置是否重叠
  const isPositionOverlapped = useCallback((
    currentLat: number, 
    currentLng: number, 
    previousLat: number, 
    previousLng: number
  ): boolean => {
    const distance = calculateDistance(currentLat, currentLng, previousLat, previousLng);
    return distance < 11; // 11米重叠检测
  }, [calculateDistance]);

  // GPS监听器引用
  const gpsWatchIdRef = useRef<number | null>(null);
  
  // 🔧 新增：GPS状态引用，用于在回调中获取最新状态
  const gpsEnabledRef = useRef(externalGpsEnabled);
  // 跟踪GPS移动是否正在进行中
  const gpsMoveInProgressRef = useRef(false);
  
  // 🎯 新增：GPS定位图标和精度圆圈引用
  const gpsMarkerRef = useRef<any>(null);
  const gpsCircleRef = useRef<any>(null);
  const lastDrawnPositionRef = useRef<{lat: number, lng: number} | null>(null);
  const lastDrawnGridIdRef = useRef<string | null>(null);
  
  // 更新GPS状态引用
  useEffect(() => {
    gpsEnabledRef.current = externalGpsEnabled;
  }, [externalGpsEnabled]);

  // 🔧 GPS定位功能已移除，避免干扰像素显示
  const createGpsMarker = useCallback(() => {
    logger.debug('🚫 GPS定位功能已禁用，避免干扰WebGL像素渲染');
    return;
  }, []);

  // 🔧 GPS定位功能已移除，避免干扰像素显示
  const removeGpsMarker = useCallback(() => {
    if (gpsMarkerRef.current && mapRef.current) {
      mapRef.current.remove(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }

    if (gpsCircleRef.current && mapRef.current) {
      mapRef.current.remove(gpsCircleRef.current);
      gpsCircleRef.current = null;
    }

    logger.debug('🚫 GPS定位图标和精度圆圈已清理');
  }, []);

  // 🔧 GPS定位功能已移除，避免干扰像素显示
  const updateGpsMarker = useCallback((lat: number, lng: number, accuracy?: number) => {
    logger.debug(`🚫 GPS更新已禁用: ${lat.toFixed(6)}, ${lng.toFixed(6)}, 精度: ${accuracy}m`);
    return;
  }, []);

  // GPS绘制像素
  const drawGpsPixel = useCallback(async (lat: number, lng: number) => {
    logger.debug(`🎨 GPS绘制开始: (${lat}, ${lng})`);
    logger.debug(`🎨 GPS绘制状态检查:`, {
      isDrawingInProgress: isDrawingInProgressRef.current,
      gpsEnabled: externalGpsEnabled,
      isDrawingRef: isDrawingRef.current,
      userState: userStateRef.current
    });
    
    // 检查是否正在绘制中
    if (isDrawingInProgressRef.current) {
      logger.warn('⚠️ GPS绘制正在进行中，跳过重复绘制', {
        lat,
        lng,
        gridId: calculateGridId(lat, lng)
      });
      return false;
    }
    
    // 检查是否为游客模式
    const isGuest = AuthService.isGuest();
    if (isGuest) {
      logger.debug('🎨 游客模式无法进行GPS绘制，跳过绘制');
      return false;
    }
    
    // 🔧 修复：检查绘制权限状态，而不仅仅是GPS状态
    if (!isDrawingRef.current) {
      logger.debug('🎨 用户绘制权限未开启，跳过GPS绘制');
      return false;
    }
    
    if (!externalGpsEnabled) {
      logger.debug('🎨 GPS模式未启用，跳过GPS绘制');
      return false;
    }
    
    // 检查用户状态和像素点数
    if (userStateRef.current) {
      logger.debug(`🎨 用户状态检查:`, userStateRef.current);
      if (userStateRef.current.totalPixelPoints <= 0) {
        logger.debug('🎨 用户像素点数不足，跳过GPS绘制');
        return false;
      }
    } else {
      logger.debug('🎨 用户状态未加载，跳过GPS绘制');
      return false;
    }

    let pendingInfo: { pendingId: string; tileId: string } | null = null;
    let resolvedColor = '';

    try {
      // 设置绘制中状态
      isDrawingInProgressRef.current = true;

      const userFlag = await getUserAllianceFlag();
      resolvedColor = await getUserPixelColor(userFlag);

      // 网格对齐 - 使用统一的网格计算
      const { lat: snappedLat, lng: snappedLng, gridId } = snapToGridLocal(lat, lng);
      logger.debug(`🎨 GPS网格对齐: (${lat}, ${lng}) -> (${snappedLat}, ${snappedLng}) [${gridId}]`);

      const pixelData: any = {
        lat: snappedLat,
        lng: snappedLng,
        color: resolvedColor,
        patternId: userFlag?.pattern_id,
        anchorX: userFlag?.anchor_x || 0,
        anchorY: userFlag?.anchor_y || 0,
        rotation: userFlag?.rotation || 0,
        mirror: userFlag?.mirror || false
      };

      // 🆕 如果有当前会话ID，添加到请求数据中
      if (currentSessionId) {
        pixelData.sessionId = currentSessionId;
        logger.debug('🔗 GPS绘制时传递sessionId:', currentSessionId.slice(0, 8));
      }

      if (tileModeEnabled) {
        const queued = queuePendingPixel(snappedLat, snappedLng, resolvedColor);
        if (queued) {
          pendingInfo = { pendingId: queued.pending.id, tileId: queued.tileId };
        }
      }

      logger.debug('🔍 发送GPS绘制请求:', pixelData);
      const response = await pixelDrawService.drawPixelGps(pixelData);
      logger.debug('🔍 GPS绘制API响应:', response);

      if (response.success) {
        logger.debug('✅ GPS像素绘制成功:', response);
        
        // 使用图层服务绘制像素
        if (layerServiceRef.current && renderStrategy !== 'tile') {
          await layerServiceRef.current.addPixel({
            lat: snappedLat,
            lng: snappedLng,
            grid_id: gridId,
            color: resolvedColor,
            pattern_id: userFlag?.pattern_id,
            anchor_x: userFlag?.anchor_x || 0,
            anchor_y: userFlag?.anchor_y || 0,
            rotation: userFlag?.rotation || 0,
            mirror: userFlag?.mirror || false
          });
        }
        
        // GPS绘制成功后立即同步用户状态
        if (manualConsumePixel) {
          logger.debug('🔄 GPS绘制成功，触发状态同步');
          manualConsumePixel();
        }

        // 记录绘制数据到sessionDataManager
        try {
          const currentSession = sessionDataManager.getCurrentSession();
          if (currentSession && currentSession.isActive) {
            sessionDataManager.recordDraw(gridId, snappedLat, snappedLng, resolvedColor);
            logger.debug('📝 已记录绘制到session:', { gridId, lat: snappedLat, lng: snappedLng });
          } else {
            logger.debug('⚠️ 没有活跃session，跳过绘制记录');
          }
        } catch (error) {
          logger.error('❌ 记录绘制到session失败:', error);
        }
        
        // 更新本地像素状态 - 确保前端状态与后端数据同步
        const newPixel = {
          id: response.data?.pixel?.id || Date.now().toString(),
          grid_id: gridId,
          lat: snappedLat,
          lng: snappedLng,
          color: resolvedColor,
          pattern_id: userFlag?.pattern_id,
          anchor_x: userFlag?.anchor_x || 0,
          anchor_y: userFlag?.anchor_y || 0,
          rotation: userFlag?.rotation || 0,
          mirror: userFlag?.mirror || false,
          user_id: response.data?.pixel?.user_id || 'current_user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // 通知父组件更新像素状态
        if (onPixelUpdate) {
          onPixelUpdate(newPixel);
        }
        
        logger.debug(`✅ GPS像素状态已更新:`, newPixel);

        // 🍾 GPS绘制成功后，检测并自动拾取格子内的漂流瓶
        try {
          const foundBottle = await checkAndPickupBottleAtLocation(snappedLat, snappedLng);
          if (foundBottle) {
            logger.info(`🎉 GPS绘制成功，并发现漂流瓶！`);
          }
        } catch (error) {
          logger.error('检查漂流瓶时出错:', error);
        }

        // 🗺️ 通知GPS模拟器绘制成功
        if (import.meta.env.DEV && (window as any).gpsSimulator) {
        gpsSimulator.notifyDrawResult(true, {
          latitude: lat,
          longitude: lng,
          accuracy: 5,
          timestamp: Date.now()
          });
        }

        return true;
      } else {
        logger.error('❌ GPS像素绘制失败:', response.error || '绘制失败');
        logger.error('❌ 失败详情:', {
          error: response.error,
          pixelData,
          userState: userStateRef.current
        });

        if (pendingInfo) {
          clearPendingById(pendingInfo.pendingId, pendingInfo.tileId);
        }

        // 🗺️ 通知GPS模拟器绘制失败
        if (import.meta.env.DEV && (window as any).gpsSimulator) {
          gpsSimulator.notifyDrawResult(false, {
            latitude: lat,
            longitude: lng,
            accuracy: 5,
            timestamp: Date.now()
          }, response.error || '绘制失败');
        }
        
        return false;
      }
    } catch (error) {
      logger.error('❌ GPS绘制像素失败:', error);
      logger.error('❌ 异常详情:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        pixelData: {
          lat: lat,
          lng: lng,
          color: resolvedColor
        },
        userState: userStateRef.current
      });

      if (pendingInfo) {
        clearPendingById(pendingInfo.pendingId, pendingInfo.tileId);
      }
      
      // 🗺️ 通知GPS模拟器绘制异常
      if (import.meta.env.DEV && (window as any).gpsSimulator) {
        gpsSimulator.notifyDrawResult(false, {
          latitude: lat,
          longitude: lng,
          accuracy: 5,
          timestamp: Date.now()
        }, error instanceof Error ? error.message : '绘制异常');
      }
      
      return false;
    } finally {
      // 清除绘制中状态
      isDrawingInProgressRef.current = false;
    }
  }, [
    externalGpsEnabled,
    getUserAllianceFlag,
    getUserPixelColor,
    snapToGridLocal,
    onPixelUpdate,
    manualConsumePixel,
    tileModeEnabled,
    queuePendingPixel,
    clearPendingById,
    renderStrategy
  ]);

  // 🎯 增强GPS服务：处理位置更新
  const handleEnhancedGpsPositionUpdate = useCallback((position: EnhancedGPSPosition) => {
    logger.debug(`📍 增强GPS位置更新: (${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}) 精度:${position.accuracy.toFixed(1)}m 置信度:${position.confidence.toFixed(2)}`);

    // 更新GPS状态
    setCurrentLocation({ lat: position.latitude, lng: position.longitude, accuracy: position.accuracy });
    setGpsAccuracy(position.accuracy);
    setGpsStatus('tracking');
    setGpsError(null);

    // 更新GPS定位图标
    updateGpsMarker(position.latitude, position.longitude, position.accuracy);

    // 🔧 修复：地图自动跟随GPS位置（包括模拟器模式）
    if (externalGpsEnabled && mapRef.current && mapMoveManagerRef.current) {
      try {
        mapMoveManagerRef.current.moveTo(
          Number(position.longitude),
          Number(position.latitude),
          {
            zoom: 16,
            animate: true,
            duration: 1000
          }
        );
      } catch (error) {
        logger.error('❌ GPS地图移动失败:', error);
      }
    }

    // 🍾 每次位置更新时加载附近漂流瓶和QR宝藏
    loadNearbyBottles();
    loadNearbyTreasures();
  }, [updateGpsMarker, externalGpsEnabled, loadNearbyBottles, loadNearbyTreasures]);

  // 🎯 增强GPS服务：处理绘制请求
  const handleEnhancedGpsDrawRequest = useCallback(async (result: GPSDrawResult) => {
    logger.debug(`🎨 增强GPS绘制请求: 网格${result.gridId} 位置(${result.position.latitude.toFixed(6)}, ${result.position.longitude.toFixed(6)})`);

    try {
      // 执行像素绘制（漂流瓶检测和拾取已集成在drawGpsPixel中）
      const success = await drawGpsPixel(result.position.latitude, result.position.longitude);

      // 通知GPS服务绘制结果
      enhancedGpsService.markDrawResult(result.gridId, success);

      if (success) {
        logger.debug(`✅ 增强GPS像素绘制成功: 网格${result.gridId}`);
      } else {
        logger.error(`❌ 增强GPS像素绘制失败: 网格${result.gridId}`, {
          position: result.position,
          reason: result.reason,
          error: result.error
        });
      }
    } catch (error) {
      logger.error(`❌ 增强GPS绘制异常: 网格${result.gridId}`, error);
      enhancedGpsService.markDrawResult(result.gridId, false);
    }
  }, [drawGpsPixel, loadNearbyBottles]);

  // 🎯 开始GPS跟踪 - 使用增强GPS服务
  const startGpsTracking = useCallback(async () => {
    // 🔧 修复：确保地图已加载完成再启动GPS跟踪
    if (!isMapLoaded) {
      logger.debug('⏳ 等待地图加载完成后再启动GPS跟踪...');
      setTimeout(() => {
        if (isMapLoaded) {
          startGpsTracking();
        } else {
          logger.warn('⚠️ 地图加载超时，无法启动GPS跟踪');
          setGpsStatus('error');
          setGpsError('地图加载超时');
        }
      }, 2000);
      return;
    }

    logger.debug('🎯 启动增强GPS服务...');

    try {
      // 创建GPS定位图标
      createGpsMarker();

      // 先移除旧的回调，防止重复注册
      enhancedGpsService.removePositionCallback(handleEnhancedGpsPositionUpdate);
      enhancedGpsService.removeDrawCallback(handleEnhancedGpsDrawRequest);

      // 注册增强GPS服务的回调
      enhancedGpsService.onPositionUpdate(handleEnhancedGpsPositionUpdate);
      enhancedGpsService.onDrawRequest(handleEnhancedGpsDrawRequest);

      // 启动增强GPS跟踪
      const success = await enhancedGpsService.startTracking();

      if (success) {
        setGpsStatus('tracking');
        setGpsError(null);
        logger.debug('✅ 增强GPS服务启动成功');
      } else {
        setGpsStatus('error');
        setGpsError('GPS定位启动失败');
        logger.error('❌ 增强GPS服务启动失败');
      }
    } catch (error) {
      logger.error('❌ GPS跟踪启动失败:', error);
      setGpsStatus('error');
      setGpsError('GPS跟踪启动失败');
    }
  }, [isMapLoaded, createGpsMarker, handleEnhancedGpsPositionUpdate, handleEnhancedGpsDrawRequest]);

  // 🎯 停止GPS跟踪 - 使用增强GPS服务
  const stopGpsTracking = useCallback(() => {
    logger.debug('🛑 停止增强GPS服务...');

    try {
      // 移除注册的回调
      enhancedGpsService.removePositionCallback(handleEnhancedGpsPositionUpdate);
      enhancedGpsService.removeDrawCallback(handleEnhancedGpsDrawRequest);

      // 停止增强GPS跟踪
      enhancedGpsService.stopTracking();

      // 移除GPS定位图标和精度圆圈
      removeGpsMarker();

      // 重置状态
      lastDrawnPositionRef.current = null;
      lastDrawnGridIdRef.current = null;
      setGpsStatus('idle');
      setGpsError(null);

      logger.debug('✅ 增强GPS服务已停止');
    } catch (error) {
      logger.error('❌ 停止GPS跟踪失败:', error);
    }
  }, [removeGpsMarker, handleEnhancedGpsPositionUpdate, handleEnhancedGpsDrawRequest]);

  // GPS模式切换现在由外部状态管理（externalGpsEnabled）

  // 初始化用户
  const initializeUser = useCallback(async () => {
    try {
      const userStatus = await UserService.getUserStatus();
      setUserState(userStatus.state);
      userStateRef.current = userStatus.state;
      logger.debug('✅ 用户状态初始化完成');
    } catch (error) {
      logger.error('❌ 用户状态初始化失败:', error);
    }
  }, []);

  // 🔧 优化：处理地图移动完成后的逻辑
  const handleMapMoveEnd = useCallback(() => {
    logger.debug('🗺️ 地图移动完成事件触发');

    // 🔍 加载附近的QR宝藏和漂流瓶（无论GPS是否开启）
    if (mapRef.current && isMapLoaded) {
      const center = mapRef.current.getCenter();
      const currentLocation = {
        lat: center.getLat(),
        lng: center.getLng()
      };

      logger.debug(`🗺️ 地图移动完成，加载附近内容: 中心坐标 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);

      // 延迟加载宝藏和漂流瓶，确保地图状态稳定
      setTimeout(() => {
        loadNearbyTreasuresAt(currentLocation);
        loadNearbyBottlesAt(currentLocation);
      }, 300);
    }

    // 只有当GPS模式开启时才执行图层优化
    if (externalGpsEnabled) {
      logger.debug('🗺️ GPS模式下地图移动完成，执行图层服务智能优化...');

      // 延迟执行图层服务优化，确保地图状态完全稳定
      setTimeout(() => {
        if (layerServiceRef.current && typeof layerServiceRef.current.executeSmartOptimization === 'function') {
          try {
            // 🔧 修复：在调用智能优化前检查地图状态
            if (mapRef.current && isMapLoaded) {
              layerServiceRef.current.executeSmartOptimization();
              logger.debug('✅ 图层服务智能优化执行完成');
            } else {
              logger.debug('⏳ 地图未完全加载，跳过智能优化');
            }
          } catch (error) {
            logger.warn('⚠️ 图层服务智能优化执行失败:', error);
          }
        }
      }, 500); // 延迟500ms确保地图状态稳定
    }
  }, [externalGpsEnabled, isMapLoaded, loadNearbyTreasuresAt, loadNearbyBottlesAt]);

  // 在地图上绘制像素
  const drawPixelOnMap = useCallback(async (lat: number, lng: number, pixelData: any, gridId: string) => {
    if (!mapRef.current || !(window as any).AMap) {
      logger.error('地图未初始化，无法绘制像素');
      return;
    }

    try {
      const AMap = (window as any).AMap;
      
      // ✅ 使用网格对齐后的坐标，确保像素严格对齐到网格
      const { lat: snappedLat, lng: snappedLng, gridId: actualGridId } = snapToGridLocal(lat, lng);
      
      // ✅ 使用精确的像素大小，与网格大小完全一致
      const pixelSize = GRID_CONFIG_UTILS.GRID_SIZE; // 0.0001度
      
      // ✅ 确保像素完全落在网格内，避免重叠
      const bounds = new AMap.Bounds(
        [snappedLng - pixelSize/2, snappedLat - pixelSize/2],
        [snappedLng + pixelSize/2, snappedLat + pixelSize/2]
      );

      // 验证网格ID一致性
      if (actualGridId !== gridId) {
        logger.warn(`🎨 网格ID不匹配: 期望 ${gridId}, 实际 ${actualGridId}`);
      }

      const rectangle = new AMap.Rectangle({
        bounds: bounds,
        fillColor: pixelData.color,
        fillOpacity: 1.0,
        strokeOpacity: 0,
        zIndex: 50 // 🔥 优化：使用标准z-index规范，调试矩形
      });

      mapRef.current.add(rectangle);
      
      const timestamp = Date.now();
      const versionId = `${actualGridId}_${timestamp}`;
      pixelsRef.current.set(versionId, rectangle);
      
      const newPixel: Pixel = {
        lat: snappedLat, // ✅ 使用对齐后的坐标
        lng: snappedLng, // ✅ 使用对齐后的坐标
        color: pixelData.color,
        owner: pixelData.owner,
        gridId: actualGridId, // ✅ 使用实际的网格ID
        timestamp: timestamp,
        version: timestamp
      };
      
      setPixels(prev => [...prev, newPixel]);
      logger.debug(`✅ 像素绘制成功: ${pixelData.color} at (${snappedLat}, ${snappedLng}) [${actualGridId}]`);
    } catch (error) {
      logger.error('绘制像素失败:', error);
    }
  }, []);

  // 检查API密钥
  const checkApiKey = useCallback(() => {
    if (!config.apiKey) {
      setMapError('高德地图API密钥未配置');
      return false;
    }
    return true;
  }, [config.apiKey]);

  // 地图初始化状态
  const [isMapInitializing, setIsMapInitializing] = useState(false);

  // 🚀 优化：智能定位函数 - 最快优先，单次定位
  const attemptSmartLocation = useCallback(async (map: any) => {
    if (!map || !(window as any).AMap) {
      logger.warn('⚡ 智能定位跳过：地图或AMap未就绪');
      return;
    }

    // 🔗 如果有分享链接目标位置或已处理分享链接，跳过定位，避免覆盖分享位置
    if (targetLocation || shareLinkProcessed) {
      logger.info('🔗 检测到分享链接或已处理，跳过定位，保持分享位置');
      return;
    }

    // 🔥 修复：优先使用缓存的最后位置
    try {
      const cachedLocation = localStorage.getItem('lastMapLocation');
      if (cachedLocation) {
        const { lat, lng, zoom, timestamp } = JSON.parse(cachedLocation);
        const cacheAge = Date.now() - timestamp;

        // 如果缓存小于1小时，使用缓存位置
        if (cacheAge < 60 * 60 * 1000) {
          logger.info(`📍 使用缓存位置: (${lat}, ${lng}), 缓存时间: ${Math.floor(cacheAge / 1000)}秒前`);

          // 🚀 性能优化：使用setZoomAndCenter一次性设置，减少事件触发
          map.setZoomAndCenter(zoom || 15, [lng, lat], false, 0);

          // 继续在后台尝试定位，更新缓存
          logger.info('🔄 后台更新定位...');
        }
      }
    } catch (error) {
      logger.warn('❌ 读取缓存位置失败:', error);
    }

    // 🚀 性能监控：定位开始
    performance.mark('location-start');
    logger.info('📍 开始异步定位服务（3秒超时保护）...');

    try {
      // 🚀 性能优化：使用预加载的模块，避免动态import延迟
      const locationPromise = locationModulePromise.then(({ testLocationServicesWithFallback }) =>
        testLocationServicesWithFallback()
      );

      // ⏰ 优化：缩短超时时间从5秒到3秒，提升响应速度
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('定位服务超时')), 3000)
      );

      const locationResult = await Promise.race([locationPromise, timeoutPromise]) as any;

      if (locationResult.finalResult.success && locationResult.finalResult.coordinates) {
        const { lat, lng } = locationResult.finalResult.coordinates;

        // 根据定位来源设置不同的缩放级别
        const targetZoom = (locationResult.finalResult.method === 'amap' ||
                           (locationResult.finalResult.accuracy && locationResult.finalResult.accuracy < 500))
                          ? 15  // 高德/GPS精确定位：15级
                          : 12; // IP定位：12级

        logger.info(`🎯 定位成功(${locationResult.finalResult.method})，设置${targetZoom}级缩放`);

        // 🚀 性能监控：定位完成
        performance.mark('location-end');
        performance.measure('location-total', 'location-start', 'location-end');

        const locationDuration = performance.getEntriesByName('location-total')[0]?.duration;
        logger.info(`⚡ 定位总耗时: ${locationDuration?.toFixed(0)}ms`);

        // 🚀 性能优化：使用地图移动管理器或setZoomAndCenter一次性设置
        if (mapMoveManagerRef.current) {
          await mapMoveManagerRef.current.moveTo(lng, lat, {
            zoom: targetZoom,
            animate: true,
            duration: 1000,
            callback: () => {
              logger.info(`✅ ${locationResult.recommendation}: (${lat}, ${lng})`);
            }
          });
        } else {
          // 如果移动管理器不可用，直接使用setZoomAndCenter
          map.setZoomAndCenter(targetZoom, [lng, lat], false, 0);
          logger.info(`✅ ${locationResult.recommendation}: (${lat}, ${lng})`);
        }

        // 🔥 修复：保存成功定位的位置到缓存
        try {
          localStorage.setItem('lastMapLocation', JSON.stringify({
            lat,
            lng,
            zoom: map.getZoom(),
            timestamp: Date.now()
          }));
          logger.info('💾 已保存定位位置到缓存');
        } catch (error) {
          logger.warn('❌ 保存缓存位置失败:', error);
        }
      } else {
        // 所有定位方式都失败，保持默认位置
        logger.warn('❌ 所有定位方式失败，保持默认位置（中国中心）');
      }
    } catch (error) {
      // 定位超时或其他异常，地图仍然正常显示
      if (error instanceof Error && error.message === '定位服务超时') {
        logger.warn('⏰ 定位服务超时，地图继续正常显示');
      } else {
        logger.error('❌ 定位服务异常，地图继续正常显示:', error instanceof Error ? error.message : error);
      }
      // 不抛出异常，确保地图正常使用
    }
  }, [targetLocation, shareLinkProcessed, config.apiKey]);

  
  // 🚀 等待图层服务完全就绪
  const waitForLayerServiceReady = useCallback(async (layerService: any): Promise<boolean> => {
    try {
      logger.info('⏳ 等待图层服务完全就绪...');

      // 调用图层服务的waitForReady方法
      const isReady = await layerService.waitForReady();

      if (isReady) {
        logger.info('✅ 图层服务已完全就绪，可以安全使用');
        return true;
      } else {
        logger.error('❌ 图层服务初始化超时');
        return false;
      }
    } catch (error) {
      logger.error('❌ 等待图层服务就绪时发生错误:', error);
      return false;
    }
  }, []);

  // 初始化地图
  const initMap = useCallback(async () => {
    // 🚀 性能监控：开始标记
    performance.mark('map-init-start');

    // 防止重复初始化
    if (isMapInitializing || mapRef.current) {
      logger.debug('🗺️ 地图已在初始化或已存在，跳过重复初始化');
      return;
    }

    // 检查API密钥
    if (!config.apiKey) {
      setMapError('高德地图API密钥未配置');
      return;
    }

    setIsMapInitializing(true);
    setMapError(null);

    try {
      logger.debug('🗺️ 开始初始化地图...');
      
      // 🚫 屏蔽高德SDK默认错误提示：使用超时控制的脚本加载机制
      if (!(window as any).AMap) {
        const errorHandler = getMapErrorHandler();

        // 显示自定义加载界面
        const showCustomLoading = () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = `
              <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <!-- 像素艺术风格Logo -->
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 32px; margin-bottom: 8px;">🎨</div>
                  <div style="color: #495057; font-size: 16px; font-weight: 600;">有趣的像素</div>
                </div>
                
                <!-- 像素艺术风格加载动画 -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 48px; height: 48px; margin-bottom: 16px;">
                  ${Array.from({ length: 9 }, (_, i) => {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const isActive = (row * 3 + col + Math.floor(Date.now() / 200)) % 9 < 4;
                    return `
                      <div style="
                        width: 12px; height: 12px; 
                        background-color: ${isActive ? '#007bff' : '#e3e3e3'}; 
                        border-radius: 2px; 
                        transition: all 0.2s ease;
                        transform: ${isActive ? 'scale(1.1)' : 'scale(1)'};
                        box-shadow: ${isActive ? '0 0 8px rgba(0,123,255,0.5)' : 'none'};
                      "></div>
                    `;
                  }).join('')}
                </div>
                
                <div style="color: #666; font-size: 14px; margin-bottom: 4px;">正在加载地图服务...</div>
                <div style="color: #999; font-size: 12px;">请稍候</div>
                
                <!-- 像素装饰元素 -->
                <div style="display: flex; gap: 4px; margin-top: 16px;">
                  ${[0, 1, 2].map(i => `
                    <div style="
                      width: 4px; height: 4px; 
                      background-color: #007bff; 
                      border-radius: 1px;
                      animation: pulse 1.5s ease-in-out infinite ${i * 0.2}s;
                    "></div>
                  `).join('')}
                </div>
                
                <style>
                  @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.2); }
                  }
                </style>
              </div>
            `;
          }
        };

        // 显示自定义错误界面
        const showCustomError = (userMessage: string) => {
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = `
              <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
                <div style="width: 60px; height: 60px; background: #fee; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 24px;">⚠️</span>
                </div>
                <div style="color: #333; font-size: 16px; font-weight: 500; margin-bottom: 8px;">地图服务暂时不可用</div>
                <div style="color: #666; font-size: 14px; text-align: center; margin-bottom: 20px;">${userMessage}</div>
                <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">重新加载</button>
              </div>
            `;
          }
        };

        showCustomLoading();

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          const timeoutId = setTimeout(() => {
            // 超时处理：移除脚本，显示自定义错误界面
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
            const timeoutMessage = '网络连接超时，请检查网络后重试';
            logger.warn('高德地图脚本加载超时:', timeoutMessage);
            showCustomError(timeoutMessage);
            removeAmapDefaultErrorUI(); // 移除高德默认错误面板
            reject(new Error(timeoutMessage));
          }, 10000); // 🚀 优化：缩短到10秒（预加载已经给了12秒机会）

          script.src = `https://webapi.amap.com/maps?v=${config.version}&key=${config.apiKey}&plugin=${config.plugins.join(',')}`;
          script.onload = () => {
            clearTimeout(timeoutId);
            logger.info('✅ 高德地图脚本加载成功');
            resolve();
          };
          script.onerror = (error) => {
            clearTimeout(timeoutId);
            // 移除脚本
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
            const userFriendlyMessage = errorHandler.handleScriptError();
            logger.error('❌ 高德地图脚本加载失败:', userFriendlyMessage);
            showCustomError(userFriendlyMessage);
            removeAmapDefaultErrorUI(); // 移除高德默认错误面板
            reject(new Error(userFriendlyMessage));
          };

          // 添加网络错误监听
          script.addEventListener('error', () => {
            clearTimeout(timeoutId);
            const networkMessage = '网络连接不稳定，地图功能暂时不可用';
            logger.error('❌ 高德地图脚本网络错误:', networkMessage);
            showCustomError(networkMessage);
            removeAmapDefaultErrorUI(); // 移除高德默认错误面板
            reject(new Error(networkMessage));
          });

          document.head.appendChild(script);
        });
      }

      const AMap = (window as any).AMap;

      // 检查容器是否存在
      if (!mapContainerRef.current) {
        throw new Error('地图容器不存在');
      }

      // 🚀 修复：立即创建地图，避免定位服务阻塞地图初始化
      logger.info('🗺️ 立即创建地图实例，定位将在后台异步进行...');

      // 🎯 使用中国中心作为默认位置，确保地图立即显示
      const defaultCenter = [113.29313, 23.12014]; // 惠州地区中心（广告数据所在区域）
      const defaultZoom = 16; // 适合查看广告像素的缩放级别

      logger.info('⚡ 使用默认位置创建地图:', defaultCenter);

      // 创建地图实例 - 立即创建，不让定位服务阻塞
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: defaultZoom, // 🎯 使用默认缩放级别，地图加载后会根据定位结果调整
        zooms: [3, 20], // 限制最大缩放至20，支持更精细的像素级别
        center: defaultCenter, // 🎯 使用默认中心，地图加载后会根据定位结果调整
        //将 mapStyle 替换为其他样式 ID，例如：
        //amap://styles/dark,
        //amap://styles/whitesmoke
        //amap://styles/blue
        //amap://styles/light
        //自定义样式（高德控制台生成）：amap://styles/你的样式ID
        mapStyle: 'amap://styles/normal',
        viewMode: '2D', // 明确指定2D模式
        renderMode: '2D', // 强制使用2D渲染模式，避免WebGL问题
        resizeEnable: true, // 启用自动适应容器尺寸变化
        dragEnable: true, // 启用拖拽
        zoomEnable: true, // 启用缩放
        doubleClickZoom: true, // 启用双击缩放
        keyboardEnable: false, // 禁用键盘操作
        jogEnable: true, // 启用缓动效果
        scrollWheel: true, // 启用滚轮缩放
        touchZoom: true, // 启用触摸缩放
        showIndoorMap: false, // 不显示室内地图
        showToolBar: false, // 禁用默认工具栏
        showZoomBar: false, // 禁用默认缩放条
        showScale: false // 禁用默认比例尺
      });

      mapRef.current = map;

      // 🚀 性能优化：异步初始化图层服务，不阻塞地图加载
      logger.info('⚡ 开始异步初始化图层服务...');
      try {
        const layerService = getAmapLayerService(map);
        layerServiceRef.current = layerService;
        layerService.updateMap(map);
        layerService.setPixelClickCallback(handlePixelClick);

        // 🔧 修复：暴露到全局window对象，供调试和诊断使用
        if (typeof window !== 'undefined') {
          window.AmapLayerService = AmapLayerService;
          window.getAmapLayerService = getAmapLayerService;
          window.destroyAmapLayerService = destroyAmapLayerService;
          window.amapLayerService = layerService; // 实例引用
          window.mapInstance = map; // 地图实例引用，供诊断工具使用
          window.amap = map; // 兼容性别名
        }

        logger.info('⚡ 图层服务实例创建完成');

        // 🚀 优化：在后台等待图层服务就绪，不阻塞地图初始化
        waitForLayerServiceReady(layerService).then(isLayerReady => {
          if (!isLayerReady) {
            logger.error('❌ 图层服务初始化失败');
          } else {
            logger.info('✅ 图层服务已完全就绪');
          }
        }).catch(error => {
          logger.error('❌ 图层服务初始化异常:', error);
        });
      } catch (error) {
        logger.error('❌ 图层服务初始化异常:', error);
        // 即使图层服务初始化失败，也继续地图初始化
      }

      // 不添加默认控件，避免与自定义工具栏重复
      // 所有控件都通过地图配置禁用，使用自定义工具栏替代

      // 🚀 重构：设置地图事件监听器（在图层服务就绪后）
      setupMapEventListeners(map);

      // 地图加载完成事件
      map.on('complete', () => {
        // 🚀 性能监控：地图加载完成
        performance.mark('map-init-end');
        performance.measure('map-init', 'map-init-start', 'map-init-end');

        const mapInitDuration = performance.getEntriesByName('map-init')[0]?.duration;
        logger.info(`⚡ 地图初始化耗时: ${mapInitDuration?.toFixed(0)}ms`);

        logger.debug('✅ 地图加载完成');
        setIsMapLoaded(true);
        setIsMapInitializing(false);
        onMapReady?.(map);

        // 🔍 加载初始QR宝藏和漂流瓶数据
        const center = map.getCenter();
        const initialLocation = {
          lat: center.getLat(),
          lng: center.getLng()
        };

        logger.debug(`🗺️ 地图加载完成，加载附近内容: 中心坐标 ${initialLocation.lat.toFixed(6)}, ${initialLocation.lng.toFixed(6)}`);

        // 🚀 性能优化：使用requestIdleCallback延迟加载次要功能
        const loadSecondaryContent = () => {
          loadNearbyTreasuresAt(initialLocation);
          loadNearbyBottlesAt(initialLocation);
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadSecondaryContent, { timeout: 2000 });
        } else {
          setTimeout(loadSecondaryContent, 500);
        }


        // 🚀 异步定位：地图创建完成后再尝试获取用户位置
        attemptSmartLocation(map);

        // 🚀 性能优化：使用requestIdleCallback优化WebGL渲染性能
        const optimizeWebGLPerformance = () => {
          try {
            const mapContainer = mapContainerRef.current;
            if (mapContainer) {
              // 查找WebGL Canvas元素
              const webglCanvas = document.getElementById('webgl-pixel-layer');
              if (webglCanvas) {
                // 设置WebGL Canvas属性以优化性能
                webglCanvas.setAttribute('data-optimized', 'true');
                logger.info('🎨 WebGL性能优化：WebGL Canvas已优化');
              }
            }
          } catch (error) {
            logger.warn('WebGL性能优化失败:', error);
          }
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(optimizeWebGLPerformance, { timeout: 2000 });
        } else {
          setTimeout(optimizeWebGLPerformance, 500);
        }

        // 初始化地图移动管理器
        try {
          mapMoveManagerRef.current = new MapMoveManager(map);
          logger.debug('✅ 地图移动管理器初始化完成');
        } catch (error) {
          logger.error('❌ 地图移动管理器初始化失败:', error);
        }

        // 🚀 优化：已在上文创建地图前完成定位，避免重复定位和跳转
        // 智能定位已完成，地图已直接定位到用户位置或默认位置
        logger.info('✅ 地图定位优化：已跳过二次定位，直接使用预定位位置');

        // 🚀 重构：图层服务已在上面初始化，这里只需要启用WebGL
        try {
          if (layerServiceRef.current) {
            // WebGL渲染系统启用
            layerServiceRef.current.onMapReady();
            logger.info('✅ WebGL渲染系统已启用（emoji会随zoom正确缩放）');
          }
        } catch (error) {
          logger.error('❌ WebGL渲染系统初始化失败:', error);
        }

        // 💎 初始化QR宝藏图层管理器
        try {
          initializeTreasureLayerManager();
          logger.info('💎 QR宝藏图层管理器初始化完成');
        } catch (error) {
          logger.error('❌ QR宝藏图层管理器初始化失败:', error);
        }

        // 🚀 性能优化：使用requestIdleCallback延迟初始化非核心服务
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => initNonCriticalServices(map), { timeout: 2000 });
        } else {
          setTimeout(() => initNonCriticalServices(map), 800);
        }
      });

      logger.debug('✅ 地图初始化完成');
    } catch (error) {
      logger.error('❌ 地图初始化失败:', error);
      setMapError(error instanceof Error ? error.message : '地图初始化失败');
      setIsMapInitializing(false);
    }
  }, [isMapInitializing, config.apiKey, onMapReady, attemptSmartLocation]);

  // 🚀 优化：非核心服务延迟初始化函数
  const initNonCriticalServices = useCallback((map: any) => {
    logger.info('⏳ 开始初始化非核心服务...');

    try {
      // 1. 初始化瓦片渲染系统
      try {
        tileServiceRef.current = new TileService();
        logger.debug('✅ 非核心服务 - 瓦片渲染系统初始化完成');
      } catch (error) {
        logger.warn('⚠️ 瓦片渲染系统初始化失败（不影响使用）:', error);
      }

      // 2. 🧠 初始化智能渲染模式管理器
      try {
        intelligentRenderManagerRef.current = new IntelligentRenderModeManager();

        // 🔧 修复emoji问题：在瓦片渲染后重新加载像素
        // 监听瓦片完成渲染事件，确保emoji不被覆盖
        if (tileServiceRef.current) {
          tileServiceRef.current.onTileRenderComplete = async () => {
            logger.debug('🔄 瓦片渲染完成，重新加载像素以保持emoji显示');
            // 延迟加载像素，确保瓦片完全渲染完成
            setTimeout(async () => {
              try {
                await loadExistingPixels(map);
              } catch (error) {
                logger.error('❌ 瓦片渲染后重新加载像素失败:', error);
              }
            }, 300);
          };
        }
        intelligentRenderManagerRef.current.startMonitoring();
        logger.debug('✅ 非核心服务 - 智能渲染模式管理器初始化完成');
      } catch (error) {
        logger.warn('⚠️ 智能渲染模式管理器初始化失败（不影响使用）:', error);
      }

      logger.info('⚡ 所有非核心服务初始化完成');
    } catch (error) {
      logger.warn('⚠️ 非核心服务初始化过程出现错误（不影响核心功能）:', error);
    }
  }, []);

  // 地图准备就绪事件 - 确保地图完全可用（这个函数定义在initMap函数内部调用）
  const setupMapEventListeners = useCallback((map: any) => {
    // 🚀 性能优化：合并所有moveend监听器，添加防抖优化
    let lastMoveEndTime = 0;
    let saveLocationTimer: NodeJS.Timeout | null = null;
    const MIN_MOVE_INTERVAL = 100; // 防抖间隔100ms

    const unifiedMoveEndHandler = () => {
      const now = Date.now();
      // 防抖：避免过于频繁的处理
      if (now - lastMoveEndTime < MIN_MOVE_INTERVAL) {
        logger.debug('🔄 moveend事件防抖跳过');
        return;
      }
      lastMoveEndTime = now;

      logger.debug('🗺️ 地图移动结束事件触发（统一处理器）');

      // 1️⃣ 检查是否是GPS移动完成
      if (gpsMoveInProgressRef.current) {
        logger.debug('🗺️ GPS移动完成，开始执行后续操作...');
        gpsMoveInProgressRef.current = false;

        try {
          const currentZoom = map.getZoom();
          logger.debug(`🗺️ 当前缩放级别: ${currentZoom}`);

          if (typeof currentZoom === 'number' && !isNaN(currentZoom) && currentZoom < 16) {
            map.setZoom(16);
            logger.debug(`🗺️ 调整缩放级别到: 16`);
          }

          if (layerServiceRef.current && typeof layerServiceRef.current.executeSmartOptimization === 'function') {
            setTimeout(() => {
              try {
                layerServiceRef.current.executeSmartOptimization();
                logger.debug('✅ 图层服务优化完成');
              } catch (error) {
                logger.warn('⚠️ 图层服务优化失败:', error);
              }
            }, 100);
          }

          logger.debug('✅ GPS移动后续操作完成');
        } catch (error) {
          logger.error('❌ GPS移动后续操作失败:', error);
        }
      }

      // 2️⃣ 执行handleMapMoveEnd逻辑
      handleMapMoveEnd();

      // 3️⃣ WebGL渲染更新（使用requestAnimationFrame优化）
      if (layerServiceRef.current) {
        requestAnimationFrame(() => {
          try {
            // ✅ 使用WebGL渲染系统更新
            if (layerServiceRef.current?.webglInitialized &&
                typeof layerServiceRef.current.updateVisiblePixels === 'function') {
              layerServiceRef.current.updateVisiblePixels();
              logger.debug('✅ WebGL渲染更新完成');
            }
          } catch (error) {
            logger.warn('⚠️ WebGL渲染更新失败:', error);
          }
        });
      }

      // 4️⃣ 保存位置到缓存（使用防抖，1秒后保存）
      if (saveLocationTimer) clearTimeout(saveLocationTimer);
      saveLocationTimer = setTimeout(() => {
        try {
          const center = map.getCenter();
          localStorage.setItem('lastMapLocation', JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: map.getZoom(),
            timestamp: Date.now()
          }));
          logger.debug('💾 已保存用户地图位置到缓存');
        } catch (error) {
          logger.warn('❌ 保存用户地图位置失败:', error);
        }
      }, 1000);
    };

    // 🎯 moveend监听器 - 处理移动结束后的逻辑
    map.on('moveend', unifiedMoveEndHandler);

    // 🔄 moving监听器 - 处理移动过程中的实时Canvas更新
    let lastMovingTime = 0;
    const MIN_MOVING_INTERVAL = 50; // 移动中更新的最小间隔50ms

    const movingHandler = () => {
      const now = Date.now();
      if (now - lastMovingTime < MIN_MOVING_INTERVAL) {
        return; // 防抖，避免过于频繁的更新
      }
      lastMovingTime = now;

      // 实时更新WebGL渲染，让像素跟随地图移动
      if (layerServiceRef.current) {
        try {
          // ✅ 移动中使用WebGL渲染更新，不等待requestAnimationFrame
          if (layerServiceRef.current?.webglInitialized &&
              typeof layerServiceRef.current.updateVisiblePixels === 'function') {
            layerServiceRef.current.updateVisiblePixels();
            logger.debug('✅ 移动中WebGL渲染更新完成');
          }
        } catch (error) {
          logger.warn('⚠️ 移动中WebGL渲染更新失败:', error);
        }
      }
    };

    map.on('moving', movingHandler);
    logger.info('✅ 地图moving事件监听器已添加，支持实时WebGL渲染更新');

    // 地图准备就绪事件 - 确保地图完全可用
    map.on('ready', () => {
    logger.debug('✅ 地图准备就绪，开始加载像素数据');

    // 延迟加载像素数据，确保地图完全稳定
    setTimeout(async () => {
      try {
        await loadExistingPixels(map);
      } catch (error) {
        logger.error('❌ 加载已有像素数据失败:', error);
      }
    }, 500);
  });

  // 🔧 修复emoji问题：监听地图瓦片渲染完成事件
  map.on('tilesloaded', () => {
    logger.debug('🔄 地图瓦片加载完成，重新加载像素以确保emoji显示');
    // 延迟重新加载像素，确保瓦片完全渲染完成
    setTimeout(async () => {
      try {
        await loadExistingPixels(map);
      } catch (error) {
        logger.error('❌ 瓦片加载后重新加载像素失败:', error);
      }
    }, 200);
  });

  // 地图缩放事件监听 - 检查缩放级别并控制像素显示
  map.on('zoomend', () => {
    const currentZoom = map.getZoom();
    logger.debug(`🗺️ 地图缩放结束，当前级别: ${currentZoom}`);
    
    // 🔧 添加调试输出：验证缩放计算
    if (layerServiceRef.current) {
      const testSize = layerServiceRef.current.getPixelSizeForDebug(0.0001);
      logger.info(`🧭 当前缩放: ${currentZoom}`);
      logger.info(`🧩 示例计算: 0.0001度 -> ${testSize}px`);
    }
    
    // 通知图层服务处理缩放变化，但不阻塞地图交互
    if (layerServiceRef.current) {
      setTimeout(() => {
        layerServiceRef.current.handleZoomChange(currentZoom);
      }, 100);
    }
    
    if (currentZoom >= 12) {
      logger.debug(`✅ 缩放级别满足条件 (${currentZoom} >= 12)，触发像素加载`);
      // 延迟触发像素加载，避免频繁更新
      setTimeout(async () => {
        try {
          await loadExistingPixels(map);
        } catch (error) {
          logger.error('❌ 缩放后加载像素数据失败:', error);
        }
      }, 300);
    } else {
      logger.debug(`⚠️ 缩放级别过低 (${currentZoom} < 12)，不显示像素`);
      // 可以在这里清除已显示的像素
      if (layerServiceRef.current) {
        logger.debug('🔄 清除当前显示的像素');
        // 这里可以调用图层服务的清除方法
      }
    }

    // 🔧 修复：在缩放时重新渲染漂流瓶和宝藏标记
    if (currentZoom >= 12 && currentZoom <= 20) {
      // 重新渲染漂流瓶标记
      if (nearbyBottles.length > 0) {
        updateBottleMarkers(nearbyBottles);
      }
      // 重新渲染宝藏标记
      if (nearbyTreasures.length > 0) {
        updateTreasureMarkers(nearbyTreasures);
      }
    } else {
      // 缩放级别不在范围内，清除标记
      bottleMarkersRef.current.forEach((marker) => {
        if (mapRef.current) mapRef.current.remove(marker);
      });
      bottleMarkersRef.current.clear();
    }
  });

  // 🔧 优化：缩放结束事件监听（合并WebGL渲染更新和缓存保存）
  let zoomSaveLocationTimer: NodeJS.Timeout | null = null;

  map.on('zoomend', () => {
    logger.debug('🔄 地图缩放结束，触发WebGL渲染更新');

    // WebGL渲染更新（使用requestAnimationFrame优化）
    if (layerServiceRef.current) {
      requestAnimationFrame(() => {
        try {
          // ✅ 使用WebGL渲染系统更新
          if (layerServiceRef.current?.webglInitialized &&
              typeof layerServiceRef.current.updateVisiblePixels === 'function') {
            layerServiceRef.current.updateVisiblePixels();
            logger.debug('✅ 缩放结束WebGL渲染更新完成');
          }
        } catch (error) {
          logger.warn('⚠️ 缩放结束WebGL渲染更新失败:', error);
        }
      });
    }

    // 保存位置到缓存（防抖）
    if (zoomSaveLocationTimer) clearTimeout(zoomSaveLocationTimer);
    zoomSaveLocationTimer = setTimeout(() => {
      try {
        const center = map.getCenter();
        localStorage.setItem('lastMapLocation', JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom(),
          timestamp: Date.now()
        }));
        logger.debug('💾 已保存用户地图位置到缓存（缩放）');
      } catch (error) {
        logger.warn('❌ 保存用户地图位置失败:', error);
      }
    }, 1000);
  });

    // 地图错误事件 - 使用统一错误封装机制
    map.on('error', (error: any) => {
      const errorHandler = getMapErrorHandler();

      // 记录原始错误用于调试
      logger.error('高德地图JS API错误:', error);

      // 先尝试移除高德默认面板
      try {
        removeAmapDefaultErrorUI();
      } catch (e) {
        logger.warn('移除高德默认错误UI失败:', e);
      }

      // 使用统一错误处理器
      const userFriendlyMessage = errorHandler.handleError(error, MapErrorType.UNKNOWN);

      // 设置用户友好的错误信息
      setMapError(userFriendlyMessage);
      setIsMapInitializing(false);

      logger.info('高德地图错误已转换为用户友好提示:', userFriendlyMessage);
    });
  }, []);

  // 检查地图状态
  const checkMapStatus = useCallback(() => {
    if (!mapRef.current) {
      return 'not_initialized';
    }
    
    try {
      // 检查地图是否有效
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      
      if (center && zoom !== undefined) {
        return 'ready';
      } else {
        return 'invalid';
      }
    } catch (error) {
      logger.warn('地图状态检查失败:', error);
      return 'error';
    }
  }, []);

  // 重新初始化地图
  const reinitializeMap = useCallback(() => {
    logger.debug('🔄 重新初始化地图...');
    
          // 清理现有地图
      if (mapRef.current) {
        try {
          // 移除所有事件监听器
          mapRef.current.off('zoomend');
          mapRef.current.off('moveend');
          mapRef.current.off('click');
          mapRef.current.off('complete');
          mapRef.current.off('ready');
          mapRef.current.off('error');
          // 销毁地图
          mapRef.current.destroy();
        } catch (error) {
          logger.warn('清理旧地图失败:', error);
        }
        mapRef.current = null;
      }
    
    // 重置状态
    setIsMapLoaded(false);
    setIsMapInitializing(false);
    setMapError(null);
    
    // 重新初始化
    setTimeout(() => {
      initMap();
    }, 100);
  }, [initMap]);

  // 🧠 智能渲染模式切换处理
  const handleIntelligentRenderModeChange = useCallback((newMode: 'normal' | 'tile' | 'hybrid') => {
    logger.debug(`🧠 智能渲染模式切换: ${currentRenderMode} -> ${newMode}`);
    setCurrentRenderMode(newMode);

    // 根据智能决策更新瓦片模式状态
    if (newMode === 'tile') {
      setRenderStrategy('tile');
      setTileModeEnabled(true);
      const cacheStats = tileCacheRef.current ? tileCacheRef.current.getMemoryUsage() : 0;
      setTilePerformanceMetrics({
        visibleTiles: 0,
        cachedTiles: cacheStats,
        averageLoadTime: 0,
        fps: 0,
        lastUpdatedAt: Date.now()
      });
    } else if (newMode === 'hybrid') {
      setRenderStrategy('hybrid');
      setTileModeEnabled(true);
    } else {
      setRenderStrategy('dom');
      setTileModeEnabled(false);
      setTilePerformanceMetrics(null);
    }
  }, [currentRenderMode]);

  // 获取瓦片性能指标
  const updateTilePerformanceMetrics = useCallback(() => {
    if (!tileModeEnabled) return;

    setTilePerformanceMetrics(prev => {
      if (!prev) return prev;
      const cachedTiles = tileCacheRef.current ? tileCacheRef.current.getMemoryUsage() : prev.cachedTiles;
      return {
        ...prev,
        cachedTiles,
        lastUpdatedAt: Date.now()
      };
    });
  }, [tileModeEnabled]);

  // 清理函数
  const cleanup = useCallback(() => {
    // 清理瓦片服务
    if (tileServiceRef.current) {
      tileServiceRef.current = null;
    }

    if (tileLayerManagerRef.current) {
      tileLayerManagerRef.current.destroy();
      tileLayerManagerRef.current = null;
    }

    if (pendingTileLayerRef.current) {
      pendingTileLayerRef.current.destroy();
      pendingTileLayerRef.current = null;
    }

    tileCacheRef.current = null;
    tileSocketManager.updateTileSubscription([]);

    // 🧠 清理智能渲染模式管理器
    if (intelligentRenderManagerRef.current) {
      intelligentRenderManagerRef.current.stopMonitoring();
      intelligentRenderManagerRef.current = null;
    }
    
    // 清理图层服务
    if (layerServiceRef.current) {
      destroyAmapLayerService();
      layerServiceRef.current = null;
    }

    // 💎 清理QR宝藏图层管理器
    if (treasureLayerManagerRef.current) {
      treasureLayerManagerRef.current.destroy();
      treasureLayerManagerRef.current = null;
    }

    // 清理地图移动管理器
    if (mapMoveManagerRef.current) {
      mapMoveManagerRef.current = null;
    }
  }, []);

  // 清理信息窗口
  useEffect(() => {
    return () => {
      setHoverInfo(null);
      setClickInfo(null);
    };
  }, []);

  // 清理效果
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    setTileModeEnabled(renderStrategy !== 'dom');
  }, [renderStrategy]);

  // 定期更新瓦片性能指标 - 优化：使用requestAnimationFrame代替setInterval
  useEffect(() => {
    if (!tileModeEnabled) return;

    let rafId: number | null = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 5000; // 5秒更新一次

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
        updateTilePerformanceMetrics();
        lastUpdateTime = timestamp;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [tileModeEnabled, updateTilePerformanceMetrics]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) {
      return;
    }

    if (tileModeEnabled) {
      setupTileLayer();
    } else {
      teardownTileLayer();
    }
  }, [isMapLoaded, tileModeEnabled, setupTileLayer, teardownTileLayer]);

  // 🧠 监听智能渲染模式变化 - 优化：使用requestAnimationFrame代替setInterval
  useEffect(() => {
    if (!intelligentRenderManagerRef.current) return;

    let rafId: number | null = null;
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 1000; // 每秒检查一次

    const checkRenderMode = (timestamp: number) => {
      if (timestamp - lastCheckTime >= CHECK_INTERVAL) {
        const currentMode = intelligentRenderManagerRef.current?.getCurrentMode();
        if (currentMode && currentMode !== currentRenderMode) {
          handleIntelligentRenderModeChange(currentMode);
        }
        lastCheckTime = timestamp;
      }
      rafId = requestAnimationFrame(checkRenderMode);
    };

    rafId = requestAnimationFrame(checkRenderMode);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [currentRenderMode, handleIntelligentRenderModeChange]);

  useEffect(() => {
    const handleTileRendered = (event: TileRenderedEvent) => {
      if (!event?.tileId) return;
      if (tileServiceRef.current && event.version !== undefined) {
        tileServiceRef.current.setTileVersion(event.tileId, event.version);
      }
      tileLayerManagerRef.current?.refreshTile(event.tileId, event.version);
      clearPendingByTile(event.tileId);
    };

    const handlePixelDiff = (event: PixelDiffEvent) => {
      if (event?.tileId) {
        clearPendingByTile(event.tileId);
      }
    };

    tileSocketManager.setTileRenderedCallback(handleTileRendered);
    tileSocketManager.setPixelDiffCallback(handlePixelDiff);

    return () => {
      tileSocketManager.setTileRenderedCallback(undefined);
      tileSocketManager.setPixelDiffCallback(undefined);
    };
  }, [clearPendingByTile]);

  // 绘制像素
  const drawPixel = useCallback(async (lat: number, lng: number) => {
    logger.debug(`🎨 开始绘制像素: (${lat}, ${lng})`);
    logger.debug(`🎨 绘制状态检查: isDrawingRef.current = ${isDrawingRef.current}`);
    logger.info(`🔍 DEBUG: currentSessionId = ${currentSessionId ? currentSessionId.slice(0, 8) : 'null'}`);
    
    // 🔧 修复：移除过于严格的绘制状态检查，允许重绘已存在的像素
    // 检查是否正在绘制中 - 但允许重绘
    if (isDrawingInProgressRef.current) {
      logger.debug('🎨 绘制正在进行中，等待当前绘制完成...');
      // 等待一小段时间后重试，而不是直接跳过
      setTimeout(() => {
        if (!isDrawingInProgressRef.current) {
          drawPixel(lat, lng);
        }
      }, 100);
      return;
    }
    
    // 检查是否为游客模式
    const isGuest = AuthService.isGuest();
    if (isGuest) {
      logger.debug('🎨 游客模式无法绘制像素，跳过绘制');
      return;
    }
    
    if (!isDrawingRef.current) {
      logger.debug('🎨 用户无法绘制，跳过绘制');
      return;
    }

    // 检查用户状态
    if (userStateRef.current) {
      logger.debug(`🎨 用户状态:`, userStateRef.current);
      if (userStateRef.current.totalPixelPoints <= 0) {
        logger.debug('🎨 用户像素点数不足，跳过绘制');
        return;
      }
    }

    // 设置绘制中状态
    isDrawingInProgressRef.current = true;
    
    // 网格对齐 - 使用统一的网格计算
    const { lat: snappedLat, lng: snappedLng, gridId } = snapToGridLocal(lat, lng);
    logger.debug(`🎨 网格对齐后坐标: (${snappedLat}, ${snappedLng}) [${gridId}]`);

    let pendingInfo: { pendingId: string; tileId: string } | null = null;

    try {
      logger.debug(`🎨 获取用户联盟旗帜...`);
      const userFlag = await getUserAllianceFlag();
      logger.debug(`🎨 用户联盟旗帜:`, userFlag);

      logger.debug(`🎨 获取用户像素颜色...`);
      const pixelColor = await getUserPixelColor(userFlag);
      logger.debug(`🎨 用户像素颜色:`, pixelColor);
      
      const pixelData: any = {
        lat: snappedLat,
        lng: snappedLng,
        color: pixelColor,
        patternId: userFlag?.pattern_id,
        anchorX: userFlag?.anchor_x || 0,
        anchorY: userFlag?.anchor_y || 0,
        rotation: userFlag?.rotation || 0,
        mirror: userFlag?.mirror || false
      };

      // 🆕 如果有当前会话ID，添加到请求数据中
      if (currentSessionId) {
        pixelData.sessionId = currentSessionId;
        logger.debug('🔗 手动绘制时传递sessionId:', currentSessionId.slice(0, 8));
      }

      logger.debug('🔍 发送的像素数据:', pixelData);

      if (tileModeEnabled) {
        const queued = queuePendingPixel(snappedLat, snappedLng, pixelColor);
        if (queued) {
          pendingInfo = { pendingId: queued.pending.id, tileId: queued.tileId };
        }
      }

      logger.info('🎨 开始手动绘制像素:', pixelData);
      const response = await pixelDrawService.drawPixelManual(pixelData);

      if (response.success) {
        logger.info('✅ 像素绘制成功:', response);

        // 使用图层服务绘制像素
        if (layerServiceRef.current && renderStrategy !== 'tile') {
          await layerServiceRef.current.addPixel({
            lat: snappedLat,
            lng: snappedLng,
            grid_id: gridId,
            color: pixelColor,
            pattern_id: userFlag?.pattern_id,
            anchor_x: userFlag?.anchor_x || 0,
            anchor_y: userFlag?.anchor_y || 0,
            rotation: userFlag?.rotation || 0,
            mirror: userFlag?.mirror || false
          });
        }
        
        logger.info(`✅ 绘制像素成功: pattern_id ${userFlag?.pattern_id} at (${snappedLat}, ${snappedLng}) [${gridId}]`);
        
        // 更新本地像素状态 - 确保前端状态与后端数据同步
        const newPixel = {
          id: response.data?.pixel?.id || Date.now().toString(),
          grid_id: gridId,
          lat: snappedLat,
          lng: snappedLng,
          color: pixelColor,
          pattern_id: userFlag?.pattern_id,
          anchor_x: userFlag?.anchor_x || 0,
          anchor_y: userFlag?.anchor_y || 0,
          rotation: userFlag?.rotation || 0,
          mirror: userFlag?.mirror || false,
          user_id: response.data?.pixel?.user_id || 'current_user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // 通知父组件更新像素状态
        if (onPixelUpdate) {
          onPixelUpdate(newPixel);
        }
        
        logger.debug(`✅ 本地像素状态已更新:`, newPixel);
        
        // 绘制成功后立即同步用户状态
        if (manualConsumePixel) {
          logger.debug('🔄 绘制成功，触发状态同步');
          manualConsumePixel();
        }
      } else {
        logger.error('❌ 像素绘制失败:', response);
        logger.info('💡 提示：绘制失败可能是由于请求过于频繁，请稍后再试');

        if (pendingInfo) {
          clearPendingById(pendingInfo.pendingId, pendingInfo.tileId);
        }
      }
    } catch (error) {
      logger.error('❌ 绘制像素失败:', error);
      if (pendingInfo) {
        clearPendingById(pendingInfo.pendingId, pendingInfo.tileId);
      }
    } finally {
      // 清除绘制中状态
      isDrawingInProgressRef.current = false;
    }
  }, [
    getUserAllianceFlag,
    getUserPixelColor,
    isDrawingRef,
    onPixelUpdate,
    manualConsumePixel,
    tileModeEnabled,
    queuePendingPixel,
    clearPendingById,
    renderStrategy,
    currentSessionId
  ]);


  // 切换绘制模式
  const toggleDrawing = useCallback(() => {
    const newDrawingState = !isDrawingRef.current;
    isDrawingRef.current = newDrawingState;
    setIsDrawing(newDrawingState);
    
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = newDrawingState ? "crosshair" : "grab";
    }
    
    logger.debug(`🎨 绘制模式: ${newDrawingState ? '开启' : '关闭'}`);
  }, []);

  // 处理颜色变化
  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    colorRef.current = newColor;
    logger.debug(`颜色已更改为: ${newColor}`);
  }, []);

  // 初始化地图
  useEffect(() => {
    logger.debug('🔧 地图初始化useEffect执行');
    // 确保容器存在且地图未初始化
    if (mapContainerRef.current && !mapRef.current && !isMapInitializing) {
      logger.debug('🔧 开始调用initMap');
      initMap();
    } else {
      logger.debug('🔧 跳过initMap调用:', {
        containerExists: !!mapContainerRef.current,
        mapExists: !!mapRef.current,
        isInitializing: isMapInitializing
      });
    }
  }, []); // 只在组件挂载时执行一次，initMap内部有防重复逻辑

  // 视图变化后，异步预热当前视图涉及的 emoji 字体（避免首屏阻塞）
  useEffect(() => {
    if (!isMapLoaded) return;
    try {
      if (layerServiceRef.current && typeof layerServiceRef.current.warmupEmojiFontForView === 'function') {
        layerServiceRef.current.warmupEmojiFontForView();
      }
    } catch {}
  }, [isMapLoaded, currentRenderMode]);

  // 🔗 处理分享链接的目标位置跳转
  useEffect(() => {
    if (!targetLocation || !isMapLoaded || !mapRef.current) return;

    const map = mapRef.current;
    const { lat, lng } = targetLocation;

    logger.info('🔗 处理分享链接跳转:', { lat, lng });

    try {
      // 验证地图API是否已加载
      if (!window.AMap || !window.AMap.LngLat) {
        logger.warn('⚠️ 地图API未完全加载，延迟处理分享链接跳转');
        setTimeout(() => {
          // 重新触发（通过更新状态）
          if (onTargetLocationHandled) {
            onTargetLocationHandled();
          }
        }, 1000);
        return;
      }

      // 验证地图对象是否有必要的方法
      if (!map.setZoomAndCenter || !map.lngLatToContainer) {
        logger.warn('⚠️ 地图对象方法未就绪，跳过分享链接跳转');
        if (onTargetLocationHandled) {
          onTargetLocationHandled();
        }
        return;
      }

      // 1. 移动地图到目标位置（带动画效果）
      map.setZoomAndCenter(16, [lng, lat], false, 500);

      // 2. 延迟后模拟点击该位置，打开像素信息卡片
      setTimeout(() => {
        try {
          // 将经纬度转换为像素坐标
          const lngLatObj = new window.AMap.LngLat(lng, lat);
          const pixel = map.lngLatToContainer(lngLatObj);

          if (!pixel || pixel.x === undefined || pixel.y === undefined) {
            logger.warn('⚠️ 无法获取像素坐标，跳过打开信息卡片');
            if (onTargetLocationHandled) {
              onTargetLocationHandled();
            }
            return;
          }

          // 模拟点击事件
          const clickEvent = {
            lnglat: { lat, lng },
            pixel: { x: pixel.x, y: pixel.y },
            target: map
          };

          // 触发地图点击事件来显示像素信息
          if (layerServiceRef.current) {
            // 手动调用图层点击处理
            const handlers = layerServiceRef.current as any;
            if (handlers.handlePixelClick) {
              handlers.handlePixelClick(clickEvent);
            }
          }

          logger.info('✅ 分享链接跳转完成');
          setShareLinkProcessed(true); // 标记分享链接已处理
        } catch (innerError) {
          logger.error('❌ 打开像素信息卡片失败:', innerError);
        }

        // 3. 通知父组件已处理完成
        if (onTargetLocationHandled) {
          onTargetLocationHandled();
        }
      }, 1000); // 增加等待时间，确保地图动画和渲染完成
    } catch (error) {
      logger.error('❌ 处理分享链接跳转失败:', error);
      if (onTargetLocationHandled) {
        onTargetLocationHandled();
      }
    }
  }, [targetLocation, isMapLoaded, onTargetLocationHandled]);

  // 初始化用户状态
  useEffect(() => {
    if (isMapLoaded) {
      initializeUser();
    }
  }, [isMapLoaded]); // 移除 initializeUser 依赖项

  // 监听绘制模式状态变化（包括手动模式和GPS自动模式）
  useEffect(() => {
    // 检查是否为游客模式
    const isGuest = AuthService.isGuest();
    
    // 计算是否应该启用绘制：手动模式 OR GPS自动模式
    const shouldEnableDrawing = Boolean((manualModeEnabled || externalGpsEnabled) && !isGuest);
    
    setIsDrawing(shouldEnableDrawing);
    isDrawingRef.current = shouldEnableDrawing;
    
    logger.debug(`🎨 绘制模式状态同步: ${shouldEnableDrawing ? '开启' : '关闭'}`, {
      manualMode: manualModeEnabled,
      gpsMode: externalGpsEnabled,
      isGuest,
      finalState: shouldEnableDrawing
    });
    
    // 更新鼠标样式 - GPS模式下不显示绘制手势
    if (mapContainerRef.current) {
      const cursor = (manualModeEnabled && !externalGpsEnabled) ? "crosshair" : "grab";
      mapContainerRef.current.style.cursor = cursor;
      logger.debug(`🎯 鼠标样式更新: ${cursor} (手动模式: ${manualModeEnabled}, GPS模式: ${externalGpsEnabled})`);
    }
    
    // 移除自动调用manualConsumePixel，避免循环调用
    // 手动消耗像素应该在用户实际点击绘制时调用，而不是在模式切换时
  }, [manualModeEnabled, externalGpsEnabled]);

  // 🆕 监控currentSessionId变化
  useEffect(() => {
    if (currentSessionId) {
      logger.info(`🔗 AmapCanvas接收到currentSessionId: ${currentSessionId.slice(0, 8)}`);
    } else {
      // 只在开发环境显示此日志，这是正常状态
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`🔗 AmapCanvas当前无活跃绘制会话`);
      }
    }
  }, [currentSessionId]);

  // 绘制防抖引用
  const drawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDrawTimeRef = useRef<number>(0);
  const isDrawingInProgressRef = useRef<boolean>(false);
  const isProcessingPixelClickRef = useRef<boolean>(false);

  // 像素点击事件处理函数
  const handlePixelClick = useCallback(async (pixelData: any, clientX: number, clientY: number) => {
    logger.info('🎯 在AmapCanvas中处理像素点击:', {
      gridId: pixelData.grid_id,
      lat: pixelData.lat,
      lng: pixelData.lng,
      clientX,
      clientY,
      timestamp: Date.now()
    });

    // 防护检查：确保这是正常的像素点击事件
    if (!pixelData || !pixelData.grid_id) {
      logger.warn('⚠️ 像素数据无效，忽略点击');
      return;
    }

    // 防护检查：阻止任何可能的重复调用
    if (isProcessingPixelClickRef.current) {
      logger.warn('⚠️ 像素点击正在处理中，忽略重复点击');
      return;
    }
    isProcessingPixelClickRef.current = true;

    // 🔧 在绘制模式下跳过像素信息API调用，避免不必要的网络请求和错误
    if (isDrawingRef.current || externalGpsEnabled) {
      logger.debug('🎨 绘制模式下跳过像素详细信息获取，避免不必要的API调用');
      isProcessingPixelClickRef.current = false;
      return;
    }

    // GPS模式下禁用手动点击像素重绘
    if (externalGpsEnabled) {
      logger.debug('🎯 GPS模式下禁用手动点击像素重绘，显示信息卡片');
      // GPS模式下只显示信息，不执行重绘
    } else if (isDrawingRef.current && manualModeEnabled) {
      logger.debug('🎨 手动模式下像素被点击，执行重绘逻辑');
      // 手动模式下直接调用绘制函数，使用像素的坐标
      drawPixel(pixelData.lat, pixelData.lng);
      return;
    }

    logger.debug('🎯 像素被点击，获取详细信息并显示信息卡片');
    
    try {
      // 调用新的详细信息API获取完整的像素信息
      logger.debug(`🔍 开始查询像素数据: gridId=${pixelData.grid_id}`);
      const response = await PixelService.getPixelDetails(pixelData.grid_id);
      
      if (response.success && response.data) {
        const pixelInfo: PixelInfo = {
          grid_id: response.data.grid_id,
          lat: response.data.lat,
          lng: response.data.lng,
          color: response.data.color,
          pattern_id: response.data.pattern_id,
          pattern_anchor_x: response.data.pattern_anchor_x,
          pattern_anchor_y: response.data.pattern_anchor_y,
          pattern_rotation: response.data.pattern_rotation,
          pattern_mirror: response.data.pattern_mirror,
          user_id: response.data.user_id,
          username: response.data.username,
          avatar: response.data.avatar,
          avatar_url: response.data.avatar_url,
          display_name: response.data.display_name,
          // 地理位置字段
          city: response.data.city,
          province: response.data.province,
          country: response.data.country,
          alliance_id: response.data.alliance_id,
          alliance_name: response.data.alliance_name,
          alliance_flag: response.data.alliance_flag,
          alliance: response.data.alliance,
          likes_count: response.data.likes_count,
          created_at: response.data.created_at,
          updated_at: response.data.updated_at,
          renderType: pixelData.renderType || 'color'
        };
        
        // 显示像素信息卡片
        logger.info('🎯 设置像素信息卡片状态:', {
          isVisible: true,
          pixel: {
            grid_id: pixelInfo.grid_id,
            username: pixelInfo.username,
            alliance_name: pixelInfo.alliance_name,
            city: pixelInfo.city,
            province: pixelInfo.province,
            country: pixelInfo.country,
            renderType: pixelInfo.renderType
          },
          position: { x: clientX, y: clientY },
          timestamp: Date.now()
        });

        setPixelInfoCard({
          isVisible: true,
          pixel: pixelInfo,
          position: { x: clientX, y: clientY }
        });

        logger.info('✅ 像素信息卡片状态已设置，等待组件渲染');
      } else {
        // 如果像素不存在或API调用失败，显示占位符卡片
        if (response.data === null) {
          logger.debug(`ℹ️ 像素不存在，显示占位符卡片: gridId=${pixelData.grid_id}`);
          const placeholderPixel: PixelInfo = {
            grid_id: pixelData.grid_id,
            lat: pixelData.lat,
            lng: pixelData.lng,
            color: '#cccccc',
            renderType: pixelData.renderType || 'color',
            isPlaceholder: true
          } as any;
          
          setPixelInfoCard({
            isVisible: true,
            pixel: placeholderPixel,
            position: { x: clientX, y: clientY }
          });
        } else {
          logger.error('❌ 获取像素详细信息失败:', response);
          // 显示错误提示
          setModalInfo({
            message: '无法加载像素信息，请稍后重试',
            type: 'error',
            isVisible: true
          });
        }
      }
    } catch (error) {
      logger.error('❌ 获取像素详细信息失败:', error);
      // 如果API调用失败，使用原有数据作为备选
      const pixelInfo: PixelInfo = {
        grid_id: pixelData.grid_id,
        lat: pixelData.lat,
        lng: pixelData.lng,
        color: pixelData.color,
        pattern_id: pixelData.pattern_id,
        pattern_anchor_x: pixelData.pattern_anchor_x,
        pattern_anchor_y: pixelData.pattern_anchor_y,
        pattern_rotation: pixelData.pattern_rotation,
        pattern_mirror: pixelData.pattern_mirror,
        user_id: pixelData.user_id,
        username: pixelData.username,
        timestamp: pixelData.timestamp,
        // 地理位置字段（备选数据可能没有这些字段）
        city: (pixelData as any).city || null,
        province: (pixelData as any).province || null,
        country: (pixelData as any).country || null,
        renderType: pixelData.renderType || 'color'
      };

      logger.info('📱 显示像素信息卡片:', {
        gridId: pixelInfo.grid_id,
        position: { x: clientX, y: clientY }
      });

      setPixelInfoCard({
        isVisible: true,
        pixel: pixelInfo,
        position: { x: clientX, y: clientY }
      });
    }

    // 重置防护状态
    setTimeout(() => {
      isProcessingPixelClickRef.current = false;
    }, 100); // 100ms后重置，避免重复调用
  }, [drawPixel, isDrawing, manualModeEnabled, externalGpsEnabled]);

  // 地图点击事件处理（仅处理空白区域绘制）
  const handleMapClick = useCallback((event: any) => {
    const { lnglat } = event;
    const now = Date.now();

    logger.debug(`🎯 地图空白区域点击事件: (${lnglat.lat}, ${lnglat.lng})`);

    // GPS模式下禁用手动点击绘制
    if (externalGpsEnabled) {
      logger.debug(`🎯 GPS模式下禁用手动点击绘制`);
      return;
    }

    // 只处理手动模式下的空白区域绘制逻辑
    if (isDrawingRef.current && manualModeEnabled) {
      // 🔧 修复：减少防抖时间，允许更频繁的重绘
      if (now - lastDrawTimeRef.current < 50) { // 从100ms减少到50ms
        logger.debug(`🎯 绘制请求过于频繁，跳过绘制 (间隔: ${now - lastDrawTimeRef.current}ms)`);
        return;
      }

      // 清除之前的超时
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }

      // 设置新的超时，减少延迟时间
      drawTimeoutRef.current = setTimeout(() => {
        logger.debug(`🎯 开始手动绘制像素...`);
        lastDrawTimeRef.current = Date.now();
        drawPixel(lnglat.lat, lnglat.lng);
      }, 25); // 从50ms减少到25ms
    } else {
      logger.debug(`🎯 手动绘制被跳过，原因: isDrawing=${isDrawingRef.current}, manualMode=${manualModeEnabled}, gpsMode=${externalGpsEnabled}`);
    }
  }, [drawPixel, isDrawing, manualModeEnabled, externalGpsEnabled]);

  // 地图点击事件绑定
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    // 绑定点击事件
    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [isMapLoaded, handleMapClick]);

  // 网格显示/隐藏效果
  useEffect(() => {
    if (!isMapLoaded) return;

    if (showGrid) {
      showGridLines();
    } else {
      hideGridLines();
    }
  }, [showGrid, isMapLoaded, showGridLines, hideGridLines]);

  // WebSocket实时像素更新监听 - 优化批量渲染
  useEffect(() => {
    logger.debug('🔌 初始化WebSocket实时像素更新监听（批量渲染优化）...');

    // 批量渲染缓冲区
    const pixelUpdateBuffer: any[] = [];
    let batchRenderTimer: NodeJS.Timeout | null = null;
    const BATCH_RENDER_DELAY = 100; // 100ms批量渲染延迟
    const MAX_BATCH_SIZE = 500; // 最大批量大小

    // 批量渲染函数
    const flushPixelUpdates = () => {
      if (pixelUpdateBuffer.length === 0) return;

      logger.info(`🎨 批量渲染 ${pixelUpdateBuffer.length} 个实时像素更新`);

      if (layerServiceRef.current && renderStrategy !== 'tile') {
        // 使用批量渲染API（如果可用）
        if (typeof layerServiceRef.current.batchAddPixels === 'function') {
          layerServiceRef.current.batchAddPixels([...pixelUpdateBuffer]);
        } else {
          // 降级：逐个添加（但在一个事件循环中完成）
          const batch = [...pixelUpdateBuffer];
          requestAnimationFrame(() => {
            batch.forEach(pixel => {
              if (layerServiceRef.current) {
                layerServiceRef.current.addPixel(pixel);
              }
            });
          });
        }
      }

      // 清空缓冲区
      pixelUpdateBuffer.length = 0;
      batchRenderTimer = null;
    };

    // 监听像素更新事件
    const handlePixelUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const pixelData = customEvent.detail;

      // 处理不同的数据结构：WebSocket数据使用gridId，其他地方可能使用grid_id
      const gridId = pixelData.gridId || pixelData.grid_id;

      if (layerServiceRef.current && gridId && renderStrategy !== 'tile') {
        // 添加到批量渲染缓冲区
        pixelUpdateBuffer.push({
          lat: pixelData.lat,
          lng: pixelData.lng,
          color: pixelData.color,
          pattern: pixelData.pattern,
          pattern_id: pixelData.patternId || pixelData.pattern_id,
          pattern_anchor_x: pixelData.pattern_anchor_x || 0,
          pattern_anchor_y: pixelData.pattern_anchor_y || 0,
          pattern_rotation: pixelData.pattern_rotation || 0,
          pattern_mirror: pixelData.pattern_mirror || false,
          grid_id: gridId,
          timestamp: Date.now()
        });

        // 如果达到最大批量大小，立即渲染
        if (pixelUpdateBuffer.length >= MAX_BATCH_SIZE) {
          if (batchRenderTimer) {
            clearTimeout(batchRenderTimer);
            batchRenderTimer = null;
          }
          flushPixelUpdates();
        } else {
          // 否则延迟批量渲染
          if (batchRenderTimer) {
            clearTimeout(batchRenderTimer);
          }
          batchRenderTimer = setTimeout(flushPixelUpdates, BATCH_RENDER_DELAY);
        }
      }
    };

    // 添加事件监听器
    window.addEventListener('pixel-updated', handlePixelUpdate as EventListener);

    logger.debug('✅ WebSocket实时更新监听器已设置（批量渲染模式）');

    return () => {
      logger.debug('🔌 清理WebSocket实时更新监听器...');

      // 清理定时器并刷新剩余缓冲
      if (batchRenderTimer) {
        clearTimeout(batchRenderTimer);
      }
      flushPixelUpdates();

      window.removeEventListener('pixel-updated', handlePixelUpdate);
    };
  }, [renderStrategy]);

  // 🔧 新增：监听外部GPS状态变化
  useEffect(() => {
    logger.debug('🔄 GPS状态变化:', externalGpsEnabled);

    if (externalGpsEnabled) {
      logger.debug('🔄 启动GPS跟踪...');
      startGpsTracking();
    } else {
      logger.debug('🔄 停止GPS跟踪...');
      stopGpsTracking();
    }
  }, [externalGpsEnabled, startGpsTracking, stopGpsTracking]);

  // 🔥 监听GPS状态变化，同步显示/隐藏漂流瓶和宝藏（带性能监控和防抖）
  useEffect(() => {
    const now = Date.now();
    const monitor = performanceMonitor.current;

    // 🎯 性能监控：检测异常频繁切换
    if (now - monitor.windowStart < 5000) {
      monitor.toggleCount++;
      if (monitor.toggleCount > 10) {
        logger.warn('⚠️ GPS切换过于频繁，可能存在性能问题！', {
          切换次数: monitor.toggleCount,
          时间窗口: '5秒',
          建议: '检查代码是否存在循环触发'
        });
      }
    } else {
      // 重置监控窗口
      monitor.windowStart = now;
      monitor.toggleCount = 1;
    }

    monitor.lastGPSToggle = now;

    // 🎯 核心逻辑
    logger.debug('🔄 GPS状态变化（漂流瓶&宝藏）:', {
      enabled: externalGpsEnabled,
      hasLocation: !!currentLocation,
      timestamp: new Date().toISOString()
    });

    // 防抖定时器
    let debounceTimer: NodeJS.Timeout | null = null;

    if (externalGpsEnabled && currentLocation) {
      // 🟢 GPS启动 → 防抖加载（避免快速切换时的重复请求）
      logger.debug('🟢 GPS已启动，准备加载标记（防抖300ms）...');

      debounceTimer = setTimeout(async () => {
        logger.debug('🔄 防抖后加载漂流瓶和宝藏标记...');
        await Promise.all([
          loadNearbyBottles(),
          loadNearbyTreasures()
        ]);
      }, 300); // 300ms防抖
    } else if (!externalGpsEnabled) {
      // 🔴 GPS停止 → 立即清除（无延迟，响应迅速）
      logger.debug('🔴 GPS已停止，立即清除所有标记');
      clearAllMarkers();
    }

    // 清理函数：取消待执行的防抖加载
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [externalGpsEnabled, currentLocation, loadNearbyBottles, loadNearbyTreasures, clearAllMarkers]);

  // 清理函数
  useEffect(() => {
    logger.debug('🔧 AmapCanvas组件挂载');
    return () => {
      logger.debug('🗑️ AmapCanvas组件卸载，开始清理地图资源...');
      
        // 停止GPS跟踪 - 高德地图API方式
        if (gpsWatchIdRef.current !== null) {
          // 高德地图定位API不需要clearWatch，直接设置为null即可
          gpsWatchIdRef.current = null;
          logger.debug('🗑️ 高德地图GPS跟踪已停止');
        }
      
      // 🎯 移除GPS定位图标和精度圆圈
      removeGpsMarker();
      
      // 销毁图层服务
      try {
        destroyAmapLayerService();
        layerServiceRef.current = null;
        logger.debug('🗑️ 图层服务已销毁');
      } catch (error) {
        logger.warn('销毁图层服务失败:', error);
      }
      
      // 销毁地图实例
      if (mapRef.current) {
        try {
          // 移除所有事件监听器
          mapRef.current.off('zoomend');
          mapRef.current.off('moveend');
          mapRef.current.off('click');
          mapRef.current.off('complete');
          mapRef.current.off('ready');
          mapRef.current.off('error');
          
          // 销毁地图
          mapRef.current.destroy();
          mapRef.current = null;
          logger.debug('🗑️ 地图实例已销毁');
        } catch (error) {
          logger.warn('销毁地图失败:', error);
        }
      }
      
      // 清理网格
      gridOverlaysRef.current.forEach(overlay => {
        if (mapRef.current) {
          mapRef.current.remove(overlay);
        }
      });
      gridOverlaysRef.current.clear();
      
      // 清理防抖引用
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }

      // 🍾 清理漂流瓶地图标记
      bottleMarkersRef.current.forEach((marker, bottleId) => {
        if (mapRef.current) {
          mapRef.current.remove(marker);
        }
      });
      bottleMarkersRef.current.clear();
      
      // 清理绘制状态
      isDrawingInProgressRef.current = false;
      
      // 重置状态
      setIsMapLoaded(false);
      setIsMapInitializing(false);
      setMapError(null);
      setShowGrid(false);
      
      logger.debug('🗑️ 地图资源清理完成');
    };
  }, [removeGpsMarker]);

  // 错误显示组件
  if (mapError) {
    return (
      <div style={{ 
        width: "100vw", 
        height: "100vh", 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>地图加载失败</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>{mapError}</p>
          
          <div style={{ textAlign: 'left', background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px' }}>解决方案：</h4>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li>访问 <a href="https://console.amap.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>高德开放平台控制台</a></li>
              <li>找到您的应用</li>
              <li>在"应用设置"中添加域名白名单：</li>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                <li>localhost</li>
                <li>127.0.0.1</li>
                <li>localhost:5173</li>
                <li>localhost:5174</li>
              </ul>
            </ol>
          </div>
          
          <button 
            onClick={reinitializeMap}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            重新初始化地图
          </button>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: "100vw", height: "100vh" }}>
      <div
        ref={mapContainerRef}
        data-amap-container="true"
        className="amap-container"
        style={{
          width: "100%",
          height: "100%",
          cursor: isDrawing ? "crosshair" : "grab"
        }}
      />

      {/* 搜索栏 - 地图屏幕正上方，仅在用户登录时显示 */}
      {isAuthenticated && (
        <MapSearchBar onLocationSearch={handleLocationSearch} isAuthenticated={isAuthenticated} />
      )}

      <InfoModal
        message={modalInfo.message}
        type={modalInfo.type}
        isVisible={modalInfo.isVisible}
        onClose={closeModal}
      />
      


      {/* 像素信息卡片 */}
      <PixelInfoCard
        pixel={pixelInfoCard.pixel}
        isVisible={pixelInfoCard.isVisible}
        onClose={closePixelInfoCard}
        position={pixelInfoCard.position}
        isDrawingMode={isDrawing}
      />

      {/* 📍 地图标记信息窗口 */}
      {hoverInfo && (
        <MapMarkerInfo
          type={hoverInfo.type}
          position={hoverInfo.type === 'treasure' ?
            { lat: hoverInfo.item.hide_lat, lng: hoverInfo.item.hide_lng } :
            { lat: hoverInfo.item.current_lat, lng: hoverInfo.item.current_lng }
          }
          title={hoverInfo.type === 'treasure' ?
            hoverInfo.item.title :
            `漂流瓶 ${hoverInfo.item.bottle_id.slice(0, 8)}...`
          }
          itemId={hoverInfo.item.treasure_id || hoverInfo.item.bottle_id}
          treasureInfo={hoverInfo.type === 'treasure' ? {
            treasureType: hoverInfo.item.treasure_type,
            moveCount: hoverInfo.item.move_count,
            description: hoverInfo.item.description,
            hint: hoverInfo.item.hint,
            rewardValue: hoverInfo.item.reward_value,
            hiderName: hoverInfo.item.hider_name,
            hiddenAt: hoverInfo.item.hidden_at
          } : undefined}
          bottleInfo={hoverInfo.type === 'drift-bottle' ? {
            pickupCount: hoverInfo.item.pickup_count,
            totalDistance: hoverInfo.item.total_distance,
            messageCount: hoverInfo.item.message_count,
            currentCity: hoverInfo.item.current_city,
            currentCountry: hoverInfo.item.current_country,
            originCity: hoverInfo.item.origin_city,
            originCountry: hoverInfo.item.origin_country,
            createdAt: hoverInfo.item.created_at
          } : undefined}
          isVisible={true}
          anchorPoint={hoverInfo.position}
          mode="hover"
          onClose={() => setHoverInfo(null)}
        />
      )}

      {clickInfo && (
        <MapMarkerInfo
          type={clickInfo.type}
          position={clickInfo.type === 'treasure' ?
            { lat: clickInfo.item.hide_lat, lng: clickInfo.item.hide_lng } :
            { lat: clickInfo.item.current_lat, lng: clickInfo.item.current_lng }
          }
          title={clickInfo.type === 'treasure' ?
            clickInfo.item.title :
            `漂流瓶 ${clickInfo.item.bottle_id.slice(0, 8)}...`
          }
          itemId={clickInfo.item.treasure_id || clickInfo.item.bottle_id}
          treasureInfo={clickInfo.type === 'treasure' ? {
            treasureType: clickInfo.item.treasure_type,
            moveCount: clickInfo.item.move_count,
            description: clickInfo.item.description,
            hint: clickInfo.item.hint,
            rewardValue: clickInfo.item.reward_value,
            hiderName: clickInfo.item.hider_name,
            hiddenAt: clickInfo.item.hidden_at
          } : undefined}
          bottleInfo={clickInfo.type === 'drift-bottle' ? {
            pickupCount: clickInfo.item.pickup_count,
            totalDistance: clickInfo.item.total_distance,
            messageCount: clickInfo.item.message_count,
            currentCity: clickInfo.item.current_city,
            currentCountry: clickInfo.item.current_country,
            originCity: clickInfo.item.origin_city,
            originCountry: clickInfo.item.origin_country,
            createdAt: clickInfo.item.created_at
          } : undefined}
          isVisible={true}
          anchorPoint={clickInfo.position}
          mode="click"
          onClose={() => setClickInfo(null)}
        />
      )}

      {/* 🍾 漂流瓶发现和拾取动画 */}
      <AnimatePresence>
        {showBottleFoundAnimation && foundBottleInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 100 }}
            animate={{
              opacity: 1,
              scale: [0.3, 1.2, 1],
              y: 0,
              rotate: [0, 10, -10, 0]
            }}
            exit={{
              opacity: 0,
              scale: 0.3,
              y: -100,
              transition: { duration: 0.3 }
            }}
            transition={{
              duration: 0.6,
              ease: 'easeOut',
              scale: {
                times: [0, 0.6, 1],
                duration: 0.6
              },
              rotate: {
                times: [0, 0.3, 0.6, 1],
                duration: 0.6
              }
            }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 5010, // 🔥 优化：使用标准z-index规范，模态背景
              pointerEvents: 'none'
            }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 10px 30px rgba(102, 126, 234, 0.4)',
                  '0 10px 50px rgba(102, 126, 234, 0.8)',
                  '0 10px 30px rgba(102, 126, 234, 0.4)'
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '30px 40px',
                borderRadius: '24px',
                textAlign: 'center',
                border: '3px solid rgba(255,255,255,0.4)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* 背景粒子效果 */}
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.5, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none'
                }}
              />

              {/* 漂流瓶图标 */}
              <motion.div
                animate={{
                  rotate: [0, 15, -15, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                style={{
                  fontSize: '64px',
                  marginBottom: '15px',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                🍾
              </motion.div>

              {/* 文字内容 */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <motion.h3
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  🎉 发现漂流瓶！
                </motion.h3>
                <p style={{
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  opacity: 0.95,
                  fontWeight: 500
                }}>
                  瓶号: {foundBottleInfo.bottle_id}
                </p>
                <motion.p
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    opacity: 0.9,
                    fontStyle: 'italic'
                  }}
                >
                  正在自动拾取到背囊...
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🍾 漂流瓶详情模态框 */}
      <AnimatePresence>
        {showBottleModal && selectedBottle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              zIndex: 5011 // 🔥 优化：使用标准z-index规范，漂流瓶模态
            }}
            onClick={() => setShowBottleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '30px',
                maxWidth: '400px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  fontSize: '64px',
                  marginBottom: '15px',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                }}>🍾</div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: '5px'
                }}>
                  漂流瓶
                </h2>
                <div style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  padding: '5px 15px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  #{selectedBottle.bottle_id}
                </div>
              </div>

              {/* 瓶子信息 */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '10px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📝</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>消息内容</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {selectedBottle.latest_message?.message || '这个瓶子还没有消息...'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '10px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>当前位置</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {selectedBottle.current_lat.toFixed(4)}, {selectedBottle.current_lng.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '10px'
                  }}>
                    <span style={{ fontSize: '20px' }}>⏰</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>创建时间</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {new Date(selectedBottle.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowBottleModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                >
                  关闭
                </button>

                <button
                  onClick={() => handlePickupBottle(selectedBottle)}
                  disabled={isPickingUpBottle}
                  style={{
                    flex: 2,
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isPickingUpBottle ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: isPickingUpBottle ? 0.6 : 1,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isPickingUpBottle) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  {isPickingUpBottle ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      拾取中...
                    </span>
                  ) : (
                    '🎉 拾取漂流瓶'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💎 QR宝藏详情模态框 */}
      <AnimatePresence>
        {showTreasureModal && selectedTreasure && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              zIndex: 5012 // 🔥 优化：使用标准z-index规范，宝藏模态
            }}
            onClick={() => setShowTreasureModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '30px',
                maxWidth: '420px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  fontSize: '64px',
                  marginBottom: '15px',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                }}>
                  {selectedTreasure.treasure_type === 'mobile' ? '🚲' : '📦'}
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: '5px'
                }}>
                  {selectedTreasure.treasure_type === 'mobile' ? '移动宝藏' : '固定宝藏'}
                </h2>
                <div style={{
                  display: 'inline-block',
                  background: selectedTreasure.treasure_type === 'mobile'
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginTop: '8px'
                }}>
                  {selectedTreasure.treasure_type === 'mobile'
                    ? `${selectedTreasure.move_count || 0} 次移动`
                    : '固定位置'
                  }
                </div>
              </div>

              {/* 宝藏信息 */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>💎</span>
                  {selectedTreasure.title}
                </h3>

                {selectedTreasure.description && (
                  <p style={{
                    margin: '0 0 15px 0',
                    fontSize: '14px',
                    color: '#64748b',
                    lineHeight: '1.5',
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    {selectedTreasure.description}
                  </p>
                )}

                {selectedTreasure.hint && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#92400e',
                      fontWeight: '600',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>💡</span>
                      提示
                    </div>
                    <div style={{ fontSize: '13px', color: '#78350f' }}>
                      {selectedTreasure.hint}
                    </div>
                  </div>
                )}

                {/* 奖励信息 */}
                {selectedTreasure.reward_value && (
                  <div style={{
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    borderRadius: '12px',
                    padding: '15px',
                    marginBottom: '15px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: '#78350f', fontWeight: '600', marginBottom: '4px' }}>
                      奖励积分
                    </div>
                    <div style={{ fontSize: '24px', color: '#451a03', fontWeight: 'bold' }}>
                      {JSON.parse(selectedTreasure.reward_value).amount || 50} ⭐
                    </div>
                  </div>
                )}

                {/* 详细信息 */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>👤</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>藏宝者</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {selectedTreasure.hider_name}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>位置</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {selectedTreasure.city || '未知位置'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>⏰</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>创建时间</div>
                      <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                        {new Date(selectedTreasure.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {selectedTreasure.expires_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '16px' }}>⏳</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>过期时间</div>
                        <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                          {new Date(selectedTreasure.expires_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowTreasureModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                >
                  关闭
                </button>

                <button
                  onClick={() => {
                    // 这里可以添加领取宝藏的逻辑
                    toast.success('💎 扫描二维码来寻找这个宝藏！');
                    setShowTreasureModal(false);
                  }}
                  style={{
                    flex: 2,
                    padding: '12px 20px',
                    background: selectedTreasure.treasure_type === 'mobile'
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedTreasure.treasure_type === 'mobile'
                      ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                      : '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = selectedTreasure.treasure_type === 'mobile'
                      ? '0 6px 16px rgba(16, 185, 129, 0.4)'
                      : '0 6px 16px rgba(245, 158, 11, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = selectedTreasure.treasure_type === 'mobile'
                      ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                      : '0 4px 12px rgba(245, 158, 11, 0.3)';
                  }}
                >
                  🎯 扫码寻宝
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
  );
}

// 信息模态框组件
function InfoModal({ message, type, isVisible, onClose }: {
  message: string;
  type: 'info' | 'warning' | 'error';
  isVisible: boolean;
  onClose: () => void;
}) {
  if (!isVisible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          icon: '❌',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          buttonColor: 'bg-red-500 hover:bg-red-600'
        };
      case 'warning':
        return {
          icon: '⚠️',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          buttonColor: 'bg-orange-500 hover:bg-orange-600'
        };
      default: // info
        return {
          icon: 'ℹ️',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          buttonColor: 'bg-blue-500 hover:bg-blue-600'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div 
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
        zIndex: 5010, // 🔥 优化：使用标准z-index规范，错误模态
        padding: '16px'
      }}
    >
      <div 
        className={`bg-white rounded-2xl p-6 w-full max-w-md ${styles.bgColor} ${styles.borderColor} border`}
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          padding: '24px', 
          width: '100%', 
          maxWidth: '448px',
          position: 'relative',
          zIndex: 5011 // 🔥 优化：使用标准z-index规范，错误模态内容
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 ${styles.iconBg} rounded-full flex items-center justify-center`}>
            <span className="text-lg">{styles.icon}</span>
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${styles.textColor}`}>
              {type === 'error' ? '错误' : type === 'warning' ? '警告' : '提示'}
            </h3>
          </div>
        </div>
        
        <p className={`${styles.textColor} leading-relaxed mb-6`}>{message}</p>
        
        <button
          onClick={onClose}
          className={`w-full py-3 px-4 ${styles.buttonColor} text-white rounded-lg font-medium transition-colors`}
        >
          确定
        </button>
      </div>
    </div>
  );
}
