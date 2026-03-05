/**
 * 创建领地控制历史表
 * 用于World State Feed的领地变化事件
 */

exports.up = async function(knex) {
  // 创建territory_control_history表
  await knex.schema.createTable('territory_control_history', (table) => {
    table.increments('id').primary();
    table.string('territory_name', 255).notNullable().comment('领地名称');
    table.integer('alliance_id').notNullable().comment('联盟ID');
    table.integer('previous_alliance_id').nullable().comment('前一个控制联盟ID');
    table.timestamp('changed_at').defaultTo(knex.fn.now()).notNullable().comment('控制权变化时间');
    table.jsonb('metadata').nullable().comment('额外元数据（如战斗信息）');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 索引
    table.index('changed_at', 'idx_territory_changed_at'); // 用于按时间查询
    table.index('alliance_id', 'idx_territory_alliance_id'); // 用于按联盟查询
    table.index('territory_name', 'idx_territory_name'); // 用于按领地查询

    // 外键
    table.foreign('alliance_id').references('id').inTable('alliances').onDelete('CASCADE');
    table.foreign('previous_alliance_id').references('id').inTable('alliances').onDelete('SET NULL');
  });

  console.log('✅ 创建territory_control_history表成功');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('territory_control_history');
  console.log('✅ 删除territory_control_history表成功');
};
