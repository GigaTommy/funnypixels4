// @ts-check
const BaseRepository = require('./BaseRepository');

/**
 * @typedef {Object} Alliance
 * @property {number} id
 * @property {string} name
 * @property {string} [description]
 * @property {number} leader_id
 * @property {string} [flag_color]
 * @property {string} [logo_url]
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} AllianceMember
 * @property {number} id
 * @property {number} alliance_id
 * @property {number} user_id
 * @property {string} role
 * @property {Date} joined_at
 */

/**
 * 联盟 Repository
 * 封装联盟相关的数据访问操作
 *
 * @extends {BaseRepository<Alliance>}
 */
class AllianceRepository extends BaseRepository {
  /**
   * @param {import('knex').Knex} db
   */
  constructor(db) {
    super(db, 'alliances');
  }

  /**
   * 根据名称查找联盟
   * @param {string} name
   * @returns {Promise<Alliance|undefined>}
   */
  async findByName(name) {
    return await this.findOne({ name });
  }

  /**
   * 检查联盟名称是否已存在
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async nameExists(name) {
    return await this.exists({ name });
  }

  /**
   * 获取联盟及其领袖信息
   * @param {number} allianceId
   * @returns {Promise<Alliance & {leader: Object}|undefined>}
   */
  async findByIdWithLeader(allianceId) {
    const result = await this.query()
      .where({ 'alliances.id': allianceId })
      .join('users', 'alliances.leader_id', 'users.id')
      .select(
        'alliances.*',
        'users.id as leader_id',
        'users.username as leader_username',
        'users.display_name as leader_display_name',
        'users.avatar_url as leader_avatar_url'
      )
      .first();

    if (!result) return undefined;

    const {
      leader_username,
      leader_display_name,
      leader_avatar_url,
      ...alliance
    } = result;

    return {
      ...alliance,
      leader: {
        id: alliance.leader_id,
        username: leader_username,
        display_name: leader_display_name,
        avatar_url: leader_avatar_url
      }
    };
  }

  /**
   * 获取联盟的所有成员
   * @param {number} allianceId
   * @returns {Promise<Array<AllianceMember & {user: Object}>>}
   */
  async getMembers(allianceId) {
    const members = await this.db('alliance_members')
      .where({ alliance_id: allianceId })
      .join('users', 'alliance_members.user_id', 'users.id')
      .select(
        'alliance_members.*',
        'users.username',
        'users.display_name',
        'users.avatar_url'
      );

    return members.map(m => {
      const { username, display_name, avatar_url, ...member } = m;
      return {
        ...member,
        user: {
          id: member.user_id,
          username,
          display_name,
          avatar_url
        }
      };
    });
  }

  /**
   * 获取联盟成员数量
   * @param {number} allianceId
   * @returns {Promise<number>}
   */
  async getMemberCount(allianceId) {
    const [{ count }] = await this.db('alliance_members')
      .where({ alliance_id: allianceId })
      .count('* as count');
    return parseInt(count, 10);
  }

  /**
   * 添加成员到联盟
   * @param {number} allianceId
   * @param {number} userId
   * @param {string} role
   * @returns {Promise<AllianceMember>}
   */
  async addMember(allianceId, userId, role = 'member') {
    const [member] = await this.db('alliance_members')
      .insert({
        alliance_id: allianceId,
        user_id: userId,
        role,
        joined_at: new Date()
      })
      .returning('*');
    return member;
  }

  /**
   * 从联盟移除成员
   * @param {number} allianceId
   * @param {number} userId
   * @returns {Promise<number>}
   */
  async removeMember(allianceId, userId) {
    return await this.db('alliance_members')
      .where({ alliance_id: allianceId, user_id: userId })
      .del();
  }

  /**
   * 更新成员角色
   * @param {number} allianceId
   * @param {number} userId
   * @param {string} role
   * @returns {Promise<AllianceMember|undefined>}
   */
  async updateMemberRole(allianceId, userId, role) {
    const [updated] = await this.db('alliance_members')
      .where({ alliance_id: allianceId, user_id: userId })
      .update({ role })
      .returning('*');
    return updated;
  }

  /**
   * 检查用户是否是联盟成员
   * @param {number} allianceId
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  async isMember(allianceId, userId) {
    const member = await this.db('alliance_members')
      .where({ alliance_id: allianceId, user_id: userId })
      .first();
    return !!member;
  }

  /**
   * 获取用户所在的联盟
   * @param {number} userId
   * @returns {Promise<Alliance|undefined>}
   */
  async findByUserId(userId) {
    const result = await this.db('alliances')
      .join('alliance_members', 'alliances.id', 'alliance_members.alliance_id')
      .where({ 'alliance_members.user_id': userId })
      .select('alliances.*')
      .first();

    return result;
  }

  /**
   * 获取用户在联盟中的角色
   * @param {number} allianceId
   * @param {number} userId
   * @returns {Promise<string|null>}
   */
  async getUserRole(allianceId, userId) {
    const member = await this.db('alliance_members')
      .where({ alliance_id: allianceId, user_id: userId })
      .select('role')
      .first();

    return member ? member.role : null;
  }

  /**
   * 获取联盟的领土像素数量
   * @param {number} allianceId
   * @returns {Promise<number>}
   */
  async getTerritoryPixelCount(allianceId) {
    // 获取联盟所有成员的ID
    const memberIds = await this.db('alliance_members')
      .where({ alliance_id: allianceId })
      .pluck('user_id');

    if (memberIds.length === 0) return 0;

    // 统计成员的领土像素（最新的像素）
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
      .whereIn('p1.user_id', memberIds);

    return parseInt(count, 10);
  }

  /**
   * 搜索联盟
   * @param {string} searchTerm
   * @param {number} limit
   * @returns {Promise<Alliance[]>}
   */
  async search(searchTerm, limit = 10) {
    return await this.query()
      .where('name', 'like', `%${searchTerm}%`)
      .orWhere('description', 'like', `%${searchTerm}%`)
      .limit(limit);
  }

  /**
   * 获取排行榜上的联盟（按领土像素数量）
   * @param {number} limit
   * @returns {Promise<Array<Alliance & {territory_count: number, member_count: number}>>}
   */
  async getLeaderboard(limit = 50) {
    // 复杂查询，建议在实际使用时优化或使用视图
    const alliances = await this.findAll({ limit, orderBy: 'created_at', order: 'desc' });

    // 为每个联盟获取统计信息
    const alliancesWithStats = await Promise.all(
      alliances.map(async (alliance) => {
        const [territoryCount, memberCount] = await Promise.all([
          this.getTerritoryPixelCount(alliance.id),
          this.getMemberCount(alliance.id)
        ]);

        return {
          ...alliance,
          territory_count: territoryCount,
          member_count: memberCount
        };
      })
    );

    // 按领土数量排序
    return alliancesWithStats.sort((a, b) => b.territory_count - a.territory_count);
  }

  /**
   * 转让联盟领导权
   * @param {number} allianceId
   * @param {number} newLeaderId
   * @returns {Promise<Alliance|undefined>}
   */
  async transferLeadership(allianceId, newLeaderId) {
    return await this.update(allianceId, { leader_id: newLeaderId });
  }

  /**
   * 解散联盟
   * @param {number} allianceId
   * @returns {Promise<void>}
   */
  async dissolve(allianceId) {
    await this.transaction(async (trx) => {
      // 删除所有成员
      await trx('alliance_members').where({ alliance_id: allianceId }).del();

      // 删除联盟
      await trx('alliances').where({ id: allianceId }).del();
    });
  }
}

module.exports = AllianceRepository;
