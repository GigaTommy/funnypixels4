/**
 * 批量回填像素地理信息
 * 从高德地图 API 获取坐标对应的地理信息并更新到 pixels 和 pixels_history 表
 *
 * 使用方法：
 *   node scripts/batch-backfill-geo-info.js
 *
 * 选项：
 *   --batch-size=N    每批处理数量（默认100）
 *   --delay=MS         请求间隔毫秒数（默认50）
 *   --pixel-id=ID      只处理指定ID的像素
 *   --dry-run          模拟运行，不实际更新数据库
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { db } = require('../src/config/database');
const amapWebService = require('../src/services/amapWebService');

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  batchSize: parseInt(getArg('--batch-size')) || 100,
  delay: parseInt(getArg('--delay')) || 50,
  pixelId: getArg('--pixel-id'),
  dryRun: args.includes('--dry-run')
};

function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

// 统计信息
const stats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
};

console.log('\n=== 批量回填像素地理信息 ===');
console.log('配置:');
console.log('  批处理大小:', options.batchSize);
console.log('  请求间隔:', options.delay, 'ms');
console.log('  模拟运行:', options.dryRun ? '是' : '否');
if (options.pixelId) {
  console.log('  指定像素ID:', options.pixelId);
}
console.log('');

async function main() {
  try {
    let pixels;

    if (options.pixelId) {
      // 处理单个像素
      pixels = await db('pixels')
        .where('id', options.pixelId)
        .select('id', 'grid_id', 'latitude', 'longitude', 'city', 'province', 'country', 'geocoded');
      console.log(`查找像素ID: ${options.pixelId}`);
    } else {
      // 获取需要回填的像素（地理信息为空的）
      pixels = await db('pixels')
        .where(function() {
          this.whereNull('city')
            .orWhere('city', '')
            .orWhereNull('province')
            .orWhere('province', '');
        })
        .select('id', 'grid_id', 'latitude', 'longitude', 'city', 'province', 'country', 'geocoded')
        .limit(options.batchSize);

      console.log(`找到 ${pixels.length} 条需要回填的像素记录`);
    }

    if (pixels.length === 0) {
      console.log('✅ 所有像素都已有地理信息，无需回填');
      process.exit(0);
    }

    stats.total = pixels.length;
    console.log('');

    // 批量处理
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      const progress = `[${i + 1}/${pixels.length}]`;

      await processPixel(pixel, progress);

      // 请求间隔，避免触发 API 限流
      if (i < pixels.length - 1) {
        await sleep(options.delay);
      }
    }

    // 输出总结
    printSummary();

  } catch (error) {
    console.error('\n❌ 脚本执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function processPixel(pixel, progress) {
  stats.processed++;

  try {
    console.log(`${progress} 处理像素 ${pixel.id} (${pixel.grid_id})`);
    console.log(`  坐标: (${pixel.latitude}, ${pixel.longitude})`);
    console.log(`  当前地理信息: country=${pixel.country || '空'}, province=${pixel.province || '空'}, city=${pixel.city || '空'}`);

    // 调用高德 API 获取地理信息
    const geoInfo = await amapWebService.reverseGeocode(
      parseFloat(pixel.latitude),
      parseFloat(pixel.longitude)
    );

    if (!geoInfo.geocoded) {
      console.log(`  ⚠️ API 调用成功但未获取到地理信息`);
      stats.skipped++;
      return;
    }

    console.log(`  获取到地理信息:`);
    console.log(`    country: ${geoInfo.country}`);
    console.log(`    province: ${geoInfo.province}`);
    console.log(`    city: ${geoInfo.city}`);
    console.log(`    district: ${geoInfo.district}`);
    console.log(`    adcode: ${geoInfo.adcode}`);
    console.log(`    formatted_address: ${geoInfo.formatted_address}`);

    if (options.dryRun) {
      console.log(`  🔄 [模拟运行] 将更新数据库`);
      stats.success++;
    } else {
      // 更新 pixels 表
      await db('pixels')
        .where('id', pixel.id)
        .update({
          country: geoInfo.country,
          province: geoInfo.province,
          city: geoInfo.city,
          district: geoInfo.district,
          adcode: geoInfo.adcode || '',
          formatted_address: geoInfo.formatted_address,
          geocoded: true,
          geocoded_at: new Date()
        });

      console.log(`  ✅ pixels 表已更新`);

      // 同步更新 pixels_history 表
      await updatePixelsHistory(pixel, geoInfo);

      stats.success++;
    }

  } catch (error) {
    console.log(`  ❌ 处理失败: ${error.message}`);
    stats.failed++;
  }
}

async function updatePixelsHistory(pixel, geoInfo) {
  try {
    // 获取该像素的所有历史记录
    const historyRecords = await db('pixels_history')
      .where('grid_id', pixel.grid_id)
      .select('id', 'history_date');

    if (historyRecords.length === 0) {
      console.log(`    ℹ️ 无历史记录需要更新`);
      return;
    }

    // 按分区表分组更新
    const groupedRecords = {};
    for (const record of historyRecords) {
      const date = new Date(record.history_date);
      const partitionKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!groupedRecords[partitionKey]) {
        groupedRecords[partitionKey] = [];
      }
      groupedRecords[partitionKey].push(record.id);
    }

    // 批量更新每个分区表
    for (const [partitionKey, ids] of Object.entries(groupedRecords)) {
      const tableName = `pixels_history_${partitionKey}`;

      await db(tableName)
        .whereIn('id', ids)
        .update({
          country: geoInfo.country,
          province: geoInfo.province,
          city: geoInfo.city,
          district: geoInfo.district,
          adcode: geoInfo.adcode || '',
          formatted_address: geoInfo.formatted_address,
          geocoded: true,
          geocoded_at: new Date()
        });

      console.log(`    ✅ ${tableName} 表已更新 ${ids.length} 条记录`);
    }

  } catch (error) {
    console.log(`    ⚠️ 更新 pixels_history 失败: ${error.message}`);
    // 不抛出错误，避免影响主流程
  }
}

function printSummary() {
  const elapsed = Date.now() - stats.startTime;

  console.log('\n=== 执行总结 ===');
  console.log('总记录数:', stats.total);
  console.log('已处理:', stats.processed);
  console.log('成功:', stats.success);
  console.log('失败:', stats.failed);
  console.log('跳过:', stats.skipped);
  console.log('耗时:', (elapsed / 1000).toFixed(2), '秒');
  console.log('平均速度:', ((stats.processed / elapsed) * 1000).toFixed(2), '条/秒');

  if (stats.failed > 0) {
    console.log('\n⚠️ 有 ' + stats.failed + ' 条记录处理失败，建议重新运行脚本');
  } else {
    console.log('\n✅ 所有记录处理成功！');
  }

  console.log('');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行
main();
