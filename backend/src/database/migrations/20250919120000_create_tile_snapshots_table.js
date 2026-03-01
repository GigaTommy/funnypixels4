const TABLE_NAME = 'tile_snapshots';

exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(TABLE_NAME, table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('tile_id').notNullable();
    table.integer('zoom').notNullable();
    table.integer('version').notNullable();
    table.string('checksum').notNullable();
    table.string('format').notNullable().defaultTo('image/png');
    table.string('storage_key').notNullable();
    table.string('cdn_url');
    table.bigInteger('size_bytes').notNullable();
    table.integer('render_time_ms').notNullable();
    table.timestamp('rendered_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.unique(['tile_id', 'version']);
    table.index(['tile_id', 'zoom'], 'idx_tile_snapshots_lookup');
    table.index('rendered_at', 'idx_tile_snapshots_rendered_at');
  });
};

exports.down = async function down(knex) {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  await knex.schema.dropTableIfExists(TABLE_NAME);
};
