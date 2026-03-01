/**
 * 创建绘制会话表和修改pixels_history表
 */
exports.up = async function(knex) {
  console.log('  📝 检查drawing_sessions表...');

  // 检查表是否已存在
  const tableExists = await knex.schema.hasTable('drawing_sessions');

  if (!tableExists) {
    // 创建绘制会话表（使用经纬度列代替PostGIS几何类型）
    await knex.schema.createTable('drawing_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable();
      table.string('session_name', 100).defaultTo('绘制任务');
      table.string('drawing_type', 20).notNullable(); // 'gps' | 'manual'
      table.timestamp('start_time').notNullable().defaultTo(knex.fn.now());
      table.timestamp('end_time');
      table.string('status', 20).notNullable().defaultTo('active'); // 'active', 'completed', 'paused', 'expired'

      // 使用经纬度列代替PostGIS几何类型
      table.decimal('start_lat', 10, 8).nullable();
      table.decimal('start_lng', 11, 8).nullable();
      table.decimal('end_lat', 10, 8).nullable();
      table.decimal('end_lng', 11, 8).nullable();

      table.text('start_city');
      table.text('start_country');
      table.integer('alliance_id').unsigned().nullable();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
    });

    // 单独添加外键约束（使用DO块检查约束是否存在）
    try {
      await knex.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'drawing_sessions_user_id_foreign'
            AND table_name = 'drawing_sessions'
          ) THEN
            ALTER TABLE drawing_sessions
            ADD CONSTRAINT drawing_sessions_user_id_foreign
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);

      await knex.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'drawing_sessions_alliance_id_foreign'
            AND table_name = 'drawing_sessions'
          ) THEN
            ALTER TABLE drawing_sessions
            ADD CONSTRAINT drawing_sessions_alliance_id_foreign
            FOREIGN KEY (alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch (error) {
      console.log('  ⚠️ 外键约束添加失败（可能已存在）:', error.message);
    }

    console.log('  ✅ 成功创建drawing_sessions表');
  } else {
    console.log('  ℹ️  drawing_sessions表已存在，跳过迁移');
  }

  // 为pixels_history表添加session_id字段（如果不存在）
  const hasSessionIdColumn = await knex.schema.hasColumn('pixels_history', 'session_id');
  if (!hasSessionIdColumn) {
    console.log('  📝 为pixels_history表添加session_id字段...');
    await knex.schema.table('pixels_history', (table) => {
      table.uuid('session_id').nullable();
    });

    // 单独添加外键约束
    try {
      await knex.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'pixels_history_session_id_foreign'
            AND table_name = 'pixels_history'
          ) THEN
            ALTER TABLE pixels_history
            ADD CONSTRAINT pixels_history_session_id_foreign
            FOREIGN KEY (session_id) REFERENCES drawing_sessions(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
      console.log('  ✅ 成功添加session_id字段');
    } catch (error) {
      console.log('  ⚠️ session_id外键约束添加失败:', error.message);
    }
  }

  // 创建索引（如果不存在）
  try {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_drawing_sessions_user_status ON drawing_sessions(user_id, status)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_drawing_sessions_user_time ON drawing_sessions(user_id, created_at DESC)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_session ON pixels_history(session_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_session_time ON pixels_history(session_id, created_at)');
  } catch (error) {
    console.warn('  ⚠️ 创建索引时出现警告:', error.message);
  }
};

exports.down = async function(knex) {
  // 删除索引
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_history_session_time');
  await knex.raw('DROP INDEX IF EXISTS idx_pixels_history_session');
  await knex.raw('DROP INDEX IF EXISTS idx_drawing_sessions_user_time');
  await knex.raw('DROP INDEX IF EXISTS idx_drawing_sessions_user_status');

  // 删除pixels_history表中的session_id字段
  await knex.schema.table('pixels_history', (table) => {
    table.dropColumn('session_id');
    table.dropColumn('created_at');
  });

  // 删除绘制会话表
  await knex.schema.dropTableIfExists('drawing_sessions');
};