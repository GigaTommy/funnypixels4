/**
 * 检查广告像素是否正确写入数据库
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

async function checkAdPixels() {
  try {
    console.log('🔍 开始检查广告像素...\n');

    // 1. 检查ad_placements表
    console.log('========== 步骤1: 检查广告放置记录 ==========');
    const placements = await db('ad_placements')
      .orderBy('created_at', 'desc')
      .limit(10);

    console.log(`✅ 找到 ${placements.length} 条广告放置记录:\n`);
    placements.forEach((placement, index) => {
      console.log(`${index + 1}. ID: ${placement.id}`);
      console.log(`   位置: (${placement.center_lat}, ${placement.center_lng})`);
      console.log(`   尺寸: ${placement.width}x${placement.height}`);
      console.log(`   像素数: ${placement.pixel_count}`);
      console.log(`   创建时间: ${placement.created_at}`);
      console.log('');
    });

    if (placements.length === 0) {
      console.log('❌ 没有找到任何广告放置记录');
      process.exit(0);
    }

    // 2. 检查最新一条广告的像素数据
    const latestPlacement = placements[0];
    console.log(`========== 步骤2: 检查最新广告的像素数据 ==========`);
    console.log(`广告ID: ${latestPlacement.id}`);
    console.log(`位置: (${latestPlacement.center_lat}, ${latestPlacement.center_lng})`);
    console.log(`尺寸: ${latestPlacement.width}x${latestPlacement.height}\n`);

    // 检查pixels表中是否有该广告的像素
    const adPixels = await db('pixels')
      .where('pixel_type', PIXEL_TYPES.AD)
      .where('related_id', latestPlacement.id)
      .select('*');

    console.log(`📊 pixels表中找到 ${adPixels.length} 个像素 (期望: ${latestPlacement.pixel_count})\n`);

    if (adPixels.length === 0) {
      console.log('❌ 没有找到任何像素数据!');
      console.log('\n可能的原因:');
      console.log('1. 异步渲染过程出错 (检查服务器日志)');
      console.log('2. AdPixelRenderer.processAdPlacement() 没有被调用');
      console.log('3. 颜色验证失败');
      console.log('4. 数据库写入失败\n');

      // 尝试手动触发渲染
      console.log('🔄 尝试手动触发像素渲染...');
      const AdPixelRenderer = require('../services/AdPixelRenderer');
      try {
        await AdPixelRenderer.processAdPlacement(latestPlacement.id);
        console.log('✅ 手动渲染完成!\n');

        // 再次检查
        const pixelsAfterRender = await db('pixels')
          .where('pixel_type', PIXEL_TYPES.AD)
          .where('related_id', latestPlacement.id)
          .count('* as count')
          .first();

        console.log(`📊 渲染后像素数量: ${pixelsAfterRender.count}`);
      } catch (error) {
        console.error('❌ 手动渲染失败:', error.message);
        console.error('详细错误:', error);
      }
    } else {
      console.log('✅ 像素数据写入成功!\n');
      console.log('前5个像素示例:');
      adPixels.slice(0, 5).forEach((pixel, index) => {
        console.log(`${index + 1}. grid_id: ${pixel.grid_id}, color: ${pixel.color}, pattern_id: ${pixel.pattern_id}`);
      });

      // 统计颜色分布
      const colorStats = {};
      adPixels.forEach(pixel => {
        colorStats[pixel.color] = (colorStats[pixel.color] || 0) + 1;
      });

      console.log('\n📊 颜色分布统计:');
      Object.entries(colorStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([color, count]) => {
          console.log(`  ${color}: ${count}个像素 (${(count / adPixels.length * 100).toFixed(1)}%)`);
        });
    }

    // 3. 检查所有广告相关的像素总数
    console.log('\n========== 步骤3: 检查所有广告像素 ==========');
    const totalAdPixels = await db('pixels')
      .where('pixel_type', PIXEL_TYPES.AD)
      .count('* as count')
      .first();

    console.log(`📊 数据库中所有广告像素总数: ${totalAdPixels.count}`);

    await db.destroy();
    console.log('\n✅ 检查完成!');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

checkAdPixels();
