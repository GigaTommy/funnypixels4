const { db } = require('../config/database');

class MessageRequest {
  constructor(data) {
    this.id = data.id;
    this.sender_id = data.sender_id;
    this.receiver_id = data.receiver_id;
    this.first_message_content = data.first_message_content;
    this.status = data.status; // 'pending', 'accepted', 'declined'
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;

    // 关联数据
    this.sender_username = data.sender_username;
    this.sender_avatar = data.sender_avatar;
    this.sender_verified = data.sender_verified;
  }

  // 创建消息请求
  static async create(senderId, receiverId, messageContent) {
    // 检查是否已存在请求
    const existing = await db('message_requests')
      .where('sender_id', senderId)
      .where('receiver_id', receiverId)
      .where('status', 'pending')
      .first();

    if (existing) {
      throw new Error('已存在未处理的消息请求');
    }

    const [request] = await db('message_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        first_message_content: messageContent,
        status: 'pending'
      })
      .returning('*');

    return new MessageRequest(request);
  }

  // 获取用户的消息请求列表
  static async getRequestsForUser(userId, limit = 20, offset = 0) {
    const requests = await db('message_requests as mr')
      .leftJoin('users as sender', 'mr.sender_id', 'sender.id')
      .where('mr.receiver_id', userId)
      .where('mr.status', 'pending')
      .select(
        'mr.*',
        'sender.username as sender_username',
        'sender.avatar_url as sender_avatar',
        'sender.is_verified as sender_verified'
      )
      .orderBy('mr.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return requests.map(request => new MessageRequest(request));
  }

  // 处理消息请求
  static async handleRequest(requestId, userId, action) {
    const validActions = ['accept', 'decline'];
    if (!validActions.includes(action)) {
      throw new Error('无效的操作');
    }

    const request = await db('message_requests')
      .where('id', requestId)
      .where('receiver_id', userId)
      .where('status', 'pending')
      .first();

    if (!request) {
      throw new Error('请求不存在或已处理');
    }

    const status = action === 'accept' ? 'accepted' : 'declined';

    const [updated] = await db('message_requests')
      .where('id', requestId)
      .update({
        status,
        updated_at: db.fn.now()
      })
      .returning('*');

    // 如果接受请求，创建实际的私信对话
    if (action === 'accept') {
      const PrivateMessage = require('./PrivateMessage');
      await PrivateMessage.create({
        sender_id: request.sender_id,
        receiver_id: request.receiver_id,
        content: request.first_message_content,
        message_type: 'text'
      });
    }

    return new MessageRequest(updated);
  }

  // 获取未读请求数量
  static async getUnreadRequestCount(userId) {
    const result = await db('message_requests')
      .where('receiver_id', userId)
      .where('status', 'pending')
      .count('* as count')
      .first();

    return parseInt(result.count);
  }

  // 检查两个用户之间是否存在消息请求
  static async getRequestBetweenUsers(senderId, receiverId) {
    const request = await db('message_requests')
      .where('sender_id', senderId)
      .where('receiver_id', receiverId)
      .where('status', 'pending')
      .first();

    return request ? new MessageRequest(request) : null;
  }

  // 删除请求
  async delete() {
    const deleted = await db('message_requests')
      .where('id', this.id)
      .del();

    return deleted > 0;
  }
}

module.exports = MessageRequest;