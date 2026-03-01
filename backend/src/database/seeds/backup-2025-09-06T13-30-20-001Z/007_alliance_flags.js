/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('pattern_assets').where('category', 'alliance_flag').del();
  await knex('shop_skus').where('type', 'flag_pattern').del();

  // 插入联盟旗帜图案资源
  const flagPatterns = [
    {
      name: '海盗旗',
      description: '经典的海盗骷髅旗，象征冒险与自由',
      image_url: 'https://example.com/flags/pirate_flag.png',
      category: 'alliance_flag',
      tags: ['pirate', 'skull', 'adventure'],
      is_public: true,
      download_count: 0,
      rating: 4.5,
      review_count: 0
    },
    {
      name: '红旗',
      description: '鲜艳的红色旗帜，象征热情与力量',
      image_url: 'https://example.com/flags/red_flag.png',
      category: 'alliance_flag',
      tags: ['red', 'power', 'passion'],
      is_public: true,
      download_count: 0,
      rating: 4.2,
      review_count: 0
    },
    {
      name: '黄旗',
      description: '明亮的黄色旗帜，象征智慧与财富',
      image_url: 'https://example.com/flags/yellow_flag.png',
      category: 'alliance_flag',
      tags: ['yellow', 'wisdom', 'wealth'],
      is_public: true,
      download_count: 0,
      rating: 4.0,
      review_count: 0
    },
    {
      name: '蓝旗',
      description: '深邃的蓝色旗帜，象征忠诚与信任',
      image_url: 'https://example.com/flags/blue_flag.png',
      category: 'alliance_flag',
      tags: ['blue', 'loyalty', 'trust'],
      is_public: true,
      download_count: 0,
      rating: 4.3,
      review_count: 0
    },
    {
      name: '绿旗',
      description: '生机勃勃的绿色旗帜，象征生命与希望',
      image_url: 'https://example.com/flags/green_flag.png',
      category: 'alliance_flag',
      tags: ['green', 'life', 'hope'],
      is_public: true,
      download_count: 0,
      rating: 4.1,
      review_count: 0
    },
    {
      name: '紫旗',
      description: '高贵的紫色旗帜，象征神秘与权威',
      image_url: 'https://example.com/flags/purple_flag.png',
      category: 'alliance_flag',
      tags: ['purple', 'mystery', 'authority'],
      is_public: true,
      download_count: 0,
      rating: 4.4,
      review_count: 0
    },
    {
      name: '橙旗',
      description: '活力的橙色旗帜，象征创造力与活力',
      image_url: 'https://example.com/flags/orange_flag.png',
      category: 'alliance_flag',
      tags: ['orange', 'creativity', 'energy'],
      is_public: true,
      download_count: 0,
      rating: 4.0,
      review_count: 0
    },
    {
      name: '白旗',
      description: '纯洁的白色旗帜，象征和平与纯洁',
      image_url: 'https://example.com/flags/white_flag.png',
      category: 'alliance_flag',
      tags: ['white', 'peace', 'purity'],
      is_public: true,
      download_count: 0,
      rating: 4.2,
      review_count: 0
    },
    {
      name: '黑旗',
      description: '神秘的黑色旗帜，象征力量与神秘',
      image_url: 'https://example.com/flags/black_flag.png',
      category: 'alliance_flag',
      tags: ['black', 'power', 'mystery'],
      is_public: true,
      download_count: 0,
      rating: 4.6,
      review_count: 0
    },
    {
      name: '彩虹旗',
      description: '多彩的彩虹旗帜，象征包容与多样性',
      image_url: 'https://example.com/flags/rainbow_flag.png',
      category: 'alliance_flag',
      tags: ['rainbow', 'diversity', 'inclusion'],
      is_public: true,
      download_count: 0,
      rating: 4.7,
      review_count: 0
    }
  ];

  // 插入pattern_assets数据
  const patternAssets = await knex('pattern_assets').insert(flagPatterns).returning('*');

  // 为每个图案创建对应的SKU
  const flagSkus = patternAssets.map((pattern, index) => ({
    name: `${pattern.name} - 联盟旗帜`,
    description: `${pattern.description}，可用于联盟旗帜设置`,
    price: 100 + (index * 50), // 不同旗帜不同价格
    currency: 'coins',
    item_type: 'flag_pattern',
    item_id: pattern.id,
    is_available: true,
    image_url: pattern.image_url,
    category: 'alliance_flags',
    sort_order: index + 1,
    pattern_id: `flag_${pattern.id}`,
    active: true,
    verified: true,
    type: 'flag_pattern'
  }));

  // 插入shop_skus数据
  await knex('shop_skus').insert(flagSkus);

  console.log('✅ 联盟旗帜图案初始化完成');
  console.log(`📊 创建了 ${patternAssets.length} 个旗帜图案`);
  console.log(`🛒 创建了 ${flagSkus.length} 个对应的SKU`);
};
