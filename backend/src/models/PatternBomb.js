const { db } = require('../config/database');
const { calculateGridId } = require('../../shared/utils/gridUtils');

class PatternBomb {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.patternId = data.pattern_id;
    this.patternData = data.pattern_data;
    this.color = data.color;
    this.size = data.size;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // 创建图案炸弹
  static async create(bombData) {
    const [bomb] = await db('pattern_bombs')
      .insert({
        user_id: bombData.user_id,
        pattern_name: bombData.pattern_name,
        pattern_data: JSON.stringify(bombData.pattern_data),
        center_lat: bombData.center_lat,
        center_lng: bombData.center_lng,
        color: bombData.color,
        area_size: bombData.area_size || 6,
        is_active: true
      })
      .returning('*');
    
    return new PatternBomb(bomb);
  }

  // 获取用户的图案炸弹
  static async getUserBombs(userId) {
    const bombs = await db('pattern_bombs')
      .where('user_id', userId)
      .where('is_active', true)
      .orderBy('created_at', 'desc');
    
    return bombs.map(bomb => new PatternBomb(bomb));
  }

  // 获取预设图案列表
  static async getPresetPatterns() {
    return [
      {
        name: '十字',
        pattern: [
          [0, 1, 0],
          [1, 1, 1],
          [0, 1, 0]
        ],
        description: '经典的十字图案'
      },
      {
        name: '心形',
        pattern: [
          [0, 1, 1, 0, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 0, 0],
          [0, 0, 0, 1, 0, 0, 0]
        ],
        description: '浪漫的心形图案'
      },
      {
        name: '星星',
        pattern: [
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 0, 0],
          [0, 0, 0, 1, 0, 0, 0]
        ],
        description: '闪耀的星星图案'
      },
      {
        name: '圆形',
        pattern: [
          [0, 0, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 0, 0]
        ],
        description: '完美的圆形图案'
      },
      {
        name: '方形',
        pattern: [
          [1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1]
        ],
        description: '简单的方形图案'
      },
      {
        name: '箭头',
        pattern: [
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1],
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0]
        ],
        description: '指向性的箭头图案'
      }
    ];
  }

  // 应用图案炸弹效果
  static async applyBombEffect(userId, bombId, centerLat, centerLng) {
    const bomb = await db('pattern_bombs')
      .where('id', bombId)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!bomb) {
      throw new Error('图案炸弹不存在或已失效');
    }

    const patternData = typeof bomb.pattern_data === 'string' 
      ? JSON.parse(bomb.pattern_data) 
      : bomb.pattern_data;
    const areaSize = bomb.area_size || 6;
    const color = bomb.color;

    // 计算6x6区域的边界
    const halfSize = Math.floor(areaSize / 2);
    const minLat = centerLat - (halfSize * 0.0001); // 大约6x6像素区域
    const maxLat = centerLat + (halfSize * 0.0001);
    const minLng = centerLng - (halfSize * 0.0001);
    const maxLng = centerLng + (halfSize * 0.0001);

    let pixelsCreated = 0;

    // 开始事务
    await db.transaction(async (trx) => {
      // 删除区域内的现有像素
      await trx('pixels')
        .where('lat', '>=', minLat)
        .where('lat', '<=', maxLat)
        .where('lng', '>=', minLng)
        .where('lng', '<=', maxLng)
        .del();

      // 根据图案数据创建新像素
      const pixelsToInsert = [];
      const patternRows = patternData.length;
      const patternCols = patternData[0].length;
      
      for (let row = 0; row < patternRows; row++) {
        for (let col = 0; col < patternCols; col++) {
          if (patternData[row][col] === 1) {
            // 计算像素位置
            const pixelLat = centerLat + ((row - Math.floor(patternRows / 2)) * 0.0001);
            const pixelLng = centerLng + ((col - Math.floor(patternCols / 2)) * 0.0001);
            
            // 计算gridId
            const gridId = calculateGridId(pixelLat, pixelLng);
            
            pixelsToInsert.push({
              grid_id: gridId,
              lat: pixelLat,
              lng: pixelLng,
              color: color,
              user_id: userId,
              pixel_type: 'bomb', // 炸弹像素类型
              related_id: null // 炸弹暂时没有关联ID
            });
          }
        }
      }

      // 批量插入像素
      if (pixelsToInsert.length > 0) {
        await trx('pixels').insert(pixelsToInsert);
        pixelsCreated = pixelsToInsert.length;
      }

      // 标记炸弹为已使用
      await trx('pattern_bombs')
        .where('id', bombId)
        .update({ is_active: false });
    });

    return {
      success: true,
      pixelsCreated: pixelsCreated,
      pattern: patternData
    };
  }

  // 检查用户是否有可用的图案炸弹
  static async hasAvailableBomb(userId) {
    const bomb = await db('pattern_bombs')
      .where('user_id', userId)
      .where('is_active', true)
      .first();
    
    return !!bomb;
  }

  // 获取用户的图案炸弹使用历史
  static async getUserBombHistory(userId, limit = 20) {
    const history = await db('pattern_bombs')
      .where('user_id', userId)
      .where('is_active', false)
      .orderBy('created_at', 'desc')
      .limit(limit);
    
    return history.map(bomb => new PatternBomb(bomb));
  }

  // 删除图案炸弹
  static async deleteBomb(userId, bombId) {
    await db('pattern_bombs')
      .where('id', bombId)
      .where('user_id', userId)
      .del();
  }
}

module.exports = PatternBomb;
