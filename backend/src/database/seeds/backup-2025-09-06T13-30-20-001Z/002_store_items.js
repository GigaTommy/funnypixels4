exports.seed = function(knex) {
  // 删除现有数据
  return knex('store_items').del()
    .then(function () {
      // 插入种子数据
      return knex('store_items').insert([
        {
          name: '快速恢复剂',
          description: '立即恢复16个绘制点数，每日限用3次',
          price: 100,
          item_type: 'consumable',
          currency_type: 'coins',
          category: 'consumable'
        },
        {
          name: '超级恢复剂',
          description: '立即恢复32个绘制点数，每日限用1次',
          price: 200,
          item_type: 'consumable',
          currency_type: 'coins',
          category: 'consumable'
        },
        {
          name: '颜色炸弹',
          description: '一次性将6x6区域染成联盟颜色，冷却时间30分钟',
          price: 500,
          item_type: 'special',
          currency_type: 'coins',
          category: 'special',
          metadata: {
            bomb_type: 'color_bomb',
            area_size: 6,
            radius: 6,
            cooldown_minutes: 30
          }
        },
        {
          name: '金色头像框',
          description: '炫酷的金色头像框，彰显你的尊贵身份',
          price: 1000,
          item_type: 'cosmetic',
          currency_type: 'coins',
          category: 'cosmetic'
        },
        {
          name: '彩虹聊天气泡',
          description: '独特的彩虹色聊天气泡，让你的消息更显眼',
          price: 800,
          item_type: 'cosmetic',
          currency_type: 'coins',
          category: 'cosmetic'
        },
        {
          name: '像素大师徽章',
          description: '证明你是像素绘制大师的荣誉徽章',
          price: 2000,
          item_type: 'cosmetic',
          currency_type: 'coins',
          category: 'cosmetic'
        }
      ]);
    });
};
