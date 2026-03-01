exports.up = async function(knex) {
  // Auto-settled daily ranking rewards
  await knex.schema.createTableIfNotExists('daily_reward_credits', function(table) {
    table.bigIncrements('id').primary();
    table.uuid('user_id').notNullable();
    table.date('reward_date').notNullable();
    table.integer('personal_rank').nullable();
    table.integer('alliance_rank').nullable();
    table.integer('friends_rank').nullable();
    table.integer('personal_points').notNullable().defaultTo(0);
    table.integer('alliance_points').notNullable().defaultTo(0);
    table.integer('friends_points').notNullable().defaultTo(0);
    table.integer('total_points').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['user_id', 'reward_date']);
    table.index(['reward_date']);
  });

  // Tracks whether user has seen the summary
  await knex.schema.createTableIfNotExists('daily_reward_acknowledgements', function(table) {
    table.bigIncrements('id').primary();
    table.uuid('user_id').notNullable();
    table.date('reward_date').notNullable();
    table.timestamp('acknowledged_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['user_id', 'reward_date']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('daily_reward_acknowledgements');
  await knex.schema.dropTableIfExists('daily_reward_credits');
};
