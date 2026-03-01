/**
 * 为pixels表添加session_id字段
 * 用于追踪像素状态与绘制会话的关联关系
 */
exports.up = async function(knex) {
  console.log('  📝 检查pixels表的session_id字段...');

  // 检查字段是否已存在
  const hasSessionIdColumn = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND column_name = 'session_id'
    );
  `);

  if (!hasSessionIdColumn.rows[0].exists) {
    // 添加字段（不包含外键约束）
    await knex.schema.table('pixels', (table) => {
      table.uuid('session_id').nullable();
    });
    console.log('  ✅ 成功添加 session_id 列');
  } else {
    console.log('  ℹ️  session_id 列已存在');
  }

  // 单独添加外键约束（使用DO块检查约束是否存在）
  try {
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'pixels_session_id_foreign'
          AND table_name = 'pixels'
        ) THEN
          ALTER TABLE pixels
          ADD CONSTRAINT pixels_session_id_foreign
          FOREIGN KEY (session_id) REFERENCES drawing_sessions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.log('  ⚠️ 外键约束添加失败（可能已存在或drawing_sessions表不存在）');
  }

  // 创建索引（如果不存在）
  try {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_session_id ON pixels(session_id)');
    console.log('  ✅ session_id 索引已就绪');
  } catch (error) {
    console.log('  ⚠️ 索引创建警告:', error.message);
  }

  console.log('✅ pixels表session_id字段添加完成');
};

exports.down = async function(knex) {
  // 删除索引
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_session_id');

  // 删除外键约束
  await knex.raw('ALTER TABLE pixels DROP CONSTRAINT IF EXISTS pixels_session_id_foreign');

  // 删除session_id字段
  const hasSessionIdColumn = await knex.schema.hasColumn('pixels', 'session_id');
  if (hasSessionIdColumn) {
    await knex.schema.table('pixels', (table) => {
      table.dropColumn('session_id');
    });
  }

  console.log('✅ pixels表session_id字段回滚完成');
};