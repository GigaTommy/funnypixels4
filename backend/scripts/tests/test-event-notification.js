// 测试活动通知
const { db: knex } = require('./src/config/database');
const EventService = require('./src/services/eventService');

async function testEventNotification() {
    try {
        console.log('🧪 测试活动通知\n');

        // 1. 创建一个测试活动（已结束）
        const testEvent = {
            title: '测试活动 - 通知验证',
            type: 'leaderboard',
            status: 'ended',  // 已结束
            start_time: new Date(Date.now() - 7200000),  // 2小时前开始
            end_time: new Date(Date.now() - 3600000),  // 1小时前结束
            boundary: {
                type: 'Polygon',
                coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
            },
            config: {
                rewards: {
                    rankingRewards: [
                        {
                            rank_min: 1,
                            rank_max: 3,
                            target: 'alliance_members',
                            rewards: {
                                points: 500,
                                pixels: 100,
                                exclusiveFlag: 'test_flag_id'
                            }
                        }
                    ]
                }
            }
        };

        console.log('1️⃣ 创建测试活动...');
        const eventService = EventService;

        // 直接插入数据库（绕过服务层验证）
        const [event] = await knex('events').insert(testEvent).returning('*');
        console.log(`✅ 活动创建成功: ${event.title} (ID: ${event.id})`);

        // 2. 创建测试参与记录
        const testUserId = 'fe89a000-5f45-4118-aa99-46e6985bc519'; // testuser

        console.log('\n2️⃣ 创建活动参与记录...');
        await knex('event_pixel_logs').insert({
            event_id: event.id,
            user_id: testUserId,
            pixel_id: 'test_grid_1',
            alliance_id: null,
            created_at: new Date()
        });
        console.log('✅ 参与记录创建成功');

        // 3. 模拟活动结束通知
        console.log('\n3️⃣ 触发活动结束通知...');
        await eventService.notifyEventEnded(event);

        // 4. 检查通知
        const notifications = await knex('notifications')
            .where('type', 'event_ended')
            .orderBy('created_at', 'desc')
            .limit(5);

        console.log(`\n📬 活动结束通知数量: ${notifications.length}`);
        if (notifications.length > 0) {
            console.log('\n最新通知:');
            notifications.forEach(notif => {
                console.log(`   ✓ ${notif.title}`);
                console.log(`     内容: ${notif.message}`);
                console.log(`     用户: ${notif.user_id}`);
                console.log(`     数据: ${JSON.stringify(notif.data || {})}`);
            });
        }

        // 5. 模拟奖励发放
        console.log('\n4️⃣ 测试奖励发放通知...');
        const rewards = {
            points: 500,
            pixels: 100
        };
        const rank = 1;

        await eventService.giveUserReward(testUserId, rewards, event, rank);

        // 6. 检查奖励通知
        const rewardNotifications = await knex('notifications')
            .where('type', 'event_reward')
            .orderBy('created_at', 'desc')
            .limit(5);

        console.log(`\n📬 活动奖励通知数量: ${rewardNotifications.length}`);
        if (rewardNotifications.length > 0) {
            console.log('\n最新奖励通知:');
            rewardNotifications.forEach(notif => {
                console.log(`   ✓ ${notif.title}`);
                console.log(`     内容: ${notif.message}`);
                console.log(`     用户: ${notif.user_id}`);
                console.log(`     数据: ${JSON.stringify(notif.data || {})}`);
            });
        }

        // 7. 清理测试数据
        console.log('\n5️⃣ 清理测试数据...');
        await knex('event_pixel_logs').where('event_id', event.id).delete();
        await knex('events').where('id', event.id).delete();
        console.log('✅ 清理完成');

        // 8. 统计所有通知
        const allNotifications = await knex('notifications')
            .select('type')
            .count('* as count')
            .groupBy('type');

        console.log('\n📊 通知类型统计:');
        allNotifications.forEach(stat => {
            console.log(`   ${stat.type}: ${stat.count}`);
        });

        console.log('\n✅ 活动通知测试完成！');
        process.exit(0);

    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

testEventNotification();
