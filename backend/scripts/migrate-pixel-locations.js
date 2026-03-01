/**
 * 历史像素数据地区信息迁移脚本
 *
 * 功能：为已有的像素添加地区信息（逆地理编码）
 *
 * 使用方法：
 *   node scripts/migrate-pixel-locations.js [options]
 *
 * 选项：
 *   --batch-size <number>  每批处理的像素数量（默认100）
 *   --limit <number>       总共处理的像素数量（默认全部）
 *   --test                 测试模式，只处理10个像素
 */

const knex = require('knex');
const knexConfig = require('../knexfile');
const geocodingService = require('../src/services/geocodingService');

const db = knex(knexConfig.development);

// 解析命令行参数
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const BATCH_SIZE = parseInt(getArg('--batch-size', '100'));
const LIMIT = getArg('--limit', null);
const TEST_MODE = args.includes('--test');

async function migratePixelLocations() {
  console.log('🚀 开始迁移像素地区信息...\n');

  if (TEST_MODE) {
    console.log('⚠️  测试模式：只处理 10 个像素\n');
  }

  try {
    // 1. 统计需要处理的像素数量
    const totalQuery = db('pixels')
      .where(function() {
        this.whereNull('geocoded')
          .orWhere('geocoded', false);
      });

    if (LIMIT) {
      totalQuery.limit(parseInt(LIMIT));
    }
    if (TEST_MODE) {
      totalQuery.limit(10);
    }

    const totalCount = await totalQuery.count('* as count').first();
    const total = parseInt(totalCount.count);

    console.log(`📊 需要处理的像素数量: ${total}`);

    if (total === 0) {
      console.log('✅ 所有像素已完成地区信息迁移\n');
      process.exit(0);
    }

    // 2. 分批处理
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (processed < total) {
      const batchSize = Math.min(BATCH_SIZE, total - processed);

      // 获取一批未处理的像素
      const pixels = await db('pixels')
        .select('id', 'latitude', 'longitude')
        .where(function() {
          this.whereNull('geocoded')
            .orWhere('geocoded', false);
        })
        .limit(batchSize);

      if (pixels.length === 0) {
        break;
      }

      console.log(`\n📦 处理批次: ${processed + 1} - ${processed + pixels.length}`);

      // 批量逆地理编码
      for (const pixel of pixels) {
        try {
          const locationInfo = await geocodingService.reverseGeocode(pixel.latitude, pixel.longitude);

          // 更新数据库
          await db('pixels')
            .where('id', pixel.id)
            .update(locationInfo);

          succeeded++;
          console.log(`  ✅ [${succeeded}/${total}] 像素 ${pixel.id}: ${locationInfo.province} ${locationInfo.city}`);
        } catch (error) {
          failed++;
          console.error(`  ❌ [${failed}] 像素 ${pixel.id} 处理失败:`, error.message);

          // 标记为已处理但失败
          await db('pixels')
            .where('id', pixel.id)
            .update({
              geocoded: false,
              geocoded_at: new Date()
            });
        }

        processed++;

        // 显示进度
        const progress = ((processed / total) * 100).toFixed(2);
        process.stdout.write(`\r  📈 进度: ${progress}% (${processed}/${total})`);
      }

      console.log('\n');
    }

    // 3. 输出统计结果
    console.log('\n📊 迁移完成统计:');
    console.log(`  总计: ${processed}`);
    console.log(`  成功: ${succeeded}`);
    console.log(`  失败: ${failed}`);
    console.log(`  成功率: ${((succeeded / processed) * 100).toFixed(2)}%`);

    // 4. 验证结果
    const geocodedCount = await db('pixels')
      .where('geocoded', true)
      .count('* as count')
      .first();

    console.log(`\n✅ 当前已完成逆地理编码的像素数: ${geocodedCount.count}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 迁移过程出错:', error);
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  收到中断信号，正在安全退出...');
  await db.destroy();
  process.exit(0);
});

// 运行迁移
migratePixelLocations();
