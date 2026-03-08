/**
 * 下架未实现功能的商品：
 * - store_items ID 30/31/32 (装饰品：金色头像框、彩虹聊天气泡、像素大师徽章 — 功能未实现)
 * - shop_skus ID 81-88 (联盟旗帜 — 已被头像/默认颜色绘制取代)
 */
exports.up = async function (knex) {
  await knex('store_items')
    .whereIn('id', [30, 31, 32])
    .update({ active: false, is_available: false });

  await knex('shop_skus')
    .whereIn('id', [81, 82, 83, 84, 85, 86, 87, 88])
    .update({ active: false, is_available: false });
};

exports.down = async function (knex) {
  await knex('store_items')
    .whereIn('id', [30, 31, 32])
    .update({ active: true, is_available: true });

  await knex('shop_skus')
    .whereIn('id', [81, 82, 83, 84, 85, 86, 87, 88])
    .update({ active: true, is_available: true });
};
