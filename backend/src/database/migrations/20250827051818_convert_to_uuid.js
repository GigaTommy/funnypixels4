/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.raw(`
    -- 启用UUID扩展
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- 备份现有数据
    CREATE TEMP TABLE users_backup AS SELECT * FROM users;
    CREATE TEMP TABLE pixels_backup AS SELECT * FROM pixels;
    CREATE TEMP TABLE user_pixel_states_backup AS SELECT * FROM user_pixel_states;
    CREATE TEMP TABLE alliance_members_backup AS SELECT * FROM alliance_members;
    CREATE TEMP TABLE alliances_backup AS SELECT * FROM alliances;
    CREATE TEMP TABLE chat_messages_backup AS SELECT * FROM chat_messages;
    CREATE TEMP TABLE notifications_backup AS SELECT * FROM notifications;
    CREATE TEMP TABLE pattern_assets_backup AS SELECT * FROM pattern_assets;
    CREATE TEMP TABLE user_achievements_backup AS SELECT * FROM user_achievements;
    CREATE TEMP TABLE user_items_backup AS SELECT * FROM user_items;
    
    -- 删除所有依赖users表的外键约束
    ALTER TABLE alliance_members DROP CONSTRAINT IF EXISTS alliance_members_user_id_foreign;
    ALTER TABLE alliances DROP CONSTRAINT IF EXISTS alliances_leader_id_foreign;
    ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_foreign;
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_foreign;
    ALTER TABLE pattern_assets DROP CONSTRAINT IF EXISTS pattern_assets_created_by_foreign;
    ALTER TABLE pixels DROP CONSTRAINT IF EXISTS pixels_user_id_foreign;
    ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_user_id_foreign;
    ALTER TABLE user_items DROP CONSTRAINT IF EXISTS user_items_user_id_foreign;
    ALTER TABLE user_pixel_states DROP CONSTRAINT IF EXISTS user_pixel_states_user_id_foreign;
    
    -- 删除所有相关表
    DROP TABLE IF EXISTS user_pixel_states CASCADE;
    DROP TABLE IF EXISTS user_items CASCADE;
    DROP TABLE IF EXISTS user_achievements CASCADE;
    DROP TABLE IF EXISTS pixels CASCADE;
    DROP TABLE IF EXISTS pattern_assets CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS chat_messages CASCADE;
    DROP TABLE IF EXISTS alliance_members CASCADE;
    DROP TABLE IF EXISTS alliances CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    
    -- 重新创建users表，使用UUID
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      avatar_url VARCHAR(500),
      bio TEXT,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      gems INTEGER DEFAULT 10,
      is_guest BOOLEAN DEFAULT false,
      guest_id VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP WITH TIME ZONE,
      is_online BOOLEAN DEFAULT false,
      is_banned BOOLEAN DEFAULT false,
      ban_reason TEXT,
      preferences JSON,
      phone VARCHAR(20),
      role VARCHAR(20) DEFAULT 'user',
      motto VARCHAR(200),
      privacy_mode BOOLEAN DEFAULT false,
      points INTEGER DEFAULT 0,
      total_pixels INTEGER DEFAULT 0,
      current_pixels INTEGER DEFAULT 0
    );
    
    -- 重新创建user_pixel_states表，支持UUID和游客ID
    CREATE TABLE user_pixel_states (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL, -- 支持UUID和游客ID
      pixel_points INTEGER DEFAULT 64,
      last_accum_time BIGINT DEFAULT EXTRACT(epoch FROM now()),
      freeze_until BIGINT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 重新创建其他相关表，使用UUID
    CREATE TABLE alliance_members (
      id SERIAL PRIMARY KEY,
      alliance_id INTEGER NOT NULL,
      user_id UUID NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE alliances (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      color VARCHAR(7) DEFAULT '#000000',
      leader_id UUID NOT NULL,
      is_public BOOLEAN DEFAULT true,
      member_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE chat_messages (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      message TEXT NOT NULL,
      room VARCHAR(100) DEFAULT 'global',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE notifications (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE pattern_assets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      image_url VARCHAR(500),
      category VARCHAR(50),
      tags TEXT[],
      is_public BOOLEAN DEFAULT true,
      created_by UUID,
      download_count INTEGER DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE pixels (
      id SERIAL PRIMARY KEY,
      grid_id VARCHAR(50) NOT NULL,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      color VARCHAR(7) NOT NULL,
      user_id UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE user_achievements (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE user_items (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 添加外键约束
    ALTER TABLE alliance_members ADD CONSTRAINT alliance_members_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE alliances ADD CONSTRAINT alliances_leader_id_foreign 
      FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE pattern_assets ADD CONSTRAINT pattern_assets_created_by_foreign 
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE pixels ADD CONSTRAINT pixels_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE user_items ADD CONSTRAINT user_items_user_id_foreign 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.raw(`
    -- 恢复为整数ID（注意：这会丢失数据）
    DROP TABLE IF EXISTS users CASCADE;
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      avatar_url VARCHAR(500),
      bio TEXT,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      gems INTEGER DEFAULT 10,
      is_guest BOOLEAN DEFAULT false,
      guest_id VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP WITH TIME ZONE,
      is_online BOOLEAN DEFAULT false,
      is_banned BOOLEAN DEFAULT false,
      ban_reason TEXT,
      preferences JSON,
      phone VARCHAR(20),
      role VARCHAR(20) DEFAULT 'user',
      motto VARCHAR(200),
      privacy_mode BOOLEAN DEFAULT false,
      points INTEGER DEFAULT 0,
      total_pixels INTEGER DEFAULT 0,
      current_pixels INTEGER DEFAULT 0
    );
    
    -- 恢复user_pixel_states表
    DROP TABLE IF EXISTS user_pixel_states;
    CREATE TABLE user_pixel_states (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      pixel_points INTEGER DEFAULT 64,
      last_accum_time BIGINT DEFAULT EXTRACT(epoch FROM now()),
      freeze_until BIGINT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
};
