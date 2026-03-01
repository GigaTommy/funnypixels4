/**
 * 修正排行榜表字段长度限制
 * 增加 alliance_flag 字段长度以容纳更长的标识符
 */

exports.up = async function(knex) {
  try {
    console.log('🔧 开始修正排行榜表字段长度限制...');
    
    // 1. 修正 leaderboard_alliance 表的 alliance_flag 字段长度
    console.log('📊 修正 leaderboard_alliance 表的 alliance_flag 字段长度...');
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在且长度限制过小
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_alliance' 
          AND column_name = 'alliance_flag' 
          AND character_maximum_length = 10
        ) THEN
          -- 修改字段长度
          ALTER TABLE leaderboard_alliance 
          ALTER COLUMN alliance_flag TYPE character varying(50);
        END IF;
      END $$;
    `);
    
    // 2. 修正 leaderboard_region 表的 region_flag 字段长度
    console.log('📊 修正 leaderboard_region 表的 region_flag 字段长度...');
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在且长度限制过小
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_region' 
          AND column_name = 'region_flag' 
          AND character_maximum_length = 10
        ) THEN
          -- 修改字段长度
          ALTER TABLE leaderboard_region 
          ALTER COLUMN region_flag TYPE character varying(50);
        END IF;
      END $$;
    `);
    
    console.log('✅ 排行榜表字段长度限制修正完成');
    
    // 记录迁移完成
    await knex('migration_records').insert({
      migration_name: '20250911_fix_leaderboard_field_lengths',
      description: '修正排行榜表字段长度限制，增加alliance_flag和region_flag字段长度',
      executed_at: new Date(),
      status: 'completed'
    });
    
  } catch (error) {
    console.error('❌ 修正排行榜表字段长度限制失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚排行榜表字段长度限制修正...');
    
    // 1. 回滚 leaderboard_alliance 表的 alliance_flag 字段长度
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_alliance' 
          AND column_name = 'alliance_flag' 
          AND character_maximum_length = 50
        ) THEN
          -- 修改字段长度回10
          ALTER TABLE leaderboard_alliance 
          ALTER COLUMN alliance_flag TYPE character varying(10);
        END IF;
      END $$;
    `);
    
    // 2. 回滚 leaderboard_region 表的 region_flag 字段长度
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_region' 
          AND column_name = 'region_flag' 
          AND character_maximum_length = 50
        ) THEN
          -- 修改字段长度回10
          ALTER TABLE leaderboard_region 
          ALTER COLUMN region_flag TYPE character varying(10);
        END IF;
      END $$;
    `);
    
    console.log('✅ 排行榜表字段长度限制回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚排行榜表字段长度限制失败:', error);
    throw error;
  }
};
