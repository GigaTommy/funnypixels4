/**
 * 像素批处理事件总线
 * 使用EventEmitter实现事件驱动架构，避免轮询和阻塞
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * 像素批处理事件总线
 * 支持的事件：
 * - pixels-flushed: 批处理完成，像素已写入数据库
 * - batch-error: 批处理失败
 */
class PixelBatchEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // 允许更多监听器
    this.eventStats = {
      pixelsFlushed: 0,
      batchErrors: 0,
      geocodingTriggered: 0
    };

    // 监控事件总线健康状态
    this.on('pixels-flushed', (pixels) => {
      this.eventStats.pixelsFlushed += pixels.length;
      logger.debug(`📡 Event: pixels-flushed, count=${pixels.length}`);
    });

    this.on('batch-error', (error) => {
      this.eventStats.batchErrors++;
      logger.error('📡 Event: batch-error', { error: error.message });
    });

    logger.info('✅ PixelBatchEventBus initialized');
  }

  /**
   * 发出批处理完成事件
   * @param {Array} pixels - 已处理的像素数据
   */
  emitPixelsFlushed(pixels) {
    if (!pixels || pixels.length === 0) {
      return;
    }

    // 🚀 异步emit，不阻塞批处理主流程
    setImmediate(() => {
      try {
        this.emit('pixels-flushed', pixels);
      } catch (error) {
        logger.error('❌ Error emitting pixels-flushed event:', error);
        this.emit('batch-error', error);
      }
    });
  }

  /**
   * 发出批处理错误事件
   * @param {Error} error - 错误对象
   */
  emitBatchError(error) {
    setImmediate(() => {
      this.emit('batch-error', error);
    });
  }

  /**
   * 获取事件统计
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.eventStats,
      listeners: {
        pixelsFlushed: this.listenerCount('pixels-flushed'),
        batchError: this.listenerCount('batch-error')
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.eventStats = {
      pixelsFlushed: 0,
      batchErrors: 0,
      geocodingTriggered: 0
    };
    logger.info('📊 Event bus stats reset');
  }
}

// 创建单例实例
const pixelBatchEventBus = new PixelBatchEventBus();

module.exports = pixelBatchEventBus;
