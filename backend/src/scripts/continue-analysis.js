/**
 * 继续分析广告渲染问题
 */

const { db } = require('../config/database');

async function continueAnalysis() {
  try {
    console.log('\n========== 继续分析广告渲染问题 ==========\n');

    // 1. 检查material_assets表结构
    console.log('1️⃣ material_assets表结构:\n');
    const materialColumns = await db.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'material_assets'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('   material_assets字段:');
    materialColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // 2. 检查material_assets表数据
    console.log('\n2️⃣ material_assets表数据样本:\n');
    const materialSample = await db('material_assets')
      .select('*')
      .limit(5);

    console.log(`   找到 ${materialSample.length} 个材质资源:`);
    materialSample.forEach((material, i) => {
      console.log(`   ${i + 1}. id: ${material.id}`);
      console.log(`      key: ${material.key}`);
      console.log(`      name: ${material.name}`);
      console.log('');
    });

    // 3. 检查pattern_assets表结构
    console.log('3️⃣ pattern_assets表结构:\n');
    const patternColumns = await db.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pattern_assets'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('   pattern_assets字段:');
    patternColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // 4. 验证pattern_id的关联问题
    console.log('\n4️⃣ pattern_id关联验证（修正版）:\n');

    const adPixels = await db('pixels')
      .where('pixel_type', 'ad')
      .whereNotNull('pattern_id')
      .limit(10)
      .select('grid_id', 'pattern_id', 'color', 'related_id');

    console.log(`   检查前${adPixels.length}个广告像素的pattern_id关联:`);

    for (const pixel of adPixels) {
      const pattern = await db('pattern_assets')
        .where('key', pixel.pattern_id)
        .first();

      console.log(`   - grid_id: ${pixel.grid_id}`);
      console.log(`     pattern_id: ${pixel.pattern_id}`);
      console.log(`     匹配pattern_assets: ${pattern ? '✅' : '❌'}`);
      if (pattern) {
        console.log(`     render_type: ${pattern.render_type}`);
        console.log(`     material_id: ${pattern.material_id}`);
      }
      console.log('');
    }

    // 5. 检查前端getRenderType方法的逻辑
    console.log('5️⃣ 模拟前端getRenderType逻辑:\n');
    for (const pixel of adPixels.slice(0, 3)) {
      const pattern = await db('pattern_assets')
        .where('key', pixel.pattern_id)
        .first();

      let renderType = 'color'; // 默认值

      if (pattern) {
        if (pattern.render_type === 'emoji') {
          renderType = 'emoji';
        } else if (pattern.material_id) {
          renderType = 'complex';
        } else if (pattern.unicode_char) {
          renderType = 'emoji';
        } else if (pattern.render_type === 'color') {
          renderType = 'color';
        }
      }

      console.log(`   - pixel_id: ${pixel.grid_id}`);
      console.log(`     pattern_id: ${pixel.pattern_id}`);
      console.log(`     has pattern_assets: ${pattern ? 'true' : 'false'}`);
      console.log(`     determined render_type: ${renderType}`);
      console.log('');
    }

    // 6. 检查color pattern的处理逻辑
    console.log('6️⃣ 分析color类型的pattern_id:\n');
    const colorPatterns = await db('pixels')
      .where('pixel_type', 'ad')
      .where('pattern_id', 'like', 'color_%')
      .count('* as count');

    console.log(`   color类型pattern_id的广告像素: ${colorPatterns} 个`);

    // 7. 检查前端材质加载日志
    console.log('\n7️⃣ 检查前端材质加载逻辑:\n');
    console.log('   根据pattern_id格式分析:');

    const sampleColorPattern = adPixels.find(p => p.pattern_id && p.pattern_id.startsWith('color_'));
    if (sampleColorPattern) {
      console.log(`   示例pattern_id: ${sampleColorPattern.pattern_id}`);
      console.log('   分析: 这是color类型，前端会作为纯色渲染');
      console.log('   问题: 如果pattern_assets中没有对应记录，前端材质加载会失败');
    }

    console.log('\n========== 分析完成 ==========\n');

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    process.exit(0);
  }
}

continueAnalysis();