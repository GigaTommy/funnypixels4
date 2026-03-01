/**
 * 诊断MVT emoji图层问题
 *
 * 检查：
 * 1. 数据库中emoji像素的实际数据
 * 2. MVT生成时的分类逻辑
 * 3. 直接请求MVT瓦片检查emoji图层
 */

require('dotenv').config();
const { db } = require('../src/config/database');

// 广州测试坐标（从iOS日志获取）
const TEST_LAT = 23.110369;
const TEST_LNG = 113.325282;
const TILE_Z = 16;
const TILE_X = 53398;
const TILE_Y = 28441;

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MVT Emoji 图层诊断工具                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. 检查该区域的所有像素
    console.log('📍 测试坐标:', TEST_LAT, TEST_LNG);
    console.log('📦 瓦片坐标:', `z=${TILE_Z}, x=${TILE_X}, y=${TILE_Y}`);
    console.log('\n' + '═'.repeat(60));

    // 2. 查询该区域所有像素的pixel_type分布
    console.log('\n🔍 步骤1: 检查pixels表中的pixel_type分布');
    const pixelTypeStats = await db.raw(`
      SELECT
        p.pixel_type,
        COUNT(*) as count
      FROM pixels p
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      GROUP BY p.pixel_type
      ORDER BY count DESC
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log('\npixels.pixel_type 分布:');
    console.log('─'.repeat(40));
    pixelTypeStats.rows.forEach(row => {
      console.log(`  ${row.pixel_type || 'NULL'}: ${row.count}`);
    });

    // 3. 检查pattern_assets的render_type分布
    console.log('\n🔍 步骤2: 检查pattern_assets.render_type分布');
    const renderTypeStats = await db.raw(`
      SELECT
        pa.render_type,
        COUNT(*) as count
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      GROUP BY pa.render_type
      ORDER BY count DESC
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log('\npattern_assets.render_type 分布:');
    console.log('─'.repeat(40));
    renderTypeStats.rows.forEach(row => {
      console.log(`  ${row.render_type || 'NULL (无匹配的pattern_asset)'}: ${row.count}`);
    });

    // 4. 检查emoji像素的详细信息
    console.log('\n🔍 步骤3: 检查emoji像素的详细信息');
    const emojiPixels = await db.raw(`
      SELECT
        p.id,
        p.grid_id,
        p.pixel_type as pixels_pixel_type,
        p.pattern_id,
        p.color,
        pa.key as pa_key,
        pa.render_type as pa_render_type,
        pa.unicode_char,
        pa.name as pa_name
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      AND (
        p.pixel_type = 'emoji'
        OR pa.render_type = 'emoji'
      )
      LIMIT 20
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log(`\n找到 ${emojiPixels.rows.length} 个潜在emoji像素:`);
    console.log('─'.repeat(80));

    if (emojiPixels.rows.length === 0) {
      console.log('  ❌ 没有找到emoji像素!');
    } else {
      emojiPixels.rows.forEach((row, idx) => {
        console.log(`\n  [${idx + 1}] pixel_id=${row.id}`);
        console.log(`      grid_id: ${row.grid_id}`);
        console.log(`      pixels.pixel_type: ${row.pixels_pixel_type || 'NULL'}`);
        console.log(`      pixels.pattern_id: ${row.pattern_id || 'NULL'}`);
        console.log(`      pixels.color: ${row.color || 'NULL'}`);
        console.log(`      pa.key: ${row.pa_key || 'NULL (JOIN失败!)'}`);
        console.log(`      pa.render_type: ${row.pa_render_type || 'NULL'}`);
        console.log(`      pa.unicode_char: ${row.unicode_char || 'NULL'}`);
        console.log(`      pa.name: ${row.pa_name || 'NULL'}`);
      });
    }

    // 5. 检查pattern_id和pattern_assets.key的匹配情况
    console.log('\n🔍 步骤4: 检查pattern_id JOIN匹配问题');
    const joinIssues = await db.raw(`
      SELECT
        p.pattern_id,
        COUNT(*) as pixel_count,
        (SELECT key FROM pattern_assets WHERE key = p.pattern_id LIMIT 1) as matched_key,
        (SELECT render_type FROM pattern_assets WHERE key = p.pattern_id LIMIT 1) as matched_render_type
      FROM pixels p
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      AND p.pattern_id IS NOT NULL
      AND p.pattern_id != ''
      GROUP BY p.pattern_id
      ORDER BY pixel_count DESC
      LIMIT 20
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log('\npattern_id 匹配情况:');
    console.log('─'.repeat(80));
    let unmatchedCount = 0;
    joinIssues.rows.forEach(row => {
      const matched = row.matched_key ? '✅' : '❌';
      if (!row.matched_key) unmatchedCount++;
      console.log(`  ${matched} pattern_id="${row.pattern_id}" -> ${row.pixel_count} pixels, render_type=${row.matched_render_type || 'N/A'}`);
    });

    if (unmatchedCount > 0) {
      console.log(`\n  ⚠️ 警告: ${unmatchedCount} 个pattern_id没有匹配到pattern_assets!`);
    }

    // 6. 模拟MVT分类逻辑
    console.log('\n🔍 步骤5: 模拟MVT分类逻辑');
    const mvtClassification = await db.raw(`
      SELECT
        CASE
          WHEN p.pixel_type = 'ad' THEN 'ad'
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          WHEN p.pixel_type = 'alliance' THEN 'alliance'
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              WHEN pa.render_type = 'default' THEN 'color'
              ELSE 'color'
            END
          WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
          ELSE 'color'
        END AS mvt_pixel_type,
        COUNT(*) as count
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      GROUP BY mvt_pixel_type
      ORDER BY count DESC
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log('\nMVT分类结果预测:');
    console.log('─'.repeat(40));
    mvtClassification.rows.forEach(row => {
      const icon = row.mvt_pixel_type === 'emoji' ? '🎯' :
                   row.mvt_pixel_type === 'color' ? '🟦' :
                   row.mvt_pixel_type === 'complex' ? '🖼️' : '❓';
      console.log(`  ${icon} ${row.mvt_pixel_type}: ${row.count}`);
    });

    // 7. 检查emoji_char是否会被正确提取
    console.log('\n🔍 步骤6: 检查emoji_char提取');
    const emojiCharCheck = await db.raw(`
      SELECT
        p.id,
        p.pattern_id,
        pa.unicode_char,
        COALESCE(
          CASE WHEN pa.render_type = 'emoji' THEN pa.unicode_char ELSE NULL END,
          NULL
        ) AS extracted_emoji_char
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      WHERE p.lat_quantized BETWEEN ? AND ?
      AND p.lng_quantized BETWEEN ? AND ?
      AND pa.render_type = 'emoji'
      LIMIT 10
    `, [TEST_LAT - 0.01, TEST_LAT + 0.01, TEST_LNG - 0.01, TEST_LNG + 0.01]);

    console.log('\nemoji_char 提取结果:');
    console.log('─'.repeat(60));
    if (emojiCharCheck.rows.length === 0) {
      console.log('  ❌ 没有找到render_type=emoji的记录!');
    } else {
      emojiCharCheck.rows.forEach(row => {
        console.log(`  pixel_id=${row.id}: pattern_id="${row.pattern_id}" -> emoji="${row.extracted_emoji_char || 'NULL'}"`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('诊断完成!');

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await db.destroy();
  }
}

main();
