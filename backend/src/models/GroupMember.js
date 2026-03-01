const { db } = require('../config/database');

class GroupMember {
  constructor(data) {
    this.id = data.id;
    this.group_id = data.group_id;
    this.user_id = data.user_id;
    this.role = data.role || 'member'; // creator, admin, member
    this.nickname = data.nickname;
    this.is_muted = data.is_muted || false;
    this.mute_until = data.mute_until;
    this.is_active = data.is_active !== false;
    this.joined_at = data.joined_at;
    this.updated_at = data.updated_at;

    // 关联的用户信息
    this.user_username = data.user_username;
    this.user_display_name = data.user_display_name;
    this.user_avatar_url = data.user_avatar_url;
  }

  // 添加成员到群聊
  static async addMember(groupId, userId, role = 'member', addedBy = null) {
    // 检查是否已存在
    const existing = await db('group_members')
      .where('group_id', groupId)
      .where('user_id', userId)
      .first();

    if (existing) {
      if (existing.is_active) {
        throw new Error('用户已在群聊中');
      } else {
        // 重新激活
        await db('group_members')
          .where('id', existing.id)
          .update({
            is_active: true,
            role: role,
            joined_at: db.fn.now(),
            updated_at: db.fn.now()
          });

        return this.findById(existing.id);
      }
    }

    const [member] = await db('group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role: role,
        added_by: addedBy
      })
      .returning('*');

    return new GroupMember(member);
  }

  // 根据ID获取成员
  static async findById(id) {
    const member = await db('group_members')
      .select(
        'group_members.*',
        'users.username as user_username',
        'users.display_name as user_display_name',
        'users.avatar_url as user_avatar_url'
      )
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.id', id)
      .where('group_members.is_active', true)
      .first();

    return member ? new GroupMember(member) : null;
  }

  // 获取群聊成员列表
  static async getGroupMembers(groupId, limit = 100, offset = 0) {
    const members = await db('group_members')
      .select(
        'group_members.*',
        'users.username as user_username',
        'users.display_name as user_display_name',
        'users.avatar_url as user_avatar_url',
        'users.is_verified as user_verified'
      )
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.group_id', groupId)
      .where('group_members.is_active', true)
      .orderBy([
        { column: db.raw("CASE WHEN role = 'creator' THEN 1 WHEN role = 'admin' THEN 2 ELSE 3 END") },
        { column: 'group_members.joined_at', order: 'asc' }
      ])
      .limit(limit)
      .offset(offset);

    return members.map(member => new GroupMember(member));
  }

  // 检查用户是否在群聊中
  static async isMember(groupId, userId) {
    const member = await db('group_members')
      .where('group_id', groupId)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    return !!member;
  }

  // 获取用户在群聊中的信息
  static async getUserMembership(groupId, userId) {
    const member = await db('group_members')
      .select(
        'group_members.*',
        'users.username as user_username',
        'users.display_name as user_display_name',
        'users.avatar_url as user_avatar_url'
      )
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.group_id', groupId)
      .where('group_members.user_id', userId)
      .where('group_members.is_active', true)
      .first();

    return member ? new GroupMember(member) : null;
  }

  // 更新成员信息
  async update(data) {
    const updated = await db('group_members')
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

  // 踢出成员
  static async removeMember(groupId, userId, removedBy = null) {
    const member = await db('group_members')
      .where('group_id', groupId)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!member) {
      throw new Error('用户不在群聊中');
    }

    if (member.role === 'creator') {
      throw new Error('不能移除群主');
    }

    await db('group_members')
      .where('id', member.id)
      .update({
        is_active: false,
        removed_by: removedBy,
        updated_at: db.fn.now()
      });

    return true;
  }

  // 退出群聊
  async leave() {
    if (this.role === 'creator') {
      throw new Error('群主不能退出群聊，请先转让群主或解散群聊');
    }

    await db('group_members')
      .where('id', this.id)
      .update({
        is_active: false,
        updated_at: db.fn.now()
      });

    this.is_active = false;
    return this;
  }

  // 设置成员静音
  async mute(duration = null, mutedBy = null) {
    const muteUntil = duration ? new Date(Date.now() + duration) : null;

    await this.update({
      is_muted: true,
      mute_until: muteUntil,
      muted_by: mutedBy
    });

    return this;
  }

  // 取消静音
  async unmute() {
    await this.update({
      is_muted: false,
      mute_until: null,
      muted_by: null
    });

    return this;
  }

  // 检查是否被静音
  isMuted() {
    if (!this.is_muted) return false;

    if (this.mute_until && new Date() > new Date(this.mute_until)) {
      // 静音时间已过，自动取消静音
      this.unmute();
      return false;
    }

    return true;
  }

  // 提升为管理员
  async promoteToAdmin() {
    if (this.role === 'creator') {
      throw new Error('群主不需要提升权限');
    }

    await this.update({ role: 'admin' });
    return this;
  }

  // 降级为普通成员
  async demoteToMember() {
    if (this.role === 'creator') {
      throw new Error('不能降级群主');
    }

    await this.update({ role: 'member' });
    return this;
  }

  // 转让群主
  async transferOwnership(newOwnerId) {
    if (this.role !== 'creator') {
      throw new Error('只有群主可以转让群聊');
    }

    const newOwner = await db('group_members')
      .where('group_id', this.group_id)
      .where('user_id', newOwnerId)
      .where('is_active', true)
      .first();

    if (!newOwner) {
      throw new Error('新群主必须是群成员');
    }

    // 使用事务确保数据一致性
    await db.transaction(async (trx) => {
      // 将当前群主降级为管理员
      await trx('group_members')
        .where('id', this.id)
        .update({
          role: 'admin',
          updated_at: trx.fn.now()
        });

      // 将新用户提升为群主
      await trx('group_members')
        .where('id', newOwner.id)
        .update({
          role: 'creator',
          updated_at: trx.fn.now()
        });

      // 更新群聊的创建者
      await trx('group_chats')
        .where('id', this.group_id)
        .update({
          creator_id: newOwnerId,
          updated_at: trx.fn.now()
        });
    });

    this.role = 'admin';
    return this;
  }

  // 获取成员统计信息
  static async getMemberStats(groupId) {
    const stats = await db('group_members')
      .select(
        db.raw('COUNT(*) as total_members'),
        db.raw("COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count"),
        db.raw("COUNT(CASE WHEN role = 'creator' THEN 1 END) as creator_count"),
        db.raw('COUNT(CASE WHEN is_muted = true THEN 1 END) as muted_count')
      )
      .where('group_id', groupId)
      .where('is_active', true)
      .first();

    return {
      total_members: parseInt(stats.total_members),
      admin_count: parseInt(stats.admin_count),
      creator_count: parseInt(stats.creator_count),
      muted_count: parseInt(stats.muted_count),
      member_count: parseInt(stats.total_members) - parseInt(stats.admin_count) - parseInt(stats.creator_count)
    };
  }

  // 批量添加成员
  static async addMembers(groupId, userIds, addedBy = null) {
    const results = [];

    for (const userId of userIds) {
      try {
        const member = await this.addMember(groupId, userId, 'member', addedBy);
        results.push({ success: true, member, userId });
      } catch (error) {
        results.push({ success: false, error: error.message, userId });
      }
    }

    return results;
  }
}

module.exports = GroupMember;