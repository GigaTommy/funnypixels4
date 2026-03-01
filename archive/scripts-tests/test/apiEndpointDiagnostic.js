#!/usr/bin/env node

/**
 * API端点诊断工具
 *
 * 直接测试各种API端点，无需用户认证
 * 专注于API可用性和响应性检查
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  TIMEOUT: 10000,
  TEST_COORDINATES: {
    latitude: 39.9042,
    longitude: 116.4074
  }
};

class APIEndpointDiagnostic {
  constructor() {
    this.startTime = Date.now();
    this.results = [];
  }

  log(message, status = 'info', data = null) {
    const result = {
      step: message,
      status,
      data,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime
    };

    this.results.push(result);
    const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'warning' ? '⚠️' : '🔍';
    console.log(`${icon} ${message} (${result.elapsed}ms)`);

    if (data && status !== 'error') {
      console.log('   数据:', JSON.stringify(data, null, 4));
    } else if (data && status === 'error') {
      console.log('   错误:', JSON.stringify(data, null, 2));
    }
  }

  async testHealthEndpoint() {
    this.log('测试健康检查端点');

    try {
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, {
        timeout: CONFIG.TIMEOUT
      });

      this.log('健康检查端点正常', 'success', {
        status: response.status,
        uptime: response.data.uptime,
        memory: response.data.memory
      });

      return true;
    } catch (error) {
      this.log('健康检查端点异常', 'error', {
        message: error.message,
        status: error.response?.status
      });
      return false;
    }
  }

  async testAuthEndpoints() {
    this.log('测试认证相关端点');

    const endpoints = [
      { method: 'GET', path: '/api/auth/guest', description: '游客端点' },
      { method: 'POST', path: '/api/auth/register', description: '注册端点' },
      { method: 'GET', path: '/api/auth/status', description: '认证状态端点' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await axios.get(`${CONFIG.BACKEND_URL}${endpoint.path}`, {
            timeout: CONFIG.TIMEOUT
          });
        } else {
          response = await axios.post(`${CONFIG.BACKEND_URL}${endpoint.path}`, {
            username: 'test',
            password: 'test'
          }, {
            timeout: CONFIG.TIMEOUT
          });
        }

        results[endpoint.description] = {
          status: response.status,
          success: response.data.success,
          message: response.data.error || 'OK'
        };

        this.log(`${endpoint.description}响应正常`, 'success', {
          status: response.status,
          success: response.data.success
        });

      } catch (error) {
        results[endpoint.description] = {
          status: error.response?.status || 'NO_RESPONSE',
          success: false,
          error: error.message
        };

        this.log(`${endpoint.description}响应异常`, 'error', {
          status: error.response?.status,
          message: error.message
        });
      }
    }

    return results;
  }

  async testPixelDrawEndpoints() {
    this.log('测试像素绘制端点');

    const endpoints = [
      {
        method: 'GET',
        path: '/api/pixel-draw/status',
        description: '绘制服务状态端点',
        requiresAuth: true
      },
      {
        method: 'GET',
        path: '/api/pixel-draw/validate',
        description: '用户状态验证端点',
        requiresAuth: true
      },
      {
        method: 'POST',
        path: '/api/pixel-draw/manual',
        description: '手动绘制端点',
        requiresAuth: true,
        data: {
          lat: CONFIG.TEST_COORDINATES.latitude,
          lng: CONFIG.TEST_COORDINATES.longitude,
          color: '#FF0000'
        }
      }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        let config = { timeout: CONFIG.TIMEOUT };

        // 添加模拟token（可能无效，但可以测试端点是否存在）
        if (endpoint.requiresAuth) {
          config.headers = {
            'Authorization': 'Bearer test_token_diagnostic'
          };
        }

        let response;
        if (endpoint.method === 'GET') {
          response = await axios.get(`${CONFIG.BACKEND_URL}${endpoint.path}`, config);
        } else {
          response = await axios.post(`${CONFIG.BACKEND_URL}${endpoint.path}`, endpoint.data, config);
        }

        results[endpoint.description] = {
          status: response.status,
          success: response.data.success,
          message: response.data.error || 'OK'
        };

        this.log(`${endpoint.description}端点存在`, 'success', {
          status: response.status,
          success: response.data.success
        });

      } catch (error) {
        const statusCode = error.response?.status;
        const isEndpointExists = statusCode && statusCode !== 404;

        results[endpoint.description] = {
          status: statusCode || 'NO_RESPONSE',
          success: false,
          error: error.message,
          endpointExists: isEndpointExists
        };

        if (isEndpointExists) {
          // 端点存在，但可能有权限或其他问题
          this.log(`${endpoint.description}端点存在但有错误`, 'warning', {
            status: statusCode,
            message: error.message
          });
        } else {
          // 端点不存在
          this.log(`${endpoint.description}端点不存在`, 'error', {
            status: statusCode,
            message: error.message
          });
        }
      }
    }

    return results;
  }

  async testPixelEndpoints() {
    this.log('测试像素查询端点');

    const endpoints = [
      { method: 'GET', path: '/api/pixels', description: '像素列表端点' },
      { method: 'GET', path: '/api/pixels/map', description: '地图像素端点' },
      { method: 'GET', path: '/api/pixels/stats', description: '像素统计端点' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${CONFIG.BACKEND_URL}${endpoint.path}`, {
          timeout: CONFIG.TIMEOUT
        });

        results[endpoint.description] = {
          status: response.status,
          success: response.data.success || true,
          dataCount: Array.isArray(response.data.data) ? response.data.data.length : 'N/A'
        };

        this.log(`${endpoint.description}响应正常`, 'success', {
          status: response.status,
          dataCount: results[endpoint.description].dataCount
        });

      } catch (error) {
        results[endpoint.description] = {
          status: error.response?.status || 'NO_RESPONSE',
          success: false,
          error: error.message
        };

        this.log(`${endpoint.description}响应异常`, 'error', {
          status: error.response?.status,
          message: error.message
        });
      }
    }

    return results;
  }

  async testDatabaseConnection() {
    this.log('测试数据库连接（通过API）');

    try {
      // 尝试访问一个需要数据库的端点
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/stats`, {
        timeout: CONFIG.TIMEOUT
      });

      this.log('数据库连接正常', 'success', {
        status: response.status,
        hasData: !!response.data.data
      });

      return true;
    } catch (error) {
      // 如果stats端点不存在，尝试其他方式
      try {
        const response = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/stats`, {
          timeout: CONFIG.TIMEOUT
        });

        this.log('数据库连接正常（通过像素统计）', 'success', {
          status: response.status
        });

        return true;
      } catch (error2) {
        this.log('无法验证数据库连接', 'error', {
          message: error2.message,
          status: error2.response?.status
        });

        return false;
      }
    }
  }

  async testErrorHandling() {
    this.log('测试错误处理机制');

    const testCases = [
      {
        method: 'GET',
        path: '/api/nonexistent',
        expectedStatus: 404,
        description: '404错误处理'
      },
      {
        method: 'POST',
        path: '/api/pixel-draw/manual',
        data: { invalid: 'data' },
        expectedStatus: 401, // 未授权
        description: '401错误处理'
      }
    ];

    const results = {};

    for (const testCase of testCases) {
      try {
        let response;
        if (testCase.method === 'GET') {
          response = await axios.get(`${CONFIG.BACKEND_URL}${testCase.path}`, {
            timeout: CONFIG.TIMEOUT
          });
        } else {
          response = await axios.post(`${CONFIG.BACKEND_URL}${testCase.path}`, testCase.data, {
            timeout: CONFIG.TIMEOUT
          });
        }

        results[testCase.description] = {
          expectedStatus: testCase.expectedStatus,
          actualStatus: response.status,
          correct: response.status === testCase.expectedStatus
        };

        if (response.status === testCase.expectedStatus) {
          this.log(`${testCase.description}正确`, 'success', {
            expected: testCase.expectedStatus,
            actual: response.status
          });
        } else {
          this.log(`${testCase.description}异常`, 'warning', {
            expected: testCase.expectedStatus,
            actual: response.status
          });
        }

      } catch (error) {
        const actualStatus = error.response?.status || 'NO_RESPONSE';
        results[testCase.description] = {
          expectedStatus: testCase.expectedStatus,
          actualStatus: actualStatus,
          correct: actualStatus === testCase.expectedStatus
        };

        if (actualStatus === testCase.expectedStatus) {
          this.log(`${testCase.description}正确`, 'success', {
            expected: testCase.expectedStatus,
            actual: actualStatus
          });
        } else {
          this.log(`${testCase.description}异常`, 'warning', {
            expected: testCase.expectedStatus,
            actual: actualStatus
          });
        }
      }
    }

    return results;
  }

  async runDiagnostic() {
    console.log('🔍 开始API端点诊断\n');

    const results = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      tests: {}
    };

    // 1. 健康检查
    const healthOk = await this.testHealthEndpoint();
    if (!healthOk) {
      this.log('后端服务不可用，终止诊断', 'error');
      return this.generateReport();
    }

    // 2. 测试认证端点
    results.tests.auth = await this.testAuthEndpoints();

    // 3. 测试数据库连接
    results.tests.database = await this.testDatabaseConnection();

    // 4. 测试像素绘制端点
    results.tests.pixelDraw = await this.testPixelDrawEndpoints();

    // 5. 测试像素查询端点
    results.tests.pixels = await this.testPixelEndpoints();

    // 6. 测试错误处理
    results.tests.errorHandling = await this.testErrorHandling();

    return this.generateReport(results);
  }

  generateReport(results = null) {
    const totalTime = Date.now() - this.startTime;
    const successCount = this.results.filter(r => r.status === 'success').length;
    const errorCount = this.results.filter(r => r.status === 'error').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;

    const report = {
      summary: {
        totalSteps: this.results.length,
        successCount,
        errorCount,
        warningCount,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      },
      detailedResults: results,
      steps: this.results
    };

    console.log('\n=== API端点诊断报告 ===');
    console.log(`📊 总步骤: ${report.summary.totalSteps}`);
    console.log(`✅ 成功: ${report.summary.successCount}`);
    console.log(`❌ 失败: ${report.summary.errorCount}`);
    console.log(`⚠️  警告: ${report.summary.warningCount}`);
    console.log(`⏱️  总耗时: ${report.summary.totalTime}`);

    // 分析关键发现
    console.log('\n🔍 关键发现:');

    if (results) {
      // 分析认证端点
      const authResults = results.tests.auth;
      const guestWorking = authResults?.['游客端点']?.success;
      if (guestWorking) {
        console.log('✅ 游客模式可用，可以进行无认证测试');
      } else {
        console.log('❌ 游客模式不可用');
      }

      // 分析绘制端点
      const drawResults = results.tests.pixelDraw;
      const drawEndpointsExist = Object.values(drawResults || {}).some(r => r.endpointExists);
      if (drawEndpointsExist) {
        console.log('✅ 像素绘制端点存在');
      } else {
        console.log('❌ 像素绘制端点不存在或无法访问');
      }

      // 分析像素查询端点
      const pixelResults = results.tests.pixels;
      const pixelWorking = Object.values(pixelResults || {}).some(r => r.success);
      if (pixelWorking) {
        console.log('✅ 像素查询端点工作正常');
      } else {
        console.log('❌ 像素查询端点存在问题');
      }
    }

    // 问题诊断建议
    console.log('\n🔧 问题诊断建议:');

    if (errorCount > 0) {
      console.log('发现的API问题:');
      this.results.filter(r => r.status === 'error').forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.step}`);
      });

      console.log('\n建议的排查步骤:');
      console.log('   1. 检查后端服务日志');
      console.log('   2. 验证路由配置');
      console.log('   3. 检查数据库连接');
      console.log('   4. 验证中间件配置');
    } else {
      console.log('✅ 所有API端点响应正常，服务运行状态良好');
    }

    // 保存报告
    const reportPath = path.join(__dirname, 'api_endpoint_diagnostic_report.json');
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️  无法保存报告文件:', error.message);
    }

    return report;
  }
}

// 执行诊断
if (require.main === module) {
  const diagnostic = new APIEndpointDiagnostic();

  diagnostic.runDiagnostic()
    .then(report => {
      process.exit(report.summary.errorCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('诊断脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = APIEndpointDiagnostic;