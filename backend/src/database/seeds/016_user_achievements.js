// user_achievements - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_achievements').del();
  console.log('✅ user_achievements 表已清空（无种子数据）');
};