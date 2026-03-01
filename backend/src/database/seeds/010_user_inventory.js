// user_inventory - 无数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_inventory').del();
  console.log('✅ user_inventory 表已清空（无种子数据）');
};