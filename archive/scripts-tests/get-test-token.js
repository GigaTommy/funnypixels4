#!/usr/bin/env node
'use strict';

/**
 * 获取测试JWT Token的脚本
 * 用于GPS模拟测试
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_API: 'http://localhost:3001',
  TEST_USER: {
    phone: '13800138000',
    password: '123456'
  }
};

async function createTestUser() {
  try {
    console.log('🔧 尝试创建测试用户...');
    
    const response = await axios.post(`${CONFIG.BACKEND_API}/api/auth/register`, {
      phone: CONFIG.TEST_USER.phone,
      password: CONFIG.TEST_USER.password,
      username: 'test_user_8000'
    });
    
    console.log('✅ 测试用户创建成功');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.log('ℹ️ 测试用户已存在');
      return true;
    } else {
      console.log('⚠️ 创建用户失败:', error.response?.data?.message || error.message);
      return false;
    }
  }
}

async function loginAndGetToken() {
  try {
    console.log('🔐 尝试登录获取token...');
    
    const response = await axios.post(`${CONFIG.BACKEND_API}/api/auth/login`, {
      phone: CONFIG.TEST_USER.phone,
      password: CONFIG.TEST_USER.password
    });
    
    if (response.data && response.data.token) {
      console.log('✅ 登录成功！');
      console.log('🎫 JWT Token:', response.data.token);
      console.log('');
      console.log('📋 请复制上面的token到测试脚本中：');
      console.log('   在 simulate-gps-draw.js 或 quick-gps-test.js 中');
      console.log('   将 CONFIG.JWT 设置为上面的token值');
      console.log('');
      return response.data.token;
    } else {
      console.log('❌ 登录响应中没有token');
      return null;
    }
  } catch (error) {
    console.log('❌ 登录失败:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testBackendConnection() {
  try {
    console.log('🔍 检查后端服务连接...');
    const response = await axios.get(`${CONFIG.BACKEND_API}/health`, { timeout: 5000 });
    console.log('✅ 后端服务运行正常');
    return true;
  } catch (error) {
    console.log('❌ 后端服务连接失败:', error.message);
    console.log('💡 请确保后端服务正在运行：');
    console.log('   cd backend && npm run dev');
    return false;
  }
}

async function main() {
  console.log('🚀 获取GPS测试JWT Token');
  console.log('='.repeat(40));
  
  // 检查后端连接
  const isBackendRunning = await testBackendConnection();
  if (!isBackendRunning) {
    process.exit(1);
  }
  
  // 创建测试用户
  const userCreated = await createTestUser();
  if (!userCreated) {
    console.log('⚠️ 继续尝试登录...');
  }
  
  // 登录获取token
  const token = await loginAndGetToken();
  if (token) {
    console.log('🎉 准备就绪！现在可以运行GPS测试了：');
    console.log('   node quick-gps-test.js');
    console.log('   node simulate-gps-draw.js');
  } else {
    console.log('❌ 无法获取token，请检查后端服务状态');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, CONFIG };
