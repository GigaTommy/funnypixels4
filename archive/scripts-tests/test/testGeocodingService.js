/**
 * 测试地理编码服务集成高德地图Web服务API
 */

// 设置环境变量
process.env.VITE_AMAP_WEB_SERVICE_KEY = '490fb8631cb2d380b9ec90b459ffda60';

const geocodingService = require('../../backend/src/services/geocodingService');
const logger = require('../../backend/src/utils/logger');

async function testGeocodingService() {
  console.log('🧪 开始测试地理编码服务（集成高德地图Web服务API）...');

  try {
    // 测试坐标
    const testCoordinates = [
      { lat: 39.908823, lng: 116.397470, name: '北京市天安门' },
      { lat: 31.230416, lng: 121.473701, name: '上海市外滩' },
      { lat: 23.125178, lng: 113.280637, name: '广州市天河体育中心' }
    ];

    console.log(`\n📍 测试 ${testCoordinates.length} 个坐标的地理编码...\n`);

    for (const coord of testCoordinates) {
      console.log(`\n🎯 测试坐标: ${coord.name} (${coord.lat}, ${coord.lng})`);

      try {
        const startTime = Date.now();
        const result = await geocodingService.reverseGeocode(coord.lat, coord.lng);
        const endTime = Date.now();

        console.log(`⏱️  响应时间: ${endTime - startTime}ms`);
        console.log(`🌍 地理编码结果:`);
        console.log(`   国家: ${result.country}`);
        console.log(`   省份: ${result.province || '未知'}`);
        console.log(`   城市: ${result.city || '未知'}`);
        console.log(`   区县: ${result.district || '未知'}`);
        console.log(`   行政区划代码: ${result.adcode || '未知'}`);
        console.log(`   详细地址: ${result.formatted_address || '未知'}`);
        console.log(`   编码状态: ${result.geocoded ? '✅ 成功' : '❌ 失败'}`);

      } catch (error) {
        console.error(`❌ 地理编码失败:`, error.message);
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 测试服务状态
    console.log('\n📊 获取地理编码服务状态...');
    const status = geocodingService.getServiceStatus();
    console.log('地理编码服务状态:');
    console.log('- 缓存:', status.cache);
    console.log('- 并发控制:', status.concurrency);
    console.log('- 超时设置:', status.timeout + 'ms');
    console.log('- 服务优先级:');
    Object.entries(status.services).forEach(([name, service]) => {
      console.log(`  ${service.priority}. ${name}: ${service.enabled ? '✅ 启用' : '❌ 禁用'}`);
      if (service.status) {
        console.log(`     状态: ${service.status.available ? '可用' : '不可用'}`);
      }
    });

    console.log('\n✅ 地理编码服务测试完成!');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testGeocodingService().catch(console.error);