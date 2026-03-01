/**
 * 性能监控工具
 * 用于测试Plan B性能优化效果
 */

import { logger } from './logger';

export interface PerformanceMetrics {
  timestamp: number;
  renderTime: number; // 毫秒
  pixelCount: number;
  materialCount: number;
  cacheHitRate: number; // 百分比
  memoryUsed: number; // MB
  imageCreationCount: number;
}

export interface PerformanceBenchmark {
  name: string;
  metrics: PerformanceMetrics[];
  startTime: number;
  endTime: number;
  averageRenderTime: number;
  peakMemory: number;
  minRenderTime: number;
  maxRenderTime: number;
  averageCacheHitRate: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private currentBenchmark: string | null = null;
  private startTime: number = 0;

  startBenchmark(name: string) {
    this.currentBenchmark = name;
    this.metrics = [];
    this.startTime = performance.now();
    logger.info(`🚀 开始性能测试: ${name}`);
  }

  recordRender(
    renderTime: number,
    pixelCount: number,
    materialCount: number,
    cacheHitRate: number,
    imageCreationCount: number
  ) {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      renderTime,
      pixelCount,
      materialCount,
      cacheHitRate,
      memoryUsed: this.getMemoryUsed(),
      imageCreationCount
    };

    this.metrics.push(metric);
  }

  endBenchmark(): PerformanceBenchmark {
    if (!this.currentBenchmark || this.metrics.length === 0) {
      throw new Error('未开始或记录任何性能数据');
    }

    const endTime = performance.now();
    const renderTimes = this.metrics.map(m => m.renderTime);
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const minRenderTime = Math.min(...renderTimes);
    const maxRenderTime = Math.max(...renderTimes);
    const peakMemory = Math.max(...this.metrics.map(m => m.memoryUsed));
    const avgCacheHitRate = this.metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / this.metrics.length;

    const benchmark: PerformanceBenchmark = {
      name: this.currentBenchmark,
      metrics: this.metrics,
      startTime: this.startTime,
      endTime,
      averageRenderTime: avgRenderTime,
      peakMemory,
      minRenderTime,
      maxRenderTime,
      averageCacheHitRate: avgCacheHitRate
    };

    this.benchmarks.set(this.currentBenchmark, benchmark);
    this.currentBenchmark = null;

    return benchmark;
  }

  private getMemoryUsed(): number {
    // 类型断言处理 performance.memory（仅在开发工具中可用）
    const perf = performance as any;
    if (!perf.memory) {
      return 0;
    }
    return perf.memory.usedJSHeapSize / 1024 / 1024;
  }

  printBenchmark(name: string) {
    const benchmark = this.benchmarks.get(name);
    if (!benchmark) {
      logger.warn(`未找到基准测试: ${name}`);
      return;
    }

    console.group(`📊 性能基准测试结果: ${name}`);
    console.table({
      '测试时长': `${(benchmark.endTime - benchmark.startTime).toFixed(2)}ms`,
      '测试样本': benchmark.metrics.length,
      '平均渲染时间': `${benchmark.averageRenderTime.toFixed(2)}ms`,
      '最小渲染时间': `${benchmark.minRenderTime.toFixed(2)}ms`,
      '最大渲染时间': `${benchmark.maxRenderTime.toFixed(2)}ms`,
      '峰值内存占用': `${benchmark.peakMemory.toFixed(2)}MB`,
      '平均缓存命中率': `${benchmark.averageCacheHitRate.toFixed(2)}%`
    });
    console.groupEnd();
  }

  compareBenchmarks(name1: string, name2: string) {
    const b1 = this.benchmarks.get(name1);
    const b2 = this.benchmarks.get(name2);

    if (!b1 || !b2) {
      logger.warn('未找到对比的基准测试');
      return;
    }

    const renderTimeImprovement = ((b1.averageRenderTime - b2.averageRenderTime) / b1.averageRenderTime * 100).toFixed(2);
    const memoryImprovement = ((b1.peakMemory - b2.peakMemory) / b1.peakMemory * 100).toFixed(2);
    const cacheHitRateImprovement = (b2.averageCacheHitRate - b1.averageCacheHitRate).toFixed(2);

    console.group(`📈 性能对比: ${name1} vs ${name2}`);
    console.table({
      '指标': ['平均渲染时间', '峰值内存占用', '平均缓存命中率'],
      [name1]: [
        `${b1.averageRenderTime.toFixed(2)}ms`,
        `${b1.peakMemory.toFixed(2)}MB`,
        `${b1.averageCacheHitRate.toFixed(2)}%`
      ],
      [name2]: [
        `${b2.averageRenderTime.toFixed(2)}ms`,
        `${b2.peakMemory.toFixed(2)}MB`,
        `${b2.averageCacheHitRate.toFixed(2)}%`
      ],
      '改进': [
        `${renderTimeImprovement}%`,
        `${memoryImprovement}%`,
        `+${cacheHitRateImprovement}%`
      ]
    });
    console.groupEnd();
  }

  exportToJSON(): string {
    const data = Array.from(this.benchmarks.values()).map(b => ({
      name: b.name,
      averageRenderTime: b.averageRenderTime,
      minRenderTime: b.minRenderTime,
      maxRenderTime: b.maxRenderTime,
      peakMemory: b.peakMemory,
      averageCacheHitRate: b.averageCacheHitRate,
      sampleCount: b.metrics.length
    }));

    return JSON.stringify(data, null, 2);
  }

  clear() {
    this.metrics = [];
    this.benchmarks.clear();
    this.currentBenchmark = null;
  }
}

export const performanceMonitor = new PerformanceMonitor();
