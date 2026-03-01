/**
 * 详细检查个人排行榜原始响应
 */

const LeaderboardController = require('./src/controllers/leaderboardController');

async function testPersonalLeaderboard() {
  try {
    const req = {
      query: { period: 'daily', limit: 5, offset: 0 },
      user: null
    };

    let responseData = null;
    const res = {
      json: (data) => {
        responseData = data;
      }
    };

    await LeaderboardController.getPersonalLeaderboard(req, res);

    console.log('=== 个人排行榜完整响应 ===');
    console.log(JSON.stringify(responseData, null, 2));

    if (responseData?.data?.data?.[0]) {
      const entry = responseData.data.data[0];
      console.log('\n=== 字段类型详细检查 ===');
      console.log('id:', entry.id, `type: ${typeof entry.id}, isString: ${typeof entry.id === 'string'}`);
      console.log('user_id:', entry.user_id, `type: ${typeof entry.user_id}`);
      console.log('pixel_count:', entry.pixel_count, `type: ${typeof entry.pixel_count}, isString: ${typeof entry.pixel_count === 'string'}`);
      console.log('total_pixels:', entry.total_pixels, `type: ${typeof entry.total_pixels}, isInteger: ${Number.isInteger(entry.total_pixels)}`);
      console.log('rank:', entry.rank, `type: ${typeof entry.rank}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testPersonalLeaderboard();
