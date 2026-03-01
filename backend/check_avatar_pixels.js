const knex = require('knex')({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'funnypixels_postgres'
  }
});

async function checkAvatarPixels() {
  console.log('='.repeat(80));
  console.log('检查用户头像像素数据');
  console.log('='.repeat(80));

  try {
    // 1. 查找所有用户头像像素
    console.log('\n[1] 查找用户头像像素...');
    const avatarPixels = await knex('pixels')
      .where('color', 'custom_pattern')
      .whereNull('alliance_id')
      .select('id', 'grid_id', 'pattern_id', 'color', 'alliance_id', 'pixel_type', 'latitude', 'longitude')
      .limit(10);

    console.log(`✅ 找到 ${avatarPixels.length} 个用户头像像素`);

    if (avatarPixels.length === 0) {
      console.log('❌ 没有找到任何用户头像像素！');
      return;
    }

    console.log('\n像素详情:');
    avatarPixels.forEach((p, i) => {
      console.log(`\n  [${i + 1}]`);
      console.log(`    grid_id: ${p.grid_id}`);
      console.log(`    pattern_id: ${p.pattern_id}`);
      console.log(`    color: ${p.color}`);
      console.log(`    alliance_id: ${p.alliance_id}`);
      console.log(`    pixel_type: ${p.pixel_type}`);
      console.log(`    坐标: (${p.latitude}, ${p.longitude})`);
    });

    // 2. 模拟 MVT 查询的 pixel_type 分类逻辑
    console.log('\n\n[2] 模拟 MVT 查询的 pixel_type 分类...');

    const testPixel = avatarPixels[0];
    const testQuery = `
      SELECT
        p.id,
        p.grid_id,
        p.color,
        p.pattern_id,
        p.alliance_id,
        p.pixel_type AS original_pixel_type,
        pa.render_type AS pa_render_type,
        CASE
          WHEN p.pixel_type = 'alliance' THEN
            CASE WHEN a.flag_render_type = 'complex' THEN 'complex'
                 WHEN a.flag_render_type = 'emoji' THEN 'emoji'
                 ELSE 'color'
            END
          WHEN (p.pixel_type = 'basic' OR p.pixel_type = 'complex' OR p.pixel_type IS NULL) THEN
            CASE
              WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN 'complex'
              WHEN pa.render_type = 'emoji' THEN 'emoji'
              WHEN pa.render_type = 'complex' THEN 'complex'
              WHEN pa.render_type = 'color' THEN 'color'
              WHEN pa.render_type = 'default' THEN 'color'
              ELSE 'color'
            END
          WHEN p.pattern_id IS NULL OR p.pattern_id = '' THEN 'color'
          ELSE 'color'
        END AS computed_pixel_type,
        CASE
          WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN u.avatar_url
          WHEN pa.render_type = 'complex' THEN
            CASE
              WHEN pa.file_url IS NOT NULL THEN pa.file_url
              WHEN pa.file_path IS NOT NULL THEN pa.file_path
              ELSE NULL
            END
          ELSE NULL
        END AS image_url
      FROM pixels p
      LEFT JOIN pattern_assets pa ON p.pattern_id = pa.key AND pa.deleted_at IS NULL
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON p.alliance_id = a.id
      WHERE p.grid_id = ?
    `;

    const result = await knex.raw(testQuery, [testPixel.grid_id]);
    const row = result.rows[0];

    console.log('测试像素:', testPixel.grid_id);
    console.log('\nMVT 分类结果:');
    console.log(`  original_pixel_type: ${row.original_pixel_type}`);
    console.log(`  computed_pixel_type: ${row.computed_pixel_type}`);
    console.log(`  pattern_id: ${row.pattern_id}`);
    console.log(`  image_url: ${row.image_url}`);
    console.log(`  pa_render_type: ${row.pa_render_type}`);

    // 3. 检查是否满足 MVT complex 层的 WHERE 条件
    console.log('\n\n[3] 检查是否满足 MVT complex 层条件...');
    console.log('条件:');
    console.log('  1. pixel_type = \'complex\'');
    console.log('  2. pattern_id IS NOT NULL');
    console.log('  3. geom_quantized IS NOT NULL');

    const meetsCondition1 = row.computed_pixel_type === 'complex';
    const meetsCondition2 = row.pattern_id !== null && row.pattern_id !== '';

    console.log('\n检查结果:');
    console.log(`  ✓ pixel_type = 'complex': ${meetsCondition1 ? '✅ 是' : '❌ 否'} (${row.computed_pixel_type})`);
    console.log(`  ✓ pattern_id IS NOT NULL: ${meetsCondition2 ? '✅ 是' : '❌ 否'} (${row.pattern_id})`);

    // 检查 geom_quantized
    const geomCheck = await knex('pixels')
      .where('grid_id', testPixel.grid_id)
      .select(knex.raw('geom_quantized IS NOT NULL AS has_geom'))
      .first();

    console.log(`  ✓ geom_quantized IS NOT NULL: ${geomCheck.has_geom ? '✅ 是' : '❌ 否'}`);

    const meetsAllConditions = meetsCondition1 && meetsCondition2 && geomCheck.has_geom;

    console.log('\n' + '='.repeat(80));
    console.log('结论:');
    if (meetsAllConditions) {
      console.log('✅ 像素满足所有 MVT complex 层条件');
      console.log('   问题可能在 MVT 瓦片生成的其他环节（空间索引、采样等）');
    } else {
      console.log('❌ 像素不满足 MVT complex 层条件');
      console.log('   这就是为什么 complex 层为空的原因！');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await knex.destroy();
  }
}

checkAvatarPixels();
