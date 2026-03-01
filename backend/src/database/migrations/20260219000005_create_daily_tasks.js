/**
 * 每日任务系统 - 用户任务实例表
 */
exports.up = async function(knex) {
  await knex.schema.createTable('user_daily_tasks', table => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 30).notNullable();
    table.string('title', 100).notNullable();
    table.string('description', 255);
    table.integer('target').notNullable();
    table.integer('current').notNullable().defaultTo(0);
    table.boolean('is_completed').notNullable().defaultTo(false);
    table.boolean('is_claimed').notNullable().defaultTo(false);
    table.integer('reward_points').notNullable().defaultTo(10);
    table.date('task_date').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.timestamp('claimed_at');

    table.index(['user_id', 'task_date']);
  });

  await knex.schema.createTable('user_daily_task_bonus', table => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.date('bonus_date').notNullable();
    table.integer('bonus_points').notNullable().defaultTo(50);
    table.boolean('is_claimed').notNullable().defaultTo(false);
    table.timestamp('claimed_at');

    table.unique(['user_id', 'bonus_date']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_daily_task_bonus');
  await knex.schema.dropTableIfExists('user_daily_tasks');
};
