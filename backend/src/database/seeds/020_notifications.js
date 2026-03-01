// notifications - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('notifications').del();
  console.log('✅ notifications 表已清空（无种子数据）');
};