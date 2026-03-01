#!/usr/bin/env node

/**
 * 对比开发环境与生产环境数据表差异
 * 详细分析排行榜功能异常的原因
 */

const productionConfig = require('../config/production-database.json');

async function compareDevProdData() {
  try {
    console.log('🔍 开始对比开发环境与生产环境数据表差异...');
    
    // 1. 对比开发环境数据
    console.log('\n1️⃣ 分析开发环境数据...');
    process.env.NODE_ENV = 'development';
    const { db: devDb } = require('../src/config/database');
    
    let devData = {};
    try {
      // 开发环境表结构
      const devColumns = await devDb.raw(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'leaderboard_stats' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      // 开发环境数据统计
      const devStats = await devDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .count('* as count')
        .first();
      
      // 开发环境省份数据
      const devProvinces = await devDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'province')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(10);
      
      // 开发环境城市数据
      const devCities = await devDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'city')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(10);
      
      // 开发环境国家数据
      const devCountries = await devDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'country')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(5);
      
      devData = {
        columns: devColumns.rows,
        totalCount: devStats.count,
        provinces: devProvinces,
        cities: devCities,
        countries: devCountries
      };
      
      console.log('✅ 开发环境数据获取成功');
      console.log(`📊 开发环境地理统计记录数: ${devData.totalCount}`);
      console.log(`📊 开发环境省份记录数: ${devData.provinces.length}`);
      console.log(`📊 开发环境城市记录数: ${devData.cities.length}`);
      console.log(`📊 开发环境国家记录数: ${devData.countries.length}`);
      
    } catch (error) {
      console.log('❌ 开发环境数据获取失败:', error.message);
    } finally {
      await devDb.destroy();
    }
    
    // 2. 对比生产环境数据
    console.log('\n2️⃣ 分析生产环境数据...');
    
    // 重新设置环境变量
    process.env.NODE_ENV = 'production';
    process.env.DB_HOST = productionConfig.database.host;
    process.env.DB_PORT = productionConfig.database.port;
    process.env.DB_USER = productionConfig.database.user;
    process.env.DB_PASSWORD = productionConfig.database.password;
    process.env.DB_NAME = productionConfig.database.database;
    process.env.DB_SSL = 'true';
    
    // 重新加载数据库配置
    delete require.cache[require.resolve('../src/config/database')];
    const { db: prodDb } = require('../src/config/database');
    
    let prodData = {};
    try {
      // 生产环境表结构
      const prodColumns = await prodDb.raw(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'leaderboard_stats' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      // 生产环境数据统计
      const prodStats = await prodDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .count('* as count')
        .first();
      
      // 生产环境省份数据
      const prodProvinces = await prodDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'province')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(10);
      
      // 生产环境城市数据
      const prodCities = await prodDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'city')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(10);
      
      // 生产环境国家数据
      const prodCountries = await prodDb('leaderboard_stats')
        .where('leaderboard_type', 'geographic')
        .where('region_level', 'country')
        .select('region_code', 'region_name', 'pixel_count', 'user_count', 'period', 'period_start')
        .orderBy('pixel_count', 'desc')
        .limit(5);
      
      prodData = {
        columns: prodColumns.rows,
        totalCount: prodStats.count,
        provinces: prodProvinces,
        cities: prodCities,
        countries: prodCountries
      };
      
      console.log('✅ 生产环境数据获取成功');
      console.log(`📊 生产环境地理统计记录数: ${prodData.totalCount}`);
      console.log(`📊 生产环境省份记录数: ${prodData.provinces.length}`);
      console.log(`📊 生产环境城市记录数: ${prodData.cities.length}`);
      console.log(`📊 生产环境国家记录数: ${prodData.countries.length}`);
      
    } catch (error) {
      console.log('❌ 生产环境数据获取失败:', error.message);
    } finally {
      await prodDb.destroy();
    }
    
    // 3. 详细对比分析
    console.log('\n3️⃣ 详细对比分析...');
    
    // 3.1 表结构对比
    console.log('\n📋 表结构对比:');
    const devColumnNames = devData.columns.map(col => col.column_name);
    const prodColumnNames = prodData.columns.map(col => col.column_name);
    
    const missingInProd = devColumnNames.filter(name => !prodColumnNames.includes(name));
    const missingInDev = prodColumnNames.filter(name => !devColumnNames.includes(name));
    
    if (missingInProd.length > 0) {
      console.log(`❌ 生产环境缺少列: ${missingInProd.join(', ')}`);
    } else {
      console.log('✅ 表结构一致');
    }
    
    if (missingInDev.length > 0) {
      console.log(`⚠️ 开发环境缺少列: ${missingInDev.join(', ')}`);
    }
    
    // 3.2 数据量对比
    console.log('\n📊 数据量对比:');
    console.log(`开发环境总记录数: ${devData.totalCount}`);
    console.log(`生产环境总记录数: ${prodData.totalCount}`);
    console.log(`差异: ${devData.totalCount - prodData.totalCount}`);
    
    // 3.3 省份数据对比
    console.log('\n🏞️ 省份数据对比:');
    console.log(`开发环境省份数: ${devData.provinces.length}`);
    console.log(`生产环境省份数: ${prodData.provinces.length}`);
    
    if (devData.provinces.length > 0) {
      console.log('开发环境前5名省份:');
      devData.provinces.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    }
    
    if (prodData.provinces.length > 0) {
      console.log('生产环境前5名省份:');
      prodData.provinces.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    } else {
      console.log('❌ 生产环境没有省份数据！');
    }
    
    // 3.4 城市数据对比
    console.log('\n🏙️ 城市数据对比:');
    console.log(`开发环境城市数: ${devData.cities.length}`);
    console.log(`生产环境城市数: ${prodData.cities.length}`);
    
    if (devData.cities.length > 0) {
      console.log('开发环境前5名城市:');
      devData.cities.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    }
    
    if (prodData.cities.length > 0) {
      console.log('生产环境前5名城市:');
      prodData.cities.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    } else {
      console.log('❌ 生产环境没有城市数据！');
    }
    
    // 3.5 国家数据对比
    console.log('\n🇨🇳 国家数据对比:');
    console.log(`开发环境国家数: ${devData.countries.length}`);
    console.log(`生产环境国家数: ${prodData.countries.length}`);
    
    if (devData.countries.length > 0) {
      console.log('开发环境国家数据:');
      devData.countries.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    }
    
    if (prodData.countries.length > 0) {
      console.log('生产环境国家数据:');
      prodData.countries.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    }
    
    // 4. 问题分析
    console.log('\n4️⃣ 问题分析...');
    
    const issues = [];
    
    // 检查数据缺失问题
    if (prodData.provinces.length === 0) {
      issues.push('生产环境缺少省份数据');
    }
    
    if (prodData.cities.length === 0) {
      issues.push('生产环境缺少城市数据');
    }
    
    if (prodData.totalCount < devData.totalCount) {
      issues.push(`生产环境数据量不足: ${prodData.totalCount} < ${devData.totalCount}`);
    }
    
    // 检查数据质量问题
    if (prodData.provinces.length > 0) {
      const maxPixels = Math.max(...prodData.provinces.map(p => parseInt(p.pixel_count)));
      if (maxPixels < 100) {
        issues.push('生产环境省份数据像素数过低，可能影响排行榜显示');
      }
    }
    
    if (issues.length > 0) {
      console.log('❌ 发现的问题:');
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ 未发现明显问题');
    }
    
    // 5. 建议解决方案
    console.log('\n5️⃣ 建议解决方案...');
    
    if (prodData.provinces.length === 0 || prodData.cities.length === 0) {
      console.log('💡 建议: 为生产环境生成更多示例数据');
      console.log('   运行: node scripts/generate-sample-leaderboard-data.js');
    }
    
    if (prodData.totalCount < devData.totalCount) {
      console.log('💡 建议: 同步开发环境的数据到生产环境');
    }
    
    console.log('\n✅ 对比分析完成！');
    
  } catch (error) {
    console.error('❌ 对比分析失败:', error.message);
    console.error(error.stack);
  }
}

// 运行对比
if (require.main === module) {
  compareDevProdData();
}

module.exports = compareDevProdData;
