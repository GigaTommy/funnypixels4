/**
 * 手动添加version字段到pixels表
 * 用于实现乐观锁机制
 */

const { db } = require('../src/config/database');

async function addVersionField() {
  console.log('🔒 开始添加乐观锁version字段...\n');

  try {
    // 1. 检查version列是否已存在
    const hasVersion = await db.schema.hasColumn('pixels', 'version');

    if (hasVersion) {
      console.log('⚠️  version列已存在，跳过创建');
    } else {
      console.log('📊 添加version列到pixels表...');
      await db.schema.table('pixels', (table) => {
        table.integer('version').defaultTo(1).notNullable();
      });
      console.log('✅ version列添加成功');
    }

    // 2. 初始化现有数据的version值
    console.log('\n📊 初始化现有数据的version值...');
    const updateCount = await db('pixels')
      .whereNull('version')
      .orWhere('version', 0)
      .update({ version: 1 });

    console.log(`✅ 更新了 ${updateCount} 条记录的version值`);

    // 3. 添加索引
    console.log('\n📊 添加version索引...');
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_grid_id_version
      ON pixels (grid_id, version)
    `);
    console.log('✅ version索引创建成功');

    // 4. 验证结果
    console.log('\n📊 验证version字段...');
    const samplePixels = await db('pixels')
      .select('id', 'grid_id', 'version')
      .limit(5);

    console.log('样本数据:');
    samplePixels.forEach(p => {
      console.log(`  - Pixel ${p.id}: grid_id=${p.grid_id}, version=${p.version}`);
    });

    console.log('\n✅ 乐观锁version字段添加完成！');
    console.log('\n📝 使用说明:');
    console.log('  - 每次更新像素时，version自动递增');
    console.log('  - 并发更新时，version不匹配的更新会被忽略');
    console.log('  - 防止后提交的更新覆盖先提交的更新\n');

  } catch (error) {
    console.error('\n❌ 添加version字段失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 运行脚本
addVersionField().then(() => {
  console.log('🎉 脚本执行完成！');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
