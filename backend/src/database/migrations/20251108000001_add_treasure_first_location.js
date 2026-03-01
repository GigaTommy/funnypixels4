/**
 * 添加宝藏首次藏宝位置字段
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 为 qr_treasures 表添加首次藏宝位置字段
  await knex.schema.table('qr_treasures', function(table) {
    // 首次藏宝位置（用于显示移动宝藏的原始位置）
    table.decimal('first_hide_lat', 10, 8).nullable().comment('首次藏宝位置纬度');
    table.decimal('first_hide_lng', 11, 8).nullable().comment('首次藏宝位置经度');

    // 宝藏类型标识
    table.string('treasure_type', 20).defaultTo('fixed').comment('宝藏类型：fixed/mobile');

    // 移动次数统计
    table.integer('move_count').defaultTo(0).comment('移动次数（仅mobile类型）');

    // 二维码原始内容
    table.text('qr_content').nullable().comment('二维码原始内容');

    // 索引
    table.index(['treasure_type', 'status']);
    table.index(['first_hide_lat', 'first_hide_lng']);
    table.index(['move_count']);
  });

  // 为现有的宝藏数据填充默认值
  await knex.raw(`
    UPDATE qr_treasures SET
      treasure_type = CASE
        WHEN qr_code_type = 'fixed' THEN 'fixed'
        WHEN qr_code_type = 'mobile' THEN 'mobile'
        ELSE 'fixed'
      END,
      move_count = 0,
      qr_content = SUBSTRING(qr_preview, 1, 100)
    WHERE treasure_type IS NULL OR qr_content IS NULL
  `);

  // 对于固定宝藏，首次位置就是当前位置
  await knex.raw(`
    UPDATE qr_treasures
    SET first_hide_lat = hide_lat,
        first_hide_lng = hide_lng
    WHERE treasure_type = 'fixed'
    AND (first_hide_lat IS NULL OR first_hide_lng IS NULL)
  `);
};

/**
 * 回滚迁移
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.table('qr_treasures', function(table) {
    table.dropColumn('first_hide_lat');
    table.dropColumn('first_hide_lng');
    table.dropColumn('treasure_type');
    table.dropColumn('move_count');
    table.dropColumn('qr_content');
  });
};