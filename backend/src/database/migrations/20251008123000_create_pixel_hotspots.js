/**
 * 创建像素热点表，用于存储每日热门区域定位
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('pixel_hotspots');
  if (hasTable) return;

  await knex.schema.createTable('pixel_hotspots', function(table) {
    table.increments('id').primary();
    table.date('hotspot_date').notNullable().index();
    table.string('period').notNullable().defaultTo('daily').index();
    table.integer('rank').notNullable().defaultTo(1).index();
    table.decimal('center_lat', 10, 6).notNullable();
    table.decimal('center_lng', 10, 6).notNullable();
    table.integer('pixel_count').notNullable().defaultTo(0).index();
    table.integer('unique_users').notNullable().defaultTo(0);
    table.string('region_level').nullable();
    table.string('region_code').nullable();
    table.string('region_name').nullable();
    table.jsonb('meta').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['hotspot_date', 'period', 'rank']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('pixel_hotspots');
};


