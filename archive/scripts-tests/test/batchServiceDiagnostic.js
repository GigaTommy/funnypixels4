#!/usr/bin/env node

/**
 * 批处理服务诊断测试脚本
 *
 * 专门用于诊断像素批处理服务的问题
 * 包括：
 * 1. 批处理服务状态检查
 * 2. Redis连接和队列状态
 * 3. 批处理队列检查
 * 4. 手动触发批处理
 * 5. 数据库写入验证
 */

// 修复路径问题 - 确保从正确的位置加载模块
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const backendPath = path.join(projectRoot, 'backend');

// 动态加载数据库模块
let db, redis, batchPixelService, asyncGeocodingService;

try {
  // 尝试加载数据库
  const dbModule = require(path.join(backendPath, 'src/config/database'));
  db = dbModule.db;

  // 尝试加载Redis
  const redisModule = require(path.join(backendPath, 'src/config/redis'));
  redis = redisModule.redis;

  // 导入服务类
  batchPixelService = require(path.join(backendPath, 'src/services/batchPixelService'));
  asyncGeocodingService = require(path.join(backendPath, 'src/services/asyncGeocodingService'));

} catch (error) {
  console.error('无法加载必要的模块:', error.message);
  console.log('请确保在项目根目录运行此脚本，并且后端模块可用');
  process.exit(1);
}

class BatchServiceDiagnostic {
  constructor() {
    this.startTime = Date.now();
    this.logs = [];
  }

  log(message, level = 'info', data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      level,
      message,
      data
    };

    this.logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message} (${logEntry.elapsed}ms)`);

    if (data) {
      console.log('    数据:', JSON.stringify(data, null, 2));
    }
  }

  async checkRedisConnection() {
    this.log('检查Redis连接');

    try {
      // 检查Redis是否可用
      const pong = await redis.ping();
      this.log('Redis连接成功', 'success', { pong });

      // 检查Redis信息
      const info = await redis.info();
      this.log('Redis服务器信息', 'success', {
        connected_clients: info.match(/connected_clients:(\d+)/)?.[1],
        used_memory: info.match(/used_memory_human:(.+)/)?.[1]
      });

      return true;
    } catch (error) {
      this.log('Redis连接失败', 'error', { error: error.message });
      return false;
    }
  }

  async checkDatabaseConnection() {
    this.log('检查数据库连接');

    try {
      const result = await db.raw('SELECT 1 as test');
      this.log('数据库连接成功', 'success', result[0]);
      return true;
    } catch (error) {
      this.log('数据库连接失败', 'error', { error: error.message });
      return false;
    }
  }

  async checkBatchServiceStatus() {
    this.log('检查批处理服务状态');

    try {
      // 获取批处理服务统计信息
      const stats = batchPixelService.getStats();
      this.log('批处理服务统计', 'success', stats);

      // 检查服务健康状态
      const healthStatus = batchPixelService.getHealthStatus();
      this.log('批处理服务健康状态', 'success', healthStatus);

      return { stats, healthStatus };
    } catch (error) {
      this.log('批处理服务状态检查失败', 'error', { error: error.message });
      return null;
    }
  }

  async checkGeocodingServiceStatus() {
    this.log('检查异步地理编码服务状态');

    try {
      const queueStats = await asyncGeocodingService.getQueueStats();
      this.log('地理编码服务队列统计', 'success', queueStats);
      return queueStats;
    } catch (error) {
      this.log('地理编码服务状态检查失败', 'error', { error: error.message });
      return null;
    }
  }

  async checkRedisQueues() {
    this.log('检查Redis队列状态');

    try {
      // 检查批处理队列
      const batchQueueKeys = [
        'batch:pixels:pending',
        'batch:history:pending',
        'batch:cache:pending'
      ];

      const queueStatus = {};

      for (const key of batchQueueKeys) {
        try {
          const length = await redis.llen(key);
          queueStatus[key] = {
            exists: true,
            length,
            type: 'list'
          };

          if (length > 0) {
            // 查看队列中的前几个元素
            const sample = await redis.lrange(key, 0, 2);
            queueStatus[key].sample = sample;
          }
        } catch (error) {
          queueStatus[key] = {
            exists: false,
            error: error.message
          };
        }
      }

      this.log('Redis队列状态', 'success', queueStatus);
      return queueStatus;
    } catch (error) {
      this.log('Redis队列检查失败', 'error', { error: error.message });
      return null;
    }
  }

  async checkPixelTables() {
    this.log('检查像素相关数据表');

    const tables = ['pixels', 'pixels_history'];
    const results = {};

    for (const table of tables) {
      try {
        // 检查表是否存在
        const exists = await db.schema.hasTable(table);

        if (exists) {
          // 获取表记录数
          const countResult = await db(table).count('* as count').first();
          const count = parseInt(countResult.count);

          // 获取最新的几条记录
          const latestRecords = await db(table)
            .orderBy('created_at', 'desc')
            .limit(3);

          results[table] = {
            exists: true,
            count,
            latestRecords
          };

          this.log(`表${table}状态`, 'success', {
            记录数: count,
            最新记录: latestRecords.map(r => ({
              id: r.id,
              grid_id: r.grid_id,
              created_at: r.created_at
            }))
          });
        } else {
          results[table] = { exists: false };
          this.log(`表${table}不存在`, 'error');
        }
      } catch (error) {
        results[table] = { error: error.message };
        this.log(`检查表${table}失败`, 'error', { error: error.message });
      }
    }

    return results;
  }

  async createTestPixel() {
    this.log('创建测试像素数据');

    const testPixelData = {
      gridId: 'test_' + Date.now(),
      latitude: 39.9042,
      longitude: 116.4074,
      userId: 'test_user_diagnostic',
      color: '#FF0000',
      patternId: null,
      pixelType: 'basic',
      relatedId: null
    };

    const testHistoryData = {
      latitude: testPixelData.latitude,
      longitude: testPixelData.longitude,
      color: testPixelData.color,
      user_id: testPixelData.userId,
      grid_id: testPixelData.gridId,
      pattern_id: testPixelData.patternId,
      pixel_type: testPixelData.pixelType,
      related_id: testPixelData.relatedId,
      draw_type: 'manual',
      created_at: new Date()
    };

    const testCacheUpdates = [
      {
        type: 'pixel',
        key: `pixel:${testPixelData.gridId}`,
        value: {
          color: testPixelData.color,
          userId: testPixelData.userId,
          timestamp: new Date()
        }
      }
    ];

    try {
      // 添加到批处理队列
      const batchResult = await batchPixelService.addToBatch(
        testPixelData,
        testHistoryData,
        testCacheUpdates
      );

      this.log('测试像素添加到批处理队列', 'success', {
        gridId: testPixelData.gridId,
        batchResult
      });

      return {
        testPixelData,
        testHistoryData,
        testCacheUpdates,
        batchResult
      };
    } catch (error) {
      this.log('添加测试像素到批处理队列失败', 'error', { error: error.message });
      return null;
    }
  }

  async forceFlushBatches() {
    this.log('强制刷新批处理队列');

    try {
      const flushResult = await batchPixelService.forceFlush();
      this.log('批处理队列刷新结果', 'success', flushResult);
      return flushResult;
    } catch (error) {
      this.log('强制刷新批处理队列失败', 'error', { error: error.message });
      return null;
    }
  }

  async checkTestPixelInDatabase(gridId) {
    this.log(`检查测试像素 ${gridId} 是否写入数据库`);

    const results = {};

    // 检查pixels表
    try {
      const pixel = await db('pixels').where('grid_id', gridId).first();
      results.pixels = pixel || null;
      this.log('pixels表检查结果', pixel ? 'success' : 'warning', { found: !!pixel });
    } catch (error) {
      results.pixels = { error: error.message };
      this.log('pixels表查询失败', 'error', { error: error.message });
    }

    // 检查pixels_history表
    try {
      const history = await db('pixels_history').where('grid_id', gridId).first();
      results.history = history || null;
      this.log('pixels_history表检查结果', history ? 'success' : 'warning', { found: !!history });
    } catch (error) {
      results.history = { error: error.message };
      this.log('pixels_history表查询失败', 'error', { error: error.message });
    }

    return results;
  }

  async checkServiceLogs() {
    this.log('检查服务日志');

    // 这里可以添加日志文件检查逻辑
    // 由于不同环境的日志配置可能不同，这里只做基本检查

    const logPaths = [
      '../../logs/app.log',
      '../../logs/error.log',
      '../../logs/batch-service.log'
    ];

    const logStatus = {};

    for (const logPath of logPaths) {
      try {
        const fs = require('fs');
        const fullPath = require('path').resolve(__dirname, logPath);

        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          logStatus[logPath] = {
            exists: true,
            size: stats.size,
            modified: stats.mtime
          };
        } else {
          logStatus[logPath] = { exists: false };
        }
      } catch (error) {
        logStatus[logPath] = { error: error.message };
      }
    }

    this.log('服务日志状态', 'info', logStatus);
    return logStatus;
  }

  async runDiagnostic() {
    this.log('开始批处理服务诊断');

    const results = {
      redis: {},
      database: {},
      services: {},
      queues: {},
      tables: {},
      testPixel: null,
      finalCheck: null
    };

    // 1. 检查基础连接
    results.redis.connected = await this.checkRedisConnection();
    results.database.connected = await this.checkDatabaseConnection();

    if (!results.redis.connected || !results.database.connected) {
      this.log('基础连接检查失败，无法继续诊断', 'error');
      return results;
    }

    // 2. 检查服务状态
    results.services.batchService = await this.checkBatchServiceStatus();
    results.services.geocodingService = await this.checkGeocodingServiceStatus();

    // 3. 检查队列状态
    results.queues = await this.checkRedisQueues();

    // 4. 检查数据库表
    results.tables = await this.checkPixelTables();

    // 5. 创建测试像素
    results.testPixel = await this.createTestPixel();

    if (!results.testPixel) {
      this.log('无法创建测试像素，跳过后续测试', 'error');
      return results;
    }

    // 6. 等待一段时间让批处理处理
    this.log('等待10秒让批处理服务处理数据');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 7. 强制刷新批处理队列
    await this.forceFlushBatches();

    // 8. 再次等待处理完成
    this.log('再次等待5秒');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 9. 检查测试像素是否写入数据库
    results.finalCheck = await this.checkTestPixelInDatabase(results.testPixel.testPixelData.gridId);

    // 10. 检查服务日志
    const logStatus = await this.checkServiceLogs();

    // 生成诊断结论
    this.generateDiagnosticConclusion(results, logStatus);

    this.log('批处理服务诊断完成');
    return results;
  }

  generateDiagnosticConclusion(results, logStatus) {
    this.log('=== 诊断结论 ===');

    const issues = [];
    const warnings = [];

    // 检查基础连接
    if (!results.redis.connected) {
      issues.push('Redis连接失败 - 批处理服务无法正常工作');
    }

    if (!results.database.connected) {
      issues.push('数据库连接失败 - 数据无法写入');
    }

    // 检查服务状态
    if (results.services.batchService) {
      const health = results.services.batchService.healthStatus;
      if (health.isProcessing) {
        warnings.push('批处理服务正在处理中，可能影响测试结果');
      }

      if (health.queueSize > 0) {
        warnings.push(`批处理队列中有${health.queueSize}个待处理项目`);
      }
    } else {
      issues.push('批处理服务状态检查失败');
    }

    // 检查队列状态
    if (results.queues) {
      Object.entries(results.queues).forEach(([key, status]) => {
        if (status.length > 0) {
          warnings.push(`Redis队列 ${key} 中有 ${status.length} 个待处理项目`);
        }
      });
    }

    // 检查测试结果
    if (results.testPixel && results.finalCheck) {
      const pixelInDb = results.finalCheck.pixels;
      const historyInDb = results.finalCheck.history;

      if (!pixelInDb) {
        issues.push('测试像素未写入pixels表 - 批处理写入失败');
      }

      if (!historyInDb) {
        warnings.push('测试像素历史记录未写入pixels_history表');
      }

      if (pixelInDb && historyInDb) {
        this.log('✅ 测试像素成功写入数据库，批处理服务正常工作', 'success');
      }
    }

    // 输出结论
    if (issues.length === 0 && warnings.length === 0) {
      this.log('✅ 批处理服务工作正常，未发现问题', 'success');
    } else {
      if (issues.length > 0) {
        this.log('❌ 发现以下问题:', 'error');
        issues.forEach((issue, index) => {
          this.log(`   ${index + 1}. ${issue}`, 'error');
        });
      }

      if (warnings.length > 0) {
        this.log('⚠️  以下需要注意:', 'warning');
        warnings.forEach((warning, index) => {
          this.log(`   ${index + 1}. ${warning}`, 'warning');
        });
      }
    }

    // 提供修复建议
    if (issues.length > 0) {
      this.log('\n🔧 修复建议:');

      if (issues.some(i => i.includes('Redis'))) {
        this.log('   - 检查Redis服务是否启动');
        this.log('   - 验证Redis连接配置');
        this.log('   - 检查Redis内存和磁盘空间');
      }

      if (issues.some(i => i.includes('数据库'))) {
        this.log('   - 检查数据库服务状态');
        this.log('   - 验证数据库连接配置');
        this.log('   - 检查数据库权限');
      }

      if (issues.some(i => i.includes('批处理'))) {
        this.log('   - 重启批处理服务');
        this.log('   - 检查批处理服务配置');
        this.log('   - 查看批处理服务日志');
        this.log('   - 手动清空批处理队列');
      }

      if (issues.some(i => i.includes('写入失败'))) {
        this.log('   - 检查数据库表结构');
        this.log('   - 验证写入权限');
        this.log('   - 查看数据库错误日志');
      }
    }
  }
}

// 执行诊断
async function runBatchServiceDiagnostic() {
  const diagnostic = new BatchServiceDiagnostic();

  try {
    const results = await diagnostic.runDiagnostic();

    // 保存诊断结果
    const fs = require('fs');
    const path = require('path');

    const reportPath = path.join(__dirname, 'batch_service_diagnostic_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      results,
      logs: diagnostic.logs,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`\n📄 详细报告已保存到: ${reportPath}`);

    return results;
  } catch (error) {
    console.error('批处理服务诊断失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runBatchServiceDiagnostic()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('诊断脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { BatchServiceDiagnostic, runBatchServiceDiagnostic };