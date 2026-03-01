const { db } = require('../config/database');

class PatternApply {
  constructor(data) {
    this.id = data.id;
    this.pattern_id = data.pattern_id;
    this.x = data.x;
    this.y = data.y;
    this.w = data.w;
    this.h = data.h;
    this.rotation = data.rotation;
    this.mirror = data.mirror;
    this.owner_user_id = data.owner_user_id;
    this.owner_alliance_id = data.owner_alliance_id;
    this.tint_color = data.tint_color;
    this.created_at = data.created_at;
    this.expires_at = data.expires_at;
    this.visible = data.visible;
    this.type = data.type;
  }

  // 创建图案应用
  static async create(applyData) {
    const {
      pattern_id,
      x, y, w, h,
      rotation = 0,
      mirror = false,
      owner_user_id,
      owner_alliance_id,
      tint_color,
      expires_at,
      type = 'bomb'
    } = applyData;

    // 验证必需字段
    if (!pattern_id || x === undefined || y === undefined || !w || !h) {
      throw new Error('缺少必需字段');
    }

    // 验证尺寸限制
    if (w > 64 || h > 64) {
      throw new Error('图案应用尺寸不能超过64x64');
    }

    const [apply] = await db('pattern_apply')
      .insert({
        pattern_id,
        x, y, w, h,
        rotation,
        mirror,
        owner_user_id,
        owner_alliance_id,
        tint_color,
        expires_at,
        type
      })
      .returning('*');

    return new PatternApply(apply);
  }

  // 根据ID获取图案应用
  static async getById(id) {
    const apply = await db('pattern_apply')
      .where('id', id)
      .where('visible', true)
      .first();

    return apply ? new PatternApply(apply) : null;
  }

  // 获取区域内的图案应用
  static async getByRegion(x, y, w, h) {
    const applies = await db('pattern_apply')
      .where('visible', true)
      .where(function() {
        this.where(function() {
          this.where('x', '>=', x)
            .andWhere('x', '<', x + w)
            .andWhere('y', '>=', y)
            .andWhere('y', '<', y + h);
        }).orWhere(function() {
          this.where('x', '<=', x)
            .andWhere('x + w', '>', x)
            .andWhere('y', '<=', y)
            .andWhere('y + h', '>', y);
        });
      })
      .orderBy('created_at', 'desc');

    return applies.map(apply => new PatternApply(apply));
  }

  // 获取用户的炸弹使用记录
  static async getBombsByUser(userId, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const bombs = await db('pattern_apply')
      .where('owner_user_id', userId)
      .where('type', 'bomb')
      .where('created_at', '>=', since)
      .orderBy('created_at', 'desc');

    return bombs.map(bomb => new PatternApply(bomb));
  }

  // 检查用户是否可以使用炸弹（冷却检查）
  static async canUseBomb(userId) {
    const bombs = await this.getBombsByUser(userId, 24);
    return bombs.length === 0;
  }

  // 软删除图案应用
  async softDelete() {
    await db('pattern_apply')
      .where('id', this.id)
      .update({ visible: false });
    
    this.visible = false;
  }

  // 设置过期时间
  async setExpiresAt(expiresAt) {
    await db('pattern_apply')
      .where('id', this.id)
      .update({ expires_at: expiresAt });
    
    this.expires_at = expiresAt;
  }

  // 检查是否过期
  isExpired() {
    if (!this.expires_at) return false;
    return new Date() > new Date(this.expires_at);
  }

  // 获取影响区域的所有像素坐标
  getAffectedPixels() {
    const pixels = [];
    for (let px = this.x; px < this.x + this.w; px++) {
      for (let py = this.y; py < this.y + this.h; py++) {
        pixels.push({ x: px, y: py });
      }
    }
    return pixels;
  }

  // 检查坐标是否在影响范围内
  isInRange(x, y) {
    return x >= this.x && x < this.x + this.w && 
           y >= this.y && y < this.y + this.h;
  }
}

module.exports = PatternApply;
