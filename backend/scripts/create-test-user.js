#!/usr/bin/env node
'use strict';

/**
 * 创建测试用户的简单脚本
 */

const axios = require('axios');

const CONFIG = {
  BACKEND_API: 'http://localhost:3001',
  TEST_USER: {
    username: 'bbb',
    email: 'bbb@example.com',
    password: 'bbbbbb'
  }
};

async function createTestUser() {
  try {
    console.log('🔧 创建测试用户...');
    
    // 先尝试注册
    const registerResponse = await axios.post(`${CONFIG.BACKEND_API}/api/auth/register`, {
      username: CONFIG.TEST_USER.username,
      email: CONFIG.TEST_USER.email,
      password: CONFIG.TEST_USER.password
    });
    
    console.log('✅ 用户注册成功:', registerResponse.data);
    return true;
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('ℹ️ 用户可能已存在，尝试登录...');
      return true;
    } else {
      console.log('❌ 注册失败:', error.response?.data?.error || error.message);
      return false;
    }
  }
}

async function loginAndGetToken() {
  try {
    console.log('🔐 尝试登录...');
    
    const response = await axios.post(`${CONFIG.BACKEND_API}/api/auth/login`, {
      username: CONFIG.TEST_USER.username,
      email: CONFIG.TEST_USER.email,
      password: CONFIG.TEST_USER.password
    });
    
    if (response.data && response.data.tokens && response.data.tokens.accessToken) {
      console.log('✅ 登录成功！');
      console.log('🎫 JWT Token:', response.data.tokens.accessToken);
      console.log('');
      console.log('📋 请复制上面的token到测试脚本中：');
      console.log('   在 simulate-gps-draw.js 或 quick-gps-test.js 中');
      console.log('   将 CONFIG.JWT 设置为上面的token值');
      return response.data.tokens.accessToken;
    } else {
      console.log('❌ 登录响应中没有token');
      return null;
    }
  } catch (error) {
    console.log('❌ 登录失败:', error.response?.data?.error || error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应数据:', error.response.data);
    }
    return null;
  }
}

async function main() {
  console.log('🚀 创建测试用户并获取Token');
  console.log('='.repeat(40));
  
  // 创建用户
  const userCreated = await createTestUser();
  if (!userCreated) {
    console.log('⚠️ 用户创建失败，但继续尝试登录...');
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
