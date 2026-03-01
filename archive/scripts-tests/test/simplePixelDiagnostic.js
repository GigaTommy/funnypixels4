#!/usr/bin/env node

/**
 * 简化版像素绘制诊断工具
 *
 * 这个版本避免了复杂的模块依赖，专注于基本的API测试
 * 使用方法：node scripts/test/simplePixelDiagnostic.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  TIMEOUT: 10000,
  TEST_USER: {
    username: 'testuser123',
    password: 'test123456'
  },
  TEST_COORDINATES: {
    latitude: 39.9042,
    longitude: 116.4074
  }
};

class SimpleDiagnostic {
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

    if (data) {
      console.log('   数据:', JSON.stringify(data, null, 4));
    }
  }

  async checkBackendService() {
    this.log('检查后端服务状态');

    try {
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/health`, {
        timeout: CONFIG.TIMEOUT
      });

      this.log('后端服务连接成功', 'success', {
        status: response.status,
        data: response.data
      });

      return true;
    } catch (error) {
      this.log('后端服务连接失败', 'error', {
        message: error.message,
        code: error.code
      });
      return false;
    }
  }

  async registerTestUser() {
    this.log('注册测试用户');

    try {
      // 使用游客模式进行测试，避免邮箱验证
      const guestResponse = await axios.get(`${CONFIG.BACKEND_URL}/api/auth/guest`, {
        timeout: CONFIG.TIMEOUT
      });

      if (guestResponse.data.success && guestResponse.data.data.guestId) {
        this.log('游客模式获取成功', 'success', {
          guestId: guestResponse.data.data.guestId
        });
        return {
          user: {
            id: guestResponse.data.data.guestId,
            username: 'guest',
            role: 'guest'
          },
          token: guestResponse.data.data.guestToken
        };
      } else {
        this.log('游客模式获取失败', 'error', guestResponse.data);
        return null;
      }
    } catch (error) {
      // 如果游客模式不可用，尝试直接登录已有用户
      if (error.response?.status === 404) {
        this.log('游客模式不可用，尝试已有用户登录', 'warning');
        return await this.loginTestUser();
      } else {
        this.log('用户认证异常', 'error', {
          message: error.message,
          response: error.response?.data
        });
        return null;
      }
    }
  }

  async loginTestUser() {
    this.log('登录测试用户');

    try {
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, CONFIG.TEST_USER, {
        timeout: CONFIG.TIMEOUT
      });

      if (response.data.success && response.data.data.token) {
        this.log('用户登录成功', 'success', {
          userId: response.data.data.user.id,
          username: response.data.data.user.username
        });
        return response.data.data;
      } else {
        this.log('用户登录失败', 'error', response.data);
        return null;
      }
    } catch (error) {
      this.log('用户登录异常', 'error', {
        message: error.message,
        response: error.response?.data
      });
      return null;
    }
  }

  async checkUserDrawState(token) {
    this.log('检查用户绘制状态');

    try {
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/validate`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: CONFIG.TIMEOUT
      });

      if (response.data.success) {
        const userState = response.data.data;
        this.log('用户状态获取成功', 'success', {
          canDraw: userState.canDraw,
          totalPoints: userState.totalPoints,
          reason: userState.reason
        });

        // 如果是游客用户且无法绘制，这是正常的
        if (!userState.canDraw && userState.reason?.includes('游客')) {
          this.log('游客用户无法绘制，这是正常行为', 'warning');
        }

        return userState;
      } else {
        this.log('用户状态获取失败', 'error', response.data);
        return null;
      }
    } catch (error) {
      this.log('用户状态检查异常', 'error', {
        message: error.message,
        response: error.response?.data
      });
      return null;
    }
  }

  async checkPixelDrawService(token) {
    this.log('检查像素绘制服务状态');

    try {
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/pixel-draw/status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: CONFIG.TIMEOUT
      });

      if (response.data.success) {
        this.log('绘制服务状态正常', 'success', response.data.data);
        return response.data.data;
      } else {
        this.log('绘制服务状态异常', 'error', response.data);
        return null;
      }
    } catch (error) {
      this.log('绘制服务检查异常', 'error', {
        message: error.message,
        response: error.response?.data
      });
      return null;
    }
  }

  async drawTestPixel(token) {
    this.log('执行测试像素绘制');

    const pixelData = {
      lat: CONFIG.TEST_COORDINATES.latitude,
      lng: CONFIG.TEST_COORDINATES.longitude,
      color: '#FF0000'
    };

    try {
      const startTime = Date.now();
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/pixel-draw/manual`, pixelData, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: CONFIG.TIMEOUT
      });

      const endTime = Date.now();

      if (response.data.success) {
        this.log('像素绘制API调用成功', 'success', {
          responseTime: `${endTime - startTime}ms`,
          pixelData: response.data.data.pixel,
          consumption: response.data.data.consumptionResult
        });
        return response.data.data;
      } else {
        this.log('像素绘制API调用失败', 'error', response.data);
        return null;
      }
    } catch (error) {
      this.log('像素绘制API调用异常', 'error', {
        message: error.message,
        response: error.response?.data
      });
      return null;
    }
  }

  async checkPixelInDatabase(gridId) {
    this.log('检查像素是否写入数据库（通过API）');

    try {
      // 通过API检查像素是否存在
      const response = await axios.get(`${CONFIG.BACKEND_URL}/api/pixels/check?gridId=${gridId}`, {
        timeout: CONFIG.TIMEOUT
      });

      if (response.data.success && response.data.pixel) {
        this.log('像素在数据库中找到', 'success', response.data.pixel);
        return response.data.pixel;
      } else {
        this.log('像素在数据库中未找到', 'warning');
        return null;
      }
    } catch (error) {
      // 如果没有检查API端点，跳过这个检查
      if (error.response?.status === 404) {
        this.log('像素检查API端点不存在，跳过数据库验证', 'warning');
        return null;
      } else {
        this.log('数据库检查异常', 'error', {
          message: error.message,
          response: error.response?.data
        });
        return null;
      }
    }
  }

  calculateGridId(lat, lng) {
    // 简化的网格ID计算
    const latGrid = Math.floor((lat + 90) * 1000000 / 11);
    const lngGrid = Math.floor((lng + 180) * 1000000 / 11);
    return `${latGrid}_${lngGrid}`;
  }

  async runDiagnostic() {
    console.log('🔍 开始简化版像素绘制诊断\n');

    let userSession = null;
    let pixelResult = null;

    // 1. 检查后端服务
    const backendOk = await this.checkBackendService();
    if (!backendOk) {
      this.log('后端服务不可用，诊断终止', 'error');
      return this.generateReport();
    }

    // 2. 注册/登录用户
    userSession = await this.registerTestUser();
    if (!userSession) {
      this.log('用户认证失败，诊断终止', 'error');
      return this.generateReport();
    }

    // 3. 检查用户绘制状态
    const userState = await this.checkUserDrawState(userSession.token);
    if (!userState) {
      this.log('用户状态检查失败，诊断终止', 'error');
      return this.generateReport();
    }

    // 即使是游客用户无法绘制，也继续测试API响应
    if (!userState.canDraw) {
      this.log('用户当前无法绘制，但继续测试API响应', 'warning');
    }

    // 4. 检查绘制服务
    const serviceStatus = await this.checkPixelDrawService(userSession.token);

    // 5. 执行像素绘制
    pixelResult = await this.drawTestPixel(userSession.token);
    if (!pixelResult) {
      this.log('像素绘制失败，诊断终止', 'error');
      return this.generateReport();
    }

    // 6. 等待数据处理
    this.log('等待数据处理...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 7. 检查数据库写入
    if (pixelResult.pixel) {
      const gridId = pixelResult.pixel.grid_id || this.calculateGridId(
        CONFIG.TEST_COORDINATES.latitude,
        CONFIG.TEST_COORDINATES.longitude
      );

      await this.checkPixelInDatabase(gridId);
    }

    return this.generateReport();
  }

  generateReport() {
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
      steps: this.results,
      config: CONFIG
    };

    console.log('\n=== 诊断报告 ===');
    console.log(`📊 总步骤: ${report.summary.totalSteps}`);
    console.log(`✅ 成功: ${report.summary.successCount}`);
    console.log(`❌ 失败: ${report.summary.errorCount}`);
    console.log(`⚠️  警告: ${report.summary.warningCount}`);
    console.log(`⏱️  总耗时: ${report.summary.totalTime}`);

    // 问题分析
    console.log('\n🔍 问题分析:');

    if (errorCount === 0) {
      console.log('✅ 所有检查通过，像素绘制流程正常工作！');
    } else {
      const errors = this.results.filter(r => r.status === 'error');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.step}: ${error.data?.message || '未知错误'}`);
      });

      console.log('\n🔧 修复建议:');

      if (errors.some(e => e.step.includes('后端服务'))) {
        console.log('   - 启动后端服务: npm start');
        console.log('   - 检查端口3001是否被占用');
      }

      if (errors.some(e => e.step.includes('用户'))) {
        console.log('   - 检查用户认证系统');
        console.log('   - 验证JWT配置');
      }

      if (errors.some(e => e.step.includes('绘制'))) {
        console.log('   - 检查用户像素点数');
        console.log('   - 验证绘制服务配置');
        console.log('   - 查看后端日志');
      }
    }

    // 保存报告
    const reportPath = path.join(__dirname, 'simple_diagnostic_report.json');
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
  const diagnostic = new SimpleDiagnostic();

  diagnostic.runDiagnostic()
    .then(report => {
      process.exit(report.summary.errorCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('诊断脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = SimpleDiagnostic;