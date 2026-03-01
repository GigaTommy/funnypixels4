#!/usr/bin/env node
/**
 * 在区庄地铁站附近批量生成测试漂流瓶
 * 
 * 区庄地铁站坐标：23.1415° N, 113.2898° E
 * 生成范围：以区庄站为中心，半径500米内随机分布
 * 
 * 使用方法：
 *   node backend/scripts/generate-test-bottles-quzhuang.js
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');
const crypto = require('crypto');

// 区庄地铁站坐标
const QUZHUANG_STATION = {
    lat: 23.1415,
    lng: 113.2898,
    name: '区庄地铁站',
    city: '广州市',
    country: '中国'
};

// 测试用户ID（使用admin用户或第一个用户）
let TEST_USER_ID = null;

// 生成随机漂流瓶ID
function generateBottleId() {
    return 'bottle_' + crypto.randomBytes(12).toString('hex');
}

// 在指定位置附近生成随机坐标（半径单位：米）
function generateRandomLocation(centerLat, centerLng, radiusMeters) {
    // 1度纬度约 111km
    const latOffset = (Math.random() - 0.5) * 2 * (radiusMeters / 111000);
    // 1度经度约 111km * cos(纬度)
    const lngOffset = (Math.random() - 0.5) * 2 * (radiusMeters / (111000 * Math.cos(centerLat * Math.PI / 180)));
    
    return {
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
    };
}

// 生成5x5像素快照
function generatePixelSnapshot() {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33F3', '#33FFF3', '#FFD700', '#FFA500'];
    const snapshot = [];
    
    for (let i = 0; i < 5; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
            row.push(colors[Math.floor(Math.random() * colors.length)]);
        }
        snapshot.push(row);
    }
    
    return snapshot;
}

// 生成测试留言
function generateTestMessage(index) {
    const messages = [
        '你好！我是来自广州区庄的漂流瓶🌊',
        '今天天气真好，在地铁站附近散步✨',
        '希望能遇到有趣的人！💫',
        '这是我第一次放漂流瓶🍾',
        '区庄见证了多少人的来来往往🚇',
        '愿这个瓶子能漂到远方🌍',
        '如果你看到这条消息，请回复我！💌',
        '祝你今天心情愉快！😊',
        '让我们成为朋友吧！🤝',
        '记录这个美好的瞬间📸'
    ];
    
    return messages[index % messages.length];
}

async function getTestUserId() {
    try {
        // 尝试获取admin用户
        const adminUser = await db('users')
            .where('email', 'like', '%admin%')
            .orWhere('username', 'like', '%admin%')
            .first();
        
        if (adminUser) {
            return adminUser.id;
        }
        
        // 否则获取第一个用户
        const firstUser = await db('users')
            .orderBy('created_at', 'asc')
            .first();
        
        if (firstUser) {
            return firstUser.id;
        }
        
        throw new Error('未找到可用的测试用户，请先创建用户');
    } catch (error) {
        logger.error('获取测试用户失败:', error);
        throw error;
    }
}

async function createTestBottle(userId, index) {
    const trx = await db.transaction();
    
    try {
        const bottleId = generateBottleId();
        const location = generateRandomLocation(QUZHUANG_STATION.lat, QUZHUANG_STATION.lng, 500);
        const pixelSnapshot = generatePixelSnapshot();
        const message = generateTestMessage(index);
        
        // 随机初始漂流方向
        const directionAngle = Math.random() * 360;
        
        // 计算过期时间(30天)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const bottleData = {
            bottle_id: bottleId,
            owner_id: null,  // 无主状态，可以被拾取
            original_owner_id: userId,
            content: message,
            pixel_snapshot: JSON.stringify(pixelSnapshot),
            current_lat: location.lat,
            current_lng: location.lng,
            origin_lat: location.lat,
            origin_lng: location.lng,
            current_city: QUZHUANG_STATION.city,
            current_country: QUZHUANG_STATION.country,
            origin_city: QUZHUANG_STATION.city,
            origin_country: QUZHUANG_STATION.country,
            total_distance: 0,
            pickup_count: 0,
            message_count: 1,
            direction_angle: directionAngle,
            open_count: 0,
            max_openers: 5,
            is_sunk: false,
            sunk_at: null,
            last_drift_time: new Date(),
            expires_at: expiresAt,
            is_active: true
        };
        
        const [bottle] = await trx('drift_bottles').insert(bottleData).returning('*');
        
        // 获取用户信息
        const user = await trx('users').where({ id: userId }).first();
        
        // 创建者留言 (station_number=0)
        await trx('drift_bottle_messages').insert({
            bottle_id: bottleId,
            author_id: userId,
            message: message.substring(0, 50),
            author_name: user?.username || '测试用户',
            author_avatar: user?.avatar || user?.avatar_url || null,
            sequence_number: 0,
            station_number: 0
        });
        
        // 创建者旅途卡片 (station_number=0)
        await trx('journey_cards').insert({
            bottle_id: bottleId,
            participant_id: userId,
            participant_role: 'creator',
            station_number: 0,
            city: QUZHUANG_STATION.city,
            country: QUZHUANG_STATION.country,
            message: message.substring(0, 50),
            distance_from_prev: 0,
            cumulative_distance: 0
        });
        
        // 记录历史（简化版，不使用DriftBottle.recordHistory）
        await trx('drift_bottle_history').insert({
            bottle_id: bottleId,
            user_id: userId,
            action: 'throw',
            lat: location.lat,
            lng: location.lng,
            city: QUZHUANG_STATION.city,
            country: QUZHUANG_STATION.country,
            message: message
        });
        
        await trx.commit();
        
        console.log(`✅ [${index + 1}/10] 创建漂流瓶成功: ${bottleId}`);
        console.log(`   📍 位置: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        console.log(`   💬 留言: ${message}`);
        console.log(`   🎨 像素快照: ${pixelSnapshot.length}x${pixelSnapshot[0].length}\n`);
        
        return bottle;
    } catch (error) {
        await trx.rollback();
        console.error(`❌ [${index + 1}/10] 创建漂流瓶失败:`, error.message);
        throw error;
    }
}

async function generateTestBottles() {
    console.log('🍾 开始在区庄地铁站附近生成测试漂流瓶...\n');
    console.log(`📍 中心位置: ${QUZHUANG_STATION.name}`);
    console.log(`   坐标: ${QUZHUANG_STATION.lat}° N, ${QUZHUANG_STATION.lng}° E`);
    console.log(`   生成范围: 半径500米\n`);
    
    try {
        // 获取测试用户ID
        TEST_USER_ID = await getTestUserId();
        const user = await db('users').where('id', TEST_USER_ID).first();
        console.log(`👤 使用测试用户: ${user.username} (${TEST_USER_ID})\n`);
        console.log('='.repeat(60) + '\n');
        
        // 批量创建10个漂流瓶
        const bottles = [];
        for (let i = 0; i < 10; i++) {
            const bottle = await createTestBottle(TEST_USER_ID, i);
            bottles.push(bottle);
            
            // 避免过快创建，增加时间戳差异
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('='.repeat(60));
        console.log(`\n✅ 成功生成 ${bottles.length} 个测试漂流瓶！\n`);
        
        // 查询验证
        const activeBottles = await db('drift_bottles')
            .where('is_active', true)
            .where('is_sunk', false)
            .whereNull('owner_id')
            .whereBetween('current_lat', [QUZHUANG_STATION.lat - 0.01, QUZHUANG_STATION.lat + 0.01])
            .whereBetween('current_lng', [QUZHUANG_STATION.lng - 0.01, QUZHUANG_STATION.lng + 0.01])
            .count('* as count')
            .first();
        
        console.log(`📊 区庄地铁站附近现有活跃漂流瓶: ${activeBottles.count} 个`);
        console.log(`\n💡 提示:`);
        console.log(`   - 在APP中前往区庄地铁站附近（23.1415° N, 113.2898° E）`);
        console.log(`   - 打开漂流瓶功能，应该能看到附近的漂流瓶`);
        console.log(`   - 拾取距离: 100米以内\n`);
        
    } catch (error) {
        console.error('\n❌ 生成测试漂流瓶失败:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

// 执行脚本
if (require.main === module) {
    generateTestBottles()
        .then(() => {
            console.log('🎉 脚本执行完成！\n');
            process.exit(0);
        })
        .catch(err => {
            console.error('💥 脚本执行失败:', err);
            process.exit(1);
        });
}

module.exports = { generateTestBottles };
