const { db } = require('../config/database');

class PrivateMessage {
  constructor(data) {
    this.id = data.id;
    this.sender_id = data.sender_id;
    this.receiver_id = data.receiver_id;
    this.content = data.content;
    this.message_type = data.message_type || 'text';
    this.is_read = data.is_read || false;
    this.read_at = data.read_at;
    this.is_deleted_by_sender = data.is_deleted_by_sender || false;
    this.is_deleted_by_receiver = data.is_deleted_by_receiver || false;
    this.reply_to_message_id = data.reply_to_message_id;
    this.edit_count = data.edit_count || 0;
    this.is_edited = data.is_edited || false;
    this.edit_history = data.edit_history ? JSON.parse(data.edit_history) : [];
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    
    // 关联数据
    this.sender_username = data.sender_username;
    this.sender_avatar = data.sender_avatar;
    this.receiver_username = data.receiver_username;
    this.receiver_avatar = data.receiver_avatar;
    this.reply_to_content = data.reply_to_content;
  }

  // 创建私信
  static async create(messageData) {
    const [message] = await db('private_messages')
      .insert(messageData)
      .returning('*');
    
    return new PrivateMessage(message);
  }

  // 根据ID查找私信
  static async findById(id) {
    const message = await db('private_messages as pm')
      .leftJoin('users as sender', 'pm.sender_id', 'sender.id')
      .leftJoin('users as receiver', 'pm.receiver_id', 'receiver.id')
      .leftJoin('private_messages as reply', 'pm.reply_to_message_id', 'reply.id')
      .where('pm.id', id)
      .select(
        'pm.*',
        'sender.username as sender_username',
        'sender.avatar_url as sender_avatar',
        'receiver.username as receiver_username',
        'receiver.avatar_url as receiver_avatar',
        'reply.content as reply_to_content'
      )
      .first();
    
    return message ? new PrivateMessage(message) : null;
  }

  // 获取用户之间的对话
  static async getConversation(userId1, userId2, limit = 50, offset = 0) {
    const messages = await db('private_messages as pm')
      .leftJoin('users as sender', 'pm.sender_id', 'sender.id')
      .leftJoin('users as receiver', 'pm.receiver_id', 'receiver.id')
      .leftJoin('private_messages as reply', 'pm.reply_to_message_id', 'reply.id')
      .where(function() {
        this.where(function() {
          this.where('pm.sender_id', userId1)
            .andWhere('pm.receiver_id', userId2)
            .andWhere('pm.is_deleted_by_sender', false);
        }).orWhere(function() {
          this.where('pm.sender_id', userId2)
            .andWhere('pm.receiver_id', userId1)
            .andWhere('pm.is_deleted_by_receiver', false);
        });
      })
      .select(
        'pm.*',
        'sender.username as sender_username',
        'sender.avatar_url as sender_avatar',
        'receiver.username as receiver_username',
        'receiver.avatar_url as receiver_avatar',
        'reply.content as reply_to_content'
      )
      .orderBy('pm.created_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    return messages.map(message => new PrivateMessage(message));
  }

  // 获取用户的对话列表
  static async getConversationList(userId, limit = 20, offset = 0) {
    // 使用更简单的方法：获取所有消息，然后在JavaScript中处理
    const allMessages = await db('private_messages as pm')
      .leftJoin('users as sender', 'pm.sender_id', 'sender.id')
      .leftJoin('users as receiver', 'pm.receiver_id', 'receiver.id')
      .where(function() {
        this.where('pm.sender_id', userId).orWhere('pm.receiver_id', userId);
      })
      .where(function() {
        this.where(function() {
          this.where('pm.sender_id', userId).andWhere('pm.is_deleted_by_sender', false);
        }).orWhere(function() {
          this.where('pm.receiver_id', userId).andWhere('pm.is_deleted_by_receiver', false);
        });
      })
      .select(
        'pm.*',
        'sender.username as sender_username',
        'sender.avatar_url as sender_avatar',
        'receiver.username as receiver_username',
        'receiver.avatar_url as receiver_avatar'
      )
      .orderBy('pm.created_at', 'desc');

    // 按对话分组，保留每个对话的最新消息
    const conversationMap = new Map();
    
    for (const messageData of allMessages) {
      const message = new PrivateMessage(messageData);
      const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      
      if (!conversationMap.has(otherUserId)) {
        message.other_user_id = otherUserId;
        message.other_user_name = message.sender_id === userId ? message.receiver_username : message.sender_username;
        message.other_user_avatar = message.sender_id === userId ? message.receiver_avatar : message.sender_avatar;
        conversationMap.set(otherUserId, message);
      }
    }

    // 转换为数组并按时间排序
    const conversations = Array.from(conversationMap.values());
    conversations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 应用分页
    return conversations.slice(offset, offset + limit);
  }

  // 获取未读消息数量
  static async getUnreadCount(userId) {
    const result = await db('private_messages')
      .where('receiver_id', userId)
      .where('is_read', false)
      .where('is_deleted_by_receiver', false)
      .count('* as count')
      .first();
    
    return parseInt(result.count);
  }

  // 获取与特定用户的未读消息数量
  static async getUnreadCountWithUser(userId, otherUserId) {
    const result = await db('private_messages')
      .where('receiver_id', userId)
      .where('sender_id', otherUserId)
      .where('is_read', false)
      .where('is_deleted_by_receiver', false)
      .count('* as count')
      .first();
    
    return parseInt(result.count);
  }

  // 标记消息为已读
  static async markAsRead(messageId, userId) {
    const updated = await db('private_messages')
      .where('id', messageId)
      .where('receiver_id', userId)
      .where('is_read', false)
      .update({
        is_read: true,
        read_at: db.fn.now(),
        updated_at: db.fn.now()
      });
    
    return updated > 0;
  }

  // 标记与特定用户的所有消息为已读
  static async markConversationAsRead(userId, otherUserId) {
    const updated = await db('private_messages')
      .where('receiver_id', userId)
      .where('sender_id', otherUserId)
      .where('is_read', false)
      .update({
        is_read: true,
        read_at: db.fn.now(),
        updated_at: db.fn.now()
      });
    
    return updated;
  }

  // 删除消息（软删除）
  async delete(userId) {
    const updateData = {};
    
    if (this.sender_id === userId) {
      updateData.is_deleted_by_sender = true;
    }
    
    if (this.receiver_id === userId) {
      updateData.is_deleted_by_receiver = true;
    }
    
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = db.fn.now();
      
      await db('private_messages')
        .where('id', this.id)
        .update(updateData);
      
      // 如果双方都删除了，则物理删除
      if (updateData.is_deleted_by_sender && updateData.is_deleted_by_receiver) {
        await db('private_messages')
          .where('id', this.id)
          .del();
      }
      
      return true;
    }
    
    return false;
  }

  // 编辑消息内容
  async editContent(newContent, userId) {
    // 验证编辑权限
    if (this.sender_id !== userId) {
      throw new Error('只能编辑自己发送的消息');
    }

    // 检查编辑次数限制
    if (this.edit_count >= 5) {
      throw new Error('消息编辑次数已达上限（5次）');
    }

    // 记录编辑历史
    const editHistory = this.edit_history || [];
    editHistory.push({
      content: this.content,
      edited_at: new Date().toISOString(),
      edit_count: this.edit_count
    });

    const updateData = {
      content: newContent.trim(),
      edit_count: this.edit_count + 1,
      is_edited: true,
      edit_history: JSON.stringify(editHistory),
      updated_at: db.fn.now()
    };

    const [updated] = await db('private_messages')
      .where('id', this.id)
      .update(updateData)
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
      this.edit_history = editHistory;
      return this;
    }

    return null;
  }

  // 更新消息
  async update(updateData) {
    updateData.updated_at = db.fn.now();

    const [updated] = await db('private_messages')
      .where('id', this.id)
      .update(updateData)
      .returning('*');

    if (updated) {
      Object.assign(this, updated);
      return this;
    }

    return null;
  }
}

module.exports = PrivateMessage;
