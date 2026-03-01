/**
 * Create Preset Regions System
 * 支持赛事活动的预设区域管理：
 * 1. preset_regions: 预设区域表（公园、商圈、景区等）
 * 2. 支持从高德/OSM等数据源导入
 * 3. 支持手动创建自定义区域
 */
exports.up = async function (knex) {
    // Create 'preset_regions' table
    const hasTable = await knex.schema.hasTable('preset_regions');
    if (!hasTable) {
        await knex.schema.createTable('preset_regions', table => {
            table.bigIncrements('id').primary();

            // 基础信息
            table.string('name', 200).notNullable();           // 区域名称（如"西湖风景区"）
            table.string('code', 50).unique();                 // 区域编码（高德adcode等）
            table.string('level', 20);                         // 级别: city/district/poi_area
            table.string('category', 50);                      // 分类: park/shopping/tourist/business/residential

            // 地理边界
            table.jsonb('boundary');                           // GeoJSON Polygon/MultiPolygon
            table.decimal('center_lat', 10, 8);                // 中心点纬度
            table.decimal('center_lng', 11, 8);                // 中心点经度
            table.decimal('area_km2', 12, 4);                  // 面积（平方公里）

            // 数据来源
            table.string('source', 50);                        // 来源: amap/osm/user_created
            table.string('source_id', 100);                    // 原数据源ID（如高德POI ID）
            table.string('source_name', 200);                  // 原数据源中的名称

            // 扩展信息
            table.jsonb('tags').defaultTo('[]');               // 标签数组
            table.text('description');                         // 区域描述
            table.string('address', 500);                      // 地址
            table.string('city', 100);                         // 所属城市
            table.string('province', 100);                     // 所属省份

            // 显示属性
            table.string('color', 7);                          // 显示颜色（16进制）
            table.string('icon_url', 500);                     // 图标URL
            table.string('cover_url', 500);                    // 封面图URL

            // 统计信息
            table.integer('usage_count').defaultTo(0);         // 被使用次数
            table.integer('pixel_count').defaultTo(0);         // 区域内像素数

            // 状态管理
            table.boolean('is_active').defaultTo(true);
            table.boolean('is_featured').defaultTo(false);     // 是否推荐
            table.integer('sort_order').defaultTo(0);          // 排序权重

            // 时间戳
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());

            // 索引
            table.index('level');
            table.index('category');
            table.index('source');
            table.index('city');
            table.index('is_active');
            table.index('is_featured');
            table.index(['center_lat', 'center_lng']);
        });
    }

    // Create index for GeoJSON boundary (for spatial queries)
    // Note: Full GiST index requires PostGIS, this is a basic JSONB index
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_preset_regions_boundary
        ON preset_regions USING GIN (boundary);
    `).catch(() => {
        // Ignore if already exists
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('preset_regions');
};
