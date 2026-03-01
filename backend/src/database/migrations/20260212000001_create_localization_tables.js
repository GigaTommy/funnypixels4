/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Localization strings table - stores all translated key-value pairs
  await knex.schema.createTable('localization_strings', function(table) {
    table.increments('id').primary();
    table.string('key', 255).notNullable().comment('Translation key');
    table.string('lang_code', 10).notNullable().comment('Language code (en, zh-Hans, ja, ko, es, pt-BR)');
    table.text('value').notNullable().comment('Translated string value');
    table.text('context').comment('Context hint for translators');
    table.timestamps(true, true);

    table.unique(['key', 'lang_code']);
    table.index(['lang_code']);
    table.index(['key']);
  });

  // Localization versions table - tracks bundle version per language for cache invalidation
  await knex.schema.createTable('localization_versions', function(table) {
    table.increments('id').primary();
    table.string('lang_code', 10).notNullable().unique().comment('Language code');
    table.integer('version').notNullable().defaultTo(1).comment('Bundle version number');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Seed initial version rows for supported languages
  await knex('localization_versions').insert([
    { lang_code: 'en', version: 1 },
    { lang_code: 'zh-Hans', version: 1 },
    { lang_code: 'ja', version: 1 },
    { lang_code: 'ko', version: 1 },
    { lang_code: 'es', version: 1 },
    { lang_code: 'pt-BR', version: 1 }
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('localization_versions');
  await knex.schema.dropTableIfExists('localization_strings');
};
