/**
 * 测试高德地图Web服务API逆地理编码功能
 */

// 设置环境变量
process.env.VITE_AMAP_WEB_SERVICE_KEY = '490fb8631cb2d380b9ec90b459ffda60';

const amapWebService = require('../../backend/src/services/amapWebService');
const logger = require('../../backend/src/utils/logger');

async function testAmapWebService() {
  console.log('🧪 开始测试高德地图Web服务API...');

  try {
    // 测试坐标：北京市天安门
    const testCoordinates = [
      { lat: 39.908823, lng: 116.397470, name: '北京市天安门' },
      { lat: 31.230416, lng: 121.473701, name: '上海市外滩' },
      { lat: 23.125178, lng: 113.280637, name: '广州市天河体育中心' },
      { lat: 22.543097, lng: 114.057868, name: '深圳市市民中心' },
      { lat: 30.274084, lng: 120.155107, name: '杭州市西湖' },
      { lat: 34.341568, lng: 108.939174, name: '西安市钟楼' },
      { lat: 36.067108, lng: 120.382639, name: '青岛市五四广场' },
      { lat: 29.563011, lng: 106.551557, name: '重庆市解放碑' }
    ];

    console.log(`\n📍 测试 ${testCoordinates.length} 个坐标的逆地理编码...\n`);

    for (const coord of testCoordinates) {
      console.log(`\n🎯 测试坐标: ${coord.name} (${coord.lat}, ${coord.lng})`);

      try {
        const startTime = Date.now();
        const result = await amapWebService.reverseGeocode(coord.lat, coord.lng);
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
        console.error(`❌ 逆地理编码失败:`, error.message);
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 测试服务状态
    console.log('\n📊 获取服务状态...');
    const status = amapWebService.getServiceStatus();
    console.log('服务状态:', JSON.stringify(status, null, 2));

    // 测试批量逆地理编码
    console.log('\n🔄 测试批量逆地理编码...');
    const batchResults = await amapWebService.batchReverseGeocode([
      { latitude: 39.908823, longitude: 116.397470 },
      { latitude: 31.230416, longitude: 121.473701 },
      { latitude: 23.125178, longitude: 120.382639 }
    ]);

    console.log(`批量处理结果 (${batchResults.length}个):`);
    batchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.province} ${result.city}`);
    });

    console.log('\n✅ 高德地图Web服务API测试完成!');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testAmapWebService().catch(console.error);