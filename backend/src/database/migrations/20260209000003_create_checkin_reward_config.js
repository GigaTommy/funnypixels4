exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('checkin_reward_config', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('config_type', 50).notNullable();
    table.integer('day_number');
    table.integer('min_day');
    table.integer('max_day');
    table.integer('reward_points').notNullable().defaultTo(0);
    table.decimal('multiplier', 5, 2).defaultTo(1.0);
    table.integer('bonus_points').defaultTo(0);
    table.jsonb('reward_items').defaultTo('[]');
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.integer('priority').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('config_type', 'idx_checkin_config_type');
    table.index('is_active', 'idx_checkin_config_active');
  }).then(function() {
    // Seed default configs from hardcoded values
    return knex('checkin_reward_config').insert([
      {
        config_type: 'base',
        reward_points: 10,
        multiplier: 1.0,
        description: '每日基础签到奖励',
        is_active: true,
        priority: 0
      },
      {
        config_type: 'streak_bonus',
        min_day: 7,
        bonus_points: 5,
        reward_points: 0,
        description: '每连续签到7天额外奖励+5积分',
        is_active: true,
        priority: 1
      },
      {
        config_type: 'milestone',
        day_number: 7,
        reward_points: 0,
        multiplier: 3.0,
        reward_items: '[7]',
        description: '连续签到第7天，3倍奖励+道具',
        is_active: true,
        priority: 10
      },
      {
        config_type: 'milestone',
        day_number: 30,
        reward_points: 0,
        multiplier: 10.0,
        reward_items: '[10]',
        description: '连续签到第30天，10倍奖励+道具',
        is_active: true,
        priority: 20
      }
    ]);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('checkin_reward_config');
};
