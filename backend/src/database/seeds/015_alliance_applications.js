// alliance_applications - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('alliance_applications').del();
  console.log('✅ alliance_applications 表已清空（无种子数据）');
};