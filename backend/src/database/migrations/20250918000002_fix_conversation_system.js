/**
 * 修复会话系统 - 确保所有必需的表和字段都存在
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 确保conversations表存在且结构正确
    .raw(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(20) NOT NULL CHECK (type IN ('private', 'alliance', 'global')),
        key VARCHAR(255) UNIQUE NOT NULL,
        alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 创建索引（如果不存在）
      CREATE INDEX IF NOT EXISTS idx_conversations_type_alliance
      ON conversations (type, alliance_id);
    `)

    // 确保conversation_members表存在且结构正确
    .raw(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id BIGINT,
        muted BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (conversation_id, user_id)
      );

      -- 创建索引（如果不存在）
      CREATE INDEX IF NOT EXISTS idx_conversation_members_user
      ON conversation_members (user_id, conversation_id);

      CREATE INDEX IF NOT EXISTS idx_conversation_members_last_read
      ON conversation_members (last_read_message_id);
    `)

    // 确保chat_messages表有正确的字段
    .raw(`
      -- 添加conversation_id字段（如果不存在）
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'conversation_id') THEN
          ALTER TABLE chat_messages ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
        END IF;
      END $$;

      -- 添加message_type字段（如果不存在）
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'message_type') THEN
          ALTER TABLE chat_messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'image', 'location'));
        END IF;
      END $$;

      -- 确保metadata字段为jsonb类型
      DO $$
      BEGIN
        -- 检查metadata字段是否存在且不是jsonb类型
        IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'chat_messages'
                  AND column_name = 'metadata'
                  AND data_type != 'jsonb') THEN
          -- 删除现有的metadata字段
          ALTER TABLE chat_messages DROP COLUMN metadata;
        END IF;

        -- 如果metadata字段不存在，添加它
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'chat_messages'
                      AND column_name = 'metadata') THEN
          ALTER TABLE chat_messages ADD COLUMN metadata JSONB DEFAULT '{}';
        END IF;
      END $$;
    `)

    // 添加必要的索引
    .raw(`
      -- 为conversation_id添加索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
      ON chat_messages (conversation_id, created_at DESC);

      -- 为消息类型添加索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_type
      ON chat_messages (message_type);

      -- 为metadata添加GIN索引
      CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata
      ON chat_messages USING GIN(metadata);
    `)

    // 创建全局会话（如果不存在）
    .raw(`
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
      DROP INDEX IF EXISTS idx_conversations_type_alliance;
      DROP INDEX IF EXISTS idx_conversation_members_user;
      DROP INDEX IF EXISTS idx_conversation_members_last_read;
    `)

    // 删除添加的字段
    .raw(`
      ALTER TABLE chat_messages DROP COLUMN IF EXISTS conversation_id;
      ALTER TABLE chat_messages DROP COLUMN IF EXISTS message_type;
      ALTER TABLE chat_messages DROP COLUMN IF EXISTS metadata;
    `)

    // 删除表
    .raw(`
      DROP TABLE IF EXISTS conversation_members;
      DROP TABLE IF EXISTS conversations;
    `);
};