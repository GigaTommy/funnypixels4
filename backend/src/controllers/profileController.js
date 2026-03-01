const User = require('../models/User');
const { db } = require('../config/database');
const UserPixelState = require('../models/UserPixelState');
const { invalidateUserCache } = require('../middleware/auth');
const AuthController = require('./authController');
const RankTierService = require('../services/rankTierService');

class ProfileController {
  // 获取用户详细信息
  static async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      const user = await User.findById(userId);
      if (!user || user.is_deleted) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 并行获取所有附加数据（原先为 8 个串行查询，现在并行执行）
      // ✨ 优化：关注数/粉丝数使用缓存列，无需COUNT查询
      const [
        allianceResult,
        isFollowing,
        isLiked,
        likesCount,
        userPoints,
        pixelState
      ] = await Promise.all([
        // 1. 联盟信息
        db('alliance_members as am')
          .join('alliances as a', 'am.alliance_id', 'a.id')
          .where('am.user_id', userId)
          .select('a.id', 'a.name', 'a.description', 'a.flag_unicode_char as flag', 'a.color', 'a.flag_pattern_id', 'am.role', 'am.joined_at')
          .first()
          .catch(() => null),
        // 2. 关注状态
        db('user_follows')
          .where('follower_id', currentUserId)
          .where('following_id', userId)
          .first()
          .catch(() => null),
        // 3. 点赞状态
        db('user_likes')
          .where('user_id', currentUserId)
          .where('target_type', 'user')
          .where('target_id', userId)
          .first()
          .catch(() => null),
        // 4. 点赞数
        db('user_likes').where('target_type', 'user').where('target_id', userId).count('* as count').first(),
        // 5. 用户积分
        User.getUserPoints(user.id).catch(() => 0),
        // 6. 像素状态
        UserPixelState.refreshState(userId).catch(() => null)
      ]);

      // 处理联盟数据
      const alliance = allianceResult ? {
        id: allianceResult.id,
        name: allianceResult.name,
        description: allianceResult.description,
        flag: allianceResult.flag,
        flag_pattern_id: allianceResult.flag_pattern_id,
        color: allianceResult.color,
        role: allianceResult.role,
        joined_at: allianceResult.joined_at
      } : null;

      // 处理头像数据
      const profileSettings = user.profile_settings || {};
      let avatarUrl = ProfileController.sanitizeAvatarUrl(user.avatar_url);
      let avatarData = user.avatar;

      if (avatarData && (avatarData.startsWith('http://') || avatarData.startsWith('https://') || avatarData.startsWith('/'))) {
        avatarUrl = ProfileController.sanitizeAvatarUrl(avatarData);
        avatarData = null;
      }

      const currentPixels = pixelState ? pixelState.pixel_points : (user.current_pixels || 0);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar_url: avatarUrl,
          avatar: avatarData,
          motto: user.motto,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: currentPixels,
          region: user.region,
          created_at: user.created_at,
          last_activity: user.last_activity,
          alliance: alliance,
          is_following: !!isFollowing,
          is_liked: !!isLiked,
          followers_count: parseInt(user.followers_count || 0),  // ✨ 使用缓存列
          following_count: parseInt(user.following_count || 0),  // ✨ 使用缓存列
          likes_count: parseInt(likesCount?.count || 0),
          profile_settings: profileSettings,
          rankTier: RankTierService.getTierForPixels(user.total_pixels)
        }
      });


    } catch (error) {
      console.error('获取用户资料失败:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 更新用户资料
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { username, display_name, motto, avatar_url, avatar, privacy_settings, device_token } = req.body;

      console.log('收到更新请求:', { userId, username, display_name, motto, hasAvatar: !!avatar });

      // 获取当前用户信息
      const currentUser = await User.findById(userId);
      console.log('当前用户信息:', currentUser);

      // 简单的更新逻辑
      const updateData = {};

      if (username) {
        if (username.length < 3 || username.length > 20) {
          return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
        }
        updateData.username = username;
      }

      if (display_name !== undefined) {
        if (display_name && (display_name.length < 2 || display_name.length > 20)) {
          return res.status(400).json({ error: '昵称长度必须在2-20个字符之间' });
        }
        updateData.display_name = display_name;
      }

      if (motto !== undefined) {
        if (motto && motto.length > 200) {
          return res.status(400).json({ error: '格言长度不能超过200个字符' });
        }
        updateData.motto = motto;
      }

      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

      if (avatar !== undefined) {
        updateData.avatar = avatar;
        console.log('更新头像数据，长度:', avatar?.length || 0);

        // 如果有新的头像数据，自动生成CDN头像
        if (avatar && avatar.length > 0) {
          try {
            console.log('🎨 自动为新头像生成CDN文件...');
            const AvatarService = require('../services/avatarService');
            const avatarService = new AvatarService();

            // 生成medium尺寸的头像URL
            const avatarUrl = await avatarService.getAvatarUrl(avatar, 'medium', userId);

            if (avatarUrl) {
              updateData.avatar_url = avatarUrl;
              console.log('✅ CDN头像URL已生成:', avatarUrl);

              // ⚠️ 不再预先写入 pattern_assets，改为动态查询
              // 原因：避免每次头像更新都写数据库，减少表膨胀和缓存失效
              // user_avatar_ patterns 会在渲染时动态从 users.avatar_url 获取
            }
          } catch (error) {
            console.error('⚠️ CDN头像生成失败，仍保存原始数据:', error);
            // 即使CDN生成失败，也继续保存原始avatar数据
          }
        } else if (avatar === null || avatar === '') {
          // 如果清空头像，也清空avatar_url
          updateData.avatar_url = null;
          // ⚠️ 不需要删除 pattern_assets（因为不再预存）
        }
      }

      if (privacy_settings) {
        updateData.profile_settings = privacy_settings;
      }

      if (device_token !== undefined) {
        updateData.device_token = device_token;
        console.log('更新设备Token');
      }

      console.log('准备更新的数据:', updateData);

      if (Object.keys(updateData).length > 0) {
        await db('users')
          .where({ id: userId })
          .update({
            ...updateData,
            updated_at: db.fn.now()
          });
        console.log('数据库更新完成');

        // 清除用户缓存，确保后续请求获取最新数据
        invalidateUserCache(userId);
        AuthController.clearUserCache(userId);
      }

      // 获取更新后的用户信息
      const updatedUser = await User.findById(userId);
      console.log('获取更新后的用户信息完成');

      // 处理profile_settings (jsonb字段会自动处理)
      const profileSettings = updatedUser.profile_settings || {};

      res.json({
        success: true,
        message: '资料更新成功',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          display_name: updatedUser.display_name,
          motto: updatedUser.motto,
          avatar_url: updatedUser.avatar_url,
          avatar: updatedUser.avatar,
          profile_settings: profileSettings
        }
      });

    } catch (error) {
      console.error('更新用户资料失败:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取昵称修改历史
  static async getNicknameHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const history = await db('nickname_history')
        .where('user_id', userId)
        .orderBy('changed_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select('*');

      const total = await db('nickname_history')
        .where('user_id', userId)
        .count('* as count')
        .first();

      res.json({
        success: true,
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total.count),
          pages: Math.ceil(total.count / limit)
        }
      });

    } catch (error) {
      console.error('获取昵称历史失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 检查昵称修改限制
  static async checkNicknameChangeLimit(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      const now = new Date();
      const lastChange = user.last_nickname_change ? new Date(user.last_nickname_change) : null;
      const daysSinceLastChange = lastChange ? Math.floor((now - lastChange) / (1000 * 60 * 60 * 24)) : 30;

      // 检查是否可以修改昵称（30天内只能修改一次）
      const canChange = !lastChange || daysSinceLastChange >= 30;

      res.json({
        success: true,
        canChange,
        daysSinceLastChange: Math.max(0, 30 - daysSinceLastChange),
        changeCount: user.nickname_change_count || 0,
        lastChange: user.last_nickname_change
      });

    } catch (error) {
      console.error('检查昵称修改限制失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 关注用户
  static async followUser(req, res) {
    try {
      const followerId = req.user.id;
      const { followingId } = req.params;

      if (followerId === followingId) {
        return res.status(400).json({ error: '不能关注自己' });
      }

      // 检查目标用户是否存在
      const targetUser = await User.findById(followingId);
      if (!targetUser || targetUser.is_deleted) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 检查是否已经关注
      const existingFollow = await db('user_follows')
        .where('follower_id', followerId)
        .where('following_id', followingId)
        .first();

      if (existingFollow) {
        return res.status(400).json({ error: '已经关注该用户' });
      }

      // 创建关注关系
      await db('user_follows').insert({
        follower_id: followerId,
        following_id: followingId
      });

      res.json({
        success: true,
        message: '关注成功'
      });

    } catch (error) {
      console.error('关注用户失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 取消关注用户
  static async unfollowUser(req, res) {
    try {
      const followerId = req.user.id;
      const { followingId } = req.params;

      // 删除关注关系
      const deletedCount = await db('user_follows')
        .where('follower_id', followerId)
        .where('following_id', followingId)
        .del();

      if (deletedCount === 0) {
        return res.status(400).json({ error: '未关注该用户' });
      }

      res.json({
        success: true,
        message: '取消关注成功'
      });

    } catch (error) {
      console.error('取消关注失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 点赞用户
  static async likeUser(req, res) {
    try {
      const userId = req.user.id;
      const { targetUserId } = req.params;

      if (userId === targetUserId) {
        return res.status(400).json({ error: '不能给自己点赞' });
      }

      // 检查目标用户是否存在
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.is_deleted) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 检查是否已经点赞
      const existingLike = await db('user_likes')
        .where('user_id', userId)
        .where('target_type', 'user')
        .where('target_id', targetUserId)
        .first();

      if (existingLike) {
        return res.status(400).json({ error: '已经点赞该用户' });
      }

      // 创建点赞记录
      await db('user_likes').insert({
        user_id: userId,
        target_type: 'user',
        target_id: targetUserId
      });

      res.json({
        success: true,
        message: '点赞成功'
      });

    } catch (error) {
      console.error('点赞用户失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 取消点赞用户
  static async unlikeUser(req, res) {
    try {
      const userId = req.user.id;
      const { targetUserId } = req.params;

      // 删除点赞记录
      const deletedCount = await db('user_likes')
        .where('user_id', userId)
        .where('target_type', 'user')
        .where('target_id', targetUserId)
        .del();

      if (deletedCount === 0) {
        return res.status(400).json({ error: '未点赞该用户' });
      }

      res.json({
        success: true,
        message: '取消点赞成功'
      });

    } catch (error) {
      console.error('取消点赞失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 删除账号（伪删除）
  static async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: '请输入密码确认删除' });
      }

      // 验证密码
      const user = await User.findByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }
      const isValidPassword = await User.verifyPassword(user, password);
      if (!isValidPassword) {
        return res.status(401).json({ error: '密码错误' });
      }

      // 获取用户统计信息
      const userStats = await db('users')
        .where('id', userId)
        .select('total_pixels', 'current_pixels', 'created_at')
        .first();

      // 伪删除用户
      await db('users')
        .where('id', userId)
        .update({
          is_deleted: true,
          is_active: false,
          updated_at: db.fn.now()
        });

      res.json({
        success: true,
        message: '账号删除成功',
        stats: {
          total_pixels: userStats.total_pixels,
          current_pixels: userStats.current_pixels,
          account_age: Math.floor((Date.now() - new Date(userStats.created_at).getTime()) / (1000 * 60 * 60 * 24))
        }
      });

    } catch (error) {
      console.error('删除账号失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取用户统计信息
  static async getUserStats(req, res) {
    try {
      const userId = req.user.id;

      // 1. 强制刷新用户像素状态（触发懒加载计算，确保自然恢复的点数已到账）
      let currentPixels = 0;
      try {
        const pixelState = await UserPixelState.refreshState(userId);
        currentPixels = pixelState ? pixelState.pixel_points : 0;
      } catch (stateError) {
        console.error('刷新用户像素状态失败:', stateError);
        // 降级使用users表的旧数据
      }

      const stats = await db('users')
        .where('id', userId)
        .select('total_pixels', 'current_pixels', 'created_at')
        .first();

      if (!stats) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 移除不可靠的降级逻辑，始终信任 refreshState 的计算结果
      // 除非 refreshState 抛出异常，否则其返回值就是权威的


      // 计算账号年龄（天数）
      const accountAge = Math.floor((Date.now() - new Date(stats.created_at).getTime()) / (1000 * 60 * 60 * 24));

      res.json({
        success: true,
        stats: {
          total_pixels: stats.total_pixels,
          current_pixels: currentPixels, // 使用实时计算的最新数据
          points: await User.getUserPoints(userId),
          account_age: accountAge
        }
      });

    } catch (error) {
      console.error('获取用户统计失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
  /**
   * Strip hardcoded localhost URLs from avatar paths so clients
   * can resolve them relative to their configured API base.
   */
  static sanitizeAvatarUrl(url) {
    if (!url) return url;
    // Remove http://localhost:PORT or http://IP:PORT prefix, keep the path
    return url.replace(/^https?:\/\/(localhost|[\d.]+)(:\d+)?/, '');
  }
}

module.exports = ProfileController;
