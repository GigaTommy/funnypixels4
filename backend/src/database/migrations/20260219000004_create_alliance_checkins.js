/**
 * 联盟签到表
 */
exports.up = async function(knex) {
  await knex.schema.createTable('alliance_checkins', table => {
    table.increments('id').primary();
    table.integer('alliance_id').notNullable()
      .references('id').inTable('alliances').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.date('checkin_date').notNullable();
    table.integer('exp_earned').notNullable().defaultTo(10);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 每人每天只能签到一次
    table.unique(['alliance_id', 'user_id', 'checkin_date']);
    table.index(['alliance_id', 'checkin_date']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('alliance_checkins');
};
