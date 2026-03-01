/**
 * 二维码寻宝系统数据库迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. 创建二维码识别缓存表
  await knex.schema.createTable('qr_code_patterns', function(table) {
    table.increments('id').primary();
    table.string('qr_hash', 64).notNullable().unique().comment('二维码哈希');
    table.string('pattern_type', 50).notNullable().comment('识别出的类型');
    table.boolean('is_unique').notNullable().comment('是否唯一');
    table.decimal('confidence', 3, 2).defaultTo(0.5).comment('识别置信度');
    table.string('sample_content', 200).comment('样本内容（脱敏）');
    table.timestamp('first_seen_at').defaultTo(knex.fn.now()).comment('首次出现时间');
    table.timestamp('last_seen_at').defaultTo(knex.fn.now()).comment('最后出现时间');
    table.integer('scan_count').defaultTo(1).comment('扫描次数统计');
    table.integer('unique_location_count').defaultTo(1).comment('出现在不同位置的次数');

    table.index(['pattern_type', 'is_unique']);
    table.index(['scan_count', 'unique_location_count']);
  });

  // 2. 创建宝藏表
  await knex.schema.createTable('qr_treasures', function(table) {
    table.increments('id').primary();
    table.string('treasure_id', 32).notNullable().unique().comment('宝藏唯一ID');

    // 二维码信息
    table.string('qr_code_hash', 64).notNullable().comment('二维码内容的哈希值');
    table.string('qr_code_type', 20).notNullable().comment('moving/fixed');
    table.string('qr_pattern_type', 50).comment('识别的二维码类型');
    table.string('qr_preview', 100).comment('二维码前缀预览（脱敏）');

    // GPS信息（仅fixed模式必须）
    table.decimal('hide_lat', 10, 8).comment('藏宝位置纬度');
    table.decimal('hide_lng', 11, 8).comment('藏宝位置经度');
    table.decimal('location_grid_lat', 6, 4).comment('网格纬度（精度约100米）');
    table.decimal('location_grid_lng', 7, 4).comment('网格经度（精度约100米）');
    table.integer('location_radius').defaultTo(50).comment('有效拾取半径（米，仅fixed模式）');
    table.string('city', 100).comment('城市');
    table.string('country', 100).comment('国家');

    // 藏宝者信息
    table.uuid('hider_id').notNullable().comment('藏宝者ID');
    table.string('hider_name', 100).comment('藏宝者昵称');

    // 宝藏内容
    table.string('title', 200).notNullable().comment('宝藏标题');
    table.text('description').comment('宝藏描述/线索');
    table.string('hint', 500).comment('提示信息');
    table.string('reward_type', 50).notNullable().comment('奖励类型：points/item/custom');
    table.json('reward_value').notNullable().comment('奖励内容');
    table.string('image_url', 500).comment('宝藏图片');

    // 状态管理
    table.string('status', 20).defaultTo('active').comment('状态：active/found/expired');
    table.uuid('finder_id').comment('寻获者ID');
    table.string('finder_name', 100).comment('寻获者昵称');
    table.decimal('find_location_lat', 10, 8).comment('寻获位置纬度');
    table.decimal('find_location_lng', 11, 8).comment('寻获位置经度');

    // 时间信息
    table.timestamp('hidden_at').defaultTo(knex.fn.now()).comment('藏宝时间');
    table.timestamp('found_at').comment('寻获时间');
    table.timestamp('expires_at').comment('过期时间');

    // 统计信息
    table.integer('view_count').defaultTo(0).comment('被查看次数');
    table.integer('attempt_count').defaultTo(0).comment('尝试次数');

    // 外键
    table.foreign('hider_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('finder_id').references('id').inTable('users').onDelete('SET NULL');

    // 索引优化
    table.index(['qr_code_hash']);
    table.index(['qr_code_type', 'status']);
    table.index(['qr_code_hash', 'status'], 'idx_moving_treasure_lookup');
    table.index(['qr_code_hash', 'location_grid_lat', 'location_grid_lng', 'status'], 'idx_fixed_treasure_grid');
    table.index(['status', 'hidden_at']);
    table.index(['hider_id']);
    table.index(['finder_id']);
  });

  // 3. 创建扫码历史表
  await knex.schema.createTable('qr_scan_history', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().comment('用户ID');
    table.string('qr_code_hash', 64).notNullable().comment('二维码哈希');
    table.decimal('scan_lat', 10, 8).notNullable().comment('扫描位置纬度');
    table.decimal('scan_lng', 11, 8).notNullable().comment('扫描位置经度');
    table.string('scan_mode', 20).notNullable().comment('hide/find');
    table.string('scan_result', 50).notNullable().comment('found/no_treasure/wrong_location/expired/hidden');
    table.string('treasure_id', 32).comment('关联的宝藏ID（如果有）');
    table.integer('distance_to_treasure').comment('距离宝藏的距离（米）');
    table.string('detected_qr_type', 50).comment('检测到的二维码类型');
    table.timestamp('scanned_at').defaultTo(knex.fn.now()).comment('扫描时间');

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['user_id', 'scanned_at']);
    table.index(['treasure_id', 'scanned_at']);
    table.index(['qr_code_hash', 'scan_mode', 'scanned_at']);
  });

  // 4. 创建宝藏日志表
  await knex.schema.createTable('qr_treasure_logs', function(table) {
    table.increments('id').primary();
    table.string('treasure_id', 32).notNullable().comment('宝藏ID');
    table.uuid('user_id').notNullable().comment('用户ID');
    table.string('action', 50).notNullable().comment('hide/view/attempt/found/expired');
    table.decimal('lat', 10, 8).comment('位置纬度');
    table.decimal('lng', 11, 8).comment('位置经度');
    table.json('details').comment('详细信息');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['treasure_id', 'created_at']);
    table.index(['user_id', 'action', 'created_at']);
  });

  console.log('✅ 二维码寻宝系统表创建成功');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('qr_treasure_logs');
  await knex.schema.dropTableIfExists('qr_scan_history');
  await knex.schema.dropTableIfExists('qr_treasures');
  await knex.schema.dropTableIfExists('qr_code_patterns');
  console.log('✅ 二维码寻宝系统表已删除');
};
