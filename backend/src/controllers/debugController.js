const { db } = require('../config/database');

class DebugController {
  // 测试数据库表结构
  static async testDatabaseTables(req, res) {
    try {
      const tables = {};

      // 检查conversations表
      try {
        const conversationsSchema = await db('information_schema.columns')
          .select('column_name', 'data_type', 'is_nullable')
          .where('table_name', 'conversations')
          .orderBy('ordinal_position');
        tables.conversations = conversationsSchema;
      } catch (error) {
        tables.conversations = { error: error.message };
      }

      // 检查conversation_members表
      try {
        const membersSchema = await db('information_schema.columns')
          .select('column_name', 'data_type', 'is_nullable')
          .where('table_name', 'conversation_members')
          .orderBy('ordinal_position');
        tables.conversation_members = membersSchema;
      } catch (error) {
        tables.conversation_members = { error: error.message };
      }

      // 检查chat_messages表
      try {
        const messagesSchema = await db('information_schema.columns')
          .select('column_name', 'data_type', 'is_nullable')
          .where('table_name', 'chat_messages')
          .orderBy('ordinal_position');
        tables.chat_messages = messagesSchema;
      } catch (error) {
        tables.chat_messages = { error: error.message };
      }

      // 检查users表
      try {
        const usersSchema = await db('information_schema.columns')
          .select('column_name', 'data_type', 'is_nullable')
          .where('table_name', 'users')
          .orderBy('ordinal_position');
        tables.users = usersSchema;
      } catch (error) {
        tables.users = { error: error.message };
      }

      res.json({
        success: true,
        tables,
        message: '数据库表结构检查完成'
      });
    } catch (error) {
      console.error('数据库表检查失败:', error);
      res.status(500).json({
        success: false,
        message: '数据库表检查失败',
        error: error.message
      });
    }
  }

  // 测试conversation查询
  static async testConversationQuery(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未认证'
        });
      }

      console.log('测试会话查询:', { conversationId, userId, userIdType: typeof userId });

      // 查询conversation
      const conversation = await db('conversations').where('id', conversationId).first();
      console.log('Conversation查询结果:', conversation);

      // 查询conversation_members
      const member = await db('conversation_members')
        .where({
          conversation_id: conversationId,
          user_id: userId
        })
        .first();
      console.log('Member查询结果:', member);

      // 查询最新消息
      const latestMessage = await db('chat_messages')
        .where('conversation_id', conversationId)
        .orderBy('created_at', 'desc')
        .first();
      console.log('最新消息查询结果:', latestMessage);

      res.json({
        success: true,
        debug: {
          conversationId,
          userId,
          userIdType: typeof userId,
          conversation,
          member,
          latestMessage
        }
      });
    } catch (error) {
      console.error('测试conversation查询失败:', error);
      res.status(500).json({
        success: false,
        message: '测试conversation查询失败',
        error: error.message,
        stack: error.stack
      });
    }
  }
}

module.exports = DebugController;