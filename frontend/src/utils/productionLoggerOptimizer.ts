/**
 * productionLoggerOptimizer.ts - 生产环境日志优化工具
 *
 * 统一处理生产环境日志优化，确保性能和用户体验
 */

import { logger } from './logger';
import { isBrowser } from './browserEnvironment';

// ========== 日志优化配置 ==========

interface LogOptimizationConfig {
  enableConsoleOverride: boolean;
  logLevelThreshold: 'debug' | 'info' | 'warn' | 'error';
  maxLogPerSecond: number;
  enableLogBatching: boolean;
  batchInterval: number;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
}

const DEFAULT_CONFIG: LogOptimizationConfig = {
  enableConsoleOverride: true,
  logLevelThreshold: isBrowser && import.meta.env.PROD ? 'error' : 'debug',
  maxLogPerSecond: 50,
  enableLogBatching: isBrowser && import.meta.env.PROD,
  batchInterval: 1000,
  enableRemoteLogging: false,
  remoteEndpoint: undefined
};

// ========== 日志限流器 ==========

class LogRateLimiter {
  private logs: number = 0;
  private lastReset: number = Date.now();
  private droppedLogs: number = 0;

  constructor(private maxLogsPerSecond: number) {}

  shouldLog(): boolean {
    const now = Date.now();

    // 重置计数器
    if (now - this.lastReset >= 1000) {
      this.logs = 0;
      this.lastReset = now;
      this.droppedLogs = 0;
    }

    this.logs++;

    if (this.logs > this.maxLogsPerSecond) {
      this.droppedLogs++;
      return false;
    }

    return true;
  }

  getStats() {
    return {
      logs: this.logs,
      droppedLogs: this.droppedLogs,
      timeWindow: Date.now() - this.lastReset
    };
  }
}

// ========== 日志批处理器 ==========

class LogBatcher {
  private batch: Array<{ level: string; timestamp: number; args: any[] }> = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private interval: number,
    private onFlush: (batch: any[]) => void
  ) {}

  add(level: string, args: any[]) {
    this.batch.push({
      level,
      timestamp: Date.now(),
      args
    });

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.interval);
    }
  }

  private flush() {
    if (this.batch.length > 0) {
      const currentBatch = [...this.batch];
      this.batch = [];
      this.onFlush(currentBatch);
    }
    this.timer = null;
  }

  flushNow() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.flush();
    }
  }
}

// ========== 生产环境日志优化器 ==========

class ProductionLoggerOptimizer {
  private config: LogOptimizationConfig;
  private rateLimiter: LogRateLimiter;
  private batcher: LogBatcher | null = null;
  private originalConsole: { [key: string]: Function } = {};

  constructor(config: Partial<LogOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new LogRateLimiter(this.config.maxLogPerSecond);

    if (this.config.enableLogBatching) {
      this.batcher = new LogBatcher(this.config.batchInterval, this.handleBatchFlush.bind(this));
    }

    this.initialize();
  }

  /**
   * 初始化日志优化
   */
  private initialize() {
    if (!isBrowser || !this.config.enableConsoleOverride) {
      return;
    }

    // 保存原始console方法
    this.originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    // 根据环境覆盖console方法
    this.overrideConsoleMethods();
  }

  /**
   * 覆盖console方法
   */
  private overrideConsoleMethods() {
    const levels = ['log', 'debug', 'info', 'warn', 'error'] as const;

    levels.forEach(level => {
      const priority = this.getLogLevelPriority(level as any);
      const thresholdPriority = this.getLogLevelPriority(this.config.logLevelThreshold);

      if (priority < thresholdPriority) {
        // 低于阈值的日志级别设为空函数
        (console as any)[level] = () => undefined;
      } else {
        // 高于阈值的日志级别保持原样，但添加限流
        (console as any)[level] = (...args: any[]) => {
          this.processLog(level as any, ...args);
        };
      }
    });

    // 应用日志策略
    this.applyConsoleLoggingPolicy();
  }

  /**
   * 处理日志入口（兼容safeConsole调用）
   */
  processLog(level: string, ...args: any[]) {
    this.processConsoleLog(level, ...args);
  }

  /**
   * 处理console日志
   */
  private processConsoleLog(level: string, ...args: any[]) {
    // 限流检查
    if (!this.rateLimiter.shouldLog()) {
      return;
    }

    // 批处理
    if (this.batcher && level !== 'error') {
      this.batcher.add(level, args);
    } else {
      // 立即输出错误日志或非批处理环境下的日志
      this.outputLog(level, args);
    }
  }

  /**
   * 输出日志
   */
  private outputLog(level: string, args: any[]) {
    const originalMethod = this.originalConsole[level as keyof typeof this.originalConsole];
    if (originalMethod) {
      originalMethod.apply(console, args);
    }
  }

  /**
   * 处理批次刷新
   */
  private handleBatchFlush(batch: any[]) {
    if (batch.length === 0) return;

    // 过滤批次中的日志
    const filteredBatch = batch.filter(log => {
      const priority = this.getLogLevelPriority(log.level);
      const thresholdPriority = this.getLogLevelPriority(this.config.logLevelThreshold);
      return priority >= thresholdPriority;
    });

    // 输出批次日志
    filteredBatch.forEach(log => {
      this.outputLog(log.level, log.args);
    });

    // 远程日志记录（如果启用）
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.sendToRemoteServer(filteredBatch);
    }
  }

  /**
   * 发送到远程服务器
   */
  private sendToRemoteServer(batch: any[]) {
    if (!this.config.remoteEndpoint) return;

    try {
      // 使用fetch发送日志到远程服务器
      fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: batch,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // 远程日志发送失败不应该影响应用
      });
    } catch (error) {
      // 静默处理远程日志错误
    }
  }

  /**
   * 获取日志级别优先级
   */
  private getLogLevelPriority(level: string): number {
    const priorities: { [key: string]: number } = {
      debug: 0,
      info: 1,
      log: 1,
      warn: 2,
      error: 3
    };
    return priorities[level] || 1;
  }

  /**
   * 应用控制台日志策略
   */
  private applyConsoleLoggingPolicy() {
    // 生产环境禁用某些console方法
    if (import.meta.env.PROD) {
      console.debug = () => undefined;
      console.log = () => undefined;
      console.info = () => undefined;
      // 保留console.warn和console.error用于调试
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LogOptimizationConfig>) {
    this.config = { ...this.config, ...newConfig };

    // 重新初始化
    if (this.batcher) {
      this.batcher.flushNow();
    }
    this.initialize();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      batcher: this.batcher ? {
        pendingBatch: this.batcher ? this.batcher['batch'].length : 0,
        interval: this.config.batchInterval
      } : null,
      config: this.config
    };
  }

  /**
   * 销毁优化器
   */
  destroy() {
    if (this.batcher) {
      this.batcher.flushNow();
    }

    // 恢复原始console方法
    Object.entries(this.originalConsole).forEach(([key, method]) => {
      (console as any)[key] = method;
    });
  }
}

// ========== 全局优化器实例 ==========

let globalOptimizer: ProductionLoggerOptimizer | null = null;

/**
 * 初始化生产环境日志优化
 */
export function initializeProductionLogger(config: Partial<LogOptimizationConfig> = {}) {
  if (!isBrowser) {
    return;
  }

  // 销毁之前的优化器（如果存在）
  if (globalOptimizer) {
    globalOptimizer.destroy();
  }

  // 创建新的优化器
  globalOptimizer = new ProductionLoggerOptimizer(config);

  // 注册页面卸载时的清理
  window.addEventListener('beforeunload', () => {
    if (globalOptimizer) {
      globalOptimizer.destroy();
    }
  });
}

/**
 * 获取全局优化器
 */
export function getProductionLoggerOptimizer(): ProductionLoggerOptimizer | null {
  return globalOptimizer;
}

/**
 * 安全的console替代方法
 */
export const safeConsole = {
  log: (...args: any[]) => {
    if (globalOptimizer) {
      globalOptimizer.processLog('log', ...args);
    } else if (!import.meta.env.PROD) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (globalOptimizer) {
      globalOptimizer.processLog('debug', ...args);
    } else if (!import.meta.env.PROD) {
      console.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (globalOptimizer) {
      globalOptimizer.processLog('info', ...args);
    } else if (!import.meta.env.PROD) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    if (globalOptimizer) {
      globalOptimizer.processLog('warn', ...args);
    } else {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    if (globalOptimizer) {
      globalOptimizer.processLog('error', ...args);
    } else {
      console.error(...args);
    }
  }
};

// 默认导出优化器
export default ProductionLoggerOptimizer;