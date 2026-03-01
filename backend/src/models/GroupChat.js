const { db } = require('../config/database');

class GroupChat {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.avatar_url = data.avatar_url;
    this.creator_id = data.creator_id;
    this.is_private = data.is_private || false;
    this.invite_code = data.invite_code;
    this.max_members = data.max_members || 256;
    this.member_count = data.member_count || 0;
    this.is_active = data.is_active !== false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建群聊
  static async create(data) {
    const [group] = await db('group_chats')
      .insert({
        name: data.name,
        description: data.description,
        avatar_url: data.avatar_url,
        creator_id: data.creator_id,
        is_private: data.is_private || false,
        invite_code: data.invite_code,
        max_members: data.max_members || 256
      })
      .returning('*');

    return new GroupChat(group);
  }

  // 根据ID获取群聊
  static async findById(id) {
    const group = await db('group_chats')
      .where('id', id)
      .where('is_active', true)
      .first();

    return group ? new GroupChat(group) : null;
  }

  // 根据邀请码获取群聊
  static async findByInviteCode(inviteCode) {
    const group = await db('group_chats')
      .where('invite_code', inviteCode)
      .where('is_active', true)
      .first();

    return group ? new GroupChat(group) : null;
  }

  // 获取用户的群聊列表
  static async getUserGroups(userId, limit = 50, offset = 0) {
    const groups = await db('group_chats')
      .select('group_chats.*', 'group_members.role', 'group_members.joined_at')
      .join('group_members', 'group_chats.id', 'group_members.group_id')
      .where('group_members.user_id', userId)
      .where('group_members.is_active', true)
      .where('group_chats.is_active', true)
      .orderBy('group_members.joined_at', 'desc')
      .limit(limit)
      .offset(offset);

    return groups.map(group => new GroupChat(group));
  }

  // 更新群聊信息
  async update(data) {
    const updated = await db('group_chats')
      .where('id', this.id)
      .update({
        ...data,
        updated_at: db.fn.now()
      })
      .returning('*');

    if (updated.length > 0) {
      Object.assign(this, updated[0]);
    }

    return this;
  }

  // 生成邀请码
  static generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 更新成员数量
  async updateMemberCount() {
    const count = await db('group_members')
      .where('group_id', this.id)
      .where('is_active', true)
      .count('* as count')
      .first();

    this.member_count = parseInt(count.count);

    await db('group_chats')
      .where('id', this.id)
      .update({
        member_count: this.member_count,
        updated_at: db.fn.now()
      });

    return this.member_count;
  }

  // 检查是否达到成员上限
  async isAtMemberLimit() {
    await this.updateMemberCount();
    return this.member_count >= this.max_members;
  }

  // 删除群聊（软删除）
  async delete() {
    await db('group_chats')
      .where('id', this.id)
      .update({
        is_active: false,
        updated_at: db.fn.now()
      });

    // 同时将所有成员设为非活跃
    await db('group_members')
      .where('group_id', this.id)
      .update({
        is_active: false,
        updated_at: db.fn.now()
      });

    this.is_active = false;
    return this;
  }

  // 检查用户权限
  async getUserRole(userId) {
    const member = await db('group_members')
      .where('group_id', this.id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    return member ? member.role : null;
  }

  // 检查用户是否为管理员
  async isUserAdmin(userId) {
    const role = await this.getUserRole(userId);
    return role === 'admin' || role === 'creator';
  }

  // 检查用户是否为创建者
  isUserCreator(userId) {
    return this.creator_id === userId;
  }

  // 获取群聊统计信息
  static async getGroupStats(groupId) {
    const stats = await db('group_chats')
      .select(
        'group_chats.*',
        db.raw('COUNT(DISTINCT group_members.id) as total_members'),
        db.raw('COUNT(DISTINCT CASE WHEN group_messages.created_at >= CURRENT_DATE THEN group_messages.id END) as messages_today')
      )
      .leftJoin('group_members', function() {
        this.on('group_chats.id', '=', 'group_members.group_id')
            .andOn('group_members.is_active', '=', db.raw('true'));
      })
      .leftJoin('group_messages', function() {
        this.on('group_chats.id', '=', 'group_messages.group_id')
            .andOn('group_messages.created_at', '>=', db.raw('CURRENT_DATE'));
      })
      .where('group_chats.id', groupId)
      .where('group_chats.is_active', true)
      .groupBy('group_chats.id')
      .first();

    return stats;
  }

  // 搜索群聊
  static async search(query, limit = 20) {
    const groups = await db('group_chats')
      .where('is_active', true)
      .where('is_private', false)
      .where(function() {
        this.where('name', 'ilike', `%${query}%`)
            .orWhere('description', 'ilike', `%${query}%`);
      })
      .orderBy('member_count', 'desc')
      .limit(limit);

    return groups.map(group => new GroupChat(group));
  }
}

module.exports = GroupChat;