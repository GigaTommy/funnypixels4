#!/usr/bin/env node
'use strict';

/**
 * 快速GPS绘制测试脚本
 * 用于快速验证GPS绘制功能是否正常
 */

const axios = require('axios');

// 快速测试配置
const QUICK_CONFIG = {
  BACKEND_API: 'http://localhost:3001/api/pixel-draw/gps',
  JWT: 'REPLACE_WITH_YOUR_JWT_TOKEN', // 请替换为实际token
  TEST_POINT: { lat: 39.90923, lng: 116.397428 }, // 北京天安门
  GRID_SIZE: 0.0001,
  TEST_USER: {
    username: 'bbb',
    password: 'bbbbbb'
  }
};

// 简化的网格对齐函数
function quickSnapToGrid(lat, lng) {
  const gridX = Math.floor((lng + 180) / QUICK_CONFIG.GRID_SIZE);
  const gridY = Math.floor((lat + 90) / QUICK_CONFIG.GRID_SIZE);
  const snappedLat = (gridY * QUICK_CONFIG.GRID_SIZE) - 90 + (QUICK_CONFIG.GRID_SIZE / 2);
  const snappedLng = (gridX * QUICK_CONFIG.GRID_SIZE) - 180 + (QUICK_CONFIG.GRID_SIZE / 2);
  const gridId = `grid_${gridX}_${gridY}`;
  return { lat: snappedLat, lng: snappedLng, gridId };
}

// 获取JWT token
async function getJWTToken() {
  try {
    console.log('🔐 正在获取JWT token...');
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: QUICK_CONFIG.TEST_USER.username,
      password: QUICK_CONFIG.TEST_USER.password
    });
    
    console.log('📋 登录响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.tokens && response.data.tokens.accessToken) {
      console.log('✅ 登录成功，获取到accessToken');
      return response.data.tokens.accessToken;
    } else if (response.data && response.data.token) {
      console.log('✅ 登录成功，获取到token');
      return response.data.token;
    } else if (response.data && response.data.accessToken) {
      console.log('✅ 登录成功，获取到accessToken');
      return response.data.accessToken;
    } else {
      console.log('❌ 登录响应中没有token或accessToken');
      return null;
    }
  } catch (error) {
    console.log('❌ 登录失败:', error.response?.data?.error || error.message);
    return null;
  }
}

// 快速测试函数
async function quickTest() {
  console.log('🚀 开始快速GPS绘制测试');
  console.log('='.repeat(40));
  
  // 获取JWT token
  let jwtToken = QUICK_CONFIG.JWT;
  if (jwtToken === 'REPLACE_WITH_YOUR_JWT_TOKEN') {
    jwtToken = await getJWTToken();
    if (!jwtToken) {
      console.error('❌ 无法获取JWT token！');
      process.exit(1);
    }
  }
  
  const { lat, lng } = QUICK_CONFIG.TEST_POINT;
  const { lat: snappedLat, lng: snappedLng, gridId } = quickSnapToGrid(lat, lng);
  
  console.log(`📍 测试坐标: (${lat}, ${lng})`);
  console.log(`🎯 网格对齐: (${snappedLat.toFixed(6)}, ${snappedLng.toFixed(6)})`);
  console.log(`🆔 网格ID: ${gridId}`);
  console.log('-'.repeat(40));
  
  // 发送绘制请求
  const payload = {
    lat: snappedLat,
    lng: snappedLng,
    patternId: 1,
    anchorX: 0,
    anchorY: 0,
    rotation: 0,
    mirror: false
  };
  
  try {
    console.log('📤 发送绘制请求...');
    const start = Date.now();
    
    const response = await axios.post(QUICK_CONFIG.BACKEND_API, payload, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const latency = Date.now() - start;
    
    if (response.data && response.data.success) {
      console.log('✅ 绘制成功！');
      console.log(`⏱️ 响应时间: ${latency}ms`);
      console.log(`🎨 像素ID: ${response.data.data?.pixel?.id || 'N/A'}`);
      console.log(`💎 剩余点数: ${response.data.data?.consumptionResult?.remainingPoints || 'N/A'}`);
      console.log('='.repeat(40));
      console.log('🎉 快速测试通过！GPS绘制功能正常');
    } else {
      console.log('❌ 绘制失败！');
      console.log('响应数据:', response.data);
    }
    
  } catch (error) {
    console.log('❌ 请求失败！');
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log(`错误信息: ${error.response.data?.message || error.response.data?.error || '未知错误'}`);
    } else {
      console.log(`错误: ${error.message}`);
    }
    
    console.log('='.repeat(40));
    console.log('🔧 排查建议:');
    console.log('1. 检查后端服务是否运行');
    console.log('2. 验证JWT token是否有效');
    console.log('3. 确认API地址是否正确');
    console.log('4. 检查网络连接');
  }
}

// 运行测试
if (require.main === module) {
  quickTest().catch(console.error);
}

module.exports = { quickTest, QUICK_CONFIG };
