/**
 * 修复表兼容性问题
 * 确保pixels表与pixels_history表结构兼容
 */

exports.up = async function(knex) {
  console.log('🔧 开始修复表兼容性问题...');
  
  try {
    // 1. 修改pixels表的id字段类型为bigint（需要先删除主键约束）
    console.log('  📝 修改pixels.id字段类型...');
    
    // 先删除主键约束
    await knex.raw('ALTER TABLE pixels DROP CONSTRAINT IF EXISTS pixels_pkey;');
    
    // 修改字段类型
    await knex.raw('ALTER TABLE pixels ALTER COLUMN id TYPE bigint;');
    
    // 重新添加主键约束
    await knex.raw('ALTER TABLE pixels ADD CONSTRAINT pixels_pkey PRIMARY KEY (id);');
    
    // 2. 修改pixels表的color字段为可空
    console.log('  📝 修改pixels.color字段为可空...');
    await knex.schema.alterTable('pixels', function(table) {
      table.string('color', 20).nullable().alter();
    });
    
    // 3. 修改pixels_history表的color字段为可空
    console.log('  📝 修改pixels_history.color字段为可空...');
    await knex.schema.alterTable('pixels_history', function(table) {
      table.string('color', 20).nullable().alter();
    });
    
    // 4. 修改pixels_history表的user_id字段为不可空
    console.log('  📝 修改pixels_history.user_id字段为不可空...');
    await knex.schema.alterTable('pixels_history', function(table) {
      table.uuid('user_id').notNullable().alter();
    });
    
    // 5. 为pixels表添加缺失的索引
    console.log('  📝 为pixels表添加索引...');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_grid_id ON pixels (grid_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels (user_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_pixel_type ON pixels (pixel_type);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_pixel_type_related_id ON pixels (pixel_type, related_id);');
    
    // 6. 为pixels_history表添加缺失的索引
    console.log('  📝 为pixels_history表添加索引...');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_grid_id ON pixels_history (grid_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_user_id ON pixels_history (user_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_pixel_type ON pixels_history (pixel_type);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_pixels_history_pixel_type_related_id ON pixels_history (pixel_type, related_id);');
    
    // 7. 为pixels表添加pixel_type约束
    console.log('  📝 为pixels表添加pixel_type约束...');
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'chk_pixels_pixel_type' 
          AND table_name = 'pixels'
        ) THEN
          ALTER TABLE pixels ADD CONSTRAINT chk_pixels_pixel_type CHECK (pixel_type IN ('basic', 'bomb', 'ad', 'alliance', 'event'));
        END IF;
      END $$;
    `);
    
    // 8. 为pixels_history表添加pixel_type约束
    console.log('  📝 为pixels_history表添加pixel_type约束...');
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'chk_pixels_history_pixel_type' 
          AND table_name = 'pixels_history'
        ) THEN
          ALTER TABLE pixels_history ADD CONSTRAINT chk_pixels_history_pixel_type CHECK (pixel_type IN ('basic', 'bomb', 'ad', 'alliance', 'event'));
        END IF;
      END $$;
    `);
    
    // 9. 为pixels_history表添加updated_at字段
    console.log('  📝 为pixels_history表添加updated_at字段...');
    await knex.schema.alterTable('pixels_history', function(table) {
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    
    // 10. 为分区表添加索引和约束（使用PL/pgSQL函数）
    console.log('  📝 为分区表添加索引和约束...');
    await knex.raw(`
      -- 创建函数来为分区表添加索引和约束
      CREATE OR REPLACE FUNCTION add_partition_indexes_and_constraints()
      RETURNS void AS $$
      DECLARE
        partition_name text;
        partition_names text[] := ARRAY[
          'pixels_history_202501', 'pixels_history_202502', 'pixels_history_202503',
          'pixels_history_202504', 'pixels_history_202505', 'pixels_history_202506',
          'pixels_history_202507', 'pixels_history_202508', 'pixels_history_202509',
          'pixels_history_202510', 'pixels_history_202511', 'pixels_history_202512'
        ];
      BEGIN
        FOREACH partition_name IN ARRAY partition_names
        LOOP
          -- 检查分区表是否存在
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = partition_name
          ) THEN
            -- 添加索引（如果不存在）
            BEGIN
              EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_grid_id ON %I (grid_id)', partition_name, partition_name);
            EXCEPTION WHEN duplicate_table THEN
              -- 索引已存在，忽略错误
            END;
            
            BEGIN
              EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_user_id ON %I (user_id)', partition_name, partition_name);
            EXCEPTION WHEN duplicate_table THEN
              -- 索引已存在，忽略错误
            END;
            
            BEGIN
              EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_pixel_type ON %I (pixel_type)', partition_name, partition_name);
            EXCEPTION WHEN duplicate_table THEN
              -- 索引已存在，忽略错误
            END;
            
            BEGIN
              EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_pixel_type_related_id ON %I (pixel_type, related_id)', partition_name, partition_name);
            EXCEPTION WHEN duplicate_table THEN
              -- 索引已存在，忽略错误
            END;
            
            -- 添加约束（如果不存在）
            BEGIN
              EXECUTE format('ALTER TABLE %I ADD CONSTRAINT chk_%s_pixel_type CHECK (pixel_type IN (''basic'', ''bomb'', ''ad'', ''alliance'', ''event''))', partition_name, partition_name);
            EXCEPTION WHEN duplicate_object THEN
              -- 约束已存在，忽略错误
            END;
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 11. 执行函数
    await knex.raw('SELECT add_partition_indexes_and_constraints();');
    
    // 12. 清理函数
    await knex.raw('DROP FUNCTION IF EXISTS add_partition_indexes_and_constraints();');
    
    // 13. 记录迁移执行
    console.log('  📝 记录迁移执行...');
    await knex.schema.createTableIfNotExists('migration_records', function(table) {
      table.increments('id').primary();
      table.string('migration_name', 255).notNullable();
      table.timestamp('executed_at').defaultTo(knex.fn.now());
      table.text('description');
      table.string('status', 50).defaultTo('completed');
      table.text('error_message').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
    
    await knex('migration_records').insert({
      migration_name: '20250911_fix_table_compatibility',
      description: '修复pixels表与pixels_history表结构兼容性问题',
      executed_at: new Date(),
      status: 'completed'
    });
    
    console.log('✅ 表兼容性修复完成');
    
  } catch (error) {
    console.error('❌ 表兼容性修复失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚表兼容性修复...');
  
  try {
    // 回滚操作
    console.log('  📝 回滚pixels表修改...');
    
    // 先删除主键约束
    await knex.raw('ALTER TABLE pixels DROP CONSTRAINT IF EXISTS pixels_pkey;');
    
    // 修改字段类型回滚
    await knex.raw('ALTER TABLE pixels ALTER COLUMN id TYPE integer;');
    
    // 重新添加主键约束
    await knex.raw('ALTER TABLE pixels ADD CONSTRAINT pixels_pkey PRIMARY KEY (id);');
    
    // 修改color字段回滚
    await knex.schema.alterTable('pixels', function(table) {
      table.string('color', 20).notNullable().alter();
    });
    
    console.log('  📝 回滚pixels_history表修改...');
    await knex.schema.alterTable('pixels_history', function(table) {
      table.string('color', 20).notNullable().alter();
      table.uuid('user_id').nullable().alter();
      table.dropColumn('updated_at');
    });
    
    console.log('  📝 删除添加的索引...');
    await knex.schema.alterTable('pixels', function(table) {
      table.dropIndex('grid_id', 'idx_pixels_grid_id');
      table.dropIndex('user_id', 'idx_pixels_user_id');
      table.dropIndex('pixel_type', 'idx_pixels_pixel_type');
      table.dropIndex(['pixel_type', 'related_id'], 'idx_pixels_pixel_type_related_id');
    });
    
    await knex.schema.alterTable('pixels_history', function(table) {
      table.dropIndex('grid_id', 'idx_pixels_history_grid_id');
      table.dropIndex('user_id', 'idx_pixels_history_user_id');
      table.dropIndex('pixel_type', 'idx_pixels_history_pixel_type');
      table.dropIndex(['pixel_type', 'related_id'], 'idx_pixels_history_pixel_type_related_id');
    });
    
    console.log('  📝 删除添加的约束...');
    await knex.raw('ALTER TABLE pixels DROP CONSTRAINT IF EXISTS chk_pixels_pixel_type;');
    await knex.raw('ALTER TABLE pixels_history DROP CONSTRAINT IF EXISTS chk_pixels_history_pixel_type;');
    
    console.log('✅ 表兼容性修复回滚完成');
    
  } catch (error) {
    console.error('❌ 表兼容性修复回滚失败:', error.message);
    throw error;
  }
};
