/**
 * 智能渲染模式管理器
 * 基于实时性能监控、设备能力、像素密度等因素自动选择最优渲染模式
 */

import { logger } from '../utils/logger';

interface DeviceCapabilities {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    memoryGB: number;
    cpuCores: number;
    gpuAcceleration: boolean;
    networkSpeed: 'slow' | 'medium' | 'fast';
    batteryLevel?: number;
    isLowPowerMode?: boolean;
  }
  
  interface PerformanceMetrics {
    fps: number;
    memoryUsageMB: number;
    renderTimeMs: number;
    cacheHitRate: number;
    networkLatencyMs: number;
    pixelDensity: number;
    activePixelCount: number;
    viewportArea: number;
  }
  
  interface RenderModeDecision {
    mode: 'normal' | 'tile' | 'hybrid';
    reason: string;
    confidence: number; // 0-1
    performanceGain: number; // 预期性能提升百分比
    autoSwitchThreshold: {
      enable: PerformanceMetrics;
      disable: PerformanceMetrics;
    };
  }
  
  interface SmartThresholds {
    // 设备能力阈值
    mobileMemoryThreshold: number; // MB
    desktopMemoryThreshold: number; // MB
    lowBatteryThreshold: number; // 百分比
    
    // 性能阈值
    lowFpsThreshold: number;
    highMemoryThreshold: number;
    slowRenderThreshold: number; // ms
    lowCacheHitRateThreshold: number;
    
    // 像素密度阈值
    highDensityThreshold: number; // 像素/平方公里
    veryHighDensityThreshold: number;
    
    // 网络阈值
    slowNetworkThreshold: number; // ms
    fastNetworkThreshold: number; // ms
  }
  
  export class IntelligentRenderModeManager {
    private currentMode: 'normal' | 'tile' | 'hybrid' = 'normal';
    private deviceCapabilities: DeviceCapabilities;
    private performanceHistory: PerformanceMetrics[] = [];
    private decisionHistory: RenderModeDecision[] = [];
    private isMonitoring = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    
    // 智能阈值配置
    private thresholds: SmartThresholds = {
      mobileMemoryThreshold: 512, // 512MB
      desktopMemoryThreshold: 2048, // 2GB
      lowBatteryThreshold: 20, // 20%
      
      lowFpsThreshold: 30,
      highMemoryThreshold: 80, // 80% of available memory
      slowRenderThreshold: 16, // 16ms (60fps)
      lowCacheHitRateThreshold: 0.6, // 60%
      
      highDensityThreshold: 1000, // 1000 pixels/km²
      veryHighDensityThreshold: 5000, // 5000 pixels/km²
      
      slowNetworkThreshold: 500, // 500ms
      fastNetworkThreshold: 100, // 100ms
    };
  
    constructor() {
      this.deviceCapabilities = this.detectDeviceCapabilities();
      logger.info('🧠 智能渲染模式管理器初始化完成', this.deviceCapabilities);
    }
  
    /**
     * 检测设备能力
     */
    private detectDeviceCapabilities(): DeviceCapabilities {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // 检测设备类型
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || (screenWidth >= 768 && screenWidth <= 1024);
      const isDesktop = !isMobile && !isTablet;
      
      // 检测内存信息
      let memoryGB = 4; // 默认值
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        memoryGB = Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024 / 1024);
      }
      
      // 检测CPU核心数
      const cpuCores = navigator.hardwareConcurrency || 4;
      
      // 检测GPU加速（优先尝试 WebGL2）
      const canvas = document.createElement('canvas');
      const gl = (canvas as any).getContext?.('webgl2') ||
                 (canvas as any).getContext?.('webgl') ||
                 (canvas as any).getContext?.('experimental-webgl');
      const gpuAcceleration = !!gl;
      
      // 检测网络速度
      let networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const effectiveType = connection?.effectiveType;
        if (effectiveType === '4g' || effectiveType === '5g') {
          networkSpeed = 'fast';
        } else if (effectiveType === '3g') {
          networkSpeed = 'medium';
        } else {
          networkSpeed = 'slow';
        }
      }
      
      // 检测电池信息
      let batteryLevel: number | undefined;
      let isLowPowerMode: boolean | undefined;
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          batteryLevel = Math.round(battery.level * 100);
          isLowPowerMode = battery.charging === false && batteryLevel < this.thresholds.lowBatteryThreshold;
        });
      }
      
      return {
        isMobile,
        isTablet,
        isDesktop,
        memoryGB,
        cpuCores,
        gpuAcceleration,
        networkSpeed,
        batteryLevel,
        isLowPowerMode
      };
    }
  
    /**
     * 开始智能监控
     */
    public startMonitoring(): void {
      if (this.isMonitoring) return;
      
      this.isMonitoring = true;
      this.monitoringInterval = setInterval(() => {
        this.collectPerformanceMetrics();
        this.evaluateRenderMode();
      }, 2000); // 每2秒评估一次

      logger.info('🧠 智能渲染模式监控已启动');
    }
  
    /**
     * 停止智能监控
     */
    public stopMonitoring(): void {
      if (!this.isMonitoring) return;
      
      this.isMonitoring = false;
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      logger.info('🧠 智能渲染模式监控已停止');
    }
  
    /**
     * 收集性能指标
     */
    private collectPerformanceMetrics(): PerformanceMetrics {
      const metrics: PerformanceMetrics = {
        fps: this.measureFPS(),
        memoryUsageMB: this.getMemoryUsage(),
        renderTimeMs: this.getRenderTime(),
        cacheHitRate: this.getCacheHitRate(),
        networkLatencyMs: this.getNetworkLatency(),
        pixelDensity: this.getPixelDensity(),
        activePixelCount: this.getActivePixelCount(),
        viewportArea: this.getViewportArea()
      };
  
      // 添加到历史记录
      this.performanceHistory.push(metrics);
      if (this.performanceHistory.length > 10) {
        this.performanceHistory.shift(); // 保持最近10次记录
      }
  
      return metrics;
    }
  
    /**
     * 测量FPS
     */
    private measureFPS(): number {
      let fps = 60;
      if ('requestAnimationFrame' in window) {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFPS = (currentTime: number) => {
          frameCount++;
          if (currentTime - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            frameCount = 0;
            lastTime = currentTime;
          }
          requestAnimationFrame(measureFPS);
        };
        requestAnimationFrame(measureFPS);
      }
      return fps;
    }
  
    /**
     * 获取内存使用量
     */
    private getMemoryUsage(): number {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        return Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
      }
      return 0;
    }
  
    /**
     * 获取渲染时间
     */
    private getRenderTime(): number {
      // 这里应该从实际的渲染系统获取
      // 暂时返回模拟值
      return Math.random() * 20;
    }
  
    /**
     * 获取缓存命中率
     */
    private getCacheHitRate(): number {
      // 这里应该从实际的缓存系统获取
      // 暂时返回模拟值
      return Math.random();
    }
  
    /**
     * 获取网络延迟
     */
    private getNetworkLatency(): number {
      // 这里应该通过实际的网络请求测量
      // 暂时返回模拟值
      return Math.random() * 500;
    }
  
    /**
     * 获取像素密度
     */
    private getPixelDensity(): number {
      // 这里应该从地图服务获取当前视口的像素密度
      // 暂时返回模拟值
      return Math.random() * 10000;
    }
  
    /**
     * 获取活跃像素数量
     */
    private getActivePixelCount(): number {
      // 这里应该从地图服务获取当前活跃的像素数量
      // 暂时返回模拟值
      return Math.floor(Math.random() * 10000);
    }
  
    /**
     * 获取视口面积
     */
    private getViewportArea(): number {
      return window.innerWidth * window.innerHeight;
    }
  
    /**
     * 评估渲染模式
     */
    private evaluateRenderMode(): void {
      if (this.performanceHistory.length < 3) return; // 需要至少3次测量
      
      const currentMetrics = this.performanceHistory[this.performanceHistory.length - 1];
      const avgMetrics = this.calculateAverageMetrics();
      
      const decision = this.makeRenderModeDecision(currentMetrics, avgMetrics);
      
      if (decision.confidence > 0.7) { // 置信度超过70%才切换
        this.applyRenderModeDecision(decision);
      }
    }
  
    /**
     * 计算平均性能指标
     */
    private calculateAverageMetrics(): PerformanceMetrics {
      const sum = this.performanceHistory.reduce((acc, metrics) => ({
        fps: acc.fps + metrics.fps,
        memoryUsageMB: acc.memoryUsageMB + metrics.memoryUsageMB,
        renderTimeMs: acc.renderTimeMs + metrics.renderTimeMs,
        cacheHitRate: acc.cacheHitRate + metrics.cacheHitRate,
        networkLatencyMs: acc.networkLatencyMs + metrics.networkLatencyMs,
        pixelDensity: acc.pixelDensity + metrics.pixelDensity,
        activePixelCount: acc.activePixelCount + metrics.activePixelCount,
        viewportArea: acc.viewportArea + metrics.viewportArea
      }), {
        fps: 0, memoryUsageMB: 0, renderTimeMs: 0, cacheHitRate: 0,
        networkLatencyMs: 0, pixelDensity: 0, activePixelCount: 0, viewportArea: 0
      });
  
      const count = this.performanceHistory.length;
      return {
        fps: sum.fps / count,
        memoryUsageMB: sum.memoryUsageMB / count,
        renderTimeMs: sum.renderTimeMs / count,
        cacheHitRate: sum.cacheHitRate / count,
        networkLatencyMs: sum.networkLatencyMs / count,
        pixelDensity: sum.pixelDensity / count,
        activePixelCount: sum.activePixelCount / count,
        viewportArea: sum.viewportArea / count
      };
    }
  
    /**
     * 做出渲染模式决策
     */
    private makeRenderModeDecision(current: PerformanceMetrics, average: PerformanceMetrics): RenderModeDecision {
      const reasons: string[] = [];
      let confidence = 0;
      let performanceGain = 0;
  
      // 分析当前模式的表现
      const isCurrentModeOptimal = this.isCurrentModeOptimal(current, average);
      
      if (!isCurrentModeOptimal) {
        // 分析应该切换到什么模式
        const recommendedMode = this.recommendRenderMode(current, average);
        
        if (recommendedMode !== this.currentMode) {
          confidence = this.calculateConfidence(current, average, recommendedMode);
          performanceGain = this.estimatePerformanceGain(current, recommendedMode);
          
          reasons.push(`当前模式性能不佳: FPS=${current.fps}, 内存=${current.memoryUsageMB}MB`);
          reasons.push(`推荐模式: ${recommendedMode}`);
          reasons.push(`预期性能提升: ${performanceGain}%`);
        }
      }
  
      return {
        mode: this.currentMode,
        reason: reasons.join('; '),
        confidence,
        performanceGain,
        autoSwitchThreshold: {
          enable: this.calculateEnableThreshold(),
          disable: this.calculateDisableThreshold()
        }
      };
    }
  
    /**
     * 检查当前模式是否最优
     */
    private isCurrentModeOptimal(current: PerformanceMetrics, average: PerformanceMetrics): boolean {
      // 基于设备能力和性能指标判断
      const isLowEndDevice = this.deviceCapabilities.isMobile && 
                            this.deviceCapabilities.memoryGB < 2;
      
      const isHighDensity = current.pixelDensity > this.thresholds.highDensityThreshold;
      const isLowPerformance = current.fps < this.thresholds.lowFpsThreshold ||
                              current.memoryUsageMB > this.thresholds.highMemoryThreshold ||
                              current.renderTimeMs > this.thresholds.slowRenderThreshold;
  
      if (this.currentMode === 'normal') {
        // 普通模式：适合低端设备和低密度场景
        return !isHighDensity || isLowEndDevice;
      } else if (this.currentMode === 'tile') {
        // 瓦片模式：适合高端设备和高密度场景
        return isHighDensity && !isLowEndDevice && !isLowPerformance;
      } else if (this.currentMode === 'hybrid') {
        // 混合模式：适合中等性能设备
        return !isLowEndDevice && !isHighDensity;
      }
  
      return true;
    }
  
    /**
     * 推荐渲染模式
     */
    private recommendRenderMode(current: PerformanceMetrics, average: PerformanceMetrics): 'normal' | 'tile' | 'hybrid' {
      const isLowEndDevice = this.deviceCapabilities.isMobile && 
                            this.deviceCapabilities.memoryGB < 2;
      
      const isHighDensity = current.pixelDensity > this.thresholds.veryHighDensityThreshold;
      const isMediumDensity = current.pixelDensity > this.thresholds.highDensityThreshold;
      
      const isHighPerformance = this.deviceCapabilities.isDesktop && 
                               this.deviceCapabilities.memoryGB >= 4 &&
                               this.deviceCapabilities.gpuAcceleration;
  
      if (isLowEndDevice || current.memoryUsageMB > this.thresholds.mobileMemoryThreshold) {
        return 'normal';
      } else if (isHighDensity && isHighPerformance) {
        return 'tile';
      } else if (isMediumDensity && !isLowEndDevice) {
        return 'hybrid';
      } else {
        return 'normal';
      }
    }
  
    /**
     * 计算置信度
     */
    private calculateConfidence(current: PerformanceMetrics, average: PerformanceMetrics, recommendedMode: string): number {
      let confidence = 0.5; // 基础置信度
  
      // 性能指标一致性
      const fpsConsistency = Math.abs(current.fps - average.fps) < 10 ? 0.2 : 0;
      const memoryConsistency = Math.abs(current.memoryUsageMB - average.memoryUsageMB) < 50 ? 0.2 : 0;
      
      // 设备能力匹配度
      const deviceMatch = this.deviceCapabilities.isDesktop ? 0.3 : 0.1;
      
      confidence += fpsConsistency + memoryConsistency + deviceMatch;
      
      return Math.min(1, confidence);
    }
  
    /**
     * 估算性能提升
     */
    private estimatePerformanceGain(current: PerformanceMetrics, recommendedMode: string): number {
      if (recommendedMode === 'tile' && this.currentMode === 'normal') {
        // 从普通模式切换到瓦片模式
        return Math.min(50, current.pixelDensity / 100); // 最多50%提升
      } else if (recommendedMode === 'normal' && this.currentMode === 'tile') {
        // 从瓦片模式切换到普通模式
        return Math.min(30, (100 - current.memoryUsageMB) / 10); // 最多30%提升
      } else if (recommendedMode === 'hybrid') {
        // 切换到混合模式
        return 20; // 固定20%提升
      }
      
      return 0;
    }
  
    /**
     * 计算启用阈值
     */
    private calculateEnableThreshold(): PerformanceMetrics {
      return {
        fps: this.thresholds.lowFpsThreshold,
        memoryUsageMB: this.deviceCapabilities.isMobile ? 
                      this.thresholds.mobileMemoryThreshold : 
                      this.thresholds.desktopMemoryThreshold,
        renderTimeMs: this.thresholds.slowRenderThreshold,
        cacheHitRate: this.thresholds.lowCacheHitRateThreshold,
        networkLatencyMs: this.thresholds.slowNetworkThreshold,
        pixelDensity: this.thresholds.highDensityThreshold,
        activePixelCount: 1000,
        viewportArea: 1000000
      };
    }
  
    /**
     * 计算禁用阈值
     */
    private calculateDisableThreshold(): PerformanceMetrics {
      return {
        fps: 50,
        memoryUsageMB: this.deviceCapabilities.isMobile ? 256 : 1024,
        renderTimeMs: 8,
        cacheHitRate: 0.8,
        networkLatencyMs: this.thresholds.fastNetworkThreshold,
        pixelDensity: this.thresholds.highDensityThreshold / 2,
        activePixelCount: 500,
        viewportArea: 500000
      };
    }
  
    /**
     * 应用渲染模式决策
     */
    private applyRenderModeDecision(decision: RenderModeDecision): void {
      if (decision.mode !== this.currentMode) {
        const oldMode = this.currentMode;
        this.currentMode = decision.mode;
        
        // 触发模式切换事件
        this.onRenderModeChanged(this.currentMode, oldMode, decision);
        
        logger.info(`🔄 智能切换渲染模式: ${oldMode} -> ${this.currentMode}`);
        logger.info(`📊 切换原因: ${decision.reason}`);
        logger.info(`🎯 置信度: ${Math.round(decision.confidence * 100)}%`);
        logger.info(`⚡ 预期性能提升: ${decision.performanceGain}%`);
      }
    }
  
    /**
     * 渲染模式变化回调
     */
    private onRenderModeChanged(newMode: string, oldMode: string, decision: RenderModeDecision): void {
      // 这里应该通知地图组件切换渲染模式
      // 可以通过事件总线或回调函数实现
      
      // 记录决策历史
      this.decisionHistory.push(decision);
      if (this.decisionHistory.length > 20) {
        this.decisionHistory.shift();
      }
    }
  
    /**
     * 获取当前渲染模式
     */
    public getCurrentMode(): 'normal' | 'tile' | 'hybrid' {
      return this.currentMode;
    }
  
    /**
     * 获取性能历史
     */
    public getPerformanceHistory(): PerformanceMetrics[] {
      return [...this.performanceHistory];
    }
  
    /**
     * 获取决策历史
     */
    public getDecisionHistory(): RenderModeDecision[] {
      return [...this.decisionHistory];
    }
  
    /**
     * 获取设备能力信息
     */
    public getDeviceCapabilities(): DeviceCapabilities {
      return { ...this.deviceCapabilities };
    }
  
    /**
     * 手动设置渲染模式（覆盖智能决策）
     */
    public setRenderMode(mode: 'normal' | 'tile' | 'hybrid', reason: string = '手动设置'): void {
      const oldMode = this.currentMode;
      this.currentMode = mode;
      
      logger.info(`🧠 手动设置渲染模式: ${oldMode} -> ${mode} (${reason})`);
      
      // 记录手动决策
      this.decisionHistory.push({
        mode,
        reason: `手动设置: ${reason}`,
        confidence: 1.0,
        performanceGain: 0,
        autoSwitchThreshold: {
          enable: this.calculateEnableThreshold(),
          disable: this.calculateDisableThreshold()
        }
      });
    }
  
    /**
     * 重置智能决策（重新启用自动模式）
     */
    public resetIntelligentMode(): void {
      logger.info('🧠 重置智能渲染模式决策');
      this.decisionHistory = [];
      this.performanceHistory = [];
    }
  
    /**
     * 更新阈值配置
     */
    public updateThresholds(newThresholds: Partial<SmartThresholds>): void {
      this.thresholds = { ...this.thresholds, ...newThresholds };
      logger.info('🧠 智能阈值配置已更新', newThresholds);
    }
  }
  
  export default IntelligentRenderModeManager;