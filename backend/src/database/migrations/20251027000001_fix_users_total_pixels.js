/**
 * 修复用户总像素数统计
 * 1. 确保 users 表有 total_pixels 字段
 * 2. 从 pixels 表统计每个用户的像素总数并更新
 */

exports.up = async function(knex) {
  console.log('🔄 开始修复用户总像素数...');

  // 1. 检查 total_pixels 字段是否存在
  const hasColumn = await knex.schema.hasColumn('users', 'total_pixels');

  if (!hasColumn) {
    console.log('➕ 添加 total_pixels 字段到 users 表...');
    await knex.schema.alterTable('users', (table) => {
      table.integer('total_pixels').defaultTo(0).comment('用户绘制的总像素数');
      table.index('total_pixels'); // 添加索引，优化排行榜查询
    });
    console.log('✅ total_pixels 字段已添加');
  } else {
    console.log('✅ total_pixels 字段已存在');
  }

  // 2. 统计每个用户的像素总数并更新
  console.log('📊 开始统计所有用户的像素总数...');

  // 获取所有用户的像素统计
  const userPixelStats = await knex('pixels')
    .select('user_id')
    .count('* as pixel_count')
    .groupBy('user_id');

  console.log(`📈 找到 ${userPixelStats.length} 个用户需要更新`);

  // 批量更新用户的 total_pixels
  let updatedCount = 0;
  let batchSize = 100; // 每批处理100个用户

  for (let i = 0; i < userPixelStats.length; i += batchSize) {
    const batch = userPixelStats.slice(i, i + batchSize);

    // 使用 Promise.all 并发更新
    await Promise.all(
      batch.map(async (stat) => {
        const pixelCount = parseInt(stat.pixel_count) || 0;

        await knex('users')
          .where('id', stat.user_id)
          .update({
            total_pixels: pixelCount,
            updated_at: knex.fn.now()
          });

        updatedCount++;

        // 每100个用户输出一次进度
        if (updatedCount % 100 === 0) {
          console.log(`⏳ 已更新 ${updatedCount}/${userPixelStats.length} 个用户...`);
        }
      })
    );
  }

  console.log(`✅ 成功更新 ${updatedCount} 个用户的总像素数`);

  // 3. 将没有绘制像素的用户的 total_pixels 设置为 0
  const usersWithoutPixels = await knex.raw(`
    UPDATE users
    SET total_pixels = 0, updated_at = NOW()
    WHERE id NOT IN (SELECT DISTINCT user_id FROM pixels)
      AND (total_pixels IS NULL OR total_pixels != 0)
  `);

  console.log(`✅ 已将没有绘制像素的用户 total_pixels 设置为 0`);

  // 4. 输出统计信息
  const stats = await knex('users')
    .select(
      knex.raw('COUNT(*) as total_users'),
      knex.raw('SUM(total_pixels) as total_all_pixels'),
      knex.raw('AVG(total_pixels) as avg_pixels'),
      knex.raw('MAX(total_pixels) as max_pixels'),
      knex.raw('COUNT(CASE WHEN total_pixels > 0 THEN 1 END) as users_with_pixels')
    )
    .first();

  console.log('\n📊 用户像素统计信息:');
  console.log(`   - 总用户数: ${stats.total_users}`);
  console.log(`   - 有像素的用户数: ${stats.users_with_pixels}`);
  console.log(`   - 总像素数: ${stats.total_all_pixels || 0}`);
  console.log(`   - 平均像素数: ${Math.round(stats.avg_pixels || 0)}`);
  console.log(`   - 最大像素数: ${stats.max_pixels || 0}`);
  console.log('\n✅ 用户总像素数修复完成!\n');
};

exports.down = async function(knex) {
  console.log('⚠️  回滚: 将所有用户的 total_pixels 设置为 0');

  await knex('users').update({ total_pixels: 0 });

  console.log('✅ 回滚完成');

  // 注意: 不删除 total_pixels 字段，因为可能已经在使用
  // 如果需要完全回滚，可以手动运行：
  // ALTER TABLE users DROP COLUMN IF EXISTS total_pixels;
};
