/**
 * 添加乐观锁version字段到pixels表
 *
 * 背景：防止并发更新时数据丢失
 * 场景：两个用户同时绘制同一像素，后提交的会覆盖前者
 * 解决方案：使用version字段实现乐观锁
 */

exports.up = async function(knex) {
  console.log('🔒 开始添加乐观锁version字段...');

  try {
    // 1. 添加version字段（如果不存在）
    const hasVersionColumn = await knex.schema.hasColumn('pixels', 'version');

    if (!hasVersionColumn) {
      console.log('📊 添加version列到pixels表...');
      await knex.schema.table('pixels', (table) => {
        table.integer('version').defaultTo(1).notNullable();
      });
      console.log('✅ version列添加成功');
    } else {
      console.log('⚠️  version列已存在，跳过创建');
    }

    // 2. 为现有数据初始化version=1
    console.log('📊 初始化现有数据的version值...');
    const updateCount = await knex('pixels')
      .whereNull('version')
      .orWhere('version', 0)
      .update({ version: 1 });

    console.log(`✅ 更新了 ${updateCount} 条记录的version值`);

    // 3. 添加索引优化version查询（可选）
    console.log('📊 添加version索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_grid_id_version
      ON pixels (grid_id, version)
    `);
    console.log('✅ version索引创建成功');

    console.log('');
    console.log('✅ 乐观锁version字段添加完成！');
    console.log('📝 使用说明:');
    console.log('  - 每次更新像素时，version自动递增');
    console.log('  - 并发更新时，version不匹配的更新会被忽略');
    console.log('  - 防止后提交的更新覆盖先提交的更新');

  } catch (error) {
    console.error('❌ 添加version字段失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚version字段...');

  try {
    // 删除索引
    await knex.raw('DROP INDEX IF EXISTS idx_pixels_grid_id_version');
    console.log('✅ 删除索引: idx_pixels_grid_id_version');

    // 删除列
    const hasVersionColumn = await knex.schema.hasColumn('pixels', 'version');
    if (hasVersionColumn) {
      await knex.schema.table('pixels', (table) => {
        table.dropColumn('version');
      });
      console.log('✅ 删除version列');
    }

    console.log('✅ version字段回滚完成');

  } catch (error) {
    console.error('❌ 回滚version字段失败:', error);
    throw error;
  }
};
