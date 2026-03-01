const { db } = require('../config/database');

class GroupMessage {
  constructor(data) {
    this.id = data.id;
    this.group_id = data.group_id;
    this.sender_id = data.sender_id;
    this.content = data.content;
    this.message_type = data.message_type || 'text'; // text, image, file, system
    this.metadata = data.metadata;
    this.reply_to_id = data.reply_to_id;
    this.is_edited = data.is_edited || false;
    this.edit_count = data.edit_count || 0;
    this.is_pinned = data.is_pinned || false;
    this.is_deleted = data.is_deleted || false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;

    // 关联的发送者信息
    this.sender_username = data.sender_username;
    this.sender_display_name = data.sender_display_name;
    this.sender_avatar_url = data.sender_avatar_url;

    // 回复消息信息
    this.reply_to_content = data.reply_to_content;
    this.reply_to_sender = data.reply_to_sender;
  }

  // 发送群聊消息
  static async send(data) {
    const [message] = await db('group_messages')
      .insert({
        group_id: data.group_id,
        sender_id: data.sender_id,
        content: data.content,
        message_type: data.message_type || 'text',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        reply_to_id: data.reply_to_id
      })
      .returning('*');

    return this.findById(message.id);
  }

  // 根据ID获取消息
  static async findById(id) {
    const message = await db('group_messages')
      .select(
        'group_messages.*',
        'sender.username as sender_username',
        'sender.display_name as sender_display_name',
        'sender.avatar_url as sender_avatar_url',
        'reply_to.content as reply_to_content',
        'reply_sender.username as reply_to_sender'
      )
      .join('users as sender', 'group_messages.sender_id', 'sender.id')
      .leftJoin('group_messages as reply_to', 'group_messages.reply_to_id', 'reply_to.id')
      .leftJoin('users as reply_sender', 'reply_to.sender_id', 'reply_sender.id')
      .where('group_messages.id', id)
      .where('group_messages.is_deleted', false)
      .first();

    if (!message) return null;

    // 解析metadata
    if (message.metadata) {
      try {
        message.metadata = JSON.parse(message.metadata);
      } catch (error) {
        console.error('解析消息metadata失败:', error);
        message.metadata = null;
      }
    }

    return new GroupMessage(message);
  }

  // 获取群聊消息列表
  static async getGroupMessages(groupId, limit = 50, offset = 0, beforeId = null) {
    let query = db('group_messages')
      .select(
        'group_messages.*',
        'sender.username as sender_username',
        'sender.display_name as sender_display_name',
        'sender.avatar_url as sender_avatar_url',
        'reply_to.content as reply_to_content',
        'reply_sender.username as reply_to_sender'
      )
      .join('users as sender', 'group_messages.sender_id', 'sender.id')
      .leftJoin('group_messages as reply_to', 'group_messages.reply_to_id', 'reply_to.id')
      .leftJoin('users as reply_sender', 'reply_to.sender_id', 'reply_sender.id')
      .where('group_messages.group_id', groupId)
      .where('group_messages.is_deleted', false);

    if (beforeId) {
      query = query.where('group_messages.id', '<', beforeId);
    }

    const messages = await query
      .orderBy('group_messages.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return messages.map(messageData => {
      // 解析metadata
      if (messageData.metadata) {
        try {
          messageData.metadata = JSON.parse(messageData.metadata);
        } catch (error) {
          console.error('解析消息metadata失败:', error);
          messageData.metadata = null;
        }
      }
      return new GroupMessage(messageData);
    });
  }

  // 编辑消息
  async editContent(newContent, userId) {
    if (this.sender_id !== userId) {
      throw new Error('只能编辑自己发送的消息');
    }

    if (this.edit_count >= 5) {
      throw new Error('消息编辑次数已达上限（5次）');
    }

    // 记录编辑历史
    await db('group_message_edit_history').insert({
      message_id: this.id,
      old_content: this.content,
      new_content: newContent,
      edited_by: userId
    });

    // 更新消息
    await db('group_messages')
      .where('id', this.id)
      .update({
        content: newContent,
        is_edited: true,
        edit_count: db.raw('edit_count + 1'),
        updated_at: db.fn.now()
      });

    this.content = newContent;
    this.is_edited = true;
    this.edit_count += 1;

    return this;
  }

  // 置顶/取消置顶消息
  async togglePin(userId) {
    // 检查用户权限（群主或管理员）
    const member = await db('group_members')
      .where('group_id', this.group_id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!member || (member.role !== 'creator' && member.role !== 'admin')) {
      throw new Error('只有群主或管理员可以置顶消息');
    }

    const newPinStatus = !this.is_pinned;

    // 如果要置顶，检查是否已有置顶消息
    if (newPinStatus) {
      const pinnedCount = await db('group_messages')
        .where('group_id', this.group_id)
        .where('is_pinned', true)
        .where('is_deleted', false)
        .count('* as count')
        .first();

      if (parseInt(pinnedCount.count) >= 3) {
        throw new Error('群聊最多只能置顶3条消息');
      }
    }

    await db('group_messages')
      .where('id', this.id)
      .update({
        is_pinned: newPinStatus,
        updated_at: db.fn.now()
      });

    this.is_pinned = newPinStatus;
    return this;
  }

  // 删除消息（软删除）
  async delete(userId) {
    // 检查权限：发送者、群主或管理员可以删除
    const member = await db('group_members')
      .where('group_id', this.group_id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    const canDelete = this.sender_id === userId ||
                     (member && (member.role === 'creator' || member.role === 'admin'));

    if (!canDelete) {
      throw new Error('无权限删除此消息');
    }

    await db('group_messages')
      .where('id', this.id)
      .update({
        is_deleted: true,
        updated_at: db.fn.now()
      });

    this.is_deleted = true;
    return this;
  }

  // 获取消息编辑历史
  async getEditHistory() {
    const history = await db('group_message_edit_history')
      .select(
        'group_message_edit_history.*',
        'users.username as editor_username',
        'users.display_name as editor_display_name'
      )
      .join('users', 'group_message_edit_history.edited_by', 'users.id')
      .where('message_id', this.id)
      .orderBy('created_at', 'desc');

    return history;
  }

  // 获取群聊置顶消息
  static async getPinnedMessages(groupId) {
    const messages = await db('group_messages')
      .select(
        'group_messages.*',
        'sender.username as sender_username',
        'sender.display_name as sender_display_name',
        'sender.avatar_url as sender_avatar_url'
      )
      .join('users as sender', 'group_messages.sender_id', 'sender.id')
      .where('group_messages.group_id', groupId)
      .where('group_messages.is_pinned', true)
      .where('group_messages.is_deleted', false)
      .orderBy('group_messages.updated_at', 'desc');

    return messages.map(messageData => {
      if (messageData.metadata) {
        try {
          messageData.metadata = JSON.parse(messageData.metadata);
        } catch (error) {
          messageData.metadata = null;
        }
      }
      return new GroupMessage(messageData);
    });
  }

  // 搜索群聊消息
  static async searchMessages(groupId, query, limit = 20, offset = 0) {
    const messages = await db('group_messages')
      .select(
        'group_messages.*',
        'sender.username as sender_username',
        'sender.display_name as sender_display_name',
        'sender.avatar_url as sender_avatar_url'
      )
      .join('users as sender', 'group_messages.sender_id', 'sender.id')
      .where('group_messages.group_id', groupId)
      .where('group_messages.is_deleted', false)
      .where('group_messages.content', 'ilike', `%${query}%`)
      .orderBy('group_messages.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return messages.map(messageData => {
      if (messageData.metadata) {
        try {
          messageData.metadata = JSON.parse(messageData.metadata);
        } catch (error) {
          messageData.metadata = null;
        }
      }
      return new GroupMessage(messageData);
    });
  }

  // 获取消息统计
  static async getMessageStats(groupId, days = 7) {
    const stats = await db('group_messages')
      .select(
        db.raw('COUNT(*) as total_messages'),
        db.raw('COUNT(DISTINCT sender_id) as active_senders'),
        db.raw("COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_count"),
        db.raw("COUNT(CASE WHEN message_type = 'file' THEN 1 END) as file_count"),
        db.raw('COUNT(CASE WHEN is_pinned = true THEN 1 END) as pinned_count')
      )
      .where('group_id', groupId)
      .where('is_deleted', false)
      .where('created_at', '>=', db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .first();

    return {
      total_messages: parseInt(stats.total_messages),
      active_senders: parseInt(stats.active_senders),
      image_count: parseInt(stats.image_count),
      file_count: parseInt(stats.file_count),
      pinned_count: parseInt(stats.pinned_count)
    };
  }

  // 创建系统消息
  static async createSystemMessage(groupId, content, metadata = null) {
    const [message] = await db('group_messages')
      .insert({
        group_id: groupId,
        sender_id: null, // 系统消息没有发送者
        content: content,
        message_type: 'system',
        metadata: metadata ? JSON.stringify(metadata) : null
      })
      .returning('*');

    return new GroupMessage(message);
  }
}

module.exports = GroupMessage;