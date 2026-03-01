/**
 * 添加 MVT 瓦片渲染所需的量化坐标和几何列
 *
 * 添加列:
 * - lng_quantized: 量化经度 (保留7位小数)
 * - lat_quantized: 量化纬度 (保留7位小数)
 * - geom_quantized: PostGIS 几何点 (EPSG:4326)
 *
 * 同时创建相关索引以支持 MVT 瓦片查询
 */

/**
 * 升级函数
 */
exports.up = async function(knex) {
  console.log('\n=== 添加 MVT 瓦片渲染所需的量化坐标和几何列 ===\n');

  // 1. 添加量化坐标列
  console.log('1. 添加量化坐标列...');
  await knex.raw(`
    ALTER TABLE pixels
    ADD COLUMN IF NOT EXISTS lng_quantized numeric(10,7),
    ADD COLUMN IF NOT EXISTS lat_quantized numeric(10,7);
  `);
  console.log('✅ 量化坐标列添加完成');

  // 2. 添加 PostGIS 几何列 (需要 PostGIS 扩展)
  console.log('\n2. 添加 PostGIS 几何列...');
  try {
    await knex.raw(`
      ALTER TABLE pixels
      ADD COLUMN IF NOT EXISTS geom_quantized geometry(Point,4326);
    `);
    console.log('✅ PostGIS 几何列添加完成');
  } catch (error) {
    console.warn('⚠️ PostGIS 几何列添加失败:', error.message);
    console.log('   提示: 请确保已安装 PostGIS 扩展');
    console.log('   可以运行: CREATE EXTENSION IF NOT EXISTS postgis;');
  }

  // 3. 为现有数据填充量化坐标
  console.log('\n3. 填充现有数据的量化坐标...');

  // 检查现有记录数
  const { rows } = await knex.raw('SELECT COUNT(*) as total FROM pixels');
  const totalCount = parseInt(rows[0].total);
  console.log(`   现有记录数: ${totalCount}`);

  if (totalCount > 0) {
    // 一次性更新所有记录（因为数据量不大）
    await knex.raw(`
      UPDATE pixels
      SET
        lng_quantized = CAST(longitude AS numeric(10,7)),
        lat_quantized = CAST(latitude AS numeric(10,7))
      WHERE lng_quantized IS NULL
    `);
    console.log('✅ 量化坐标填充完成');
  } else {
    console.log('ℹ️ 无现有数据需要填充');
  }

  // 4. 为现有数据创建几何点
  console.log('\n4. 创建 PostGIS 几何点...');

  if (totalCount > 0) {
    await knex.raw(`
      UPDATE pixels
      SET geom_quantized = ST_SetSRID(ST_MakePoint(lng_quantized, lat_quantized), 4326)
      WHERE geom_quantized IS NULL
        AND lng_quantized IS NOT NULL
        AND lat_quantized IS NOT NULL
    `);
    console.log('✅ 几何点创建完成');
  } else {
    console.log('ℹ️ 无现有数据需要创建几何点');
  }

  // 5. 创建空间索引 (SP-GIST 用于几何查询)
  console.log('\n5. 创建空间索引...');
  try {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_geom_spgist
      ON pixels
      USING spgist (geom_quantized)
      WHERE geom_quantized IS NOT NULL;
    `);
    console.log('✅ SP-GIST 空间索引创建完成');
  } catch (error) {
    console.warn('⚠️ SP-GIST 索引创建失败:', error.message);
  }

  // 6. 创建复合索引用于 MVT 查询优化
  console.log('\n6. 创建 MVT 复合索引...');
  try {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_mvt_composite
      ON pixels (created_at DESC)
      INCLUDE (id, color, pattern_id, lng_quantized, lat_quantized);
    `);
    console.log('✅ MVT 复合索引创建完成');
  } catch (error) {
    console.warn('⚠️ MVT 复合索引创建失败:', error.message);
    // INCLUDE 语法可能不被支持，尝试普通索引
    try {
      await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_pixels_mvt_fallback
        ON pixels (created_at DESC);
      `);
      console.log('✅ MVT 普通索引创建完成 (INCLUDE 不可用时的回退方案)');
    } catch (error2) {
      console.warn('⚠️ MVT 普通索引也创建失败:', error2.message);
    }
  }

  // 7. 创建触发器，自动维护量化坐标和几何点
  console.log('\n7. 创建自动更新触发器...');

  // 删除旧触发器（如果存在）
  await knex.raw(`DROP TRIGGER IF EXISTS pixels_update_geom_quantized ON pixels;`);
  await knex.raw(`DROP FUNCTION IF EXISTS pixels_update_geom_trigger();`);

  // 创建触发器函数
  await knex.raw(`
    CREATE OR REPLACE FUNCTION pixels_update_geom_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      -- 自动填充量化坐标
      NEW.lng_quantized := CAST(NEW.longitude AS numeric(10,7));
      NEW.lat_quantized := CAST(NEW.latitude AS numeric(10,7));

      -- 自动创建几何点
      NEW.geom_quantized := ST_SetSRID(ST_MakePoint(NEW.lng_quantized, NEW.lat_quantized), 4326);

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 创建触发器
  await knex.raw(`
    CREATE TRIGGER pixels_update_geom_quantized
    BEFORE INSERT OR UPDATE OF longitude, latitude
    ON pixels
    FOR EACH ROW
    EXECUTE FUNCTION pixels_update_geom_trigger();
  `);
  console.log('✅ 自动更新触发器创建完成');

  console.log('\n=== 迁移完成 ===\n');
  console.log('添加的列:');
  console.log('  - lng_quantized: 量化经度 (numeric(10,7))');
  console.log('  - lat_quantized: 量化纬度 (numeric(10,7))');
  console.log('  - geom_quantized: PostGIS 几何点 (geometry(Point,4326))');
  console.log('\n创建的索引:');
  console.log('  - idx_pixels_geom_spgist: SP-GIST 空间索引');
  console.log('  - idx_pixels_mvt_composite: MVT 查询优化索引');
  console.log('\n创建的触发器:');
  console.log('  - pixels_update_geom_quantized: 自动维护量化坐标和几何点');
  console.log('');
};

/**
 * 降级函数
 */
exports.down = async function(knex) {
  console.log('\n=== 回滚 MVT 瓦片渲染列 ===\n');

  // 删除触发器
  console.log('1. 删除触发器...');
  await knex.raw(`DROP TRIGGER IF EXISTS pixels_update_geom_quantized ON pixels;`);
  await knex.raw(`DROP FUNCTION IF EXISTS pixels_update_geom_trigger();`);
  console.log('✅ 触发器已删除');

  // 删除索引
  console.log('\n2. 删除索引...');
  await knex.raw(`DROP INDEX IF EXISTS idx_pixels_geom_spgist;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_pixels_mvt_composite;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_pixels_mvt_fallback;`);
  console.log('✅ 索引已删除');

  // 删除列
  console.log('\n3. 删除列...');
  await knex.raw(`ALTER TABLE pixels DROP COLUMN IF EXISTS geom_quantized;`);
  await knex.raw(`ALTER TABLE pixels DROP COLUMN IF EXISTS lat_quantized;`);
  await knex.raw(`ALTER TABLE pixels DROP COLUMN IF EXISTS lng_quantized;`);
  console.log('✅ 列已删除');

  console.log('\n=== 回滚完成 ===\n');
};
