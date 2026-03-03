/**
 * Google Geocoding API 测试脚本
 *
 * 用途：
 * 1. 验证Google API Key是否正确配置
 * 2. 测试海外坐标逆地理编码
 * 3. 检查自动路由切换机制
 */

const googleGeocodingService = require('../src/services/googleGeocodingService');
const amapWebService = require('../src/services/amapWebService');
const logger = require('../src/utils/logger');

// 测试用例
const testCases = [
  {
    name: '🗽 纽约时代广场',
    lat: 40.758896,
    lng: -73.985130,
    expected: { country: 'United States', city: 'New York' }
  },
  {
    name: '🏰 伦敦大本钟',
    lat: 51.5007,
    lng: -0.1246,
    expected: { country: 'United Kingdom', city: 'London' }
  },
  {
    name: '🗼 东京塔',
    lat: 35.6586,
    lng: 139.7454,
    expected: { country: 'Japan', city: 'Tokyo' }
  },
  {
    name: '🕌 迪拜帆船酒店',
    lat: 25.1412,
    lng: 55.1853,
    expected: { country: 'United Arab Emirates', city: 'Dubai' }
  },
  {
    name: '🏛️ 悉尼歌剧院',
    lat: -33.8568,
    lng: 151.2153,
    expected: { country: 'Australia', city: 'Sydney' }
  }
];

async function testGoogleGeocoding() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌍 Google Geocoding API 配置测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. 检查服务状态
  const status = googleGeocodingService.getServiceStatus();
  console.log('📊 服务状态:');
  console.log(`  可用性: ${status.available ? '✅ 可用' : '❌ 不可用'}`);
  console.log(`  API Key: ${status.apiKey === 'configured' ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  缓存大小: ${status.cache.size}/${status.cache.maxSize}`);
  console.log(`  缓存TTL: ${status.cache.ttl / 1000 / 60}分钟\n`);

  if (!status.available) {
    console.log('❌ Google API未配置，请设置环境变量 GOOGLE_MAPS_API_KEY');
    console.log('📖 查看配置指南: docs/backend/geo/GOOGLE_GEOCODING_SETUP.md\n');
    process.exit(1);
  }

  // 2. 测试海外坐标
  console.log('🧪 开始测试海外坐标逆地理编码...\n');

  let successCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    try {
      // 检查是否在中国
      const inChina = amapWebService.isInChina(testCase.lat, testCase.lng);
      console.log(`${testCase.name}`);
      console.log(`  坐标: (${testCase.lat}, ${testCase.lng})`);
      console.log(`  区域判断: ${inChina ? '🇨🇳 中国境内' : '🌍 海外'}`);

      // 调用Google API
      const startTime = Date.now();
      const result = await googleGeocodingService.reverseGeocode(testCase.lat, testCase.lng);
      const duration = Date.now() - startTime;

      if (result.geocoded) {
        const match = result.country.includes(testCase.expected.country) ||
                     testCase.expected.country.includes(result.country);

        if (match) {
          successCount++;
          console.log(`  ✅ 成功 (${duration}ms)`);
        } else {
          failCount++;
          console.log(`  ⚠️ 成功但结果不匹配 (${duration}ms)`);
          console.log(`     预期: ${testCase.expected.country}`);
          console.log(`     实际: ${result.country}`);
        }

        console.log(`  国家: ${result.country}`);
        console.log(`  省份: ${result.province || 'N/A'}`);
        console.log(`  城市: ${result.city || 'N/A'}`);
        console.log(`  地区: ${result.district || 'N/A'}`);
        console.log(`  完整地址: ${result.formatted_address}`);
      } else {
        failCount++;
        console.log(`  ❌ 失败 (${duration}ms)`);
        console.log(`  返回默认信息，可能是API配额或网络问题`);
      }

      console.log('');

      // 避免超过API QPS限制
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      failCount++;
      console.log(`  ❌ 异常: ${error.message}\n`);
    }
  }

  // 3. 测试总结
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 测试总结');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  总测试数: ${testCases.length}`);
  console.log(`  成功: ${successCount} ✅`);
  console.log(`  失败: ${failCount} ❌`);
  console.log(`  成功率: ${((successCount / testCases.length) * 100).toFixed(2)}%\n`);

  if (successCount === testCases.length) {
    console.log('🎉 所有测试通过！Google Geocoding API配置正常。\n');
    process.exit(0);
  } else if (successCount > 0) {
    console.log('⚠️ 部分测试失败，可能是网络或API配额问题。\n');
    process.exit(1);
  } else {
    console.log('❌ 所有测试失败，请检查：');
    console.log('  1. API Key是否正确');
    console.log('  2. Geocoding API是否已启用');
    console.log('  3. IP限制是否包含当前服务器IP');
    console.log('  4. 是否超出免费配额\n');
    process.exit(1);
  }
}

// 运行测试
testGoogleGeocoding().catch(error => {
  console.error('❌ 测试脚本异常:', error);
  process.exit(1);
});
