// 测试通知系统
const { db: knex } = require('./src/config/database');

async function testNotifications() {
    try {
        console.log('📊 通知系统测试\n');

        // 1. 检查通知表
        const totalCount = await knex('notifications').count('* as count').first();
        console.log(`✅ 通知总数: ${totalCount.count}`);

        // 2. 按类型统计
        const typeStats = await knex('notifications')
            .select('type')
            .count('* as count')
            .groupBy('type')
            .orderBy('count', 'desc');

        console.log('\n📋 通知类型统计:');
        typeStats.forEach(stat => {
            console.log(`   ${stat.type}: ${stat.count}`);
        });

        // 3. 最近10条通知
        const recentNotifications = await knex('notifications')
            .select('id', 'type', 'title', 'is_read', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(10);

        console.log('\n📬 最近10条通知:');
        recentNotifications.forEach(notif => {
            const readStatus = notif.is_read ? '✓' : '○';
            console.log(`   ${readStatus} [${notif.type}] ${notif.title}`);
            console.log(`     时间: ${notif.created_at}`);
        });

        // 4. 未读通知统计
        const unreadStats = await knex('notifications')
            .where('is_read', false)
            .select('type')
            .count('* as count')
            .groupBy('type');

        console.log('\n🔔 未读通知统计:');
        if (unreadStats.length === 0) {
            console.log('   无未读通知');
        } else {
            unreadStats.forEach(stat => {
                console.log(`   ${stat.type}: ${stat.count}`);
            });
        }

        // 5. 检查通知表结构
        const columns = await knex('notifications').columnInfo();
        console.log('\n📐 通知表字段:');
        Object.keys(columns).forEach(col => {
            console.log(`   - ${col} (${columns[col].type})`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testNotifications();
