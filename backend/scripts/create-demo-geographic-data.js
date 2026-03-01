#!/usr/bin/env node

/**
 * 创建演示数据测试地理统计功能
 */

const { db } = require('../src/config/database');
const PixelLocationService = require('../src/services/pixelLocationService');
const GeographicLeaderboardService = require('../src/services/geographicLeaderboardService');

async function createDemoData() {
  console.log('🎭 创建地理统计演示数据...\n');
  
  try {
    // 1. 创建演示用户
    console.log('1️⃣ 创建演示用户...');
    const demoUsers = [
      { id: '550e8400-e29b-41d4-a716-446655440001', username: 'bbb', email: 'bbb@example.com', password_hash: '$2b$10$rQZ8K9LmN2pO3qR4sT5uVeWxYzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6' },
      { id: '550e8400-e29b-41d4-a716-446655440002', username: '上海用户', email: 'shanghai@demo.com', password_hash: '$2b$10$rQZ8K9LmN2pO3qR4sT5uVeWxYzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6' },
      { id: '550e8400-e29b-41d4-a716-446655440003', username: '深圳用户', email: 'shenzhen@demo.com', password_hash: '$2b$10$rQZ8K9LmN2pO3qR4sT5uVeWxYzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6' },
      { id: '550e8400-e29b-41d4-a716-446655440004', username: '广州用户', email: 'guangzhou@demo.com', password_hash: '$2b$10$rQZ8K9LmN2pO3qR4sT5uVeWxYzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6' },
      { id: '550e8400-e29b-41d4-a716-446655440005', username: '杭州用户', email: 'hangzhou@demo.com', password_hash: '$2b$10$rQZ8K9LmN2pO3qR4sT5uVeWxYzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6' }
    ];
    
    for (const user of demoUsers) {
      await db('users').insert(user).onConflict('id').ignore();
    }
    console.log(`✅ 创建了 ${demoUsers.length} 个演示用户`);
    
    // 2. 创建演示像素数据
    console.log('2️⃣ 创建演示像素数据...');
    const demoPixels = [
      // 北京像素 - bbb用户
      { id: 2001, user_id: '550e8400-e29b-41d4-a716-446655440001', grid_id: 'beijing_001', latitude: 39.9042, longitude: 116.4074, color: '#FF0000', created_at: new Date() },
      { id: 2002, user_id: '550e8400-e29b-41d4-a716-446655440001', grid_id: 'beijing_002', latitude: 39.9142, longitude: 116.4174, color: '#00FF00', created_at: new Date() },
      { id: 2003, user_id: '550e8400-e29b-41d4-a716-446655440001', grid_id: 'beijing_003', latitude: 39.9242, longitude: 116.4274, color: '#0000FF', created_at: new Date() },
      
      // 上海像素
      { id: 2004, user_id: '550e8400-e29b-41d4-a716-446655440002', grid_id: 'shanghai_001', latitude: 31.2304, longitude: 121.4737, color: '#FFFF00', created_at: new Date() },
      { id: 2005, user_id: '550e8400-e29b-41d4-a716-446655440002', grid_id: 'shanghai_002', latitude: 31.2404, longitude: 121.4837, color: '#FF00FF', created_at: new Date() },
      
      // 深圳像素
      { id: 2006, user_id: '550e8400-e29b-41d4-a716-446655440003', grid_id: 'shenzhen_001', latitude: 22.5431, longitude: 114.0579, color: '#00FFFF', created_at: new Date() },
      { id: 2007, user_id: '550e8400-e29b-41d4-a716-446655440003', grid_id: 'shenzhen_002', latitude: 22.5531, longitude: 114.0679, color: '#FFA500', created_at: new Date() },
      
      // 广州像素
      { id: 2008, user_id: '550e8400-e29b-41d4-a716-446655440004', grid_id: 'guangzhou_001', latitude: 23.1291, longitude: 113.2644, color: '#800080', created_at: new Date() },
      
      // 杭州像素
      { id: 2009, user_id: '550e8400-e29b-41d4-a716-446655440005', grid_id: 'hangzhou_001', latitude: 30.2741, longitude: 120.1551, color: '#FFC0CB', created_at: new Date() },
      { id: 2010, user_id: '550e8400-e29b-41d4-a716-446655440005', grid_id: 'hangzhou_002', latitude: 30.2841, longitude: 120.1651, color: '#A52A2A', created_at: new Date() }
    ];
    
    for (const pixel of demoPixels) {
      await db('pixels').insert(pixel).onConflict('id').ignore();
    }
    console.log(`✅ 创建了 ${demoPixels.length} 个演示像素`);
    
    // 3. 计算像素地理归属
    console.log('3️⃣ 计算像素地理归属...');
    const pixelLocationService = new PixelLocationService();
    
    for (const pixel of demoPixels) {
      try {
        const location = await pixelLocationService.calculatePixelLocation(
          pixel.id, 
          pixel.latitude, 
          pixel.longitude
        );
        console.log(`  ✅ 像素 ${pixel.id} (${pixel.grid_id}): ${location.province_name}${location.city_name ? ' - ' + location.city_name : ''}`);
      } catch (error) {
        console.log(`  ⚠️ 像素 ${pixel.id} 地理归属计算失败: ${error.message}`);
      }
    }
    
    // 4. 更新地理统计
    console.log('4️⃣ 更新地理统计...');
    const leaderboardService = new GeographicLeaderboardService();
    
    try {
      await leaderboardService.updateAllGeographicStats('daily');
      console.log('✅ 地理统计更新完成');
    } catch (error) {
      console.log(`⚠️ 地理统计更新失败: ${error.message}`);
    }
    
    // 5. 显示地理排行榜
    console.log('5️⃣ 显示地理排行榜...');
    
    try {
      const provinceLeaderboard = await leaderboardService.getGeographicLeaderboard('province', 'daily', 10, 0);
      console.log('🏆 省级排行榜:');
      provinceLeaderboard.data.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    } catch (error) {
      console.log(`⚠️ 省级排行榜获取失败: ${error.message}`);
    }
    
    try {
      const cityLeaderboard = await leaderboardService.getGeographicLeaderboard('city', 'daily', 10, 0);
      console.log('🏆 城市排行榜:');
      cityLeaderboard.data.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.region_name} - 像素: ${item.pixel_count}, 用户: ${item.user_count}`);
      });
    } catch (error) {
      console.log(`⚠️ 城市排行榜获取失败: ${error.message}`);
    }
    
    // 6. 显示像素位置缓存
    console.log('6️⃣ 显示像素位置缓存...');
    const pixelLocations = await db('pixel_location_cache')
      .select('pixel_id', 'province_name', 'city_name')
      .orderBy('pixel_id');
    
    console.log('📍 像素位置缓存:');
    pixelLocations.forEach(location => {
      console.log(`  像素 ${location.pixel_id}: ${location.province_name}${location.city_name ? ' - ' + location.city_name : ''}`);
    });
    
    console.log('\n🎉 演示数据创建完成！');
    console.log('\n📋 测试建议:');
    console.log('1. 启动服务器: npm start');
    console.log('2. 访问前端页面查看像素信息卡片');
    console.log('3. 查看地理排行榜页面');
    console.log('4. 测试API接口: /api/geographic/*');
    
  } catch (error) {
    console.error('❌ 创建演示数据失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    process.exit(0);
  }
}

// 运行演示数据创建
createDemoData();
