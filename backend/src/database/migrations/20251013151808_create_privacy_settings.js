/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 创建隐私设置表
  await knex.schema.createTable('privacy_settings', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().unique();
    table.enum('dm_receive_from', ['anyone', 'followers', 'verified']).defaultTo('anyone');
    table.boolean('allow_message_requests').defaultTo(true);
    table.boolean('filter_low_quality').defaultTo(true);
    table.boolean('read_receipts_enabled').defaultTo(true);

    // 像素隐私设置字段
    table.boolean('hide_nickname').defaultTo(false).comment('绘制像素时隐藏昵称');
    table.boolean('hide_alliance').defaultTo(false).comment('绘制像素时隐藏联盟信息');
    table.boolean('hide_alliance_flag').defaultTo(false).comment('绘制像素时隐藏联盟旗帜');

    table.timestamps(true, true);

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index('user_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('privacy_settings');
};