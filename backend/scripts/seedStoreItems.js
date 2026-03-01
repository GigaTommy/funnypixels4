const { db } = require('../src/config/database');

/**
 * 商店商品种子数据
 * 包含各种类型的商品：像素加速器、图案、头像框、炸弹、广告等
 */
const storeItems = [
  // 像素加速器类
  {
    name: '快速恢复剂',
    description: '立即恢复16个绘制点数，每日限用3次',
    price: 100,
    price_points: 100,
    item_type: 'pixel_boost',
    metadata: {
      boost_amount: 16,
      daily_limit: 3,
      category: 'consumable'
    },
    active: true
  },
  {
    name: '超级恢复剂',
    description: '立即恢复32个绘制点数，每日限用1次',
    price: 200,
    price_points: 200,
    item_type: 'pixel_boost',
    metadata: {
      boost_amount: 32,
      daily_limit: 1,
      category: 'consumable'
    },
    active: true
  },
  {
    name: '无限恢复剂',
    description: '立即恢复64个绘制点数，每日限用1次',
    price: 500,
    price_points: 500,
    item_type: 'pixel_boost',
    metadata: {
      boost_amount: 64,
      daily_limit: 1,
      category: 'consumable'
    },
    active: true
  },

  // 图案类（用于联盟旗帜）
  {
    name: '海盗旗图案',
    description: '经典的海盗骷髅旗图案，可用于联盟旗帜',
    price: 300,
    price_points: 300,
    item_type: 'pattern',
    metadata: {
      pattern_id: 'pirate_flag_pattern',
      category: 'alliance_flags',
      rarity: 'rare'
    },
    active: true
  },
  {
    name: '彩虹旗图案',
    description: '多彩的彩虹旗帜图案，象征包容与多样性',
    price: 250,
    price_points: 250,
    item_type: 'pattern',
    metadata: {
      pattern_id: 'rainbow_flag_pattern',
      category: 'alliance_flags',
      rarity: 'common'
    },
    active: true
  },
  {
    name: '龙图案',
    description: '威武的中国龙图案，象征力量与智慧',
    price: 400,
    price_points: 400,
    item_type: 'pattern',
    metadata: {
      pattern_id: 'dragon_pattern',
      category: 'alliance_flags',
      rarity: 'epic'
    },
    active: true
  },
  {
    name: '星星图案',
    description: '闪耀的星星图案，象征希望与梦想',
    price: 150,
    price_points: 150,
    item_type: 'pattern',
    metadata: {
      pattern_id: 'star_pattern',
      category: 'alliance_flags',
      rarity: 'common'
    },
    active: true
  },

  // 头像框类
  {
    name: '金色头像框',
    description: '炫酷的金色头像框，彰显你的尊贵身份',
    price: 1000,
    price_points: 1000,
    item_type: 'frame',
    metadata: {
      frame_id: 'golden_frame',
      category: 'cosmetic',
      rarity: 'rare'
    },
    active: true
  },
  {
    name: '钻石头像框',
    description: '闪耀的钻石头像框，象征财富与地位',
    price: 2000,
    price_points: 2000,
    item_type: 'frame',
    metadata: {
      frame_id: 'diamond_frame',
      category: 'cosmetic',
      rarity: 'epic'
    },
    active: true
  },
  {
    name: '彩虹头像框',
    description: '多彩的彩虹头像框，展现你的个性',
    price: 800,
    price_points: 800,
    item_type: 'frame',
    metadata: {
      frame_id: 'rainbow_frame',
      category: 'cosmetic',
      rarity: 'common'
    },
    active: true
  },

  // 聊天气泡类
  {
    name: '彩虹聊天气泡',
    description: '独特的彩虹色聊天气泡，让你的消息更显眼',
    price: 600,
    price_points: 600,
    item_type: 'bubble',
    metadata: {
      bubble_id: 'rainbow_bubble',
      category: 'cosmetic',
      rarity: 'common'
    },
    active: true
  },
  {
    name: '金色聊天气泡',
    description: '高贵的金色聊天气泡，彰显你的身份',
    price: 1200,
    price_points: 1200,
    item_type: 'bubble',
    metadata: {
      bubble_id: 'golden_bubble',
      category: 'cosmetic',
      rarity: 'rare'
    },
    active: true
  },

  // 徽章类
  {
    name: '像素大师徽章',
    description: '证明你是像素绘制大师的荣誉徽章',
    price: 1500,
    price_points: 1500,
    item_type: 'badge',
    metadata: {
      badge_id: 'pixel_master_badge',
      category: 'cosmetic',
      rarity: 'epic'
    },
    active: true
  },
  {
    name: '联盟领袖徽章',
    description: '联盟领袖专属徽章，象征领导力',
    price: 1000,
    price_points: 1000,
    item_type: 'badge',
    metadata: {
      badge_id: 'alliance_leader_badge',
      category: 'cosmetic',
      rarity: 'rare'
    },
    active: true
  },

  // 炸弹类（特殊道具）
  {
    name: '颜色炸弹',
    description: '一次性将6x6区域染成联盟颜色，冷却时间30分钟',
    price: 500,
    price_points: 500,
    item_type: 'bomb',
    metadata: {
      bomb_type: 'color_bomb',
      area_size: '6x6',
      cooldown_minutes: 30,
      category: 'special'
    },
    active: true
  },
  {
    name: '图案炸弹',
    description: '一次性将6x6区域应用联盟图案，冷却时间60分钟',
    price: 800,
    price_points: 800,
    item_type: 'bomb',
    metadata: {
      bomb_type: 'pattern_bomb',
      area_size: '6x6',
      cooldown_minutes: 60,
      category: 'special'
    },
    active: true
  },
  {
    name: '清除炸弹',
    description: '一次性清除6x6区域的所有像素，冷却时间45分钟',
    price: 600,
    price_points: 600,
    item_type: 'bomb',
    metadata: {
      bomb_type: 'clear_bomb',
      area_size: '6x6',
      cooldown_minutes: 45,
      category: 'special'
    },
    active: true
  },

  // 广告投放类
  {
    name: '广告投放额度',
    description: '获得1次广告投放机会，可在指定区域展示广告',
    price: 1000,
    price_points: 1000,
    item_type: 'ad',
    metadata: {
      ad_credits: 1,
      duration_hours: 24,
      category: 'advertisement'
    },
    active: true
  },
  {
    name: '高级广告套餐',
    description: '获得5次广告投放机会，可在多个区域展示广告',
    price: 4000,
    price_points: 4000,
    item_type: 'ad',
    metadata: {
      ad_credits: 5,
      duration_hours: 48,
      category: 'advertisement'
    },
    active: true
  },

  // 漂流瓶类（特殊道具）
  {
    name: '神秘漂流瓶',
    description: '抛出一个神秘的漂流瓶，它会在地图上随机漂流。其他用户可以捡起它，写下纸条，然后继续漂流。',
    price: 100,
    price_points: 100,
    item_type: 'drift_bottle',
    metadata: {
      category: 'special',
      bottle_type: 'standard',
      max_messages: 10
    },
    active: true
  },

  // 二维码寻宝类（特殊道具）
  {
    name: '寻宝道具',
    description: '扫描任意二维码藏下宝藏，其他用户扫描同一二维码即可发现。将满大街的二维码变成寻宝游戏！道具已包含50积分默认奖励。',
    price: 100,
    price_points: 100,
    item_type: 'qr_treasure',
    metadata: {
      category: 'special',
      treasure_type: 'standard',
      usage_type: 'consumable',
      base_reward: 50,
      description: '使用后跳转到扫一扫界面，扫描二维码即可藏宝。道具包含50积分基础奖励，可选择增加额外奖励。'
    },
    active: true
  }
];

/**
 * 执行种子数据插入
 */
async function seedStoreItems() {
  try {
    console.log('🌱 开始插入商店商品种子数据...');

    // 清空现有数据
    await db('store_items').del();
    console.log('✅ 已清空现有商店商品数据');

    // 插入新数据
    const insertedItems = await db('store_items').insert(storeItems).returning('*');
    console.log(`✅ 成功插入 ${insertedItems.length} 个商店商品`);

    // 打印插入的商品信息
    console.log('\n📦 插入的商品列表:');
    insertedItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.item_type}) - ${item.price_points} 积分`);
    });

    console.log('\n🎉 商店商品种子数据插入完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 插入商店商品种子数据失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedStoreItems();
}

module.exports = { seedStoreItems, storeItems };
