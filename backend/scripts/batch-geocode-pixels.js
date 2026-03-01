/**
 * 批量更新存量像素的地理信息
 *
 * 功能：
 * 1. 查询所有未编码的像素（geocoded IS NULL OR geocoded = false）
 * 2. 调用高德地图 API 获取地理信息
 * 3. 同时更新 pixels 和 pixels_history 表
 * 4. 支持断点续传和错误重试
 */

const { db } = require('../src/config/database');
const amapWebService = require('../src/services/amapWebService');
const logger = require('../src/utils/logger');

// 配置参数
const BATCH_SIZE = 50; // 每批处理数量
const DELAY_MS = 100; // 每个请求间隔（毫秒），避免超过高德 API QPS 限制
const MAX_ERRORS = 10; // 最大连续错误数，超过后暂停

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now();

  try {
    logger.info('🌍 开始批量更新存量像素地理信息...');

    // 1. 统计未编码的像素数量
    const stats = await getGeocodingStats();
    logger.info('📊 统计信息:', stats);

    if (stats.totalUnencoded === 0) {
      logger.info('✅ 所有像素都已编码，无需处理');
      return;
    }

    // 2. 批量处理
    let processedCount = 0;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let consecutiveErrors = 0;

    let hasMore = true;
    let lastId = 0;

    while (hasMore) {
      try {
        // 获取一批未编码的像素
        const pixels = await getUnencodedPixels(lastId, BATCH_SIZE);

        if (pixels.length === 0) {
          hasMore = false;
          break;
        }

        logger.info(`🔄 处理第 ${processedCount + 1}-${processedCount + pixels.length} 条...`);

        // 处理这批像素
        for (const pixel of pixels) {
          try {
            const result = await processPixel(pixel);

            if (result === 'skipped') {
              skipCount++;
            } else if (result === 'success') {
              successCount++;
            }

            consecutiveErrors = 0; // 重置连续错误计数
            lastId = pixel.id;

          } catch (pixelError) {
            errorCount++;
            consecutiveErrors++;

            logger.error(`❌ 处理像素 ${pixel.id} 失败:`, {
              error: pixelError.message,
              consecutiveErrors
            });

            // 如果连续错误过多，暂停一段时间
            if (consecutiveErrors >= MAX_ERRORS) {
              logger.warn(`⚠️ 连续错误达到 ${MAX_ERRORS} 次，暂停 30 秒...`);
              await sleep(30000);
              consecutiveErrors = 0;
            }
          }

          processedCount++;

          // 避免超过 API QPS 限制
          await sleep(DELAY_MS);
        }

        // 每批完成后输出进度
        const progress = ((processedCount / stats.totalUnencoded) * 100).toFixed(2);
        logger.info(`📈 进度: ${processedCount}/${stats.totalUnencoded} (${progress}%) | 成功: ${successCount} | 跳过: ${skipCount} | 错误: ${errorCount}`);

      } catch (batchError) {
        logger.error('❌ 批处理失败:', batchError);
        errorCount++;
        consecutiveErrors++;

        if (consecutiveErrors >= MAX_ERRORS) {
          logger.warn(`⚠️ 连续错误达到 ${MAX_ERRORS} 次，暂停 30 秒...`);
          await sleep(30000);
          consecutiveErrors = 0;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('✅ 批量更新完成！', {
      总耗时: `${elapsed}秒`,
      处理总数: processedCount,
      成功: successCount,
      跳过: skipCount,
      错误: errorCount
    });

  } catch (error) {
    logger.error('❌ 批量更新失败:', error);
    process.exit(1);
  }
}

/**
 * 获取地理编码统计信息
 */
async function getGeocodingStats() {
  const result = await db('pixels')
    .where((builder) => {
      builder.whereNull('geocoded').orWhere('geocoded', false);
    })
    .count('* as count')
    .first();

  const total = await db('pixels').count('* as count').first();

  return {
    totalUnencoded: parseInt(result.count),
    totalPixels: parseInt(total.count),
    encoded: parseInt(total.count) - parseInt(result.count)
  };
}

/**
 * 获取未编码的像素
 */
async function getUnencodedPixels(lastId, limit) {
  return await db('pixels')
    .where((builder) => {
      builder.whereNull('geocoded').orWhere('geocoded', false);
    })
    .where('id', '>', lastId)
    .select('id', 'grid_id', 'latitude', 'longitude', 'created_at')
    .orderBy('id', 'asc')
    .limit(limit);
}

/**
 * 处理单个像素
 */
async function processPixel(pixel) {
  // 将坐标转换为数字（数据库返回的是字符串）
  const lat = parseFloat(pixel.latitude);
  const lng = parseFloat(pixel.longitude);

  // 检查是否在中国境内（高德API主要支持中国）
  if (lat < 3 || lat > 54 || lng < 73 || lng > 136) {
    logger.debug(`跳过海外像素: ${pixel.id} (${lat}, ${lng})`);
    return 'skipped';
  }

  // 调用高德地图 API（传入数字类型的坐标）
  const geoResult = await amapWebService.reverseGeocode(lat, lng);

  if (!geoResult || !geoResult.geocoded) {
    logger.warn(`⚠️ 像素 ${pixel.id} 地理编码失败，使用默认信息`);
    return 'skipped';
  }

  // 更新像素表
  await db('pixels')
    .where('id', pixel.id)
    .update({
      country: geoResult.country,
      province: geoResult.province,
      city: geoResult.city,
      district: geoResult.district,
      adcode: geoResult.adcode,
      formatted_address: geoResult.formatted_address,
      geocoded: true,
      geocoded_at: new Date(),
      updated_at: new Date()
    });

  // 更新历史记录表（考虑分区）
  try {
    const createdAt = new Date(pixel.created_at);
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const partitionTable = `pixels_history_${year}${month}`;
    const historyDate = createdAt.toISOString().split('T')[0];

    await db(partitionTable)
      .where('grid_id', pixel.grid_id)
      .where('history_date', historyDate)
      .where('created_at', '>=', new Date(createdAt.getTime() - 5000))
      .where('created_at', '<=', new Date(createdAt.getTime() + 5000))
      .update({
        country: geoResult.country,
        province: geoResult.province,
        city: geoResult.city,
        district: geoResult.district,
        adcode: geoResult.adcode,
        formatted_address: geoResult.formatted_address,
        geocoded: true,
        geocoded_at: new Date(),
        updated_at: new Date()
      });
  } catch (historyError) {
    // 历史表更新失败不影响主流程
    logger.debug(`像素 ${pixel.id} 历史记录更新失败: ${historyError.message}`);
  }

  logger.debug(`✅ 像素 ${pixel.id} 已更新: ${geoResult.province} ${geoResult.city} ${geoResult.district}`);

  return 'success';
}

/**
 * 休眠函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行
main()
  .then(() => {
    logger.info('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
