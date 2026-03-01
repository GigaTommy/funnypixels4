const { db } = require('../config/database');

class SystemMessage {
    constructor(data) {
        this.id = data.id;
        this.sender_id = data.sender_id;
        this.receiver_id = data.receiver_id;
        this.title = data.title;
        this.content = data.content;
        this.attachments = data.attachments;
        this.type = data.type;
        this.is_read = data.is_read;
        this.read_at = data.read_at;
        this.expires_at = data.expires_at;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // 发送系统邮件
    static async create(messageData) {
        try {
            const [message] = await db('system_messages')
                .insert({
                    ...messageData,
                    attachments: messageData.attachments ? JSON.stringify(messageData.attachments) : null
                })
                .returning('*');

            return new SystemMessage(message);
        } catch (error) {
            throw error;
        }
    }

    // 获取收件箱列表 (分页)
    static async getInbox(userId, limit = 20, offset = 0) {
        try {
            const messages = await db('system_messages')
                .where(function () {
                    this.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .andWhere(function () {
                    this.whereNull('expires_at').orWhere('expires_at', '>', db.fn.now());
                })
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset(offset);

            return messages.map(msg => new SystemMessage(msg));
        } catch (error) {
            throw error;
        }
    }

    // 获取已发送列表 (管理员用)
    static async getSentMessages(limit = 20, offset = 0) {
        try {
            const messages = await db('system_messages')
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset(offset);

            return messages.map(msg => new SystemMessage(msg));
        } catch (error) {
            throw error;
        }
    }

    // 标记已读
    static async markAsRead(id, userId) {
        try {
            await db('system_messages')
                .where('id', id)
                .where(function () {
                    this.where('receiver_id', userId).orWhereNull('receiver_id');
                })
                .update({
                    is_read: true,
                    read_at: db.fn.now()
                });
            return true;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = SystemMessage;
