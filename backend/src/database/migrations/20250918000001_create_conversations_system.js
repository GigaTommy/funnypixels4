/**
 * 创建会话系统表 - 支持私信/联盟/全局会话统一管理
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. 创建conversations表
    .createTableIfNotExists('conversations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.enum('type', ['private', 'alliance', 'global']).notNullable();
      table.string('key').unique().notNullable(); // private: hash(min,max), alliance: alliance:{id}, global: 'global'
      table.integer('alliance_id').unsigned().nullable().references('id').inTable('alliances').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['type', 'alliance_id'], 'idx_conversations_type_alliance');
    })

    // 2. 创建conversation_members表
    .createTableIfNotExists('conversation_members', function(table) {
      table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.bigInteger('last_read_message_id').nullable();
      table.boolean('muted').defaultTo(false);
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('last_activity').defaultTo(knex.fn.now());

      // 复合主键
      table.primary(['conversation_id', 'user_id']);

      // 索引
      table.index(['user_id', 'conversation_id'], 'idx_conversation_members_user');
      table.index(['last_read_message_id'], 'idx_conversation_members_last_read');
    })

    // 3. 扩展chat_messages表，添加新字段
    .alterTable('chat_messages', function(table) {
      // 添加会话ID字段
      table.uuid('conversation_id').nullable().references('id').inTable('conversations').onDelete('CASCADE');

      // 添加消息类型枚举
      table.enum('message_type', ['text', 'emoji', 'image', 'location']).defaultTo('text');

      // 确保metadata字段存在且为jsonb类型
      table.dropColumn('metadata'); // 先删除现有的json字段
    })

    // 4. 重新添加metadata字段为jsonb类型
    .raw(`
      ALTER TABLE chat_messages
      ADD COLUMN metadata jsonb DEFAULT '{}';

      -- 添加GIN索引用于jsonb查询优化
      CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata
      ON chat_messages USING GIN(metadata);
    `)

    // 5. 添加新的索引
    .raw(`
      -- 为conversation_id添加索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
      ON chat_messages (conversation_id, created_at DESC);

      -- 为消息类型添加索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_type
      ON chat_messages (message_type);
    `)

    // 6. 创建全局会话
    .raw(`
      -- 插入全局会话记录
      INSERT INTO conversations (id, type, key, alliance_id, created_at)
      VALUES (gen_random_uuid(), 'global', 'global', NULL, NOW())
      ON CONFLICT (key) DO NOTHING;
    `);
};

/**
 * 回滚迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // 删除索引
    .raw(`
      DROP INDEX IF EXISTS idx_chat_messages_conversation_time;
      DROP INDEX IF EXISTS idx_chat_messages_type;
      DROP INDEX IF EXISTS idx_chat_messages_metadata;
    `)

    // 恢复chat_messages表
    .alterTable('chat_messages', function(table) {
      table.dropColumn('conversation_id');
      table.dropColumn('message_type');
      table.dropColumn('metadata');
    })

    // 重新添加原有的metadata字段
    .raw(`
      ALTER TABLE chat_messages
      ADD COLUMN metadata json DEFAULT '{}';
    `)

    // 删除新创建的表
    .dropTableIfExists('conversation_members')
    .dropTableIfExists('conversations');
};