// user_shares - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_shares').del();
  console.log('✅ user_shares 表已清空（无种子数据）');
};