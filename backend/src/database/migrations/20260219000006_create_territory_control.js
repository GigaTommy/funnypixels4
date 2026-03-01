/**
 * 领地控制系统 - H3六边形网格领地表
 */
exports.up = async function(knex) {
  await knex.schema.createTable('territory_control', table => {
    table.string('h3_index', 20).primary();
    table.integer('alliance_id').unsigned()
      .references('id').inTable('alliances').onDelete('SET NULL');
    table.string('alliance_name', 100);
    table.string('flag_pattern_id', 50);
    table.string('flag_colors', 255);
    table.integer('pixel_count').notNullable().defaultTo(0);
    table.integer('total_pixels_in_cell').notNullable().defaultTo(0);
    table.float('control_percentage').notNullable().defaultTo(0);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('alliance_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('territory_control');
};
