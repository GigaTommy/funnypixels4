#!/usr/bin/env node
/**
 * 在当前用户位置附近批量生成测试漂流瓶
 * 位置：23.1335° N, 113.2924° E
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');
const crypto = require('crypto');

// 当前位置（用户实际位置）
const CURRENT_LOCATION = {
    lat: 23.1335,
    lng: 113.2924,
    name: '广州天河',
    city: '广州市',
    country: '中国'
};

let TEST_USER_ID = null;

function generateBottleId() {
    return 'bottle_' + crypto.randomBytes(12).toString('hex');
}

function generateRandomLocation(centerLat, centerLng, radiusMeters) {
    const latOffset = (Math.random() - 0.5) * 2 * (radiusMeters / 111000);
    const lngOffset = (Math.random() - 0.5) * 2 * (radiusMeters / (111000 * Math.cos(centerLat * Math.PI / 180)));

    return {
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
    };
}

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

function generateTestMessage(index) {
    const messages = [
        '你好！来自广州的漂流瓶🌊',
        '天河区的朋友们好呀！✨',
        '希望遇到有缘人💫',
        '第一次扔漂流瓶🍾',
        '广州欢迎你！🏙️',
        '漂向远方🌍',
        '看到请回复💌',
        '祝你快乐！😊',
        '交个朋友吧🤝',
        '记录美好📸'
    ];

    return messages[index % messages.length];
}

async function getTestUserId() {
    try {
        const adminUser = await db('users')
            .where('email', 'like', '%admin%')
            .orWhere('username', 'like', '%admin%')
            .first();

        if (adminUser) {
            return adminUser.id;
        }

        const firstUser = await db('users')
            .orderBy('created_at', 'asc')
            .first();

        if (firstUser) {
            return firstUser.id;
        }

        throw new Error('未找到可用的测试用户');
    } catch (error) {
        logger.error('获取测试用户失败:', error);
        throw error;
    }
}

async function createTestBottle(userId, index) {
    const trx = await db.transaction();

    try {
        const bottleId = generateBottleId();
        const location = generateRandomLocation(CURRENT_LOCATION.lat, CURRENT_LOCATION.lng, 300);
        const pixelSnapshot = generatePixelSnapshot();
        const message = generateTestMessage(index);

        const directionAngle = Math.random() * 360;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const bottleData = {
            bottle_id: bottleId,
            owner_id: null,
            original_owner_id: userId,
            content: message,
            pixel_snapshot: JSON.stringify(pixelSnapshot),
            current_lat: location.lat,
            current_lng: location.lng,
            origin_lat: location.lat,
            origin_lng: location.lng,
            current_city: CURRENT_LOCATION.city,
            current_country: CURRENT_LOCATION.country,
            origin_city: CURRENT_LOCATION.city,
            origin_country: CURRENT_LOCATION.country,
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

        const user = await trx('users').where({ id: userId }).first();

        await trx('drift_bottle_messages').insert({
            bottle_id: bottleId,
            author_id: userId,
            message: message.substring(0, 50),
            author_name: user?.username || '测试用户',
            author_avatar: user?.avatar || user?.avatar_url || null,
            sequence_number: 0,
            station_number: 0
        });

        await trx('journey_cards').insert({
            bottle_id: bottleId,
            participant_id: userId,
            participant_role: 'creator',
            station_number: 0,
            city: CURRENT_LOCATION.city,
            country: CURRENT_LOCATION.country,
            message: message.substring(0, 50),
            distance_from_prev: 0,
            cumulative_distance: 0
        });

        await trx('drift_bottle_history').insert({
            bottle_id: bottleId,
            user_id: userId,
            action: 'throw',
            lat: location.lat,
            lng: location.lng,
            city: CURRENT_LOCATION.city,
            country: CURRENT_LOCATION.country,
            message: message
        });

        await trx.commit();

        console.log(`✅ [${index + 1}/15] 创建漂流瓶成功: ${bottleId}`);
        console.log(`   📍 位置: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        console.log(`   💬 留言: ${message}\n`);

        return bottle;
    } catch (error) {
        await trx.rollback();
        console.error(`❌ [${index + 1}/15] 创建漂流瓶失败:`, error.message);
        throw error;
    }
}

async function generateTestBottles() {
    console.log('🍾 开始在当前位置附近生成测试漂流瓶...\n');
    console.log(`📍 中心位置: ${CURRENT_LOCATION.name}`);
    console.log(`   坐标: ${CURRENT_LOCATION.lat}° N, ${CURRENT_LOCATION.lng}° E`);
    console.log(`   生成范围: 半径300米\n`);
    console.log('='.repeat(60) + '\n');

    try {
        TEST_USER_ID = await getTestUserId();
        const user = await db('users').where('id', TEST_USER_ID).first();
        console.log(`👤 使用测试用户: ${user.username} (${TEST_USER_ID})\n`);

        const bottles = [];
        for (let i = 0; i < 15; i++) {
            const bottle = await createTestBottle(TEST_USER_ID, i);
            bottles.push(bottle);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('='.repeat(60));
        console.log(`\n✅ 成功生成 ${bottles.length} 个测试漂流瓶！\n`);

        const activeBottles = await db('drift_bottles')
            .where('is_active', true)
            .where('is_sunk', false)
            .whereNull('owner_id')
            .whereBetween('current_lat', [CURRENT_LOCATION.lat - 0.01, CURRENT_LOCATION.lat + 0.01])
            .whereBetween('current_lng', [CURRENT_LOCATION.lng - 0.01, CURRENT_LOCATION.lng + 0.01])
            .count('* as count')
            .first();

        console.log(`📊 当前位置附近现有活跃漂流瓶: ${activeBottles.count} 个`);
        console.log(`\n💡 提示:`);
        console.log(`   - 在APP中查看地图，应该能看到附近的漂流瓶`);
        console.log(`   - 拾取距离: 100米以内\n`);

    } catch (error) {
        console.error('\n❌ 生成测试漂流瓶失败:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

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
