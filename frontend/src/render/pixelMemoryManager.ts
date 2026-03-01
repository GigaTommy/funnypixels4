/**
 * 像素内存管理器
 * 实现LRU缓存策略，智能管理像素数据内存使用
 */

import { logger } from '../utils/logger';

export interface PixelData {
  id: string;
  lat: number;
  lng: number;
  color: string;
  patternId?: string;
  userId?: string;
  lastAccess: number;
  accessCount: number;
  priority: number;
  isVisible: boolean;
  distanceFromViewport: number;
}

export interface MemoryStats {
  totalPixels: number;
  maxPixels: number;
  memoryUsage: number;
  evictedPixels: number;
  hitRate: number;
  missRate: number;
}

export class PixelMemoryManager {
  private maxPixels = 100000; // 增加到10万个像素，匹配WebGL渲染能力
  private cleanupThreshold = 0.8;
  private pixels: Map<string, PixelData> = new Map();
  private accessOrder: string[] = [];
  private viewportCenter: { lat: number; lng: number } | null = null;
  
  // 性能统计
  private stats = {
    totalPixels: 0,
    evictedPixels: 0,
    hits: 0,
    misses: 0
  };
  
  constructor(maxPixels: number = 100000) {
    this.maxPixels = maxPixels;
  }
  
  /**
   * 添加像素
   * @param pixel - 像素数据
   */
  addPixel(pixel: PixelData) {
    const key = pixel.id;
    
    // 如果像素已存在，更新访问信息
    if (this.pixels.has(key)) {
      this.updateAccess(key);
      return;
    }
    
    // 检查是否需要清理
    if (this.pixels.size >= this.maxPixels * this.cleanupThreshold) {
      this.cleanup();
    }
    
    // 计算像素优先级
    const priority = this.calculatePixelPriority(pixel);
    
    // 添加新像素
    this.pixels.set(key, {
      ...pixel,
      lastAccess: Date.now(),
      accessCount: 1,
      priority
    });
    
    this.accessOrder.push(key);
    this.stats.totalPixels++;
  }
  
  /**
   * 获取像素
   * @param id - 像素ID
   * @returns 像素数据或undefined
   */
  getPixel(id: string): PixelData | undefined {
    const pixel = this.pixels.get(id);
    if (pixel) {
      this.updateAccess(id);
      this.stats.hits++;
      return pixel;
    }
    
    this.stats.misses++;
    return undefined;
  }
  
  /**
   * 批量添加像素
   * @param pixels - 像素数组
   */
  addPixels(pixels: PixelData[]) {
    pixels.forEach(pixel => this.addPixel(pixel));
  }
  
  /**
   * 更新像素
   * @param id - 像素ID
   * @param updates - 更新数据
   */
  updatePixel(id: string, updates: Partial<PixelData>) {
    const pixel = this.pixels.get(id);
    if (pixel) {
      const updatedPixel = { ...pixel, ...updates };
      updatedPixel.priority = this.calculatePixelPriority(updatedPixel);
      this.pixels.set(id, updatedPixel);
      this.updateAccess(id);
    }
  }
  
  /**
   * 删除像素
   * @param id - 像素ID
   */
  removePixel(id: string) {
    if (this.pixels.has(id)) {
      this.pixels.delete(id);
      const index = this.accessOrder.indexOf(id);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }
  
  /**
   * 更新访问信息
   * @param id - 像素ID
   */
  private updateAccess(id: string) {
    const pixel = this.pixels.get(id);
    if (!pixel) return;
    
    pixel.lastAccess = Date.now();
    pixel.accessCount++;
    
    // 更新访问顺序
    const index = this.accessOrder.indexOf(id);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(id);
  }
  
  /**
   * 智能清理
   */
  private cleanup() {
    const targetSize = Math.floor(this.maxPixels * 0.6);
    const currentSize = this.pixels.size;
    
    if (currentSize <= targetSize) return;
    
    // 计算像素优先级
    const pixelPriorities = Array.from(this.pixels.entries()).map(([id, pixel]) => ({
      id,
      pixel,
      priority: this.calculatePixelPriority(pixel)
    }));
    
    // 按优先级排序
    pixelPriorities.sort((a, b) => b.priority - a.priority);
    
    // 保留高优先级像素
    const keepCount = targetSize;
    const toKeep = pixelPriorities.slice(0, keepCount);
    const toRemove = pixelPriorities.slice(keepCount);
    
    // 移除低优先级像素
    for (const { id } of toRemove) {
      this.pixels.delete(id);
      const index = this.accessOrder.indexOf(id);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.stats.evictedPixels++;
    }
    
    logger.info(`🧹 内存清理完成: 移除${toRemove.length}个像素，保留${toKeep.length}个像素`);
  }
  
  /**
   * 计算像素优先级
   * @param pixel - 像素数据
   * @returns 优先级分数
   */
  private calculatePixelPriority(pixel: PixelData): number {
    const now = Date.now();
    const timeSinceAccess = now - pixel.lastAccess;
    
    // 基于访问频率、时间、距离等因素计算优先级
    const frequencyScore = Math.log(pixel.accessCount + 1);
    const recencyScore = Math.max(0, 1 - timeSinceAccess / (24 * 60 * 60 * 1000));
    const visibilityScore = pixel.isVisible ? 1 : 0;
    const distanceScore = this.calculateDistanceScore(pixel);
    
    return frequencyScore * 0.3 + recencyScore * 0.2 + visibilityScore * 0.3 + distanceScore * 0.2;
  }
  
  /**
   * 计算距离分数
   * @param pixel - 像素数据
   * @returns 距离分数
   */
  private calculateDistanceScore(pixel: PixelData): number {
    if (!this.viewportCenter) return 0.5;
    
    // 计算像素到视窗中心的距离
    const distance = this.calculateDistance(
      pixel.lat, pixel.lng,
      this.viewportCenter.lat, this.viewportCenter.lng
    );
    
    // 距离越近分数越高
    return Math.max(0, 1 - distance / 1000); // 1km内为满分
  }
  
  /**
   * 计算两点间距离（米）
   * @param lat1 - 纬度1
   * @param lng1 - 经度1
   * @param lat2 - 纬度2
   * @param lng2 - 经度2
   * @returns 距离（米）
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  /**
   * 更新视窗中心
   * @param center - 视窗中心坐标
   */
  updateViewportCenter(center: { lat: number; lng: number }) {
    this.viewportCenter = center;
    
    // 重新计算所有像素的距离分数
    for (const [id, pixel] of this.pixels) {
      pixel.distanceFromViewport = this.calculateDistance(
        pixel.lat, pixel.lng,
        center.lat, center.lng
      );
      pixel.priority = this.calculatePixelPriority(pixel);
    }
  }
  
  /**
   * 更新像素可见性
   * @param visiblePixels - 可见像素ID数组
   */
  updatePixelVisibility(visiblePixels: string[]) {
    const visibleSet = new Set(visiblePixels);
    
    for (const [id, pixel] of this.pixels) {
      pixel.isVisible = visibleSet.has(id);
      pixel.priority = this.calculatePixelPriority(pixel);
    }
  }
  
  /**
   * 获取所有像素
   * @returns 像素数组
   */
  getAllPixels(): PixelData[] {
    return Array.from(this.pixels.values());
  }
  
  /**
   * 获取可见像素
   * @returns 可见像素数组
   */
  getVisiblePixels(): PixelData[] {
    return Array.from(this.pixels.values()).filter(pixel => pixel.isVisible);
  }
  
  /**
   * 获取高优先级像素
   * @param count - 数量
   * @returns 高优先级像素数组
   */
  getHighPriorityPixels(count: number): PixelData[] {
    const pixels = Array.from(this.pixels.values());
    return pixels
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }
  
  /**
   * 获取内存统计信息
   * @returns 内存统计信息
   */
  getMemoryStats(): MemoryStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.stats.misses / totalRequests : 0;
    
    return {
      totalPixels: this.pixels.size,
      maxPixels: this.maxPixels,
      memoryUsage: this.pixels.size / this.maxPixels,
      evictedPixels: this.stats.evictedPixels,
      hitRate,
      missRate
    };
  }
  
  /**
   * 检查像素是否已缓存
   * @param id - 像素ID
   * @returns 是否已缓存
   */
  isCached(id: string): boolean {
    return this.pixels.has(id);
  }
  
  /**
   * 获取缓存大小
   * @returns 缓存大小
   */
  getCacheSize(): number {
    return this.pixels.size;
  }
  
  /**
   * 清空所有像素
   */
  clear() {
    this.pixels.clear();
    this.accessOrder = [];
    this.stats = {
      totalPixels: 0,
      evictedPixels: 0,
      hits: 0,
      misses: 0
    };
  }
  
  /**
   * 设置最大像素数量
   * @param maxPixels - 最大像素数量
   */
  setMaxPixels(maxPixels: number) {
    this.maxPixels = maxPixels;
    
    // 如果当前像素数量超过新的最大值，进行清理
    if (this.pixels.size > maxPixels) {
      this.cleanup();
    }
  }
  
  /**
   * 强制清理
   * @param targetSize - 目标大小
   */
  forceCleanup(targetSize?: number) {
    const size = targetSize || Math.floor(this.maxPixels * 0.5);
    
    if (this.pixels.size <= size) return;
    
    const pixelPriorities = Array.from(this.pixels.entries()).map(([id, pixel]) => ({
      id,
      pixel,
      priority: this.calculatePixelPriority(pixel)
    }));
    
    pixelPriorities.sort((a, b) => b.priority - a.priority);
    
    const toKeep = pixelPriorities.slice(0, size);
    const toRemove = pixelPriorities.slice(size);
    
    for (const { id } of toRemove) {
      this.pixels.delete(id);
      const index = this.accessOrder.indexOf(id);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.stats.evictedPixels++;
    }
    
    logger.info(`🧹 强制清理完成: 移除${toRemove.length}个像素，保留${toKeep.length}个像素`);
  }
}

export default PixelMemoryManager;
