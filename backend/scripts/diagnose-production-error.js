#!/usr/bin/env node

/**
 * 诊断生产环境排行榜错误
 * 模拟前端请求并检查具体错误
 */

const { db } = require('../src/config/database');
const GeographicLeaderboardService = require('../src/services/geographicLeaderboardService');

async function diagnoseProductionError() {
  try {
    console.log('🔍 开始诊断生产环境排行榜错误...');
    
    // 1. 检查数据库连接和表结构
    console.log('\n1️⃣ 检查数据库状态...');
    try {
      const testResult = await db.raw('SELECT 1 as test');
      console.log('✅ 数据库连接正常');
    } catch (error) {
      console.log('❌ 数据库连接失败:', error.message);
      return;
    }
    
    // 2. 检查表结构
    console.log('\n2️⃣ 检查表结构...');
    const columns = await db.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'leaderboard_stats' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const existingColumns = columns.rows.map(row => row.column_name);
    const requiredColumns = ['region_level', 'region_code', 'region_name', 'pixel_count', 'user_count'];
    
    let missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    if (missingColumns.length > 0) {
      console.log(`❌ 缺少必需列: ${missingColumns.join(', ')}`);
      console.log('💡 这是导致生产环境失败的主要原因！');
      console.log('💡 需要运行: node scripts/fix-leaderboard-stats-table.js');
      return;
    } else {
      console.log('✅ 表结构完整');
    }
    
    // 3. 检查数据
    console.log('\n3️⃣ 检查数据...');
    const dataCount = await db('leaderboard_stats')
      .where('leaderboard_type', 'geographic')
      .count('* as count')
      .first();
    
    if (dataCount.count == 0) {
      console.log('⚠️ 没有地理统计数据');
      console.log('💡 需要运行: node scripts/generate-sample-leaderboard-data.js');
    } else {
      console.log(`✅ 有 ${dataCount.count} 条地理统计数据`);
    }
    
    // 4. 测试GeographicLeaderboardService
    console.log('\n4️⃣ 测试GeographicLeaderboardService...');
    try {
      const leaderboardService = new GeographicLeaderboardService();
      
      // 测试省份排行榜
      console.log('  测试省份排行榜...');
      const provinceResult = await leaderboardService.getProvinceLeaderboard('daily', 5);
      console.log(`  ✅ 省份排行榜成功，返回 ${provinceResult.data.length} 条数据`);
      
      // 测试城市排行榜
      console.log('  测试城市排行榜...');
      const cityResult = await leaderboardService.getCityLeaderboard('daily', 5);
      console.log(`  ✅ 城市排行榜成功，返回 ${cityResult.data.length} 条数据`);
      
      // 测试国家排行榜
      console.log('  测试国家排行榜...');
      const countryResult = await leaderboardService.getCountryLeaderboard('daily');
      console.log(`  ✅ 国家排行榜成功，返回 ${countryResult.data.length} 条数据`);
      
    } catch (error) {
      console.log('❌ GeographicLeaderboardService测试失败:', error.message);
      console.log('💡 这可能是导致生产环境失败的原因');
      console.error(error.stack);
      return;
    }
    
    // 5. 测试数据库查询
    console.log('\n5️⃣ 测试数据库查询...');
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // 测试省份查询
      const provinceQuery = await db.raw(`
        SELECT DISTINCT ON (region_code) 
          region_code, region_name, pixel_count, user_count, updated_at
        FROM leaderboard_stats
        WHERE leaderboard_type = 'geographic'
        AND region_level = ?
        AND period = ?
        AND period_start >= ?
        AND period_start < ?
        ORDER BY region_code, updated_at DESC
        LIMIT 5
      `, ['province', 'daily', periodStart, new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)]);
      
      console.log(`  ✅ 省份查询成功，返回 ${provinceQuery.rows.length} 条数据`);
      
      if (provinceQuery.rows.length > 0) {
        console.log('  🏆 前3名省份:');
        provinceQuery.rows.slice(0, 3).forEach((item, index) => {
          console.log(`    ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
        });
      }
      
    } catch (error) {
      console.log('❌ 数据库查询失败:', error.message);
      console.log('💡 这可能是导致生产环境失败的原因');
      console.error(error.stack);
      return;
    }
    
    // 6. 检查路由配置
    console.log('\n6️⃣ 检查路由配置...');
    try {
      const fs = require('fs');
      const serverContent = fs.readFileSync('./src/server.js', 'utf8');
      
      if (serverContent.includes("app.use('/api/geographic'")) {
        console.log('✅ 地理路由已配置');
      } else {
        console.log('❌ 地理路由未配置');
        console.log('💡 需要在server.js中添加地理路由配置');
      }
      
      if (serverContent.includes("GeographicController")) {
        console.log('✅ GeographicController已导入');
      } else {
        console.log('❌ GeographicController未导入');
      }
      
    } catch (error) {
      console.log('❌ 检查路由配置失败:', error.message);
    }
    
    // 7. 模拟API请求
    console.log('\n7️⃣ 模拟API请求...');
    try {
      const express = require('express');
      const app = express();
      
      // 模拟请求对象
      const mockReq = {
        query: { period: 'daily', limit: '10', offset: '0' },
        user: null // 模拟未认证用户
      };
      
      const mockRes = {
        json: (data) => {
          console.log('  ✅ API响应成功');
          console.log(`  📊 响应数据: ${JSON.stringify(data).substring(0, 100)}...`);
        },
        status: (code) => ({
          json: (data) => {
            console.log(`  ❌ API响应失败，状态码: ${code}`);
            console.log(`  📊 错误数据: ${JSON.stringify(data).substring(0, 100)}...`);
          }
        })
      };
      
      // 测试GeographicController
      const GeographicController = require('./src/controllers/geographicController');
      
      console.log('  测试getProvinceLeaderboard...');
      await GeographicController.getProvinceLeaderboard(mockReq, mockRes);
      
    } catch (error) {
      console.log('❌ 模拟API请求失败:', error.message);
      console.log('💡 这可能是导致生产环境失败的原因');
      console.error(error.stack);
    }
    
    console.log('\n✅ 诊断完成！');
    console.log('\n💡 如果所有测试都通过，问题可能是:');
    console.log('  1. 生产环境没有运行修复脚本');
    console.log('  2. 生产环境没有重启服务器');
    console.log('  3. 生产环境的数据库连接配置问题');
    console.log('  4. 生产环境的缓存问题');
    
  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// 运行诊断
if (require.main === module) {
  diagnoseProductionError();
}

module.exports = diagnoseProductionError;
