const { db } = require('../config/database');

class Cosmetic {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.cosmetic_type = data.cosmetic_type;
    this.cosmetic_name = data.cosmetic_name;
    this.cosmetic_data = typeof data.cosmetic_data === 'string' 
      ? JSON.parse(data.cosmetic_data) 
      : data.cosmetic_data;
    this.is_equipped = data.is_equipped;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建装饰品
  static async create(cosmeticData) {
    const [cosmetic] = await db('cosmetics')
      .insert({
        user_id: cosmeticData.user_id,
        cosmetic_type: cosmeticData.cosmetic_type,
        cosmetic_name: cosmeticData.cosmetic_name,
        cosmetic_data: JSON.stringify(cosmeticData.cosmetic_data),
        is_equipped: cosmeticData.is_equipped || false,
        is_active: true
      })
      .returning('*');
    
    return new Cosmetic(cosmetic);
  }

  // 获取用户的所有装饰品
  static async getUserCosmetics(userId) {
    const cosmetics = await db('cosmetics')
      .where('user_id', userId)
      .where('is_active', true)
      .orderBy('cosmetic_type', 'asc')
      .orderBy('created_at', 'desc');
    
    return cosmetics.map(cosmetic => new Cosmetic(cosmetic));
  }

  // 获取用户装备的装饰品
  static async getEquippedCosmetics(userId) {
    const cosmetics = await db('cosmetics')
      .where('user_id', userId)
      .where('is_equipped', true)
      .where('is_active', true);
    
    return cosmetics.map(cosmetic => new Cosmetic(cosmetic));
  }

  // 获取用户特定类型的装饰品
  static async getUserCosmeticsByType(userId, cosmeticType) {
    const cosmetics = await db('cosmetics')
      .where('user_id', userId)
      .where('cosmetic_type', cosmeticType)
      .where('is_active', true)
      .orderBy('created_at', 'desc');
    
    return cosmetics.map(cosmetic => new Cosmetic(cosmetic));
  }

  // 装备装饰品
  static async equipCosmetic(userId, cosmeticId) {
    const cosmetic = await db('cosmetics')
      .where('id', cosmeticId)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!cosmetic) {
      throw new Error('装饰品不存在或已失效');
    }

    // 开始事务
    await db.transaction(async (trx) => {
      // 先取消同类型装饰品的装备状态
      await trx('cosmetics')
        .where('user_id', userId)
        .where('cosmetic_type', cosmetic.cosmetic_type)
        .where('is_equipped', true)
        .update({ is_equipped: false });

      // 装备新的装饰品
      await trx('cosmetics')
        .where('id', cosmeticId)
        .update({ is_equipped: true });
    });

    return true;
  }

  // 取消装备装饰品
  static async unequipCosmetic(userId, cosmeticType) {
    await db('cosmetics')
      .where('user_id', userId)
      .where('cosmetic_type', cosmeticType)
      .where('is_equipped', true)
      .update({ is_equipped: false });

    return true;
  }

  // 删除装饰品
  static async deleteCosmetic(userId, cosmeticId) {
    await db('cosmetics')
      .where('id', cosmeticId)
      .where('user_id', userId)
      .update({ is_active: false });

    return true;
  }

  // 获取装饰品预览数据
  static async getCosmeticPreview(cosmeticType, cosmeticName) {
    const previewData = {
      avatar_frame: {
        golden: {
          name: '金色头像框',
          description: '炫酷的金色头像框，彰显你的尊贵身份',
          preview_url: '/cosmetics/avatar_frames/golden.png',
          frame_style: {
            border_color: '#FFD700',
            border_width: '3px',
            border_style: 'solid',
            shadow: '0 0 10px rgba(255, 215, 0, 0.5)'
          }
        },
        rainbow: {
          name: '彩虹头像框',
          description: '七彩彩虹头像框，展现你的多彩个性',
          preview_url: '/cosmetics/avatar_frames/rainbow.png',
          frame_style: {
            border_color: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
            border_width: '4px',
            border_style: 'solid',
            animation: 'rainbow 2s linear infinite'
          }
        }
      },
      chat_bubble: {
        rainbow: {
          name: '彩虹聊天气泡',
          description: '独特的彩虹色聊天气泡，让你的消息更显眼',
          preview_url: '/cosmetics/chat_bubbles/rainbow.png',
          bubble_style: {
            background: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
            color: '#ffffff',
            border_radius: '15px',
            padding: '8px 12px',
            box_shadow: '0 2px 8px rgba(0,0,0,0.2)'
          }
        },
        neon: {
          name: '霓虹聊天气泡',
          description: '炫酷的霓虹效果聊天气泡',
          preview_url: '/cosmetics/chat_bubbles/neon.png',
          bubble_style: {
            background: '#000000',
            color: '#00ff00',
            border: '2px solid #00ff00',
            border_radius: '10px',
            padding: '8px 12px',
            box_shadow: '0 0 10px #00ff00',
            text_shadow: '0 0 5px #00ff00'
          }
        }
      },
      badge: {
        pixel_master: {
          name: '像素大师徽章',
          description: '证明你是像素绘制大师的荣誉徽章',
          preview_url: '/cosmetics/badges/pixel_master.png',
          badge_style: {
            background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
            color: '#ffffff',
            border_radius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font_weight: 'bold',
            box_shadow: '0 2px 8px rgba(0,0,0,0.3)'
          }
        },
        alliance_leader: {
          name: '联盟领袖徽章',
          description: '联盟领袖的专属徽章',
          preview_url: '/cosmetics/badges/alliance_leader.png',
          badge_style: {
            background: 'linear-gradient(45deg, #ffd700, #ff8c00)',
            color: '#ffffff',
            border_radius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font_weight: 'bold',
            box_shadow: '0 2px 8px rgba(0,0,0,0.3)'
          }
        }
      },
      background: {
        galaxy: {
          name: '银河背景',
          description: '美丽的银河背景，让你的个人主页更炫酷',
          preview_url: '/cosmetics/backgrounds/galaxy.png',
          background_style: {
            background: 'linear-gradient(45deg, #0c0c0c, #1a1a2e, #16213e, #0f3460)',
            background_size: '400% 400%',
            animation: 'galaxy 10s ease infinite'
          }
        },
        forest: {
          name: '森林背景',
          description: '清新的森林背景，带来自然的气息',
          preview_url: '/cosmetics/backgrounds/forest.png',
          background_style: {
            background: 'linear-gradient(45deg, #2d5016, #4a7c59, #6b8e23, #556b2f)',
            background_size: '400% 400%',
            animation: 'forest 8s ease infinite'
          }
        }
      }
    };

    return previewData[cosmeticType]?.[cosmeticName] || null;
  }

  // 获取所有装饰品类型
  static async getCosmeticTypes() {
    return [
      {
        type: 'avatar_frame',
        name: '头像框',
        description: '为你的头像添加炫酷的边框效果'
      },
      {
        type: 'chat_bubble',
        name: '聊天气泡',
        description: '自定义你的聊天气泡样式'
      },
      {
        type: 'badge',
        name: '徽章',
        description: '展示你的成就和身份'
      },
      {
        type: 'background',
        name: '背景',
        description: '美化你的个人主页背景'
      }
    ];
  }

  // 检查用户是否拥有特定装饰品
  static async hasCosmetic(userId, cosmeticType, cosmeticName) {
    const cosmetic = await db('cosmetics')
      .where('user_id', userId)
      .where('cosmetic_type', cosmeticType)
      .where('cosmetic_name', cosmeticName)
      .where('is_active', true)
      .first();
    
    return !!cosmetic;
  }
}

module.exports = Cosmetic;
