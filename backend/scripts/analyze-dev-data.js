#!/usr/bin/env node

/**
 * 分析开发环境数据
 */

process.env.NODE_ENV = 'development';

const { db } = require('../src/config/database');

async function analyzeDevData() {
  try {
    console.log('🔍 分析开发环境数据...');
    
    // 1. 表结构
    const columns = await db.raw(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'leaderboard_stats' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 开发环境表结构:');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 2. 数据统计
    const stats = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .count('* as count')
      .first();
    
    console.log(`\n📊 开发环境地理统计记录数: ${stats.count}`);
    
    // 3. 省份数据
    const provinces = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .where('region_level', 'province')
      .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
      .orderBy('pixel_count', 'desc')
      .limit(10);
    
    console.log(`\n🏞️ 开发环境省份数据 (${provinces.length}条):`);
    provinces.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}, 周期: ${item.period}`);
    });
    
    // 4. 城市数据
    const cities = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .where('region_level', 'city')
      .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
      .orderBy('pixel_count', 'desc')
      .limit(10);
    
    console.log(`\n🏙️ 开发环境城市数据 (${cities.length}条):`);
    cities.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}, 周期: ${item.period}`);
    });
    
    // 5. 国家数据
    const countries = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .where('region_level', 'country')
      .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
      .orderBy('pixel_count', 'desc')
      .limit(5);
    
    console.log(`\n🇨🇳 开发环境国家数据 (${countries.length}条):`);
    countries.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}, 周期: ${item.period}`);
    });
    
    // 6. 按周期统计
    const periodStats = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .select('period')
      .count('* as count')
      .groupBy('period');
    
    console.log(`\n📅 开发环境按周期统计:`);
    periodStats.forEach(item => {
      console.log(`  ${item.period}: ${item.count}条记录`);
    });
    
    console.log('\n✅ 开发环境数据分析完成！');
    
  } catch (error) {
    console.error('❌ 开发环境数据分析失败:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// 运行分析
if (require.main === module) {
  analyzeDevData();
}

module.exports = analyzeDevData;
