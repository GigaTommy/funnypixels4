const { db } = require('../src/config/database');

async function addBombItems() {
  try {
    console.log('💣 添加像素炸弹商品...');
    
    const bombItems = [
      {
        name: '像素炸弹',
        description: '一次性将8x8区域染成随机颜色，冷却时间15分钟',
        price_points: 150,
        item_type: 'bomb',
        category: 'special',
        metadata: {
          bomb_type: 'pixel_bomb',
          radius: 8,
          cooldown_minutes: 15,
          effect: 'random_color'
        }
      },
      {
        name: '图案炸弹',
        description: '一次性将6x6区域染成指定图案，冷却时间45分钟',
        price_points: 300,
        item_type: 'bomb',
        category: 'special',
        metadata: {
          bomb_type: 'pattern_bomb',
          radius: 6,
          cooldown_minutes: 45,
          effect: 'pattern_fill'
        }
      },
      {
        name: '清除炸弹',
        description: '一次性清除8x8区域的所有像素，冷却时间60分钟',
        price_points: 400,
        item_type: 'bomb',
        category: 'special',
        metadata: {
          bomb_type: 'clear_bomb',
          radius: 8,
          cooldown_minutes: 60,
          effect: 'clear_area'
        }
      },
      {
        name: '联盟炸弹',
        description: '一次性将10x10区域染成联盟颜色，冷却时间90分钟',
        price_points: 500,
        item_type: 'bomb',
        category: 'special',
        metadata: {
          bomb_type: 'alliance_bomb',
          radius: 10,
          cooldown_minutes: 90,
          effect: 'alliance_color'
        }
      }
    ];
    
    for (const item of bombItems) {
      await db('store_items').insert({
        ...item,
        price: item.price_points,
        currency_type: 'points',
        is_available: true,
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`✅ 添加炸弹: ${item.name} (${item.price_points} 积分)`);
    }
    
    console.log('\n🎉 所有炸弹商品添加完成！');
    
    // 显示所有炸弹商品
    const allBombs = await db('store_items')
      .where('item_type', 'bomb')
      .select('id', 'name', 'description', 'price_points', 'metadata');
    
    console.log('\n📋 当前炸弹商品列表:');
    allBombs.forEach(bomb => {
      console.log(`  ${bomb.id}. ${bomb.name}: ${bomb.description}`);
      console.log(`     价格: ${bomb.price_points} 积分`);
      console.log(`     效果: ${bomb.metadata?.effect || '未知'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 添加炸弹商品失败:', error);
  } finally {
    process.exit(0);
  }
}

addBombItems();
