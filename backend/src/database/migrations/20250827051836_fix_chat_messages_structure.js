/**
 * 修复chat_messages表结构以支持新的聊天系统
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. 修复chat_messages表结构
    .alterTable('chat_messages', function(table) {
      // 安全地重命名现有字段（如果存在）
      if (knex.schema.hasColumn('chat_messages', 'message')) {
        table.renameColumn('message', 'content');
      }
      if (knex.schema.hasColumn('chat_messages', 'user_id')) {
        table.renameColumn('user_id', 'sender_id');
      }
      
      // 添加新字段
      table.string('channel_type', 20).defaultTo('global');
      table.string('channel_id', 100);
      table.json('metadata').defaultTo('{}');
      table.boolean('is_system_message').defaultTo(false);
      table.boolean('is_deleted').defaultTo(false);
      table.timestamp('deleted_at');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    
    // 2. 安全地删除不需要的字段（如果存在）
    .raw(`
      -- 安全地删除字段（如果存在）
      DO $$
      BEGIN
        -- 删除latitude字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'latitude') THEN
          ALTER TABLE chat_messages DROP COLUMN latitude;
        END IF;
        
        -- 删除longitude字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'longitude') THEN
          ALTER TABLE chat_messages DROP COLUMN longitude;
        END IF;
        
        -- 删除is_anonymous字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_anonymous') THEN
          ALTER TABLE chat_messages DROP COLUMN is_anonymous;
        END IF;
        
        -- 删除guest_id字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'guest_id') THEN
          ALTER TABLE chat_messages DROP COLUMN guest_id;
        END IF;
        
        -- 删除message_type字段（如果存在）
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'message_type') THEN
          ALTER TABLE chat_messages DROP COLUMN message_type;
        END IF;
      END $$;
    `)
    
    // 3. 创建chat_unread_messages表
    .createTableIfNotExists('chat_unread_messages', function(table) {
      table.increments('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.bigInteger('message_id').notNullable().references('id').inTable('chat_messages').onDelete('CASCADE');
      table.string('channel_type', 20).notNullable();
      table.string('channel_id', 100);
      table.timestamp('read_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 复合唯一索引，防止重复记录
      table.unique(['user_id', 'message_id'], 'uk_unread_messages_user_message');
      
      // 性能索引
      table.index(['user_id', 'channel_type', 'channel_id'], 'idx_unread_messages_user_channel');
      table.index(['message_id'], 'idx_unread_messages_message');
    })
    
    // 4. 创建chat_room_stats表
    .createTableIfNotExists('chat_room_stats', function(table) {
      table.increments('id').primary();
      table.string('channel_type', 20).notNullable();
      table.string('channel_id', 100);
      table.bigInteger('message_count').defaultTo(0);
      table.bigInteger('unique_user_count').defaultTo(0);
      table.timestamp('last_message_time');
      table.timestamp('last_updated').defaultTo(knex.fn.now());
      
      // 复合唯一索引
      table.unique(['channel_type', 'channel_id'], 'uk_room_stats_channel');
      
      // 性能索引
      table.index(['channel_type', 'last_message_time'], 'idx_room_stats_type_time');
    })
    
    // 5. 创建chat_user_sessions表
    .createTableIfNotExists('chat_user_sessions', function(table) {
      table.increments('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('session_id', 100).notNullable();
      table.string('channel_type', 20);
      table.string('channel_id', 100);
      table.timestamp('last_activity').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 复合唯一索引
      table.unique(['user_id', 'session_id'], 'uk_user_sessions_user_session');
      
      // 性能索引
      table.index(['user_id', 'channel_type', 'channel_id'], 'idx_user_sessions_user_channel');
      table.index(['last_activity'], 'idx_user_sessions_activity');
    })
    
    // 6. 添加索引
    .raw(`
      -- 为chat_messages表添加索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_time 
      ON chat_messages (channel_type, channel_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_time 
      ON chat_messages (sender_id, created_at DESC);
    `)
    
    // 7. 插入一些测试数据（可选）
    .raw(`
      -- 插入一些测试的全局消息
      INSERT INTO chat_messages (content, channel_type, channel_id, sender_id, created_at, updated_at)
      SELECT 
        '欢迎来到像素世界！' as content,
        'global' as channel_type,
        NULL as channel_id,
        u.id as sender_id,
        NOW() as created_at,
        NOW() as updated_at
      FROM users u 
      WHERE u.role = 'admin' 
      LIMIT 1
      ON CONFLICT DO NOTHING;
    `);
};

/**
 * 回滚迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // 删除新创建的表
    .dropTableIfExists('chat_user_sessions')
    .dropTableIfExists('chat_room_stats')
    .dropTableIfExists('chat_unread_messages')
    
    // 恢复chat_messages表结构
    .alterTable('chat_messages', function(table) {
      // 恢复原有字段
      if (knex.schema.hasColumn('chat_messages', 'content')) {
        table.renameColumn('content', 'message');
      }
      if (knex.schema.hasColumn('chat_messages', 'sender_id')) {
        table.renameColumn('sender_id', 'user_id');
      }
      table.string('message_type', 20).defaultTo('text');
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      table.boolean('is_anonymous').defaultTo(false);
      table.string('guest_id', 100);
      
      // 删除新添加的字段
      table.dropColumn('channel_type');
      table.dropColumn('channel_id');
      table.dropColumn('metadata');
      table.dropColumn('is_system_message');
      table.dropColumn('is_deleted');
      table.dropColumn('deleted_at');
      table.dropColumn('updated_at');
    })
    
    // 删除索引
    .raw(`
      DROP INDEX IF EXISTS idx_chat_messages_channel_time;
      DROP INDEX IF EXISTS idx_chat_messages_sender_time;
    `);
};
