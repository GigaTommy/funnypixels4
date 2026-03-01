/**
 * 更新regions表结构以支持全球GeoNames数据
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('regions', function(table) {
      // 添加全球数据所需的字段
      table.string('ascii_name').nullable().comment('ASCII名称');
      table.string('country_code', 2).nullable().comment('ISO国家代码');
      table.string('admin1_code', 20).nullable().comment('一级行政区划代码');
      table.string('admin2_code', 20).nullable().comment('二级行政区划代码');
      table.integer('elevation').nullable().comment('海拔高度(米)');
      table.integer('dem').nullable().comment('数字高程模型');
      table.string('feature_class', 1).nullable().comment('地理要素类别');
      table.string('feature_code', 10).nullable().comment('地理要素代码');

      // 添加索引以提高查询性能（使用 IF NOT EXISTS 避免重复）
      return knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_regions_country_code ON regions (country_code);
        CREATE INDEX IF NOT EXISTS idx_regions_feature ON regions (feature_class, feature_code);
        CREATE INDEX IF NOT EXISTS idx_regions_coordinates ON regions (center_lat, center_lng);
        CREATE INDEX IF NOT EXISTS idx_regions_population ON regions (population);
      `);

      // 修改现有字段注释
      table.string('country', 100).nullable().alter().comment('国家名称(中英文)');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('regions', function(table) {
      // 删除添加的字段
      table.dropColumn('ascii_name');
      table.dropColumn('country_code');
      table.dropColumn('admin1_code');
      table.dropColumn('admin2_code');
      table.dropColumn('elevation');
      table.dropColumn('dem');
      table.dropColumn('feature_class');
      table.dropColumn('feature_code');

      // 删除索引（Knex会自动删除）
    });
};