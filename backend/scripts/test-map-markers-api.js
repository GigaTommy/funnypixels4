#!/usr/bin/env node
/**
 * 测试地图标记API
 * 验证区庄地铁站附近是否能获取到漂流瓶
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://192.168.0.3:3001/api';
const QUZHUANG_LAT = 23.1415;
const QUZHUANG_LNG = 113.2898;

async function testMapMarkersAPI() {
  console.log('🧪 测试地图标记API\n');

  try {
    // 1. 生成Token
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    const token = jwt.sign(
      {
        id: 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
        username: 'bcd',
        email: 'bcd@example.com',
        role: 'user',
        is_admin: false
      },
      secret,
      { expiresIn: '1h' }
    );

    console.log('🔑 Token生成成功\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. 测试地图标记API
    console.log('📍 测试位置: 区庄地铁站');
    console.log(`   纬度: ${QUZHUANG_LAT}`);
    console.log(`   经度: ${QUZHUANG_LNG}`);
    console.log(`   半径: 500米 (0.5km)\n`);

    const response = await axios.get(
      `${BASE_URL}/drift-bottles/map-markers`,
      {
        headers,
        params: {
          lat: QUZHUANG_LAT,
          lng: QUZHUANG_LNG,
          radius: 0.5  // 500米
        }
      }
    );

    console.log('✅ API调用成功\n');
    console.log('📊 响应数据:');
    console.log(JSON.stringify(response.data, null, 2));

    // 3. 分析结果
    if (response.data.success && response.data.data) {
      const bottles = response.data.data.bottles;
      console.log(`\n🍾 找到 ${bottles.length} 个漂流瓶:`);

      if (bottles.length > 0) {
        console.log('');
        bottles.forEach((bottle, index) => {
          console.log(`${index + 1}. 瓶子ID: ${bottle.bottle_id}`);
          console.log(`   位置: ${bottle.lat}, ${bottle.lng}`);
          console.log(`   距离: ${(bottle.distance * 1000).toFixed(0)} 米`);
          console.log('');
        });

        // 检查距离
        const inRange = bottles.filter(b => b.distance * 1000 <= 100);
        const nearBy = bottles.filter(b => b.distance * 1000 <= 500);

        console.log('📏 距离分布:');
        console.log(`   拾取范围内 (≤100米): ${inRange.length} 个`);
        console.log(`   附近 (≤500米): ${nearBy.length} 个`);
        console.log(`   总计: ${bottles.length} 个\n`);

      } else {
        console.log('   ⚠️ 没有找到漂流瓶');
        console.log('   可能原因:');
        console.log('   1. 所有瓶子都被拾取了');
        console.log('   2. 瓶子不在搜索范围内');
        console.log('   3. 瓶子已沉没\n');
      }
    }

    // 4. iOS APP调用示例
    console.log('📱 iOS APP调用示例:');
    console.log('```swift');
    console.log('let bottles = try await api.getMapBottles(');
    console.log(`    lat: ${QUZHUANG_LAT},`);
    console.log(`    lng: ${QUZHUANG_LNG},`);
    console.log('    radius: 500  // 米');
    console.log(')');
    console.log('// 返回: [MapBottleInfo]');
    console.log('```\n');

    console.log('✅ 测试完成');

  } catch (error) {
    console.log('❌ 测试失败\n');

    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('错误信息:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401 || error.response.status === 403) {
        console.log('\n💡 提示: Token认证失败，请检查JWT_SECRET配置');
      }
    } else {
      console.log('网络错误:', error.message);
      console.log('\n💡 提示: 请确认后端服务正在运行');
      console.log('   运行命令: ps aux | grep server.js');
    }
  }
}

// 执行测试
if (require.main === module) {
  testMapMarkersAPI()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 未处理的错误:', err);
      process.exit(1);
    });
}

module.exports = { testMapMarkersAPI };
