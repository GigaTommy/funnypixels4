// @ts-check
const BaseRepository = require('./BaseRepository');

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} email
 * @property {string} [username]
 * @property {string} [display_name]
 * @property {string} password_hash
 * @property {string} [avatar_url]
 * @property {boolean} [is_email_verified]
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * 用户 Repository
 * 封装用户相关的数据访问操作
 *
 * @extends {BaseRepository<User>}
 */
class UserRepository extends BaseRepository {
  /**
   * @param {import('knex').Knex} db
   */
  constructor(db) {
    super(db, 'users');
  }

  /**
   * 根据邮箱查找用户
   * @param {string} email
   * @returns {Promise<User|undefined>}
   */
  async findByEmail(email) {
    return await this.findOne({ email });
  }

  /**
   * 根据用户名查找用户
   * @param {string} username
   * @returns {Promise<User|undefined>}
   */
  async findByUsername(username) {
    return await this.findOne({ username });
  }

  /**
   * 检查邮箱是否已存在
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    return await this.exists({ email });
  }

  /**
   * 检查用户名是否已存在
   * @param {string} username
   * @returns {Promise<boolean>}
   */
  async usernameExists(username) {
    return await this.exists({ username });
  }

  /**
   * 获取用户的像素数量
   * @param {number} userId
   * @returns {Promise<number>}
   */
  async getUserPixelCount(userId) {
    const [{ count }] = await this.db('pixels')
      .where({ user_id: userId })
      .count('* as count');
    return parseInt(count, 10);
  }

  /**
   * 获取用户及其统计信息
   * @param {number} userId
   * @returns {Promise<User & {pixel_count: number}|undefined>}
   */
  async findByIdWithStats(userId) {
    const user = await this.findById(userId);
    if (!user) return undefined;

    const pixelCount = await this.getUserPixelCount(userId);

    return {
      ...user,
      pixel_count: pixelCount
    };
  }

  /**
   * 更新用户头像
   * @param {number} userId
   * @param {string} avatarUrl
   * @returns {Promise<User|undefined>}
   */
  async updateAvatar(userId, avatarUrl) {
    return await this.update(userId, { avatar_url: avatarUrl });
  }

  /**
   * 验证用户邮箱
   * @param {number} userId
   * @returns {Promise<User|undefined>}
   */
  async verifyEmail(userId) {
    return await this.update(userId, { is_email_verified: true });
  }

  /**
   * 搜索用户（by username or display_name）
   * @param {string} searchTerm
   * @param {number} limit
   * @returns {Promise<User[]>}
   */
  async search(searchTerm, limit = 10) {
    return await this.query()
      .where('username', 'like', `%${searchTerm}%`)
      .orWhere('display_name', 'like', `%${searchTerm}%`)
      .limit(limit);
  }

  /**
   * 获取最近注册的用户
   * @param {number} limit
   * @returns {Promise<User[]>}
   */
  async getRecentUsers(limit = 10) {
    return await this.query()
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * 批量获取用户信息
   * @param {number[]} userIds
   * @returns {Promise<User[]>}
   */
  async findByIds(userIds) {
    return await this.query()
      .whereIn('id', userIds);
  }

  /**
   * 软删除用户（标记为已删除而不是真正删除）
   * @param {number} userId
   * @returns {Promise<User|undefined>}
   */
  async softDelete(userId) {
    return await this.update(userId, {
      is_deleted: true,
      deleted_at: new Date()
    });
  }
}

module.exports = UserRepository;
