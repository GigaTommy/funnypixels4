exports.up = async function (knex) {
  await knex.schema.createTable('content_translations', (table) => {
    table.increments('id').primary();
    table.string('content_type', 50).notNullable();
    table.integer('content_id').notNullable();
    table.string('lang_code', 10).notNullable();
    table.string('field_name', 100).notNullable();
    table.text('value').notNullable();
    table.timestamps(true, true);

    table.unique(['content_type', 'content_id', 'lang_code', 'field_name']);
    table.index(['content_type', 'content_id', 'lang_code']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('content_translations');
};
