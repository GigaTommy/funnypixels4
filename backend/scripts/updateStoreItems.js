const { db } = require('../src/config/database');

/**
 * 更新商店商品的metadata
 */
async function updateStoreItems() {
  try {
    console.log('🔄 更新商店商品metadata...\n');

    // 更新快速恢复剂
    console.log('1. 更新快速恢复剂...');
    await db('store_items')
      .where('name', '快速恢复剂')
      .update({
        metadata: JSON.stringify({
          boost_amount: 16,
          daily_limit: 3,
          description: '立即恢复16个绘制点数，每日限用3次'
        }),
        updated_at: new Date()
      });
    console.log('   ✅ 快速恢复剂metadata更新成功');

    // 更新超级恢复剂
    console.log('2. 更新超级恢复剂...');
    await db('store_items')
      .where('name', '超级恢复剂')
      .update({
        metadata: JSON.stringify({
          boost_amount: 32,
          daily_limit: 1,
          description: '立即恢复32个绘制点数，每日限用1次'
        }),
        updated_at: new Date()
      });
    console.log('   ✅ 超级恢复剂metadata更新成功');

    // 验证更新结果
    console.log('\n3. 验证更新结果...');
    const quickRestore = await db('store_items')
      .where('name', '快速恢复剂')
      .first();
    
    const superRestore = await db('store_items')
      .where('name', '超级恢复剂')
      .first();

    console.log('   快速恢复剂metadata:', quickRestore.metadata);
    console.log('   超级恢复剂metadata:', superRestore.metadata);

    console.log('\n🎉 商店商品metadata更新完成！');

  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateStoreItems();
}
