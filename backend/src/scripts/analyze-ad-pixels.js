/**
 * 深度分析广告像素数据结构
 * 收集所有相关信息找出问题根因
 */

const { db } = require('../config/database');

async function analyzeAdPixels() {
  try {
    console.log('\n========== 深度分析广告像素数据结构 ==========\n');

    // 1. 查询广告像素的基本统计
    console.log('1️⃣ 广告像素基本统计:\n');
    const adStats = await db('pixels')
      .where('pixel_type', 'ad')
      .count('* as total')
      .min('created_at as oldest')
      .max('created_at as newest')
      .first();

    console.log('   总数:', adStats.total);
    console.log('   最早创建:', adStats.oldest);
    console.log('   最新创建:', adStats.newest);

    // 2. 分析广告像素的pattern_id分布
    console.log('\n2️⃣ 广告像素pattern_id分析:\n');
    const patternStats = await db('pixels')
      .where('pixel_type', 'ad')
      .select('pattern_id')
      .count('* as count')
      .groupBy('pattern_id')
      .orderBy('count', 'desc')
      .limit(10);

    console.log('   pattern_id分布:');
    patternStats.forEach(stat => {
      console.log(`   - ${stat.pattern_id || 'null'}: ${stat.count} 个`);
    });

    // 3. 查询pattern_assets表中的广告相关资源
    console.log('\n3️⃣ pattern_assets表中的广告相关资源:\n');
    const adPatterns = await db('pattern_assets')
      .where('key', 'like', 'ad_%')
      .orWhere('description', 'like', '%广告%')
      .orWhere('category', 'advertisement')
      .select('*')
      .limit(10);

    console.log(`   找到 ${adPatterns.length} 个广告相关图案资源:`);
    adPatterns.forEach((pattern, i) => {
      console.log(`   ${i + 1}. key: ${pattern.key}`);
      console.log(`      render_type: ${pattern.render_type}`);
      console.log(`      unicode_char: ${pattern.unicode_char}`);
      console.log(`      material_id: ${pattern.material_id}`);
      console.log(`      description: ${pattern.description}`);
      console.log(`      category: ${pattern.category}`);
      console.log('');
    });

    // 4. 查询advertisements表
    console.log('4️⃣ advertisements表数据:\n');
    const adData = await db('advertisements')
      .select('*')
      .limit(5);

    console.log(`   找到 ${adData.length} 个广告数据:`);
    adData.forEach((ad, i) => {
      console.log(`   ${i + 1}. id: ${ad.id}`);
      console.log(`      title: ${ad.title}`);
      console.log(`      status: ${ad.status}`);
      console.log(`      pattern_key: ${ad.pattern_key}`);
      console.log(`      material_id: ${ad.material_id}`);
      console.log('');
    });

    // 5. 检查广告像素的详细数据
    console.log('5️⃣ 广告像素详细数据样本:\n');
    const adPixelsSample = await db('pixels')
      .where('pixel_type', 'ad')
      .whereNotNull('pattern_id')
      .select('*')
      .limit(5);

    console.log(`   查看前 ${adPixelsSample.length} 个广告像素:`);
    adPixelsSample.forEach((pixel, i) => {
      console.log(`   ${i + 1}. grid_id: ${pixel.grid_id}`);
      console.log(`      lat/lng: (${pixel.latitude}, ${pixel.longitude})`);
      console.log(`      pattern_id: ${pixel.pattern_id}`);
      console.log(`      color: ${pixel.color}`);
      console.log(`      related_id: ${pixel.related_id}`);
      console.log(`      user_id: ${pixel.user_id}`);
      console.log('');
    });

    // 6. 检查pattern_id与pattern_assets的关联
    console.log('6️⃣ 广告像素pattern_id关联验证:\n');
    const unmatchedPatterns = await db('pixels')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('pixels.pixel_type', 'ad')
      .where('pixels.pattern_id', '!=', null)
      .where('pattern_assets.key', null)
      .count('pixels.grid_id as unmatched');

    console.log(`   未匹配pattern_id的广告像素: ${unmatchedPatterns} 个`);

    const matchedPatterns = await db('pixels')
      .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
      .where('pixels.pixel_type', 'ad')
      .where('pixels.pattern_id', '!=', null)
      .whereNotNull('pattern_assets.key')
      .count('pixels.grid_id as matched');

    console.log(`   已匹配pattern_id的广告像素: ${matchedPatterns} 个`);

    // 7. 检查material_assets表
    console.log('\n7️⃣ material_assets表统计:\n');
    const materialStats = await db('material_assets')
      .count('* as total')
      .select('category')
      .groupBy('category')
      .orderBy('total', 'desc');

    console.log('   material资源统计:');
    materialStats.forEach(stat => {
      console.log(`   - ${stat.category}: ${stat.total} 个`);
    });

    // 8. 检查前端查询条件下的广告像素
    console.log('\n8️⃣ 模拟前端API查询:\n');

    // 模拟一个区域查询
    const sampleAdPixel = await db('pixels')
      .where('pixel_type', 'ad')
      .whereNotNull('pattern_id')
      .first();

    if (sampleAdPixel) {
      const buffer = 0.001;
      const bounds = {
        north: parseFloat(sampleAdPixel.latitude) + buffer,
        south: parseFloat(sampleAdPixel.latitude) - buffer,
        east: parseFloat(sampleAdPixel.longitude) + buffer,
        west: parseFloat(sampleAdPixel.longitude) - buffer
      };

      console.log(`   测试边界: ${JSON.stringify(bounds)}`);

      const apiResult = await db('pixels')
        .leftJoin('pattern_assets', 'pixels.pattern_id', 'pattern_assets.key')
        .select(
          'pixels.id',
          'pixels.grid_id',
          'pixels.latitude',
          'pixels.longitude',
          'pixels.color',
          'pixels.pattern_id',
          'pixels.pixel_type',
          'pixels.related_id',
          'pattern_assets.render_type',
          'pattern_assets.unicode_char',
          'pattern_assets.material_id'
        )
        .whereRaw('CAST(pixels.latitude AS DECIMAL) >= ?', [bounds.south])
        .whereRaw('CAST(pixels.latitude AS DECIMAL) <= ?', [bounds.north])
        .whereRaw('CAST(pixels.longitude AS DECIMAL) >= ?', [bounds.west])
        .whereRaw('CAST(pixels.longitude AS DECIMAL) <= ?', [bounds.east])
        .where('pixels.pixel_type', 'ad');

      console.log(`   API查询结果: ${apiResult.length} 个广告像素`);

      apiResult.forEach((pixel, i) => {
        console.log(`   ${i + 1}. ${pixel.pixel_type}像素:`);
        console.log(`     grid_id: ${pixel.grid_id}`);
        console.log(`     pattern_id: ${pixel.pattern_id}`);
        console.log(`     render_type: ${pixel.render_type}`);
        console.log(`     material_id: ${pixel.material_id}`);
        console.log(`     unicode_char: ${pixel.unicode_char}`);
      });
    }

    console.log('\n========== 分析完成 ==========\n');

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    process.exit(0);
  }
}

analyzeAdPixels();