const { db } = require('../config/database');

class Ad {
  constructor(data) {
    this.id = data.id;
    this.sku_id = data.sku_id;
    this.pattern_id = data.pattern_id;
    this.x = data.x;
    this.y = data.y;
    this.w = data.w;
    this.h = data.h;
    this.owner_user_id = data.owner_user_id;
    this.owner_alliance_id = data.owner_alliance_id;
    this.schedule = data.schedule;
    this.active = data.active;
    this.starts_at = data.starts_at;
    this.ends_at = data.ends_at;
    this.created_at = data.created_at;
    this.status = data.status;
    this.review_notes = data.review_notes;
  }

  // 创建广告
  static async create(adData) {
    const {
      sku_id,
      pattern_id,
      x, y, w, h,
      owner_user_id,
      owner_alliance_id,
      schedule,
      starts_at,
      ends_at
    } = adData;

    // 验证必需字段
    if (!sku_id || !pattern_id || x === undefined || y === undefined || !w || !h || !schedule) {
      throw new Error('缺少必需字段');
    }

    // 验证schedule格式
    if (!schedule.interval_sec || !schedule.duration_sec || !schedule.freeze_sec) {
      throw new Error('schedule格式无效');
    }

    // 验证尺寸限制
    if (w > 128 || h > 128) {
      throw new Error('广告尺寸不能超过128x128');
    }

    const [ad] = await db('ads')
      .insert({
        sku_id,
        pattern_id,
        x, y, w, h,
        owner_user_id,
        owner_alliance_id,
        schedule,
        starts_at,
        ends_at
      })
      .returning('*');

    return new Ad(ad);
  }

  // 根据ID获取广告
  static async getById(id) {
    const ad = await db('ads')
      .where('id', id)
      .first();

    return ad ? new Ad(ad) : null;
  }

  // 获取活跃的广告
  static async getActiveAds() {
    const ads = await db('ads')
      .where('status', 'approved')
      .where('active', true)
      .where('starts_at', '<=', new Date())
      .where(function() {
        this.whereNull('ends_at').orWhere('ends_at', '>', new Date());
      })
      .orderBy('created_at', 'desc');

    return ads.map(ad => new Ad(ad));
  }

  // 获取待审核的广告
  static async getPendingAds() {
    const ads = await db('ads')
      .where('status', 'pending')
      .orderBy('created_at', 'desc');

    return ads.map(ad => new Ad(ad));
  }

  // 获取用户的广告
  static async getByUser(userId) {
    const ads = await db('ads')
      .where('owner_user_id', userId)
      .orderBy('created_at', 'desc');

    return ads.map(ad => new Ad(ad));
  }

  // 获取区域内的广告
  static async getByRegion(x, y, w, h) {
    const ads = await db('ads')
      .where('status', 'approved')
      .where('active', true)
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

    return ads.map(ad => new Ad(ad));
  }

  // 审核广告
  async review(status, notes = null) {
    await db('ads')
      .where('id', this.id)
      .update({
        status,
        review_notes: notes,
        active: status === 'approved'
      });

    this.status = status;
    this.review_notes = notes;
    this.active = status === 'approved';
  }

  // 激活广告
  async activate() {
    await db('ads')
      .where('id', this.id)
      .update({ active: true });

    this.active = true;
  }

  // 停用广告
  async deactivate() {
    await db('ads')
      .where('id', this.id)
      .update({ active: false });

    this.active = false;
  }

  // 检查广告是否应该播放
  shouldPlay() {
    if (!this.active || this.status !== 'approved') return false;
    
    const now = new Date();
    if (this.starts_at && now < this.starts_at) return false;
    if (this.ends_at && now > this.ends_at) return false;

    // 检查播放间隔
    if (this.schedule.interval_sec) {
      const lastPlayTime = this.getLastPlayTime();
      if (lastPlayTime) {
        const timeSinceLastPlay = (now - lastPlayTime) / 1000;
        if (timeSinceLastPlay < this.schedule.interval_sec) return false;
      }
    }

    return true;
  }

  // 获取上次播放时间（从Redis获取）
  getLastPlayTime() {
    // 这里应该从Redis获取，暂时返回null
    return null;
  }

  // 设置播放时间（存储到Redis）
  setPlayTime() {
    // 这里应该存储到Redis，暂时不实现
  }

  // 检查坐标是否在广告范围内
  isInRange(x, y) {
    return x >= this.x && x < this.x + this.w && 
           y >= this.y && y < this.y + this.h;
  }

  // 获取广告区域的所有像素坐标
  getAdPixels() {
    const pixels = [];
    for (let px = this.x; px < this.x + this.w; px++) {
      for (let py = this.y; py < this.y + this.h; py++) {
        pixels.push({ x: px, y: py });
      }
    }
    return pixels;
  }

  // 检查是否过期
  isExpired() {
    if (!this.ends_at) return false;
    return new Date() > new Date(this.ends_at);
  }

  // 获取下次播放时间
  getNextPlayTime() {
    if (!this.schedule.interval_sec) return null;
    
    const lastPlayTime = this.getLastPlayTime();
    if (!lastPlayTime) return new Date();

    return new Date(lastPlayTime.getTime() + this.schedule.interval_sec * 1000);
  }
}

module.exports = Ad;
