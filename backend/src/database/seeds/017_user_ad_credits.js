// user_ad_credits - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_ad_credits').del();
  console.log('✅ user_ad_credits 表已清空（无种子数据）');
};