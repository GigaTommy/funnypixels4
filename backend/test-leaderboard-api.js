/**
 * 测试排行榜 API 数据格式
 */

const LeaderboardController = require('./src/controllers/leaderboardController');

async function testLeaderboardAPI() {
  try {
    console.log('=== 测试城市排行榜 API ===');

    // 模拟请求对象
    const req = {
      query: { period: 'daily', limit: 5, offset: 0 },
      user: null
    };

    // 模拟响应对象
    let responseData = null;
    const res = {
      json: (data) => {
        responseData = data;
      }
    };

    // 调用控制器方法
    await LeaderboardController.getCityLeaderboard(req, res);

    console.log('API 返回数据:');
    console.log(JSON.stringify(responseData, null, 2));

    // 检查数据结构
    if (responseData && responseData.data && responseData.data.data && responseData.data.data.length > 0) {
      const firstItem = responseData.data.data[0];
      console.log('\n第一条数据:');
      console.log(JSON.stringify(firstItem, null, 2));
      console.log('\n字段检查:');
      console.log('  - id:', firstItem.id ? '✅' : '❌ 缺失');
      console.log('  - total_pixels:', firstItem.total_pixels ? '✅' : '❌ 缺失');
      console.log('  - total_pixels type:', typeof firstItem.total_pixels);
    }

    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testLeaderboardAPI();
