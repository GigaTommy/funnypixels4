/**
 * 创建城市热点统计预聚合表
 * 用于高效的增量统计，避免全表扫描pixels_history
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('city_hotspot_stats');
  if (hasTable) return;

  await knex.schema.createTable('city_hotspot_stats', function(table) {
    // 主键
    table.increments('id').primary();

    // 时间维度
    table.date('stat_date').notNullable().index();           // 统计日期
    table.string('period', 20).notNullable().defaultTo('daily').index(); // 统计周期: daily/weekly/monthly

    // 地理维度
    table.string('city', 100).notNullable().index();          // 城市名称
    table.string('province', 100).notNullable();              // 省份名称
    table.string('country', 50).defaultTo('中国');             // 国家名称

    // 统计指标
    table.integer('pixel_count').notNullable().defaultTo(0).index();     // 像素总数
    table.integer('user_count').notNullable().defaultTo(0);               // 用户总数
    table.integer('new_pixels_today').notNullable().defaultTo(0);         // 今日新增像素
    table.integer('new_users_today').notNullable().defaultTo(0);         // 今日新增用户

    // 位置信息（用于地图漫游）
    table.decimal('center_lat', 10, 6).notNullable();                     // 城市中心纬度
    table.decimal('center_lng', 10, 6).notNullable();                     // 城市中心经度
    table.decimal('min_lat', 10, 6).notNullable();                         // 最小纬度
    table.decimal('max_lat', 10, 6).notNullable();                         // 最大纬度
    table.decimal('min_lng', 10, 6).notNullable();                         // 最小经度
    table.decimal('max_lng', 10, 6).notNullable();                         // 最大经度

    // 排名信息
    table.integer('rank').nullable();                                       // 当前排名
    table.integer('rank_change').defaultTo(0);                              // 排名变化

    // 元数据
    table.boolean('is_fixed_city').defaultTo(false).index();               // 是否为固定城市
    table.jsonb('active_users').nullable();                                // 活跃用户列表（采样）
    table.jsonb('meta').nullable();                                         // 其他元数据

    // 时间戳
    table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now()); // 最后更新时间
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());   // 创建时间
  });

  // 创建复合索引用于高效查询
  await knex.raw(`
    CREATE UNIQUE INDEX idx_city_hotspot_stats_unique ON city_hotspot_stats(stat_date, period, city);
  `);

  await knex.raw(`
    CREATE INDEX idx_city_hotspot_stats_date_period ON city_hotspot_stats(stat_date, period);
  `);

  await knex.raw(`
    CREATE INDEX idx_city_hotspot_stats_ranking ON city_hotspot_stats(period, stat_date, pixel_count DESC);
  `);

  await knex.raw(`
    CREATE INDEX idx_city_hotspot_stats_fixed ON city_hotspot_stats(is_fixed_city, period, stat_date);
  `);

  // 添加表注释
  await knex.raw(`COMMENT ON TABLE city_hotspot_stats IS '城市热点统计预聚合表，用于高效的增量统计和快速查询'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.stat_date IS '统计日期'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.period IS '统计周期: daily/weekly/monthly'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.pixel_count IS '累计像素总数'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.new_pixels_today IS '当日新增像素数'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.is_fixed_city IS '是否为固定城市（北京、上海、杭州、广州、香港）'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.rank IS '在当前周期内的排名'`);
  await knex.raw(`COMMENT ON COLUMN city_hotspot_stats.last_updated IS '统计数据的最后更新时间'`);

  console.log('✅ city_hotspot_stats 预聚合表创建成功');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('city_hotspot_stats');
  console.log('✅ city_hotspot_stats 预聚合表已删除');
};