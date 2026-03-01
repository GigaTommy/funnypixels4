// user_items - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_items').del();
  console.log('✅ user_items 表已清空（无种子数据）');
};