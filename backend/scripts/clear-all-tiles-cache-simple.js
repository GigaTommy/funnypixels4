/**
 * 简单的瓦片缓存清除脚本
 * 通过加载应用配置来获取Redis连接
 */

require('dotenv').config();
const { redis } = require('../src/config/redis');

async function clearAllTileCache() {
  console.log('🗑️  开始清除所有瓦片缓存...');
  console.log('');

  try {
    // 清除所有tile:data:*的键
    const dataKeys = await redis.keys('tile:data:*');
    console.log(`📊 找到 ${dataKeys.length} 个数据缓存键`);

    if (dataKeys.length > 0) {
      await redis.del(...dataKeys);
      console.log(`✅ 已清除 ${dataKeys.length} 个数据缓存`);
    }

    // 清除所有tile:meta:*的键
    const metaKeys = await redis.keys('tile:meta:*');
    console.log(`📊 找到 ${metaKeys.length} 个元数据缓存键`);

    if (metaKeys.length > 0) {
      await redis.del(...metaKeys);
      console.log(`✅ 已清除 ${metaKeys.length} 个元数据缓存`);
    }

    // 清除所有渲染锁
    const renderingKeys = await redis.keys('tile:rendering:*');
    console.log(`📊 找到 ${renderingKeys.length} 个渲染锁`);

    if (renderingKeys.length > 0) {
      await redis.del(...renderingKeys);
      console.log(`✅ 已清除 ${renderingKeys.length} 个渲染锁`);
    }

    console.log('');
    console.log('✅ 所有瓦片缓存已清除！');
    console.log('');
    console.log('💡 提示:');
    console.log('  1. 重启后端服务（如果正在运行）');
    console.log('  2. 刷新前端页面，瓦片将重新渲染');
    console.log('  3. 查看广州中山纪念堂附近的emoji是否随缩放变化');

  } catch (error) {
    console.error('❌ 清除缓存失败:', error);
    throw error;
  }

  process.exit(0);
}

clearAllTileCache().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
