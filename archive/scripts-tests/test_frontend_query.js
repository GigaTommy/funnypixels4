const axios = require('axios');

async function testFrontendQuery() {
  try {
    console.log('🔍 测试前端查询API...');
    
    // 模拟前端查询广州塔附近的像素
    const bounds = {
      north: 23.113,   // 广州塔北边
      south: 23.105,   // 广州塔南边  
      east: 113.323,   // 广州塔东边
      west: 113.315    // 广州塔西边
    };
    
    console.log('查询边界:', bounds);
    
    const response = await axios.post('http://localhost:3443/api/pixels/area', {
      bounds: bounds,
      zoom: 18
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API响应成功');
    console.log(`📊 返回数据: ${response.data.pixels.length} 个像素`);
    console.log(`📊 总数: ${response.data.total}`);
    console.log(`📊 是否限制: ${response.data.limited}`);
    
    if (response.data.pixels.length > 0) {
      console.log('\n前5个像素:');
      response.data.pixels.slice(0, 5).forEach((pixel, i) => {
        console.log(`${i+1}. ${pixel.grid_id} - lat:${pixel.latitude} lng:${pixel.longitude} color:${pixel.color}`);
      });
      
      // 统计pattern使用情况
      const patternStats = {};
      response.data.pixels.forEach(p => {
        patternStats[p.pattern_id] = (patternStats[p.pattern_id] || 0) + 1;
      });
      
      console.log('\nPattern使用统计:');
      Object.entries(patternStats).slice(0, 5).forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count}个像素`);
      });
    } else {
      console.log('❌ 没有找到像素数据');
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testFrontendQuery();
