const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { redisUtils } = require('../config/redis');

class User {
  static tableName = 'users';

  // 添加query方法以支持QueryBuilder语法
  static query() {
    return db('users');
  }

  // 创建用户
  static async create(userData) {
    const { username, email, password, phone, role } = userData;
    
    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);
    
    const [user] = await db(this.tableName)
      .insert({
        id: uuidv4(), // 使用UUID
        username,
        email,
        password_hash: passwordHash,
        phone: phone || null,
        role: role || 'user',
        display_name: username, // 使用用户名作为显示名
        level: 1,
        experience: 0,
        coins: 100,
        gems: 10,
        total_pixels: 0,
        current_pixels: 0
      })
      .returning('*');
    
    // 创建用户像素状态
    await db('user_pixel_states').insert({
      user_id: user.id,
      last_accum_time: Math.floor(Date.now() / 1000)
    });

    // 创建用户积分记录
    await db('user_points').insert({
      user_id: user.id,
      total_points: 0,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return this.sanitizeUser(user);
  }

  // 根据ID查找用户（带 Redis 缓存，TTL=1h）
  static async findById(id) {
    // L1: Redis cache
    try {
      const cacheKey = `user:${id}`;
      const cached = await redisUtils.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {
      // Redis unavailable, fall through to DB
    }

    // L2: DB
    const user = await db(this.tableName)
      .where({ id })
      .first();

    if (!user) return null;
    const sanitized = this.sanitizeUser(user);

    // Write-back to cache (fire-and-forget)
    try {
      redisUtils.setex(`user:${id}`, 3600, JSON.stringify(sanitized)).catch(() => {});
    } catch (_) {}

    return sanitized;
  }

  // 清除用户缓存（在更新用户资料、封禁等操作时调用）
  static async clearCache(userId) {
    try {
      await redisUtils.del(`user:${userId}`);
    } catch (_) {}
  }

  // 根据用户名查找用户
  static async findByUsername(username) {
    const user = await db(this.tableName)
      .where({ username })
      .first();
    
    return user ? this.sanitizeUser(user) : null;
  }

  // 根据邮箱查找用户
  static async findByEmail(email) {
    const user = await db(this.tableName)
      .where({ email })
      .first();
    
    return user ? this.sanitizeUser(user) : null;
  }

  // 根据邮箱查找用户（包含密码哈希，用于认证）
  static async findByEmailForAuth(email) {
    const user = await db(this.tableName)
      .where({ email })
      .first();
    
    return user;
  }

  // 根据用户名查找用户（包含密码哈希，用于认证）
  static async findByUsernameForAuth(username) {
    const user = await db(this.tableName)
      .where({ username })
      .first();
    
    return user;
  }

  // 根据手机号查找用户
  static async findByPhone(phone) {
    const user = await db(this.tableName)
      .where({ phone })
      .first();
    
    return user;
  }

  // 根据手机号查找用户（包含密码哈希，用于认证）
  static async findByPhoneForAuth(phone) {
    const user = await db(this.tableName)
      .where({ phone })
      .first();

    return user;
  }

  // 根据微信openid查找用户
  static async findByWeChatOpenId(wechatOpenId) {
    const user = await db(this.tableName)
      .where({ wechat_openid: wechatOpenId })
      .first();

    return user ? this.sanitizeUser(user) : null;
  }

  // 根据微信unionid查找用户
  static async findByWeChatUnionId(wechatUnionId) {
    const user = await db(this.tableName)
      .where({ wechat_unionid: wechatUnionId })
      .first();

    return user ? this.sanitizeUser(user) : null;
  }

  // 创建微信用户
  static async createWeChatUser(wechatUserInfo) {
    const {
      openid,
      unionid,
      nickname,
      avatarUrl,
      sex = 0,
      province,
      city,
      country
    } = wechatUserInfo;

    // 生成随机密码（微信用户不需要密码登录，但数据库要求非空）
    const bcrypt = require('bcryptjs');
    const randomPassword = require('crypto').randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // 生成用户名
    const username = unionid ? `wx_${unionid.slice(-10)}` : `wx_${openid.slice(-10)}`;

    // 检查用户名唯一性
    let finalUsername = username;
    let counter = 1;
    while (await this.findByUsername(finalUsername)) {
      finalUsername = `${username}_${counter}`;
      counter++;
    }

    const [user] = await db(this.tableName)
      .insert({
        id: uuidv4(),
        username: finalUsername,
        email: `${finalUsername}@wechat.temp`,
        password_hash: passwordHash,
        wechat_openid: openid,
        wechat_unionid: unionid,
        wechat_nickname: nickname,
        wechat_avatar_url: avatarUrl,
        wechat_sex: sex,
        wechat_province: province,
        wechat_city: city,
        wechat_country: country,
        display_name: nickname || finalUsername,
        avatar: avatarUrl || 'default_avatar.png',
        login_method: 'wechat',
        role: 'user',
        level: 1,
        experience: 0,
        coins: 100,
        gems: 10,
        total_pixels: 0,
        current_pixels: 0,
        created_at: new Date(),
        updated_at: new Date(),
        wechat_last_login_at: new Date()
      })
      .returning('*');

    // 创建用户像素状态
    await db('user_pixel_states').insert({
      user_id: user.id,
      last_accum_time: Math.floor(Date.now() / 1000)
    });

    // 创建用户积分记录
    await db('user_points').insert({
      user_id: user.id,
      total_points: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    return this.sanitizeUser(user);
  }

  // 更新微信用户最后登录时间
  static async updateWeChatLastLogin(userId) {
    await db(this.tableName)
      .where({ id: userId })
      .update({
        wechat_last_login_at: new Date(),
        updated_at: new Date()
      });
  }

  // 验证密码
  static async verifyPassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }

  // 更新用户活动时间
  static async updateActivity(id) {
    await db(this.tableName)
      .where({ id })
      .update({
        last_login: db.fn.now(),
        updated_at: db.fn.now()
      });
  }

  // 获取用户积分
  static async getUserPoints(userId) {
    const userPoints = await db('user_points')
      .where('user_id', userId)
      .first();
    
    return userPoints ? userPoints.total_points : 0;
  }

  // 更新用户点数（已废弃，使用UserPoints模型）
  static async updatePoints(id, points) {
    console.warn('User.updatePoints is deprecated, use UserPoints model instead');
    await db('user_points')
      .where('user_id', id)
      .update({
        total_points: points,
        updated_at: new Date()
      });
  }

  // 清理用户数据（移除敏感信息）
  static sanitizeUser(user) {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = User;
