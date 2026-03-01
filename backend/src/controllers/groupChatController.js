const GroupChat = require('../models/GroupChat');
const GroupMember = require('../models/GroupMember');
const GroupMessage = require('../models/GroupMessage');

class GroupChatController {
  // 创建群聊
  static async createGroup(req, res) {
    try {
      const { name, description, is_private = false, max_members = 256 } = req.body;
      const creatorId = req.user.id;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '群聊名称不能为空'
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          message: '群聊名称不能超过50个字符'
        });
      }

      if (max_members > 256) {
        return res.status(400).json({
          success: false,
          message: '群聊成员数量不能超过256人'
        });
      }

      // 生成邀请码
      const inviteCode = GroupChat.generateInviteCode();

      // 创建群聊
      const group = await GroupChat.create({
        name: name.trim(),
        description: description ? description.trim() : null,
        creator_id: creatorId,
        is_private,
        invite_code: inviteCode,
        max_members
      });

      // 添加创建者为群主
      await GroupMember.addMember(group.id, creatorId, 'creator');

      // 创建系统消息
      await GroupMessage.createSystemMessage(
        group.id,
        `群聊"${group.name}"创建成功`,
        { type: 'group_created', creator_id: creatorId }
      );

      res.json({
        success: true,
        data: {
          group,
          invite_code: inviteCode
        },
        message: '群聊创建成功'
      });
    } catch (error) {
      console.error('创建群聊失败:', error);
      res.status(500).json({
        success: false,
        message: '创建群聊失败',
        error: error.message
      });
    }
  }

  // 获取用户的群聊列表
  static async getUserGroups(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const groups = await GroupChat.getUserGroups(userId, parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      console.error('获取群聊列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取群聊列表失败',
        error: error.message
      });
    }
  }

  // 根据ID获取群聊详情
  static async getGroupDetails(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const group = await GroupChat.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: '群聊不存在'
        });
      }

      // 检查用户是否为群成员
      const isMember = await GroupMember.isMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是群成员'
        });
      }

      // 获取用户在群中的角色
      const userRole = await group.getUserRole(userId);

      // 获取群聊统计信息
      const stats = await GroupChat.getGroupStats(groupId);

      res.json({
        success: true,
        data: {
          ...group,
          user_role: userRole,
          stats
        }
      });
    } catch (error) {
      console.error('获取群聊详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取群聊详情失败',
        error: error.message
      });
    }
  }

  // 通过邀请码加入群聊
  static async joinGroupByInvite(req, res) {
    try {
      const { invite_code } = req.body;
      const userId = req.user.id;

      if (!invite_code) {
        return res.status(400).json({
          success: false,
          message: '邀请码不能为空'
        });
      }

      const group = await GroupChat.findByInviteCode(invite_code);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: '邀请码无效'
        });
      }

      // 检查是否已是群成员
      const isMember = await GroupMember.isMember(group.id, userId);
      if (isMember) {
        return res.status(400).json({
          success: false,
          message: '您已经是群成员'
        });
      }

      // 检查群聊是否已满
      const isAtLimit = await group.isAtMemberLimit();
      if (isAtLimit) {
        return res.status(400).json({
          success: false,
          message: '群聊人数已满'
        });
      }

      // 添加成员
      const member = await GroupMember.addMember(group.id, userId, 'member');

      // 更新成员数量
      await group.updateMemberCount();

      // 创建系统消息
      await GroupMessage.createSystemMessage(
        group.id,
        `${req.user.display_name || req.user.username} 加入了群聊`,
        { type: 'member_joined', user_id: userId }
      );

      res.json({
        success: true,
        data: {
          group,
          membership: member
        },
        message: '加入群聊成功'
      });
    } catch (error) {
      console.error('加入群聊失败:', error);
      res.status(500).json({
        success: false,
        message: '加入群聊失败',
        error: error.message
      });
    }
  }

  // 获取群聊成员列表
  static async getGroupMembers(req, res) {
    try {
      const { groupId } = req.params;
      const { limit = 100, offset = 0 } = req.query;
      const userId = req.user.id;

      // 检查用户是否为群成员
      const isMember = await GroupMember.isMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是群成员'
        });
      }

      const members = await GroupMember.getGroupMembers(groupId, parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('获取群成员失败:', error);
      res.status(500).json({
        success: false,
        message: '获取群成员失败',
        error: error.message
      });
    }
  }

  // 发送群聊消息
  static async sendMessage(req, res) {
    try {
      const { groupId } = req.params;
      const { content, message_type = 'text', metadata, reply_to_id } = req.body;
      const senderId = req.user.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        });
      }

      // 检查用户是否为群成员
      const member = await GroupMember.getUserMembership(groupId, senderId);
      if (!member) {
        return res.status(403).json({
          success: false,
          message: '您不是群成员'
        });
      }

      // 检查用户是否被静音
      if (member.isMuted()) {
        return res.status(403).json({
          success: false,
          message: '您在此群聊中被静音'
        });
      }

      // 发送消息
      const message = await GroupMessage.send({
        group_id: groupId,
        sender_id: senderId,
        content: content.trim(),
        message_type,
        metadata,
        reply_to_id
      });

      res.json({
        success: true,
        data: message,
        message: '消息发送成功'
      });
    } catch (error) {
      console.error('发送群聊消息失败:', error);
      res.status(500).json({
        success: false,
        message: '发送消息失败',
        error: error.message
      });
    }
  }

  // 获取群聊消息
  static async getGroupMessages(req, res) {
    try {
      const { groupId } = req.params;
      const { limit = 50, offset = 0, before_id } = req.query;
      const userId = req.user.id;

      // 检查用户是否为群成员
      const isMember = await GroupMember.isMember(groupId, userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是群成员'
        });
      }

      const messages = await GroupMessage.getGroupMessages(
        groupId,
        parseInt(limit),
        parseInt(offset),
        before_id
      );

      res.json({
        success: true,
        data: messages.reverse() // 按时间正序返回
      });
    } catch (error) {
      console.error('获取群聊消息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取群聊消息失败',
        error: error.message
      });
    }
  }

  // 退出群聊
  static async leaveGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const member = await GroupMember.getUserMembership(groupId, userId);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: '您不是群成员'
        });
      }

      await member.leave();

      // 更新群聊成员数量
      const group = await GroupChat.findById(groupId);
      if (group) {
        await group.updateMemberCount();
      }

      // 创建系统消息
      await GroupMessage.createSystemMessage(
        groupId,
        `${req.user.display_name || req.user.username} 退出了群聊`,
        { type: 'member_left', user_id: userId }
      );

      res.json({
        success: true,
        message: '退出群聊成功'
      });
    } catch (error) {
      console.error('退出群聊失败:', error);
      res.status(500).json({
        success: false,
        message: '退出群聊失败',
        error: error.message
      });
    }
  }

  // 踢出成员（仅管理员和群主）
  static async removeMember(req, res) {
    try {
      const { groupId, memberId } = req.params;
      const userId = req.user.id;

      const group = await GroupChat.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: '群聊不存在'
        });
      }

      // 检查操作者权限
      const isAdmin = await group.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: '只有管理员可以踢出成员'
        });
      }

      // 获取要踢出的成员信息
      const targetMember = await GroupMember.findById(memberId);
      if (!targetMember || targetMember.group_id !== groupId) {
        return res.status(404).json({
          success: false,
          message: '成员不存在'
        });
      }

      await GroupMember.removeMember(groupId, targetMember.user_id, userId);

      // 更新群聊成员数量
      await group.updateMemberCount();

      // 创建系统消息
      await GroupMessage.createSystemMessage(
        groupId,
        `${targetMember.user_display_name || targetMember.user_username} 被移出群聊`,
        { type: 'member_removed', user_id: targetMember.user_id, removed_by: userId }
      );

      res.json({
        success: true,
        message: '成员已被移出群聊'
      });
    } catch (error) {
      console.error('踢出成员失败:', error);
      res.status(500).json({
        success: false,
        message: '踢出成员失败',
        error: error.message
      });
    }
  }

  // 更新群聊信息
  static async updateGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { name, description, avatar_url } = req.body;
      const userId = req.user.id;

      const group = await GroupChat.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: '群聊不存在'
        });
      }

      // 检查权限
      const isAdmin = await group.isUserAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: '只有管理员可以修改群聊信息'
        });
      }

      const updateData = {};
      if (name !== undefined) {
        if (name.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: '群聊名称不能为空'
          });
        }
        if (name.length > 50) {
          return res.status(400).json({
            success: false,
            message: '群聊名称不能超过50个字符'
          });
        }
        updateData.name = name.trim();
      }

      if (description !== undefined) {
        updateData.description = description ? description.trim() : null;
      }

      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

      await group.update(updateData);

      res.json({
        success: true,
        data: group,
        message: '群聊信息更新成功'
      });
    } catch (error) {
      console.error('更新群聊信息失败:', error);
      res.status(500).json({
        success: false,
        message: '更新群聊信息失败',
        error: error.message
      });
    }
  }

  // 搜索群聊
  static async searchGroups(req, res) {
    try {
      const { query, limit = 20 } = req.query;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        });
      }

      const groups = await GroupChat.search(query.trim(), parseInt(limit));

      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      console.error('搜索群聊失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索群聊失败',
        error: error.message
      });
    }
  }

  // 解散群聊（仅群主）
  static async deleteGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const group = await GroupChat.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: '群聊不存在'
        });
      }

      // 只有群主可以解散群聊
      if (!group.isUserCreator(userId)) {
        return res.status(403).json({
          success: false,
          message: '只有群主可以解散群聊'
        });
      }

      await group.delete();

      // 创建系统消息
      await GroupMessage.createSystemMessage(
        groupId,
        `群聊"${group.name}"已被解散`,
        { type: 'group_deleted', deleted_by: userId }
      );

      res.json({
        success: true,
        message: '群聊已解散'
      });
    } catch (error) {
      console.error('解散群聊失败:', error);
      res.status(500).json({
        success: false,
        message: '解散群聊失败',
        error: error.message
      });
    }
  }
}

module.exports = GroupChatController;