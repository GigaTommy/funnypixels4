#!/usr/bin/env node

/**
 * 像素历史队列处理脚本
 * 定期处理Redis队列中的像素历史记录
 * 
 * 使用方法:
 * node scripts/process-pixels-history-queue.js
 * node scripts/process-pixels-history-queue.js --once
 * node scripts/process-pixels-history-queue.js --interval 30000
 */

const pixelsHistoryService = require('../src/services/pixelsHistoryService');

class PixelsHistoryQueueProcessor {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.processInterval = 5000; // 默认5秒处理一次
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒重试延迟
  }

  /**
   * 启动队列处理器
   * @param {Object} options - 选项
   */
  async start(options = {}) {
    if (this.isRunning) {
      console.log('⚠️ 队列处理器已在运行中');
      return;
    }

    this.isRunning = true;
    this.processInterval = options.interval || this.processInterval;
    const runOnce = options.once || false;

    console.log(`🚀 启动像素历史队列处理器`);
    console.log(`📊 处理间隔: ${this.processInterval}ms`);
    console.log(`🔄 运行模式: ${runOnce ? '单次运行' : '持续运行'}`);

    if (runOnce) {
      await this.processQueue();
      this.stop();
    } else {
      this.interval = setInterval(async () => {
        await this.processQueue();
      }, this.processInterval);
    }
  }

  /**
   * 停止队列处理器
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 像素历史队列处理器已停止');
  }

  /**
   * 处理队列
   */
  async processQueue() {
    try {
      const result = await pixelsHistoryService.processQueue();
      
      if (result.success && result.data.processed > 0) {
        console.log(`✅ 处理了 ${result.data.processed} 条队列消息`);
      }
    } catch (error) {
      console.error('❌ 处理队列时发生错误:', error);
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus() {
    try {
      const { redis } = require('../src/config/database');
      const queueName = 'pixel_history_queue';
      
      // 获取队列长度
      const queueLength = await redis.xLen(queueName);
      
      // 获取消费者组信息
      let consumerGroups = [];
      try {
        const groups = await redis.xInfo('GROUPS', queueName);
        consumerGroups = groups;
      } catch (error) {
        // 如果没有消费者组，忽略错误
      }

      return {
        queueName,
        queueLength,
        consumerGroups,
        isRunning: this.isRunning,
        processInterval: this.processInterval
      };
    } catch (error) {
      console.error('❌ 获取队列状态失败:', error);
      return null;
    }
  }

  /**
   * 清理队列
   */
  async clearQueue() {
    try {
      const { redis } = require('../src/config/database');
      const queueName = 'pixel_history_queue';
      
      // 删除整个队列
      await redis.del(queueName);
      console.log('🗑️ 队列已清空');
    } catch (error) {
      console.error('❌ 清理队列失败:', error);
    }
  }

  /**
   * 监控队列性能
   */
  async monitorPerformance() {
    try {
      console.log('📊 队列性能监控');
      console.log('='.repeat(50));

      const status = await this.getQueueStatus();
      if (status) {
        console.log(`队列名称: ${status.queueName}`);
        console.log(`队列长度: ${status.queueLength}`);
        console.log(`运行状态: ${status.isRunning ? '运行中' : '已停止'}`);
        console.log(`处理间隔: ${status.processInterval}ms`);
        
        if (status.consumerGroups.length > 0) {
          console.log('\n消费者组:');
          status.consumerGroups.forEach(group => {
            console.log(`  - ${group.name}: ${group.consumers} 个消费者`);
          });
        }
      }

      // 获取处理统计
      const startTime = Date.now();
      const result = await pixelsHistoryService.processQueue();
      const processingTime = Date.now() - startTime;

      console.log(`\n处理性能:`);
      console.log(`  处理时间: ${processingTime}ms`);
      console.log(`  处理数量: ${result.data?.processed || 0} 条`);
      
      if (result.data?.processed > 0) {
        console.log(`  平均处理时间: ${(processingTime / result.data.processed).toFixed(2)}ms/条`);
      }

    } catch (error) {
      console.error('❌ 监控性能时发生错误:', error);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const processor = new PixelsHistoryQueueProcessor();

  // 处理命令行参数
  const options = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--once':
        options.once = true;
        break;
      case '--interval':
        options.interval = parseInt(args[i + 1]) || 5000;
        i++; // 跳过下一个参数
        break;
      case '--status':
        await processor.getQueueStatus().then(status => {
          if (status) {
            console.log('📊 队列状态:', JSON.stringify(status, null, 2));
          }
        });
        return;
      case '--clear':
        await processor.clearQueue();
        return;
      case '--monitor':
        await processor.monitorPerformance();
        return;
      case '--help':
        console.log('📖 使用方法:');
        console.log('  node scripts/process-pixels-history-queue.js [options]');
        console.log('');
        console.log('🔧 可用选项:');
        console.log('  --once              单次运行');
        console.log('  --interval <ms>     设置处理间隔（毫秒）');
        console.log('  --status            显示队列状态');
        console.log('  --clear             清空队列');
        console.log('  --monitor           监控性能');
        console.log('  --help              显示帮助');
        console.log('');
        console.log('📝 示例:');
        console.log('  node scripts/process-pixels-history-queue.js');
        console.log('  node scripts/process-pixels-history-queue.js --once');
        console.log('  node scripts/process-pixels-history-queue.js --interval 10000');
        console.log('  node scripts/process-pixels-history-queue.js --status');
        return;
    }
  }

  // 启动处理器
  await processor.start(options);

  // 处理优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 收到停止信号，正在关闭...');
    processor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在关闭...');
    processor.stop();
    process.exit(0);
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  });
}

module.exports = PixelsHistoryQueueProcessor;
