const { db } = require('../src/config/database');

async function updateStorePrices() {
  try {
    console.log('开始更新商店商品价格...');
    
    const updates = [
      { id: 43, price_points: 50, name: '快速恢复剂' },
      { id: 44, price_points: 100, name: '超级恢复剂' },
      { id: 45, price_points: 200, name: '颜色炸弹' },
      { id: 46, price_points: 300, name: '金色头像框' },
      { id: 47, price_points: 250, name: '彩虹聊天气泡' },
      { id: 48, price_points: 500, name: '像素大师徽章' }
    ];

    for (const item of updates) {
      await db('store_items')
        .where('id', item.id)
        .update({ price_points: item.price_points });
      
      console.log(`✅ 更新商品 "${item.name}" (ID: ${item.id}) 价格为 ${item.price_points} 积分`);
    }

    console.log('🎉 所有商品价格更新完成！');
    
    // 显示更新后的商品列表
    const items = await db('store_items')
      .whereIn('id', [43, 44, 45, 46, 47, 48])
      .select('id', 'name', 'price_points');
    
    console.log('\n📋 更新后的商品列表:');
    items.forEach(item => {
      console.log(`  ${item.id}. ${item.name}: ${item.price_points} 积分`);
    });

  } catch (error) {
    console.error('❌ 更新商品价格失败:', error);
  } finally {
    process.exit(0);
  }
}

updateStorePrices();
