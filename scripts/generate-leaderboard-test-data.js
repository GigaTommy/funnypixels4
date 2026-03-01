#!/usr/bin/env node
'use strict';

/**
 * 生成排行榜测试数据
 * 为排行榜功能添加测试数据，确保界面展示正常
 */

// 设置环境变量
process.env.NODE_ENV = 'development';
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../backend/src/config/database');

// 测试数据配置
const TEST_USERS = [
  { username: 'pixel_master', display_name: '像素大师', email: 'pixel_master@test.com' },
  { username: 'map_conqueror', display_name: '地图征服者', email: 'map_conqueror@test.com' },
  { username: 'pixel_hunter', display_name: '像素猎人', email: 'pixel_hunter@test.com' },
  { username: 'map_explorer', display_name: '地图探索者', email: 'map_explorer@test.com' },
  { username: 'pixel_artist', display_name: '像素艺术家', email: 'pixel_artist@test.com' },
  { username: 'pixel_warrior', display_name: '像素战士', email: 'pixel_warrior@test.com' },
  { username: 'map_builder', display_name: '地图建造者', email: 'map_builder@test.com' },
  { username: 'pixel_creator', display_name: '像素创造者', email: 'pixel_creator@test.com' },
  { username: 'map_designer', display_name: '地图设计师', email: 'map_designer@test.com' },
  { username: 'pixel_legend', display_name: '像素传奇', email: 'pixel_legend@test.com' }
];

const TEST_ALLIANCES = [
  { name: '蓝色联盟', flag: '🔵', color: '#3B82F6', pattern_id: 'blue_alliance_pattern' },
  { name: '红色军团', flag: '🔴', color: '#EF4444', pattern_id: 'red_alliance_pattern' },
  { name: '绿色战队', flag: '🟢', color: '#10B981', pattern_id: 'green_alliance_pattern' },
  { name: '黄色联盟', flag: '🟡', color: '#F59E0B', pattern_id: 'yellow_alliance_pattern' },
  { name: '紫色军团', flag: '🟣', color: '#8B5CF6', pattern_id: 'purple_alliance_pattern' }
];

const TEST_REGIONS = [
  { name: '中国', flag: '🇨🇳', color: '#DC2626', center_lat: 39.9042, center_lng: 116.4074, radius: 1000000 },
  { name: '美国', flag: '🇺🇸', color: '#1D4ED8', center_lat: 39.8283, center_lng: -98.5795, radius: 2000000 },
  { name: '日本', flag: '🇯🇵', color: '#059669', center_lat: 36.2048, center_lng: 138.2529, radius: 500000 },
  { name: '韩国', flag: '🇰🇷', color: '#7C3AED', center_lat: 35.9078, center_lng: 127.7669, radius: 300000 },
  { name: '德国', flag: '🇩🇪', color: '#DC2626', center_lat: 51.1657, center_lng: 10.4515, radius: 800000 }
];

/**
 * 创建测试用户
 */
async function createTestUsers() {
  console.log('👥 创建测试用户...');
  
  for (const userData of TEST_USERS) {
    try {
      // 检查用户是否已存在
      const existingUser = await db('users').where('username', userData.username).first();
      if (existingUser) {
        console.log(`  ⚠️ 用户 ${userData.username} 已存在，跳过创建`);
        continue;
      }
      
      // 创建用户
      const [userId] = await db('users').insert({
        username: userData.username,
        display_name: userData.display_name,
        email: userData.email,
        password_hash: '$2b$10$dummy.hash.for.test.users', // 测试用户使用虚拟密码哈希
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      console.log(`  ✅ 创建用户: ${userData.username} (${userId})`);
    } catch (error) {
      console.error(`  ❌ 创建用户 ${userData.username} 失败:`, error.message);
    }
  }
}

/**
 * 创建测试联盟
 */
async function createTestAlliances() {
  console.log('\n🏴 创建测试联盟...');
  
  for (const allianceData of TEST_ALLIANCES) {
    try {
      // 检查联盟是否已存在
      const existingAlliance = await db('alliances').where('name', allianceData.name).first();
      if (existingAlliance) {
        console.log(`  ⚠️ 联盟 ${allianceData.name} 已存在，跳过创建`);
        continue;
      }
      
      // 获取一个随机用户作为联盟领袖
      const users = await db('users').where('is_active', true).limit(1);
      if (users.length === 0) {
        console.log(`  ❌ 没有可用用户创建联盟 ${allianceData.name}`);
        continue;
      }
      
      const [allianceId] = await db('alliances').insert({
        name: allianceData.name,
        flag: allianceData.flag,
        color: allianceData.color,
        flag_pattern_id: allianceData.pattern_id,
        leader_id: users[0].id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      console.log(`  ✅ 创建联盟: ${allianceData.name} (${allianceId})`);
    } catch (error) {
      console.error(`  ❌ 创建联盟 ${allianceData.name} 失败:`, error.message);
    }
  }
}

/**
 * 创建测试地区
 */
async function createTestRegions() {
  console.log('\n🌍 创建测试地区...');
  
  for (const regionData of TEST_REGIONS) {
    try {
      // 检查地区是否已存在
      const existingRegion = await db('regions').where('name', regionData.name).first();
      if (existingRegion) {
        console.log(`  ⚠️ 地区 ${regionData.name} 已存在，跳过创建`);
        continue;
      }
      
      const [regionId] = await db('regions').insert({
        name: regionData.name,
        flag: regionData.flag,
        color: regionData.color,
        center_lat: regionData.center_lat,
        center_lng: regionData.center_lng,
        radius: regionData.radius,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      console.log(`  ✅ 创建地区: ${regionData.name} (${regionId})`);
    } catch (error) {
      console.error(`  ❌ 创建地区 ${regionData.name} 失败:`, error.message);
    }
  }
}

/**
 * 分配用户到联盟
 */
async function assignUsersToAlliances() {
  console.log('\n👥 分配用户到联盟...');
  
  try {
    // 获取所有用户和联盟
    const users = await db('users').where('is_active', true);
    const alliances = await db('alliances').where('is_active', true);
    
    if (users.length === 0 || alliances.length === 0) {
      console.log('  ⚠️ 没有用户或联盟，跳过分配');
      return;
    }
    
    // 为每个用户分配一个联盟
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const alliance = alliances[i % alliances.length];
      
      // 检查是否已经是成员
      const existingMember = await db('alliance_members')
        .where('user_id', user.id)
        .where('alliance_id', alliance.id)
        .first();
      
      if (existingMember) {
        console.log(`  ⚠️ 用户 ${user.username} 已经是联盟 ${alliance.name} 的成员`);
        continue;
      }
      
      await db('alliance_members').insert({
        user_id: user.id,
        alliance_id: alliance.id,
        role: 'member',
        joined_at: new Date(),
        created_at: new Date()
      });
      
      console.log(`  ✅ 用户 ${user.username} 加入联盟 ${alliance.name}`);
    }
  } catch (error) {
    console.error('  ❌ 分配用户到联盟失败:', error.message);
  }
}

/**
 * 生成测试像素数据
 */
async function generateTestPixels() {
  console.log('\n🎨 生成测试像素数据...');
  
  try {
    const users = await db('users').where('is_active', true);
    const alliances = await db('alliances').where('is_active', true);
    
    if (users.length === 0) {
      console.log('  ⚠️ 没有用户，跳过生成像素数据');
      return;
    }
    
    const pixelCount = 1000; // 生成1000个测试像素
    const pixels = [];
    
    for (let i = 0; i < pixelCount; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const alliance = alliances[Math.floor(Math.random() * alliances.length)];
      
      // 生成随机坐标（北京附近）
      const lat = 39.9 + (Math.random() - 0.5) * 0.1;
      const lng = 116.4 + (Math.random() - 0.5) * 0.1;
      
      // 生成随机颜色
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // 生成随机时间（过去30天内）
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30));
      
      pixels.push({
        user_id: user.id,
        lat: lat,
        lng: lng,
        color: color,
        grid_id: `test_${i}`,
        pattern_id: alliance.flag_pattern_id,
        pattern_anchor_x: 0,
        pattern_anchor_y: 0,
        pattern_rotation: 0,
        pattern_mirror: false,
        pixel_type: 'basic',
        created_at: createdAt,
        updated_at: createdAt
      });
    }
    
    // 批量插入像素数据
    await db('pixels').insert(pixels);
    console.log(`  ✅ 生成 ${pixelCount} 个测试像素`);
    
  } catch (error) {
    console.error('  ❌ 生成测试像素数据失败:', error.message);
  }
}

/**
 * 生成排行榜缓存数据
 */
async function generateLeaderboardCache() {
  console.log('\n📊 生成排行榜缓存数据...');
  
  try {
    const periods = ['daily', 'weekly', 'monthly', 'yearly'];
    const now = new Date();
    
    for (const period of periods) {
      console.log(`  📅 生成 ${period} 排行榜数据...`);
      
      // 计算时间范围
      let periodStart, periodEnd;
      switch (period) {
        case 'daily':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'weekly':
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay());
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'monthly':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'yearly':
          periodStart = new Date(now.getFullYear(), 0, 1);
          periodEnd = new Date(now.getFullYear() + 1, 0, 1);
          break;
      }
      
      // 生成个人排行榜数据
      await generatePersonalLeaderboard(period, periodStart, periodEnd);
      
      // 生成联盟排行榜数据
      await generateAllianceLeaderboard(period, periodStart, periodEnd);
      
      // 生成地区排行榜数据
      await generateRegionLeaderboard(period, periodStart, periodEnd);
    }
    
  } catch (error) {
    console.error('  ❌ 生成排行榜缓存数据失败:', error.message);
  }
}

/**
 * 生成个人排行榜数据
 */
async function generatePersonalLeaderboard(period, periodStart, periodEnd) {
  try {
    // 查询用户像素统计
    const userStats = await db('pixels')
      .select(
        'users.id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        db.raw('COUNT(pixels.id) as pixel_count')
      )
      .join('users', 'pixels.user_id', 'users.id')
      .where('users.is_active', true)
      .where('pixels.created_at', '>=', periodStart)
      .where('pixels.created_at', '<', periodEnd)
      .groupBy('users.id', 'users.username', 'users.display_name', 'users.avatar_url')
      .orderBy('pixel_count', 'desc')
      .limit(50);
    
    // 清除旧数据
    await db('leaderboard_personal')
      .where('period', period)
      .where('period_start', periodStart)
      .del();
    
    // 插入新数据
    const personalData = userStats.map((user, index) => ({
      user_id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      pixel_count: parseInt(user.pixel_count),
      rank: index + 1,
      period: period,
      period_start: periodStart,
      period_end: periodEnd,
      last_updated: new Date(),
      created_at: new Date()
    }));
    
    if (personalData.length > 0) {
      await db('leaderboard_personal').insert(personalData);
      console.log(`    ✅ 个人排行榜: ${personalData.length} 条记录`);
    }
    
  } catch (error) {
    console.error(`    ❌ 生成个人排行榜失败:`, error.message);
  }
}

/**
 * 生成联盟排行榜数据
 */
async function generateAllianceLeaderboard(period, periodStart, periodEnd) {
  try {
    // 查询联盟像素统计
    const allianceStats = await db('pixels')
      .select(
        'alliances.id',
        'alliances.name',
        'alliances.flag',
        'alliances.color',
        'alliances.flag_pattern_id',
        db.raw('COUNT(DISTINCT pixels.user_id) as member_count'),
        db.raw('COUNT(pixels.id) as total_pixels')
      )
      .join('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .where('alliances.is_active', true)
      .where('pixels.created_at', '>=', periodStart)
      .where('pixels.created_at', '<', periodEnd)
      .groupBy(
        'alliances.id',
        'alliances.name',
        'alliances.flag',
        'alliances.color',
        'alliances.flag_pattern_id'
      )
      .orderBy('total_pixels', 'desc')
      .limit(50);
    
    // 清除旧数据
    await db('leaderboard_alliance')
      .where('period', period)
      .where('period_start', periodStart)
      .del();
    
    // 插入新数据
    const allianceData = allianceStats.map((alliance, index) => ({
      alliance_id: alliance.id,
      alliance_name: alliance.name,
      alliance_flag: alliance.flag,
      pattern_id: alliance.flag_pattern_id,
      color: alliance.color,
      member_count: parseInt(alliance.member_count),
      total_pixels: parseInt(alliance.total_pixels),
      rank: index + 1,
      period: period,
      period_start: periodStart,
      period_end: periodEnd,
      last_updated: new Date(),
      created_at: new Date()
    }));
    
    if (allianceData.length > 0) {
      await db('leaderboard_alliance').insert(allianceData);
      console.log(`    ✅ 联盟排行榜: ${allianceData.length} 条记录`);
    }
    
  } catch (error) {
    console.error(`    ❌ 生成联盟排行榜失败:`, error.message);
  }
}

/**
 * 生成地区排行榜数据
 */
async function generateRegionLeaderboard(period, periodStart, periodEnd) {
  try {
    // 查询地区像素统计
    const regionStats = await db('regions')
      .select(
        'regions.id',
        'regions.name',
        'regions.flag',
        'regions.color',
        db.raw('COUNT(DISTINCT pixels.user_id) as user_count'),
        db.raw('COUNT(DISTINCT alliances.id) as alliance_count'),
        db.raw('COUNT(pixels.id) as total_pixels')
      )
      .leftJoin(
        db.raw(`
          pixels ON ST_DWithin(
            ST_SetSRID(ST_MakePoint(pixels.lng, pixels.lat), 4326),
            ST_SetSRID(ST_MakePoint(regions.center_lng, regions.center_lat), 4326),
            regions.radius
          ) AND pixels.created_at >= ? AND pixels.created_at < ?
        `, [periodStart, periodEnd])
      )
      .leftJoin('alliance_members', 'pixels.user_id', 'alliance_members.user_id')
      .leftJoin('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .where('regions.is_active', true)
      .groupBy('regions.id', 'regions.name', 'regions.flag', 'regions.color')
      .orderBy('total_pixels', 'desc')
      .limit(50);
    
    // 清除旧数据
    await db('leaderboard_region')
      .where('period', period)
      .where('period_start', periodStart)
      .del();
    
    // 插入新数据
    const regionData = regionStats.map((region, index) => ({
      region_id: region.id,
      region_name: region.name,
      region_flag: region.flag,
      color: region.color,
      user_count: parseInt(region.user_count),
      alliance_count: parseInt(region.alliance_count),
      total_pixels: parseInt(region.total_pixels),
      rank: index + 1,
      period: period,
      period_start: periodStart,
      period_end: periodEnd,
      last_updated: new Date(),
      created_at: new Date()
    }));
    
    if (regionData.length > 0) {
      await db('leaderboard_region').insert(regionData);
      console.log(`    ✅ 地区排行榜: ${regionData.length} 条记录`);
    }
    
  } catch (error) {
    console.error(`    ❌ 生成地区排行榜失败:`, error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始生成排行榜测试数据...\n');
  
  try {
    // 1. 创建测试用户
    await createTestUsers();
    
    // 2. 创建测试联盟
    await createTestAlliances();
    
    // 3. 创建测试地区
    await createTestRegions();
    
    // 4. 分配用户到联盟
    await assignUsersToAlliances();
    
    // 5. 生成测试像素数据
    await generateTestPixels();
    
    // 6. 生成排行榜缓存数据
    await generateLeaderboardCache();
    
    console.log('\n✅ 排行榜测试数据生成完成！');
    console.log('\n📊 数据统计:');
    
    // 显示数据统计
    const userCount = await db('users').where('is_active', true).count('* as count').first();
    const allianceCount = await db('alliances').where('is_active', true).count('* as count').first();
    const regionCount = await db('regions').where('is_active', true).count('* as count').first();
    const pixelCount = await db('pixels').count('* as count').first();
    const personalLeaderboardCount = await db('leaderboard_personal').count('* as count').first();
    const allianceLeaderboardCount = await db('leaderboard_alliance').count('* as count').first();
    const regionLeaderboardCount = await db('leaderboard_region').count('* as count').first();
    
    console.log(`  👥 用户数量: ${userCount.count}`);
    console.log(`  🏴 联盟数量: ${allianceCount.count}`);
    console.log(`  🌍 地区数量: ${regionCount.count}`);
    console.log(`  🎨 像素数量: ${pixelCount.count}`);
    console.log(`  📊 个人排行榜记录: ${personalLeaderboardCount.count}`);
    console.log(`  📊 联盟排行榜记录: ${allianceLeaderboardCount.count}`);
    console.log(`  📊 地区排行榜记录: ${regionLeaderboardCount.count}`);
    
  } catch (error) {
    console.error('❌ 生成测试数据失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行主函数
main();
