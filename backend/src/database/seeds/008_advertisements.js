// advertisements - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('advertisements').del();
  console.log('✅ advertisements 表已清空（无种子数据）');
};