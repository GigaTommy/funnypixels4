/**
 * Rebalance store item prices to align with compressed reward economy.
 *
 * Pricing anchor: daily free income ≈ 125 points
 *
 * Tier         | Days to earn | Price range
 * -------------|-------------|------------
 * Consumable   | 0.25–0.5    | 30–60
 * Tactical     | 2–5         | 250–600
 * Cosmetic     | 4–12        | 500–1500
 */

const PRICE_UPDATES = [
  // Consumables — affordable daily purchases
  { id: 25, price: 30, price_points: 30 },   // 快速恢复剂: 16px, 3/day
  { id: 26, price: 60, price_points: 60 },   // 超级恢复剂: 32px, 1/day

  // Tactical bombs — multi-day saving goal
  { id: 27, price: 250, price_points: 250 },  // 颜色炸弹: 6×6, entry tier
  { id: 28, price: 400, price_points: 400 },  // Emoji炸弹: 6×6, expressiveness premium
  { id: 29, price: 600, price_points: 600 },  // 联盟炸弹: 6×6, territory/identity

  // Cosmetics — aspirational, social status
  { id: 30, price: 800, price_points: 800 },   // 金色头像框: ~6.4 days
  { id: 31, price: 500, price_points: 500 },   // 彩虹聊天气泡: ~4 days
  { id: 32, price: 1500, price_points: 1500 }, // 像素大师徽章: ~12 days
];

// Original prices for rollback
const ORIGINAL_PRICES = [
  { id: 25, price: 100, price_points: 100 },
  { id: 26, price: 200, price_points: 200 },
  { id: 27, price: 500, price_points: 500 },
  { id: 28, price: 800, price_points: 800 },
  { id: 29, price: 1000, price_points: 1000 },
  { id: 30, price: 1000, price_points: 1000 },
  { id: 31, price: 800, price_points: 800 },
  { id: 32, price: 2000, price_points: 2000 },
];

exports.up = async function (knex) {
  for (const item of PRICE_UPDATES) {
    await knex('store_items')
      .where('id', item.id)
      .update({
        price: item.price,
        price_points: item.price_points,
        updated_at: knex.fn.now(),
      });
  }
};

exports.down = async function (knex) {
  for (const item of ORIGINAL_PRICES) {
    await knex('store_items')
      .where('id', item.id)
      .update({
        price: item.price,
        price_points: item.price_points,
        updated_at: knex.fn.now(),
      });
  }
};
