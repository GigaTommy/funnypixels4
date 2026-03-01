const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addEmojiPatterns() {
  try {
    logger.info('🔄 开始添加emoji图案...');
    
    const emojiPatterns = [
      {
        key: 'emoji_smile',
        name: '笑脸',
        description: '😊 笑脸表情',
        image_url: '/patterns/emoji_smile.png',
        category: 'emoji',
        tags: ['笑脸', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FFD700' } // 黄色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_heart',
        name: '爱心',
        description: '❤️ 爱心表情',
        image_url: '/patterns/emoji_heart.png',
        category: 'emoji',
        tags: ['爱心', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FF0000' } // 红色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_star',
        name: '星星',
        description: '⭐ 星星表情',
        image_url: '/patterns/emoji_star.png',
        category: 'emoji',
        tags: ['星星', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FFD700' } // 金色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_fire',
        name: '火焰',
        description: '🔥 火焰表情',
        image_url: '/patterns/emoji_fire.png',
        category: 'emoji',
        tags: ['火焰', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FF4500' } // 橙红色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_rocket',
        name: '火箭',
        description: '🚀 火箭表情',
        image_url: '/patterns/emoji_rocket.png',
        category: 'emoji',
        tags: ['火箭', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#4169E1' } // 蓝色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_crown',
        name: '皇冠',
        description: '👑 皇冠表情',
        image_url: '/patterns/emoji_crown.png',
        category: 'emoji',
        tags: ['皇冠', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FFD700' } // 金色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_thumbs_up',
        name: '点赞',
        description: '👍 点赞表情',
        image_url: '/patterns/emoji_thumbs_up.png',
        category: 'emoji',
        tags: ['点赞', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#32CD32' } // 绿色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_peace',
        name: '和平',
        description: '✌️ 和平手势',
        image_url: '/patterns/emoji_peace.png',
        category: 'emoji',
        tags: ['和平', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FFD700' } // 金色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_sun',
        name: '太阳',
        description: '☀️ 太阳表情',
        image_url: '/patterns/emoji_sun.png',
        category: 'emoji',
        tags: ['太阳', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FFD700' } // 金色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_moon',
        name: '月亮',
        description: '🌙 月亮表情',
        image_url: '/patterns/emoji_moon.png',
        category: 'emoji',
        tags: ['月亮', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#C0C0C0' } // 银色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_rainbow',
        name: '彩虹',
        description: '🌈 彩虹表情',
        image_url: '/patterns/emoji_rainbow.png',
        category: 'emoji',
        tags: ['彩虹', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FF69B4' } // 粉色背景
        ]),
        verified: true
      },
      {
        key: 'emoji_flower',
        name: '花朵',
        description: '🌸 花朵表情',
        image_url: '/patterns/emoji_flower.png',
        category: 'emoji',
        tags: ['花朵', '表情', 'emoji'],
        is_public: true,
        created_by: null,
        width: 32,
        height: 32,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1024, color: '#FF69B4' } // 粉色背景
        ]),
        verified: true
      }
    ];

    // 检查是否已存在emoji图案
    const existingEmojis = await db('pattern_assets')
      .whereIn('key', emojiPatterns.map(p => p.key))
      .select('key');
    
    const existingKeys = existingEmojis.map(e => e.key);
    const newPatterns = emojiPatterns.filter(p => !existingKeys.includes(p.key));
    
    if (newPatterns.length === 0) {
      logger.info('✅ emoji图案已存在，无需添加');
      return;
    }

    // 插入新的emoji图案
    await db('pattern_assets').insert(newPatterns);
    
    logger.info(`✅ 成功添加 ${newPatterns.length} 个emoji图案:`, newPatterns.map(p => ({ key: p.key, name: p.name })));
    
  } catch (error) {
    logger.error('❌ 添加emoji图案失败:', error);
    throw error;
  }
}

// 运行脚本
if (require.main === module) {
  addEmojiPatterns()
    .then(() => {
      logger.info('🎉 emoji图案添加完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { addEmojiPatterns };
