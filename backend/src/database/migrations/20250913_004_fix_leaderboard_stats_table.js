/**
 * 修复leaderboard_stats表结构，支持地理统计
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  console.log('🔧 开始修复leaderboard_stats表结构...');
  
  try {
    // 检查当前表结构
    const columns = await knex.raw(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leaderboard_stats'
    `);
    
    console.log('📋 当前leaderboard_stats表结构:');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    // 检查是否需要添加地理统计相关字段
    const hasRegionLevel = columns.rows.some(col => col.column_name === 'region_level');
    const hasRegionCode = columns.rows.some(col => col.column_name === 'region_code');
    const hasRegionName = columns.rows.some(col => col.column_name === 'region_name');
    const hasPixelCount = columns.rows.some(col => col.column_name === 'pixel_count');
    const hasUserCount = columns.rows.some(col => col.column_name === 'user_count');
    
    if (!hasRegionLevel || !hasRegionCode || !hasRegionName || !hasPixelCount || !hasUserCount) {
      console.log('🔧 添加地理统计相关字段...');
      
      // 添加缺失的字段
      if (!hasRegionLevel) {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.string('region_level', 20).nullable().comment('地区级别: country/province/city');
        });
        console.log('  ✅ 添加region_level字段');
      }
      
      if (!hasRegionCode) {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.string('region_code', 20).nullable().comment('地区编码');
        });
        console.log('  ✅ 添加region_code字段');
      }
      
      if (!hasRegionName) {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.string('region_name', 200).nullable().comment('地区名称');
        });
        console.log('  ✅ 添加region_name字段');
      }
      
      if (!hasPixelCount) {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.bigInteger('pixel_count').defaultTo(0).comment('像素数量');
        });
        console.log('  ✅ 添加pixel_count字段');
      }
      
      if (!hasUserCount) {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.bigInteger('user_count').defaultTo(0).comment('用户数量');
        });
        console.log('  ✅ 添加user_count字段');
      }
      
      // 添加索引
      console.log('🔧 添加地理统计索引...');
      try {
        await knex.schema.alterTable('leaderboard_stats', function(table) {
          table.index(['region_level', 'region_code']);
          table.index(['pixel_count']);
          table.index(['user_count']);
        });
        console.log('  ✅ 添加地理统计索引');
      } catch (error) {
        console.log('  ⚠️ 索引可能已存在，跳过:', error.message);
      }
      
    } else {
      console.log('✅ leaderboard_stats表已包含地理统计字段');
    }
    
    console.log('✅ leaderboard_stats表结构修复完成');
    
  } catch (error) {
    console.error('❌ 修复leaderboard_stats表失败:', error);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  console.log('🔧 回滚leaderboard_stats表结构修复...');
  
  try {
    // 删除添加的字段
    await knex.schema.alterTable('leaderboard_stats', function(table) {
      table.dropColumn('region_level');
      table.dropColumn('region_code');
      table.dropColumn('region_name');
      table.dropColumn('pixel_count');
      table.dropColumn('user_count');
    });
    
    console.log('✅ leaderboard_stats表结构回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚leaderboard_stats表失败:', error);
    throw error;
  }
};
