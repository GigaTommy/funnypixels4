// @ts-check
const BaseRepository = require('./BaseRepository');

/**
 * @typedef {Object} Pixel
 * @property {number} id
 * @property {string} grid_id
 * @property {number} user_id
 * @property {string} color
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} [pattern_id]
 * @property {number} [ad_campaign_id]
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * 像素 Repository
 * 封装像素相关的数据访问操作
 *
 * @extends {BaseRepository<Pixel>}
 */
class PixelRepository extends BaseRepository {
  /**
   * @param {import('knex').Knex} db
   */
  constructor(db) {
    super(db, 'pixels');
  }

  /**
   * 根据 grid_id 查找像素
   * @param {string} gridId
   * @returns {Promise<Pixel|undefined>}
   */
  async findByGridId(gridId) {
    return await this.findOne({ grid_id: gridId });
  }

  /**
   * 批量根据 grid_id 查找像素
   * @param {string[]} gridIds
   * @returns {Promise<Pixel[]>}
   */
  async findByGridIds(gridIds) {
    return await this.query().whereIn('grid_id', gridIds);
  }

  /**
   * 根据用户ID获取像素列表
   * @param {number} userId
   * @param {Object} options
   * @returns {Promise<Pixel[]>}
   */
  async findByUserId(userId, options = {}) {
    return await this.findMany({ user_id: userId }, options);
  }

  /**
   * 获取用户在指定时间范围内的像素
   * @param {number} userId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Pixel[]>}
   */
  async findByUserIdAndDateRange(userId, startDate, endDate) {
    return await this.query()
      .where({ user_id: userId })
      .whereBetween('created_at', [startDate, endDate]);
  }

  /**
   * 获取区域内的所有像素
   * @param {number} minLat
   * @param {number} maxLat
   * @param {number} minLon
   * @param {number} maxLon
   * @returns {Promise<Pixel[]>}
   */
  async findByBounds(minLat, maxLat, minLon, maxLon) {
    return await this.query()
      .whereBetween('latitude', [minLat, maxLat])
      .whereBetween('longitude', [minLon, maxLon]);
  }

  /**
   * 获取最近创建的像素
   * @param {number} limit
   * @returns {Promise<Pixel[]>}
   */
  async getRecentPixels(limit = 100) {
    return await this.query()
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * 统计用户的像素数量（按时间范围）
   * @param {number} userId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<number>}
   */
  async countByUserAndDateRange(userId, startDate, endDate) {
    const [{ count }] = await this.query()
      .where({ user_id: userId })
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count');
    return parseInt(count, 10);
  }

  /**
   * 获取像素及其创建者信息
   * @param {string} gridId
   * @returns {Promise<Pixel & {user: Object}|undefined>}
   */
  async findByGridIdWithUser(gridId) {
    const result = await this.query()
      .where({ 'pixels.grid_id': gridId })
      .join('users', 'pixels.user_id', 'users.id')
      .select(
        'pixels.*',
        'users.id as user_id',
        'users.username',
        'users.display_name',
        'users.avatar_url'
      )
      .first();

    if (!result) return undefined;

    // 重构结果格式
    const { username, display_name, avatar_url, ...pixel } = result;
    return {
      ...pixel,
      user: {
        id: pixel.user_id,
        username,
        display_name,
        avatar_url
      }
    };
  }

  /**
   * 批量插入像素（用于批量绘制）
   * @param {Array<Partial<Pixel>>} pixels
   * @returns {Promise<Pixel[]>}
   */
  async bulkInsert(pixels) {
    return await this.createMany(pixels);
  }

  /**
   * 更新像素（用于覆盖绘制）
   * @param {string} gridId
   * @param {number} userId
   * @param {string} color
   * @param {number} [patternId]
   * @returns {Promise<Pixel|undefined>}
   */
  async updatePixel(gridId, userId, color, patternId) {
    const [updated] = await this.query()
      .where({ grid_id: gridId })
      .update({
        user_id: userId,
        color,
        pattern_id: patternId,
        updated_at: new Date()
      })
      .returning('*');
    return updated;
  }

  /**
   * 创建或更新像素（upsert）
   * @param {Partial<Pixel>} pixelData
   * @returns {Promise<Pixel>}
   */
  async upsert(pixelData) {
    const { grid_id, user_id, color, latitude, longitude, pattern_id, ad_campaign_id } = pixelData;

    // 使用 PostgreSQL 的 ON CONFLICT
    const [pixel] = await this.query()
      .insert({
        grid_id,
        user_id,
        color,
        latitude,
        longitude,
        pattern_id,
        ad_campaign_id,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict('grid_id')
      .merge({
        user_id,
        color,
        pattern_id,
        ad_campaign_id,
        updated_at: new Date()
      })
      .returning('*');

    return pixel;
  }

  /**
   * 获取用户的领土像素（未被其他用户覆盖的像素）
   * @param {number} userId
   * @returns {Promise<Pixel[]>}
   */
  async getUserTerritoryPixels(userId) {
    // 使用子查询找到每个 grid_id 的最新记录
    return await this.db
      .select('p1.*')
      .from('pixels as p1')
      .innerJoin(
        this.db('pixels')
          .select('grid_id')
          .max('created_at as max_created_at')
          .groupBy('grid_id')
          .as('p2'),
        function() {
          this.on('p1.grid_id', '=', 'p2.grid_id')
            .andOn('p1.created_at', '=', 'p2.max_created_at');
        }
      )
      .where('p1.user_id', userId);
  }

  /**
   * 统计用户的领土像素数量
   * @param {number} userId
   * @returns {Promise<number>}
   */
  async countUserTerritoryPixels(userId) {
    const [{ count }] = await this.db
      .count('* as count')
      .from('pixels as p1')
      .innerJoin(
        this.db('pixels')
          .select('grid_id')
          .max('created_at as max_created_at')
          .groupBy('grid_id')
          .as('p2'),
        function() {
          this.on('p1.grid_id', '=', 'p2.grid_id')
            .andOn('p1.created_at', '=', 'p2.max_created_at');
        }
      )
      .where('p1.user_id', userId);

    return parseInt(count, 10);
  }

  /**
   * 获取热门像素区域（像素密集区域）
   * @param {number} limit
   * @returns {Promise<Array<{latitude: number, longitude: number, pixel_count: number}>>}
   */
  async getHotspots(limit = 10) {
    // 使用网格聚合找到像素密集区域
    const hotspots = await this.query()
      .select(
        this.db.raw('ROUND(latitude::numeric, 2) as latitude'),
        this.db.raw('ROUND(longitude::numeric, 2) as longitude'),
        this.db.raw('COUNT(*) as pixel_count')
      )
      .groupBy(
        this.db.raw('ROUND(latitude::numeric, 2)'),
        this.db.raw('ROUND(longitude::numeric, 2)')
      )
      .orderBy('pixel_count', 'desc')
      .limit(limit);

    return hotspots.map(h => ({
      latitude: parseFloat(h.latitude),
      longitude: parseFloat(h.longitude),
      pixel_count: parseInt(h.pixel_count, 10)
    }));
  }

  /**
   * 删除用户的所有像素（管理员功能）
   * @param {number} userId
   * @returns {Promise<number>}
   */
  async deleteByUserId(userId) {
    return await this.deleteMany({ user_id: userId });
  }
}

module.exports = PixelRepository;
