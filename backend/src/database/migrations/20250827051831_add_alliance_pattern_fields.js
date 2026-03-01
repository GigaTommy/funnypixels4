/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    // 添加旗帜图案相关字段
    table.string('flag_pattern_id', 100).nullable(); // 旗帜图案ID
    table.integer('flag_pattern_anchor_x').defaultTo(0); // 旗帜图案锚点X
    table.integer('flag_pattern_anchor_y').defaultTo(0); // 旗帜图案锚点Y
    table.integer('flag_pattern_rotation').defaultTo(0); // 旗帜图案旋转角度
    table.boolean('flag_pattern_mirror').defaultTo(false); // 旗帜图案镜像
    table.boolean('approval_required').defaultTo(true); // 是否需要审批
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('alliances', function(table) {
    table.dropColumn('flag_pattern_id');
    table.dropColumn('flag_pattern_anchor_x');
    table.dropColumn('flag_pattern_anchor_y');
    table.dropColumn('flag_pattern_rotation');
    table.dropColumn('flag_pattern_mirror');
    table.dropColumn('approval_required');
  });
};
