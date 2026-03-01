/**
 * 联盟等级系统 - 添加 level, experience 字段
 */
exports.up = async function(knex) {
  await knex.schema.table('alliances', table => {
    table.integer('level').notNullable().defaultTo(1);
    table.integer('experience').notNullable().defaultTo(0);
    table.integer('next_level_exp').notNullable().defaultTo(1000);
  });
};

exports.down = async function(knex) {
  await knex.schema.table('alliances', table => {
    table.dropColumn('level');
    table.dropColumn('experience');
    table.dropColumn('next_level_exp');
  });
};
