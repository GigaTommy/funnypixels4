const { db } = require('../config/database');

class PrivacySettings {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.dm_receive_from = data.dm_receive_from || 'anyone'; // 'anyone', 'followers', 'verified'
    this.allow_message_requests = data.allow_message_requests || true;
    this.filter_low_quality = data.filter_low_quality || true;
    this.read_receipts_enabled = data.read_receipts_enabled || true;
    this.hide_nickname = data.hide_nickname || false; // 隐藏昵称
    this.hide_alliance = data.hide_alliance || false; // 隐藏联盟
    this.hide_alliance_flag = data.hide_alliance_flag || false; // 隐藏联盟旗帜
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 获取用户的隐私设置
  static async getUserSettings(userId) {
    const settings = await db('privacy_settings')
      .where('user_id', userId)
      .first();

    if (settings) {
      return new PrivacySettings(settings);
    } else {
      // 创建默认设置
      return await this.createDefaultSettings(userId);
    }
  }

  // 创建默认隐私设置
  static async createDefaultSettings(userId) {
    const [settings] = await db('privacy_settings')
      .insert({
        user_id: userId,
        dm_receive_from: 'anyone',
        allow_message_requests: true,
        filter_low_quality: true,
        read_receipts_enabled: true,
        hide_nickname: false,
        hide_alliance: false,
        hide_alliance_flag: false
      })
      .returning('*');

    return new PrivacySettings(settings);
  }

  // 更新隐私设置
  static async updateSettings(userId, updateData) {
    // 验证dm_receive_from的值
    const validReceiveOptions = ['anyone', 'followers', 'verified'];
    if (updateData.dm_receive_from && !validReceiveOptions.includes(updateData.dm_receive_from)) {
      throw new Error('无效的消息接收设置');
    }

    const existing = await db('privacy_settings')
      .where('user_id', userId)
      .first();

    if (existing) {
      // 更新现有设置
      const [updated] = await db('privacy_settings')
        .where('user_id', userId)
        .update({
          ...updateData,
          updated_at: db.fn.now()
        })
        .returning('*');

      return new PrivacySettings(updated);
    } else {
      // 创建新设置
      const [settings] = await db('privacy_settings')
        .insert({
          user_id: userId,
          ...updateData
        })
        .returning('*');

      return new PrivacySettings(settings);
    }
  }

  // 检查用户是否可以给另一个用户发私信
  static async canSendMessage(senderId, receiverId) {
    // 获取接收者的隐私设置
    const receiverSettings = await this.getUserSettings(receiverId);

    // 如果允许任何人发消息
    if (receiverSettings.dm_receive_from === 'anyone') {
      return {
        canSend: true,
        requiresRequest: !receiverSettings.allow_message_requests ? false : false,
        reason: null
      };
    }

    // 检查关注关系
    const followRelation = await db('user_follows')
      .where('follower_id', receiverId)
      .where('following_id', senderId)
      .where('is_active', true)
      .first();

    // 如果设置为只允许关注者
    if (receiverSettings.dm_receive_from === 'followers') {
      if (followRelation) {
        return { canSend: true, requiresRequest: false, reason: null };
      } else {
        return {
          canSend: false,
          requiresRequest: receiverSettings.allow_message_requests,
          reason: '该用户只接收关注者的私信'
        };
      }
    }

    // 如果设置为只允许认证用户
    if (receiverSettings.dm_receive_from === 'verified') {
      const sender = await db('users')
        .where('id', senderId)
        .select('is_verified')
        .first();

      if (sender && sender.is_verified) {
        return { canSend: true, requiresRequest: false, reason: null };
      } else {
        return {
          canSend: false,
          requiresRequest: receiverSettings.allow_message_requests,
          reason: '该用户只接收认证用户的私信'
        };
      }
    }

    return { canSend: false, requiresRequest: false, reason: '未知错误' };
  }

  // 获取隐私设置选项
  static getPrivacyOptions() {
    return {
      dm_receive_from: [
        { value: 'anyone', label: '任何人', description: '任何用户都可以给你发私信' },
        { value: 'followers', label: '你关注的人', description: '只有你关注的用户可以给你发私信' },
        { value: 'verified', label: '认证用户', description: '只有认证用户可以给你发私信' }
      ],
      message_requests: [
        { value: true, label: '允许消息请求', description: '不符合条件的消息会进入请求文件夹' },
        { value: false, label: '拒绝消息请求', description: '直接拒绝不符合条件的消息' }
      ],
      quality_filter: [
        { value: true, label: '过滤低质量消息', description: '自动过滤可能的垃圾消息' },
        { value: false, label: '接收所有消息', description: '不过滤任何消息内容' }
      ],
      read_receipts: [
        { value: true, label: '发送已读回执', description: '让对方知道你已读了消息' },
        { value: false, label: '不发送已读回执', description: '保持消息已读状态私密' }
      ],
      pixel_privacy: [
        {
          key: 'hide_nickname',
          label: '隐藏昵称',
          description: '绘制像素时不显示您的昵称'
        },
        {
          key: 'hide_alliance',
          label: '隐藏联盟信息',
          description: '绘制像素时不显示您的联盟信息'
        },
        {
          key: 'hide_alliance_flag',
          label: '隐藏联盟旗帜',
          description: '绘制像素时不显示您的联盟旗帜'
        }
      ]
    };
  }
}

module.exports = PrivacySettings;