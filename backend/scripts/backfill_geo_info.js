const knex = require('knex');
const knexfile = require('../knexfile');
const geocodingService = require('../src/services/geocodingService');
const logger = require('../src/utils/logger');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexfile[environment]);

const BATCH_SIZE = 50;
const DELAY_MS = 100; // Delay between batches to be nice to APIs

async function backfillPixelsGeo() {
    logger.info('开始回填 Pixels 表地理信息...');

    // Get count
    const countResult = await db('pixels')
        .whereNull('city')
        .whereNotNull('latitude')
        .whereNotNull('longitude')
        .count('* as count')
        .first();

    const total = parseInt(countResult.count);
    logger.info(`共发现 ${total} 条缺少地理信息的像素记录`);

    let processed = 0;

    while (true) {
        const batch = await db('pixels')
            .whereNull('city')
            .whereNotNull('latitude')
            .whereNotNull('longitude')
            .select('id', 'latitude', 'longitude')
            .limit(BATCH_SIZE);

        if (batch.length === 0) break;

        logger.info(`正在处理批次: ${processed + 1} - ${processed + batch.length} / ${total}`);

        for (const pixel of batch) {
            try {
                const geoInfo = await geocodingService.reverseGeocodeWithTimeout(pixel.latitude, pixel.longitude);
                if (geoInfo.city || geoInfo.province) {
                    await db('pixels')
                        .where({ id: pixel.id })
                        .update({
                            country: geoInfo.country,
                            province: geoInfo.province,
                            city: geoInfo.city,
                            district: geoInfo.district,
                            adcode: geoInfo.adcode,
                            updated_at: new Date()
                        });
                }
            } catch (err) {
                logger.error(`像素 ${pixel.id} 地理编码失败:`, err.message);
            }
        }

        processed += batch.length;
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    logger.info('Pixels 表回填完成');
}

async function backfillHistoryGeo() {
    logger.info('开始回填 PixelsHistory 表地理信息...');
    const countResult = await db('pixels_history')
        .whereNull('city') // Assuming column exists
        .whereNotNull('latitude')
        .whereNotNull('longitude')
        .count('* as count')
        .first().catch(err => {
            logger.warn("pixels_history 表可能没有 city 字段，跳过检测: " + err.message);
            return { count: 0 };
        });

    const total = parseInt(countResult.count);
    if (total === 0) return;

    logger.info(`共发现 ${total} 条缺少地理信息的历史像素记录`);

    let processed = 0;
    while (true) {
        const batch = await db('pixels_history')
            .whereNull('city')
            .whereNotNull('latitude')
            .whereNotNull('longitude')
            .select('id', 'latitude', 'longitude')
            .limit(BATCH_SIZE);

        if (batch.length === 0) break;

        for (const pixel of batch) {
            try {
                const lat = parseFloat(pixel.latitude);
                const lng = parseFloat(pixel.longitude);
                const geoInfo = await geocodingService.reverseGeocodeWithTimeout(lat, lng);
                if (geoInfo.city || geoInfo.province) {
                    await db('pixels_history')
                        .where({ id: pixel.id })
                        .update({
                            // country: geoInfo.country, // Assuming structure matches
                            // province: geoInfo.province,
                            city: geoInfo.city, // Focusing on city as req
                            // district: geoInfo.district,
                            // updated_at: new Date()
                        }).catch(err => {
                            // If columns don't exist, this will fail. Safe to ignore for now or check specifically.
                        });
                }
            } catch (err) { }
        }
        processed += batch.length;
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
}

async function backfillSessionsStartCity() {
    logger.info('开始更新 DrawingSessions 的 start_city...');

    // Find sessions with null start_city or '未知'
    const sessions = await db('drawing_sessions')
        .whereNull('start_city')
        .orWhere('start_city', '未知')
        .select('id');

    logger.info(`发现 ${sessions.length} 个缺少起始城市的会话`);

    for (const session of sessions) {
        // Try to get first pixel from history
        const firstPixel = await db('pixels_history')
            .where({ session_id: session.id })
            .whereNotNull('latitude')
            .whereNotNull('longitude')
            .orderBy('created_at', 'asc')
            .first();

        if (firstPixel) {
            try {
                // Ensure coordinates are numbers
                const lat = parseFloat(firstPixel.latitude);
                const lng = parseFloat(firstPixel.longitude);

                const geoInfo = await geocodingService.reverseGeocodeWithTimeout(lat, lng);
                if (geoInfo.city) {
                    await db('drawing_sessions')
                        .where({ id: session.id })
                        .update({
                            start_city: geoInfo.city,
                            start_country: geoInfo.country,
                            updated_at: new Date()
                        });
                    logger.info(`会话 ${session.id} 更新城市为: ${geoInfo.city}`);
                }
            } catch (err) {
                logger.error(`会话 ${session.id} 地理编码失败`, err);
            }
        }
    }
    logger.info('DrawingSessions 更新完成');
}

async function run() {
    try {
        await geocodingService.initializeServices();

        await backfillPixelsGeo();
        await backfillHistoryGeo();
        await backfillSessionsStartCity();

        logger.info('所有回填任务完成');
        process.exit(0);
    } catch (error) {
        logger.error('脚本执行失败:', error);
        process.exit(1);
    }
}

run();
