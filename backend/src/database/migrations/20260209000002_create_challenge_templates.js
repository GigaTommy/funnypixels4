exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('challenge_templates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('type', 50).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').notNullable();
    table.integer('target_value').notNullable();
    table.integer('reward_points').notNullable().defaultTo(20);
    table.jsonb('reward_items').defaultTo('[]');
    table.integer('weight').defaultTo(1);
    table.string('difficulty', 20).defaultTo('normal');
    table.boolean('is_active').defaultTo(true);
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('is_active', 'idx_challenge_tpl_active');
    table.index('type', 'idx_challenge_tpl_type');
  }).then(function() {
    // Seed default challenge templates from hardcoded values
    return knex('challenge_templates').insert([
      {
        type: 'draw_count',
        title: '勤劳画匠',
        description: '今日累积绘制 50 个像素',
        target_value: 50,
        reward_points: 20,
        reward_items: '[]',
        weight: 1,
        difficulty: 'normal',
        is_active: true,
        metadata: '{}'
      },
      {
        type: 'region_draw',
        title: '城市足迹',
        description: '在当前活跃区域内绘制 20 个像素',
        target_value: 20,
        reward_points: 20,
        reward_items: '[]',
        weight: 1,
        difficulty: 'normal',
        is_active: true,
        metadata: '{}'
      },
      {
        type: 'pattern_draw',
        title: '艺术创作',
        description: '今日绘制 1 个自定义图案',
        target_value: 1,
        reward_points: 20,
        reward_items: '[]',
        weight: 1,
        difficulty: 'easy',
        is_active: true,
        metadata: '{}'
      }
    ]);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('challenge_templates');
};
