/**
 * PostGIS几何列和空间索引迁移
 * 目的：优化事件边界查询性能，实现10-50倍性能提升
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    console.log('🚀 开始PostGIS迁移...');

    // 1. 添加boundary_geom列（多边形几何）
    console.log('📍 添加 boundary_geom 列...');
    await knex.raw(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS boundary_geom geometry(Polygon, 4326);
    `);

    // 2. 创建boundary_geom的GiST空间索引
    console.log('🗺️  创建 boundary_geom GiST索引...');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS events_boundary_geom_idx
        ON events USING GIST(boundary_geom);
    `);

    // 3. 添加center_geom列（中心点几何）
    console.log('📍 添加 center_geom 列...');
    await knex.raw(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS center_geom geometry(Point, 4326);
    `);

    // 4. 创建center_geom的GiST空间索引
    console.log('🗺️  创建 center_geom GiST索引...');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS events_center_geom_idx
        ON events USING GIST(center_geom);
    `);

    // 5. 添加bbox列（边界框，用于快速预筛选）
    console.log('📦 添加 bbox 列...');
    await knex.raw(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS bbox box2d;
    `);

    // 6. 创建复合索引（优化常见查询：按状态和时间范围查找有边界的事件）
    console.log('🔍 创建复合索引...');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS events_spatial_search_idx
        ON events(status, start_time, end_time)
        WHERE boundary_geom IS NOT NULL;
    `);

    // 7. 为boundary_geom列添加注释
    await knex.raw(`
        COMMENT ON COLUMN events.boundary_geom IS
        'PostGIS几何列：活动边界多边形（从boundary的GeoJSON转换而来）';
    `);

    await knex.raw(`
        COMMENT ON COLUMN events.center_geom IS
        'PostGIS几何列：活动中心点（从config.area.center转换而来）';
    `);

    await knex.raw(`
        COMMENT ON COLUMN events.bbox IS
        '活动边界的外接矩形（BBox），用于快速预筛选';
    `);

    console.log('✅ PostGIS迁移完成！');
    console.log('📝 下一步: 运行数据迁移脚本将现有GeoJSON数据转换为PostGIS格式');
    console.log('   node scripts/migrate-to-postgis.js');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    console.log('⏪ 回滚PostGIS迁移...');

    // 删除索引
    await knex.raw(`DROP INDEX IF EXISTS events_boundary_geom_idx;`);
    await knex.raw(`DROP INDEX IF EXISTS events_center_geom_idx;`);
    await knex.raw(`DROP INDEX IF EXISTS events_spatial_search_idx;`);

    // 删除列
    await knex.raw(`ALTER TABLE events DROP COLUMN IF EXISTS boundary_geom;`);
    await knex.raw(`ALTER TABLE events DROP COLUMN IF EXISTS center_geom;`);
    await knex.raw(`ALTER TABLE events DROP COLUMN IF EXISTS bbox;`);

    console.log('✅ PostGIS迁移已回滚');
};
