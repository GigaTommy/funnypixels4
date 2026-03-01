const { db } = require('../src/config/database');

async function verifyData() {
  try {
    console.log('🔍 验证创建的数据...');

    // 检查QR宝藏
    const treasures = await db('qr_treasures').select('treasure_id', 'title', 'treasure_type', 'hide_lat', 'hide_lng', 'city').limit(5);
    console.log('\n✅ QR宝藏数据验证:');
    treasures.forEach((t, i) => {
      const type = t.treasure_type === 'mobile' ? '🚲' : '📦';
      const coords = t.hide_lat ? `${t.hide_lat}, ${t.hide_lng}` : 'N/A';
      console.log(`${i+1}. ${type} ${t.title} (${coords})`);
    });

    // 检查漂流瓶
    const bottles = await db('drift_bottles').select('bottle_id', 'title', 'current_lat', 'current_lng', 'current_city').limit(5);
    console.log('\n✅ 漂流瓶数据验证:');
    bottles.forEach((b, i) => {
      console.log(`${i+1}. 🍾 ${b.title} (${b.current_lat}, ${b.current_lng})`);
    });

    // 统计总数
    const treasureCount = await db('qr_treasures').count('* as count');
    const bottleCount = await db('drift_bottles').count('* as count');

    console.log('\n📊 数据统计:');
    console.log(`🎯 QR宝藏总数: ${treasureCount[0].count} 个`);
    console.log(`🍾 漂流瓶总数: ${bottleCount[0].count} 个`);

    console.log('\n🎉 数据验证完成！可以开始测试功能了！');
    await db.destroy();
  } catch (error) {
    console.error('❌ 验证失败:', error);
  }
}

verifyData();