/**
 * Seed: Common Hashtag Mappings
 * 初始化常用话题标签的多语言映射
 */

exports.seed = async function(knex) {
  // 清除现有的常用话题映射（可选）
  // await knex('hashtag_mappings').del();

  // 插入常用话题映射
  const mappings = [
    // 像素艺术 - PixelArt
    { canonical_tag: 'pixelart', language: 'en', localized_tag: 'PixelArt' },
    { canonical_tag: 'pixelart', language: 'zh-Hans', localized_tag: '像素艺术' },
    { canonical_tag: 'pixelart', language: 'ja', localized_tag: 'ピクセルアート' },
    { canonical_tag: 'pixelart', language: 'ko', localized_tag: '픽셀아트' },
    { canonical_tag: 'pixelart', language: 'es', localized_tag: 'ArtePixel' },

    // 打卡 - CheckIn
    { canonical_tag: 'checkin', language: 'en', localized_tag: 'CheckIn' },
    { canonical_tag: 'checkin', language: 'zh-Hans', localized_tag: '打卡' },
    { canonical_tag: 'checkin', language: 'ja', localized_tag: 'チェックイン' },
    { canonical_tag: 'checkin', language: 'ko', localized_tag: '체크인' },
    { canonical_tag: 'checkin', language: 'es', localized_tag: 'CheckIn' },

    // 挑战 - Challenge
    { canonical_tag: 'challenge', language: 'en', localized_tag: 'Challenge' },
    { canonical_tag: 'challenge', language: 'zh-Hans', localized_tag: '挑战' },
    { canonical_tag: 'challenge', language: 'ja', localized_tag: 'チャレンジ' },
    { canonical_tag: 'challenge', language: 'ko', localized_tag: '챌린지' },
    { canonical_tag: 'challenge', language: 'es', localized_tag: 'Desafío' },

    // 创作 - Creation
    { canonical_tag: 'creation', language: 'en', localized_tag: 'Creation' },
    { canonical_tag: 'creation', language: 'zh-Hans', localized_tag: '创作' },
    { canonical_tag: 'creation', language: 'ja', localized_tag: '創作' },
    { canonical_tag: 'creation', language: 'ko', localized_tag: '창작' },
    { canonical_tag: 'creation', language: 'es', localized_tag: 'Creación' },

    // 日常 - Daily
    { canonical_tag: 'daily', language: 'en', localized_tag: 'Daily' },
    { canonical_tag: 'daily', language: 'zh-Hans', localized_tag: '日常' },
    { canonical_tag: 'daily', language: 'ja', localized_tag: '日常' },
    { canonical_tag: 'daily', language: 'ko', localized_tag: '일상' },
    { canonical_tag: 'daily', language: 'es', localized_tag: 'Diario' },

    // 艺术 - Art
    { canonical_tag: 'art', language: 'en', localized_tag: 'Art' },
    { canonical_tag: 'art', language: 'zh-Hans', localized_tag: '艺术' },
    { canonical_tag: 'art', language: 'ja', localized_tag: 'アート' },
    { canonical_tag: 'art', language: 'ko', localized_tag: '예술' },
    { canonical_tag: 'art', language: 'es', localized_tag: 'Arte' },

    // 旅行 - Travel
    { canonical_tag: 'travel', language: 'en', localized_tag: 'Travel' },
    { canonical_tag: 'travel', language: 'zh-Hans', localized_tag: '旅行' },
    { canonical_tag: 'travel', language: 'ja', localized_tag: '旅行' },
    { canonical_tag: 'travel', language: 'ko', localized_tag: '여행' },
    { canonical_tag: 'travel', language: 'es', localized_tag: 'Viaje' },

    // 美食 - Food
    { canonical_tag: 'food', language: 'en', localized_tag: 'Food' },
    { canonical_tag: 'food', language: 'zh-Hans', localized_tag: '美食' },
    { canonical_tag: 'food', language: 'ja', localized_tag: '美食' },
    { canonical_tag: 'food', language: 'ko', localized_tag: '음식' },
    { canonical_tag: 'food', language: 'es', localized_tag: 'Comida' },

    // 风景 - Landscape
    { canonical_tag: 'landscape', language: 'en', localized_tag: 'Landscape' },
    { canonical_tag: 'landscape', language: 'zh-Hans', localized_tag: '风景' },
    { canonical_tag: 'landscape', language: 'ja', localized_tag: '風景' },
    { canonical_tag: 'landscape', language: 'ko', localized_tag: '풍경' },
    { canonical_tag: 'landscape', language: 'es', localized_tag: 'Paisaje' },

    // 城市 - City
    { canonical_tag: 'city', language: 'en', localized_tag: 'City' },
    { canonical_tag: 'city', language: 'zh-Hans', localized_tag: '城市' },
    { canonical_tag: 'city', language: 'ja', localized_tag: '都市' },
    { canonical_tag: 'city', language: 'ko', localized_tag: '도시' },
    { canonical_tag: 'city', language: 'es', localized_tag: 'Ciudad' },
  ];

  // 使用 onConflict 避免重复插入
  for (const mapping of mappings) {
    await knex('hashtag_mappings')
      .insert({
        ...mapping,
        usage_count: 0,
        created_at: knex.fn.now(),
        last_used_at: knex.fn.now()
      })
      .onConflict(['canonical_tag', 'language'])
      .ignore();
  }

  console.log('✅ Common hashtag mappings seeded');
};
