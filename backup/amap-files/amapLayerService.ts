import { logger } from '../utils/logger';
// import { SakuraPatternDebugger } from '../utils/debugSakuraPattern'; // 已移除，避免在生产环境加载测试代码
import { PixelAPI } from './api';
import { patternCache } from '../patterns/patternCache';
import { tileRenderCache, TilePixel } from './tileRenderCache';
import { materialLoaderService } from './materialLoaderService';

// WebGL imports
import {
  WebGLPixelService,
  type WebGLServiceConfig
} from './webgl';
import { PatternPreprocessor } from './webgl/PatternPreprocessor';
import { UnifiedTextureAtlas } from './webgl/UnifiedTextureAtlas';
import { WebGLPixelRenderer } from './webgl/WebGLPixelRenderer-v2';  // 🆕 使用 v2 版本（支持 Emoji Atlas）

// 图层配置 - 简化版本
interface LayerConfig {
  minZoom: number;
  maxZoom: number;
  baseGridSize: number; // 基础网格大小（度）
  basePixelSize: number; // 基础像素大小（度）
  baseEmojiSize: number; // 基础emoji大小（像素）
  clusterRadius: number;
  updateInterval: number;
}

// 像素数据缓存 - 增强版本
interface PixelCache {
  [gridId: string]: {
    grid_id: string;
    lat: number;
    lng: number;
    color: string;
    pattern?: string;
    pattern_id?: string;
    pattern_anchor_x?: number;
    pattern_anchor_y?: number;
    pattern_rotation?: number;
    pattern_mirror?: boolean;
    user_id?: string;
    timestamp: number;
    isEmoji?: boolean;
    renderType?: 'color' | 'emoji' | 'complex' | 'pattern' | 'image';
    isGPSTrackPixel?: boolean;
    accessCount?: number;
    lastAccessed?: number;
    // 🔧 新增：广告像素识别字段
    pixel_type?: string; // 像素类型: 'normal' | 'bomb' | 'advertisement' | 'custom_flag'
    related_id?: string; // 关联ID（广告ID、自定义旗帜ID、炸弹ID等）
    // 🔧 新增：渲染相关字段
    render_type?: 'color' | 'emoji' | 'complex'; // 渲染类型
    unicode_char?: string; // Unicode字符（emoji类型）
    material_id?: string; // 材质ID（complex类型）
    encoding?: string; // 编码信息
    payload?: any; // 载荷数据
    // 新增：智能缓存字段
    cachePriority: number; // 缓存优先级 (1-10)
    accessFrequency: number; // 访问频率
    spatialLocality: number; // 空间局部性评分
    temporalLocality: number; // 时间局部性评分
    predictionScore: number; // 预测评分
    isPredicted: boolean; // 是否为预测性加载
  };
}

// 用户行为分析引擎接口
interface UserBehaviorEngine {
  // 移动模式识别
  movementPattern: 'exploratory' | 'browsing' | 'focused';
  // 行为评分
  behaviorScore: number;
  // 移动轨迹
  movementTrajectory: Array<{ lat: number; lng: number; timestamp: number }>;
  // 常用区域
  frequentAreas: Array<{ bounds: any; visitCount: number; lastVisit: number }>;
}

// 智能缓存策略接口
interface SmartCacheStrategy {
  // 分层缓存
  layers: {
    hot: Set<string>;      // 热点数据 (最近访问)
    warm: Set<string>;     // 温数据 (经常访问)
    cold: Set<string>;     // 冷数据 (偶尔访问)
    predicted: Set<string>; // 预测数据
  };
  // 缓存统计
  stats: {
    hitRate: number;
    missRate: number;
    evictionCount: number;
    predictionAccuracy: number;
  };
}

// 预测性加载引擎接口
interface PredictiveLoadingEngine {
  // 移动轨迹分析
  trajectoryAnalysis: {
    direction: number;      // 移动方向 (角度)
    speed: number;          // 移动速度
    acceleration: number;   // 加速度
    pattern: string;        // 移动模式
  };
  // 预加载队列
  preloadQueue: Array<{ gridId: string; priority: number; timestamp: number }>;
  // 预测准确率
  accuracy: number;
}

/**
 * 高德地图图层服务 - 智能分层缓存优化版本
 * 基于高德地图2.0的图层系统，实现高效的像素数据管理
 * 支持智能缓存、用户行为分析、预测性加载等高级功能
 */
import { emojiFontLoader } from './emojiFontLoader';

export class AmapLayerService {
  private map: any;
  private pixelLayer: any;
  private pixelCache: PixelCache = {};
  private updateTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private lastBounds: any = null;
  private lastCenter: any = null;
  private markerPool: any[] = [];
  private maxPoolSize = 500; // 增加对象池大小，提升性能
  private forceKeepPixels = false;
  private isOptimizationPaused = false; // 智能优化暂停状态
  
  // 🔧 修复:取消注释 lastZoom,用于检测缩放级别变化
  private lastZoom: number | null = null; // 记录上次缩放级别
  // private lastPixelSize: number = 0.0001;
  // private lastEmojiSize: number = 18;
  
  // emoji元素缓存 - 按大小分组缓存，避免重复创建，限制缓存大小提升性能
  private emojiElementCache: Map<number, HTMLElement> = new Map();
  private emojiSizeCache: Map<number, {size: number, fontSize: number, borderRadius: number, borderWidth: number}> = new Map();
  private maxEmojiCacheSize = 100; // 限制emoji缓存大小，防止内存泄漏

    
  // 渲染系统已迁移至WebGL，提供GPU加速性能
  
  // 新增：智能系统组件
  private userBehaviorEngine!: UserBehaviorEngine;
  private smartCacheStrategy!: SmartCacheStrategy;
  private predictiveLoadingEngine!: PredictiveLoadingEngine;
  
  // 新增：性能监控
  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkRequests: 0,
    renderTime: 0,
    memoryUsage: 0
  };
  
  // 🔧 修复：像素格子配置 - 遵循地球画布规格（4万亿格子，每格0.0001度≈11m×11m=121平方米）
  private config: LayerConfig = {
    minZoom: 12,    // 最小缩放级别 - 仅在12-20级显示像素（避免低缩放级别加载过多数据）
    maxZoom: 20,    // 最大缩放级别（提升到20，支持更精细的像素级别）
    baseGridSize: 0.0001,    // ✅ 正确：每个像素格子0.0001度（约11米，121平方米）
    basePixelSize: 0.0001,   // ✅ 正确：基础像素大小0.0001度（与网格对齐）
    baseEmojiSize: 18,       // 基础emoji大小：18像素
    clusterRadius: 50,
    updateInterval: 1000
  };

  // WebGL渲染系统
  private webglService: WebGLPixelService | null = null;
  private webglRenderer: WebGLPixelRenderer | null = null;
  private patternPreprocessor: PatternPreprocessor | null = null;
  private webglLayer: any = null;
  private lastMapWarnTime: number = 0;
  private renderMode: 'webgl' = 'webgl'; // 仅使用WebGL渲染
  private webglInitialized = false;
  private isInitializingWebGL = false; // 防止并发初始化

  // 新增：像素点击回调函数
  private onPixelClickCallback?: (pixelData: any, clientX: number, clientY: number) => void;

  // 新增：初始化就绪状态
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;

  constructor(map: any) {
    this.map = map;
    logger.info('🔧 创建智能AmapLayerService实例，地图对象:', !!map);

    // 初始化智能系统组件
    this.initializeSmartSystems();

    // 初始化自定义emoji转换器
    this.initializeCustomEmojiConverter();

    // 🚀 重构：同步初始化核心组件
    this.initPixelLayer();
    this.safeInitializeWebGL();

    logger.info('🔧 智能AmapLayerService核心初始化完成，pixelLayer状态:', !!this.pixelLayer);

    // 🔧 强制Canvas创建：确保即使WebGL初始化失败，Canvas也能被创建
    setTimeout(async () => {
      const existingCanvas = document.getElementById('webgl-pixel-layer');
      if (!existingCanvas && this.map) {
        logger.warn('🔧 Canvas不存在，强制创建基础Canvas');
        await this.recreateWebGLCanvas();
      }
    }, 2000);

    // 标记为就绪
    this.isReady = true;

    // 只将真正的后台任务放到延迟中
    setTimeout(() => {
      this.startSmartOptimizationLoop();
    }, 1000);
  }

  /**
   * 初始化智能系统组件
   */
  private initializeSmartSystems() {
    // 初始化用户行为分析引擎
    this.userBehaviorEngine = {
      movementPattern: 'browsing',
      behaviorScore: 0.5,
      movementTrajectory: [],
      frequentAreas: []
    };

    // 初始化智能缓存策略
    this.smartCacheStrategy = {
      layers: {
        hot: new Set<string>(),
        warm: new Set<string>(),
        cold: new Set<string>(),
        predicted: new Set<string>()
      },
      stats: {
        hitRate: 0,
        missRate: 0,
        evictionCount: 0,
        predictionAccuracy: 0
      }
    };

    // 初始化预测性加载引擎
    this.predictiveLoadingEngine = {
      trajectoryAnalysis: {
        direction: 0,
        speed: 0,
        acceleration: 0,
        pattern: 'stationary'
      },
      preloadQueue: [],
      accuracy: 0.7
    };

    logger.info('🧠 智能系统组件初始化完成');
  }

  /**
   * 初始化自定义emoji转换器
   */
  private async initializeCustomEmojiConverter() {
    try {
      // 动态导入并设置为全局可用
      const { customEmojiConverter } = await import('../utils/customEmojiConverter');
      (window as any).customEmojiConverter = customEmojiConverter;
      logger.info('✅ 自定义emoji转换器初始化完成');
    } catch (error) {
      logger.error('❌ 自定义emoji转换器初始化失败:', error);
    }
  }

  /**
   * 启动智能优化循环
   */
  private startSmartOptimizationLoop() {
    // 每5秒执行一次智能优化
    setInterval(() => {
      // 🔧 修复：改进地图状态检查逻辑
      if (this.map && this.isMapReady()) {
        this.executeSmartOptimizationInternal();
      } else {
        logger.info('⏳ 等待地图初始化完成...');
      }
    }, 5000);

    // 每30秒执行一次缓存清理
    setInterval(() => {
      // 检查地图是否可用
      if (this.map) {
        this.executeSmartCacheCleanup();
      }
    }, 30000);

    logger.info('🔄 智能优化循环已启动');
  }

  /**
   * 暂停智能优化（用于GPS操作等需要稳定地图状态的场景）
   */
  public pauseOptimization() {
    this.isOptimizationPaused = true;
    logger.info('⏸️ 图层服务智能优化已暂停');
  }

  /**
   * 恢复智能优化
   */
  public resumeOptimization() {
    this.isOptimizationPaused = false;
    logger.info('▶️ 图层服务智能优化已恢复');
  }

  /**
   * 执行智能优化（公共方法，供外部调用）
   */
  public executeSmartOptimization() {
    this.executeSmartOptimizationInternal();
  }

  /**
   * 检查地图是否真正准备就绪
   */
  private isMapReady(): boolean {
    if (!this.map) {
      logger.info('🔍 地图状态检查: 地图实例不存在');
      return false;
    }
    
    try {
      // 🔧 修复：高德地图API的getStatus()返回的是配置对象，不是加载状态
      // 我们需要通过其他方式检查地图是否真正加载完成
      
      // 检查地图中心点是否有效 - 添加更安全的检查
      let center;
      try {
        center = this.map.getCenter();
        logger.info('🔍 地图状态检查: center =', center, 'type:', typeof center);
        
        // 🔧 修复：检查center是否为有效的坐标对象
        if (!center || typeof center !== 'object' || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
          logger.info('🔍 地图状态检查: 中心点不是有效的坐标对象', center);
          return false;
        }
      } catch (centerError) {
        logger.info('🔍 地图状态检查: 无法获取中心点，地图可能还在初始化中', centerError);
        return false;
      }
      
      if (!center || isNaN(center.lat) || isNaN(center.lng)) {
        logger.info('🔍 地图状态检查: 中心点无效', center);
        return false;
      }
      
      // 检查缩放级别是否有效 - 添加更安全的检查
      let zoom;
      try {
        zoom = this.map.getZoom();
        logger.info('🔍 地图状态检查: zoom =', zoom);
      } catch (zoomError) {
        logger.info('🔍 地图状态检查: 无法获取缩放级别，地图可能还在初始化中');
        return false;
      }
      
      if (typeof zoom !== 'number' || isNaN(zoom)) {
        logger.info('🔍 地图状态检查: 缩放级别无效', zoom);
        return false;
      }
      
      // 检查地图容器是否存在且可见
      const container = this.map.getContainer();
      if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
        logger.info('🔍 地图状态检查: 地图容器无效或不可见');
        return false;
      }
      
      // 检查地图是否已经渲染了瓦片
      try {
        const bounds = this.map.getBounds();
        if (!bounds || !bounds.getSouthWest() || !bounds.getNorthEast()) {
          logger.info('🔍 地图状态检查: 地图边界无效');
          return false;
        }
      } catch (boundsError) {
        logger.info('🔍 地图状态检查: 无法获取地图边界，地图可能还在加载中');
        return false;
      }
      
      logger.info('✅ 地图状态检查: 地图已准备就绪');
      return true;
    } catch (error) {
      logger.warn('⚠️ 地图状态检查失败:', error);
      return false;
    }
  }

  /**
   * 执行智能优化（内部方法）
   */
  private executeSmartOptimizationInternal() {
    // 🔧 修复：检查优化是否被暂停
    if (this.isOptimizationPaused) {
      return;
    }
    
    try {
      // 更新用户行为分析
      this.updateUserBehaviorAnalysis();
      
      // 优化缓存策略
      this.optimizeCacheStrategy();
      
      // 执行预测性预加载
      this.executePredictivePreload();
      
      // 更新性能指标
      this.updatePerformanceMetrics();
      
      logger.info('🧠 智能优化执行完成');
    } catch (error) {
      logger.error('智能优化执行失败:', error);
    }
  }

  /**
   * 更新用户行为分析
   */
  private updateUserBehaviorAnalysis() {
    if (!this.map) return;

    try {
      const center = this.map.getCenter();
      
      // 🔧 修复：验证地图中心点坐标有效性，防止NaN错误
      if (!center || isNaN(center.lat) || isNaN(center.lng) || 
          center.lat < -90 || center.lat > 90 || 
          center.lng < -180 || center.lng > 180) {
        logger.warn('⚠️ 地图中心点无效，跳过用户行为分析更新:', center);
        return;
      }
      
      let zoom = this.map.getZoom();
      if (zoom > this.config.maxZoom) zoom = this.config.maxZoom;
      const now = Date.now();

      // 添加当前位置到轨迹
      this.userBehaviorEngine.movementTrajectory.push({
        lat: center.lat,
        lng: center.lng,
        timestamp: now
      });

      // 保持轨迹长度在合理范围内
      if (this.userBehaviorEngine.movementTrajectory.length > 100) {
        this.userBehaviorEngine.movementTrajectory = this.userBehaviorEngine.movementTrajectory.slice(-50);
      }

      // 分析移动模式
      this.analyzeMovementPattern();

      // 更新常用区域
      this.updateFrequentAreas(center, zoom);

      // 计算行为评分
      this.calculateBehaviorScore();

    } catch (error) {
      logger.error('更新用户行为分析失败:', error);
    }
  }

  /**
   * 分析移动模式
   */
  private analyzeMovementPattern() {
    const trajectory = this.userBehaviorEngine.movementTrajectory;
    if (trajectory.length < 3) return;

    try {
      // 计算移动速度和方向
      const recent = trajectory.slice(-3);
      const speed1 = this.calculateDistance(recent[0], recent[1]);
      const speed2 = this.calculateDistance(recent[1], recent[2]);
      
      const speed = (speed1 + speed2) / 2;
      const acceleration = Math.abs(speed2 - speed1);
      
      // 更新移动分析
      this.predictiveLoadingEngine.trajectoryAnalysis.speed = speed;
      this.predictiveLoadingEngine.trajectoryAnalysis.acceleration = acceleration;

      // 判断移动模式
      if (speed > 0.001) { // 快速移动
        this.userBehaviorEngine.movementPattern = 'exploratory';
      } else if (speed > 0.0001) { // 缓慢移动
        this.userBehaviorEngine.movementPattern = 'browsing';
      } else { // 静止
        this.userBehaviorEngine.movementPattern = 'focused';
      }

      // 计算移动方向
      if (recent.length >= 2) {
        const direction = this.calculateDirection(recent[recent.length - 2], recent[recent.length - 1]);
        this.predictiveLoadingEngine.trajectoryAnalysis.direction = direction;
      }

      logger.info(`🗺️ 移动模式分析: ${this.userBehaviorEngine.movementPattern}, 速度: ${speed.toFixed(6)}, 加速度: ${acceleration.toFixed(6)}`);

    } catch (error) {
      logger.error('分析移动模式失败:', error);
    }
  }

  /**
   * 计算两点间距离
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const latDiff = point2.lat - point1.lat;
    const lngDiff = point2.lng - point1.lng;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  }

  /**
   * 计算移动方向
   */
  private calculateDirection(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const latDiff = to.lat - from.lat;
    const lngDiff = to.lng - from.lng;
    return Math.atan2(latDiff, lngDiff) * 180 / Math.PI;
  }

  /**
   * 更新常用区域
   */
  private updateFrequentAreas(center: any, zoom: number) {
    const now = Date.now();
    const bounds = this.map.getBounds();
    
    // 检查是否在现有常用区域内
    let found = false;
    this.userBehaviorEngine.frequentAreas.forEach(area => {
      if (this.isPointInBounds(center, area.bounds)) {
        area.visitCount++;
        area.lastVisit = now;
        found = true;
      }
    });

    // 如果不在现有区域内，添加新区域
    if (!found) {
      this.userBehaviorEngine.frequentAreas.push({
        bounds: bounds,
        visitCount: 1,
        lastVisit: now
      });

      // 保持常用区域数量在合理范围内
      if (this.userBehaviorEngine.frequentAreas.length > 10) {
        this.userBehaviorEngine.frequentAreas.sort((a, b) => b.visitCount - a.visitCount);
        this.userBehaviorEngine.frequentAreas = this.userBehaviorEngine.frequentAreas.slice(0, 8);
      }
    }
  }

  /**
   * 检查点是否在边界内
   */
  private isPointInBounds(point: any, bounds: any): boolean {
    if (!bounds || !bounds.getNorthEast || !bounds.getSouthWest) return false;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    return point.lat <= ne.lat && point.lat >= sw.lat && 
           point.lng <= ne.lng && point.lng >= sw.lng;
  }

  /**
   * 计算行为评分
   */
  private calculateBehaviorScore() {
    let score = 0.5; // 基础评分

    // 基于移动模式调整评分
    switch (this.userBehaviorEngine.movementPattern) {
      case 'exploratory':
        score += 0.2; // 探索型用户，增加缓存保留
        break;
      case 'browsing':
        score += 0.1; // 浏览型用户，适度缓存
        break;
      case 'focused':
        score -= 0.1; // 聚焦型用户，减少缓存
        break;
    }

    // 基于常用区域调整评分
    const recentAreas = this.userBehaviorEngine.frequentAreas.filter(
      area => Date.now() - area.lastVisit < 5 * 60 * 1000 // 5分钟内访问
    );
    score += Math.min(recentAreas.length * 0.05, 0.2);

    // 基于访问频率调整评分
    const totalVisits = this.userBehaviorEngine.frequentAreas.reduce((sum, area) => sum + area.visitCount, 0);
    score += Math.min(totalVisits * 0.01, 0.1);

    this.userBehaviorEngine.behaviorScore = Math.max(0, Math.min(1, score));
  }

  /**
   * 优化缓存策略
   */
  private optimizeCacheStrategy() {
    try {
      const now = Date.now();
      const cacheEntries = Object.entries(this.pixelCache);

      // 清空所有缓存层
      this.smartCacheStrategy.layers.hot.clear();
      this.smartCacheStrategy.layers.warm.clear();
      this.smartCacheStrategy.layers.cold.clear();
      this.smartCacheStrategy.layers.predicted.clear();

      // 重新分类像素到不同缓存层
      cacheEntries.forEach(([gridId, pixel]) => {
        const priority = this.calculateCachePriority(pixel, now);
        pixel.cachePriority = priority;

        if (priority >= 8) {
          this.smartCacheStrategy.layers.hot.add(gridId);
        } else if (priority >= 5) {
          this.smartCacheStrategy.layers.warm.add(gridId);
        } else if (priority >= 2) {
          this.smartCacheStrategy.layers.cold.add(gridId);
        }

        if (pixel.isPredicted) {
          this.smartCacheStrategy.layers.predicted.add(gridId);
        }
      });

      // 更新缓存统计
      this.updateCacheStats();

      logger.info(`📊 缓存策略优化完成: 热点=${this.smartCacheStrategy.layers.hot.size}, 温点=${this.smartCacheStrategy.layers.warm.size}, 冷点=${this.smartCacheStrategy.layers.cold.size}`);

    } catch (error) {
      logger.error('优化缓存策略失败:', error);
    }
  }

  /**
   * 计算缓存优先级
   */
  private calculateCachePriority(pixel: any, now: number): number {
    let priority = 1; // 基础优先级

    // 访问频率权重 (40%)
    if (pixel.accessCount) {
      priority += Math.min(pixel.accessCount * 0.5, 4);
    }

    // 最近访问时间权重 (30%)
    if (pixel.lastAccessed) {
      const timeDiff = now - pixel.lastAccessed;
      if (timeDiff < 60000) { // 1分钟内
        priority += 3;
      } else if (timeDiff < 300000) { // 5分钟内
        priority += 2;
      } else if (timeDiff < 900000) { // 15分钟内
        priority += 1;
      }
    }

    // 空间局部性权重 (20%)
    if (pixel.spatialLocality) {
      priority += pixel.spatialLocality * 2;
    }

    // 特殊类型权重 (10%)
    if (pixel.isGPSTrackPixel) {
      priority += 2; // GPS轨迹像素优先级更高
    }
    if (pixel.isEmoji || pixel.pattern_id) {
      priority += 1; // 特殊渲染类型优先级更高
    }

    return Math.min(10, Math.max(1, Math.round(priority)));
  }

  /**
   * 更新缓存统计
   */
  private updateCacheStats() {
    const totalRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    
    if (totalRequests > 0) {
      this.smartCacheStrategy.stats.hitRate = this.performanceMetrics.cacheHits / totalRequests;
      this.smartCacheStrategy.stats.missRate = this.performanceMetrics.cacheMisses / totalRequests;
    }
  }

  /**
   * 执行预测性预加载
   */
  private async executePredictivePreload() {
    try {
      // 检查地图是否可用
      if (!this.map) {
        logger.info('⏳ 地图未初始化，跳过预测性预加载');
        return;
      }
      
      // 🔧 临时禁用预测性预加载，避免边界计算错误导致广告像素无法显示
      logger.debug('⚠️ 预测性预加载已临时禁用');
      return;

      if (this.userBehaviorEngine.movementPattern === 'focused') {
        return; // 聚焦状态不进行预加载
      }

      // 基于移动轨迹预测下一个可能访问的区域
      const predictedAreas = this.predictNextAreas();
      
      if (predictedAreas.length === 0) return;

      logger.info(`🔮 预测性预加载: ${predictedAreas.length} 个区域`);

      // 异步预加载，不阻塞主线程
      setTimeout(async () => {
        for (const area of predictedAreas) {
          try {
            await this.preloadArea(area);
          } catch (error) {
            logger.warn('预加载区域失败:', error);
          }
        }
      }, 0);

    } catch (error) {
      logger.error('执行预测性预加载失败:', error);
    }
  }

  /**
   * 预测下一个可能访问的区域
   */
  private predictNextAreas(): any[] {
    const areas: any[] = [];
    
    try {
      if (this.userBehaviorEngine.movementPattern === 'exploratory') {
        // 探索型移动：预测更大范围的区域
        const currentBounds = this.map.getBounds();
        const direction = this.predictiveLoadingEngine.trajectoryAnalysis.direction;
        const speed = this.predictiveLoadingEngine.trajectoryAnalysis.speed;
        
        // 基于移动方向和速度预测
        const predictionDistance = Math.min(speed * 10, 0.01); // 最大预测距离
        
        // 预测四个方向的区域
        const directions = [0, 90, 180, 270]; // 北、东、南、西
        directions.forEach(dir => {
          const angleDiff = Math.abs(direction - dir);
          if (angleDiff < 45 || angleDiff > 315) { // 方向相近
            const predictedBounds = this.calculatePredictedBounds(currentBounds, dir, predictionDistance);
            areas.push(predictedBounds);
          }
        });
      } else if (this.userBehaviorEngine.movementPattern === 'browsing') {
        // 浏览型移动：预测常用区域
        this.userBehaviorEngine.frequentAreas.forEach(area => {
          if (Date.now() - area.lastVisit < 10 * 60 * 1000) { // 10分钟内访问过
            areas.push(area.bounds);
          }
        });
      }

    } catch (error) {
      logger.error('预测下一个区域失败:', error);
    }

    return areas;
  }

  /**
   * 计算预测边界
   */
  private calculatePredictedBounds(currentBounds: any, direction: number, distance: number): any {
    try {
      const AMap = (window as any).AMap;
      if (!AMap) return currentBounds;

      const ne = currentBounds.getNorthEast();
      const sw = currentBounds.getSouthWest();
      const center = currentBounds.getCenter();

      // 根据方向计算偏移
      const rad = (direction * Math.PI) / 180;
      const latOffset = Math.cos(rad) * distance;
      const lngOffset = Math.sin(rad) * distance;

      const newCenter = new AMap.LngLat(center.lng + lngOffset, center.lat + latOffset);
      
      // 创建预测边界
      const predictedBounds = new AMap.Bounds(
        [sw.lng + lngOffset, sw.lat + latOffset],
        [ne.lng + lngOffset, ne.lat + latOffset]
      );

      return predictedBounds;

    } catch (error) {
      logger.error('计算预测边界失败:', error);
      return currentBounds;
    }
  }

  /**
   * 预加载区域
   */
  private async preloadArea(bounds: any) {
    try {
      // 检查地图是否可用
      if (!this.map) {
        logger.warn('⚠️ 地图未初始化，跳过预加载');
        return;
      }

      let zoom = this.map.getZoom();
      if (zoom > this.config.maxZoom) zoom = this.config.maxZoom;

      // 获取区域内的像素数据
      const pixels = await this.getVisiblePixelsEfficient(bounds, zoom);

      // 🔧 关键修复：确保 pixels 是数组
      if (!Array.isArray(pixels)) {
        logger.warn('⚠️ 预加载返回的不是有效数组:', pixels);
        return;
      }

      if (pixels.length === 0) {
        logger.debug('🔮 预加载区域无像素数据');
        return;
      }

      // 标记为预测性加载
      pixels.forEach(pixel => {
        if (pixel && pixel.grid_id && this.pixelCache[pixel.grid_id]) {
          this.pixelCache[pixel.grid_id].isPredicted = true;
          this.pixelCache[pixel.grid_id].predictionScore = 0.7; // 预测评分
        }
      });

      // 更新缓存
      await this.updatePixelCache(pixels);

      logger.info(`🔮 预加载完成: ${pixels.length} 个像素`);

    } catch (error) {
      logger.error('预加载区域失败:', error);
    }
  }

  /**
   * 执行智能缓存清理
   */
  private executeSmartCacheCleanup() {
    try {
      const now = Date.now();
      const maxCacheSize = 10000; // 最大缓存大小
      const cacheEntries = Object.entries(this.pixelCache);

      if (cacheEntries.length <= maxCacheSize) {
        return; // 缓存大小正常，无需清理
      }

      logger.info(`🧹 开始智能缓存清理: ${cacheEntries.length} -> ${maxCacheSize}`);

      // 按优先级排序
      cacheEntries.sort((a, b) => {
        const priorityA = a[1].cachePriority || 1;
        const priorityB = b[1].cachePriority || 1;
        return priorityB - priorityA;
      });

      // 保留高优先级像素，移除低优先级像素
      const pixelsToKeep = cacheEntries.slice(0, maxCacheSize);
      const pixelsToRemove = cacheEntries.slice(maxCacheSize);

      // 清空缓存
      this.pixelCache = {};

      // 重新添加高优先级像素
      pixelsToKeep.forEach(([gridId, pixel]) => {
        this.pixelCache[gridId] = pixel;
      });

      // 从图层中移除低优先级像素
      pixelsToRemove.forEach(([gridId]) => {
        const overlay = this.pixelLayer?.overlays.get(gridId);
        if (overlay) {
          this.removeOverlayFromMap(overlay);
          this.pixelLayer.overlays.delete(gridId);
        }
      });

      // 更新统计
      this.smartCacheStrategy.stats.evictionCount += pixelsToRemove.length;

      logger.info(`✅ 智能缓存清理完成: 保留${pixelsToKeep.length}个, 移除${pixelsToRemove.length}个`);

    } catch (error) {
      logger.error('执行智能缓存清理失败:', error);
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics() {
    // 计算内存使用
    this.performanceMetrics.memoryUsage = Object.keys(this.pixelCache).length;
    
    // 计算缓存命中率
    const totalRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    if (totalRequests > 0) {
      this.smartCacheStrategy.stats.hitRate = this.performanceMetrics.cacheHits / totalRequests;
      this.smartCacheStrategy.stats.missRate = this.performanceMetrics.cacheMisses / totalRequests;
    }

    // 输出性能报告
    if (totalRequests % 100 === 0 && totalRequests > 0) {
      logger.info(`📊 性能报告: 缓存命中率=${(this.smartCacheStrategy.stats.hitRate * 100).toFixed(1)}%, 内存使用=${this.performanceMetrics.memoryUsage}个像素`);
    }
  }

  /**
   * 获取智能缓存统计
   */
  public getSmartCacheStats() {
    return {
      cacheLayers: {
        hot: this.smartCacheStrategy.layers.hot.size,
        warm: this.smartCacheStrategy.layers.warm.size,
        cold: this.smartCacheStrategy.layers.cold.size,
        predicted: this.smartCacheStrategy.layers.predicted.size
      },
      cacheStats: this.smartCacheStrategy.stats,
      userBehavior: {
        pattern: this.userBehaviorEngine.movementPattern,
        score: this.userBehaviorEngine.behaviorScore,
        frequentAreasCount: this.userBehaviorEngine.frequentAreas.length
      },
      prediction: {
        accuracy: this.predictiveLoadingEngine.accuracy,
        queueSize: this.predictiveLoadingEngine.preloadQueue.length
      },
      performance: this.performanceMetrics
    };
  }

  /**
   * 智能像素查询 - 优先使用缓存
   */
  private async getPixelsWithSmartCache(bounds: any, zoom: number): Promise<any[]> {
    try {
      // 检查缓存命中
      const cachedPixels = this.getCachedPixelsInBounds(bounds);
      
      if (cachedPixels.length > 0) {
        this.performanceMetrics.cacheHits++;
        logger.info(`🎯 缓存命中: ${cachedPixels.length} 个像素`);
        return cachedPixels;
      }

      // 缓存未命中，从网络获取
      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.networkRequests++;
      
      const startTime = Date.now();
      const pixels = await this.getVisiblePixelsEfficient(bounds, zoom);
      this.performanceMetrics.renderTime += Date.now() - startTime;

      logger.info(`🌐 网络请求: ${pixels.length} 个像素`);
      return pixels;

    } catch (error) {
      logger.error('智能像素查询失败:', error);
      return [];
    }
  }

  /**
   * 获取边界内的缓存像素
   */
  private getCachedPixelsInBounds(bounds: any): any[] {
    const cachedPixels: any[] = [];
    
    try {
      if (!bounds || !bounds.getNorthEast || !bounds.getSouthWest) return cachedPixels;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      Object.values(this.pixelCache).forEach(pixel => {
        if (pixel.lat <= ne.lat && pixel.lat >= sw.lat && 
            pixel.lng <= ne.lng && pixel.lng >= sw.lng) {
          cachedPixels.push(pixel);
        }
      });

    } catch (error) {
      logger.error('获取缓存像素失败:', error);
    }

    return cachedPixels;
  }

  /**
   * 更新地图对象引用
   */
  public updateMap(map: any) {
    this.map = map;
    logger.info('🔧 更新AmapLayerService地图对象:', !!map);
  }

  /**
   * 设置像素点击回调函数
   */
  public setPixelClickCallback(callback: (pixelData: any, clientX: number, clientY: number) => void) {
    this.onPixelClickCallback = callback;
    logger.info('🔧 像素点击回调函数已设置');
  }

  /**
   * 等待图层服务完全就绪
   */
  public async waitForReady(): Promise<boolean> {
    const maxWait = 10000; // 10秒超时
    const startTime = Date.now();

    while (!this.isReady && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const isReady = this.isReady;
    if (isReady) {
      logger.info('✅ 图层服务已就绪');
    } else {
      logger.error('❌ 图层服务初始化超时');
    }

    return isReady;
  }

  /**
   * 检查图层服务是否已就绪
   */
  public isLayerReady(): boolean {
    return this.isReady && !!this.pixelLayer;
  }

  /**
   * 触发像素图层更新（公共方法）
   */
  public async triggerUpdate() {
    if (this.isUpdating || !this.map) {
      logger.info('🔄 像素更新已在进行中或地图未初始化，跳过更新');
      return;
    }
    
    logger.info('🔄 手动触发像素图层更新...');
    await this.updateVisiblePixels();
  }

  /**
   * 初始化像素图层
   * 只支持WebGL渲染方案
   */
  private initPixelLayer() {
    if (!this.map) {
      logger.error('❌ 地图对象未初始化，无法创建像素图层');
      return;
    }

    if (!(window as any).AMap) {
      logger.error('❌ 高德地图API未加载，无法创建像素图层');
      return;
    }

    // 检查地图是否完全准备好
    if (!this.map.add || typeof this.map.add !== 'function') {
      logger.error('❌ 地图add方法未准备好，无法创建像素图层');
      return;
    }

    const AMap = (window as any).AMap;

    try {
      // 使用简化的覆盖物管理方式
      this.pixelLayer = {
        overlays: new Map(),
        add: (overlay: any) => {
          this.map.add(overlay);
          return overlay;
        },
        remove: (overlay: any) => {
          this.map.remove(overlay);
        },
                 setVisible: (visible: boolean) => {
           // 设置所有覆盖物的可见性
           this.pixelLayer.overlays.forEach((overlay: any) => {
             if (overlay.setVisible) {
               overlay.setVisible(visible);
             }
           });
         },
                 setOpacity: (opacity: number) => {
           // 设置所有覆盖物的透明度
           this.pixelLayer.overlays.forEach((overlay: any) => {
             if (overlay.setOpacity) {
               overlay.setOpacity(opacity);
             }
           });
         },
        redraw: () => {
          // 触发地图重绘
          // 取消自动fitView，避免用户拖动后视窗被拉回
        },
        getVisible: () => true
      };

      // 🔧 修复：添加关键的事件监听器以确保页面刷新后像素自动加载
      this.setupMapEventListeners();

      logger.info('✅ 高德地图像素图层初始化成功（WebGL专用模式）');
    } catch (error) {
      logger.error('❌ 初始化像素图层失败:', error);
    }
  }

  
  /**
   * 获取像素大小 - 根据缩放级别动态调整，确保像素可见性
   */
  private getPixelSize(): number {
    // ✅ 使用标准像素尺寸：0.0001度（约11米×11米）
    // 这个地理大小固定，屏幕显示大小会随zoom自动缩放
    return this.config.baseGridSize; // 0.0001度
  }

  /**
   * 获取自定义图案的显示尺寸 - 与像素格子大小保持一致
   * 🔧 修复：使用与网格像素相同的地理尺寸，而不是屏幕像素数值
   */
  private getCustomPatternDisplaySize(): number {
    // 🎯 关键修复：复杂图案应该与正常像素使用相同的地理尺寸
    // 这样确保复杂图案严格限制在0.0001度的像素格子内
    const pixelSize = this.getPixelSize(); // 返回地理度数，如0.0001度

    logger.debug(`📐 复杂图案大小修正: 使用像素格子尺寸 ${pixelSize}度 (约${(pixelSize * 111000).toFixed(1)}米)`);
    return pixelSize;
  }

  /**
   * 将地理度数转换为屏幕像素 - 🔧 修复：简化计算，确保像素大小统一
   * 每个像素格子固定为0.0001度（约11m），屏幕像素大小根据缩放级别线性变化
   */
  private convertGeographicToScreenPixels(geographicSize: number): number {
    try {
      const zoom = this.map.getZoom();

      // 🔧 修复：使用高德地图标准分辨率公式
      // 在zoom级别下，每度对应的屏幕像素数
      const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;

      // 🔧 修复：直接计算，不添加额外的scale或补偿
      // geographicSize = 0.0001度时，在zoom=18时约为 73px
      const screenPixels = geographicSize * pixelsPerDegree;

      // 确保最小1像素可见
      const finalSize = Math.max(1, Math.round(screenPixels));

      logger.debug(
        `🔢 地理度数转屏幕像素: ${geographicSize}° -> ${finalSize}px (zoom=${zoom}, pixelsPerDegree=${pixelsPerDegree.toFixed(1)})`
      );
      return finalSize;
    } catch (error) {
      logger.warn("计算屏幕像素大小失败:", error);
      return 8; // 默认值（约zoom=18时的0.0001度）
    }
  }


  /**
   * 获取emoji大小 - 🔧 修复：根据zoom级别动态缩放emoji大小
   * 与后端瓦片渲染的算法保持一致
   */
  private getEmojiSize(): number {
    const zoom = this.map ? this.map.getZoom() : 16;

    // 🔧 修复：emoji大小应该约等于0.0001度格子的屏幕像素大小
    // 核心原则：emoji应完全在格子内，不溢出到相邻格子
    //
    // 计算公式：
    // 1. 0.0001度在当前zoom下的屏幕像素 = 0.0001 * (256 * 2^zoom) / 360
    // 2. emoji大小 = 格子屏幕大小 * 0.85 (留出15%边距)
    //
    // 示例计算（已验证）：
    // zoom 12: 格子屏幕 ≈ 0.29px  → emoji = 4px (最小值)
    // zoom 14: 格子屏幕 ≈ 1.17px  → emoji = 4px (最小值)
    // zoom 16: 格子屏幕 ≈ 4.66px  → emoji = 4px
    // zoom 17: 格子屏幕 ≈ 9.32px  → emoji = 8px
    // zoom 18: 格子屏幕 ≈ 18.64px → emoji = 16px（占85.8%，不溢出）

    const gridSizeInDegrees = 0.0001; // 格子大小（度）
    const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
    const gridScreenSize = gridSizeInDegrees * pixelsPerDegree;

    // emoji大小约为格子屏幕大小的85%，确保不溢出到相邻格子
    // 最小值4px确保可见性，最大值18px（约等于zoom 18时的格子大小）
    const emojiSize = Math.min(18, Math.max(4, Math.round(gridScreenSize * 0.85)));

    logger.info(`📏 getEmojiSize: zoom=${zoom.toFixed(2)}, 格子屏幕=${gridScreenSize.toFixed(1)}px, emoji=${emojiSize}px (${((emojiSize/gridScreenSize)*100).toFixed(0)}%)`);

    return emojiSize;
  }

  /**
   * 获取emoji样式缓存 - 高性能版本，避免重复计算
   */
  private getEmojiStyleCache(emojiSize: number): {size: number, fontSize: number, borderRadius: number, borderWidth: number} {
    // 四舍五入到整数，减少缓存条目数量
    const roundedSize = Math.round(emojiSize);
    
    // 检查缓存
    if (this.emojiSizeCache.has(roundedSize)) {
      return this.emojiSizeCache.get(roundedSize)!;
    }
    
    // 计算样式
    const fontSize = Math.max(8, Math.min(24, emojiSize * 0.8));
    const borderRadius = Math.max(2, emojiSize * 0.15);
    const borderWidth = Math.max(1, emojiSize * 0.08);
    
    const styleCache = {
      size: emojiSize,
      fontSize,
      borderRadius,
      borderWidth
    };
    
    // 缓存结果，限制缓存大小
    if (this.emojiSizeCache.size < 20) {
      this.emojiSizeCache.set(roundedSize, styleCache);
    }
    
    return styleCache;
  }

  /**
   * 清理emoji缓存 - 防止内存泄漏
   */
  private clearEmojiCache(): void {
    this.emojiElementCache.clear();
    this.emojiSizeCache.clear();
    logger.info('🧹 已清理emoji缓存');
  }

  /**
   * 获取当前渲染模式状态
   */
  public getRenderingMode(): 'webgl' | 'dom' {
    if (this.renderMode === 'webgl' && this.webglInitialized) {
      return 'webgl';
    }
    return 'dom'; // WebGL未初始化时的默认渲染方式
  }

  /**
   * 安全初始化WebGL渲染系统
   */
  public async safeInitializeWebGL(): Promise<void> {
    logger.info('🚀🔥🔥🔥 SAFE INITIALIZE WebGL CALLED 🔥🔥🔥🚀'); // 明显的调试日志

    // 防止重复初始化
    if (this.webglInitialized) {
      logger.debug('⏭️ WebGL已初始化，跳过重复初始化');
      return;
    }

    // 防止并发初始化
    if (this.isInitializingWebGL) {
      logger.debug('⏭️ WebGL正在初始化中，跳过重复调用');
      return;
    }

    if (!this.map) {
      logger.warn('⚠️ 地图未准备好，延迟WebGL初始化');
      setTimeout(() => this.safeInitializeWebGL(), 1000);
      return;
    }

    try {
      // 检查地图是否完全加载
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();

      if (!center || zoom === undefined) {
        logger.warn('⚠️ 地图状态不完整，延迟WebGL初始化', { center, zoom });
        setTimeout(() => this.safeInitializeWebGL(), 1000);
        return;
      }

      logger.info('✅ 地图状态检查通过，开始初始化WebGL渲染系统', {
        centerLat: center.lat,
        centerLng: center.lng,
        zoom
      });

      // 设置初始化标志
      this.isInitializingWebGL = true;

      // ✅ 关键修复：等待异步初始化完成
      await this.initializeWebGLRendering();

      logger.info('🎉 WebGL渲染系统初始化成功！');
    } catch (error) {
      logger.error('❌ WebGL初始化过程失败:', error);

      // 清理失败的资源
      this.cleanupWebGLResources();

      // 不再无限重试，避免创建太多WebGL上下文
      logger.error('❌ WebGL初始化彻底失败，停止重试');
    } finally {
      // 无论成功失败都重置初始化标志
      this.isInitializingWebGL = false;
    }
  }

  /**
   * 获取像素的渲染类型
   */
  private getRenderType(pixel: any): 'color' | 'emoji' | 'complex' {
    if (pixel.render_type) {
      return pixel.render_type;
    }

    // 根据pattern信息推断渲染类型
    if (pixel.pattern_id && pixel.pattern_id.startsWith('material_')) {
      return 'complex';
    } else if (pixel.unicode_char) {
      return 'emoji';
    } else if (pixel.pattern_id && pixel.pattern_id.startsWith('emoji_')) {
      return 'emoji';
    } else {
      return 'color';
    }
  }

  /**
   * 重新创建WebGL Canvas（如果丢失）
   */
  private async recreateWebGLCanvas(): Promise<void> {
    try {
      logger.warn('🔄 开始重新创建WebGL Canvas...');

      if (!this.map || !this.webglService) {
        logger.error('❌ 无法重新创建Canvas: 地图或WebGL服务不存在');
        return;
      }

      const mapContainer = this.map.getContainer();
      if (!mapContainer) {
        logger.error('❌ 无法重新创建Canvas: 地图容器不存在');
        return;
      }

      // 移除可能存在的旧Canvas
      const oldCanvas = document.getElementById('webgl-pixel-layer');
      if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
        logger.info('🗑️ 旧Canvas已移除');
      }

      // 创建新Canvas
      const newCanvas = document.createElement('canvas');
      const mapSize = this.map.getSize();
      newCanvas.id = 'webgl-pixel-layer';
      newCanvas.width = mapSize.width;
      newCanvas.height = mapSize.height;
      newCanvas.style.position = 'absolute';
      newCanvas.style.top = '0px';
      newCanvas.style.left = '0px';
      newCanvas.style.pointerEvents = 'none';
      newCanvas.style.zIndex = '1200'; // 确保在所有地图图层之上
      newCanvas.style.display = 'block';
      newCanvas.style.visibility = 'visible';
      newCanvas.style.backgroundColor = 'transparent'; // 透明背景，确保像素可见

      mapContainer.appendChild(newCanvas);
      logger.info('✅ 新WebGL Canvas已重新创建并添加到地图容器');

      // 重新初始化WebGL服务（如果需要）
      if (this.webglService) {
        // 🔧 关键修复：WebGL Canvas重新创建后重新加载像素数据
        logger.info('🎨 WebGL服务准备就绪，重新加载像素数据...');

        // 从缓存重新加载像素到WebGL
        const cachedPixels = Object.values(this.pixelCache);
        if (cachedPixels.length > 0) {
          logger.info(`🔄 重新加载 ${cachedPixels.length} 个缓存像素到WebGL...`);

          // 转换缓存像素为WebGL格式并重新添加
          const webglPixels = cachedPixels.map(pixel => ({
            gridId: pixel.grid_id,
            lat: pixel.lat,
            lng: pixel.lng,
            patternKey: pixel.pattern_id || pixel.pattern || pixel.color || '#ffffff',
            renderType: this.getRenderType(pixel),
            color: pixel.color
          }));

          // 批量添加到WebGL服务
          await this.webglService.addBatchPixels(webglPixels);

          logger.info(`✅ 已重新加载 ${webglPixels.length} 个像素到WebGL`);

          // 立即渲染一帧
          this.renderWebGLFrame();
        } else {
          logger.info('ℹ️ 缓存中没有像素数据');
        }
      }

    } catch (recreateError) {
      logger.error('❌ 重新创建Canvas失败:', recreateError);
    }
  }

  /**
   * 清理WebGL资源
   */
  private cleanupWebGLResources(): void {
    try {
      // 清理WebGL服务
      if (this.webglService) {
        this.webglService.dispose();
        this.webglService = null;
        logger.info('🗑️ WebGL渲染器已清理');
      }

      // 🔧 修复：清理定时器和WebGL层
      if (this.webglLayer && (this.webglLayer as any).renderInterval) {
        clearInterval((this.webglLayer as any).renderInterval);
        logger.info('🗑️ WebGL渲染定时器已清理');
      }

      // 清理WebGL层引用
      this.webglLayer = null;

      // 从DOM中移除WebGL Canvas
      const webglCanvas = document.getElementById('webgl-pixel-layer');
      if (webglCanvas && webglCanvas.parentNode) {
        webglCanvas.parentNode.removeChild(webglCanvas);
        logger.info('🗑️ WebGL Canvas已从DOM移除');
      }

      this.webglInitialized = false;
      logger.info('🗑️ WebGL资源已清理');
    } catch (error) {
      logger.warn('⚠️ 清理WebGL资源时出错:', error);
    }
  }

  /**
   * 获取渲染性能统计
   */
  public getRenderingStats(): { mode: string, pixelCount: number, cacheSize: number } {
    return {
      mode: this.getRenderingMode(),
      pixelCount: Object.keys(this.pixelCache).length,
      cacheSize: Object.keys(this.pixelCache).length
    };
  }

  /**
   * 初始化WebGL渲染系统 - 高性能GPU渲染
   */
  private async initializeWebGLRendering(): Promise<void> {
    try {
      logger.info('🚀 开始初始化WebGL渲染系统');

      // 🔍 详细检测WebGL支持
      logger.info('🔍 第一步：检测基础WebGL支持...');
      const testCanvas = document.createElement('canvas');
      // 🔧 关键修复：必须设置canvas尺寸，否则某些浏览器会拒绝创建WebGL context
      testCanvas.width = 1;
      testCanvas.height = 1;

      const testGl = testCanvas.getContext('webgl2') as WebGL2RenderingContext | null ||
                     testCanvas.getContext('webgl') as WebGLRenderingContext | null ||
                     testCanvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

      if (!testGl) {
        logger.error('❌ WebGL不支持，无法初始化渲染系统');
        logger.error('详细信息：canvas.getContext返回null');
        logger.error('Canvas信息:', {
          width: testCanvas.width,
          height: testCanvas.height,
          inDOM: document.body.contains(testCanvas)
        });
        logger.error('浏览器信息:', {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
          hardwareConcurrency: navigator.hardwareConcurrency
        });
        throw new Error('WebGL is not supported');
      }

      const isWebGL2 = testGl instanceof WebGL2RenderingContext;
      logger.info('✅ WebGL支持检测通过:', {
        webgl2: isWebGL2,
        webgl: !isWebGL2,
        version: testGl.getParameter(testGl.VERSION),
        vendor: testGl.getParameter(testGl.VENDOR),
        renderer: testGl.getParameter(testGl.RENDERER),
        maxTextureSize: testGl.getParameter(testGl.MAX_TEXTURE_SIZE)
      });

      // 🔍 测试：详细日志WebGLPixelService初始化
      logger.info('🔍 第三步：初始化WebGLPixelService...');

      // 初始化WebGL服务
      const webglConfig: WebGLServiceConfig = {
        maxPixels: 200000, // 增加到20万个像素，确保充足的渲染空间
        enableLOD: true,
        debug: true
      };

      logger.info('🔍 第二步：创建WebGL Canvas...');
      // 创建WebGL Canvas
      const webglCanvas = document.createElement('canvas');
      const mapSize = this.map.getSize();
      webglCanvas.width = mapSize.width;
      webglCanvas.height = mapSize.height;

      // 🔧 关键修复：设置Canvas的CSS尺寸，确保正确显示
      webglCanvas.style.position = 'absolute';
      webglCanvas.style.top = '0px';
      webglCanvas.style.left = '0px';
      webglCanvas.style.width = mapSize.width + 'px';  // 🔧 设置CSS宽度
      webglCanvas.style.height = mapSize.height + 'px'; // 🔧 设置CSS高度
      webglCanvas.style.pointerEvents = 'none';
      webglCanvas.style.zIndex = '125';  // 🔧 提高z-index确保在其他元素之上
      webglCanvas.style.display = 'block'; // 🔧 确保显示
      webglCanvas.style.visibility = 'visible'; // 🔧 确保可见

      logger.info('🔧 WebGL Canvas尺寸设置:', {
        实际宽度: webglCanvas.width,
        实际高度: webglCanvas.height,
        CSS宽度: webglCanvas.style.width,
        CSS高度: webglCanvas.style.height,
        地图尺寸: mapSize
      });
      webglCanvas.style.backgroundColor = 'transparent'; // 🔧 透明背景，确保像素可见
      webglCanvas.id = 'webgl-pixel-layer';

      logger.info('🔍 Canvas配置:', {
        width: webglCanvas.width,
        height: webglCanvas.height,
        style: webglCanvas.style.cssText
      });

      // ✅ 关键修复：将Canvas添加到地图容器中
      const mapContainer = this.map.getContainer();
      if (mapContainer) {
        // 创建一个专用的WebGL容器层，避免被高德地图DOM操作影响
        let webglContainer = document.getElementById('webgl-container');
        if (!webglContainer) {
          webglContainer = document.createElement('div');
          webglContainer.id = 'webgl-container';
          webglContainer.style.position = 'absolute';
          webglContainer.style.top = '0px';
          webglContainer.style.left = '0px';
          webglContainer.style.width = '100%';
          webglContainer.style.height = '100%';
          webglContainer.style.pointerEvents = 'none';
          webglContainer.style.zIndex = '125';
          webglContainer.style.overflow = 'hidden';
          mapContainer.appendChild(webglContainer);
          logger.info('✅ WebGL容器层已创建');
        }

        webglContainer.appendChild(webglCanvas);
        logger.info('✅ WebGL Canvas已添加到专用容器中');

        // 🔧 使用更稳定的验证策略
        const validateCanvas = () => {
          const addedCanvas = document.getElementById('webgl-pixel-layer');
          if (addedCanvas && mapContainer.contains(addedCanvas)) {
            logger.info('✅ Canvas验证成功: 存在于DOM中', {
              在地图容器中: mapContainer.contains(addedCanvas),
              父元素: addedCanvas.parentElement?.tagName,
              CSS样式: addedCanvas.style.cssText,
              可见性: addedCanvas.offsetParent !== null,
              zIndex: addedCanvas.style.zIndex
            });
            return true;
          } else {
            logger.warn('⚠️ Canvas验证失败，尝试重新添加');
            // 重新添加Canvas到容器
            if (webglContainer && addedCanvas) {
              webglContainer.appendChild(addedCanvas);
            }
            return false;
          }
        };

        // 立即验证一次
        if (validateCanvas()) {
          // 🔧 设置持续监控，但使用更长的间隔
          const canvasMonitor = setInterval(() => {
            const canvas = document.getElementById('webgl-pixel-layer');
            if (!canvas || !mapContainer.contains(canvas)) {
              logger.warn('⚠️ WebGL Canvas被意外移除，尝试重新创建');
              validateCanvas(); // 尝试重新添加
            }
          }, 5000); // 增加到5秒间隔

          // 30秒后停止监控
          setTimeout(() => clearInterval(canvasMonitor), 30000);
        }

      } else {
        throw new Error('无法获取地图容器');
      }

      logger.info('🔍 第三步：初始化WebGLPixelService...');

      try {
        // 初始化WebGL服务
        this.webglService = new WebGLPixelService(webglCanvas, webglConfig);
        logger.info('✅ WebGLPixelService实例创建成功');

        logger.info('🔍 第四步：调用WebGLPixelService.initialize()...');
        const webglInitialized = await this.webglService.initialize();

        if (!webglInitialized) {
          logger.error('❌ WebGL服务初始化失败：initialize()返回false');
          throw new Error('WebGL service initialization failed');
        }

        logger.info('✅ WebGLPixelService初始化成功');
      } catch (serviceError) {
        logger.error('❌ WebGLPixelService初始化过程出错:', serviceError);
        throw serviceError;
      }

      // PatternPreprocessor已在WebGLPixelService中初始化

      logger.info('🔧 开始创建WebGL渲染层...');

      // 🔧 修复：使用更简单的方式创建WebGL渲染层
      // 不依赖AMap.CustomLayer，直接使用WebGL渲染
      try {
        // 捕获当前实例的引用，避免作用域问题
        const self = this;

        // 创建一个简单的覆盖物来触发WebGL渲染
        const webglOverlay = {
          // 基础属性
          zIndex: 120,
          visible: true,

          // 渲染回调
          render: () => {
            const currentTime = Date.now();

            // 🔧 关键修复：使用self而不是this
            if (self.webglService && self.webglInitialized && webglCanvas) {
              // logger.debug('🎨 WebGL覆盖物渲染触发'); // 静默以减少日志刷屏

              // 🔧 修复：确保地图引用可用，优先使用self.map，回退到window.mapInstance
              let activeMap = self.map;
              if (!activeMap && typeof window !== 'undefined') {
                activeMap = (window as any).mapInstance;
                if (activeMap) {
                  // 恢复map引用
                  self.map = activeMap;
                  logger.debug('🔧 从window.mapInstance恢复地图引用');
                }
              }

              // 检查地图是否仍然可用（减少警告频率）
              if (!activeMap) {
                // 只在第一次或间隔较长时间后记录警告，避免日志刷屏
                if (!self.lastMapWarnTime || (currentTime - self.lastMapWarnTime) > 5000) {
                  logger.warn('⚠️ 地图对象不可用，跳过WebGL渲染');
                  self.lastMapWarnTime = currentTime;
                }
                return;
              }

              // 🔧 关键修复：强化地图对象有效性检查
              try {
                // 再次确认地图对象可用且有必需方法
                if (!activeMap || typeof activeMap.getCenter !== 'function') {
                  logger.warn('⚠️ 地图对象无效，跳过此帧渲染');
                  return;
                }

                const mapCenter = activeMap.getCenter();
                const zoom = activeMap.getZoom();
                const mapSize = activeMap.getSize();

                // 验证返回值的有效性
                if (!mapCenter || typeof mapCenter.lat !== 'number' || typeof mapCenter.lng !== 'number') {
                  logger.warn('⚠️ 地图中心点无效，跳过此帧渲染:', mapCenter);
                  return;
                }

                if (typeof zoom !== 'number' || !mapSize || !mapSize.width || !mapSize.height) {
                  logger.warn('⚠️ 地图状态无效，跳过此帧渲染:', { zoom, mapSize });
                  return;
                }

              try {
                logger.debug('📐 地图状态:', {
                  center: { lat: mapCenter.lat, lng: mapCenter.lng },
                  zoom: zoom,
                  mapSize: { width: mapSize.width, height: mapSize.height }
                });
              } catch (logError) {
                // 避免日志记录导致的错误
                console.log('地图状态:', mapCenter.lat, mapCenter.lng, zoom, mapSize);
              }

                // 更新Canvas尺寸（如果需要）
                if (webglCanvas.width !== mapSize.width || webglCanvas.height !== mapSize.height) {
                  webglCanvas.width = mapSize.width;
                  webglCanvas.height = mapSize.height;
                  if (self.webglService) {
                    self.webglService.resize(mapSize.width, mapSize.height);
                    logger.debug('📏 WebGL Canvas已调整尺寸:', mapSize);
                  }
                }

                // 🔧 关键调试：检查Canvas显示状态
                if (process.env.NODE_ENV === 'development' && Math.random() < 0.05) { // 5%概率，避免日志刷屏
                  const canvasRect = webglCanvas.getBoundingClientRect();
                  const canvasStyle = window.getComputedStyle(webglCanvas);

                  logger.debug('🔍 WebGL Canvas显示状态检查:', {
                    存在: !!webglCanvas,
                    在DOM中: document.contains(webglCanvas),
                    CSS显示: canvasStyle.display,
                    CSS可见性: canvasStyle.visibility,
                    CSS透明度: canvasStyle.opacity,
                    CSS层级: canvasStyle.zIndex,
                    实际尺寸: `${canvasRect.width}x${canvasRect.height}`,
                    实际位置: `(${canvasRect.left}, ${canvasRect.top})`,
                    在视口内: canvasRect.width > 0 && canvasRect.height > 0,
                    父元素: webglCanvas.parentElement?.tagName,
                    父元素显示: webglCanvas.parentElement ? window.getComputedStyle(webglCanvas.parentElement).display : 'N/A'
                  });
                }

                // 触发WebGL帧渲染
                self.renderWebGLFrame();

              } catch (mapError) {
                logger.error('❌ 地图状态获取失败:', mapError);
                return;
              }
            } else {
              // WebGL覆盖物渲染跳过（静默）
            }
          }
        };

        // 🔧 修复：实现更智能的渲染节流，防止疯狂日志循环
        let lastRenderTime = 0;
        let frameCount = 0;
        let lastLogTime = 0;
        const minRenderInterval = 1000 / 30; // 30fps = 33.33ms间隔
        const logInterval = 5000; // 每5秒才记录一次统计日志

        // 设置一个定时器来定期渲染WebGL帧
        const renderInterval = setInterval(() => {
          const currentTime = Date.now();

          // 🔧 节流检查：避免过于频繁的渲染
          if (currentTime - lastRenderTime < minRenderInterval) {
            return; // 跳过本次渲染
          }

          // 🔧 修复：使用self而不是this
          if (self.webglService && self.webglInitialized && webglCanvas) {
            webglOverlay.render();
            lastRenderTime = currentTime;
            frameCount++;

            // 🔧 只在指定间隔记录一次统计日志，避免疯狂循环
            if (currentTime - lastLogTime >= logInterval) {
              const stats = self.webglService.getStats();
              logger.info(`📊 WebGL渲染统计 (${frameCount}帧):`, {
                pixelCount: stats.pixelCount,
                avgFPS: Math.round(frameCount / ((currentTime - lastLogTime) / 1000)),
                webglReady: self.webglService.isReady()
              });
              frameCount = 0;
              lastLogTime = currentTime;
            }
          } else {
            // 如果WebGL未初始化，停止定时器
            logger.warn('⚠️ WebGL未初始化，停止渲染定时器');
            clearInterval(renderInterval);
          }
        }, 16); // 60fps检查频率，但实际渲染受节流控制

        // 存储定时器引用，用于清理
        (webglOverlay as any).renderInterval = renderInterval;

        // 存储覆盖物引用
        this.webglLayer = webglOverlay;

        // 🔧 暴露实例到window用于调试
        (window as any).amapLayerServiceInstance = this;
        (window as any).mapInstance = this.map;

        logger.info('✅ WebGL渲染层创建成功（定时器模式）');
      } catch (layerError) {
        logger.error('❌ 创建WebGL渲染层失败:', layerError);
        throw new Error(`创建WebGL渲染层失败: ${layerError}`);
      }

      // 🔧 修复：不需要添加到地图，WebGL Canvas已经直接在地图容器中
      logger.info('✅ WebGL渲染层已激活（直接Canvas模式）');

      // 监听地图尺寸变化和视图变化
      this.map.on('resize', () => {
        const canvas = document.getElementById('webgl-pixel-layer') as HTMLCanvasElement;
        if (this.webglService && canvas) {
          const size = this.map.getSize();
          canvas.width = size.width;
          canvas.height = size.height;
          canvas.style.width = size.width + 'px';
          canvas.style.height = size.height + 'px';
          this.webglService.resize(size.width, size.height);
          logger.info('🔧 WebGL Canvas已调整尺寸:', size);
        } else {
          logger.warn('⚠️ 地图resize时找不到WebGL Canvas或服务');
        }
      });

      // 🔧 优化：添加事件节流，防止过度渲染
      let lastEventRenderTime = 0;
      const eventRenderThrottle = 300; // 事件渲染节流300ms

      // 🔧 关键修复：监听地图移动和缩放事件，实时触发WebGL渲染
      // 这确保地图拖动时像素能实时跟随，不会"飘在地图上方"
      this.map.on('mapmove', () => {
        // 🔧 实时渲染，无防抖，确保拖动流畅
        if (this.webglLayer && this.webglLayer.render) {
          this.webglLayer.render();
        }
      });

      this.map.on('moveend', () => {
        const currentTime = Date.now();
        if (currentTime - lastEventRenderTime >= eventRenderThrottle) {
          if (this.webglLayer && this.webglLayer.render) {
            this.webglLayer.render();
            lastEventRenderTime = currentTime;
          }
        }
      });

      this.map.on('zoomstart', () => {
        // 🔧 缩放开始时也实时渲染
        if (this.webglLayer && this.webglLayer.render) {
          this.webglLayer.render();
        }
      });

      this.map.on('zoomend', () => {
        const currentTime = Date.now();
        if (currentTime - lastEventRenderTime >= eventRenderThrottle) {
          if (this.webglLayer && this.webglLayer.render) {
            this.webglLayer.render();
            lastEventRenderTime = currentTime;
          }
        }
      });

      this.webglInitialized = true;
      this.renderMode = 'webgl';

      logger.info('✅ WebGL渲染系统初始化完成');

      // 🔧 关键修复：WebGL初始化后立即重新加载缓存中的所有像素
      setTimeout(async () => {
        const finalCanvas = document.getElementById('webgl-pixel-layer');
        if (!finalCanvas) {
          logger.error('❌ 最终验证失败: WebGL Canvas丢失，尝试重新创建');
          await this.recreateWebGLCanvas();
        } else {
          logger.info('✅ 最终验证成功: WebGL Canvas正常', {
            CSS样式: finalCanvas.style.cssText,
            可见性: finalCanvas.offsetParent !== null
          });

          // 🔧 关键修复：重新加载缓存中的像素到WebGL（解决刷新后像素消失的问题）
          const cachedPixels = Object.values(this.pixelCache);
          if (cachedPixels.length > 0) {
            logger.info(`🔄 WebGL初始化后重新加载 ${cachedPixels.length} 个缓存像素...`);

            const webglPixels = cachedPixels.map(pixel => ({
              gridId: pixel.grid_id,
              lat: pixel.lat,
              lng: pixel.lng,
              patternKey: pixel.pattern_id || pixel.pattern || pixel.color || '#ffffff',
              renderType: this.getRenderType(pixel),
              color: pixel.color
            }));

            await this.webglService.addBatchPixels(webglPixels);
            logger.info(`✅ 已重新加载 ${webglPixels.length} 个缓存像素到WebGL`);

            // 立即渲染一帧
            this.renderWebGLFrame();
          } else {
            logger.info('ℹ️ 缓存中暂无像素数据');
          }
        }
      }, 500);

    } catch (error) {
      logger.error('❌ WebGL初始化失败:', error);
      throw error; // WebGL初始化失败，无法进行像素渲染
    }
  }

  /**
   * 渲染一帧WebGL
   */
  private renderWebGLFrame(): void {
    // 🔧 修复：确保地图引用可用，优先使用this.map，回退到window.mapInstance
    let activeMap = this.map;
    if (!activeMap && typeof window !== 'undefined') {
      activeMap = (window as any).mapInstance;
      if (activeMap) {
        // 恢复map引用
        this.map = activeMap;
        logger.debug('🔧 从window.mapInstance恢复地图引用');
      }
    }

    if (!this.webglService || !activeMap) {
      logger.debug('⚠️ WebGL帧渲染跳过：服务或地图未准备', {
        webglService: !!this.webglService,
        map: !!activeMap
      });
      return;
    }

    // 🔧 详细检查WebGL服务状态
    const webglStats = this.webglService.getStats();
    const isWebglReady = this.webglService.isReady();

    logger.debug('🔍 WebGL服务详细状态:', {
      initialized: webglStats.initialized,
      isReady: isWebglReady,
      pixelCount: webglStats.pixelCount,
      cachedPixelCount: (webglStats as any).cachedPixelCount,
      atlasStats: (webglStats as any).atlasStats
    });

    if (!isWebglReady) {
      logger.warn('⚠️ WebGL服务未准备渲染，跳过帧');
      return;
    }

    try {
      // 🔧 关键修复：强化地图对象检查，避免undefined错误
      if (!activeMap || typeof activeMap.getCenter !== 'function') {
        logger.warn('⚠️ renderWebGLFrame: 地图对象无效，跳过渲染');
        return;
      }

      const center = activeMap.getCenter();
      const zoom = activeMap.getZoom();
      const mapSize = activeMap.getSize();

      // 验证返回值
      if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        logger.warn('⚠️ renderWebGLFrame: 地图中心点无效:', center);
        return;
      }
      // 🔧 修复：计算像素大小（度为单位）
      const pixelSize = this.getPixelSize();

      // 🔍 像素大小调试
      const pixelSizeMeters = pixelSize * 111000; // 度转米的近似值
      logger.debug('📏 像素大小信息:', {
        地理大小度数: pixelSize,
        地理大小米数: pixelSizeMeters.toFixed(2) + '米',
        缩放级别: zoom,
        预估屏幕像素数: Math.round(pixelSizeMeters / (40075016.686 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom + 8)))
      });

      // WebGL帧渲染开始（静默调试）

      // 🔍 检查渲染参数有效性
      if (!center || !zoom || !mapSize || !pixelSize) {
        logger.error('❌ WebGL帧渲染参数无效:', {
          center: !!center,
          zoom: zoom,
          mapSize: !!mapSize,
          pixelSize: !!pixelSize
        });
        return;
      }

      // 🔧 检查WebGL内部状态
      try {
        const atlasCanvas = this.webglService.exportAtlasCanvas();
        logger.debug('🔍 纹理图集检查:', {
          存在: !!atlasCanvas,
          宽度: atlasCanvas?.width,
          高度: atlasCanvas?.height,
          纹理数量: (webglStats as any).atlasStats?.textureCount
        });

        // 🔧 危险的测试像素功能已被移除，避免内存泄漏和浏览器卡死
      } catch (atlasError) {
        logger.warn('⚠️ 纹理图集检查失败:', atlasError);
      }

      // 🔧 详细渲染参数调试
      const renderParams = {
        mapCenter: { lat: center.lat, lng: center.lng },
        zoom: zoom,
        resolution: mapSize,
        pixelSize: pixelSize
      };

      // 🔧 添加渲染前状态检查
      const stats = this.webglService.getStats();

      // 🔧 调试：检查像素数据持久性
      if (process.env.NODE_ENV === 'development') {
        this.webglService.debugPixelPersistence();
      }

      // 🔧 修复：只在调试模式下记录详细渲染日志，减少日志噪音
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) { // 10%概率记录，避免日志过多
        logger.debug('🎯 WebGL帧渲染:', {
          地图中心: renderParams.mapCenter,
          缩放级别: renderParams.zoom,
          WebGL像素数量: stats.pixelCount,
          缓存像素数量: (stats as any).cachedPixelCount
        });
      }

      // 调用WebGL服务渲染
      this.webglService.render(renderParams);

    } catch (error) {
      // 🔧 详细错误分析
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('❌ WebGL帧渲染失败:', {
        message: errorMessage,
        stack: errorStack,
        errorObject: error,
        webglStats: this.webglService.getStats(),
        isWebglReady: this.webglService.isReady()
      });

      // 🔧 尝试获取WebGL上下文错误
      try {
        const webglCanvas = document.getElementById('webgl-pixel-layer') as HTMLCanvasElement;
        if (webglCanvas) {
          const gl = webglCanvas.getContext('webgl') as WebGLRenderingContext || webglCanvas.getContext('experimental-webgl') as WebGLRenderingContext;
          if (gl) {
            const webglError = gl.getError();
            if (webglError !== gl.NO_ERROR) {
              logger.error('🔍 WebGL上下文错误码:', {
                错误码: webglError,
                错误名称: this.getWebGLErrorName(webglError, gl)
              });
            } else {
              logger.debug('✅ WebGL上下文状态正常');
            }
          } else {
            logger.error('❌ 无法获取WebGL上下文');
          }
        } else {
          logger.error('❌ WebGL Canvas不存在');
        }
      } catch (glError) {
        logger.warn('⚠️ 无法检查WebGL上下文错误:', glError);
      }

      // 🔧 检查Canvas状态
      try {
        const webglCanvas = document.getElementById('webgl-pixel-layer') as HTMLCanvasElement;
        if (webglCanvas) {
          logger.debug('🔍 WebGL Canvas状态:', {
            存在: true,
            宽度: webglCanvas.width,
            高度: webglCanvas.height,
            显示状态: webglCanvas.style.display,
            可见性: webglCanvas.offsetParent !== null,
            父元素: webglCanvas.parentElement?.tagName,
            在DOM中: document.contains(webglCanvas),
            CSS样式: webglCanvas.style.cssText
          });
        } else {
          logger.error('❌ WebGL Canvas不存在于DOM中');
          // 🔧 尝试查找所有可能的Canvas元素
          const allCanvases = document.querySelectorAll('canvas');
          logger.debug('🔍 页面中的Canvas元素:', Array.from(allCanvases).map(canvas => ({
            id: canvas.id,
            width: canvas.width,
            height: canvas.height,
            在地图容器中: this.map?.getContainer()?.contains(canvas)
          })));
        }
      } catch (canvasError) {
        logger.warn('⚠️ 无法检查Canvas状态:', canvasError);
      }
    }
  }

  /**
   * 获取WebGL错误名称
   */
  private getWebGLErrorName(errorCode: number, gl: WebGLRenderingContext): string {
    switch (errorCode) {
      case gl.NO_ERROR: return 'NO_ERROR';
      case gl.INVALID_ENUM: return 'INVALID_ENUM';
      case gl.INVALID_VALUE: return 'INVALID_VALUE';
      case gl.INVALID_OPERATION: return 'INVALID_OPERATION';
      case gl.OUT_OF_MEMORY: return 'OUT_OF_MEMORY';
      case gl.CONTEXT_LOST_WEBGL: return 'CONTEXT_LOST_WEBGL';
      default: return `UNKNOWN_ERROR_${errorCode}`;
    }
  }

  // 渲染防抖控制
  private lastRenderTime = 0;
  private renderDebounceDelay = 50; // 50ms防抖，更响应快速

  // 缓存更新防抖控制
  private lastCacheUpdateTime = 0;
  private cacheUpdateDebounceDelay = 200; // 200ms缓存更新防抖

  // 边界查询防抖控制
  private lastQueryBounds: { north: number, south: number, east: number, west: number } | null = null;
  private queryDebounceDelay = 300; // 300ms边界查询防抖

  /**
   * 渲染像素到WebGL - 高性能GPU渲染（带防抖）
   */
  private async renderPixelsToWebGL(pixels: any[]): Promise<void> {
    // 防抖检查：避免重复渲染
    const currentTime = Date.now();
    if (currentTime - this.lastRenderTime < this.renderDebounceDelay) {
      logger.debug('⚠️ WebGL渲染被防抖跳过，避免重复渲染');
      return;
    }
    this.lastRenderTime = currentTime;

    // 关键检查：WebGL是否初始化
    logger.debug('🔍 WebGL渲染检查:', {
      webglService: !!this.webglService,
      webglInitialized: this.webglInitialized,
      pixelCount: pixels.length
    });

    if (!this.webglService) {
      logger.warn('⚠️ WebGL服务未初始化，无法渲染');
      return;
    }

    if (!this.webglInitialized) {
      logger.warn('⚠️ WebGL未完成初始化，无法渲染');
      return;
    }

    try {
      logger.info(`🎨 开始WebGL渲染 ${pixels.length} 个像素...`);

      // 🔧 调试：检查输入像素数据（包括pixel_type）
      const pixelTypesCount = pixels.reduce((acc: any, p: any) => {
        const type = p.pixel_type || 'normal';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      logger.info('🔍 WebGL渲染输入检查:', {
        pixelsLength: pixels.length,
        pixelTypes: pixelTypesCount,
        pixelsSample: pixels.slice(0, 3).map(p => ({
          grid_id: p.grid_id,
          lat: p.lat,
          lng: p.lng,
          color: p.color,
          pattern_id: p.pattern_id,
          render_type: p.render_type,
          pixel_type: p.pixel_type
        }))
      });

      // 🔧 新增：详细检查广告像素渲染信息
      const adPixels = pixels.filter(p => p.pixel_type === 'ad');
      if (adPixels.length > 0) {
        logger.info(`🎯 WebGL渲染广告像素检查 (${adPixels.length}个):`, adPixels.map(p => ({
          grid_id: p.grid_id,
          lat: p.lat,
          lng: p.lng,
          color: p.color,
          pattern_id: p.pattern_id,
          render_type: p.render_type,
          unicode_char: p.unicode_char,
          material_id: p.material_id,
          getRenderType: this.getRenderType(p)
        })));
      }

      // 转换像素数据为WebGL格式
      const webglPixels: any[] = [];
      for (const pixel of pixels) {
        let patternKey = '';
        let renderType: 'color' | 'emoji' | 'complex' = 'color';

        // 🔧 关键修复：正确处理三种渲染类型
        if (pixel.render_type === 'complex') {
          // Complex类型：patternKey用于纹理查找，必须使用pattern_id (如 'emoji_fire')
          // material_id用于材质加载，通过materialId单独传递
          patternKey = pixel.pattern_id || '';
          renderType = 'complex';
        } else if (pixel.render_type === 'emoji') {
          // Emoji类型：使用unicode_char作为emoji字符
          patternKey = pixel.unicode_char || '';
          renderType = 'emoji';
        } else {
          // Color类型：不使用纹理，直接使用纯色
          patternKey = ''; // 🔧 修复：Color类型不使用patternKey
          renderType = 'color';
        }

        webglPixels.push({
          gridId: pixel.grid_id || `${pixel.lat}_${pixel.lng}`,
          lat: pixel.lat,
          lng: pixel.lng,
          renderType: renderType,
          patternKey: patternKey,
          color: pixel.color,
          // 🔧 修复：为complex类型提供额外的pattern信息
          patternId: pixel.pattern_id,  // 原始pattern_id (如 'emoji_fire')
          materialId: pixel.material_id  // 材质ID (如 '57f71649-...')
        });
      }

      logger.info(`📦 转换WebGL像素数据: ${webglPixels.length}个`);

      // 🔍 打印前3个像素用于调试
      if (webglPixels.length > 0) {
        logger.info('🔍 前3个像素数据样本:', webglPixels.slice(0, 3).map(p => ({
          lat: p.lat,
          lng: p.lng,
          renderType: p.renderType,
          color: p.color,
          patternKey: p.patternKey
        })));
      }

      // 批量更新像素到WebGL（包括pattern预处理）
      await this.webglService.addBatchPixels(webglPixels);

      logger.info('🔄 调用WebGL帧渲染...');

      // 触发重新渲染
      this.renderWebGLFrame();

      logger.info(`✅ WebGL渲染完成: ${webglPixels.length}个像素`);

    } catch (error) {
      logger.error('❌ WebGL渲染失败:', error);
    }
  }

  /**
   * 收集像素渲染所需的图案信息
   */
  private collectRequiredPatterns(pixels: any[]): any[] {
    const patterns = new Map();

    for (const pixel of pixels) {
      const key = pixel.pattern_id || pixel.material_id;
      if (key && !patterns.has(key)) {
        patterns.set(key, {
          id: key,
          pattern_id: pixel.pattern_id,
          material_id: pixel.material_id,
          render_type: pixel.render_type || 'color',
          color: pixel.color,
          emoji: pixel.emoji,
          encoding: pixel.encoding,
          payload: pixel.payload
        });
      }
    }

    return Array.from(patterns.values());
  }

  /**
   * 地图准备就绪回调 - 由AmapCanvas.tsx调用
   */
  public onMapReady(): void {
    logger.info('🗺️ 地图准备就绪，使用WebGL渲染模式');
    // 使用WebGL渲染模式，提供高性能的GPU像素显示
    logger.info('🚀 当前渲染模式: WebGL渲染（GPU加速）');

    // ✅ 关键修复：地图就绪后立即初始化WebGL
    if (!this.webglInitialized) {
      logger.info('📡 地图已就绪，开始初始化WebGL渲染系统...');
      // 异步初始化WebGL，不阻塞主线程
      this.safeInitializeWebGL().catch(error => {
        logger.error('❌ WebGL初始化失败:', error);
      });
    }

    // 地图就绪时，不进行字体预热，避免首屏负担
  }

  /**
   * 进入地图或视图变化后：异步批量预热当前视图涉及的 emoji 字体版本
   * - 调用者：AmapCanvas 在 moveend/zoomend 后可触发
   */
  public async warmupEmojiFontForView(bounds?: any): Promise<void> {
    try {
      const mapBounds = bounds || (this.map && this.map.getBounds());
      if (!mapBounds) return;
      let zoom: number = 16;
      try {
        zoom = this.map && typeof this.map.getZoom === 'function' ? this.map.getZoom() : 16;
      } catch {}
      // 复用现有高效查询，拿到可见像素
      const pixels = await this.getVisiblePixelsEfficient(mapBounds, zoom);
      // 收集 emoji 类型图案的 font_version(description)
      const versions = new Set<string>();
      const ids: string[] = [];
      for (const p of pixels) {
        if (p.pattern_id) ids.push(p.pattern_id);
      }
      // 向全局 patternCache 查询，尽快拿到 encoding/description
      const patternCache = (window as any).patternCache;
      if (patternCache && ids.length) {
        // 并发限制轻量处理
        const tasks = ids.slice(0, 200).map(async id => {
          try {
            const pat = await patternCache.getPattern(id);
            if (pat && (pat as any).encoding === 'emoji' && (pat as any).description) {
              versions.add((pat as any).description);
            }
          } catch {}
        });
        await Promise.all(tasks);
      }
      // 预热字体版本（一般只有一个当前版本），等待完成后触发一次轻量重绘
      const promises: Array<Promise<void>> = [];
      for (const v of versions) {
        promises.push(emojiFontLoader.ensure(v));
      }
      if (promises.length) {
        await Promise.all(promises);
        logger.info(`🔥 Emoji字体预热完成: ${Array.from(versions).join(', ')}`);
        // 仅使用WebGL渲染
      }
    } catch (e) {
      logger.warn('warmupEmojiFontForView failed:', e);
    }
  }

  /**
   * 重新尝试WebGL初始化 - 用于解决初始化失败问题
   */
  public retryWebGLInitialization(): void {
    logger.info('🔄 重新尝试WebGL渲染系统初始化...');

    // 延迟重新初始化WebGL
    setTimeout(() => {
      if (!this.webglInitialized && this.map) {
        this.safeInitializeWebGL().catch(error => {
          logger.error('❌ WebGL重新初始化失败:', error);
        });
      } else if (this.webglInitialized) {
        logger.info('✅ WebGL渲染系统已初始化，无需重复初始化');
      } else {
        logger.warn('⚠️ 地图未准备好，无法初始化WebGL');
      }
    }, 1000);
  }

  
  /**
   * 将图案转换为自定义emoji
   */
  private async convertPatternToCustomEmoji(patternId: string, pattern: any): Promise<any> {
    try {
      // 动态导入自定义emoji转换器
      const { customEmojiConverter } = await import('../utils/customEmojiConverter');
      
      // 转换PNG base64图案
      const customEmoji = await customEmojiConverter.convertImageToEmoji(
        patternId,
        pattern.payload,
        {
          size: this.getEmojiSize(),
          quality: 'medium',
          method: 'canvas'
        }
      );
      
      return customEmoji;
    } catch (error) {
      logger.error('图案转自定义emoji失败:', error);
      return null;
    }
  }

  /**
   * 将RLE图案转换为自定义emoji
   */
  private async convertRLEToCustomEmoji(patternId: string, pattern: any): Promise<any> {
    try {
      // 动态导入自定义emoji转换器
      const { customEmojiConverter } = await import('../utils/customEmojiConverter');
      
      // 解析RLE数据
      const rleData = JSON.parse(pattern.payload);
      
      // 转换RLE图案
      const customEmoji = await customEmojiConverter.convertRLEToEmoji(
        patternId,
        rleData,
        pattern.width || 16,
        pattern.height || 16,
        {
          size: this.getEmojiSize(),
          quality: 'medium'
        }
      );
      
      return customEmoji;
    } catch (error) {
      logger.error('RLE图案转自定义emoji失败:', error);
      return null;
    }
  }

  
  
    

  
  /**
   * 检查像素是否在地图边界内
   */
  private isPixelInBounds(lat: number, lng: number, bounds: any): boolean {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    return lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng;
  }

  
  
  /**
   * 添加像素到瓦片 - 瓦片渲染方式 (已废弃，统一使用WebGL渲染)
   * @deprecated 此方法已废弃，所有像素现在统一使用WebGL高性能渲染
   */
  private async addPixelToDOM(pixel: any, AMap: any): Promise<void> {
    logger.warn(`⚠️ DOM渲染方法已废弃，像素 ${pixel.grid_id} 应使用WebGL渲染`);
    // 不再实现DOM渲染逻辑，强制使用WebGL渲染
  }

  /**
   * 地图缩放变化处理 - 优化版本，减少频繁触发
   */
  private onMapZoomChange(zoom?: number) {
    let currentZoom;
    try {
      currentZoom = zoom || this.map.getZoom();
    } catch (zoomError) {
      logger.warn('获取缩放级别失败:', zoomError);
      return;
    }

    logger.info(`🔍 缩放事件触发: 当前级别=${currentZoom}`);

    // 检查缩放级别是否满足条件
    if (currentZoom >= this.config.minZoom && currentZoom <= this.config.maxZoom) {
      logger.info(`✅ 缩放级别满足条件 (${currentZoom} >= ${this.config.minZoom} 且 <= ${this.config.maxZoom})`);

      // 🔧 关键修复：缩放时不清空Canvas数据，只触发重绘
      // 使用防抖处理，避免频繁更新
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }

      this.updateTimer = setTimeout(() => {
        logger.info(`🔄 缩放完成 zoom=${currentZoom}，触发Canvas重绘（保留现有像素数据）`);

        // 🔧 不重置 lastBounds，保留像素数据
        // this.lastBounds = null;  // ❌ 移除这行，避免强制重新加载

        // 清理emoji缓存，强制重新创建（因为大小可能改变）
        this.clearEmojiCache();

        // 🔧 清空tileRenderCache，强制重新渲染所有瓦片（emoji大小已改变）
        tileRenderCache.clearCache();

        // 仅使用WebGL渲染
      }, 300); // 减少延迟，更快响应
    } else {
      logger.info(`⚠️ 缩放级别不满足条件 (${currentZoom} < ${this.config.minZoom} 或 > ${this.config.maxZoom})`);
      // 在缩放级别不满足条件时清除像素并重置边界
      if (this.pixelLayer && this.pixelLayer.overlays.size > 0) {
        logger.info('🔄 缩放级别不满足条件，清除当前像素');
        this.clearAllPixels();
      }
    }
  }

  /**
   * 处理缩放变化回调 - 供 AmapCanvas 调用
   */
  public handleZoomChange(zoom: number) {
    this.onMapZoomChange(zoom);
  }

  
  /**
   * 公开的像素尺寸计算方法 - 供调试使用
   * 🔧 修复：提供公开接口，用于验证缩放计算
   */
  public getPixelSizeForDebug(geographicSize: number): number {
    return this.convertGeographicToScreenPixels(geographicSize);
  }

  /**
   * 获取相对屏幕坐标 - 统一计算屏幕坐标
   * 🔧 修复：确保坐标计算一致性，避免容器偏移问题
   */
  private getRelativeScreenPos(lng: number, lat: number): { x: number; y: number } | null {
    try {
      const containerPos = this.map.lngLatToContainer([lng, lat]);
      if (!containerPos) return null;
      
      const rect = this.map.getContainer().getBoundingClientRect();
      return {
        x: containerPos.x - rect.left,
        y: containerPos.y - rect.top
      };
    } catch (error) {
      logger.warn('计算相对屏幕坐标失败:', error);
      return null;
    }
  }

  /**
   * 处理移动结束回调 - 供 AmapCanvas 调用
   */
  public handleMoveEnd() {
    this.onMapMoveEnd();
  }

  /**
   * 地图移动结束处理 - 优化版本，减少频繁触发
   */
  private onMapMoveEnd() {
    // 防抖处理，避免频繁调用
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    // 增加延迟时间，减少频繁触发，提升移动性能
    const delay = 800; // 从300ms增加到800ms
    
    this.updateTimer = setTimeout(() => {
      // 检查缩放级别是否满足条件
      let zoom;
      try {
        zoom = this.map.getZoom();
      } catch (zoomError) {
        logger.warn('获取缩放级别失败:', zoomError);
        return;
      }
      
      if (zoom >= this.config.minZoom && zoom <= this.config.maxZoom) {
        logger.info(`✅ 移动结束，缩放级别满足条件 (${zoom} >= ${this.config.minZoom} 且 <= ${this.config.maxZoom})，延迟 ${delay}ms 后更新像素`);
        this.updateVisiblePixels();
      } else {
        logger.info(`⚠️ 移动结束，缩放级别不满足条件 (${zoom} < ${this.config.minZoom} 或 > ${this.config.maxZoom})，跳过像素更新`);
        // 在缩放级别不满足条件时清除像素并重置边界
        if (this.pixelLayer && this.pixelLayer.overlays.size > 0) {
          logger.info('🔄 缩放级别不满足条件，清除当前像素');
          this.clearAllPixels();
        }
      }
    }, delay);
  }

  /**
   * 设置地图事件监听器 - 确保页面刷新后像素自动加载
   */
  private setupMapEventListeners() {
    if (!this.map) {
      logger.error('❌ 地图对象不存在，无法设置事件监听器');
      return;
    }

    try {
      // 🔧 修复：添加地图移动结束事件监听器
      this.map.on('moveend', () => {
        logger.info('🗺️ 地图移动结束事件触发');
        this.onMapMoveEnd();
      });

      // 🔧 修复：添加地图缩放结束事件监听器
      this.map.on('zoomend', () => {
        logger.info('🔍 地图缩放结束事件触发');
        const zoom = this.map.getZoom();
        this.handleZoomChange(zoom);
      });

      // 🔧 修复：添加地图初始化完成事件监听器（首次加载）
      this.map.on('complete', () => {
        logger.info('🎯 地图初始化完成事件触发，开始加载像素');
        // 延迟一点时间确保地图完全稳定
        setTimeout(() => {
          this.onMapMoveEnd();
        }, 1000);
      });

      // 🔧 修复：添加页面可见性变化监听器（处理标签页切换）
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.map) {
          logger.info('👀 页面重新可见，检查像素状态');
          // 延迟一点时间确保页面完全激活
          setTimeout(() => {
            this.onMapMoveEnd();
          }, 500);
        }
      });

      logger.info('✅ 地图事件监听器设置成功');
    } catch (error) {
      logger.error('❌ 设置地图事件监听器失败:', error);
    }
  }

  /**
   * 检查地图是否可交互
   */
  private isMapInteractive(): boolean {
    if (!this.map) return false;
    
    try {
      // 检查地图是否仍然可以交互
      let zoom;
      let center;
      
      // 安全地获取地图状态
      try {
        zoom = this.map.getZoom();
        center = this.map.getCenter();
      } catch (stateError) {
        logger.warn('获取地图状态失败:', stateError);
        return false;
      }
      
      // 检查状态有效性
      if (typeof zoom !== 'number' || isNaN(zoom) || !center) {
        logger.warn('地图状态无效:', { zoom, center });
        return false;
      }
      
      // 🔧 修复：检查缩放级别是否在有效范围内
      if (zoom < this.config.minZoom || zoom > this.config.maxZoom) {
        logger.info(`⚠️ 缩放级别不满足条件 (${zoom} < ${this.config.minZoom} 或 > ${this.config.maxZoom})，地图不可交互`);
        return false;
      }
      
      return zoom !== undefined && center !== null;
    } catch (error) {
      logger.warn('地图交互状态检查失败:', error);
      return false;
    }
  }

  /**
   * 检查边界是否发生显著变化 - 使用高德地图标准接口优化版本
   * 🔧 修复:添加缩放级别变化检测,解决纯缩放操作不触发更新的问题
   */
  private hasBoundsChanged(newBounds: any): boolean {
    if (!this.lastBounds) return true;

    try {
      const AMap = (window as any).AMap;

      // 获取当前缩放级别
      const currentZoom = this.map.getZoom();

      // 🔧 修复:检查缩放级别是否发生变化，确保缩放时像素始终可见
      if (this.lastZoom !== null) {
        const zoomChange = Math.abs(currentZoom - this.lastZoom);
        // 只要缩放级别发生任何变化，都强制重新加载以避免像素消失
        if (zoomChange > 0.001) {
          logger.info(`🔍 强制更新：检测到缩放级别变化: ${this.lastZoom} -> ${currentZoom} (变化: ${zoomChange.toFixed(3)})`);
          return true; // 缩放变化，强制更新
        }
      }

      // 1. 使用高德地图标准接口计算中心点距离
      const oldCenter = this.lastBounds.getCenter();
      const newCenter = newBounds.getCenter();
      const centerDistance = AMap.GeometryUtil.distance(oldCenter, newCenter);

      // 2. 使用高德地图标准接口计算边界面积
      const oldArea = this.calculateBoundsAreaStandard(this.lastBounds);
      const newArea = this.calculateBoundsAreaStandard(newBounds);
      const areaChangeRatio = Math.abs(newArea - oldArea) / oldArea;

      // 3. 🔧 简化判断逻辑：降低阈值，确保缩放变化能被正确检测到
      const { distanceThreshold, areaThreshold } = this.getDynamicThresholds(currentZoom);

      // 4. 🔧 修复：使用更宽松的条件，避免像素消失
      let hasSignificantChange = false;

      // 任何中心点距离变化都认为是显著变化
      if (centerDistance > distanceThreshold * 0.5) { // 降低50%阈值
        hasSignificantChange = true;
      }
      // 任何面积变化都认为是显著变化（移除中心点距离要求）
      else if (areaChangeRatio > areaThreshold * 0.5) { // 降低50%阈值
        hasSignificantChange = true;
      }
      
      // 🔧 简化逻辑：移除复杂的聚焦操作检测，避免像素消失问题
      // 任何显著的缩放或移动都应该触发重新加载，确保像素始终可见
      
      if (hasSignificantChange) {
        logger.info(`🗺️ 边界发生显著变化: 中心距离${centerDistance.toFixed(1)}m, 面积变化${(areaChangeRatio * 100).toFixed(1)}%, 缩放级别${currentZoom}`);
      } else {
        logger.info(`✅ 边界变化微小: 中心距离${centerDistance.toFixed(1)}m, 面积变化${(areaChangeRatio * 100).toFixed(1)}%, 缩放级别${currentZoom}`);
      }
      
      return hasSignificantChange;
    } catch (error) {
      logger.warn('边界比较失败，使用降级方案:', error);
      // 降级到简单比较
      return this.hasBoundsChangedSimple(newBounds);
    }
  }

  /**
   * 根据缩放级别获取动态阈值 - 修复版本，降低阈值确保像素能正常加载
   */
  private getDynamicThresholds(zoom: number): { distanceThreshold: number; areaThreshold: number } {
    // 🔧 修复：大幅降低阈值，确保像素能正常加载和显示
    if (zoom >= 20) {
      return { distanceThreshold: 50, areaThreshold: 0.1 }; // 高缩放级别：高敏感度
    } else if (zoom >= 17) {
      return { distanceThreshold: 100, areaThreshold: 0.15 }; // 中等缩放级别：高敏感度
    } else if (zoom >= 15) {
      return { distanceThreshold: 200, areaThreshold: 0.2 }; // 低缩放级别：中等敏感度
    } else {
      return { distanceThreshold: 500, areaThreshold: 0.3 }; // 最低缩放级别：适中敏感度
    }
  }

  /**
   * 简单边界变化检测（降级方案）- 优化版本
   */
  private hasBoundsChangedSimple(newBounds: any): boolean {
    if (!this.lastBounds) return true;
    
    try {
      const oldNorth = this.lastBounds.getNorthEast().lat;
      const oldSouth = this.lastBounds.getSouthWest().lat;
      const oldEast = this.lastBounds.getNorthEast().lng;
      const oldWest = this.lastBounds.getSouthWest().lng;
      
      const newNorth = newBounds.getNorthEast().lat;
      const newSouth = newBounds.getSouthWest().lat;
      const newEast = newBounds.getNorthEast().lng;
      const newWest = newBounds.getSouthWest().lng;
      
      // 🔧 修复：降低阈值确保像素能正常加载，约10米
      const threshold = 0.0001;
      
      // 计算边界变化的百分比
      const latRange = Math.abs(newNorth - newSouth);
      const lngRange = Math.abs(newEast - newWest);
      // 🔧 修复：大幅降低百分比阈值，从5%改为1%，提高敏感度
      const latThreshold = Math.max(threshold, latRange * 0.01); // 至少1%的变化
      const lngThreshold = Math.max(threshold, lngRange * 0.01);
      
      const hasSignificantChange = Math.abs(newNorth - oldNorth) > latThreshold ||
                                  Math.abs(newSouth - oldSouth) > latThreshold ||
                                  Math.abs(newEast - oldEast) > lngThreshold ||
                                  Math.abs(newWest - oldWest) > lngThreshold;
      
      if (hasSignificantChange) {
        logger.info(`🗺️ 边界发生显著变化: 北${(newNorth - oldNorth).toFixed(6)}, 南${(newSouth - oldSouth).toFixed(6)}, 东${(newEast - oldEast).toFixed(6)}, 西${(newWest - oldWest).toFixed(6)}`);
      }
      
      return hasSignificantChange;
    } catch (error) {
      logger.warn('边界比较失败:', error);
      return true; // 如果比较失败，假设边界发生了变化
    }
  }

  /**
   * 使用高德地图标准接口计算边界面积
   */
  private calculateBoundsAreaStandard(bounds: any): number {
    try {
      const AMap = (window as any).AMap;
      
      // 获取边界的四个角点
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const nw = new AMap.LngLat(sw.lng, ne.lat);
      const se = new AMap.LngLat(ne.lng, sw.lat);
      
      // 使用标准接口计算多边形面积
      const ring = [sw, se, ne, nw, sw]; // 闭合多边形
      const area = AMap.GeometryUtil.ringArea(ring);
      
      return Math.abs(area); // 确保返回正值
    } catch (error) {
      logger.warn('标准面积计算失败，使用简化方法:', error);
      // 降级到简化计算
      return this.calculateBoundsAreaSimple(bounds);
    }
  }

  /**
   * 简化面积计算（降级方案）
   */
  private calculateBoundsAreaSimple(bounds: any): number {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const width = Math.abs(ne.lng - sw.lng);
    const height = Math.abs(ne.lat - sw.lat);
    
    // 使用简化的矩形面积计算
    // 注意：这不是精确的地球表面面积，但在小范围内误差较小
    return width * height;
  }

  /**
   * 计算边界面积
   */
  private calculateBoundsArea(bounds: any): number {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const width = Math.abs(ne.lng - sw.lng);
    const height = Math.abs(ne.lat - sw.lat);
    return width * height;
  }

  /**
   * 更新可见区域像素数据 - 使用高德地图标准接口优化增量同步
   */
  private async updateVisiblePixels() {
    if (this.isUpdating || !this.map || !this.isMapInteractive()) {
      logger.info('地图不可交互或正在更新中，跳过像素更新');
      return;
    }

    this.isUpdating = true;

    try {
      // 🔧 关键修复：安全获取地图状态
      let bounds, zoom;

      // 🔧 重要修复：增加延迟确保地图动画完全结束，边界获取准确
      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        bounds = this.map.getBounds();

        // 🔧 验证边界的有效性，确保不是空边界或者错误边界
        if (!bounds || !bounds.getNorthEast || !bounds.getSouthWest) {
          logger.warn('第一次获取边界无效，延迟重试');
          await new Promise(resolve => setTimeout(resolve, 500));
          bounds = this.map.getBounds();
        }

        // 🔧 再次验证边界内容
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          if (!ne || !sw || typeof ne.lat !== 'number' || typeof ne.lng !== 'number' ||
              typeof sw.lat !== 'number' || typeof sw.lng !== 'number') {
            logger.warn('边界内容无效，延迟重试');
            await new Promise(resolve => setTimeout(resolve, 500));
            bounds = this.map.getBounds();
          } else {
            // 🔧 调试：记录最终获取的边界
            logger.info('🗺️ 最终获取的地图边界:', {
              北: ne.lat,
              南: sw.lat,
              东: ne.lng,
              西: sw.lng,
              缩放级别: zoom
            });
          }
        }

      } catch (boundsError) {
        logger.warn('获取地图边界失败，尝试重新获取:', boundsError.message);
        // 延迟重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          bounds = this.map.getBounds();
        } catch (retryError) {
          logger.error('重试获取地图边界仍然失败:', retryError.message);
          return;
        }
      }

      try {
        zoom = this.map.getZoom();
      } catch (zoomError) {
        logger.warn('获取缩放级别失败:', zoomError.message);
        return;
      }

      // 🔧 修复：检查缩放级别是否满足条件
      if (zoom < this.config.minZoom || zoom > this.config.maxZoom) {
        logger.info(`⚠️ 缩放级别不满足条件 (${zoom} < ${this.config.minZoom} 或 > ${this.config.maxZoom})，跳过像素更新`);
        return;
      }

      // 检查边界是否有效
      if (!bounds || !bounds.getNorthEast || !bounds.getSouthWest) {
        logger.warn('地图边界无效，跳过像素更新', { bounds, hasGetNorthEast: !!bounds?.getNorthEast, hasGetSouthWest: !!bounds?.getSouthWest });
        return;
      }

      // 验证边界对象的内容
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      if (!ne || !sw || typeof ne.lat !== 'number' || typeof ne.lng !== 'number' ||
          typeof sw.lat !== 'number' || typeof sw.lng !== 'number') {
        logger.warn('地图边界内容无效，跳过像素更新', { ne, sw });
        return;
      }
      
      // 检查边界是否发生变化，并判断是否是大幅缩放操作
      const boundsChanged = this.hasBoundsChanged(bounds);

      // 🔧 重要修复：强制检查是否真的应该跳过更新
      // 如果中心点有显著移动(>10米)，强制认为边界发生变化
      if (!boundsChanged && this.lastBounds) {
        const oldCenter = this.lastBounds.getCenter();
        const newCenter = bounds.getCenter();
        const centerDistance = Math.sqrt(
          Math.pow(newCenter.lat - oldCenter.lat, 2) +
          Math.pow(newCenter.lng - oldCenter.lng, 2)
        );

        // 如果中心点距离超过约10米(0.0001度)，强制更新
        if (centerDistance > 0.0001) {
          logger.warn(`🗺️ 检测到中心点显著移动(${(centerDistance * 111000).toFixed(1)}米)，强制更新像素`);
          // 手动标记边界已变化
          this.lastBounds = null;
        } else {
          logger.info('🗺️ 边界未发生变化，跳过像素更新');
        }
      }

      // 重新计算边界变化状态（因为可能在上面被修改了）
      const finalBoundsChanged = this.hasBoundsChanged(bounds);
      if (!finalBoundsChanged) {
        // 🔧 关键修复：即使边界未变化，也要检查WebGL缓存是否需要同步
        if (this.webglService && this.webglInitialized) {
          const webglStats = this.webglService.getStats();
          const cacheSize = this.pixelCache ? Object.keys(this.pixelCache).length : 0;

          logger.debug('🔍 边界未变化时的缓存同步检查:', {
            amapLayerCache: cacheSize,
            webglPixelDataMap: webglStats.pixelCount || (webglStats as any).cachedPixelCount || 0,
            webglRendererStats: webglStats.pixelCount || 0
          });

          // 如果缓存和WebGL不同步，强制同步
          const webglPixelCount = webglStats.pixelCount || 0;
          if (cacheSize > 0 && webglPixelCount === 0) {
            logger.warn('⚠️ 检测到WebGL缓存为空但amapLayer缓存有数据，强制同步');

            const cachedPixels = Object.values(this.pixelCache);
            if (cachedPixels.length > 0) {
              // 转换缓存像素为WebGL格式
              const webglPixels = cachedPixels.map(pixel => ({
                gridId: pixel.grid_id,
                lat: pixel.lat,
                lng: pixel.lng,
                patternKey: pixel.pattern_id || pixel.pattern || pixel.color || '#ffffff',
                renderType: this.getRenderType(pixel),
                color: pixel.color
              }));

              await this.webglService.addBatchPixels(webglPixels);
              logger.info(`✅ 强制同步 ${webglPixels.length} 个像素到WebGL`);

              // 立即渲染一帧
              this.renderWebGLFrame();
            }
          }
        }
        return;
      }

      // 检测是否是大幅缩放操作
      let isSignificantZoom = false;
      if (this.lastBounds) {
        const oldArea = this.calculateBoundsAreaStandard(this.lastBounds);
        const newArea = this.calculateBoundsAreaStandard(bounds);
        const areaChangeRatio = Math.abs(newArea - oldArea) / oldArea;

        // 如果面积变化超过70%，认为是大幅缩放，需要强制全量重新加载
        if (areaChangeRatio > 0.7) {
          isSignificantZoom = true;
          logger.info(`🔄 检测到大幅缩放 (面积变化${(areaChangeRatio * 100).toFixed(1)}%)，强制全量重新加载像素`);
        }
      }

      // 优化：增量更新逻辑（但大幅缩放时强制全量加载）
      if (this.lastBounds && !isSignificantZoom) {
        // Canvas清空代码已移除

        const newAreas = this.calculateNewAreas(this.lastBounds, bounds);
        const gridIdsToRemove = this.calculateRemovedAreas(this.lastBounds, bounds);

        if (newAreas.length > 0 || gridIdsToRemove.length > 0) {
          logger.info(`🔄 增量更新: 新增${newAreas.length}个区域，移除${gridIdsToRemove.length}个网格`);

          // 先加载新区域，再移除旧区域，避免闪烁
          if (newAreas.length > 0) {
            await this.loadNewAreas(newAreas, zoom);
          }

          if (gridIdsToRemove.length > 0) {
            await this.removeOldAreas(gridIdsToRemove);
          }

          // 仅使用WebGL渲染
        } else {
          logger.info('✅ 无需增量更新，所有像素都在当前视窗内');
          // 仅使用WebGL渲染
        }
      } else if (isSignificantZoom) {
        // 大幅缩放：强制全量重新加载
        logger.info('🔄 大幅缩放：清空现有像素并全量重新加载');

        // Canvas清空代码已移除

        // Canvas数据清理已移除

        // 全量加载新像素
        const pixels = await this.getVisiblePixelsEfficient(bounds, zoom);
        await this.updatePixelCache(pixels);

        // 渲染到Canvas
        if (pixels.length > 0) {
          logger.info(`🎨 开始WebGL渲染 ${pixels.length} 个像素...`);

          // 仅使用WebGL渲染
          if (this.webglInitialized) {
            await this.renderPixelsToWebGL(pixels);
            logger.info(`✅ WebGL渲染完成: ${pixels.length}个像素`);
          } else {
            logger.warn('⚠️ WebGL未初始化，等待初始化完成...');
            setTimeout(() => {
              if (this.webglInitialized) {
                this.renderPixelsToWebGL(pixels);
              } else {
                logger.error('❌ WebGL初始化失败，无法渲染像素');
              }
            }, 100);
          }
        }
      } else {
        // 首次加载
        logger.info('🔄 首次加载像素数据');
        const pixels = await this.getVisiblePixelsEfficient(bounds, zoom);
        await this.updatePixelCache(pixels);
        
        // 优化：使用WebGL渲染
        if (pixels.length > 0) {
          logger.info(`🎨 开始WebGL渲染 ${pixels.length} 个像素...`);

          // 仅使用WebGL渲染
          if (this.webglInitialized) {
            await this.renderPixelsToWebGL(pixels);
            logger.info(`✅ WebGL渲染完成: ${pixels.length}个像素`);
          } else {
            logger.warn('⚠️ WebGL未初始化，等待初始化完成...');
            // 延迟重试 - 减少延迟时间
            setTimeout(() => {
              if (this.webglInitialized) {
                this.renderPixelsToWebGL(pixels);
              } else {
                logger.error('❌ WebGL初始化失败，无法渲染像素');
              }
            }, 100);
          }
        }
      }

      // 重要：更新lastBounds和lastZoom，防止重复渲染
      this.lastBounds = bounds;
      this.lastZoom = zoom; // 🔧 修复:记录当前缩放级别
      
      // 延迟刷新图层，等待像素渲染完成
      setTimeout(() => {
        this.refreshLayer();
      }, 100);
      
      logger.info(`🗺️ 图层更新完成`);
      
    } catch (error) {
      logger.error('❌ 更新像素图层失败:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 获取可见区域像素数据 - 使用高德地图标准接口优化版本
   * 基于高德地图API特性，实现高效的视窗控制
   */
  private async getVisiblePixels(bounds: any, zoom: number): Promise<any[]> {
    try {
      // 检查边界是否有效
      if (!bounds || !bounds.getNorthEast || !bounds.getSouthWest) {
        logger.warn('地图边界无效，返回空数组');
        return [];
      }
      
      // 获取地图边界
      let { north, south, east, west } = {
        north: bounds.getNorthEast().lat,
        south: bounds.getSouthWest().lat,
        east: bounds.getNorthEast().lng,
        west: bounds.getSouthWest().lng
      };
      
      // 添加调试信息
      logger.info(`🗺️ 原始地图边界: 北=${north}, 南=${south}, 东=${east}, 西=${west}`);
      
      // 不添加缓冲区，直接使用原始边界
      // north += buffer;
      // south -= buffer;
      // east += buffer;
      // west -= buffer;
      
             logger.info(`🗺️ 使用原始边界: 北=${north}, 南=${south}, 东=${east}, 西=${west}`);

      // 检查坐标是否有效
      if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        logger.warn('地图坐标无效，返回空数组');
        return [];
      }

      // 根据缩放级别动态调整网格大小和限制
      const { gridSize, maxGrids } = this.getDynamicGridConfig(zoom);
      
      // 计算网格范围
      const gridRange = this.calculateGridRange(north, south, east, west, gridSize);
      
      // 检查网格数量是否超出限制
      const gridCount = (gridRange.endX - gridRange.startX + 1) * (gridRange.endY - gridRange.startY + 1);
      
             // 恢复原来的逻辑：所有级别都使用智能采样
       if (gridCount > maxGrids) {
         logger.warn(`⚠️ 网格数量过多 (${gridCount} > ${maxGrids})，使用智能采样`);
         return await this.getSampledPixels(north, south, east, west, zoom, maxGrids);
       }
      
      // 生成网格ID列表
      const gridIds = this.generateGridIds(gridRange);
      
      if (gridIds.length === 0) {
        return [];
      }
      
      logger.info(`🔄 请求 ${gridIds.length} 个网格的像素数据 (缩放级别: ${zoom})`);
      
      // 使用现有的批量获取像素API
      const result = await PixelAPI.getPixelsBatch(gridIds);
      
      if (!result || typeof result !== 'object') {
        return [];
      }
      
      // 修复：正确处理API返回的数据结构
      // API返回格式: { gridId: { pixels: [...] } }
      const allPixels: any[] = [];
      
      Object.values(result).forEach((gridData: any) => {
        if (gridData && gridData.pixels && Array.isArray(gridData.pixels)) {
          gridData.pixels.forEach((pixel: any) => {
            if (pixel && pixel.grid_id) {
              allPixels.push({
                lat: parseFloat(pixel.latitude || pixel.lat),
                lng: parseFloat(pixel.longitude || pixel.lng),
                color: pixel.color,
                pattern: pixel.pattern,
                pattern_id: pixel.pattern_id,
                pattern_anchor_x: pixel.pattern_anchor_x,
                pattern_anchor_y: pixel.pattern_anchor_y,
                pattern_rotation: pixel.pattern_rotation,
                pattern_mirror: pixel.pattern_mirror,
                grid_id: pixel.grid_id,
                user_id: pixel.user_id,
                // 🔧 关键修复：添加pixel_type字段，用于识别广告像素
                pixel_type: pixel.pixel_type || 'normal',
                related_id: pixel.related_id
              });
            }
          });
        }
      });
      
      logger.info(`✅ 获取可见区域像素完成，获取 ${allPixels.length} 个像素`);
      return allPixels;
      
    } catch (error) {
      logger.error('❌ 获取可见区域像素失败:', error);
      return [];
    }
  }

  /**
   * 获取可见区域像素数据 - 使用高德地图标准接口高效版本
   * 使用地理范围直接查询，避免网格ID批量查询
   */
  private async getVisiblePixelsEfficient(bounds: any, zoom: number): Promise<any[]> {
    try {
      // 🔧 关键修复：处理多种边界对象格式
      let north, south, east, west;

      if (!bounds) {
        logger.warn('地图边界为空，使用当前地图边界');
        // 如果没有提供边界，使用当前地图边界
        bounds = this.map ? this.map.getBounds() : null;
      }

      // 处理不同格式的边界对象
      if (!bounds) {
        logger.error('无法获取地图边界，返回空数组');
        return [];
      } else if (bounds.getNorthEast && bounds.getSouthWest) {
        // 高德地图边界对象格式
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        if (!ne || !sw || typeof ne.lat !== 'number' || typeof ne.lng !== 'number' ||
            typeof sw.lat !== 'number' || typeof sw.lng !== 'number') {
          logger.error('高德地图边界对象格式无效，返回空数组', { ne, sw });
          return [];
        }
        north = ne.lat;
        south = sw.lat;
        east = ne.lng;
        west = sw.lng;

        // 🔧 调试：验证边界数据的一致性
        if (this.map) {
          const mapCenter = this.map.getCenter();
          const mapZoom = this.map.getZoom();
          logger.warn('🔍 边界数据一致性检查:', {
            地图中心: { lat: mapCenter.lat, lng: mapCenter.lng },
            查询边界: { north, south, east, west },
            中心是否在边界内: {
              lat: mapCenter.lat >= south && mapCenter.lat <= north,
              lng: mapCenter.lng >= west && mapCenter.lng <= east
            },
            边界与中心的偏差: {
              lat: mapCenter.lat - ((north + south) / 2),
              lng: mapCenter.lng - ((east + west) / 2)
            },
            缩放级别: mapZoom,
            边界范围: {
              latSpan: north - south,
              lngSpan: east - west
            }
          });
        }
      } else if (bounds.north !== undefined && bounds.south !== undefined &&
                 bounds.east !== undefined && bounds.west !== undefined) {
        // 直接的数值边界格式
        north = parseFloat(bounds.north);
        south = parseFloat(bounds.south);
        east = parseFloat(bounds.east);
        west = parseFloat(bounds.west);
      } else {
        logger.error('不支持的边界对象格式，返回空数组', { bounds });
        return [];
      }

      // 验证边界数值的有效性
      if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        logger.error('边界坐标包含NaN值，返回空数组', { north, south, east, west });
        return [];
      }

      // 验证边界逻辑
      if (north <= south || east <= west) {
        logger.error('边界坐标逻辑错误，返回空数组', { north, south, east, west });
        return [];
      }

      // 🔧 关键修复：优化边界查询防抖逻辑，确保地理匹配
      if (this.lastQueryBounds) {
        const boundsDiff = Math.abs(north - this.lastQueryBounds.north) +
                          Math.abs(south - this.lastQueryBounds.south) +
                          Math.abs(east - this.lastQueryBounds.east) +
                          Math.abs(west - this.lastQueryBounds.west);

        // 检查缓存中是否包含当前边界的像素
        const cachedPixels = this.pixelCache ? Object.values(this.pixelCache) : [];
        let hasBoundsPixels = false;

        if (cachedPixels.length > 0) {
          hasBoundsPixels = cachedPixels.some(pixel => {
            return pixel.lat >= south && pixel.lat <= north &&
                   pixel.lng >= west && pixel.lng <= east;
          });
        }

        // 只有在边界几乎相同且缓存中有相关像素时才跳过查询
        if (boundsDiff < 0.0001 && hasBoundsPixels) { // 降低阈值，确保更精确匹配
          logger.debug('⚠️ 边界查询被防抖跳过，使用缓存像素');

          // 过滤出在当前边界内的缓存像素
          const inBoundsCachedPixels = cachedPixels.filter(pixel => {
            return pixel.lat >= south && pixel.lat <= north &&
                   pixel.lng >= west && pixel.lng <= east;
          });

          logger.debug(`✅ 使用边界内缓存像素: ${inBoundsCachedPixels.length} 个`);
          return inBoundsCachedPixels;
        } else if (boundsDiff < 0.001 && !hasBoundsPixels) {
          logger.warn(`⚠️ 边界差异小(${boundsDiff.toFixed(6)})但缓存中无此区域像素，继续查询`);
          // 继续执行查询逻辑，不返回
        }
      }

  
      this.lastQueryBounds = { north, south, east, west };
      logger.info(`🗺️ 高效查询边界: 北=${north}, 南=${south}, 东=${east}, 西=${west}`);

      // 🔧 调试：检查缓存状态和地理分布
      const cacheSize = this.pixelCache ? Object.keys(this.pixelCache).length : 0;
      logger.debug(`🔍 查询前缓存状态: ${cacheSize} 个像素`);

      // 🔧 关键调试：分析缓存像素的地理分布 (移除开发环境限制)
      if (cacheSize > 0) {
        const cachedPixels = Object.values(this.pixelCache);
        const inBoundsPixels = cachedPixels.filter(pixel => {
          return pixel.lat >= south && pixel.lat <= north &&
                 pixel.lng >= west && pixel.lng <= east;
        });

        // 计算地理分布统计
        const centerLat = this.map ? this.map.getCenter().lat : (north + south) / 2;
        const centerLng = this.map ? this.map.getCenter().lng : (east + west) / 2;

        // 计算距离统计（单位：度）
        const distances = cachedPixels.map(pixel => {
          const latDiff = pixel.lat - centerLat;
          const lngDiff = pixel.lng - centerLng;
          return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        });

        const maxDistance = Math.max(...distances);
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

        // 边界尺寸计算
        const latSpan = north - south;
        const lngSpan = east - west;
        const boundsArea = latSpan * lngSpan;

        // 理论像素覆盖率（0.0001度网格）
        const theoreticalPixels = Math.ceil(latSpan / 0.0001) * Math.ceil(lngSpan / 0.0001);

        // 🔧 增强为INFO级别，确保能看到关键信息
        logger.info('🔍 缓存像素地理分布分析:', {
          总像素数: cachedPixels.length,
          边界内像素数: inBoundsPixels.length,
          边界外像素数: cachedPixels.length - inBoundsPixels.length,
          边界内比例: `${(inBoundsPixels.length / cachedPixels.length * 100).toFixed(1)}%`,
          查询边界: { north: north.toFixed(6), south: south.toFixed(6), east: east.toFixed(6), west: west.toFixed(6) },
          当前中心: { lat: centerLat.toFixed(6), lng: centerLng.toFixed(6) },
          缩放级别: zoom,
          边界尺寸: { latSpan: latSpan.toFixed(6), lngSpan: lngSpan.toFixed(6), area: boundsArea.toFixed(6) },
          距离统计: { 最大距离度: maxDistance.toFixed(6), 平均距离度: avgDistance.toFixed(6) },
          理论像素数: theoreticalPixels,
          实际覆盖率: `${(cachedPixels.length / theoreticalPixels * 100).toFixed(1)}%`
        });

        // 显示边界内像素样本
        if (inBoundsPixels.length > 0) {
          logger.info('✅ 边界内像素样本:', inBoundsPixels.slice(0, 3).map(p => ({
            grid_id: p.grid_id,
            lat: p.lat.toFixed(6),
            lng: p.lng.toFixed(6),
            color: p.color,
            pattern_id: p.pattern_id
          })));
        } else {
          // 🔧 关键问题：显示最近的像素位置和详细信息
          const sortedByDistance = cachedPixels
            .map((pixel, index) => ({
              pixel,
              distance: distances[index]
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);

          logger.info('🚨 关键问题：缓存有像素但当前查询边界内无像素！');
          logger.info('📍 最近像素位置 (前5个):', sortedByDistance.map(item => ({
            grid_id: item.pixel.grid_id,
            lat: item.pixel.lat.toFixed(6),
            lng: item.pixel.lng.toFixed(6),
            距离中心度: item.distance.toFixed(6),
            在查询边界内: item.pixel.lat >= south && item.pixel.lat <= north && item.pixel.lng >= west && item.pixel.lng <= east
          })));

          // 🔧 添加缓存地理范围分析
          const latRange = { min: Math.min(...cachedPixels.map(p => p.lat)), max: Math.max(...cachedPixels.map(p => p.lat)) };
          const lngRange = { min: Math.min(...cachedPixels.map(p => p.lng)), max: Math.max(...cachedPixels.map(p => p.lng)) };

          logger.warn('🔍 地理范围不匹配详情:', {
            查询边界纬度: `${south.toFixed(6)} ~ ${north.toFixed(6)}`,
            查询边界经度: `${west.toFixed(6)} ~ ${east.toFixed(6)}`,
            缓存纬度范围: `${latRange.min.toFixed(6)} ~ ${latRange.max.toFixed(6)}`,
            缓存经度范围: `${lngRange.min.toFixed(6)} ~ ${lngRange.max.toFixed(6)}`,
            纬度重叠: latRange.min <= north && latRange.max >= south,
            经度重叠: lngRange.min <= east && lngRange.max >= west,
            可能原因: '缓存像素的地理位置与当前查询区域不匹配'
          });

          logger.warn(`💡 建议解决方案:`);
          logger.warn(`   1. 检查像素数据的地理坐标是否正确`);
          logger.warn(`   2. 确认当前地图位置是否在像素数据区域内`);
          logger.warn(`   3. 验证坐标系统或投影转换是否正确`);
        }
      }

      // 检查坐标是否有效
      if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        logger.warn('地图坐标无效，返回空数组');
        return [];
      }

      // 使用新的高效API
      const result = await PixelAPI.getPixelsByArea({ north, south, east, west }, zoom);
      
      if (!result || !result.success) {
        logger.warn('高效API返回无效数据');
        return [];
      }

      // 🔧 关键修复：确保 result.pixels 是有效数组
      if (!result.pixels || !Array.isArray(result.pixels)) {
        logger.warn('高效API返回的pixels不是有效数组:', result.pixels);
        return [];
      }

      // 转换数据格式，包含完整的pattern_assets信息
      let pixels;
      try {
        pixels = result.pixels.map((pixel: any) => ({
          lat: parseFloat(pixel.latitude),
          lng: parseFloat(pixel.longitude),
          color: pixel.color,
          pattern_id: pixel.pattern_id,
          pattern_anchor_x: pixel.pattern_anchor_x,
          pattern_anchor_y: pixel.pattern_anchor_y,
          pattern_rotation: pixel.pattern_rotation,
          pattern_mirror: pixel.pattern_mirror,
          grid_id: pixel.grid_id, // 使用数据库中的grid_id，而不是重新计算
          user_id: pixel.user_id,
          // 🔧 关键修复：添加pattern_assets的渲染信息
          render_type: pixel.render_type || 'color',
          unicode_char: pixel.unicode_char,
          material_id: pixel.material_id,
          encoding: pixel.encoding,
          payload: pixel.payload,
          // 🔧 关键修复：添加pixel_type字段，用于识别广告像素
          pixel_type: pixel.pixel_type || 'normal',
          related_id: pixel.related_id
        }));
      } catch (mapError) {
        logger.error('❌ 像素数据转换失败:', mapError);
        logger.error('❌ 原始数据:', result.pixels);
        return [];
      }

      // 🔧 统计像素类型分布
      const pixelTypesCount = pixels.reduce((acc: any, p: any) => {
        const type = p.pixel_type || 'normal';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      logger.info(`✅ 高效查询完成: ${pixels.length} 个像素 (缩放级别: ${zoom})`, {
        pixelTypes: pixelTypesCount,
        hasAdvertisement: pixelTypesCount['advertisement'] > 0,
        hasAd: pixelTypesCount['ad'] > 0,
        hasBomb: pixelTypesCount['bomb'] > 0
      });

      // 🔧 新增：详细检查广告像素数据
      const adPixels = pixels.filter(p => p.pixel_type === 'ad');
      if (adPixels.length > 0) {
        logger.info(`🎯 发现广告像素 (${adPixels.length}个):`, adPixels.map(p => ({
          grid_id: p.grid_id,
          lat: p.lat,
          lng: p.lng,
          color: p.color,
          render_type: p.render_type,
          pixel_type: p.pixel_type,
          related_id: p.related_id
        })));
      } else {
        logger.warn('⚠️ 当前视域内没有发现广告像素 (pixel_type="ad")');
        // 打印所有像素类型用于调试
        const allTypes = [...new Set(pixels.map(p => p.pixel_type))];
        logger.info('📋 当前视域内的像素类型:', allTypes);
      }

      if (result.limited) {
        logger.warn(`⚠️ 像素数量被限制: ${result.limited}/${result.total}`);
      }

      return pixels;
      
    } catch (error) {
      logger.error('❌ 高效查询失败:', error);
      // 降级到原有方法
      logger.info('🔄 降级到原有网格查询方法');
      return await this.getVisiblePixels(bounds, zoom);
    }
  }

  /**
   * 根据缩放级别获取动态网格配置 - 简化版本
   */
  private getDynamicGridConfig(zoom: number) {
    // 统一使用 0.0001 网格大小，与数据库保持一致
    // 这样可以确保前端请求的网格ID与数据库中的格式一致
    
    // 根据缩放级别动态调整最大网格数量：高缩放级别允许更多网格，低缩放级别限制网格数量
    let maxGrids = 100000;
    if (zoom >= 25) {
      maxGrids = 20000; // 最大缩放级别：允许更多网格，因为实际像素数量少
    } else if (zoom >= 20) {
      maxGrids = 15000; // 高缩放级别：允许较多网格
    } else if (zoom >= 17) {
      maxGrids = 10000; // 中等缩放级别：中等网格数量
    } else if (zoom >= 16) {
      maxGrids = 8000; // 较低缩放级别：限制网格数量
    } else if (zoom >= 15) {
      maxGrids = 5000; // 最低缩放级别：严格限制网格数量，因为像素数量多
    }
    
    return { 
      gridSize: this.config.baseGridSize, // 使用配置中的基础网格大小
      maxGrids 
    };
  }

  /**
   * 智能采样像素 - 使用高德地图标准接口，当网格数量过多时使用
   */
  private async getSampledPixels(north: number, south: number, east: number, west: number, zoom: number, maxGrids: number) {
    try {
      logger.info(`🎯 使用智能采样，目标网格数: ${maxGrids}`);
      
      // 计算采样间隔
      const totalGrids = Math.ceil((east - west) / 0.0001) * Math.ceil((north - south) / 0.0001);
      let sampleInterval = Math.ceil(Math.sqrt(totalGrids / maxGrids));
      
      // 根据缩放级别调整采样间隔：高缩放级别降低采样间隔，低缩放级别提高采样间隔
      if (zoom >= 25) {
        sampleInterval = Math.max(sampleInterval, 1); // 最大缩放级别：最小采样间隔，因为像素数量少
      } else if (zoom >= 20) {
        sampleInterval = Math.max(sampleInterval, 2); // 高缩放级别：较小采样间隔
      } else if (zoom >= 17) {
        sampleInterval = Math.max(sampleInterval, 3); // 中等缩放级别：中等采样间隔
      } else if (zoom >= 16) {
        sampleInterval = Math.max(sampleInterval, 5); // 较低缩放级别：较大采样间隔
      } else if (zoom >= 15) {
        sampleInterval = Math.max(sampleInterval, 8); // 最低缩放级别：最大采样间隔，因为像素数量多
      }
      
      logger.info(`📊 采样间隔: ${sampleInterval}, 总网格数: ${totalGrids}, 缩放级别: ${zoom}`);
      
      // 生成采样的网格ID
      const gridIds: string[] = [];
      const gridSize = 0.0001;
      
      // 生成常规采样的网格ID
      for (let x = Math.floor((west + 180) / gridSize); x <= Math.ceil((east + 180) / gridSize); x += sampleInterval) {
        for (let y = Math.floor((south + 90) / gridSize); y <= Math.ceil((north + 90) / gridSize); y += sampleInterval) {
          const gridId = `grid_${x}_${y}`;
          if (!gridIds.includes(gridId)) {
            gridIds.push(gridId);
          }
          
          if (gridIds.length >= maxGrids) break;
        }
        if (gridIds.length >= maxGrids) break;
      }
      
      if (gridIds.length === 0) {
        return [];
      }
      
      logger.info(`🔄 采样请求 ${gridIds.length} 个网格`);
      
      const result = await PixelAPI.getPixelsBatch(gridIds);
      
      if (!result || typeof result !== 'object') {
        return [];
      }
      
      // 修复：正确处理API返回的数据结构
      // API返回格式: { gridId: { pixels: [...] } }
      const allPixels: any[] = [];
      
      Object.values(result).forEach((gridData: any) => {
        if (gridData && gridData.pixels && Array.isArray(gridData.pixels)) {
          gridData.pixels.forEach((pixel: any) => {
            if (pixel && pixel.grid_id) {
              allPixels.push({
                lat: parseFloat(pixel.latitude || pixel.lat),
                lng: parseFloat(pixel.longitude || pixel.lng),
                color: pixel.color,
                pattern: pixel.pattern,
                pattern_id: pixel.pattern_id,
                pattern_anchor_x: pixel.pattern_anchor_x,
                pattern_anchor_y: pixel.pattern_anchor_y,
                pattern_rotation: pixel.pattern_rotation,
                pattern_mirror: pixel.pattern_mirror,
                grid_id: pixel.grid_id,
                user_id: pixel.user_id,
                // 🔧 关键修复：添加pixel_type字段，用于识别广告像素
                pixel_type: pixel.pixel_type || 'normal',
                related_id: pixel.related_id
              });
            }
          });
        }
      });
      
      logger.info(`✅ 智能采样完成，获取 ${allPixels.length} 个像素`);
      return allPixels;
      
    } catch (error) {
      logger.error('❌ 智能采样失败:', error);
      return [];
    }
  }

  /**
   * 生成网格ID列表
   */
  private generateGridIds(gridRange: { startX: number; endX: number; startY: number; endY: number }): string[] {
    const gridIds: string[] = [];
    for (let x = gridRange.startX; x <= gridRange.endX; x++) {
      for (let y = gridRange.startY; y <= gridRange.endY; y++) {
        gridIds.push(`grid_${x}_${y}`);
      }
    }
    return gridIds;
  }

  /**
   * 计算网格范围
   */
  private calculateGridRange(north: number, south: number, east: number, west: number, gridSize: number) {
    // 🔧 关键修复：使用与后端完全一致的网格ID计算逻辑
    // 后端使用: Math.floor((lng + 180) / gridSize) 和 Math.floor((lat + 90) / gridSize)
    const startX = Math.floor((west + 180) / gridSize);
    const endX = Math.floor((east + 180) / gridSize);  // 修复：使用 floor 而不是 ceil
    const startY = Math.floor((south + 90) / gridSize);
    const endY = Math.floor((north + 90) / gridSize);  // 修复：使用 floor 而不是 ceil

    // 🔧 调试日志：记录网格范围计算
    const gridCount = (endX - startX + 1) * (endY - startY + 1);
    logger.info(`🔧 网格范围计算:`, {
      边界: { north: north.toFixed(6), south: south.toFixed(6), east: east.toFixed(6), west: west.toFixed(6) },
      网格索引: { startX, endX, startY, endY },
      网格数量: gridCount,
      网格大小: gridSize
    });

    return { startX, endX, startY, endY };
  }

  /**
   * 更新像素缓存 - 优化版本
   * 智能管理缓存，避免内存泄漏
   */
  private async updatePixelCache(pixels: any[]) {
    const now = Date.now();

    // 🔧 调试：检查传入的像素数据
    logger.debug('🔍 updatePixelCache输入检查:', {
      pixelsLength: pixels.length,
      pixelsSample: pixels.slice(0, 3).map(p => ({
        grid_id: p.grid_id,
        lat: p.lat,
        lng: p.lng,
        color: p.color,
        pattern_id: p.pattern_id,
        pixel_type: p.pixel_type,
        related_id: p.related_id,
        render_type: p.render_type,
        unicode_char: p.unicode_char
      }))
    });

    // 🔧 新增：统计像素类型分布
    const pixelTypesCount = pixels.reduce((acc: any, p: any) => {
      const type = p.pixel_type || 'normal';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    logger.info('📊 像素类型统计 (updatePixelCache):', pixelTypesCount);

    // 🔧 调试：详细检查广告像素
    const adPixels = pixels.filter(p => p.pixel_type === 'ad');
    if (adPixels.length > 0) {
      logger.info(`🎯 检测到 ${adPixels.length} 个广告像素:`, adPixels.map(p => ({
        grid_id: p.grid_id,
        color: p.color,
        pattern_id: p.pattern_id,
        render_type: p.render_type,
        unicode_char: p.unicode_char,
        material_id: p.material_id
      })));
    }
    const maxCacheAge = 5 * 60 * 1000; // 5分钟缓存过期时间
    const maxCacheSize = 5000; // 最大缓存像素数量
    
    // 优化：批量清理缓存，减少遍历次数
    const cacheEntries = Object.entries(this.pixelCache);
    const needsCleanup = cacheEntries.length > maxCacheSize;
    
    if (needsCleanup) {
      logger.info(`🧹 缓存清理: ${cacheEntries.length} -> ${maxCacheSize} 个像素`);
      
      // 按时间戳排序，保留最新的像素
      cacheEntries.sort((a, b) => (b[1] as any).timestamp - (a[1] as any).timestamp);
      
      // 清空缓存，只保留最新的像素
      this.pixelCache = {};
      cacheEntries.slice(0, maxCacheSize).forEach(([gridId, pixel]) => {
        this.pixelCache[gridId] = pixel as any;
      });
    }
    
    // 优化：只在需要时清理过期缓存
    if (needsCleanup || now % 30000 < 1000) { // 每30秒清理一次
      Object.keys(this.pixelCache).forEach(gridId => {
        const pixel = this.pixelCache[gridId];
        if (now - pixel.timestamp > maxCacheAge) {
          delete this.pixelCache[gridId];
        }
      });
    }
    
    // 优化：批量添加新像素
    const newPixels: any = {};
    pixels.forEach(pixel => {
      // 检查是否为GPS轨迹像素
      const isGPSTrackPixel = this.isGPSTrackPixel(pixel.grid_id);

      // 获取现有像素的访问统计
      const existingPixel = this.pixelCache[pixel.grid_id];
      const accessCount = existingPixel ? (existingPixel.accessCount || 0) + 1 : 1;

      newPixels[pixel.grid_id] = {
        lat: pixel.lat,
        lng: pixel.lng,
        color: pixel.color,
        pattern: pixel.pattern,
        pattern_id: pixel.pattern_id,
        pattern_anchor_x: pixel.pattern_anchor_x,
        pattern_anchor_y: pixel.pattern_anchor_y,
        pattern_rotation: pixel.pattern_rotation,
        pattern_mirror: pixel.pattern_mirror,
        user_id: pixel.user_id,
        // 🔧 关键修复：添加渲染相关字段，确保广告和炸弹像素能正确渲染
        pixel_type: pixel.pixel_type || 'normal',
        related_id: pixel.related_id,
        render_type: pixel.render_type || 'color',
        unicode_char: pixel.unicode_char,
        material_id: pixel.material_id,
        encoding: pixel.encoding,
        payload: pixel.payload,
        timestamp: now,
        isGPSTrackPixel: isGPSTrackPixel,
        accessCount: accessCount,
        lastAccessed: now
      };
    });
    
    // 一次性合并新像素到缓存
    Object.assign(this.pixelCache, newPixels);

    logger.info(`📊 缓存更新完成: ${Object.keys(this.pixelCache).length} 个像素`);

    // 🔥 优化：缓存更新后的渲染需要防抖，避免频繁更新
    const currentTime = Date.now();
    if (currentTime - this.lastCacheUpdateTime >= this.cacheUpdateDebounceDelay) {
      this.lastCacheUpdateTime = currentTime;

      // 🔥 关键修复：缓存更新后立即渲染到WebGL (仅在非WebSocket批量更新时)
      const pixelArray = Object.values(newPixels);
      if (pixelArray.length > 0) {
        logger.info(`🎨 缓存更新后立即渲染 ${pixelArray.length} 个像素到WebGL`);
        await this.renderPixelsToWebGL(pixelArray);
      }
    } else {
      logger.debug('⚠️ 缓存更新渲染被防抖跳过，避免频繁渲染');
    }
  }

  /**
   * 刷新图层
   */
  private refreshLayer() {
    // 🔧 修复：检查缩放级别是否满足条件
    if (this.map) {
      const zoom = this.map.getZoom();
      if (zoom < this.config.minZoom || zoom > this.config.maxZoom) {
        logger.info(`⚠️ 缩放级别不满足条件 (${zoom} < ${this.config.minZoom} 或 > ${this.config.maxZoom})，跳过图层刷新`);
        return;
      }
    }
    
    if (this.pixelLayer && this.pixelLayer.redraw) {
      this.pixelLayer.redraw();
    }
  }

    /**
   * 添加单个像素（支持UNICODE渲染）
   */
  public async addPixel(pixel: any) {
    if (!pixel || !pixel.grid_id) {
      logger.warn('❌ 像素数据无效');
      return;
    }
    
    if (!(window as any).AMap) {
      logger.warn('❌ 高德地图API未加载');
      return;
    }
    
    if (!this.pixelLayer) {
      logger.warn('❌ 像素图层未初始化，尝试重新初始化');
      this.initPixelLayer();
      if (!this.pixelLayer) {
        logger.error('❌ 像素图层初始化失败');
        return;
      }
    }
    
    const AMap = (window as any).AMap;
    
    try {
      // 🔧 修复：在绘制新像素之前，确保完全清理旧覆盖物
      logger.info(`✅ 开始绘制: ${pixel.grid_id} at (${pixel.lat}, ${pixel.lng})`);
      
      // 第一步：确保像素位置完全清理 - 移除所有类型的旧覆盖物
      await this.ensurePixelCleanup(pixel.grid_id);
      
      // 检查是否为GPS轨迹像素
      const isGPSTrackPixel = this.isGPSTrackPixel(pixel.grid_id);
      if (isGPSTrackPixel) {
        logger.info(`🗺️ 检测到GPS轨迹像素: ${pixel.grid_id}`);
      }
      
      // 仅使用WebGL渲染
      if (this.webglInitialized) {
        await this.renderPixelsToWebGL([pixel]);
      } else {
        // WebGL渲染未启用，等待初始化完成
        logger.warn('⚠️ WebGL未初始化，等待初始化完成...');
        // 延迟重试
        setTimeout(() => {
          if (this.webglInitialized) {
            this.renderPixelsToWebGL([pixel]);
          } else {
            logger.error('❌ WebGL初始化失败，无法添加像素');
          }
        }, 1000);
      }
      
      // 更新像素访问统计
      this.updatePixelAccessStats(pixel.grid_id);
      
      logger.info(`✅ 图层服务添加像素成功: ${pixel.grid_id}`);
      
    } catch (error) {
      logger.error('添加像素失败:', error);
    }
  }



  /**
   * 添加emoji像素 - 使用WebGL渲染
   */
  private async addEmojiPixel(pixel: any, AMap: any) {
    await this.renderPixelsToWebGL([pixel]);
  }

  /**
   * 创建emoji DOM元素 - 使用简化的大小计算
   */
  private createEmojiElement(unicode: string): HTMLElement {
    const emojiSize = this.getEmojiSize();
    const roundedSize = Math.round(emojiSize);
    
    // 检查元素缓存，限制缓存大小提升性能
    if (this.emojiElementCache.has(roundedSize)) {
      const cachedElement = this.emojiElementCache.get(roundedSize)!.cloneNode(true) as HTMLElement;
      cachedElement.textContent = unicode;
      return cachedElement;
    }
    
    // 缓存大小限制，防止内存泄漏
    if (this.emojiElementCache.size >= this.maxEmojiCacheSize) {
      const firstKey = this.emojiElementCache.keys().next().value;
      if (firstKey !== undefined) {
        this.emojiElementCache.delete(firstKey);
      }
    }
    
    // 创建新元素
    const container = document.createElement('div');
    const styleCache = this.getEmojiStyleCache(emojiSize);
    
    // 使用高性能的样式设置
    container.style.width = `${styleCache.size}px`;
    container.style.height = `${styleCache.size}px`;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.9), rgba(255, 193, 7, 0.9))';
    container.style.borderRadius = `${styleCache.borderRadius}px`;
    container.style.border = `${styleCache.borderWidth}px solid rgba(255, 215, 0, 1)`;
    container.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    container.style.fontSize = `${styleCache.fontSize}px`;
    container.style.lineHeight = '1';
    container.style.textAlign = 'center';
    container.style.userSelect = 'none';
    // 🔧 修复：移除 pointerEvents: 'none'，允许 emoji 像素接收点击事件
    // container.style.pointerEvents = 'none';
    container.style.zIndex = '800'; // 🔥 修复：提高emoji像素z-index，确保不被网格线遮挡
    container.style.fontFamily = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiSymbols', 'EmojiOne Mozilla', 'Twemoji Mozilla', 'Segoe UI Symbol', Arial, sans-serif";
    container.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
    
    container.textContent = unicode;
    
    // 缓存元素模板（限制缓存大小）
    if (this.emojiElementCache.size < 10) {
      this.emojiElementCache.set(roundedSize, container.cloneNode(true) as HTMLElement);
    }
    
    return container;
  }

  /**
   * 判断是否为Emoji像素 - 使用高德地图标准接口
   */
  private isEmojiPixel(pixel: any): boolean {
    return typeof pixel.color === 'string' && 
           pixel.color.length > 0 && 
           /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(pixel.color);
  }

  
  
  
  /**
   * 计算像素边界
   */
  private calculatePixelBounds(pixels: any[]): { north: number, south: number, east: number, west: number } {
    if (pixels.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }
    
    let north = pixels[0].lat;
    let south = pixels[0].lat;
    let east = pixels[0].lng;
    let west = pixels[0].lng;
    
    pixels.forEach(pixel => {
      north = Math.max(north, pixel.lat);
      south = Math.min(south, pixel.lat);
      east = Math.max(east, pixel.lng);
      west = Math.min(west, pixel.lng);
    });
    
    return { north, south, east, west };
  }

  /**
   * 计算新增区域 - 使用高德地图标准接口原生边界计算
   */
  private calculateNewAreas(oldBounds: any, newBounds: any): any[] {
    const areas = [];
    
    const oldNorth = oldBounds.getNorthEast().lat;
    const oldSouth = oldBounds.getSouthWest().lat;
    const oldEast = oldBounds.getNorthEast().lng;
    const oldWest = oldBounds.getSouthWest().lng;
    
    const newNorth = newBounds.getNorthEast().lat;
    const newSouth = newBounds.getSouthWest().lat;
    const newEast = newBounds.getNorthEast().lng;
    const newWest = newBounds.getSouthWest().lng;
    
    // 使用高德地图原生 AMap.Bounds 创建区域
    const AMap = (window as any).AMap;
    
    // 计算新增的四个区域：北、南、东、西
    if (newNorth > oldNorth) {
      // 新增北部区域
      const northBounds = new AMap.Bounds(
        [newWest, oldNorth],  // 西南角
        [newEast, newNorth]   // 东北角
      );
      areas.push(northBounds);
    }
    
    if (newSouth < oldSouth) {
      // 新增南部区域
      const southBounds = new AMap.Bounds(
        [newWest, newSouth],  // 西南角
        [newEast, oldSouth]   // 东北角
      );
      areas.push(southBounds);
    }
    
    if (newEast > oldEast) {
      // 新增东部区域
      const eastBounds = new AMap.Bounds(
        [oldEast, newSouth],  // 西南角
        [newEast, newNorth]   // 东北角
      );
      areas.push(eastBounds);
    }
    
    if (newWest < oldWest) {
      // 新增西部区域
      const westBounds = new AMap.Bounds(
        [newWest, newSouth],  // 西南角
        [oldWest, newNorth]   // 东北角
      );
      areas.push(westBounds);
    }
    
    logger.info(`📊 计算新增区域: ${areas.length} 个区域`);
    areas.forEach((bounds, index) => {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      logger.info(`  - 区域${index + 1}: 北${ne.lat.toFixed(6)}, 南${sw.lat.toFixed(6)}, 东${ne.lng.toFixed(6)}, 西${sw.lng.toFixed(6)}`);
    });
    
    return areas;
  }

  /**
   * 计算需要移除的区域 - 使用高德地图标准接口优化版本，增强GPS轨迹像素保护
   */
  private calculateRemovedAreas(oldBounds: any, newBounds: any): string[] {
    // 检查是否应该强制保留像素
    if (this.shouldForceKeepPixels()) {
      logger.info('🔒 强制保留模式激活，跳过像素移除计算');
      return [];
    }
    
    const gridIdsToRemove: string[] = [];
    
    const oldNorth = oldBounds.getNorthEast().lat;
    const oldSouth = oldBounds.getSouthWest().lat;
    const oldEast = oldBounds.getNorthEast().lng;
    const oldWest = oldBounds.getSouthWest().lng;
    
    const newNorth = newBounds.getNorthEast().lat;
    const newSouth = newBounds.getSouthWest().lat;
    const newEast = newBounds.getNorthEast().lng;
    const newWest = newBounds.getSouthWest().lng;
    
    // 获取当前缩放级别
    let currentZoom = this.map.getZoom();
    if (currentZoom > 18) currentZoom = 18;
    
    logger.info(`🔍 检查像素边界: 新边界 北=${newNorth.toFixed(6)}, 南=${newSouth.toFixed(6)}, 东=${newEast.toFixed(6)}, 西=${newWest.toFixed(6)}, 缩放级别=${currentZoom}`);
    
    // 验证新边界的合理性
    if (this.isInvalidBounds(newNorth, newSouth, newEast, newWest)) {
      logger.warn('⚠️ 检测到无效的新边界，跳过像素移除计算');
      return [];
    }
    
    // 根据缩放级别和GPS轨迹状态动态调整缓冲区大小
    const buffer = this.calculateSmartBuffer(currentZoom);
    
    // 智能边界检测：如果新边界完全包含旧边界，则不移除任何像素
    const isNewBoundsContainsOld = newNorth >= oldNorth && newSouth <= oldSouth && 
                                   newEast >= oldEast && newWest <= oldWest;
    
    if (isNewBoundsContainsOld) {
      logger.info('✅ 新边界完全包含旧边界，保留所有现有像素');
      return [];
    }
    
    // 计算需要移除的网格ID
    this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
      // 从gridId解析坐标
      const coords = this.parseGridId(gridId);
      if (!coords) {
        logger.warn(`⚠️ 无法解析网格ID: ${gridId}`);
        return;
      }
      
      const { lat, lng } = coords;
      
      // 检查是否为GPS轨迹像素或重要像素
      const isImportantPixel = this.isImportantPixel(gridId);
      const isGPSTrackPixel = this.isGPSTrackPixel(gridId);
      
      // 重要像素和GPS轨迹像素使用更大的保护缓冲区
      const protectionBuffer = isImportantPixel ? buffer * 3 : 
                              isGPSTrackPixel ? buffer * 2 : buffer;
      
      // 检查像素是否在新边界外（使用智能缓冲区）
      const isOutside = lat > (newNorth + protectionBuffer) || lat < (newSouth - protectionBuffer) || 
                       lng > (newEast + protectionBuffer) || lng < (newWest - protectionBuffer);
      
      if (isOutside) {
        // 额外检查：如果像素在旧边界内，给予更大的容忍度
        const isInOldBounds = lat <= oldNorth && lat >= oldSouth && 
                             lng <= oldEast && lng >= oldWest;
        
        if (isInOldBounds) {
          // 如果像素在旧边界内，使用更大的缓冲区
          const extendedBuffer = protectionBuffer * 1.5;
          const isOutsideExtended = lat > (newNorth + extendedBuffer) || lat < (newSouth - extendedBuffer) || 
                                   lng > (newEast + extendedBuffer) || lng < (newWest - extendedBuffer);
          
          if (!isOutsideExtended) {
            logger.info(`🔄 像素在旧边界内，使用扩展缓冲区保留: ${gridId} at (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            return;
          }
        }
        
        // 最终检查：是否为需要保护的像素
        if (this.shouldProtectPixel(gridId, coords, oldBounds, newBounds)) {
          logger.info(`🛡️ 受保护的像素，保留: ${gridId} at (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
          return;
        }
        
        gridIdsToRemove.push(gridId);
        logger.info(`🗑️ 标记移除像素: ${gridId} at (${lat.toFixed(6)}, ${lng.toFixed(6)}) - 超出新边界 (缓冲区: ${protectionBuffer})`);
      } else {
        logger.info(`✅ 像素在边界内: ${gridId} at (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
      }
    });
    
    logger.info(`🗑️ 计算移除区域: ${gridIdsToRemove.length} 个网格需要移除 (智能缓冲区: ${buffer})`);
    
    return gridIdsToRemove;
  }

  /**
   * 验证边界是否有效 - 增强版本
   */
  private isInvalidBounds(north: number, south: number, east: number, west: number): boolean {
    // 检查边界范围是否合理
    const latRange = Math.abs(north - south);
    const lngRange = Math.abs(east - west);

    // 根据当前缩放级别动态确定最小边界阈值
    let minRange = 0.001; // 默认约100米
    if (this.map) {
      const zoom = this.map.getZoom();
      if (zoom >= 20) {
        minRange = 0.00005; // 约5米 - 超高缩放级别
      } else if (zoom >= 18) {
        minRange = 0.0001; // 约10米 - 高缩放级别
      } else if (zoom >= 16) {
        minRange = 0.0002; // 约20米 - 中高缩放级别
      } else if (zoom >= 14) {
        minRange = 0.0005; // 约50米 - 中等缩放级别
      }
    }

    // 如果边界范围过小，可能是计算错误
    if (latRange < minRange || lngRange < minRange) {
      logger.warn('⚠️ 边界范围过小，可能是计算错误:', { latRange, lngRange, minRange, zoom: this.map?.getZoom() });
      return true;
    }

    // 检查坐标是否在合理范围内
    if (north < -90 || north > 90 || south < -90 || south > 90 ||
        east < -180 || east > 180 || west < -180 || west > 180) {
      logger.warn('⚠️ 边界坐标超出合理范围:', { north, south, east, west });
      return true;
    }

    // 检查边界方向是否正确
    if (north <= south || east <= west) {
      logger.warn('⚠️ 边界方向错误:', { north, south, east, west });
      return true;
    }

    return false;
  }

  /**
   * 根据缩放级别获取动态缓冲区大小 - 优化版本
   */
  private getDynamicBuffer(zoom: number): number {
    // 根据缩放级别调整缓冲区：高缩放级别使用更小的缓冲区，低缩放级别使用更大的缓冲区
    if (zoom >= 20) {
      return 0.0002; // 约20米的缓冲区
    } else if (zoom >= 17) {
      return 0.0003; // 约30米的缓冲区
    } else if (zoom >= 15) {
      return 0.0005; // 约50米的缓冲区
    } else {
      return 0.001; // 约100米的缓冲区
    }
  }

  /**
   * 计算智能缓冲区大小 - 考虑GPS轨迹和用户行为
   */
  private calculateSmartBuffer(zoom: number): number {
    let baseBuffer = this.getDynamicBuffer(zoom);
    
    // 检查是否有活跃的GPS轨迹
    const hasActiveGPSTracks = this.hasActiveGPSTracks();
    
    // 如果有活跃的GPS轨迹，增加缓冲区
    if (hasActiveGPSTracks) {
      baseBuffer *= 1.5; // 活跃GPS轨迹时增加50%缓冲区
      logger.info(`🗺️ 检测到活跃GPS轨迹，缓冲区增加到: ${baseBuffer} (约${(baseBuffer * 111000).toFixed(0)}米)`);
    }
    
    return baseBuffer;
  }

  /**
   * 检查是否有活跃的GPS轨迹
   */
  private hasActiveGPSTracks(): boolean {
    // 检查当前图层中是否有GPS轨迹像素
    if (!this.pixelLayer || this.pixelLayer.overlays.size === 0) {
      return false;
    }
    
    let gpsTrackCount = 0;
    this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
      if (this.isGPSTrackPixel(gridId)) {
        gpsTrackCount++;
      }
    });
    
    return gpsTrackCount > 0;
  }

  /**
   * 判断是否为GPS轨迹像素
   */
  private isGPSTrackPixel(gridId: string): boolean {
    // 检查像素缓存中是否有GPS轨迹标识
    const pixel = this.pixelCache[gridId];
    if (pixel && pixel.isGPSTrackPixel) {
      return true;
    }
    
    // 检查网格ID是否包含GPS轨迹标识
    if (gridId.includes('gps_') || gridId.includes('track_')) {
      return true;
    }
    
    return false;
  }

  /**
   * 判断是否为重要像素
   */
  private isImportantPixel(gridId: string): boolean {
    const pixel = this.pixelCache[gridId];
    if (!pixel) return false;
    
    // 检查访问频率
    if (pixel.accessCount && pixel.accessCount > 5) {
      return true;
    }
    
    // 检查最后访问时间（最近访问的像素更重要）
    if (pixel.lastAccessed && (Date.now() - pixel.lastAccessed) < 10 * 60 * 1000) { // 10分钟内
      return true;
    }
    
    // 检查是否为特殊类型的像素
    if (pixel.isEmoji || pixel.pattern_id) {
      return true;
    }
    
    return false;
  }

  /**
   * 判断是否应该保护像素
   */
  private shouldProtectPixel(
    gridId: string, 
    coords: { lat: number; lng: number }, 
    oldBounds: any, 
    newBounds: any
  ): boolean {
    // GPS轨迹像素永远保护
    if (this.isGPSTrackPixel(gridId)) {
      return true;
    }
    
    // 重要像素保护
    if (this.isImportantPixel(gridId)) {
      return true;
    }
    
    // 检查是否在用户常用区域内
    if (this.isInUserFrequentArea(coords)) {
      return true;
    }
    
    // 检查是否为边界像素（防止边界闪烁）
    if (this.isBoundaryPixel(coords, oldBounds)) {
      return true;
    }
    
    return false;
  }

  /**
   * 检查是否在用户常用区域内
   */
  private isInUserFrequentArea(coords: { lat: number; lng: number }): boolean {
    // 这里可以扩展为检查用户历史访问记录
    // 暂时返回false，后续可以基于用户行为数据优化
    return false;
  }

  /**
   * 检查是否为边界像素
   */
  private isBoundaryPixel(coords: { lat: number; lng: number }, bounds: any): boolean {
    if (!bounds) return false;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // 检查是否接近边界（使用小缓冲区）
    const boundaryBuffer = 0.0001; // 约10米
    const isNearBoundary = coords.lat >= (ne.lat - boundaryBuffer) || 
                           coords.lat <= (sw.lat + boundaryBuffer) || 
                           coords.lng >= (ne.lng - boundaryBuffer) || 
                           coords.lng <= (sw.lng + boundaryBuffer);
    
    return isNearBoundary;
  }

  /**
   * 加载新区域 - 只加载新增区域的像素，使用高德地图标准接口
   */
  private async loadNewAreas(areas: any[], zoom: number) {
    if (areas.length === 0) return;
    
    logger.info(`📥 开始加载 ${areas.length} 个新增区域的像素`);
    
    for (const area of areas) {
      logger.info(`  - 加载区域: ${area.toString()}`);
      
      const pixels = await this.getVisiblePixelsEfficient(area, zoom);
      
      // 过滤掉已经存在的像素
      const newPixels = pixels.filter((pixel: any) => !this.pixelLayer.overlays.has(pixel.grid_id));
      
      if (newPixels.length > 0) {
        logger.info(`    📊 获取到 ${pixels.length} 个像素，其中 ${newPixels.length} 个为新像素`);

        await this.updatePixelCache(newPixels);
        // batchRenderPixels 已在 updatePixelCache 中调用，避免重复渲染
      } else {
        logger.info(`    ⚠️ 该区域没有新的像素需要加载`);
      }
    }
    
    logger.info(`✅ 新增区域加载完成`);
  }

  /**
   * 移除旧区域 - 只移除不再可见的像素，使用高德地图标准批量操作
   */
  private async removeOldAreas(gridIdsToRemove: string[]) {
    if (gridIdsToRemove.length === 0) return;
    
    logger.info(`🗑️ 开始移除 ${gridIdsToRemove.length} 个不再可见的像素`);
    
    // 收集需要移除的覆盖物
    const overlaysToRemove: any[] = [];
    const gridIdsToDelete: string[] = [];
    
    gridIdsToRemove.forEach(gridId => {
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay) {
        overlaysToRemove.push(overlay);
        gridIdsToDelete.push(gridId);
        logger.info(`🗑️ 准备移除像素: ${gridId}`);
      }
    });
    
    // 批量移除覆盖物
    if (overlaysToRemove.length > 0) {
      this.removeOverlaysFromMap(overlaysToRemove);
      
      // 批量清理映射和缓存
      gridIdsToDelete.forEach(gridId => {
        this.pixelLayer.overlays.delete(gridId);
        delete this.pixelCache[gridId];
      });
      
      logger.info(`✅ 批量移除完成，剩余 ${this.pixelLayer.overlays.size} 个像素`);
    } else {
      logger.info(`⚠️ 没有找到需要移除的覆盖物`);
    }
  }

  /**
   * 从对象池获取Marker - 使用高德地图标准接口
   */
  private getMarkerFromPool(): any {
    return null;
  }

  /**
   * 回收Marker到对象池 - 使用高德地图标准接口
   */
  private recycleMarker(marker: any) {
    // WebGL渲染模式下无需处理Marker回收
  }

  /**
   * 添加自定义图像像素 - 处理PNG base64编码的自定义图案
   */
  private async addCustomImagePixel(pixel: any, pattern: any, AMap: any) {
    // Canvas像素添加代码已移除
  }

  /**
   * 添加图案像素 - 使用固定的像素大小
   */
  private async addPatternPixel(pixel: any, AMap: any) {
    // Canvas像素添加代码已移除
  }

  /**
   * 添加普通颜色像素 - 使用固定的像素大小
   */
  private async addColorPixel(pixel: any, AMap: any) {
    // Canvas像素添加代码已移除
  }

  /**
   * 使用高德地图标准接口添加覆盖物
   */
  private addOverlayToMap(overlay: any) {
    if (this.map && this.map.add) {
      this.map.add(overlay);
      return overlay;
    }
    return null;
  }

  /**
   * 使用高德地图标准接口移除覆盖物
   */
  private removeOverlayFromMap(overlay: any) {
    if (this.map && this.map.remove && overlay) {
      this.map.remove(overlay);
    }
  }

  /**
   * 等待DOM更新完成
   */
  private async waitForDOMUpdate(): Promise<void> {
    return new Promise(resolve => {
      // 使用双重保险：requestAnimationFrame + setTimeout
      requestAnimationFrame(() => {
        setTimeout(resolve, 10); // 10ms延迟确保DOM更新
      });
    });
  }

  /**
   * 确保像素位置完全清理 - 移除所有类型的旧覆盖物
   */
  private async ensurePixelCleanup(gridId: string): Promise<void> {
    logger.info(`🧹 开始确保像素位置清理: ${gridId}`);
    
    try {
      // 1. 检查是否存在旧覆盖物
      const oldOverlay = this.pixelLayer.overlays.get(gridId);
      if (!oldOverlay) {
        logger.info(`✅ 位置 ${gridId} 无旧覆盖物，无需清理`);
        return;
      }
      
      // 2. 记录旧覆盖物信息用于调试
      const overlayType = oldOverlay.constructor.name;
      logger.info(`🔍 发现旧覆盖物: ${gridId}, 类型: ${overlayType}`);
      
      // 3. 执行彻底清理
      await this.forceCleanupOverlay(gridId);
      
      // 4. 验证清理结果
      const isClean = await this.verifyOverlayRemoval(gridId);
      if (!isClean) {
        logger.warn(`⚠️ 位置 ${gridId} 清理不彻底，尝试二次清理`);
        await this.forceCleanupOverlay(gridId);
      }
      
      logger.info(`✅ 位置 ${gridId} 清理完成`);
      
    } catch (error) {
      logger.error(`❌ 位置 ${gridId} 清理失败:`, error);
      // 即使清理失败，也要继续执行，避免阻塞新像素绘制
    }
  }

  /**
   * 验证覆盖物是否真的被移除
   */
  private async verifyOverlayRemoval(gridId: string): Promise<boolean> {
    try {
      // 等待DOM更新
      await this.waitForDOMUpdate();
      
      // 检查图层映射中是否还有残留
      const remainingInLayer = this.pixelLayer.overlays.has(gridId);
      if (remainingInLayer) {
        logger.warn(`⚠️ 图层映射中仍有残留: ${gridId}`);
        return false;
      }
      
      // 检查缓存中是否还有残留
      const remainingInCache = this.pixelCache[gridId];
      if (remainingInCache) {
        logger.warn(`⚠️ 缓存中仍有残留: ${gridId}`);
        return false;
      }
      
      // 检查地图上是否还有残留的DOM元素
      const remainingDOM = this.checkRemainingDOM(gridId);
      if (remainingDOM) {
        logger.warn(`⚠️ DOM中仍有残留元素: ${gridId}`);
        return false;
      }
      
      logger.info(`✅ 覆盖物移除验证成功: ${gridId}`);
      return true;
      
    } catch (error) {
      logger.error('❌ 覆盖物移除验证失败:', error);
      return false;
    }
  }

  /**
   * 检查DOM中是否还有残留元素
   */
  private checkRemainingDOM(gridId: string): boolean {
    try {
      // 检查可能残留的DOM元素
      const possibleSelectors = [
        `[data-grid-id="${gridId}"]`,
        `[data-pixel-id="${gridId}"]`,
        `[title*="${gridId}"]`,
        `[alt*="${gridId}"]`
      ];
      
      for (const selector of possibleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          logger.warn(`⚠️ 发现残留DOM元素: ${selector}, 数量: ${elements.length}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('检查残留DOM失败:', error);
      return false;
    }
  }

  /**
   * 根据覆盖物类型执行特定的清理策略
   */
  private async cleanupOverlayByType(gridId: string, overlayType: string): Promise<void> {
    logger.info(`🔧 执行类型特定清理: ${gridId}, 类型: ${overlayType}`);
    
    try {
      switch (overlayType) {
        case 'Marker':
          await this.cleanupMarkerOverlay(gridId);
          break;
        case 'Rectangle':
          await this.cleanupRectangleOverlay(gridId);
          break;
        case 'Text':
          await this.cleanupTextOverlay(gridId);
          break;
        default:
          logger.info(`⚠️ 未知覆盖物类型: ${overlayType}, 使用通用清理`);
          await this.cleanupGenericOverlay(gridId);
      }
    } catch (error) {
      logger.error(`❌ 类型特定清理失败: ${gridId}, 类型: ${overlayType}`, error);
    }
  }

  /**
   * 清理Marker类型覆盖物
   */
  private async cleanupMarkerOverlay(gridId: string): Promise<void> {
    try {
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay && overlay.getContent) {
        const content = overlay.getContent();
        if (content && content.parentNode) {
          content.parentNode.removeChild(content);
          logger.info(`✅ Marker覆盖物内容已移除: ${gridId}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Marker覆盖物清理失败: ${gridId}`, error);
    }
  }

  /**
   * 清理Rectangle类型覆盖物
   */
  private async cleanupRectangleOverlay(gridId: string): Promise<void> {
    try {
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay && overlay.setOptions) {
        // 设置透明度和不可见
        overlay.setOptions({
          fillOpacity: 0,
          strokeOpacity: 0,
          visible: false
        });
        logger.info(`✅ Rectangle覆盖物已隐藏: ${gridId}`);
      }
    } catch (error) {
      logger.error(`❌ Rectangle覆盖物清理失败: ${gridId}`, error);
    }
  }

  /**
   * 清理Text类型覆盖物
   */
  private async cleanupTextOverlay(gridId: string): Promise<void> {
    try {
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay && overlay.setOptions) {
        overlay.setOptions({
          visible: false
        });
        logger.info(`✅ Text覆盖物已隐藏: ${gridId}`);
      }
    } catch (error) {
      logger.error(`❌ Text覆盖物清理失败: ${gridId}`, error);
    }
  }

  /**
   * 通用覆盖物清理
   */
  private async cleanupGenericOverlay(gridId: string): Promise<void> {
    try {
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay) {
        // 尝试设置不可见
        if (overlay.setOptions) {
          overlay.setOptions({ visible: false });
        }
        // 尝试从地图移除
        if (this.map && this.map.remove) {
          this.map.remove(overlay);
        }
        logger.info(`✅ 通用覆盖物清理完成: ${gridId}`);
      }
    } catch (error) {
      logger.error(`❌ 通用覆盖物清理失败: ${gridId}`, error);
    }
  }

  /**
   * 强制清理覆盖物 - 激进清理策略
   */
  private async forceCleanupOverlay(gridId: string): Promise<void> {
    logger.info(`🧹 开始激进强制清理覆盖物: ${gridId}`);
    
    try {
      // 1. 获取覆盖物
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (!overlay) {
        logger.info(`✅ 覆盖物不存在，无需清理: ${gridId}`);
        return;
      }
      
      logger.info(`🔍 覆盖物类型: ${overlay.constructor.name}, 状态:`, {
        hasRemove: !!overlay.remove,
        hasDestroy: !!overlay.destroy,
        hasGetContent: !!overlay.getContent,
        hasGetMap: !!overlay.getMap
      });
      
      // 2. 激进移除策略 - 按优先级执行
      const removalStrategies = [
        // 策略1: 标准地图移除
        async () => {
          if (this.map && this.map.remove) {
            this.map.remove(overlay);
            logger.info(`✅ 策略1成功: 标准地图移除`);
            return true;
          }
          return false;
        },
        
        // 策略2: 调用覆盖物的remove方法
        async () => {
          if (overlay.remove && typeof overlay.remove === 'function') {
            overlay.remove();
            logger.info(`✅ 策略2成功: 覆盖物remove方法`);
            return true;
          }
          return false;
        },
        
        // 策略3: 调用覆盖物的destroy方法
        async () => {
          if (overlay.destroy && typeof overlay.destroy === 'function') {
            overlay.destroy();
            logger.info(`✅ 策略3成功: 覆盖物destroy方法`);
            return true;
          }
          return false;
        },
        
        // 策略4: 从DOM中强制移除内容
        async () => {
          if (overlay.getContent && typeof overlay.getContent === 'function') {
            const content = overlay.getContent();
            if (content && content.parentNode) {
              content.parentNode.removeChild(content);
              logger.info(`✅ 策略4成功: DOM强制移除`);
              return true;
            }
          }
          return false;
        },
        
        // 策略5: 查找并移除所有相关DOM元素
        async () => {
          // 查找可能残留的DOM元素
          const possibleSelectors = [
            `[data-grid-id="${gridId}"]`,
            `[data-pixel-id="${gridId}"]`,
            `[title*="${gridId}"]`,
            `[alt*="${gridId}"]`
          ];
          
          let removed = false;
          possibleSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el.parentNode) {
                el.parentNode.removeChild(el);
                removed = true;
                logger.info(`✅ 策略5成功: 移除残留DOM元素 ${selector}`);
              }
            });
          });
          
          return removed;
        }
      ];
      
      // 3. 逐个尝试移除策略
      let cleanupSuccess = false;
      for (let i = 0; i < removalStrategies.length; i++) {
        try {
          const success = await removalStrategies[i]();
          if (success) {
            cleanupSuccess = true;
            logger.info(`🎯 策略${i + 1}执行成功`);
            break; // 一旦成功就停止尝试其他策略
          }
        } catch (error) {
          logger.warn(`⚠️ 策略${i + 1}执行失败:`, error);
        }
      }
      
      // 🔧 新增：类型特定的清理策略
      if (!cleanupSuccess) {
        logger.info(`🔄 尝试类型特定的清理策略: ${gridId}`);
        await this.cleanupOverlayByType(gridId, overlay.constructor.name);
        cleanupSuccess = true; // 标记为成功，避免重复清理
      }
      
      if (!cleanupSuccess) {
        logger.warn(`⚠️ 所有移除策略都失败了: ${gridId}`);
      }
      
      // 4. 等待DOM更新
      await this.waitForDOMUpdate();
      
    } catch (error) {
      logger.error('❌ 激进强制清理过程中发生错误:', error);
    } finally {
      // 5. 强制清理映射和缓存（无论成功与否）
      this.pixelLayer.overlays.delete(gridId);
      delete this.pixelCache[gridId];
      
      // 6. 额外清理：检查是否还有残留
      const remainingOverlay = this.pixelLayer.overlays.get(gridId);
      if (remainingOverlay) {
        logger.warn(`⚠️ 仍有残留覆盖物: ${gridId}，尝试最后清理`);
        this.pixelLayer.overlays.delete(gridId);
      }
      
      logger.info(`✅ 激进强制清理完成: ${gridId}`);
    }
  }

  /**
   * 批量添加覆盖物 - 使用高德地图标准接口，符合 API 2.0 最佳实践
   */
  private addOverlaysToMap(overlays: any[]) {
    return overlays;
  }

  /**
   * 批量移除覆盖物 - 使用高德地图标准接口，符合 API 2.0 最佳实践
   */
  private removeOverlaysFromMap(overlays: any[]) {
    // WebGL渲染模式下不需要移除DOM覆盖物
  }

  /**
   * 计算图案内的X坐标 - 使用高德地图标准接口
   */
  private calculatePatternX(lat: number, lng: number, pixel: any): number {
    const anchorX = pixel.pattern_anchor_x || 0;
    const anchorY = pixel.pattern_anchor_y || 0;
    const rotation = pixel.pattern_rotation || 0;
    const mirror = pixel.pattern_mirror || false;

    // 将世界坐标转换为图案坐标
    let patternX = Math.floor((lng - anchorX) * 1000000) % 32;
    let patternY = Math.floor((lat - anchorY) * 1000000) % 32;

    // 应用旋转
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const rotatedX = patternX * cos - patternY * sin;
      const rotatedY = patternX * sin + patternY * cos;
      
      patternX = rotatedX;
      patternY = rotatedY;
    }

    // 应用镜像
    if (mirror) {
      patternX = 31 - patternX;
    }

    return Math.floor(patternX);
  }

  /**
   * 计算图案内的Y坐标 - 使用高德地图标准接口
   */
  private calculatePatternY(lat: number, lng: number, pixel: any): number {
    const anchorX = pixel.pattern_anchor_x || 0;
    const anchorY = pixel.pattern_anchor_y || 0;
    const rotation = pixel.pattern_rotation || 0;
    const mirror = pixel.pattern_mirror || false;

    // 将世界坐标转换为图案坐标
    let patternX = Math.floor((lng - anchorX) * 1000000) % 32;
    let patternY = Math.floor((lat - anchorY) * 1000000) % 32;

    // 应用旋转
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const rotatedX = patternX * cos - patternY * sin;
      const rotatedY = patternX * sin + patternY * cos;
      
      patternX = rotatedX;
      patternY = rotatedY;
    }

    // 应用镜像
    if (mirror) {
      patternX = 31 - patternX;
    }

    return Math.floor(patternY);
  }

  /**
   * 计算网格ID - 使用配置中的基础网格大小
   */
  private calculateGridId(lat: number, lng: number): string {
    const gridSize = this.config.baseGridSize;
    const x = Math.floor((lng + 180) / gridSize);
    const y = Math.floor((lat + 90) / gridSize);
    return `grid_${x}_${y}`;
  }

  /**
   * 从网格ID解析坐标 - 使用配置中的基础网格大小
   */
  private parseGridId(gridId: string): { lat: number; lng: number } | null {
    try {
      const match = gridId.match(/grid_(-?\d+)_(-?\d+)/);
      if (!match) return null;
      
      const x = parseInt(match[1]);
      const y = parseInt(match[2]);
      const gridSize = this.config.baseGridSize;
      
      // 修复坐标计算：使用正确的数学对称公式
      // 网格ID格式: grid_1201452_302390
      // x = 1201452, y = 302390
      // 需要转换为实际的经纬度坐标
      // 编码时: x = Math.floor((lng + 180) / gridSize)
      // 解码时: lng = (x * gridSize) - 180
      const lng = (x * gridSize) - 180;
      const lat = (y * gridSize) - 90;
      
      // 验证坐标是否在合理范围内
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        logger.warn('解析的坐标超出范围:', { lat, lng, gridId, x, y });
        return null;
      }
      
      return { lat, lng };
    } catch (error) {
      logger.warn('解析网格ID失败:', gridId, error);
      return null;
    }
  }


  /**
   * 移除像素 - 使用高德地图标准接口
   */
  public removePixel(gridId: string) {
    if (!gridId || !this.pixelLayer) return;
    
    try {
      // 从图层中移除覆盖物
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay) {
        this.removeOverlayFromMap(overlay);
        this.pixelLayer.overlays.delete(gridId);
      }
      
      // 从缓存中移除
      delete this.pixelCache[gridId];
      
      logger.info(`✅ 图层服务移除像素: ${gridId}`);
      
    } catch (error) {
      logger.error('移除像素失败:', error);
    }
  }

  /**
   * 更新像素颜色（支持UNICODE）- 使用高德地图标准接口
   */
  public async updatePixelColor(gridId: string, color: string, patternId?: string) {
    if (!gridId || !this.pixelCache[gridId]) return;
    
    try {
      let renderColor = color;
      
      // 如果有pattern_id，使用优化后的渲染逻辑
      if (patternId) {
        const pattern = await patternCache.getPattern(patternId);
        if (pattern) {
          const pixel = this.pixelCache[gridId];
          const patternX = this.calculatePatternX(pixel.lat, pixel.lng, { pattern_id: patternId });
          const patternY = this.calculatePatternY(pixel.lat, pixel.lng, { pattern_id: patternId });
          renderColor = '#FF0000'; // 使用默认红色
        }
      }
      
      // 更新缓存
      this.pixelCache[gridId].color = renderColor;
      this.pixelCache[gridId].timestamp = Date.now();
      
      // 更新访问统计
      this.updatePixelAccessStats(gridId);
      
      // 更新覆盖物颜色
      const overlay = this.pixelLayer.overlays.get(gridId);
      if (overlay && overlay.setOptions) {
        overlay.setOptions({ fillColor: renderColor });
      }
      
      // 刷新图层
      this.refreshLayer();
      
    } catch (error) {
      logger.error('更新像素颜色失败:', error);
    }
  }

  /**
   * 更新像素访问统计
   */
  private updatePixelAccessStats(gridId: string): void {
    if (!this.pixelCache[gridId]) return;
    
    const now = Date.now();
    const pixel = this.pixelCache[gridId];
    
    // 更新访问次数
    pixel.accessCount = (pixel.accessCount || 0) + 1;
    
    // 更新最后访问时间
    pixel.lastAccessed = now;
    
    // 如果是GPS轨迹像素，设置标识
    if (!pixel.isGPSTrackPixel && this.isGPSTrackPixel(gridId)) {
      pixel.isGPSTrackPixel = true;
    }
  }

  /**
   * 设置图层可见性 - 使用高德地图标准接口
   */
  public setVisible(visible: boolean) {
    if (this.pixelLayer) {
      this.pixelLayer.setVisible(visible);
    }
  }

  /**
   * 设置图层透明度 - 使用高德地图标准接口
   */
  public setOpacity(opacity: number) {
    if (this.pixelLayer) {
      this.pixelLayer.setOpacity(opacity);
    }
  }

  /**
   * 获取图层可见性 - 使用高德地图标准接口
   */
  public getVisible(): boolean {
    return this.pixelLayer ? this.pixelLayer.getVisible() : false;
  }

  /**
   * 清除所有像素 - 使用高德地图标准接口
   */
  public clearAllPixels() {
    if (!this.pixelLayer) return;
    
    try {
      // 移除所有覆盖物
      this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
        this.removeOverlayFromMap(overlay);
      });
      
      // 清空覆盖物映射
      this.pixelLayer.overlays.clear();
      
      // 清空缓存
      this.pixelCache = {};
      
      // 重置边界，确保下次能正确重新加载
      this.lastBounds = null;
      
      logger.info('✅ 图层服务清除所有像素');
      
    } catch (error) {
      logger.error('清除所有像素失败:', error);
    }
  }

  /**
   * 获取缓存统计 - 使用高德地图标准接口
   */
  public getCacheStats() {
    return {
      pixelCount: Object.keys(this.pixelCache).length,
      overlayCount: this.pixelLayer ? this.pixelLayer.overlays.size : 0,
      isUpdating: this.isUpdating
    };
  }

  /**
   * 获取图层服务状态 - 使用高德地图标准接口
   */
  public getStatus() {
    return {
      mapInitialized: !!this.map,
      pixelLayerInitialized: !!this.pixelLayer,
      amapLoaded: !!(window as any).AMap,
      pixelLayerAddMethod: this.pixelLayer ? !!this.pixelLayer.add : false,
      pixelLayerOverlays: this.pixelLayer ? !!this.pixelLayer.overlays : false,
      lastBounds: this.lastBounds ? '已设置' : '未设置',
      isUpdating: this.isUpdating,
      overlayCount: this.pixelLayer ? this.pixelLayer.overlays.size : 0,
      cacheCount: Object.keys(this.pixelCache).length
    };
  }

  /**
   * 获取增量渲染统计信息 - 使用高德地图标准接口
   */
  public getIncrementalStats() {
    if (!this.lastBounds || !this.map) {
      return { message: '需要先加载一次像素数据' };
    }
    
    const currentBounds = this.map.getBounds();
    const newAreas = this.calculateNewAreas(this.lastBounds, currentBounds);
    const gridIdsToRemove = this.calculateRemovedAreas(this.lastBounds, currentBounds);
    
    return {
      hasSignificantChange: this.hasBoundsChanged(currentBounds),
      newAreasCount: newAreas.length,
      areasToRemoveCount: gridIdsToRemove.length,
      currentOverlayCount: this.pixelLayer ? this.pixelLayer.overlays.size : 0,
      lastBounds: {
        north: this.lastBounds.getNorthEast().lat,
        south: this.lastBounds.getSouthWest().lat,
        east: this.lastBounds.getNorthEast().lng,
        west: this.lastBounds.getSouthWest().lng
      },
      currentBounds: {
        north: currentBounds.getNorthEast().lat,
        south: currentBounds.getSouthWest().lat,
        east: currentBounds.getNorthEast().lng,
        west: currentBounds.getSouthWest().lng
      }
    };
  }

  /**
   * 强制保留所有像素 - 防止在聚焦操作时被清理
   */
  public forceKeepAllPixels() {
    if (!this.pixelLayer) return;
    
    logger.info('🔒 强制保留所有像素，防止被清理');
    
    // 设置一个标志，在下次边界检查时跳过像素移除
    this.forceKeepPixels = true;
    
    // 延迟重置标志
    setTimeout(() => {
      this.forceKeepPixels = false;
      logger.info('🔓 像素保留保护已关闭');
    }, 5000); // 5秒后自动关闭
  }

  /**
   * 标记GPS轨迹像素 - 用于GPS定位绘制功能
   */
  public markGPSTrackPixel(gridId: string, isGPSTrack: boolean = true): void {
    if (!this.pixelCache[gridId]) {
      logger.warn(`⚠️ 像素 ${gridId} 不在缓存中，无法标记为GPS轨迹像素`);
      return;
    }
    
    this.pixelCache[gridId].isGPSTrackPixel = isGPSTrack;
    
    if (isGPSTrack) {
      logger.info(`🗺️ 标记像素为GPS轨迹像素: ${gridId}`);
    } else {
      logger.info(`🗺️ 取消像素GPS轨迹标记: ${gridId}`);
    }
  }

  /**
   * 批量标记GPS轨迹像素 - 用于批量GPS轨迹绘制
   */
  public markGPSTrackPixelsBatch(gridIds: string[], isGPSTrack: boolean = true): void {
    let markedCount = 0;
    
    gridIds.forEach(gridId => {
      if (this.pixelCache[gridId]) {
        this.pixelCache[gridId].isGPSTrackPixel = isGPSTrack;
        markedCount++;
      }
    });
    
    logger.info(`🗺️ 批量标记GPS轨迹像素完成: ${markedCount}/${gridIds.length} 个像素`);
  }

  /**
   * 检查是否应该强制保留像素
   */
  private shouldForceKeepPixels(): boolean {
    return this.forceKeepPixels || false;
  }

  /**
   * 调试方法：检查像素是否在边界内 - 使用高德地图标准接口
   */
  public debugPixelBounds() {
    if (!this.lastBounds || !this.map) {
      logger.info('❌ 没有边界数据可调试');
      return;
    }
    
    const currentBounds = this.map.getBounds();
    logger.info('🔍 调试边界检查:');
    logger.info('  当前边界:', {
      north: currentBounds.getNorthEast().lat,
      south: currentBounds.getSouthWest().lat,
      east: currentBounds.getNorthEast().lng,
      west: currentBounds.getSouthWest().lng
    });
    
    if (this.pixelLayer && this.pixelLayer.overlays.size > 0) {
      logger.info(`  当前像素数量: ${this.pixelLayer.overlays.size}`);
      
      this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
        const coords = this.parseGridId(gridId);
        if (coords) {
          const { lat, lng } = coords;
          const inBounds = lat <= currentBounds.getNorthEast().lat && 
                          lat >= currentBounds.getSouthWest().lat && 
                          lng <= currentBounds.getNorthEast().lng && 
                          lng >= currentBounds.getSouthWest().lng;
          logger.info(`  ${gridId}: (${lat.toFixed(6)}, ${lng.toFixed(6)}) - ${inBounds ? '✅ 在边界内' : '❌ 在边界外'}`);
        }
      });
    } else {
      logger.info('  当前没有像素数据');
    }
  }

  /**
   * 调试方法：验证网格ID计算 - 使用高德地图标准接口
   */
  public debugGridIdCalculation() {
    logger.info('🔍 调试网格ID计算:');
    
    // 测试一些已知坐标
    const testCoords = [
      { lat: 30.23905, lng: 120.14525 },
      { lat: 30.23915, lng: 120.14445 },
      { lat: 30.23915, lng: 120.14495 }
    ];
    
    testCoords.forEach(({ lat, lng }) => {
      const gridId = this.calculateGridId(lat, lng);
      const parsed = this.parseGridId(gridId);
      logger.info(`  坐标 (${lat}, ${lng}) -> 网格ID: ${gridId} -> 解析: (${parsed?.lat.toFixed(6)}, ${parsed?.lng.toFixed(6)})`);
    });
  }

  /**
   * 调试方法：检查当前阈值设置 - 增强版本
   */
  public debugThresholds() {
    if (!this.map) {
      logger.info('❌ 地图未初始化');
      return;
    }
    
    let currentZoom = this.map.getZoom();
    if (currentZoom > 18) currentZoom = 18;
    const { distanceThreshold, areaThreshold } = this.getDynamicThresholds(currentZoom);
    const buffer = this.getDynamicBuffer(currentZoom);
    
    logger.info('🔍 当前阈值设置:');
    logger.info(`  缩放级别: ${currentZoom}`);
    logger.info(`  距离阈值: ${distanceThreshold}m`);
    logger.info(`  面积阈值: ${(areaThreshold * 100).toFixed(1)}%`);
    logger.info(`  缓冲区: ${buffer} (约${(buffer * 111000).toFixed(0)}米)`);
    
    // 显示当前边界信息
    try {
      const bounds = this.map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const center = bounds.getCenter();
        const area = this.calculateBoundsAreaStandard(bounds);
        
        logger.info('🗺️ 当前地图边界:');
        logger.info(`  中心点: (${center.lat.toFixed(6)}, ${center.lng.toFixed(6)})`);
        logger.info(`  东北角: (${ne.lat.toFixed(6)}, ${ne.lng.toFixed(6)})`);
        logger.info(`  西南角: (${sw.lat.toFixed(6)}, ${sw.lng.toFixed(6)})`);
        logger.info(`  面积: ${(area * 111000 * 111000).toFixed(0)} 平方米`);
      }
    } catch (error) {
      logger.warn('获取当前边界信息失败:', error);
    }
  }

  /**
   * 调试方法：验证网格ID解析 - 使用高德地图标准接口
   */
  public debugGridIdParsing() {
    logger.info('🔍 调试网格ID解析:');
    
    // 测试一些已知的网格ID
    const testGridIds = [
      'grid_1201452_302390',
      'grid_1201444_302391',
      'grid_1201449_302391'
    ];
    
    testGridIds.forEach(gridId => {
      const coords = this.parseGridId(gridId);
      if (coords) {
        logger.info(`  ${gridId} -> (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`);
      } else {
        logger.info(`  ${gridId} -> 解析失败`);
      }
    });
    
    // 测试当前图层中的像素坐标
    if (this.pixelLayer && this.pixelLayer.overlays.size > 0) {
      logger.info('🔍 当前图层中的像素坐标:');
      this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
        const coords = this.parseGridId(gridId);
        if (coords) {
          logger.info(`  ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`);
        } else {
          logger.info(`  ${gridId} -> 解析失败`);
        }
      });
    }
  }

  /**
   * 调试方法：查看GPS轨迹像素状态
   */
  public debugGPSTrackPixels(): void {
    logger.info('🗺️ 调试GPS轨迹像素状态:');
    
    if (!this.pixelLayer || this.pixelLayer.overlays.size === 0) {
      logger.info('  当前没有像素数据');
      return;
    }
    
    let totalPixels = 0;
    let gpsTrackPixels = 0;
    let importantPixels = 0;
    
    this.pixelLayer.overlays.forEach((overlay: any, gridId: string) => {
      totalPixels++;
      const pixel = this.pixelCache[gridId];
      
      if (pixel && pixel.isGPSTrackPixel) {
        gpsTrackPixels++;
        logger.info(`  🗺️ GPS轨迹像素: ${gridId} at (${pixel.lat.toFixed(6)}, ${pixel.lng.toFixed(6)})`);
      }
      
      if (pixel && this.isImportantPixel(gridId)) {
        importantPixels++;
        if (!pixel.isGPSTrackPixel) {
          logger.info(`  ⭐ 重要像素: ${gridId} at (${pixel.lat.toFixed(6)}, ${pixel.lng.toFixed(6)}) - 访问次数: ${pixel.accessCount || 0}`);
        }
      }
    });
    
    logger.info(`📊 像素统计: 总计=${totalPixels}, GPS轨迹=${gpsTrackPixels}, 重要=${importantPixels}`);
  }

  /**
   * 🔧 调试方法：强制刷新WebGL渲染
   */
  public forceRefreshWebGL(): void {
    logger.info('🔄 强制刷新WebGL渲染...');
    if (this.webglService && this.webglInitialized) {
      this.renderWebGLFrame();
      logger.info('✅ WebGL渲染已刷新');
    } else {
      logger.warn('⚠️ WebGL未初始化，无法刷新');
    }
  }

  /**
   * 销毁图层服务，清理所有资源
   */
  public destroy(): void {
    logger.info('🗑️ 销毁图层服务...');
    
    try {
      // 清理像素图层
      if (this.pixelLayer) {
        this.pixelLayer.overlays.forEach((overlay: any) => {
          if (overlay && typeof overlay.remove === 'function') {
            overlay.remove();
          }
        });
        this.pixelLayer.overlays.clear();
        this.pixelLayer = null;
      }
      
      // 清理缓存
      this.pixelCache = {};
      
      // 清理地图引用
      this.map = null;
      
      // 清理定时器
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
        this.updateTimer = null;
      }
      
      // Canvas更新计时器清理已移除
      
      logger.info('✅ 图层服务销毁完成');
    } catch (error) {
      logger.error('❌ 销毁图层服务时发生错误:', error);
    }
  }
}

// 单例实例
let amapLayerServiceInstance: AmapLayerService | null = null;

/**
 * 获取图层服务实例
 */
export function getAmapLayerService(map?: any): AmapLayerService {
  if (!amapLayerServiceInstance) {
    amapLayerServiceInstance = new AmapLayerService(map);
    // 🔥 关键修复：将服务实例暴露到全局window对象，供诊断脚本使用
    if (typeof window !== 'undefined') {
      (window as any).amapLayerService = amapLayerServiceInstance;
    }
  }
  return amapLayerServiceInstance;
}

/**
 * 销毁图层服务实例
 */
export function destroyAmapLayerService(): void {
  if (amapLayerServiceInstance) {
    amapLayerServiceInstance.destroy();
    amapLayerServiceInstance = null;
    // 🔥 关键修复：清理全局window对象引用
    if (typeof window !== 'undefined') {
      (window as any).amapLayerService = null;
    }
  }
}