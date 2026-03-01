/**
 * 创建管理员待办处理历史表
 * 用于记录所有待办事项的审批历史
 */

exports.up = async function(knex) {
  // 创建管理员待办处理历史表
  await knex.schema.createTable('admin_todo_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 待办事项信息
    table.uuid('todo_id').notNullable().comment('原始待办事项ID');
    table.string('todo_type', 50).notNullable().comment('待办类型：ad_approval, custom_flag_approval, report_review');
    table.string('title', 255).notNullable().comment('待办标题');
    table.text('description').comment('待办描述');
    table.string('priority', 20).defaultTo('medium').comment('优先级：high, medium, low');

    // 提交者信息
    table.uuid('submitter_id').notNullable().comment('提交者用户ID');
    table.foreign('submitter_id').references('id').inTable('users').onDelete('CASCADE');

    // 处理者信息
    table.uuid('processor_id').notNullable().comment('处理者管理员ID');
    table.foreign('processor_id').references('id').inTable('users').onDelete('CASCADE');

    // 处理结果
    table.string('action', 20).notNullable().comment('操作类型：approve, reject, process');
    table.string('result_status', 20).notNullable().comment('结果状态：approved, rejected, processed');
    table.text('process_notes').comment('处理备注');

    // 时间戳
    table.timestamp('created_at').notNullable().comment('待办创建时间');
    table.timestamp('processed_at').notNullable().defaultTo(knex.fn.now()).comment('处理时间');

    // 索引
    table.index('todo_id');
    table.index('todo_type');
    table.index('submitter_id');
    table.index('processor_id');
    table.index('result_status');
    table.index('processed_at');
  });

  console.log('✅ 管理员待办处理历史表创建成功');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('admin_todo_history');
  console.log('✅ 管理员待办处理历史表已删除');
};
