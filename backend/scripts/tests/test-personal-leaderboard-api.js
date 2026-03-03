/**
 * 测试个人排行榜 API 数据格式
 */

const LeaderboardController = require('./src/controllers/leaderboardController');

async function testPersonalLeaderboardAPI() {
  try {
    console.log('=== 测试个人排行榜 API ===');

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
    await LeaderboardController.getPersonalLeaderboard(req, res);

    console.log('API 返回数据:');
    console.log(JSON.stringify(responseData, null, 2));

    // 检查数据结构 - API 返回 { success: true, data: { data: [...] } }
    const leaderboardData = responseData?.data?.data;
    if (leaderboardData && leaderboardData.length > 0) {
      const firstItem = leaderboardData[0];
      console.log('\n第一条数据:');
      console.log(JSON.stringify(firstItem, null, 2));
      console.log('\n字段检查:');
      console.log('  - user_id:', firstItem.user_id ? '✅' : '❌ 缺失');
      console.log('  - total_pixels:', firstItem.total_pixels ? '✅' : '❌ 缺失');
      console.log('  - total_pixels value:', firstItem.total_pixels);
      console.log('  - total_pixels type:', typeof firstItem.total_pixels);
      console.log('  - total_pixels is integer:', Number.isInteger(firstItem.total_pixels) ? '✅' : '❌ 不是整数');
    } else {
      console.log('\n⚠️ 没有返回排行榜数据');
    }

    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testPersonalLeaderboardAPI();
