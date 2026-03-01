/**
 * 更新商店商品的积分价格
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex('store_items')
    .whereIn('id', [43, 44, 45, 46, 47, 48])
    .update({
      price_points: knex.raw(`
        CASE id 
          WHEN 43 THEN 50   -- 快速恢复剂
          WHEN 44 THEN 100  -- 超级恢复剂
          WHEN 45 THEN 200  -- 颜色炸弹
          WHEN 46 THEN 300  -- 金色头像框
          WHEN 47 THEN 250  -- 彩虹聊天气泡
          WHEN 48 THEN 500  -- 像素大师徽章
        END
      `)
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex('store_items')
    .whereIn('id', [43, 44, 45, 46, 47, 48])
    .update({
      price_points: 0
    });
};
