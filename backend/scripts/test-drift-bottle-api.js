#!/usr/bin/env node
/**
 * 测试漂流瓶API是否可访问
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const jwt = require('jsonwebtoken');
const axios = require('axios');

const BASE_URL = 'http://192.168.0.3:3001/api';
const USER_ID = 'a79a1fbe-0f97-4303-b922-52b35e6948d5';
const USERNAME = 'bcd';

async function testAPIs() {
  console.log('🧪 测试漂流瓶API可访问性...\n');

  // 1. 生成Token
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
  const token = jwt.sign(
    { id: USER_ID, username: USERNAME },
    secret,
    { expiresIn: '7d' }
  );

  console.log('🔑 生成Token:');
  console.log(`   ${token.substring(0, 50)}...\n`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // 2. 测试配额API
    console.log('📊 测试配额API: GET /drift-bottles/quota');
    const quotaRes = await axios.get(`${BASE_URL}/drift-bottles/quota`, { headers });
    console.log('   ✅ 成功');
    console.log('   响应:', JSON.stringify(quotaRes.data, null, 2));

    // 3. 测试地图标记API (区庄地铁站附近)
    console.log('\n📍 测试地图标记API: GET /drift-bottles/map-markers');
    const markersRes = await axios.get(
      `${BASE_URL}/drift-bottles/map-markers?lat=23.1415&lng=113.2898&radius=1000`,
      { headers }
    );
    console.log('   ✅ 成功');
    console.log('   响应:', JSON.stringify(markersRes.data, null, 2));

    // 4. 测试遭遇API
    console.log('\n🔍 测试遭遇API: GET /drift-bottles/encounter');
    const encounterRes = await axios.get(
      `${BASE_URL}/drift-bottles/encounter?lat=23.1415&lng=113.2898`,
      { headers }
    );
    console.log('   ✅ 成功');
    console.log('   响应:', JSON.stringify(encounterRes.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.log('   ❌ 失败');
      console.log('   状态码:', error.response.status);
      console.log('   错误:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   ❌ 网络错误:', error.message);
    }
  }

  console.log('\n✅ 测试完成');
}

testAPIs().catch(console.error);
