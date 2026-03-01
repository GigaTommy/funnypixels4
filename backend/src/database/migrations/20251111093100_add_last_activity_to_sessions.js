/**
 * 为drawing_sessions表添加last_activity字段
 * 用于跟踪会话的最后一次活动时间
 */
exports.up = async function(knex) {
  console.log('  📝 检查drawing_sessions表...');

  // 检查表是否存在
  const hasTable = await knex.schema.hasTable('drawing_sessions');
  if (!hasTable) {
    console.log('  ℹ️  drawing_sessions表不存在，跳过迁移');
    console.log('  💡 请先运行 20251110191500_create_drawing_sessions_table 迁移');
    return;
  }

  // 检查字段是否已存在
  const hasLastActivityColumn = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'drawing_sessions'
      AND column_name = 'last_activity'
    );
  `);

  if (!hasLastActivityColumn.rows[0].exists) {
    await knex.schema.table('drawing_sessions', (table) => {
      table.timestamp('last_activity').nullable();
    });
    console.log('  ✅ 成功添加 last_activity 列');
  } else {
    console.log('  ℹ️  last_activity 列已存在');
  }

  // 更新现有记录，设置last_activity初始值为updated_at
  try {
    await knex.raw(`
      UPDATE drawing_sessions
      SET last_activity = COALESCE(updated_at, start_time)
      WHERE last_activity IS NULL
    `);
    console.log('  ✅ 已更新现有记录的 last_activity 值');
  } catch (error) {
    console.log('  ⚠️ 更新记录时出现警告:', error.message);
  }

  // 创建索引（如果不存在）
  try {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_drawing_sessions_last_activity ON drawing_sessions(last_activity)');
    console.log('  ✅ last_activity 索引已就绪');
  } catch (error) {
    console.log('  ⚠️ 索引创建警告:', error.message);
  }

  console.log('✅ drawing_sessions表last_activity字段添加完成');
};

exports.down = async function(knex) {
  // 删除索引
  await knex.raw('DROP INDEX IF EXISTS idx_drawing_sessions_last_activity');

  // 删除last_activity字段
  const hasLastActivityColumn = await knex.schema.hasColumn('drawing_sessions', 'last_activity');
  if (hasLastActivityColumn) {
    await knex.schema.table('drawing_sessions', (table) => {
      table.dropColumn('last_activity');
    });
  }

  console.log('✅ drawing_sessions表last_activity字段回滚完成');
};