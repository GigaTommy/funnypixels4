/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('pixels', function(table) {
    // 添加图案相关字段
    table.string('pattern_id', 100).nullable(); // 图案ID
    table.integer('pattern_anchor_x').defaultTo(0); // 图案锚点X
    table.integer('pattern_anchor_y').defaultTo(0); // 图案锚点Y
    table.integer('pattern_rotation').defaultTo(0); // 图案旋转角度
    table.boolean('pattern_mirror').defaultTo(false); // 图案镜像
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pixels', function(table) {
    table.dropColumn('pattern_id');
    table.dropColumn('pattern_anchor_x');
    table.dropColumn('pattern_anchor_y');
    table.dropColumn('pattern_rotation');
    table.dropColumn('pattern_mirror');
  });
};
