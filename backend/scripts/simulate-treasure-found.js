const bcrypt = require('bcrypt');
const { db } = require('../src/config/database');

async function simulateTreasureFound() {
  const userId = '8102e0fb-920e-417e-ae40-171c7c2dbc15'; // 用户 bbb 的ID

  try {
    console.log('🔍 查找可找到的宝藏...');

    // 查找可找到的宝藏（已经被用户bbb埋藏的，但还没有被任何人找到的）
    const availableTreasures = await db('qr_treasures')
      .where('hider_id', userId) // 用户bbb埋藏的
      .whereNull('finder_id') // 还没有被找到
      .where('status', 'active') // 使用status字段而不是is_active
      .limit(3)
      .select('*');

    if (availableTreasures.length === 0) {
      console.log('⚠️ 没有找到可发现的宝藏（用户bbb埋藏的）');

      // 尝试查找其他用户埋藏的宝藏
      const otherTreasures = await db('qr_treasures')
        .whereNull('finder_id')
        .where('status', 'active')
        .whereNot('hider_id', userId) // 不是用户bbb埋藏的
        .limit(3)
        .select('*');

      if (otherTreasures.length === 0) {
        console.log('⚠️ 系统中没有可发现的宝藏');
        return;
      }

      console.log(`📦 找到 ${otherTreasures.length} 个其他用户埋藏的可发现宝藏`);
      availableTreasures.push(...otherTreasures);
    } else {
      console.log(`📦 找到 ${availableTreasures.length} 个用户bbb埋藏的可发现宝藏`);
    }

    // 模拟找到第一个宝藏
    const treasure = availableTreasures[0];
    console.log(`💎 模拟找到宝藏: ${treasure.treasure_id}`);
    console.log(`  位置: (${treasure.hide_lat}, ${treasure.hide_lng})`);
    console.log(`  标题: ${treasure.title}`);
    console.log(`  奖励类型: ${treasure.reward_type}`);

    // 更新宝藏状态：设置为已找到
    const foundAt = new Date();
    await db('qr_treasures')
      .where('id', treasure.id)
      .update({
        finder_id: userId,
        found_at: foundAt
      });

    console.log('✅ 已更新宝藏状态为已找到');

    // 添加到宝藏操作日志
    await db('qr_treasure_logs').insert({
      treasure_id: treasure.treasure_id,
      user_id: userId,
      action: 'find',
      lat: treasure.hide_lat,
      lng: treasure.hide_lng,
      details: JSON.stringify({
        reward_type: treasure.reward_type,
        reward_value: treasure.reward_value,
        title: treasure.title
      }),
      created_at: foundAt
    });

    console.log('✅ 已添加寻宝日志');

    // 验证用户现在找到的宝藏
    console.log('\n🔍 验证用户bbb找到的宝藏...');
    const foundTreasures = await db('qr_treasures')
      .where('finder_id', userId)
      .orderBy('found_at', 'desc')
      .select('*');

    console.log(`💎 找到的宝藏总数: ${foundTreasures.length}`);

    foundTreasures.forEach((treasure, index) => {
      console.log(`  ${index + 1}. ${treasure.treasure_id}`);
      console.log(`     标题: ${treasure.title}`);
      console.log(`     位置: (${treasure.hide_lat}, ${treasure.hide_lng})`);
      console.log(`     奖励: ${treasure.reward_type}`);
      console.log(`     找到时间: ${treasure.found_at}`);
      console.log('');
    });

    // 验证用户的百宝箱数据
    console.log('🎒 验证百宝箱数据...');

    // 检查漂流瓶（拾到的）
    const userBottles = await db('drift_bottles')
      .where('owner_id', userId)
      .select('*');

    const pickedBottles = userBottles.filter(b => b.owner_id !== b.original_owner_id);

    console.log(`🍾 拾到的漂流瓶: ${pickedBottles.length}个`);
    console.log(`💎 找到的宝藏: ${foundTreasures.length}个`);
    console.log(`🎒 百宝箱物品总数: ${pickedBottles.length + foundTreasures.length}个`);

    console.log('\n✅ 寻宝模拟完成！');
    console.log('📱 用户bbb现在可以在百宝箱中看到:');

    if (pickedBottles.length > 0) {
      console.log(`  - ${pickedBottles.length}个拾到的漂流瓶`);
    }

    if (foundTreasures.length > 0) {
      console.log(`  - ${foundTreasures.length}个找到的宝藏`);
    }

  } catch (error) {
    console.error('❌ 模拟寻宝失败:', error);
  } finally {
    process.exit(0);
  }
}

simulateTreasureFound();