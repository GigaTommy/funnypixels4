/**
 * 添加地区字段到pixels表
 * 用于地区排行榜功能
 */
exports.up = function(knex) {
  return knex.schema.table('pixels', function(table) {
    // 地区信息字段
    table.string('country', 50).comment('国家');
    table.string('province', 50).comment('省份/州');
    table.string('city', 50).comment('城市');
    table.string('district', 50).comment('区/县');
    table.string('adcode', 20).comment('行政区划代码');
    table.string('formatted_address', 500).comment('完整地址');

    // 地理编码状态
    table.boolean('geocoded').defaultTo(false).comment('是否已逆地理编码');
    table.timestamp('geocoded_at').comment('逆地理编码时间');

    // 添加索引以提高查询性能
    table.index('province');
    table.index('city');
    table.index('geocoded');
  });
};

exports.down = function(knex) {
  return knex.schema.table('pixels', function(table) {
    table.dropIndex('province', 'idx_pixels_province');
    table.dropIndex('city', 'idx_pixels_city');
    table.dropIndex('geocoded', 'idx_pixels_geocoded');

    table.dropColumn('country');
    table.dropColumn('province');
    table.dropColumn('city');
    table.dropColumn('district');
    table.dropColumn('adcode');
    table.dropColumn('formatted_address');
    table.dropColumn('geocoded');
    table.dropColumn('geocoded_at');
  });
};
