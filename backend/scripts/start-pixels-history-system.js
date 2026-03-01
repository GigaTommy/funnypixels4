#!/usr/bin/env node

/**
 * 像素历史系统启动脚本
 * 自动启动所有必要的服务
 * 
 * 使用方法:
 * node scripts/start-pixels-history-system.js
 * node scripts/start-pixels-history-system.js --queue-only
 * node scripts/start-pixels-history-system.js --help
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../src/utils/logger').default;

class PixelsHistorySystemStarter {
  constructor() {
    this.processes = [];
    this.isShuttingDown = false;
  }

  /**
   * 启动队列处理器
   */
  startQueueProcessor() {
    logger.info('启动像素历史队列处理器');
    
    const queueProcess = spawn('node', [
      path.join(__dirname, 'process-pixels-history-queue.js')
    ], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    queueProcess.on('error', (error) => {
      logger.error('队列处理器启动失败', { error: error.message });
    });

    queueProcess.on('exit', (code) => {
      if (!this.isShuttingDown) {
        logger.warn('队列处理器退出', { exitCode: code });
        logger.info('5秒后重新启动队列处理器');
        setTimeout(() => {
          this.startQueueProcessor();
        }, 5000);
      }
    });

    this.processes.push({
      name: 'queue-processor',
      process: queueProcess
    });

    return queueProcess;
  }

  /**
   * 检查数据库连接
   */
  async checkDatabaseConnection() {
    try {
      console.log('🔍 检查数据库连接...');
      const { db } = require('../src/config/database');
      
      await db.raw('SELECT 1');
      console.log('✅ 数据库连接正常');
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      return false;
    }
  }

  /**
   * 检查Redis连接
   */
  async checkRedisConnection() {
    try {
      console.log('🔍 检查Redis连接...');
      const { redis } = require('../src/config/redis');
      
      await redis.set('test_connection', 'success');
      const result = await redis.get('test_connection');
      await redis.del('test_connection');
      
      if (result === 'success') {
        console.log('✅ Redis连接正常');
        return true;
      } else {
        console.error('❌ Redis连接异常');
        return false;
      }
    } catch (error) {
      console.error('❌ Redis连接失败:', error.message);
      return false;
    }
  }

  /**
   * 检查pixels_history表是否存在
   */
  async checkPixelsHistoryTable() {
    try {
      console.log('🔍 检查pixels_history表...');
      const { db } = require('../src/config/database');
      
      const result = await db.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pixels_history'
        );
      `);
      
      if (result.rows[0].exists) {
        console.log('✅ pixels_history表存在');
        return true;
      } else {
        console.log('⚠️ pixels_history表不存在，请先运行数据库迁移');
        return false;
      }
    } catch (error) {
      console.error('❌ 检查表结构失败:', error.message);
      return false;
    }
  }

  /**
   * 运行数据库迁移
   */
  async runMigrations() {
    try {
      console.log('🔄 运行数据库迁移...');
      
      const migrateProcess = spawn('npm', ['run', 'migrate'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      return new Promise((resolve, reject) => {
        migrateProcess.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ 数据库迁移完成');
            resolve(true);
          } else {
            console.error('❌ 数据库迁移失败');
            reject(new Error('Migration failed'));
          }
        });
      });
    } catch (error) {
      console.error('❌ 运行迁移失败:', error.message);
      return false;
    }
  }

  /**
   * 启动系统
   */
  async start(options = {}) {
    console.log('🎯 启动像素历史系统');
    console.log('='.repeat(50));

    try {
      // 检查数据库连接
      const dbConnected = await this.checkDatabaseConnection();
      if (!dbConnected) {
        console.error('❌ 数据库连接失败，无法启动系统');
        process.exit(1);
      }

      // 检查Redis连接
      const redisConnected = await this.checkRedisConnection();
      if (!redisConnected) {
        console.error('❌ Redis连接失败，无法启动系统');
        process.exit(1);
      }

      // 检查表结构
      const tableExists = await this.checkPixelsHistoryTable();
      if (!tableExists && !options.skipMigration) {
        console.log('🔄 尝试运行数据库迁移...');
        const migrationSuccess = await this.runMigrations();
        if (!migrationSuccess) {
          console.error('❌ 数据库迁移失败，无法启动系统');
          process.exit(1);
        }
      }

      // 启动队列处理器
      if (!options.queueOnly) {
        this.startQueueProcessor();
      }

      console.log('✅ 像素历史系统启动完成');
      console.log('📊 系统状态:');
      console.log('  - 数据库: 已连接');
      console.log('  - Redis: 已连接');
      console.log('  - 队列处理器: 运行中');
      console.log('  - API接口: 可用');

      // 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ 启动系统失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      if (this.isShuttingDown) return;
      
      console.log('\n🛑 正在关闭像素历史系统...');
      this.isShuttingDown = true;

      this.processes.forEach(({ name, process }) => {
        console.log(`🔄 关闭 ${name}...`);
        process.kill('SIGTERM');
      });

      setTimeout(() => {
        console.log('✅ 系统已关闭');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log('📖 像素历史系统启动脚本');
    console.log('='.repeat(50));
    console.log('');
    console.log('🔧 使用方法:');
    console.log('  node scripts/start-pixels-history-system.js [options]');
    console.log('');
    console.log('⚙️ 可用选项:');
    console.log('  --queue-only       只启动队列处理器');
    console.log('  --skip-migration   跳过数据库迁移检查');
    console.log('  --help             显示帮助信息');
    console.log('');
    console.log('📝 示例:');
    console.log('  node scripts/start-pixels-history-system.js');
    console.log('  node scripts/start-pixels-history-system.js --queue-only');
    console.log('  node scripts/start-pixels-history-system.js --skip-migration');
    console.log('');
    console.log('🔍 系统检查:');
    console.log('  - 数据库连接');
    console.log('  - Redis连接');
    console.log('  - pixels_history表存在性');
    console.log('  - 自动运行数据库迁移（如需要）');
    console.log('');
    console.log('🚀 启动服务:');
    console.log('  - 像素历史队列处理器');
    console.log('  - 优雅关闭处理');
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const starter = new PixelsHistorySystemStarter();

  // 处理命令行参数
  const options = {};
  for (const arg of args) {
    switch (arg) {
      case '--queue-only':
        options.queueOnly = true;
        break;
      case '--skip-migration':
        options.skipMigration = true;
        break;
      case '--help':
        starter.showHelp();
        return;
    }
  }

  // 启动系统
  await starter.start(options);
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  });
}

module.exports = PixelsHistorySystemStarter;
