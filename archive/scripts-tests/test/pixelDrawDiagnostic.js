#!/usr/bin/env node

/**
 * 像素绘制流程诊断测试脚本
 *
 * 功能：
 * 1. 测试从用户点击到数据库写入的完整流程
 * 2. 定位具体哪个环节出现问题
 * 3. 提供详细的错误信息和日志
 *
 * 使用方法：
 * node scripts/test/pixelDrawDiagnostic.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 修复路径问题 - 确保从正确的位置加载模块
const projectRoot = path.resolve(__dirname, '../..');
const backendPath = path.join(projectRoot, 'backend');

// 动态加载数据库模块
let db;
try {
  // 尝试直接从相对路径加载
  db = require('../../backend/src/config/database').db;
} catch (error) {
  try {
    // 如果失败，尝试从绝对路径加载
    const dbModule = require(path.join(backendPath, 'src/config/database'));
    db = dbModule.db;
  } catch (error2) {
    console.error('无法加载数据库模块:', error2.message);
    console.log('请确保在项目根目录运行此脚本');
    process.exit(1);
  }
}

// 测试配置
const CONFIG = {
  // 后端API地址
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',

  // 测试用户凭据
  TEST_USER: {
    username: 'testuser_diagnostic',
    password: 'test123456'
  },

  // 测试坐标（北京天安门附近）
  TEST_COORDINATES: {
    latitude: 39.9042,
    longitude: 116.4074
  },

  // 测试颜色
  TEST_COLOR: '#FF0000',

  // 超时设置
  TIMEOUTS: {
    API: 10000,        // API请求超时
    DB_CHECK: 5000,    // 数据库检查超时
    TOTAL: 30000       // 总测试超时
  }
};

// 诊断结果收集器
class DiagnosticCollector {
  constructor() {
    this.steps = [];
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  addStep(stepName, data = null, status = 'success') {
    const step = {
      name: stepName,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      status,
      data
    };

    this.steps.push(step);
    console.log(`[${status.toUpperCase()}] ${stepName} (${step.elapsed}ms)`);

    if (data) {
      console.log('    数据:', JSON.stringify(data, null, 2));
    }
  }

  addError(error, context = null) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime
    };

    this.errors.push(errorInfo);
    console.error(`[ERROR] ${error.message}`);
    if (context) {
      console.error('    上下文:', context);
    }
  }

  addWarning(message, context = null) {
    const warningInfo = {
      message,
      context,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime
    };

    this.warnings.push(warningInfo);
    console.warn(`[WARNING] ${message}`);
    if (context) {
      console.warn('    上下文:', context);
    }
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;

    const report = {
      summary: {
        totalSteps: this.steps.length,
        successSteps: this.steps.filter(s => s.status === 'success').length,
        errorCount: this.errors.length,
        warningCount: this.warnings.length,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      },
      steps: this.steps,
      errors: this.errors,
      warnings: this.warnings
    };

    return report;
  }
}

// 数据库验证工具
class DatabaseValidator {
  static async checkConnection() {
    try {
      await db.raw('SELECT 1');
      return { success: true, message: '数据库连接正常' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async checkTableExists(tableName) {
    try {
      const result = await db.schema.hasTable(tableName);
      return { success: true, exists: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async checkTableStructure(tableName) {
    try {
      const columns = await db.table(tableName).columnInfo();
      return { success: true, columns };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async findPixelByGridId(gridId) {
    try {
      const pixel = await db('pixels').where('grid_id', gridId).first();
      return { success: true, pixel };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async findPixelHistoryByGridId(gridId) {
    try {
      const history = await db('pixels_history').where('grid_id', gridId).first();
      return { success: true, history };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getLatestPixels(limit = 10) {
    try {
      const pixels = await db('pixels')
        .orderBy('created_at', 'desc')
        .limit(limit);
      return { success: true, pixels };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// API测试工具
class APITester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      timeout: CONFIG.TIMEOUTS.API,
      validateStatus: () => true // 不抛出HTTP错误
    });
  }

  async registerUser(userData) {
    try {
      const response = await this.axios.post('/api/auth/register', userData);
      return {
        success: response.data.success,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async loginUser(userData) {
    try {
      const response = await this.axios.post('/api/auth/login', userData);
      return {
        success: response.data.success,
        data: response.data,
        status: response.status,
        token: response.data.data?.token
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async validateUserState(token) {
    try {
      const response = await this.axios.get('/api/pixel-draw/validate', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return {
        success: response.data.success,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async drawPixelManual(pixelData, token) {
    try {
      const response = await this.axios.post('/api/pixel-draw/manual', pixelData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return {
        success: response.data.success,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getServiceStatus(token) {
    try {
      const response = await this.axios.get('/api/pixel-draw/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return {
        success: response.data.success,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 计算网格ID的函数
function calculateGridId(latitude, longitude) {
  const lat = Math.floor((latitude + 90) * 1000000 / 11);
  const lng = Math.floor((longitude + 180) * 1000000 / 11);
  return `${lat}_${lng}`;
}

// 主要诊断函数
async function runPixelDrawDiagnostic() {
  console.log('🔍 开始像素绘制流程诊断测试...\n');

  const diagnostic = new DiagnosticCollector();
  const apiTester = new APITester(CONFIG.BACKEND_URL);

  let testUser = null;
  let authToken = null;
  let testGridId = null;

  try {
    // === 第1步：数据库连接检查 ===
    console.log('\n=== 第1步：数据库连接检查 ===');
    const dbConnection = await DatabaseValidator.checkConnection();
    if (dbConnection.success) {
      diagnostic.addStep('数据库连接检查', dbConnection);
    } else {
      diagnostic.addError(new Error(dbConnection.error), '数据库连接检查');
      throw new Error('数据库连接失败，无法继续测试');
    }

    // === 第2步：数据库表结构检查 ===
    console.log('\n=== 第2步：数据库表结构检查 ===');

    const tables = ['pixels', 'pixels_history', 'users', 'user_pixel_states'];
    for (const tableName of tables) {
      const tableExists = await DatabaseValidator.checkTableExists(tableName);
      if (tableExists.success && tableExists.exists) {
        diagnostic.addStep(`表${tableName}存在检查`, tableExists);

        // 检查表结构
        const tableStructure = await DatabaseValidator.checkTableStructure(tableName);
        if (tableStructure.success) {
          diagnostic.addStep(`表${tableName}结构检查`, {
            columnCount: Object.keys(tableStructure.columns).length,
            columns: Object.keys(tableStructure.columns)
          });
        } else {
          diagnostic.addWarning(`表${tableName}结构检查失败`, tableStructure.error);
        }
      } else {
        diagnostic.addError(new Error(tableExists.error || `表${tableName}不存在`), `表${tableName}检查`);
      }
    }

    // === 第3步：后端服务状态检查 ===
    console.log('\n=== 第3步：后端服务状态检查 ===');

    try {
      const healthResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, {
        timeout: 5000
      });
      diagnostic.addStep('后端健康检查', {
        status: healthResponse.status,
        data: healthResponse.data
      });
    } catch (error) {
      diagnostic.addError(error, '后端健康检查');
      throw new Error('后端服务不可用');
    }

    // === 第4步：测试用户注册 ===
    console.log('\n=== 第4步：测试用户注册 ===');

    const registerResult = await apiTester.registerUser(CONFIG.TEST_USER);
    if (registerResult.success) {
      testUser = registerResult.data.data.user;
      diagnostic.addStep('用户注册成功', testUser);
    } else {
      // 注册失败可能是用户已存在，尝试登录
      diagnostic.addWarning('用户注册失败，尝试登录', registerResult);
    }

    // === 第5步：用户登录 ===
    console.log('\n=== 第5步：用户登录 ===');

    const loginResult = await apiTester.loginUser(CONFIG.TEST_USER);
    if (loginResult.success && loginResult.token) {
      authToken = loginResult.token;
      testUser = loginResult.data.data.user;
      diagnostic.addStep('用户登录成功', {
        userId: testUser.id,
        username: testUser.username,
        totalPixels: testUser.total_pixels
      });
    } else {
      diagnostic.addError(new Error(loginResult.error || '登录失败'), '用户登录');
      throw new Error('无法获取认证令牌');
    }

    // === 第6步：用户绘制状态验证 ===
    console.log('\n=== 第6步：用户绘制状态验证 ===');

    const userStateResult = await apiTester.validateUserState(authToken);
    if (userStateResult.success) {
      diagnostic.addStep('用户绘制状态验证', userStateResult.data.data);

      // 检查用户是否可以绘制
      const userState = userStateResult.data.data;
      if (!userState.canDraw) {
        diagnostic.addWarning('用户当前无法绘制', userState.reason);
      }
    } else {
      diagnostic.addError(new Error(userStateResult.error || '状态验证失败'), '用户绘制状态验证');
    }

    // === 第7步：绘制服务状态检查 ===
    console.log('\n=== 第7步：绘制服务状态检查 ===');

    const serviceStatusResult = await apiTester.getServiceStatus(authToken);
    if (serviceStatusResult.success) {
      diagnostic.addStep('绘制服务状态检查', serviceStatusResult.data.data);
    } else {
      diagnostic.addWarning('绘制服务状态检查失败', serviceStatusResult);
    }

    // === 第8步：准备测试数据 ===
    console.log('\n=== 第8步：准备测试数据 ===');

    testGridId = calculateGridId(
      CONFIG.TEST_COORDINATES.latitude,
      CONFIG.TEST_COORDINATES.longitude
    );

    const pixelDrawData = {
      lat: CONFIG.TEST_COORDINATES.latitude,
      lng: CONFIG.TEST_COORDINATES.longitude,
      color: CONFIG.TEST_COLOR,
      patternId: null
    };

    diagnostic.addStep('测试数据准备', {
      gridId: testGridId,
      coordinates: CONFIG.TEST_COORDINATES,
      drawData: pixelDrawData
    });

    // === 第9步：检查像素是否已存在 ===
    console.log('\n=== 第9步：检查像素是否已存在 ===');

    const existingPixel = await DatabaseValidator.findPixelByGridId(testGridId);
    if (existingPixel.success && existingPixel.pixel) {
      diagnostic.addWarning('测试位置已存在像素', existingPixel.pixel);
    } else {
      diagnostic.addStep('测试位置像素检查', '无现有像素');
    }

    // === 第10步：执行像素绘制 ===
    console.log('\n=== 第10步：执行像素绘制 ===');

    const drawStartTime = Date.now();
    const drawResult = await apiTester.drawPixelManual(pixelDrawData, authToken);
    const drawEndTime = Date.now();

    if (drawResult.success) {
      diagnostic.addStep('像素绘制API调用', {
        apiResponseTime: `${drawEndTime - drawStartTime}ms`,
        responseData: drawResult.data.data,
        status: drawResult.status
      });
    } else {
      diagnostic.addError(new Error(drawResult.error || '绘制API调用失败'), '像素绘制API调用');

      // 附加错误详情
      if (drawResult.data && typeof drawResult.data === 'object') {
        diagnostic.addStep('API错误详情', drawResult.data, 'error');
      }
    }

    // === 第11步：等待数据处理 ===
    console.log('\n=== 第11步：等待数据处理 ===');

    console.log('等待5秒，让后端完成数据处理...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    diagnostic.addStep('数据处理等待', '等待5秒完成');

    // === 第12步：验证数据库写入结果 ===
    console.log('\n=== 第12步：验证数据库写入结果 ===');

    // 检查pixels表
    const pixelCheck = await DatabaseValidator.findPixelByGridId(testGridId);
    if (pixelCheck.success) {
      if (pixelCheck.pixel) {
        diagnostic.addStep('pixels表写入验证', {
          success: true,
          pixel: pixelCheck.pixel
        });

        // 检查像素数据是否正确
        const pixelData = pixelCheck.pixel;
        const expectedData = {
          grid_id: testGridId,
          user_id: testUser.id,
          color: CONFIG.TEST_COLOR,
          latitude: CONFIG.TEST_COORDINATES.latitude,
          longitude: CONFIG.TEST_COORDINATES.longitude
        };

        const dataMatches = Object.keys(expectedData).every(key => {
          if (key === 'latitude' || key === 'longitude') {
            // 坐标可能有精度差异
            return Math.abs(pixelData[key] - expectedData[key]) < 0.0001;
          }
          return pixelData[key] === expectedData[key];
        });

        if (dataMatches) {
          diagnostic.addStep('像素数据验证', '数据匹配预期');
        } else {
          diagnostic.addWarning('像素数据不匹配', {
            expected: expectedData,
            actual: pixelData
          });
        }
      } else {
        diagnostic.addError(new Error('像素未写入pixels表'), 'pixels表写入验证');
      }
    } else {
      diagnostic.addError(new Error(pixelCheck.error), 'pixels表查询失败');
    }

    // 检查pixels_history表
    const historyCheck = await DatabaseValidator.findPixelHistoryByGridId(testGridId);
    if (historyCheck.success) {
      if (historyCheck.history) {
        diagnostic.addStep('pixels_history表写入验证', {
          success: true,
          history: historyCheck.history
        });
      } else {
        diagnostic.addWarning('历史记录未写入pixels_history表', historyCheck);
      }
    } else {
      diagnostic.addWarning('历史记录表查询失败', historyCheck);
    }

    // === 第13步：获取最新像素记录 ===
    console.log('\n=== 第13步：获取最新像素记录 ===');

    const latestPixels = await DatabaseValidator.getLatestPixels(5);
    if (latestPixels.success) {
      diagnostic.addStep('最新像素记录检查', {
        count: latestPixels.pixels.length,
        pixels: latestPixels.pixels
      });

      // 检查我们的测试像素是否在最新记录中
      const testPixelInLatest = latestPixels.pixels.find(p => p.grid_id === testGridId);
      if (testPixelInLatest) {
        diagnostic.addStep('测试像素在最新记录中找到', testPixelInLatest);
      } else {
        diagnostic.addWarning('测试像素未在最新记录中找到');
      }
    } else {
      diagnostic.addWarning('获取最新像素记录失败', latestPixels);
    }

  } catch (error) {
    diagnostic.addError(error, '主测试流程');
  }

  // === 生成诊断报告 ===
  console.log('\n=== 诊断报告 ===');

  const report = diagnostic.generateReport();

  // 输出总结
  console.log('\n📊 测试总结:');
  console.log(`   总步骤数: ${report.summary.totalSteps}`);
  console.log(`   成功步骤: ${report.summary.successSteps}`);
  console.log(`   错误数量: ${report.summary.errorCount}`);
  console.log(`   警告数量: ${report.summary.warningCount}`);
  console.log(`   总耗时: ${report.summary.totalTime}`);

  if (report.errors.length > 0) {
    console.log('\n❌ 发现的问题:');
    report.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.message}`);
      if (error.context) {
        console.log(`      上下文: ${JSON.stringify(error.context, null, 2)}`);
      }
    });
  }

  if (report.warnings.length > 0) {
    console.log('\n⚠️  警告信息:');
    report.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning.message}`);
      if (warning.context) {
        console.log(`      上下文: ${JSON.stringify(warning.context, null, 2)}`);
      }
    });
  }

  // 保存详细报告到文件
  const reportPath = path.join(__dirname, 'pixel_draw_diagnostic_report.json');
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  } catch (error) {
    console.warn(`\n⚠️  无法保存报告文件: ${error.message}`);
  }

  // 问题定位建议
  console.log('\n🔧 问题定位建议:');

  if (report.errors.some(e => e.message.includes('数据库'))) {
    console.log('   - 检查数据库连接配置');
    console.log('   - 确认数据库表结构是否正确');
    console.log('   - 检查数据库权限设置');
  }

  if (report.errors.some(e => e.message.includes('API') || e.message.includes('请求'))) {
    console.log('   - 检查后端服务是否正常运行');
    console.log('   - 确认API路由配置是否正确');
    console.log('   - 检查网络连接和防火墙设置');
  }

  if (report.errors.some(e => e.message.includes('认证') || e.message.includes('登录'))) {
    console.log('   - 检查用户认证系统');
    console.log('   - 确认JWT配置是否正确');
    console.log('   - 检查用户状态和权限');
  }

  if (report.errors.some(e => e.message.includes('绘制') || e.message.includes('像素'))) {
    console.log('   - 检查用户像素点数是否充足');
    console.log('   - 确认绘制服务状态');
    console.log('   - 检查批处理服务是否正常');
  }

  if (report.errors.length === 0 && report.warnings.length === 0) {
    console.log('   ✅ 所有测试通过，像素绘制流程正常工作！');
  } else if (report.errors.length === 0) {
    console.log('   ⚠️  测试基本通过，但有一些需要注意的地方');
  } else {
    console.log('   ❌ 发现严重问题，需要进一步排查');
  }

  console.log('\n🔍 诊断测试完成！');

  return report;
}

// 执行诊断
if (require.main === module) {
  runPixelDrawDiagnostic()
    .then(report => {
      process.exit(report.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('诊断脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runPixelDrawDiagnostic, DatabaseValidator, APITester };