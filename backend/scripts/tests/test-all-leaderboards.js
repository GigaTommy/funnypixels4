/**
 * 测试所有排行榜 API 数据格式（iOS 兼容性验证）
 */

const LeaderboardController = require('./src/controllers/leaderboardController');

// 模拟请求和响应对象
function createMockReqRes() {
  let responseData = null;
  const req = {
    query: { period: 'daily', limit: 10, offset: 0 },
    user: null
  };
  const res = {
    json: (data) => {
      responseData = data;
    }
  };
  return { req, res, getResponse: () => responseData };
}

// 验证字段函数
function validateFields(data, expectedFields, source) {
  console.log(`\n=== ${source} ===`);
  const entry = data?.data?.data?.[0];
  if (!entry) {
    console.log(`⚠️  没有数据`);
    return;
  }

  console.log(`📊 数据条目数量: ${data?.data?.data?.length || 0}`);
  console.log(`📋 第一条数据字段检查:`);

  expectedFields.forEach(field => {
    const value = entry[field];
    const type = typeof value;
    const exists = value !== undefined && value !== null;
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${field}: ${exists ? `"${value}" (${type})` : '缺失'}`);
  });
}

async function testAllLeaderboards() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           排行榜 API iOS 兼容性测试                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // 1. 个人排行榜
    const { req: req1, res: res1, getResponse: getResponse1 } = createMockReqRes();
    await LeaderboardController.getPersonalLeaderboard(req1, res1);
    validateFields(getResponse1(),
      ['id', 'user_id', 'username', 'total_pixels', 'pixel_count', 'rank'],
      '个人排行榜 (Personal Leaderboard)'
    );

    // 2. 联盟排行榜
    const { req: req2, res: res2, getResponse: getResponse2 } = createMockReqRes();
    await LeaderboardController.getAllianceLeaderboard(req2, res2);
    validateFields(getResponse2(),
      ['id', 'name', 'pixel_count', 'total_pixels', 'rank', 'member_count'],
      '联盟排行榜 (Alliance Leaderboard)'
    );

    // 3. 城市排行榜
    const { req: req3, res: res3, getResponse: getResponse3 } = createMockReqRes();
    await LeaderboardController.getCityLeaderboard(req3, res3);
    validateFields(getResponse3(),
      ['id', 'city_name', 'region_name', 'user_count', 'total_pixels', 'pixel_count', 'rank'],
      '城市排行榜 (City Leaderboard)'
    );

    // 输出完整的JSON响应供参考
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           完整响应示例 (用于iOS端调试参考)                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const cityResponse = getResponse3();
    if (cityResponse?.data?.data?.[0]) {
      console.log('\n城市排行榜响应结构:');
      console.log(JSON.stringify(cityResponse, null, 2));
    }

    console.log('\n✅ 所有测试完成');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testAllLeaderboards();
