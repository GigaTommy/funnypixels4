/**
 * 修正排行榜表的数据类型
 * 将 alliance_id 和 region_id 从 uuid 改为 integer 类型
 */

exports.up = async function(knex) {
  try {
    console.log('🔧 开始修正排行榜表的数据类型...');
    
    // 1. 修正 leaderboard_alliance 表的 alliance_id 字段
    console.log('📊 修正 leaderboard_alliance 表的 alliance_id 字段...');
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在且类型不正确
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_alliance' 
          AND column_name = 'alliance_id' 
          AND data_type = 'uuid'
        ) THEN
          -- 删除现有数据（因为类型转换可能失败）
          DELETE FROM leaderboard_alliance;
          
          -- 修改字段类型
          ALTER TABLE leaderboard_alliance 
          ALTER COLUMN alliance_id TYPE integer USING alliance_id::text::integer;
        END IF;
      END $$;
    `);
    
    // 2. 修正 leaderboard_region 表的 region_id 字段
    console.log('📊 修正 leaderboard_region 表的 region_id 字段...');
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在且类型不正确
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_region' 
          AND column_name = 'region_id' 
          AND data_type = 'uuid'
        ) THEN
          -- 删除现有数据（因为类型转换可能失败）
          DELETE FROM leaderboard_region;
          
          -- 修改字段类型
          ALTER TABLE leaderboard_region 
          ALTER COLUMN region_id TYPE integer USING region_id::text::integer;
        END IF;
      END $$;
    `);
    
    console.log('✅ 排行榜表数据类型修正完成');
    
    // 记录迁移完成
    await knex('migration_records').insert({
      migration_name: '20250911_fix_leaderboard_table_types',
      description: '修正排行榜表的数据类型，将alliance_id和region_id从uuid改为integer',
      executed_at: new Date(),
      status: 'completed'
    });
    
  } catch (error) {
    console.error('❌ 修正排行榜表数据类型失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚排行榜表数据类型修正...');
    
    // 1. 回滚 leaderboard_alliance 表的 alliance_id 字段
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_alliance' 
          AND column_name = 'alliance_id' 
          AND data_type = 'integer'
        ) THEN
          -- 删除现有数据
          DELETE FROM leaderboard_alliance;
          
          -- 修改字段类型回uuid
          ALTER TABLE leaderboard_alliance 
          ALTER COLUMN alliance_id TYPE uuid USING alliance_id::text::uuid;
        END IF;
      END $$;
    `);
    
    // 2. 回滚 leaderboard_region 表的 region_id 字段
    await knex.raw(`
      DO $$ 
      BEGIN
        -- 检查字段是否存在
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leaderboard_region' 
          AND column_name = 'region_id' 
          AND data_type = 'integer'
        ) THEN
          -- 删除现有数据
          DELETE FROM leaderboard_region;
          
          -- 修改字段类型回uuid
          ALTER TABLE leaderboard_region 
          ALTER COLUMN region_id TYPE uuid USING region_id::text::uuid;
        END IF;
      END $$;
    `);
    
    console.log('✅ 排行榜表数据类型回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚排行榜表数据类型失败:', error);
    throw error;
  }
};
