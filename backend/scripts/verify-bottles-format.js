#!/usr/bin/env node
/**
 * 验证漂流瓶数据格式
 */

const { db } = require('../src/config/database');

async function verifyBottles() {
    try {
        console.log('🔍 查询广发银行大厦附近的漂流瓶...\n');

        const bottles = await db('drift_bottles')
            .whereBetween('current_lat', [23.13, 23.14])
            .whereBetween('current_lng', [113.28, 113.29])
            .where('is_active', true)
            .limit(3)
            .select('bottle_id', 'current_lat', 'current_lng', 'content');

        console.log(`📊 找到 ${bottles.length} 个漂流瓶\n`);

        bottles.forEach((bottle, index) => {
            console.log(`瓶子 ${index + 1}:`);
            console.log(`  ID: ${bottle.bottle_id}`);
            console.log(`  纬度: ${bottle.current_lat} (类型: ${typeof bottle.current_lat})`);
            console.log(`  经度: ${bottle.current_lng} (类型: ${typeof bottle.current_lng})`);
            console.log(`  内容: ${bottle.content.substring(0, 30)}...`);
            console.log();
        });

        // 检查类型
        if (bottles.length > 0) {
            const firstBottle = bottles[0];
            if (typeof firstBottle.current_lat === 'string') {
                console.log('⚠️  警告: current_lat 是字符串类型！');
                console.log('   后端需要使用 parseFloat() 转换');
            } else {
                console.log('✅ current_lat 是数字类型 (正确)');
            }

            if (typeof firstBottle.current_lng === 'string') {
                console.log('⚠️  警告: current_lng 是字符串类型！');
                console.log('   后端需要使用 parseFloat() 转换');
            } else {
                console.log('✅ current_lng 是数字类型 (正确)');
            }
        }

    } catch (error) {
        console.error('❌ 查询失败:', error);
    } finally {
        await db.destroy();
    }
}

if (require.main === module) {
    verifyBottles()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
