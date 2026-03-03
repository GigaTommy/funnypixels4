// 测试成就解锁通知
const { db: knex } = require('./src/config/database');
const Achievement = require('./src/models/Achievement');
const NotificationController = require('./src/controllers/notificationController');

async function testAchievementNotification() {
    try {
        console.log('🧪 测试成就解锁通知\n');

        // 1. 获取一个测试用户
        const testUser = await knex('users').first('id', 'username');

        if (!testUser) {
            console.log('❌ 未找到测试用户，请先创建用户');
            process.exit(1);
        }

        console.log(`📋 测试用户: ${testUser.username} (ID: ${testUser.id})`);

        // 2. 查找一个成就
        const achievement = await knex('achievements')
            .where('is_active', true)
            .first();

        if (!achievement) {
            console.log('❌ 未找到成就，请先创建成就');
            process.exit(1);
        }

        console.log(`🏆 测试成就: ${achievement.name} (ID: ${achievement.id})`);

        // 3. 清除该用户的该成就记录（如果存在）
        await knex('user_achievements')
            .where({
                user_id: testUser.id,
                achievement_id: achievement.id
            })
            .delete();

        console.log('\n🔄 执行成就解锁...');

        // 4. 调用 completeAchievement 触发通知
        await Achievement.completeAchievement(testUser.id, achievement.id);

        console.log('✅ 成就解锁完成');

        // 5. 等待1秒让通知创建
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 6. 检查是否创建了通知
        const notification = await knex('notifications')
            .where({
                user_id: testUser.id,
                type: 'achievement'
            })
            .orderBy('created_at', 'desc')
            .first();

        if (notification) {
            console.log('\n✅ 通知创建成功！');
            console.log(`   ID: ${notification.id}`);
            console.log(`   标题: ${notification.title}`);
            console.log(`   内容: ${notification.message}`);
            console.log(`   类型: ${notification.type}`);
            console.log(`   已读: ${notification.is_read ? '是' : '否'}`);
            console.log(`   创建时间: ${notification.created_at}`);
        } else {
            console.log('\n❌ 未找到通知记录');
            console.log('   可能的原因:');
            console.log('   1. NotificationController 未正确导入');
            console.log('   2. 通知创建过程中出错');
        }

        // 7. 查看所有该用户的通知
        const allNotifications = await knex('notifications')
            .where('user_id', testUser.id)
            .orderBy('created_at', 'desc');

        console.log(`\n📊 该用户共有 ${allNotifications.length} 条通知`);

        process.exit(0);

    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

testAchievementNotification();
