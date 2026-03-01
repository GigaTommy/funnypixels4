/**
 * MapCanvas.tsx - PRODUCTION Vector-Only MVT Architecture
 *
 * Architecture:
 * - Pure vector tiles (NO RASTER) - MVT with ST_AsMVT encoding
 * - Three source-layers: pixels-color, pixels-emoji, pixels-complex
 * - SDF square for color pixels with dynamic icon-color
 * - Dynamic sprite loading for emoji/complex via SpriteLoader
 * - Base-2 exponential icon-size for physical size locking
 * - Hotpatch layer for <100ms instant updates via WebSocket
 *
 * FULL PIXEL DISPLAY OPTIMIZATION (like wplace.live):
 * - Max zoom: 18 (与 iOS 端保持一致)
 * - No sampling at zoom 12-18 (100% pixel visibility)
 * - Optimized icon-size interpolation for grid integrity
 * - Padding adjustments to prevent overlap
 *
 * Performance targets:
 * - MVT P95 < 200ms
 * - Sprite concurrency: max 8 parallel requests
 * - GPU cache: LRU eviction at 2000 sprites
 * - SetData batching: ≤1 per frame @ 60 FPS
 *
 * Environment variables:
 * - VITE_MVT_TILE_URL: Vector tile endpoint (/api/tiles/pixels/{z}/{x}/{y}.pbf)
 * - VITE_API_BASE_URL: Base URL for sprite API
 */

import React, { useEffect, useRef, useState } from "react";
// CSS已通过CDN在index.html中加载
import { tileUpdateSubscriber } from "../../services/tileUpdateSubscriber";
import { MapPixel, PixelFeature, pixelToFeature, createEmptyFeatureCollection } from "../../types";
import { SpriteLoader } from "../../utils/SpriteLoader";
import { useDrawing } from "../../contexts/DrawingContext";
import { unifiedDrawService } from "../../services/unifiedDrawService";
import { enhancedGpsService } from "../../services/enhancedGpsService";
import { unifiedSessionManager } from "../../services/unifiedSessionManager";
import { logger } from "../../utils/logger";
import { safeGetWindow, safeGetWindowProperty, safeExecuteBrowserFn, isGeolocationAvailable } from "../../utils/browserEnvironment";

// 🔥 添加全局未处理Promise拒绝的错误处理器
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('❌ [未处理的Promise拒绝]', {
      reason: event.reason,
      promise: event.promise,
      stack: event.reason?.stack,
      message: event.reason?.message || String(event.reason)
    });
  });
}

// Global type declarations for map instance and drawing system
declare global {
  interface Window {
    maplibregl?: any; // CDN的全局变量
    mapInstance?: any;
    mapLibreMap?: any;
    currentUser?: any; // 当前用户信息
    unifiedDrawService?: any; // 统一绘制服务
    enhancedGpsService?: any; // 增强GPS服务
    useDrawing?: any; // 绘制上下文Hook
    tileUpdateSubscriber?: any; // 瓦片更新订阅器
  }
}

// Enhanced MapLibre GL loading with timeout and retry
const getMapLibreGL = () => {
  const maplibregl = safeGetWindowProperty('maplibregl');
  if (maplibregl) {
    return maplibregl;
  }
  throw new Error('MapLibre GL not loaded from CDN');
};

// Robust MapLibre GL loader with fallback
const loadMapLibreGLWithTimeout = (timeoutMs: number = 10000): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const maplibregl = safeGetWindowProperty('maplibregl');
    if (maplibregl) {
      resolve(maplibregl);
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      logger.error('[MapLibreFactory] CDN 版本加载超时');
      reject(new Error('MapLibre GL CDN loading timeout'));
    }, timeoutMs);

    // Poll for MapLibre GL availability
    const checkInterval = setInterval(() => {
      const mlgl = safeGetWindowProperty('maplibregl');
      if (mlgl) {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
        logger.info('[MapLibreFactory] CDN 版本加载成功');
        resolve(mlgl);
      }
    }, 100);

    // Listen for script load error
    const script = document.querySelector('script[src*="maplibre-gl"]');
    if (script) {
      script.addEventListener('error', () => {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
        logger.error('[MapLibreFactory] CDN 脚本加载失败');
        reject(new Error('MapLibre GL CDN script failed to load'));
      });
    }
  });
};

// ========== Component Props ==========

interface MapCanvasProps {
  /** Base map style URL (OpenFreeMap, MapTiler, etc.) */
  styleUrl?: string;

  /** Initial map center [lng, lat] */
  initialCenter?: [number, number];

  /** Initial zoom level */
  initialZoom?: number;

  /** Enable/disable hotpatch layer (for testing) */
  enableHotpatch?: boolean;

  /** Callback when map is ready */
  onMapReady?: (map: any) => void;

  /** Callback when pixel is clicked */
  onPixelClick?: (pixelData: any, position: { x: number; y: number }) => void;

  /** Enable drawing functionality */
  enableDrawing?: boolean;
}

// ========== Constants ==========

/** Environment variables (PRODUCTION - vector only) */
const MVT_TILE_URL = import.meta.env.VITE_MVT_TILE_URL || 'http://localhost:3001/api/tiles/pixels/{z}/{x}/{y}.pbf?v=2';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/** SDF icon configuration */
const SDF_ICON_SIZE = 64; // Base image size in pixels
const SDF_PADDING = 8; // Padding to avoid SDF edge artifacts

/** Hotpatch batching configuration */
const HOTPATCH_BATCH_INTERVAL = 50; // ms - ~20 updates/sec max (60fps = 16ms/frame)
const HOTPATCH_MAX_BATCH_SIZE = 200; // Max pixels per batch

// ========== Utility Functions ==========

/**
 * Create SDF-optimized square icon with padding
 *
 * Why padding? SDF (Signed Distance Field) rendering samples pixels in a radius
 * around the shape. Without padding, sampling at edges would hit transparent
 * pixels from adjacent atlas positions, causing artifacts.
 *
 * @param size - Icon size in pixels (default 64)
 * @returns ImageData for addImage()
 */
function createSDFSquare(size: number = SDF_ICON_SIZE): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill with transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw white square with padding
  // Padding helps SDF algorithm compute smooth distance field
  const padding = SDF_PADDING;
  ctx.fillStyle = 'white';
  ctx.fillRect(padding, padding, size - 2 * padding, size - 2 * padding);

  return ctx.getImageData(0, 0, size, size);
}

/**
 * Find first symbol layer in style for z-index insertion
 *
 * Pixels should render above base map but below labels.
 * This finds the first symbol (label) layer to use as beforeId.
 */
function findLabelLayerId(map: any): string | undefined {
  const style = map.getStyle();
  if (!style || !style.layers) return undefined;

  for (const layer of style.layers) {
    if (layer.type === 'symbol') {
      return layer.id;
    }
  }

  // Fallback: return last layer (add to top)
  return style.layers.length ? style.layers[style.layers.length - 1].id : undefined;
}

/**
 * Generate mock pixel features for local development
 *
 * Falls back to window.__MOCK_PIXELS__ if available (set by App.tsx)
 */
function getMockPixelFeatures(): PixelFeature[] {
  // Check if mock pixels were generated by App.tsx
  const mockPixels = (window as any).__MOCK_PIXELS__ as MapPixel[] | undefined;

  if (mockPixels && mockPixels.length > 0) {
    logger.debug('🎨 Using window.__MOCK_PIXELS__:', mockPixels.length, 'pixels');
    return mockPixels.map(pixelToFeature);
  }

  // Generate minimal fallback if no mock data
  logger.debug('⚠️ No mock pixels found, generating fallback data');
  const fallbackPixels: PixelFeature[] = [];
  const baseCoords: [number, number] = [120.1551, 30.2741]; // Hangzhou

  for (let i = 0; i < 100; i++) {
    const lng = baseCoords[0] + (Math.random() - 0.5) * 0.01;
    const lat = baseCoords[1] + (Math.random() - 0.5) * 0.01;
    const type = i % 3 === 0 ? 'emoji' : i % 3 === 1 ? 'complex' : 'color';

    fallbackPixels.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        id: `fallback-${i}`,
        type,
        color: type === 'color' ? '#' + Math.floor(Math.random() * 16777215).toString(16) : undefined,
        emoji: type === 'emoji' ? ['🔥', '🌳', '🏢'][Math.floor(Math.random() * 3)] : undefined
      }
    });
  }

  return fallbackPixels;
}

// ========== Main Component ==========

export default function MapCanvas({
  styleUrl = 'https://tiles.openfreemap.org/styles/liberty', // 默认使用OFM Liberty样式（免费开源）
  initialCenter = [113.324520, 23.109702], // Guangzhou Tower (广州塔)
  initialZoom = 14,
  enableHotpatch = true,
  enableDrawing = true,
  onMapReady,
  onPixelClick
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const spriteLoaderRef = useRef<SpriteLoader | null>(null);
  const isInitializedRef = useRef(false); // 防止重复初始化
  const drawingCleanupRef = useRef<(() => void) | null>(null); // 绘制系统清理函数

  // 🆕 User avatar imageUrl mapping (pattern_id -> imageUrl)
  const avatarImageUrlMapRef = useRef<Map<string, string>>(new Map());

  // Hotpatch batching state
  const hotpatchQueue = useRef<PixelFeature[]>([]);
  const hotpatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Drawing system
  const drawing = useDrawing();
  const { state: drawingState, getters: drawingGetters } = drawing;

  // ========== Drawing System Functions ==========

  /**
   * 初始化绘制系统
   */
  const initializeDrawingSystem = (map: any) => {
    logger.info('🎨 初始化绘制系统...');

    // 初始化统一绘制服务
    const currentUser = safeGetWindowProperty('currentUser');
    const userId = currentUser?.id || 'anonymous';
    unifiedDrawService.initialize(userId);

    // 🔥 修复：使用ref来获取最新的drawing状态，避免闭包问题
    // 这样每次点击都能获取到最新的状态，而不是初始渲染时的状态
    const handleMapClick = async (e: any) => {
      try {
        // 🔥 关键修复：每次点击时重新获取最新的状态，而不是使用闭包中的旧值
        const currentMode = unifiedSessionManager.getCurrentMode();
        const hasActiveSession = unifiedSessionManager.isSessionActive();
        const currentSession = unifiedSessionManager.getCurrentSession();

        logger.info('🎨 [DEBUG] 地图点击事件触发:', {
          currentMode,
          hasActiveSession,
          sessionId: currentSession?.id,
          sessionStatus: currentSession?.status,
          isManualMode: currentMode === 'manual',
          eventType: e.type,
          lngLat: e.lngLat
        });

        // 只在手动绘制模式下处理点击
        if (currentMode !== 'manual') {
          logger.debug('🎨 [DEBUG] 点击事件被忽略: 非手动绘制模式', { currentMode });
          return;
        }

        if (!hasActiveSession) {
          logger.debug('🎨 [DEBUG] 点击事件被忽略: 无活跃会话');
          return;
        }

        // 🔥 安全地阻止事件冒泡（MapLibre GL 事件可能没有这些方法）
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        if (typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }

        // 🔥 安全地获取坐标
        const lnglat = e.lngLat;
        if (!lnglat || typeof lnglat.lat !== 'number' || typeof lnglat.lng !== 'number') {
          logger.error('❌ 无效的点击坐标:', { lnglat, event: e });
          return;
        }

        const coords = { lat: lnglat.lat, lng: lnglat.lng };

        logger.info(`🎨 手动绘制点击: 坐标(${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`);

        try {
          // 调用统一绘制服务
          const result = await unifiedDrawService.drawPixel({
          lat: coords.lat,
          lng: coords.lng,
          source: 'manual',
          color: '#FF0000', // 默认红色，可以从状态管理中获取
          coordinateSystem: 'WGS84'
        });

        if (result.success) {
          logger.info('✅ 手动绘制成功:', result.pixel);

          // 更新绘制状态
          drawing.actions.incrementPixelCount();
          drawing.actions.recordPixel(result.pixel);

          // 显示成功提示
          showDrawSuccessToast(coords);
        } else {
          logger.error('❌ 手动绘制失败:', result.error);
          showDrawErrorToast(result.error || '绘制失败');
        }
      } catch (error) {
        logger.error('❌ 手动绘制异常:', error);
        showDrawErrorToast('绘制异常');
      }
      } catch (outerError) {
        // 🔥 捕获任何未被inner catch捕获的错误
        logger.error('❌ 地图点击处理器外层异常:', {
          error: outerError,
          message: outerError instanceof Error ? outerError.message : String(outerError),
          stack: outerError instanceof Error ? outerError.stack : 'No stack trace',
          name: outerError instanceof Error ? outerError.name : 'Unknown',
          // 尝试序列化完整的错误对象
          stringified: JSON.stringify(outerError, Object.getOwnPropertyNames(outerError), 2)
        });
      }
    };

    // 注册地图点击事件 - 使用高优先级
    map.on('click', handleMapClick);
    logger.info('✅ 地图点击事件已注册 (handleMapClick)');

    // 🔥 添加一个简单的测试点击事件来验证事件系统是否工作
    const testClickHandler = (e: any) => {
      logger.info('🧪 [TEST] 地图被点击 (测试处理器):', {
        lngLat: e.lngLat,
        point: e.point,
        type: e.type
      });
    };
    map.on('click', testClickHandler);
    logger.info('✅ 测试点击事件已注册 (testClickHandler)');

    // 🔥 修复：使用最新的状态更新鼠标样式
    const updateMouseCursor = () => {
      const currentMode = unifiedSessionManager.getCurrentMode();
      const hasActiveSession = unifiedSessionManager.isSessionActive();

      if (currentMode === 'manual' && hasActiveSession) {
        // 手动绘制激活状态：使用绘制图标
        map.getCanvas().style.cursor = 'crosshair';
        logger.debug('🎨 鼠标样式已设置为: crosshair (手动绘制模式)');
      } else {
        // 非绘制状态：恢复默认样式
        map.getCanvas().style.cursor = '';
        logger.debug('🎨 鼠标样式已恢复为默认');
      }
    };

    // 监听绘制状态变化，更新鼠标样式
    const unsubscribe = unifiedSessionManager.subscribe(() => {
      updateMouseCursor();
    });

    // 初始设置鼠标样式
    setTimeout(updateMouseCursor, 100);

    // 初始化GPS绘制
    initializeGPSDrawing();

    logger.info('✅ 绘制系统初始化完成');

    // 返回清理函数
    return () => {
      unsubscribe();
    };
  };

  /**
   * 初始化GPS绘制
   */
  const initializeGPSDrawing = () => {
    logger.info('📍 初始化GPS绘制...');

    // 🔥 修复：注册GPS绘制回调时使用最新状态
    enhancedGpsService.onDrawRequest(async (result: any) => {
      // 每次GPS绘制请求时重新获取最新状态
      const currentMode = unifiedSessionManager.getCurrentMode();
      const hasActiveSession = unifiedSessionManager.isSessionActive();

      // 只在GPS模式或测试模式下处理
      if (currentMode !== 'gps' && currentMode !== 'test') {
        logger.debug('📍 [DEBUG] GPS绘制请求被忽略: 非GPS模式', { currentMode });
        return;
      }

      if (!hasActiveSession) {
        logger.debug('📍 [DEBUG] GPS绘制请求被忽略: 无活跃会话');
        return;
      }

      logger.info(`📍 GPS绘制请求: 坐标(${result.position.latitude.toFixed(6)}, ${result.position.longitude.toFixed(6)})`);

      try {
        const drawResult = await unifiedDrawService.drawPixel({
          lat: result.position.latitude,
          lng: result.position.longitude,
          source: 'gps',
          color: '#00FF00', // GPS使用绿色
          coordinateSystem: 'WGS84'
        });

        if (drawResult.success) {
          logger.info('✅ GPS绘制成功:', drawResult.pixel);

          // 更新绘制状态
          drawing.actions.incrementPixelCount();
          drawing.actions.recordPixel(drawResult.pixel);

          // 通知GPS服务绘制结果
          enhancedGpsService.markDrawResult(result.gridId, true);
        } else {
          logger.error('❌ GPS绘制失败:', drawResult.error);
          enhancedGpsService.markDrawResult(result.gridId, false);
        }
      } catch (error) {
        logger.error('❌ GPS绘制异常:', error);
        enhancedGpsService.markDrawResult(result.gridId, false);
      }
    });

    logger.info('✅ GPS绘制初始化完成');
  };

  /**
   * 显示绘制成功提示
   */
  const showDrawSuccessToast = (coords: { lat: number; lng: number }) => {
    // 这里可以集成Toast系统
    logger.info(`🎉 绘制成功: 坐标(${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`);
  };

  /**
   * 显示绘制错误提示
   */
  const showDrawErrorToast = (message: string) => {
    // 这里可以集成Toast系统
    logger.error(`❌ 绘制失败: ${message}`);
  };

  // ========== Map Initialization ==========

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    // Async MapLibre GL loading with error handling
    const initializeMap = async () => {
      try {
        logger.info('🔄 正在加载 MapLibre GL...');
        const maplibre = await loadMapLibreGLWithTimeout(15000); // 15 second timeout

        const map = new maplibre.Map({
          container: containerRef.current,
          style: styleUrl,
          center: initialCenter,
          zoom: initialZoom,
          minZoom: 4,
          maxZoom: 18.0, // 🔧 与 iOS 端保持一致（AppConfig.maxZoomLevel = 18.0）
          pitchWithRotate: false,
          dragRotate: false,
          // 添加防抖配置
          fadeDuration: 0,
          crossSourceCollisions: false,
          // 🔧 wplace.live 风格：禁用符号限制，确保所有像素都能显示
          enableRealtimeSymbolLimits: false
        });

        mapRef.current = map;
        isInitializedRef.current = true;

        // Continue with map initialization logic...
        logger.info('✅ MapLibre GL 初始化成功');

        // Initialize the rest of the map setup
        initializeMapLogic(map);

      } catch (error) {
        logger.error('❌ MapLibre GL 加载失败:', error);
        // Show user-friendly error
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              padding: 20px;
              text-align: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
              <h3 style="color: #ef4444; margin-bottom: 16px;">地图加载失败</h3>
              <p style="color: #6b7280; margin-bottom: 20px;">无法加载地图库，请检查网络连接后刷新页面</p>
              <button onclick="window.location.reload()" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              ">刷新页面</button>
            </div>
          `;
        }
      }
    };

    initializeMap();
  }, []); // Remove dependencies to run only once

  // Extracted map initialization logic for cleaner code
  const initializeMapLogic = (map: any) => {

    map.on('load', () => {
      logger.debug('🗺️ Map loaded, initializing PRODUCTION MVT layers...');

      // 添加OFM瓦片诊断
      const center = map.getCenter();
      logger.debug('地图中心坐标:', center);
      logger.debug('地图缩放级别:', map.getZoom());

      // 检查样式中的数据源
      const style = map.getStyle();
      if (style && style.sources) {
        logger.debug('地图样式数据源:', Object.keys(style.sources));
        if (style.sources.openmaptiles) {
          logger.debug('OFM数据源配置:', style.sources.openmaptiles);
        }
      }

      // ========== FIX: Remove 3D building layer to prevent pixel occlusion ==========
      // OpenFreeMap Liberty style has a 'building-3d' fill-extrusion layer that uses
      // WebGL depth buffer. On iOS Safari, this causes 3D buildings to visually overlap
      // pixel symbol layers despite correct style ordering. Since the map is viewed
      // top-down (pitch disabled), 3D extrusions add no value — remove them.
      if (map.getLayer('building-3d')) {
        map.removeLayer('building-3d');
        logger.debug('🏗️ Removed building-3d layer (prevents pixel occlusion on iOS)');
      }

      // ========== PRODUCTION: Initialize Sprite Loader ==========
      const spriteLoader = new SpriteLoader(map, API_BASE_URL);
      spriteLoaderRef.current = spriteLoader;
      logger.debug('✅ SpriteLoader initialized:', API_BASE_URL);

      // ========== PRODUCTION: Add Missing Image Handler ==========
      // Handle missing images dynamically by loading sprites on-demand
      // The missing image ID depends on the layer that requested it:
      // - pixels-emoji layer: emoji character (e.g., "🔥")
      // - pixels-complex layer: pattern_id or material_id (UUID format)
      map.on('styleimagemissing', (e: any) => {
        const missingId = e.id;
        logger.debug('🖼️ Missing image requested:', missingId);

        if (missingId && typeof missingId === 'string') {
          // Determine render_type based on the missing ID format

          // Handle emoji sprites - these are single unicode emoji characters
          // Emojis come from the pixels-emoji layer where render_type = 'emoji'
          // 覆盖所有常见 Unicode emoji 范围（参考 iOS 端 emojiToSpriteKey 映射）：
          // - U+1F600-1F64F: Emoticons (😀😃😄)
          // - U+1F300-1F5FF: Misc Symbols & Pictographs (🌍🌸🔥)
          // - U+1F680-1F6FF: Transport & Map (🚀🛡️)
          // - U+1F900-1F9FF: Supplemental Symbols (🧭🤖🧱)
          // - U+1FA00-1FAFF: Symbols Extended-A (🪨🪵)
          // - U+1F1E0-1F1FF: Regional Indicators (🇨🇳)
          // - U+2600-26FF: Misc Symbols (☀️⚡⚓☔)
          // - U+2700-27BF: Dingbats (✨❤️)
          // - U+2300-23FF: Misc Technical (⏰⌛)
          // - U+200D: Zero Width Joiner (emoji sequences)
          if (/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{200D}\u{FE0F}]/u.test(missingId)) {
            logger.debug('🎯 Loading emoji sprite:', missingId);
            spriteLoader.loadSprite(missingId, 'emoji', 1);
          }
          // Handle user avatar sprites - user_avatar_{userId}
          else if (missingId.startsWith('user_avatar_')) {
            logger.debug('🎯 Loading user avatar sprite:', missingId);
            // Try to load from imageUrl if available
            const imageUrl = avatarImageUrlMapRef.current.get(missingId);
            if (imageUrl) {
              logger.debug('🎯 Loading user avatar from URL:', imageUrl);
              spriteLoader.loadSpriteFromUrl(missingId, imageUrl, 1);
            } else {
              // Fallback to API endpoint (may not exist, will use green fallback)
              logger.debug('⚠️ No imageUrl for user avatar, trying API endpoint:', missingId);
              spriteLoader.loadSprite(missingId, 'complex', 1);
            }
          }
          // Handle complex sprites - these are UUIDs for pattern_id or material_id
          // Complex sprites come from the pixels-complex layer where render_type = 'complex'
          else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missingId) ||
                   missingId.startsWith('custom_flag_') ||
                   missingId.length > 10) {
            logger.debug('🎯 Loading complex sprite:', missingId);
            spriteLoader.loadSprite(missingId, 'complex', 1);
          }
          // Handle other IDs as complex sprites (fallback)
          else {
            logger.debug('🎯 Loading unknown sprite as complex:', missingId);
            spriteLoader.loadSprite(missingId, 'complex', 0);
          }
        }
      });

      // ========== PRODUCTION: Register Square Icon ==========
      // SDF 模式使 icon-color 属性生效（类似 iOS 的 .alwaysTemplate 渲染模式）
      // 没有 { sdf: true }，MapLibre GL JS 会忽略 icon-color，导致所有像素显示为白色
      const squareIcon = createSDFSquare(SDF_ICON_SIZE);
      map.addImage('sdf-square', squareIcon, { sdf: true });
      logger.debug('✅ Square icon registered:', SDF_ICON_SIZE, 'px with', SDF_PADDING, 'px padding');

      // Find label layer for z-index management
      const labelLayerId = findLabelLayerId(map);
      logger.debug('🏷️ Label layer ID:', labelLayerId || 'none (adding to top)');

      // ========== PRODUCTION: MVT Vector Source ONLY (No Raster!) ==========
      // 🔧 关键修复：添加 tileSize: 512 配置，与 iOS 端保持一致
      // 问题：Web 端缺少 tileSize 配置导致坐标投影在高 zoom (16-18) 时出现偏差
      // iOS: MLNVectorTileSource 设置了 .tileSize: 512
      // Web: vector source 需要明确指定 tileSize: 512
      const mvtSourceOptions: any = {
        type: 'vector',
        minzoom: 12,
        maxzoom: 18, // 与后端瓦片生成范围一致
        tileSize: 512, // 🔧 修复：与 iOS 端保持一致，确保坐标投影正确
        // 确保瓦片加载失败时不会导致地图崩溃
        promoteId: 'id'
      };

      // 检查是否是开发环境，如果是则使用备用瓦片
      const isDev = import.meta.env.DEV;
      if (isDev) {
        // 开发环境：添加错误处理
        mvtSourceOptions.tiles = [MVT_TILE_URL];
        mvtSourceOptions.attribution = 'FunnyPixels Production';
      } else {
        // 生产环境：使用生产配置
        mvtSourceOptions.tiles = [MVT_TILE_URL];
      }

      map.addSource('pixels-mvt', mvtSourceOptions);
      logger.debug('📡 Production MVT source added:', MVT_TILE_URL);

      // Hotpatch layer (instant updates)
      map.addSource('pixels-hotpatch', {
        type: 'geojson',
        data: createEmptyFeatureCollection()
      });
      logger.debug('⚡ Hotpatch source added');

  
      // ========== PRODUCTION: Vector Layer Stack (Base-2 Exponential Scaling) ==========
      //
      // Render order (bottom to top):
      // 1. Color pixels (SDF symbols from pixels-color source-layer)
      // 2. Emoji pixels (dynamic sprites from pixels-emoji source-layer)
      // 3. Complex pixels (dynamic sprites from pixels-complex source-layer)
      // 4. Hotpatch color pixels (SDF symbols)
      // 5. Hotpatch emoji pixels (dynamic sprites)
      // 6. Interaction layer (invisible, for click events)
      // 7. Base map labels

      // LAYER 1: Color Pixels (SDF Symbols)
      //
      // 🔧 wplace.live 风格：使用 base-2 指数插值实现像素随缩放自然连续变化
      // 像素大小随 zoom 级别翻倍：size_at_z = size_at_z0 * 2^(z - z0)
      // 关键修复：使用 icon-allow-overlap: true 避免碰撞检测导致坐标跳动
      //
      // Zoom vs Icon Size (64px base icon):
      // zoom 12: 2px  (0.03125 * 64)
      // zoom 13: 4px  (0.0625 * 64)
      // zoom 14: 8px  (0.125 * 64)
      // zoom 15: 16px (0.25 * 64)
      // zoom 16: 32px (0.5 * 64)
      // zoom 17: 64px (1.0 * 64)
      // zoom 18: 96px (1.5 * 64) - 限制最大值避免过大
      map.addLayer({
        id: 'pixels-color',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-color',
        minzoom: 12,  // 🔧 修复：显式设置最小zoom，确保17-18级别正常显示
        maxzoom: 24,  // 🔧 修复：显式设置最大zoom（MapLibre默认值）
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': [
            'interpolate',
            ['exponential', 2], // base-2 = 像素完美缩放
            ['zoom'],
            12, 0.0156,    // zoom 12: 1px (略小于网格间隔)
            13, 0.03125,   // zoom 13: 2px
            14, 0.0625,    // zoom 14: 4px
            15, 0.125,     // zoom 15: 8px
            16, 0.25,      // zoom 16: 16px
            17, 0.5,       // zoom 17: 32px
            18, 0.75       // zoom 18: 48px (限制最大值)
          ],
          'icon-allow-overlap': true, // 🔧 关键：允许重叠避免碰撞检测重排
          'icon-ignore-placement': true, // 🔧 关键：忽略放置规则
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Color layer added (base-2 exponential scaling, overlap allowed)');

      // LAYER 2: Emoji Pixels (Dynamic Sprites)
      //
      // 🔧 对齐 iOS 端 emojiScaleStops：75% of colorScaleStops（之前错误使用了 2/3）
      // iOS: emojiScaleStops = colorScaleStops * 0.75
      map.addLayer({
        id: 'pixels-emoji',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-emoji',
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': ['get', 'emoji'],
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0117,    // zoom 12: 0.75px (75% of color 0.0156)
            13, 0.0234,    // zoom 13: 1.5px
            14, 0.0469,    // zoom 14: 3px
            15, 0.09375,   // zoom 15: 6px
            16, 0.1875,    // zoom 16: 12px
            17, 0.375,     // zoom 17: 24px
            18, 0.5625     // zoom 18: 36px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Emoji layer added (base-2 exponential scaling)');

      // LAYER 3: Complex Pixels (Dynamic Sprites)
      //
      // 🔧 对齐 iOS 端：complex 层与 emoji 层使用相同的 emojiScaleStops（75% of color）
      map.addLayer({
        id: 'pixels-complex',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-complex',
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': ['coalesce', ['get', 'pattern_id'], ['get', 'material_id'], 'sdf-square'],
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0117,    // zoom 12: 0.75px (75% of color, 对齐 iOS emojiScaleStops)
            13, 0.0234,    // zoom 13: 1.5px
            14, 0.0469,    // zoom 14: 3px
            15, 0.09375,   // zoom 15: 6px
            16, 0.1875,    // zoom 16: 12px
            17, 0.375,     // zoom 17: 24px
            18, 0.5625     // zoom 18: 36px
          ],
          'icon-allow-overlap': true, // 🔧 关键：允许重叠避免碰撞检测重排
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Complex layer added (base-2 exponential scaling)');

      // LAYER 4: Advertisement Pixels
      //
      // 🔧 广告像素使用与 color 层完全一致的 icon-size（与 iOS 端 colorScaleStops 对齐）
      // 广告是由多个色块像素组成的图像，必须与普通像素等大才能无缝拼合
      map.addLayer({
        id: 'pixels-ad',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-ad',
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0156,    // zoom 12: 1px (与 pixels-color 一致)
            13, 0.03125,   // zoom 13: 2px
            14, 0.0625,    // zoom 14: 4px
            15, 0.125,     // zoom 15: 8px
            16, 0.25,      // zoom 16: 16px
            17, 0.5,       // zoom 17: 32px
            18, 0.75       // zoom 18: 48px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 0.95
        }
      }, labelLayerId);
      logger.debug('✅ Advertisement layer added (base-2 exponential scaling)');

      // LAYER 5: Hotpatch color pixels (instant updates)
      // 🔧 关键修复：icon-size 必须与 MVT 层完全一致！
      map.addLayer({
        id: 'pixels-color-hotpatch',
        type: 'symbol',
        source: 'pixels-hotpatch',
        filter: ['==', ['get', 'type'], 'color'],
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0156,    // zoom 12: 1px (与MVT层一致)
            13, 0.03125,   // zoom 13: 2px
            14, 0.0625,    // zoom 14: 4px
            15, 0.125,     // zoom 15: 8px
            16, 0.25,      // zoom 16: 16px
            17, 0.5,       // zoom 17: 32px
            18, 0.75       // zoom 18: 48px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Hotpatch color layer added (base-2 exponential scaling)');

      // LAYER 6: Hotpatch emoji pixels
      // 🔧 icon-size 与 emoji MVT 层完全一致（对齐 iOS 端 emojiScaleStops = 75% of color）
      map.addLayer({
        id: 'pixels-emoji-hotpatch',
        type: 'symbol',
        source: 'pixels-hotpatch',
        filter: ['==', ['get', 'type'], 'emoji'],
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': ['get', 'emoji'],
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0117,    // zoom 12: 0.75px (75% of color, 与MVT层一致)
            13, 0.0234,    // zoom 13: 1.5px
            14, 0.0469,    // zoom 14: 3px
            15, 0.09375,   // zoom 15: 6px
            16, 0.1875,    // zoom 16: 12px
            17, 0.375,     // zoom 17: 24px
            18, 0.5625     // zoom 18: 36px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Hotpatch emoji layer added (base-2 exponential scaling)');

      // LAYER 7: Hotpatch complex pixels
      // 🔧 icon-size 与 complex MVT 层完全一致（对齐 iOS 端 emojiScaleStops = 75% of color）
      map.addLayer({
        id: 'pixels-complex-hotpatch',
        type: 'symbol',
        source: 'pixels-hotpatch',
        filter: ['==', ['get', 'type'], 'complex'],
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': ['coalesce', ['get', 'pattern_id'], ['get', 'material_id'], 'sdf-square'],
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0117,    // zoom 12: 0.75px (75% of color, 与MVT层一致)
            13, 0.0234,    // zoom 13: 1.5px
            14, 0.0469,    // zoom 14: 3px
            15, 0.09375,   // zoom 15: 6px
            16, 0.1875,    // zoom 16: 12px
            17, 0.375,     // zoom 17: 24px
            18, 0.5625     // zoom 18: 36px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 1.0
        }
      }, labelLayerId);
      logger.debug('✅ Hotpatch complex layer added (base-2 exponential scaling)');

      // LAYER 8: Hotpatch advertisement pixels
      // 🔧 icon-size 与 MVT ad 层及 color 层完全一致（对齐 iOS 端 colorScaleStops）
      map.addLayer({
        id: 'pixels-ad-hotpatch',
        type: 'symbol',
        source: 'pixels-hotpatch',
        filter: ['==', ['get', 'type'], 'ad'],
        minzoom: 12,  // 🔧 修复：显式设置zoom范围
        maxzoom: 24,
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            12, 0.0156,    // zoom 12: 1px (与 pixels-color-hotpatch 一致)
            13, 0.03125,   // zoom 13: 2px
            14, 0.0625,    // zoom 14: 4px
            15, 0.125,     // zoom 15: 8px
            16, 0.25,      // zoom 16: 16px
            17, 0.5,       // zoom 17: 32px
            18, 0.75       // zoom 18: 48px
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 0,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map'
        },
        paint: {
          'icon-color': ['coalesce', ['get', 'color'], '#4ECDC4'],  // fallback 为默认绿色
          'icon-opacity': 0.95
        }
      }, labelLayerId);
      logger.debug('✅ Hotpatch advertisement layer added (base-2 exponential scaling)');

      // LAYER 9: Interaction layers for all pixel types (transparent, for click events)
      // 🔧 修复：使用固定值 1.0，避免动态插值，同时保持良好的点击检测区域
      // Color pixels interaction
      map.addLayer({
        id: 'pixels-color-interaction',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-color',
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': 1.0, // 🔧 修复：固定值1.0，提供良好的点击检测区域
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 0 // Invisible but clickable
        }
      }, labelLayerId);

      // Ad pixels interaction
      map.addLayer({
        id: 'pixels-ad-interaction',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-ad',
        layout: {
          'icon-image': 'sdf-square',
          'icon-size': 1.0, // 🔧 修复：固定值1.0，提供良好的点击检测区域
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 0 // Invisible but clickable
        }
      }, labelLayerId);

      // Emoji pixels interaction
      map.addLayer({
        id: 'pixels-emoji-interaction',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-emoji',
        layout: {
          'icon-image': ['get', 'emoji'],
          'icon-size': 1.0, // 🔧 修复：固定值1.0，提供良好的点击检测区域
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 0 // Invisible but clickable
        }
      }, labelLayerId);

      // Complex pixels interaction
      map.addLayer({
        id: 'pixels-complex-interaction',
        type: 'symbol',
        source: 'pixels-mvt',
        'source-layer': 'pixels-complex',
        layout: {
          'icon-image': [
            'coalesce',
            ['get', 'pattern_id'],
            ['get', 'material_id']
          ],
          'icon-size': 1.0, // 🔧 修复：固定值1.0，提供良好的点击检测区域
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 0 // Invisible but clickable
        }
      }, labelLayerId);
      logger.debug('✅ Interaction layers added (icon-size: 1.0 fixed)');

      // ========== LAYER 8: Hidden Data Loader Layers (方案C-1) ==========
      //
      // 🔥 CRITICAL: Force MapLibre GL to load ALL user properties from MVT tiles
      // MapLibre GL only loads properties that are referenced in layout/paint
      // These hidden circle layers force-load all needed properties by referencing them
      // without affecting visual rendering (visibility: none + radius: 0)
      //
      // This eliminates the need for redundant API calls to /api/pixels/info

      // Helper function to create hidden data loader layer
      const createHiddenDataLoader = (id: string, sourceLayer: string) => {
        map.addLayer({
          id,
          type: 'circle',
          source: 'pixels-mvt',
          'source-layer': sourceLayer,
          layout: {
            visibility: 'none' // Completely invisible
          },
          paint: {
            'circle-radius': 0,
            // 🔥 Force-load ALL properties by referencing them in paint
            // Each property reference forces MapLibre GL to load it from MVT
            'circle-color': [
              'case',
              // Reference all needed properties to force-load them
              ['has', ['get', 'grid_id']], ['get', 'grid_id'],
              ['has', ['get', 'user_id']], ['get', 'user_id'],
              ['has', ['get', 'username']], ['get', 'username'],
              ['has', ['get', 'avatar']], ['get', 'avatar'],
              ['has', ['get', 'avatar_url']], ['get', 'avatar_url'],
              ['has', ['get', 'alliance_id']], ['get', 'alliance_id'],
              ['has', ['get', 'alliance_name']], ['get', 'alliance_name'],
              ['has', ['get', 'alliance_flag']], ['get', 'alliance_flag'],
              ['has', ['get', 'country']], ['get', 'country'],
              ['has', ['get', 'city']], ['get', 'city'],
              ['has', ['get', 'province']], ['get', 'province'],
              '#4ECDC4' // fallback 为默认绿色
            ],
            'circle-opacity': 0
          }
        }, labelLayerId);
      };

      // Create hidden data loaders for all pixel types
      createHiddenDataLoader('pixels-color-data-loader', 'pixels-color');
      createHiddenDataLoader('pixels-emoji-data-loader', 'pixels-emoji');
      createHiddenDataLoader('pixels-complex-data-loader', 'pixels-complex');
      createHiddenDataLoader('pixels-ad-data-loader', 'pixels-ad');

      logger.info('✅ Hidden data loader layers added (方案C-1: Force-load ALL user properties from MVT)');
      logger.info('📋 这些layer将强制MapLibre GL加载: grid_id, user_id, username, avatar, avatar_url, alliance_id, alliance_name, alliance_flag, country, city, province');

      // ========== PRODUCTION: Dynamic Sprite Loading ==========
      //
      // Listen for tile loads and preload missing sprites
      // This prevents "missing image" warnings and ensures smooth rendering
      // 添加防抖以避免重复处理
      let sourceDataTimeout: any = null;
      let lastProcessedTime = 0;
      map.on('sourcedata', (e) => {
        // 处理错误状态
        if (e.sourceId === 'pixels-mvt' && e.isSourceLoaded === false && e.error) {
          logger.warn('⚠️ MVT source error:', e.error);
          // 检查是否是 null 值相关错误
          if (e.error && e.error.message && e.error.message.includes('null')) {
            logger.error('🚨 Null value error in source data - check backend data validation');
          }
          return;
        }

        const now = Date.now();
        if (e.sourceId !== 'pixels-mvt' || !e.isSourceLoaded) return;

        // 防抖处理，避免200ms内重复处理
        if (now - lastProcessedTime < 200) return;

        if (sourceDataTimeout) clearTimeout(sourceDataTimeout);
        sourceDataTimeout = setTimeout(() => {
          lastProcessedTime = Date.now();

          const features = map.querySourceFeatures('pixels-mvt');
          const missingSprites = new Set<string>();

          for (const feature of features) {
            const props = feature.properties;

            // Queue emoji sprites
            if (props.emoji && !map.hasImage(props.emoji)) {
              missingSprites.add(JSON.stringify({ key: props.emoji, type: 'emoji' }));
            }

            // Queue complex sprites
            const complexKey = props.pattern_id || props.material_id;
            if (complexKey && !map.hasImage(complexKey)) {
              // 🆕 Store imageUrl mapping for user avatars (pattern_id starting with user_avatar_)
              if (props.image_url && complexKey.startsWith('user_avatar_')) {
                avatarImageUrlMapRef.current.set(complexKey, props.image_url);
                logger.debug('🆕 Stored imageUrl mapping from MVT:', complexKey, props.image_url);
              }
              missingSprites.add(JSON.stringify({ key: complexKey, type: 'complex', imageUrl: props.image_url }));
            }
          }

          // Load missing sprites
          for (const spriteJson of missingSprites) {
            const { key, type, imageUrl } = JSON.parse(spriteJson);
            // 🆕 For user avatars with imageUrl, use loadSpriteFromUrl
            if (key.startsWith('user_avatar_') && imageUrl) {
              logger.debug('🎯 Loading user avatar from URL (MVT):', key, imageUrl);
              spriteLoader.loadSpriteFromUrl(key, imageUrl, 1);
            } else {
              spriteLoader.loadSprite(key, type);
            }
          }

          if (missingSprites.size > 0) {
            logger.debug(`🎨 Queued ${missingSprites.size} sprites for loading`);
          }
        }, 150); // 150ms 防抖
      });

      logger.debug('✅ Dynamic sprite loading enabled');

      // ========== KEY CHANGE 4: Click Interaction ==========
      //
      // Handle pixel clicks for popup/details

      // Handle clicks on all pixel types
      const pixelInteractionLayers = [
        'pixels-color-interaction',
        'pixels-ad-interaction',
        'pixels-emoji-interaction',
        'pixels-complex-interaction'
      ];

      pixelInteractionLayers.forEach(layerId => {
        map.on('click', layerId, (e) => {
          if (!e.features || e.features.length === 0) return;

          const clickedFeature = e.features[0];
          const props = clickedFeature.properties;
          const layer = clickedFeature.layer;

          if (!props) return;

          // 🔥 修复：每次像素点击时重新获取最新状态
          const currentMode = unifiedSessionManager.getCurrentMode();
          const hasActiveSession = unifiedSessionManager.isSessionActive();

          // 🎨 性能优化：在绘制模式下不处理像素点击，避免冲突
          if (currentMode === 'manual' && hasActiveSession) {
            logger.debug('🎨 绘制模式下忽略像素点击事件');
            return;
          }

          // 🔥 方案C-1: 使用 querySourceFeatures 获取完整属性
          // Hidden circle layers force MapLibre GL to load user properties from MVT
          let fullFeature = clickedFeature;

          try {
            const sourceLayer = layer['source-layer'];

            // 使用 querySourceFeatures 获取完整的属性数据
            const sourceFeatures = map.querySourceFeatures('pixels-mvt', {
              sourceLayer: sourceLayer,
              filter: ['==', ['get', 'grid_id'], props.grid_id || props.id]
            });

            if (sourceFeatures && sourceFeatures.length > 0) {
              fullFeature = sourceFeatures[0];
              logger.info('✅ [MapCanvas] 从MVT获取完整Feature:', {
                properties: fullFeature.properties,
                // 关键字段
                grid_id: fullFeature.properties.grid_id,
                user_id: fullFeature.properties.user_id,
                username: fullFeature.properties.username,
                alliance_name: fullFeature.properties.alliance_name,
                avatar_url: fullFeature.properties.avatar_url,
                city: fullFeature.properties.city,
                allKeys: Object.keys(fullFeature.properties)
              });
            } else {
              logger.warn('⚠️ querySourceFeatures 未找到匹配的feature');
            }
          } catch (error) {
            logger.error('❌ querySourceFeatures 失败:', error);
          }

          const fullProps = fullFeature.properties;

          // 🎯 调用自定义像素点击处理函数
          if (onPixelClick) {
            // 计算点击位置的屏幕坐标
            const point = map.project(e.lngLat);
            const mapContainer = map.getContainer();
            const rect = mapContainer.getBoundingClientRect();

            const screenX = rect.left + point.x;
            const screenY = rect.top + point.y;

            // 🔥 FIX: Pass full feature object instead of just properties
            // app.tsx expects a Feature object with geometry and properties
            onPixelClick(fullFeature, { x: screenX, y: screenY });
          }
        });
      });

      logger.debug('✅ Pixel click handlers registered');

      // Change cursor on hover for all interaction layers
      pixelInteractionLayers.forEach(layerId => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      setIsMapReady(true);
      isInitializedRef.current = true; // 标记已初始化

      // ========== 🔍 地图缩放事件监控 ==========
      // 用于诊断像素在不同缩放级别的显示问题
      const checkLayerVisibility = (currentZoom: number) => {
        const layers = [
          // MVT 层
          'pixels-color',           // MVT color 层
          'pixels-emoji',           // MVT emoji 层
          'pixels-complex',         // MVT complex 层
          'pixels-ad',              // MVT ad 层
          // Hotpatch 层
          'pixels-color-hotpatch',  // Hotpatch color 层
          'pixels-emoji-hotpatch',  // Hotpatch emoji 层
          'pixels-complex-hotpatch', // Hotpatch complex 层
          'pixels-ad-hotpatch'      // Hotpatch ad 层
        ];

        const visibility: any = {
          zoom: currentZoom.toFixed(2),
          timestamp: new Date().toISOString()
        };

        layers.forEach(layerId => {
          try {
            const layout = map.getLayoutProperty(layerId, 'visibility');
            const sourceId = map.getLayer(layerId).source;
            const source = map.getSource(sourceId);

            let sourceInfo = '';
            if (source) {
              const sourceType = (source as any).type;
              if (sourceType === 'vector') {
                const minZoom = (source as any).minzoom || 'N/A';
                const maxZoom = (source as any).maxzoom || 'N/A';
                sourceInfo = ` [MVT: minZoom=${minZoom}, maxZoom=${maxZoom}]`;
              } else if (sourceType === 'geojson') {
                const data = (source as any).data;
                const featureCount = data?.features?.length || 0;
                sourceInfo = ` [GeoJSON: ${featureCount} features]`;
              }
            }

            visibility[layerId] = {
              visibility: layout,
              source: sourceId + sourceInfo
            };
          } catch (e) {
            visibility[layerId] = { error: 'Layer not found' };
          }
        });

        return visibility;
      };

      // 缩放开始
      map.on('zoomstart', () => {
        const zoom = map.getZoom();
        logger.info(`🔍 ========== 缩放开始 ==========`, {
          zoom: zoom.toFixed(2),
          layerVisibility: checkLayerVisibility(zoom)
        });
      });

      // 缩放进行中（高频触发）
      map.on('zoom', () => {
        const zoom = map.getZoom();
        // 只在关键缩放点输出日志（避免刷屏）
        const zoomKey = Math.floor(zoom * 10) / 10; // 保留1位小数
        const lastLoggedZoom = (map as any)._lastLoggedZoom || -1;

        if (zoomKey !== lastLoggedZoom) {
          (map as any)._lastLoggedZoom = zoomKey;
          logger.info(`🔍 缩放中: zoom=${zoom.toFixed(2)}`, {
            zoom: zoom.toFixed(2),
            layerVisibility: checkLayerVisibility(zoom)
          });
        }
      });

      // 缩放结束
      map.on('zoomend', () => {
        const zoom = map.getZoom();
        const isProblematicZoom = zoom >= 17 && zoom <= 18;

        if (isProblematicZoom) {
          logger.error(`🚨 ========== 问题缩放级别检测: ${zoom.toFixed(2)} ==========`);
        }

        logger.info(`🔍 ========== 缩放结束 ==========`, {
          zoom: zoom.toFixed(2),
          isProblematicZoom,
          bounds: map.getBounds(),
          center: map.getCenter(),
          layerVisibility: checkLayerVisibility(zoom)
        });

        // 检查 MVT source 的瓦片加载状态
        const mvtSource = map.getSource('pixels-mvt');
        if (mvtSource) {
          const sourceCaches = (map.style as any).sourceCaches;
          const mvtCache = sourceCaches?.['pixels-mvt'];
          if (mvtCache) {
            const tiles = Object.keys(mvtCache._tiles || {});
            const loadedTiles = tiles.filter(tileId => {
              const tile = mvtCache._tiles[tileId];
              return tile && tile.loaded && !tile.loading;
            });

            // 🔧 在zoom 17-18时，检查瓦片内容
            if (zoom >= 17 && zoom <= 18) {
              logger.error(`🚨 [ZOOM ${zoom.toFixed(2)}] MVT 瓦片详细状态:`, {
                total: tiles.length,
                loaded: loadedTiles.length,
                loading: tiles.length - loadedTiles.length,
                tileIds: tiles
              });

              // 查询所有source-layer中的features
              const allSourceLayers = ['pixels-color', 'pixels-emoji', 'pixels-complex', 'pixels-ad'];
              allSourceLayers.forEach(sourceLayer => {
                const features = map.querySourceFeatures('pixels-mvt', { sourceLayer });
                logger.error(`🚨 [ZOOM ${zoom.toFixed(2)}] ${sourceLayer} features:`, {
                  count: features.length,
                  sampleFeature: features[0]?.properties
                });
              });
            } else {
              logger.info(`📊 MVT 瓦片状态`, {
                total: tiles.length,
                loaded: loadedTiles.length,
                loading: tiles.length - loadedTiles.length
              });
            }
          }
        }

        // 🔍 详细检查 Hotpatch source 的状态
        const hotpatchSource = map.getSource('pixels-hotpatch');
        if (hotpatchSource) {
          // GeoJSON source 使用 _data 内部属性存储数据
          const data = (hotpatchSource as any)._data;
          const featureCount = data?.features?.length || 0;

          // 检查每个特征的详细信息
          const featureDetails: any[] = [];
          if (data?.features) {
            data.features.forEach((f: any, index: number) => {
              featureDetails.push({
                index,
                id: f.properties?.id,
                type: f.properties?.type,
                coordinates: f.geometry?.coordinates,
                color: f.properties?.color
              });
            });
          }

          logger.info(`📊 Hotpatch 详细状态`, {
            zoom: zoom.toFixed(2),
            featureCount: featureCount,
            sourceType: 'geojson',
            features: featureDetails
          });

          // 🔧 特别诊断：zoom 16-18 范围（原16-17范围已扩展）
          // 注意：featureCount: 0 是正常的，表示没有新绘制的像素
          // 只有当 MVT 瓦片加载失败时才会有问题
          if (zoom >= 16 && zoom <= 18) {
            logger.debug(`🔍 Zoom 范围 16-18 检查: ${zoom.toFixed(2)}`, {
              featureCount,
              hasFeatures: featureCount > 0,
              dataExists: !!data,
              featuresArray: Array.isArray(data?.features)
            });

            // 检查是否在视口内（只有当有特征时才检查）
            if (data?.features && data.features.length > 0) {
              const bounds = map.getBounds();
              data.features.forEach((f: any, idx: number) => {
                const coords = f.geometry?.coordinates;
                if (coords) {
                  const inBounds = (
                    coords[0] >= bounds._sw.lng && coords[0] <= bounds._ne.lng &&
                    coords[1] >= bounds._sw.lat && coords[1] <= bounds._ne.lat
                  );
                  logger.info(`📍 特征 ${idx} 坐标检查`, {
                    id: f.properties?.id,
                    coordinates: coords,
                    inBounds,
                    bounds: {
                      sw: { lng: bounds._sw.lng, lat: bounds._sw.lat },
                      ne: { lng: bounds._ne.lng, lat: bounds._ne.lat }
                    }
                  });
                }
              });
            }
          }

          // 🔍 检查 hotpatch 图层的实际渲染状态
          const hotpatchLayers = ['pixels-color-hotpatch', 'pixels-emoji-hotpatch', 'pixels-complex-hotpatch', 'pixels-ad-hotpatch'];
          hotpatchLayers.forEach(layerId => {
            try {
              const visibility = map.getLayoutProperty(layerId, 'visibility');
              const iconSize = map.getLayoutProperty(layerId, 'icon-size');
              const iconOpacity = map.getPaintProperty(layerId, 'icon-opacity');

              // 计算 icon-size 的实际值
              let calculatedIconSize = 'N/A';
              if (Array.isArray(iconSize) && iconSize[0] === 'interpolate') {
                // 这是一个插值表达式，无法直接计算，但可以记录配置
                calculatedIconSize = '[interpolated expression]';
              }

              logger.info(`🔍 Hotpatch 图层 ${layerId}`, {
                visibility,
                iconSize: calculatedIconSize,
                iconOpacity,
                zoom: zoom.toFixed(2)
              });
            } catch (e) {
              logger.error(`❌ 检查图层 ${layerId} 失败:`, e);
            }
          });
        }
      });

      logger.debug('✅ 缩放事件监听器已注册');

      // Performance monitoring for full pixel display
      if (import.meta.env.DEV) {
        // Monitor tile loading performance
        let tileLoadTimes: number[] = [];

        map.on('tileload', (e: any) => {
          const now = performance.now();
          const currentZoom = map.getZoom();
          const isProblematicZoom = currentZoom >= 17 && currentZoom <= 18;

          // 🔧 特别监控zoom 17-18的瓦片加载
          if (isProblematicZoom && e.sourceId === 'pixels-mvt') {
            logger.error(`🚨 [ZOOM ${currentZoom.toFixed(2)}] MVT瓦片加载:`, {
              sourceId: e.sourceId,
              tileId: e.tile?.tileID,
              coord: e.tile?.coord,
              url: e.tile?.url,
              loaded: e.tile?.loaded,
              state: e.tile?.state
            });
          }

          if (e.tile && e.tile.loadTime) {
            tileLoadTimes.push(e.tile.loadTime);
            if (tileLoadTimes.length > 100) tileLoadTimes.shift();

            const avg = tileLoadTimes.reduce((a, b) => a + b, 0) / tileLoadTimes.length;
            logger.debug(`🔍 Tile load performance: avg=${avg.toFixed(2)}ms, current=${e.tile.loadTime.toFixed(2)}ms`);
          }
        });

        // Monitor visible tiles at zoom 12-17 - 添加防抖
        let moveEndTimeout: any = null;
        map.on('moveend', () => {
          if (moveEndTimeout) clearTimeout(moveEndTimeout);
          moveEndTimeout = setTimeout(() => {
            const zoom = map.getZoom();
            if (zoom >= 12 && zoom <= 18) {
              // 使用我们配置的sourceId
              const sourceId = 'pixels-mvt';
              const tiles = Object.keys(map.style?.sourceCaches?.[sourceId]?._tiles || {});
              logger.debug(`🎯 Full pixel display: zoom=${zoom.toFixed(2)}, visible tiles=${tiles.length}`);
            }
          }, 100); // 100ms 防抖
        });

        // Warn if approaching max zoom - 添加防抖
        let zoomEndTimeout: any = null;
        map.on('zoomend', () => {
          if (zoomEndTimeout) clearTimeout(zoomEndTimeout);
          zoomEndTimeout = setTimeout(() => {
            const zoom = map.getZoom();
            if (zoom > 17.5) {
              logger.warn(`⚠️ Approaching max zoom (${zoom.toFixed(2)}/18). Performance may degrade.`);
            }
          }, 200); // 200ms 防抖
        });
      }

      // 🎨 初始化绘制系统
      if (enableDrawing) {
        const cleanup = initializeDrawingSystem(map);
        if (cleanup) {
          drawingCleanupRef.current = cleanup;
        }
      }

      if (onMapReady) {
        onMapReady(map);
      }

      logger.debug('🎉 Map initialization complete!');
    }); // Close map.on('load')

    // 添加瓦片错误处理，防止地图无限重试
    map.on('tileerror', (e) => {
      logger.warn('⚠️ Tile load error:', {
        sourceId: e.sourceId,
        tileUrl: e.tile?.url,
        error: e.error?.message || e.error,
        coord: e.tile?.coord
      });

      // 特别处理OFM瓦片错误
      if (e.sourceId === 'openmaptiles') {
        logger.error('❌ OFM瓦片加载失败:', {
          url: e.tile?.url,
          error: e.error
        });
      }

      if (e.sourceId === 'pixels-mvt') {
        logger.warn('⚠️ MVT tile load error:', e.tile?.url, e.error);
        // 检查是否是 null 值相关错误
        if (e.error && e.error.message && e.error.message.includes('null')) {
          logger.error('🚨 Null value error detected - check backend MVT generation');
        }
      }
    });

    // 添加数据源错误监听
    map.on('error', (e) => {
      logger.error('❌ Map error:', {
        error: e.error?.message || e.error,
        sourceId: e.sourceId
      });

      // 检查是否是OFM相关错误
      if (e.error && (e.error.message?.includes('openfreemap') || e.error.message?.includes('tile'))) {
        logger.error('❌ OFM相关错误，可能需要检查网络连接或使用代理');
      }
    });

    
    // 添加数据层错误处理
    map.on('data', (e) => {
      if (e.sourceId === 'pixels-mvt' && e.isSourceLoaded) {
        // 数据加载成功，检查是否有数据
        const source = map.getSource('pixels-mvt');
        if (source) {
          logger.debug('✅ MVT source loaded successfully');
        }
      }
    });

    // Cleanup on unmount
    return () => {
      if (hotpatchTimerRef.current) {
        clearTimeout(hotpatchTimerRef.current);
      }
      if (spriteLoaderRef.current) {
        spriteLoaderRef.current.destroy();
      }
      if (drawingCleanupRef.current) {
        drawingCleanupRef.current();
        drawingCleanupRef.current = null;
      }
      map.remove();
    };
  }; // Close initializeMapLogic function

  // ========== KEY CHANGE 5: Hotpatch Batching ==========
  //
  // WebSocket updates are batched to limit setData() calls.
  // Why? Each setData() triggers GL buffer updates, which are expensive.
  //
  // Strategy:
  // 1. Accumulate updates in hotpatchQueue
  // 2. Schedule a flush after HOTPATCH_BATCH_INTERVAL ms
  // 3. Flush combines all pending updates into single setData() call
  //
  // Performance target: ≤1 setData per animation frame @ 60 FPS
  // At 60 FPS, each frame = 16.67ms. With 50ms batch interval,
  // we get ~3 frames per batch = ~20 updates/sec.

  useEffect(() => {
    if (!isMapReady || !enableHotpatch) return;

    const map = mapRef.current;
    if (!map) return;

    logger.debug('⚡ Subscribing to tile updates...');

    // 🔥 修复：建立 WebSocket 连接
    // 必须先连接才能接收到实时瓦片更新
    try {
      tileUpdateSubscriber.connect(map);
      logger.info('✅ WebSocket 连接已建立，等待实时更新...');
    } catch (error) {
      logger.error('❌ WebSocket 连接失败:', error);
      // 连接失败不影响订阅设置，继续执行
    }

    // Subscribe to WebSocket tile updates
    // Note: tileUpdateSubscriber provides PixelUpdate[] directly, not wrapped in object
    const unsubscribe = tileUpdateSubscriber.subscribe((pixels: any[]) => {
      logger.info('🔥 MapCanvas: 收到像素更新', {
        pixelsCount: pixels.length,
        pixels: pixels.map(p => ({ id: p.id, type: p.type, lat: p.lat, lng: p.lng, color: p.color }))
      });

      if (!pixels || pixels.length === 0) return;

      // Convert pixels to MapPixel format, then to PixelFeature
      const mapPixels: MapPixel[] = pixels.map(p => ({
        id: p.id,
        type: p.type,
        lng: p.lng,
        lat: p.lat,
        color: p.color,
        emoji: p.emoji,
        imageUrl: p.imageUrl,
        updatedAt: p.updatedAt || new Date().toISOString()
      }));

      logger.info('🔄 MapCanvas: 转换为 MapPixel', {
        mapPixelsCount: mapPixels.length,
        mapPixels: mapPixels.map(p => ({ id: p.id, type: p.type, lat: p.lat, lng: p.lat }))
      });

      // 🆕 Extract imageUrl mappings for user avatars before conversion
      mapPixels.forEach(pixel => {
        if (pixel.type === 'complex' && pixel.patternId && pixel.imageUrl) {
          // Store mapping for user avatars (patternId starts with user_avatar_)
          if (pixel.patternId.startsWith('user_avatar_')) {
            avatarImageUrlMapRef.current.set(pixel.patternId, pixel.imageUrl);
            logger.debug('🆕 Stored imageUrl mapping from hotpatch:', pixel.patternId, pixel.imageUrl);
          }
        }
      });

      // Convert MapPixel to PixelFeature
      const features = mapPixels.map(pixelToFeature);

      // Add to queue
      hotpatchQueue.current.push(...features);

      // Schedule flush if not already scheduled
      if (!hotpatchTimerRef.current) {
        hotpatchTimerRef.current = setTimeout(flushHotpatch, HOTPATCH_BATCH_INTERVAL);
      }
    });

    // Flush function: Update hotpatch source with batched features
    const flushHotpatch = () => {
      hotpatchTimerRef.current = null;

      const queue = hotpatchQueue.current;
      if (queue.length === 0) return;

      // Dedup by ID (keep latest update for each pixel)
      const dedupMap = new Map<string, PixelFeature>();
      for (const feature of queue) {
        if (feature.properties?.id) {
          dedupMap.set(feature.properties.id, feature);
        }
      }

      const dedupedFeatures = Array.from(dedupMap.values());

      // Limit batch size to prevent memory spikes
      const batch = dedupedFeatures.slice(0, HOTPATCH_MAX_BATCH_SIZE);

      // Update source
      const source = map.getSource('pixels-hotpatch') as any;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: batch
        });

        logger.debug('⚡ Hotpatch flushed:', batch.length, 'pixels');
      }

      // Clear queue
      hotpatchQueue.current = [];
    };

    return () => {
      logger.debug('⚡ Unsubscribing from tile updates');
      unsubscribe();
      // 🔥 修复：断开 WebSocket 连接
      tileUpdateSubscriber.disconnect();
      logger.debug('🔌 WebSocket 连接已断开');
    };
  }, [isMapReady, enableHotpatch]);

  // ========== Drawing State Monitoring ==========
  //
  // 监听绘制状态变化，实时更新鼠标样式
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    const map = mapRef.current;

    // 🔥 修复：根据最新的绘制状态更新鼠标样式，而不是闭包中的旧值
    const updateMouseStyle = () => {
      const currentMode = unifiedSessionManager.getCurrentMode();
      const hasActiveSession = unifiedSessionManager.isSessionActive();

      if (currentMode === 'manual' && hasActiveSession) {
        // 手动绘制激活状态：使用十字准星绘制图标
        map.getCanvas().style.cursor = 'crosshair';
        logger.debug('🎨 鼠标样式已更新为: crosshair (手动绘制激活)');
      } else {
        // 非绘制状态：恢复默认样式
        map.getCanvas().style.cursor = '';
        logger.debug('🎨 鼠标样式已恢复为默认');
      }
    };

    // 立即更新一次
    updateMouseStyle();

    // 监听绘制状态变化
    const unsubscribe = unifiedSessionManager.subscribe(() => {
      updateMouseStyle();
    });

    return () => {
      unsubscribe();
    };
  }, [isMapReady]);


  // ========== Render ==========

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0
      }}
    />
  );
}
