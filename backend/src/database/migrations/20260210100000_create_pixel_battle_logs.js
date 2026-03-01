/**
 * 领土动态 - 像素覆盖战斗日志表
 * 记录用户像素被他人覆盖的事件
 */

exports.up = function(knex) {
  return knex.schema
    .createTableIfNotExists('pixel_battle_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.uuid('attacker_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');

      table.uuid('victim_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');

      table.string('grid_id', 100).notNullable();

      table.float('latitude').notNullable();
      table.float('longitude').notNullable();

      table.string('old_color', 20);
      table.string('new_color', 20);

      table.string('old_pattern_id', 255);
      table.string('new_pattern_id', 255);

      // 地理位置名称（异步填充）
      table.string('region_name', 255);

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['victim_id', 'created_at'], 'idx_battle_victim_time');
      table.index('attacker_id', 'idx_battle_attacker');
      table.index('created_at', 'idx_battle_created');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('pixel_battle_logs');
};
