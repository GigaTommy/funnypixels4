const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { db } = require('../src/config/database');

async function simulatePickup() {
  try {
    console.log('🎭 开始模拟拾取操作...\n');

    const userId = '8102e0fb-920e-417e-ae40-171c7c2dbc15'; // 用户 bbb

    // 1. 查找可拾取的漂流瓶（owner_id IS NULL，正在漂流中）
    console.log('📍 查找可拾取的漂流瓶...');
    const availableBottles = await db('drift_bottles')
      .whereNull('owner_id')
      .where('is_active', true)
      .limit(3)
      .select('*');

    console.log(`  找到 ${availableBottles.length} 个可拾取的漂流瓶\n`);

    if (availableBottles.length === 0) {
      console.log('❌ 没有可拾取的漂流瓶');
      await db.destroy();
      return;
    }

    // 选择第一个漂流瓶进行拾取
    const bottle = availableBottles[0];
    console.log('🍾 选择拾取的漂流瓶:');
    console.log(`  ID: ${bottle.id}`);
    console.log(`  bottle_id: ${bottle.bottle_id}`);
    console.log(`  title: ${bottle.title}`);
    console.log(`  original_owner: ${bottle.original_owner_id}`);
    console.log(`  当前位置: (${bottle.current_lat}, ${bottle.current_lng})`);

    // 2. 模拟拾取操作（更新owner_id）
    console.log('\n🎯 执行拾取操作...');

    await db('drift_bottles')
      .where('id', bottle.id)
      .update({
        owner_id: userId
      });

    console.log('✅ 拾取成功！');

    // 3. 添加拾取记录到历史表
    console.log('\n📜 记录拾取历史...');

    await db('drift_bottle_history').insert({
      bottle_id: bottle.bottle_id,
      user_id: userId,
      action: 'pickup',
      latitude: bottle.current_lat,
      longitude: bottle.current_lng,
      city: bottle.current_city,
      country: bottle.current_country,
      created_at: new Date()
    });

    console.log('✅ 历史记录已添加');

    // 4. 验证拾取结果
    console.log('\n🔍 验证拾取结果...');

    const updatedBottle = await db('drift_bottles')
      .where('id', bottle.id)
      .first();

    console.log('  更新后的漂流瓶:');
    console.log(`    owner_id: ${updatedBottle.owner_id}`);
    console.log(`    original_owner_id: ${updatedBottle.original_owner_id}`);
    console.log(`    是否为拾到的瓶子: ${updatedBottle.owner_id !== updatedBottle.original_owner_id ? '是' : '否'}`);

    // 5. 查询用户百宝箱（模拟API调用）
    console.log('\n📦 查询用户百宝箱...');

    const userBottles = await db('drift_bottles')
      .where('owner_id', userId)
      .select('*');

    const pickedBottles = userBottles.filter(b => b.owner_id !== b.original_owner_id);

    console.log(`  持有的漂流瓶总数: ${userBottles.length}`);
    console.log(`  拾到的漂流瓶（非自己创建）: ${pickedBottles.length}`);

    if (pickedBottles.length > 0) {
      console.log('\n  拾到的漂流瓶列表:');
      pickedBottles.forEach((b, i) => {
        console.log(`    ${i + 1}. ${b.title} (bottle_id: ${b.bottle_id})`);
      });
    }

    console.log('\n✅ 模拟拾取完成！');
    console.log('\n💡 提示：现在可以在前端百宝箱中看到这个漂流瓶了！');

    await db.destroy();

  } catch (error) {
    console.error('❌ 模拟失败:', error.message);
    await db.destroy();
    process.exit(1);
  }
}

simulatePickup();
