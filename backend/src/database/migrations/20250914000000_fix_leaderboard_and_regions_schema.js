/**
 * 修复leaderboard_stats和regions表的schema问题
 * 1. 为leaderboard_stats表添加updated_at字段
 * 2. 为regions表添加country字段
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  console.log('🔧 开始修复leaderboard_stats和regions表schema...');
  
  try {
    // 1. 修复leaderboard_stats表 - 添加updated_at字段
    console.log('🔧 检查leaderboard_stats表结构...');
    const leaderboardColumns = await knex.raw(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leaderboard_stats'
    `);
    
    const hasUpdatedAt = leaderboardColumns.rows.some(col => col.column_name === 'updated_at');
    
    if (!hasUpdatedAt) {
      console.log('🔧 为leaderboard_stats表添加updated_at字段...');
      await knex.schema.alterTable('leaderboard_stats', function(table) {
        table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
      });
      console.log('  ✅ 添加updated_at字段');
    } else {
      console.log('  ✅ leaderboard_stats表已包含updated_at字段');
    }
    
    // 2. 修复regions表 - 添加country字段
    console.log('🔧 检查regions表结构...');
    const regionsColumns = await knex.raw(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'regions'
    `);
    
    const hasCountry = regionsColumns.rows.some(col => col.column_name === 'country');
    
    if (!hasCountry) {
      console.log('🔧 为regions表添加country字段...');
      await knex.schema.alterTable('regions', function(table) {
        table.string('country', 100).nullable().comment('国家名称');
      });
      console.log('  ✅ 添加country字段');
      
      // 为现有数据设置默认国家值
      console.log('🔧 为现有regions数据设置默认国家值...');
      await knex.raw(`
        UPDATE regions 
        SET country = '中国' 
        WHERE country IS NULL
      `);
      console.log('  ✅ 设置默认国家值');
    } else {
      console.log('  ✅ regions表已包含country字段');
    }
    
    console.log('✅ leaderboard_stats和regions表schema修复完成');
    
  } catch (error) {
    console.error('❌ 修复表schema失败:', error);
    throw error;
  }
};

/**
 * 回滚schema修复
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  console.log('🔧 回滚leaderboard_stats和regions表schema修复...');
  
  try {
    // 删除添加的字段
    await knex.schema.alterTable('leaderboard_stats', function(table) {
      table.dropColumn('updated_at');
    });
    
    await knex.schema.alterTable('regions', function(table) {
      table.dropColumn('country');
    });
    
    console.log('✅ 表schema回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚表schema失败:', error);
    throw error;
  }
};
