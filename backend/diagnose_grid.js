/**
 * 诊断特定格子的地理信息一致性问题
 */
const { db } = require('./src/config/database');

async function diagnoseGrid(gridId) {
    try {
        console.log(`🔍 正在诊断格子: ${gridId}\n`);

        // 1. 检查 pixels 表
        const pixel = await db('pixels')
            .where('grid_id', gridId)
            .first();

        if (!pixel) {
            console.log('❌ 在 pixels 表中未找到该格子');
        } else {
            console.log('✅ pixels 表数据:');
            console.log(JSON.stringify({
                id: pixel.id,
                grid_id: pixel.grid_id,
                city: pixel.city,
                province: pixel.province,
                geocoded: pixel.geocoded,
                created_at: pixel.created_at,
                updated_at: pixel.updated_at
            }, null, 2));
        }

        // 2. 检查 pixels_history 表
        console.log('\n🔍 检查 pixels_history 记录:');
        const historyRecords = await db('pixels_history')
            .where('grid_id', gridId)
            .orderBy('created_at', 'desc')
            .limit(10);

        if (historyRecords.length === 0) {
            console.log('❌ 在 pixels_history 表中未找到记录');
        } else {
            console.log(`✅ 找到 ${historyRecords.length} 条历史记录 (取最新10条):`);
            historyRecords.forEach((rec, idx) => {
                console.log(`\n记录 #${idx + 1}:`);
                console.log(JSON.stringify({
                    id: rec.id,
                    user_id: rec.user_id,
                    city: rec.city,
                    province: rec.province,
                    geocoded: rec.geocoded,
                    history_date: rec.history_date,
                    created_at: rec.created_at
                }, null, 2));
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ 诊断过程中出错:', error);
        process.exit(1);
    }
}

const targetGridId = process.argv[2] || 'grid_2980656_1144434';
diagnoseGrid(targetGridId);
