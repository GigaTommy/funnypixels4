const timelapseService = require('../src/services/timelapseService');
const { db } = require('../src/config/database');

async function testTimelapse() {
    console.log('🧪 开始测试延时摄影服务...');

    try {
        // 1. 查找一些历史数据以获取有效的范围
        const sampleHistory = await db('pixels_history').limit(10).orderBy('created_at', 'desc');

        if (sampleHistory.length === 0) {
            console.log('⚠️ 数据库中没有历史记录，无法测试。请先绘制一些像素。');
            process.exit(0);
        }

        const first = sampleHistory[0];
        const lat = parseFloat(first.latitude);
        const lng = parseFloat(first.longitude);
        const range = 0.005; // 扩大一点范围

        const options = {
            minLat: lat - range,
            maxLat: lat + range,
            minLng: lng - range,
            maxLng: lng + range,
            frameCount: 5,
            width: 400,
            height: 400
        };

        console.log('📊 测试参数:', options);

        const result = await timelapseService.generateFrames(options);

        if (result.success) {
            console.log('✅ 成功生成帧!');
            console.log('数量:', result.metadata.frameCount);
            console.log('第一帧预览 (前100字符):', result.frames[0].substring(0, 100));
        } else {
            console.log('❌ 生成失败:', result.message);
        }

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        await db.destroy();
        process.exit(0);
    }
}

testTimelapse();
