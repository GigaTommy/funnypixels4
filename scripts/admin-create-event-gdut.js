#!/usr/bin/env node

/**
 * 模拟管理后台操作创建活动
 * 通过调用后端 Admin API 创建活动，而非直接操作数据库
 *
 * Usage: node scripts/admin-create-event-gdut.js
 */

/**
 * NOTE: 此脚本需要从 backend 目录运行以访问依赖
 * 运行方式: cd backend && node ../scripts/admin-create-event-gdut.js
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// 管理后台 API 配置
const ADMIN_API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * 获取管理员 Token
 */
async function getAdminToken() {
    try {
        console.log('🔐 正在获取管理员 Token...');
        const response = await axios.post(`${ADMIN_API_BASE_URL}/auth/account-login`, {
            account: ADMIN_USERNAME,
            password: ADMIN_PASSWORD
        });

        if (response.data.error) {
            throw new Error(response.data.error);
        }

        if (!response.data.accessToken) {
            throw new Error('登录失败或未返回 accessToken');
        }

        console.log('✅ 管理员登录成功');
        return response.data.accessToken;
    } catch (error) {
        console.error('❌ 管理员登录失败:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 通过管理后台 API 创建活动
 */
async function createEventViaAdminAPI(token) {
    try {
        console.log('🎯 正在通过管理后台 API 创建活动...');

        // 活动数据（与管理后台表单提交一致）
        const eventData = {
            id: uuidv4(),
            title: '广工区庄像素大战',
            type: 'territory_control',
            status: 'published', // published: 可报名，活动未开始
            start_time: new Date(),
            end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
            banner_url: null,

            // GeoJSON 边界（圆形区域，半径 800米）
            boundary: {
                type: 'Polygon',
                coordinates: [
                    generateCircleCoordinates(23.1489, 113.3376, 800) // 广东工业大学东风路校区
                ]
            },

            // 活动配置
            config: {
                // 活动区域信息
                area: {
                    type: 'circle',
                    center: {
                        lat: 23.1489,
                        lng: 113.3376
                    },
                    radius: 800,
                    name: '广东工业大学东风路校区'
                },

                // 参与要求
                requirements: {
                    minLevel: 1,        // 最低等级
                    minAlliances: 2,    // 最少联盟数
                    minParticipants: 5  // 最少参与人数
                },

                // 活动规则
                rules: {
                    pixelScore: 1,       // 每个像素分值
                    maxAlliances: 10,    // 最多联盟数
                    minParticipants: 5   // 最少参与人数
                },

                // 奖励配置
                rewards: [
                    {
                        rank: 1,
                        type: 'coins',
                        amount: 1000,
                        description: '第一名奖励 1000 金币'
                    },
                    {
                        rank: 2,
                        type: 'coins',
                        amount: 500,
                        description: '第二名奖励 500 金币'
                    },
                    {
                        rank: 3,
                        type: 'coins',
                        amount: 300,
                        description: '第三名奖励 300 金币'
                    }
                ]
            },

            // 玩法说明（多语言）
            gameplay: {
                zh: {
                    objective: '在活动区域内绘制像素，占领尽可能多的领地！',
                    rules: [
                        '活动期间，在指定区域内绘制的像素将计入战绩',
                        '联盟成员共同协作，占领更多领地',
                        '活动结束时，占领像素最多的联盟获胜',
                        '前三名联盟的成员将获得丰厚奖励'
                    ],
                    tips: [
                        '💡 与联盟成员协作，制定战略',
                        '⚡ 优先占领关键区域',
                        '🛡️ 保护已占领的领地',
                        '📍 活动仅在指定区域内有效'
                    ]
                },
                en: {
                    objective: 'Draw pixels in the event area to claim as much territory as possible!',
                    rules: [
                        'Pixels drawn within the designated area during the event will count towards your score',
                        'Alliance members work together to claim more territory',
                        'The alliance with the most pixels at the end wins',
                        'Top 3 alliances will receive generous rewards'
                    ],
                    tips: [
                        '💡 Collaborate with alliance members and strategize',
                        '⚡ Prioritize capturing key areas',
                        '🛡️ Defend your claimed territory',
                        '📍 Activity only counts within the designated area'
                    ]
                },
                ja: {
                    objective: 'イベントエリア内にピクセルを描いて、できるだけ多くの領土を占領しよう！',
                    rules: [
                        'イベント期間中、指定エリア内に描いたピクセルがスコアにカウントされます',
                        'アライアンスメンバーと協力して、より多くの領土を占領',
                        'イベント終了時に最も多くのピクセルを持つアライアンスが勝利',
                        '上位3アライアンスのメンバーは豪華な報酬を獲得'
                    ],
                    tips: [
                        '💡 アライアンスメンバーと協力して戦略を立てる',
                        '⚡ 重要なエリアを優先的に占領',
                        '🛡️ 占領した領土を守る',
                        '📍 指定エリア内でのみ有効'
                    ]
                }
            }
        };

        // 调用管理后台 API
        const response = await axios.post(
            `${ADMIN_API_BASE_URL}/admin/events`,
            eventData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const eventResult = response.data.success ? response.data.data : response.data;

        if (response.data.error) {
            throw new Error(response.data.error);
        }

        console.log('✅ 活动创建成功！');
        console.log('📋 活动详情:');
        console.log(`   ID: ${eventResult.id}`);
        console.log(`   标题: ${eventResult.title}`);
        console.log(`   状态: ${eventResult.status}`);
        console.log(`   类型: ${eventResult.type}`);
        console.log(`   开始时间: ${eventResult.start_time}`);
        console.log(`   结束时间: ${eventResult.end_time}`);
        console.log('');
        console.log('🎮 您现在可以在 iOS 应用中看到此活动了！');
        console.log('   - 地图页面（如果在区庄附近）');
        console.log('   - 个人中心 → 赛事中心 → 活跃标签');

        return eventResult;
    } catch (error) {
        console.error('❌ 创建活动失败:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 生成圆形 GeoJSON 坐标
 * @param {number} lat - 中心纬度
 * @param {number} lng - 中心经度
 * @param {number} radiusMeters - 半径（米）
 * @returns {Array} GeoJSON 坐标数组
 */
function generateCircleCoordinates(lat, lng, radiusMeters) {
    const points = 64; // 圆形精度
    const earthRadius = 6371000; // 地球半径（米）
    const coords = [];

    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;

        // 计算偏移
        const dx = radiusMeters * Math.cos(angle);
        const dy = radiusMeters * Math.sin(angle);

        // 转换为经纬度偏移
        const deltaLat = (dy / earthRadius) * (180 / Math.PI);
        const deltaLng = (dx / (earthRadius * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);

        coords.push([
            lng + deltaLng,
            lat + deltaLat
        ]);
    }

    return coords;
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 开始通过管理后台 API 创建测试活动...\n');

    try {
        // 1. 获取管理员 Token
        const token = await getAdminToken();

        // 2. 创建活动
        const event = await createEventViaAdminAPI(token);

        console.log('\n✅ 所有操作完成！');
        console.log('');
        console.log('📱 测试建议:');
        console.log('   1. 打开 FunnyPixels iOS 应用');
        console.log('   2. 前往区庄地铁站（或使用 GPS 模拟）');
        console.log('   3. 查看地图页顶部是否出现活动横幅');
        console.log('   4. 或前往 个人中心 → 赛事中心 查看活动列表');
        console.log('');
        console.log('🎯 活动位置: 广东工业大学东风路校区');
        console.log('   坐标: 23.1489, 113.3376');
        console.log('   半径: 800米');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ 操作失败:', error.message);
        process.exit(1);
    }
}

// 执行主函数
if (require.main === module) {
    main();
}

module.exports = { createEventViaAdminAPI, getAdminToken };
