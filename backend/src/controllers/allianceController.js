const Alliance = require('../models/Alliance');
const User = require('../models/User');
const { db } = require('../config/database');
const { redisUtils } = require('../config/redis');
const Achievement = require('../models/Achievement');
const SystemMessage = require('../models/SystemMessage');
const NotificationController = require('./notificationController'); // Keep for now or remove if unused (I'll keep it just in case)
// 统一使用 database.js 中的配置
const { v4: uuidv4 } = require('uuid'); // Added for new functions
const { getLevelForExp } = require('../constants/allianceLevels');
const AllianceActivityController = require('./allianceActivityController');
const { normalizeUserForDisplay, normalizeUsersForDisplay } = require('../utils/userDisplayHelper');

/**
 * 清除用户联盟缓存（写入路径性能优化关联）
 * pixelDrawService.determinePixelFromAlliance 使用 Redis 缓存联盟旗帜信息，
 * 联盟成员变更或旗帜更新时需要清除。
 */
async function clearUserAllianceCache(userId) {
  try {
    // 清除通用 key 和所有可能的 allianceId 限定 key
    // 通用 key: user_alliance:{userId}
    await redisUtils.del(`user_alliance:${userId}`);
    // 带 allianceId 的 key 使用 scan 匹配清除
    const keys = await redisUtils.keys(`user_alliance:${userId}:*`);
    if (keys && keys.length > 0) {
      for (const key of keys) {
        await redisUtils.del(key);
      }
    }
  } catch (_) {
    // Redis unavailable, cache will expire naturally
  }
}

/**
 * 清除联盟所有成员的联盟缓存（旗帜更新时使用）
 */
async function clearAllianceMembersCache(allianceId) {
  try {
    const members = await db('alliance_members')
      .where('alliance_id', allianceId)
      .select('user_id');
    for (const member of members) {
      await clearUserAllianceCache(member.user_id);
    }
  } catch (_) {
    // Non-critical, cache will expire naturally
  }
}


class AllianceController {
  // 创建联盟
  static async createAlliance(req, res) {
    try {
      const { name, description, flag_pattern_id: flagPatternId, is_public, approval_required } = req.body;
      const userId = req.user.id;

      // 1. Check user's creation limits based on pixels
      const user = await db('users').where('id', userId).select('total_pixels').first();
      const totalPixels = user ? (user.total_pixels || 0) : 0;

      // Calculate limit: Base 1 + 1 every 200 pixels, capped at 5
      const extraSlots = Math.floor(totalPixels / 200);
      const creationLimit = Math.min(5, 1 + extraSlots);

      // Count existing alliances owned by this user
      const ownedAlliancesResult = await db('alliances')
        .where('leader_id', userId)
        .where('is_active', true)
        .count('* as count')
        .first();
      const ownedCount = parseInt(ownedAlliancesResult.count || 0);

      if (ownedCount >= creationLimit) {
        const nextUnlock = (extraSlots + 1) * 200;
        const needed = nextUnlock - totalPixels;
        let message = `您已达到当前联盟创建上限 (${creationLimit}个)。`;
        if (creationLimit < 5) {
          message += ` 再绘制 ${needed} 个像素可解锁下一个名额 (当前: ${totalPixels}, 进度: ${totalPixels % 200}/200)。`;
        } else {
          message += ` 已达到最大允许数量 (5个)。`;
        }

        return res.status(403).json({
          success: false,
          message: message,
          limit: creationLimit,
          current: ownedCount,
          totalPixels: totalPixels
        });
      }

      // 验证输入
      if (!name) {
        return res.status(400).json({
          success: false,
          message: '联盟名称是必填项'
        });
      }

      // 验证旗帜设置
      if (!flagPatternId) {
        return res.status(400).json({
          success: false,
          message: '旗帜图案ID是必填项'
        });
      }

      // 验证用户是否拥有该图案
      const UserInventory = require('../models/UserInventory');

      // 检查是否是基础颜色、emoji图案或自定义图案
      const isBasicColor = flagPatternId.startsWith('color_');
      const isEmojiPattern = flagPatternId.startsWith('emoji_');
      const isAlliancePattern = flagPatternId.startsWith('alliance_'); // Admin-uploaded flags
      const isCustomPattern = flagPatternId.startsWith('custom_');

      if (isBasicColor || isEmojiPattern || isAlliancePattern) {
        // 基础颜色、emoji图案和官方联盟旗帜免费使用，无需检查SKU和库存
        console.log(`使用免费图案: ${flagPatternId}`);
      } else if (isCustomPattern) {
        // 检查用户是否拥有该自定义图案
        const userCustomPattern = await db('user_custom_patterns')
          .join('pattern_assets', 'user_custom_patterns.pattern_id', 'pattern_assets.id')
          .where('user_custom_patterns.user_id', userId)
          .where('pattern_assets.key', flagPatternId)
          .where('pattern_assets.verified', true)
          .first();

        if (!userCustomPattern) {
          return res.status(400).json({
            success: false,
            message: '您没有拥有该自定义图案旗帜，请先购买并等待审核通过'
          });
        }

        console.log(`使用自定义图案: ${flagPatternId} (${userCustomPattern.name})`);
      } else {
        // 查找包含该pattern_id的SKU
        const sku = await db('shop_skus')
          .where('pattern_id', flagPatternId)
          .where('type', 'flag_pattern')
          .where('active', true)
          .where('verified', true)
          .first();

        if (!sku) {
          return res.status(400).json({
            success: false,
            message: '图案旗帜不存在或未验证'
          });
        }

        // 检查用户是否拥有该SKU
        const inventory = await UserInventory.getByUserAndSku(userId, sku.id);
        if (!inventory || inventory.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: '您没有拥有该图案旗帜，请先购买'
          });
        }
      }


      // 允许用户创建多个联盟，移除只能在一个联盟的限制
      /*
      // 检查用户是否已在联盟中
      const existingAlliance = await Alliance.getUserAlliance(userId);
      if (existingAlliance) {
        return res.status(400).json({
          success: false,
          message: '您已在联盟中，请先退出当前联盟'
        });
      }
      */

      // 检查联盟名称是否已存在
      const existingName = await Alliance.findByName(name);
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: '联盟名称已存在'
        });
      }

      // 创建联盟
      const alliance = await Alliance.create({
        name,
        description,
        flagPatternId,
        leader_id: userId,
        is_public,
        approval_required: approval_required !== undefined ? approval_required : true
      });

      // 触发成就：创建第一个联盟
      await Achievement.updateUserStats(userId, { creations_count: 1 });
      await Achievement.updateUserStats(userId, { alliance_join_count: 1 }); // 盟主也算加入

      // 🚀 清除用户联盟缓存
      clearUserAllianceCache(userId);

      res.status(201).json({
        success: true,
        message: '联盟创建成功',
        alliance: {
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          logo_url: alliance.logo_url,
          leader_id: alliance.leader_id,
          member_count: alliance.member_count || 1,
          max_members: alliance.max_members || 50,
          is_public: alliance.is_public !== false,
          is_active: alliance.is_active !== false,
          approval_required: alliance.approval_required !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at,
          user_role: 'leader'
        }
      });
    } catch (error) {
      console.error('创建联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '创建联盟失败',
        error: error.message
      });
    }
  }

  // 搜索联盟
  static async searchAlliances(req, res) {
    try {
      const { q = '', limit = 20, offset = 0 } = req.query;

      const alliances = await Alliance.search(q, parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        alliances: alliances.map(alliance => ({
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          leader_id: alliance.leader_id,
          member_count: alliance.member_count || 1,
          max_members: alliance.max_members || 50,
          is_public: alliance.is_public !== false,
          approval_required: alliance.approval_required !== false,
          is_active: alliance.is_active !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: alliances.length
        }
      });
    } catch (error) {
      console.error('搜索联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '搜索联盟失败',
        error: error.message
      });
    }
  }

  // 获取联盟详情
  static async getAllianceDetails(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 获取联盟成员
      const members = await alliance.getMembers();
      const userRole = await alliance.getUserRole(userId);

      // 计算联盟等级信息
      const levelInfo = getLevelForExp(alliance.experience || 0);

      res.json({
        success: true,
        alliance: {
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          leader_id: alliance.leader_id,
          member_count: alliance.member_count || 1,
          max_members: levelInfo.maxMembers,
          is_public: alliance.is_public !== false,
          is_active: alliance.is_active !== false,
          approval_required: alliance.approval_required !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at,
          user_role: userRole,
          level: levelInfo.level,
          level_name: levelInfo.name,
          level_name_en: levelInfo.nameEn,
          level_icon: levelInfo.icon,
          experience: alliance.experience || 0,
          next_level_exp: levelInfo.nextLevelExp,
          level_progress: levelInfo.progress,
          is_max_level: levelInfo.isMaxLevel
        },
        members: members.map(member => ({
          id: member.user_id,
          username: member.username,
          avatar_url: member.avatar_url,
          role: member.role,
          joined_at: member.joined_at,
          last_active_at: member.last_active_at
        }))
      });
    } catch (error) {
      console.error('获取联盟详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟详情失败',
        error: error.message
      });
    }
  }

  // 转让盟主
  static async transferLeadership(req, res) {
    try {
      const { id } = req.params;
      const { new_leader_id } = req.body;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查当前用户是否是盟主
      if (alliance.leader_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '只有盟主可以转让盟主位置'
        });
      }

      // 检查新盟主是否是联盟成员
      const isMember = await alliance.isMember(new_leader_id);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: '新盟主必须是联盟成员'
        });
      }

      // 更新盟主
      await db('alliances')
        .where('id', id)
        .update({ leader_id: new_leader_id });

      // Record activity
      const newLeader = await db('users').where('id', new_leader_id).select('username').first();
      AllianceActivityController.recordActivity(id, new_leader_id, newLeader?.username, 'transfer');

      res.json({
        success: true,
        message: '盟主转让成功'
      });
    } catch (error) {
      console.error('转让盟主失败:', error);
      res.status(500).json({
        success: false,
        message: '转让盟主失败',
        error: error.message
      });
    }
  }

  // 任命/解除管理员
  static async updateMemberRole(req, res) {
    try {
      const { id } = req.params;
      const { member_id, role } = req.body;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查当前用户权限（只有盟主可以任命/解除管理员）
      const userRole = await alliance.getUserRole(userId);
      if (userRole !== 'leader') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有盟主可以任命/解除管理员'
        });
      }

      // 检查要修改的成员是否存在
      const isMember = await alliance.isMember(member_id);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: '该用户不是联盟成员'
        });
      }

      // 验证角色
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: '无效的角色'
        });
      }

      // 不能修改盟主角色
      const memberRole = await alliance.getUserRole(member_id);
      if (memberRole === 'leader') {
        return res.status(400).json({
          success: false,
          message: '不能修改盟主角色'
        });
      }

      // 更新成员角色
      await db('alliance_members')
        .where('alliance_id', id)
        .where('user_id', member_id)
        .update({ role });

      // Record activity
      const targetUser = await db('users').where('id', member_id).select('username').first();
      const actionType = role === 'admin' ? 'promoted' : 'demoted';
      AllianceActivityController.recordActivity(id, member_id, targetUser?.username, actionType);

      res.json({
        success: true,
        message: `成员角色已更新为${role === 'admin' ? '管理员' : '普通成员'}`
      });
    } catch (error) {
      console.error('更新成员角色失败:', error);
      res.status(500).json({
        success: false,
        message: '更新成员角色失败',
        error: error.message
      });
    }
  }

  // 踢出联盟成员
  static async kickMember(req, res) {
    try {
      const { id } = req.params;
      const { member_id } = req.body;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查当前用户权限
      const userRole = await alliance.getUserRole(userId);
      if (userRole !== 'leader' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有盟主和管理员可以踢出成员'
        });
      }

      // 检查要踢出的成员是否存在
      const isMember = await alliance.isMember(member_id);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: '该用户不是联盟成员'
        });
      }

      // 检查要踢出的成员角色
      const memberRole = await alliance.getUserRole(member_id);
      if (memberRole === 'leader') {
        return res.status(400).json({
          success: false,
          message: '不能踢出盟主'
        });
      }

      if (userRole === 'admin' && memberRole === 'admin') {
        return res.status(400).json({
          success: false,
          message: '管理员不能踢出其他管理员'
        });
      }

      // 踢出成员
      const kickedUser = await db('users').where('id', member_id).select('username').first();
      await alliance.removeMember(member_id);

      // Record activity
      AllianceActivityController.recordActivity(id, member_id, kickedUser?.username, 'kicked');

      // 🚀 清除被踢成员联盟缓存
      clearUserAllianceCache(member_id);

      res.json({
        success: true,
        message: '成员已成功踢出'
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

  // 获取联盟成员列表
  static async getAllianceMembers(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      console.log(`🔍 获取联盟成员: allianceId=${id}, userId=${userId}`);

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查用户是否是联盟成员
      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是该联盟成员'
        });
      }

      // 获取联盟成员列表
      const members = await db('alliance_members as am')
        .join('users as u', 'am.user_id', 'u.id')
        .where('am.alliance_id', id)
        .select(
          'u.id',
          'u.username',
          'u.display_name',
          'u.avatar_url',
          'u.avatar',
          'u.account_status',
          'am.role',
          'am.joined_at',
          'u.total_pixels',
          'u.current_pixels'
        )
        .orderBy('am.joined_at', 'asc');

      // Normalize user data for deleted accounts
      const normalizedMembers = normalizeUsersForDisplay(members, {
        includeStats: true
      });

      // 处理成员数据
      const formattedMembers = normalizedMembers.map(member => {
        // Sanitize: strip any hardcoded localhost prefix
        let avatarUrl = member.avatar_url;
        if (avatarUrl) {
          avatarUrl = avatarUrl.replace(/^https?:\/\/localhost(:\d+)?/, '');
        }

        return {
          id: member.id,
          username: member.display_name,
          avatar_url: avatarUrl,
          is_deleted: member.is_deleted,
          clickable: member.clickable,
          role: member.role,
          joined_at: member.joined_at,
          total_pixels: member.total_pixels || 0,
          current_pixels: member.current_pixels || 0
        };
      });

      res.json({
        success: true,
        members: formattedMembers
      });
    } catch (error) {
      console.error('获取联盟成员失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟成员失败',
        error: error.message
      });
    }
  }

  // 审批联盟申请
  static async reviewApplication(req, res) {
    try {
      const { id } = req.params;
      const { application_id, action, message } = req.body;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查当前用户权限
      const userRole = await alliance.getUserRole(userId);
      if (userRole !== 'leader' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有盟主和管理员可以审批申请'
        });
      }

      // 获取申请记录
      const application = await db('alliance_applications')
        .where('id', application_id)
        .where('alliance_id', id)
        .where('status', 'pending')
        .first();

      if (!application) {
        return res.status(404).json({
          success: false,
          message: '申请不存在或已被处理'
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: '无效的操作'
        });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // 更新申请状态
      await db('alliance_applications')
        .where('id', application_id)
        .update({
          status: newStatus,
          reviewed_by: userId,
          reviewed_at: db.fn.now(),
          review_message: message
        });

      if (action === 'approve') {
        // 批准申请，添加用户到联盟
        await db('alliance_members').insert({
          alliance_id: id,
          user_id: application.user_id,
          role: 'member',
          joined_at: db.fn.now()
        });

        // 更新联盟成员数
        await db('alliances')
          .where('id', id)
          .increment('member_count', 1);

        // 触发成就：加入联盟
        await Achievement.updateUserStats(application.user_id, { alliance_join_count: 1 });

        // Record activity
        const joinedUser = await db('users').where('id', application.user_id).select('username').first();
        AllianceActivityController.recordActivity(id, application.user_id, joinedUser?.username, 'joined');

        // 🚀 清除新成员联盟缓存
        clearUserAllianceCache(application.user_id);
      }

      // 触发申请结果通知
      await NotificationController.createAllianceApplicationResultNotification(
        application.user_id,
        alliance.name,
        action === 'approve',
        message
      );

      res.json({
        success: true,
        message: `申请已${action === 'approve' ? '批准' : '拒绝'}`
      });
    } catch (error) {
      console.error('审批申请失败:', error);
      res.status(500).json({
        success: false,
        message: '审批申请失败',
        error: error.message
      });
    }
  }

  // 获取联盟申请列表
  static async getApplications(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查当前用户权限
      const userRole = await alliance.getUserRole(userId);
      if (userRole !== 'leader' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有盟主和管理员可以查看申请'
        });
      }

      // 获取申请列表
      const applications = await db('alliance_applications as aa')
        .join('users as u', 'aa.user_id', 'u.id')
        .where('aa.alliance_id', id)
        .select(
          'aa.id',
          'aa.user_id',
          'u.username',
          'u.display_name',
          'u.avatar_url',
          'u.account_status',
          'u.total_pixels',
          'u.current_pixels',
          'aa.message',
          'aa.status',
          'aa.created_at',
          'aa.reviewed_at',
          'aa.review_message'
        )
        .orderBy('aa.created_at', 'desc');

      // Normalize user data for deleted accounts
      const formattedApplications = applications.map(app => {
        const normalizedUser = normalizeUserForDisplay({
          id: app.user_id,
          username: app.username,
          display_name: app.display_name,
          avatar_url: app.avatar_url,
          account_status: app.account_status
        }, { includeStats: true });

        return {
          id: app.id,
          user_id: app.user_id,
          username: normalizedUser.display_name,
          avatar_url: normalizedUser.avatar_url,
          is_deleted: normalizedUser.is_deleted,
          total_pixels: app.total_pixels || 0,
          current_pixels: app.current_pixels || 0,
          message: app.message,
          status: app.status,
          created_at: app.created_at,
          reviewed_at: app.reviewed_at,
          review_message: app.review_message
        };
      });

      res.json({
        success: true,
        applications: formattedApplications
      });
    } catch (error) {
      console.error('获取申请列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取申请列表失败',
        error: error.message
      });
    }
  }

  // 申请加入联盟
  static async applyToAlliance(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      if (!alliance.is_public) {
        return res.status(403).json({
          success: false,
          message: '该联盟不公开，无法申请加入'
        });
      }

      // 检查用户是否已在联盟中
      const isMember = await alliance.isMember(userId);
      if (isMember) {
        return res.status(400).json({
          success: false,
          message: '您已是该联盟成员'
        });
      }


      // 允许用户加入多个联盟，移除只允许加入一个联盟的限制
      /*
      // 检查用户是否已在其他联盟中
      const existingAlliance = await Alliance.getUserAlliance(userId);
      if (existingAlliance) {
        return res.status(400).json({
          success: false,
          message: '您已在其他联盟中，请先退出当前联盟'
        });
      }
      */

      // 检查是否需要审批
      if (alliance.approval_required) {
        // 需要审批，创建申请记录
        await db('alliance_applications').insert({
          alliance_id: id,
          user_id: userId,
          message
        });

        // 触发管理员通知
        await NotificationController.createAllianceApplicationNotification(id, userId, alliance.name);

        res.json({
          success: true,
          message: '申请已提交，请等待审核'
        });
      } else {
        // 不需要审批，直接加入联盟
        await db('alliance_members').insert({
          alliance_id: id,
          user_id: userId,
          role: 'member',
          joined_at: db.fn.now()
        });

        // 更新联盟成员数
        await db('alliances')
          .where('id', id)
          .increment('member_count', 1);

        // 触发成就：加入联盟
        await Achievement.updateUserStats(userId, { alliance_join_count: 1 });

        // 🚀 清除用户联盟缓存
        clearUserAllianceCache(userId);

        res.json({
          success: true,
          message: '已成功加入联盟'
        });
      }
    } catch (error) {
      console.error('申请加入联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '申请加入联盟失败',
        error: error.message
      });
    }
  }

  // 获取用户所属联盟
  static async getUserAlliance(req, res) {
    try {
      const userId = req.user.id;

      const alliance = await Alliance.getUserAlliance(userId);
      if (!alliance) {
        return res.json({
          success: true,
          alliance: null,
          message: '您当前未加入任何联盟'
        });
      }

      const userRole = await alliance.getUserRole(userId);

      // 获取盟主信息
      // Assuming 'User' model is imported or available via db('users')
      const db = require('../config/database').db;
      const leader = await db('users').where('id', alliance.leader_id).select('display_name', 'username').first();
      const leaderName = leader ? (leader.display_name || leader.username) : 'Unknown';

      const levelInfo = getLevelForExp(alliance.experience || 0);

      res.json({
        success: true,
        alliance: {
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          leader_id: alliance.leader_id,
          leader_name: leaderName,
          member_count: alliance.member_count || 1,
          max_members: levelInfo.maxMembers,
          is_public: alliance.is_public !== false,
          approval_required: alliance.approval_required !== false,
          is_active: alliance.is_active !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at,
          user_role: userRole,
          level: levelInfo.level,
          level_name: levelInfo.name,
          level_name_en: levelInfo.nameEn,
          level_icon: levelInfo.icon,
          experience: alliance.experience || 0,
          next_level_exp: levelInfo.nextLevelExp,
          level_progress: levelInfo.progress,
          is_max_level: levelInfo.isMaxLevel
        }
      });
    } catch (error) {
      console.error('获取用户联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户联盟失败',
        error: error.message
      });
    }
  }

  // 获取用户所有所属联盟列表
  static async getUserAlliances(req, res) {
    try {
      const userId = req.user.id;

      const alliances = await Alliance.getUserAlliances(userId);

      // Get leader names for all alliances
      const db = require('../config/database').db;

      // Collect all leader IDs
      const leaderIds = [...new Set(alliances.map(a => a.leader_id))];

      // Fetch user info for leaders
      let leaderMap = {};
      if (leaderIds.length > 0) {
        const leaders = await db('users')
          .whereIn('id', leaderIds)
          .select('id', 'display_name', 'username');

        leaderMap = leaders.reduce((acc, curr) => {
          acc[curr.id] = curr.display_name || curr.username;
          return acc;
        }, {});
      }

      const formattedAlliances = alliances.map(alliance => {
        const levelInfo = getLevelForExp(alliance.experience || 0);
        return {
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          leader_id: alliance.leader_id,
          leader_name: leaderMap[alliance.leader_id] || 'Unknown',
          member_count: alliance.member_count || 1,
          max_members: levelInfo.maxMembers,
          is_public: alliance.is_public !== false,
          approval_required: alliance.approval_required !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at,
          user_role: alliance.userRole,
          level: levelInfo.level,
          level_name: levelInfo.name,
          level_name_en: levelInfo.nameEn,
          level_icon: levelInfo.icon,
          experience: alliance.experience || 0,
          next_level_exp: levelInfo.nextLevelExp,
          level_progress: levelInfo.progress,
          is_max_level: levelInfo.isMaxLevel
        };
      });

      res.json({
        success: true,
        alliances: formattedAlliances
      });
    } catch (error) {
      console.error('获取用户所有联盟列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户所有联盟列表失败',
        error: error.message
      });
    }
  }

  // 获取用户联盟颜色
  static async getUserAllianceColor(req, res) {
    try {
      const userId = req.user.id;

      const color = await Alliance.getUserAllianceColor(userId);

      res.json({
        success: true,
        color: color
      });
    } catch (error) {
      console.error('获取用户联盟颜色失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户联盟颜色失败',
        error: error.message
      });
    }
  }

  // 获取用户联盟旗帜信息
  static async getUserAllianceFlag(req, res) {
    try {
      const userId = req.user.id;

      const alliance = await Alliance.getUserAlliance(userId);
      if (!alliance) {
        return res.json({
          success: true,
          flag: {
            pattern_id: 'color_black', // 使用有效的黑色图案作为默认值
            anchor_x: 0,
            anchor_y: 0,
            rotation: 0,
            mirror: false
          }
        });
      }

      // 获取图案详细信息
      let patternInfo = null;
      if (alliance.flag_pattern_id) {
        try {
          // ✅ 从pattern_assets表获取图案信息（统一使用 key 查询）
          const pattern = await db('pattern_assets')
            .where('key', alliance.flag_pattern_id)
            .select('*')
            .first();

          if (pattern) {
            patternInfo = {
              id: pattern.id,
              pattern_id: pattern.id.toString(),
              key: pattern.key,
              name: pattern.name,
              category: pattern.category,
              render_type: pattern.render_type || 'complex',
              unicode_char: pattern.unicode_char,
              width: pattern.width,
              height: pattern.height,
              verified: pattern.verified,
              payload: pattern.payload,  // 添加payload字段，用于渲染complex图案
              encoding: pattern.encoding,  // 添加encoding字段
              material_id: pattern.material_id,
              material_version: pattern.material_version,
              material_metadata: typeof pattern.material_metadata === 'string' ? JSON.parse(pattern.material_metadata) : pattern.material_metadata || {},
              is_owned: true,   // 用户自己联盟的旗帜图案始终视为已拥有
              is_free: pattern.category === 'color' || pattern.category === 'emoji',
            };
          }
        } catch (patternError) {
          console.warn('获取图案信息失败:', patternError);
        }
      }

      res.json({
        success: true,
        flag: {
          pattern_id: alliance.flag_pattern_id || 'color_black', // 使用有效的黑色图案作为默认值
          unicode_char: patternInfo?.unicode_char || alliance.flag_unicode_char, // 优先使用图案信息中的unicode_char
          render_type: patternInfo?.render_type || alliance.flag_render_type || 'complex',
          payload: patternInfo?.payload || alliance.flag_payload, // 优先使用图案信息中的payload，否则使用联盟表中的payload
          encoding: patternInfo?.encoding, // 添加encoding字段
          anchor_x: alliance.flag_pattern_anchor_x || 0,
          anchor_y: alliance.flag_pattern_anchor_y || 0,
          rotation: alliance.flag_pattern_rotation || 0,
          mirror: alliance.flag_pattern_mirror || false,
          pattern_info: patternInfo // 添加详细的图案信息
        }
      });
    } catch (error) {
      console.error('获取用户联盟旗帜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户联盟旗帜失败',
        error: error.message
      });
    }
  }

  // 获取可用的联盟旗帜图案
  static async getAvailableFlagPatterns(req, res) {
    try {
      const userId = req.user.id;

      // 1. 获取所有公开的基础图案 (颜色、emoji、官方推荐旗帜)
      const publicPatterns = await db('pattern_assets')
        .whereIn('category', ['color', 'emoji', 'alliance_flag'])
        .where('is_public', true)
        .whereNull('deleted_at')
        .select('id', 'key', 'name', 'description', 'category', 'render_type', 'unicode_char', 'color', 'width', 'height', 'encoding', 'verified');

      // 2. 获取用户从商店购买的旗帜图案
      const ownedShopPatterns = await db('user_inventory')
        .join('shop_skus', 'user_inventory.item_id', 'shop_skus.id')
        .join('pattern_assets', function () {
          this.on('shop_skus.pattern_id', '=', 'pattern_assets.key')
            .orOn(db.raw('CAST(pattern_assets.id AS TEXT)'), '=', 'shop_skus.pattern_id')
            .orOn(db.raw('\'flag_\' || CAST(pattern_assets.id AS TEXT)'), '=', 'shop_skus.pattern_id')
        })
        .where('user_inventory.user_id', userId)
        .where('shop_skus.type', 'flag_pattern')
        .where('shop_skus.active', true)
        .whereNull('pattern_assets.deleted_at')
        .select('pattern_assets.id', 'pattern_assets.key', 'pattern_assets.name', 'pattern_assets.description', 'pattern_assets.category', 'pattern_assets.render_type', 'pattern_assets.unicode_char', 'pattern_assets.color', 'pattern_assets.width', 'pattern_assets.height', 'pattern_assets.encoding', 'pattern_assets.verified');

      // 3. 获取用户拥有的自定义图案
      const ownedCustomPatterns = await db('user_custom_patterns')
        .join('pattern_assets', 'user_custom_patterns.pattern_id', 'pattern_assets.id')
        .where('user_custom_patterns.user_id', userId)
        .whereNull('pattern_assets.deleted_at')
        .select('pattern_assets.id', 'pattern_assets.key', 'pattern_assets.name', 'pattern_assets.description', 'pattern_assets.category', 'pattern_assets.render_type', 'pattern_assets.unicode_char', 'pattern_assets.color', 'pattern_assets.width', 'pattern_assets.height', 'pattern_assets.encoding', 'pattern_assets.verified');

      // 4. 合并所有图案并去重 (由于 user_custom_patterns 可能已经包含在 pattern_assets 中)
      const allPatternsMap = new Map();

      // 优先级：用户拥有的图案 > 公开图案
      [...publicPatterns, ...ownedShopPatterns, ...ownedCustomPatterns].forEach(p => {
        allPatternsMap.set(p.id, p);
      });

      const uniquePatternsList = Array.from(allPatternsMap.values());

      // 5. 标识哪些图案是已拥有的
      const ownedIds = new Set([
        ...ownedShopPatterns.map(p => p.id),
        ...ownedCustomPatterns.map(p => p.id)
      ]);

      // 处理图案数据并分组
      const processedPatterns = uniquePatternsList.map(pattern => {
        const isOwned = ownedIds.has(pattern.id) ||
          pattern.category === 'color' ||
          pattern.category === 'emoji';

        return {
          id: pattern.id,
          pattern_id: pattern.id.toString(),
          key: pattern.key || '',
          name: pattern.name,
          description: pattern.description,
          category: pattern.category || 'complex',
          render_type: pattern.render_type || (pattern.category === 'color' ? 'color' : (pattern.category === 'emoji' ? 'emoji' : 'complex')),
          unicode_char: pattern.unicode_char || '',
          color: pattern.color || '',
          width: pattern.width,
          height: pattern.height,
          encoding: pattern.encoding,
          verified: pattern.verified,
          is_owned: isOwned,
          is_free: pattern.category === 'color' || pattern.category === 'emoji',
          price: (pattern.category === 'color' || pattern.category === 'emoji') ? 0 : 100
        };
      });

      // 按类别分组
      res.json({
        success: true,
        patterns: {
          colors: processedPatterns.filter(p => p.category === 'color'),
          emojis: processedPatterns.filter(p => p.category === 'emoji'),
          complex: processedPatterns.filter(p => p.category !== 'color' && p.category !== 'emoji')
        },
        total: processedPatterns.length
      });
    } catch (error) {
      console.error('获取联盟旗帜图案失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟旗帜图案失败',
        error: error.message
      });
    }
  }

  // 退出联盟
  static async leaveAlliance(req, res) {
    try {
      const userId = req.user.id;
      const allianceId = req.params.id;

      let alliance;
      if (allianceId) {
        alliance = await Alliance.findById(allianceId);
      } else {
        // Fallback for old API calls (though route changed, maybe keep for safety if used elsewhere?)
        // But route is :id/leave now, so id is required.
        // Just in case:
        alliance = await Alliance.getUserAlliance(userId);
      }

      if (!alliance) {
        // 用户实际上没有加入联盟，但前端可能显示有联盟
        // 直接返回成功，让前端清除缓存状态
        return res.json({
          success: true,
          message: '您当前未加入该联盟，状态已同步'
        });
      }

      // Check if user is actually a member of THIS alliance
      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.json({
          success: true,
          message: '您不是该联盟的成员'
        });
      }

      const userRole = await alliance.getUserRole(userId);

      // 如果是盟主，检查联盟成员数量
      if (userRole === 'leader') {
        const memberCount = await alliance.getMemberCount();

        // 如果联盟中只有盟主一个人，直接解散联盟
        if (memberCount === 1) {
          await alliance.disband();
          clearUserAllianceCache(userId);
          return res.json({
            success: true,
            message: '联盟已解散'
          });
        } else {
          // 如果还有其他成员，不允许盟主退出
          return res.status(400).json({
            success: false,
            message: '盟主不能直接退出，请先转让盟主或解散联盟'
          });
        }
      }

      // 普通成员退出
      const leavingUser = await db('users').where('id', userId).select('username').first();
      await alliance.removeMember(userId);

      // Record activity
      AllianceActivityController.recordActivity(allianceId, userId, leavingUser?.username, 'left');

      // 🚀 清除用户联盟缓存
      clearUserAllianceCache(userId);

      res.json({
        success: true,
        message: '已成功退出联盟'
      });
    } catch (error) {
      console.error('退出联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '退出联盟失败',
        error: error.message
      });
    }
  }

  // 更新联盟信息（仅盟主和管理员）
  static async updateAlliance(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      console.log(`🔍 [Debug] updateAlliance called for id=${id} by user=${userId}, data:`, JSON.stringify(updateData));

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      const userRole = await alliance.getUserRole(userId);
      if (!userRole || (userRole !== 'leader' && userRole !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有盟主和管理员可以修改联盟信息'
        });
      }

      // 如果修改名称，检查是否重复
      if (updateData.name && updateData.name !== alliance.name) {
        const existingName = await Alliance.findByName(updateData.name);
        if (existingName) {
          return res.status(400).json({
            success: false,
            message: '联盟名称已存在'
          });
        }
      }

      // 验证旗帜图案所有权
      if (updateData.flag_pattern_id) {
        const flagPatternId = updateData.flag_pattern_id;

        // 检查是否是基础颜色、emoji图案或自定义图案
        const isBasicColor = flagPatternId.startsWith('color_');
        const isEmojiPattern = flagPatternId.startsWith('emoji_');
        const isAlliancePattern = flagPatternId.startsWith('alliance_');
        const isCustomPattern = flagPatternId.startsWith('custom_');

        if (isBasicColor || isEmojiPattern || isAlliancePattern) {
          // 免费图案
        } else if (isCustomPattern) {
          const userCustomPattern = await db('user_custom_patterns')
            .join('pattern_assets', 'user_custom_patterns.pattern_id', 'pattern_assets.id')
            .where('user_custom_patterns.user_id', userId)
            .where('pattern_assets.key', flagPatternId)
            .where('pattern_assets.verified', true)
            .first();

          if (!userCustomPattern) {
            return res.status(400).json({
              success: false,
              message: '您没有拥有该自定义图案旗帜'
            });
          }
        } else {
          // 商店购买图案
          const sku = await db('shop_skus')
            .where('pattern_id', flagPatternId)
            .where('type', 'flag_pattern')
            .where('active', true)
            .first();

          if (sku) {
            const UserInventory = require('../models/UserInventory');
            const inventory = await UserInventory.getByUserAndSku(userId, sku.id);
            if (!inventory || inventory.quantity <= 0) {
              return res.status(400).json({
                success: false,
                message: '您没有拥有该图案旗帜'
              });
            }
          }
        }
      }
      // 检查公告是否变更
      const oldNotice = alliance.notice;
      const isNoticeChanged = updateData.notice && updateData.notice !== oldNotice;

      console.log(`🔍 [Debug] Alliance Notice Update: id=${alliance.id}, old='${oldNotice}', new='${updateData.notice}', changed=${isNoticeChanged}`);

      const updatedAlliance = await alliance.update(updateData);

      // 🚀 如果旗帜或颜色变更，清除所有成员联盟缓存
      if (updateData.flag_pattern_id || updateData.color) {
        clearAllianceMembersCache(id);
      }

      // 🆕 如果公告更新，通知所有成员
      if (isNoticeChanged) {
        try {
          // 获取所有成员
          const members = await alliance.getMembers();
          console.log(`🔍 [Debug] Found ${members.length} members for alliance ${alliance.id}`);

          // 异步发送通知，不阻塞主流程
          const notificationPromises = members.map(member => {
            // 不通知修改者自己
            if (member.user_id === userId) {
              console.log(`🔍 [Debug] Skipping notification for updater: ${userId}`);
              return Promise.resolve();
            }

            console.log(`🔍 [Debug] Creating system message for member: ${member.user_id}`);

            // 使用 SystemMessage 发送消息，这样能在 App 消息中心看到
            return SystemMessage.create({
              id: uuidv4(),
              sender_id: null, // System
              receiver_id: member.user_id,
              type: 'alliance_notice',
              title: '联盟公告更新',
              content: `联盟 "${alliance.name}" 更新了公告：${updateData.notice}`,
              attachments: {
                alliance_id: alliance.id,
                alliance_name: alliance.name,
                notice: updateData.notice
              },
              is_read: false,
              created_at: new Date()
            }).then(res => {
              console.log(`✅ [Debug] SystemMessage created for ${member.user_id}: ${res.id}`);
              // 同时也尝试发送推送通知 (Push Notification)
              NotificationController.triggerPushNotification(
                member.user_id,
                '联盟公告更新',
                `联盟 "${alliance.name}" 更新了公告：${updateData.notice}`,
                { alliance_id: alliance.id }
              ).catch(e => console.error('Push notification failed:', e));
              return res;
            }).catch(err => {
              console.error(`❌ [Debug] Failed to create system message for user ${member.user_id}:`, err);
              return null;
            });
          });

          Promise.all(notificationPromises)
            .then(results => {
              const successCount = results.filter(r => r).length;
              console.log(`✅ [Debug] SystemMessage process completed. Success: ${successCount}/${members.length - 1}`);
            })
            .catch(err => console.error('Error sending alliance notice system messages:', err));

        } catch (notifyError) {
          console.error('发送联盟公告更新通知失败:', notifyError);
        }
      }

      res.json({
        success: true,
        message: '联盟信息更新成功',
        alliance: {
          id: updatedAlliance.id,
          name: updatedAlliance.name,
          description: updatedAlliance.description,
          notice: updatedAlliance.notice,
          color: updatedAlliance.color,
          flag_pattern_id: updatedAlliance.flag_pattern_id,
          flag_unicode_char: updatedAlliance.flag_unicode_char,
          flag_render_type: updatedAlliance.flag_render_type,
          flag_payload: updatedAlliance.flag_payload,
          banner_url: updatedAlliance.banner_url,
          leader_id: updatedAlliance.leader_id,
          member_count: updatedAlliance.member_count || 1,
          max_members: updatedAlliance.max_members || 50,
          is_public: updatedAlliance.is_public !== false,
          is_active: updatedAlliance.is_active !== false,
          approval_required: updatedAlliance.approval_required !== false,
          created_at: updatedAlliance.created_at,
          updated_at: updatedAlliance.updated_at,
          user_role: userRole
        }
      });
    } catch (error) {
      console.error('更新联盟信息失败:', error);
      res.status(500).json({
        success: false,
        message: '更新联盟信息失败',
        error: error.message
      });
    }
  }

  // 转让盟主 (重复方法已删除)

  // 解散联盟（仅盟主）
  static async disbandAlliance(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      if (alliance.leader_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '只有盟主可以解散联盟'
        });
      }

      // 🚀 清除所有成员联盟缓存（在解散前获取成员列表）
      await clearAllianceMembersCache(id);

      await alliance.disband();

      res.json({
        success: true,
        message: '联盟已解散'
      });
    } catch (error) {
      console.error('解散联盟失败:', error);
      res.status(500).json({
        success: false,
        message: '解散联盟失败',
        error: error.message
      });
    }
  }

  // 获取联盟统计数据
  static async getAllianceStats(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      console.log(`🔍 获取联盟统计: allianceId=${id}, userId=${userId}`);

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      // 检查用户是否是联盟成员
      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是该联盟的成员'
        });
      }

      // 获取联盟统计数据
      const stats = await alliance.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('获取联盟统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟统计失败',
        error: error.message
      });
    }
  }

  /**
   * 获取联盟成员贡献排行
   * GET /api/alliances/:id/contributions
   */
  static async getMemberContributions(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({ success: false, message: '联盟不存在' });
      }

      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.status(403).json({ success: false, message: '您不是该联盟的成员' });
      }

      // 获取成员贡献排行（基于总像素数）
      const contributions = await db('alliance_members')
        .join('users', 'alliance_members.user_id', 'users.id')
        .where('alliance_members.alliance_id', id)
        .select(
          'users.id as user_id',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar',
          'users.account_status',
          'users.total_pixels',
          'alliance_members.role',
          'alliance_members.joined_at'
        )
        .orderBy('users.total_pixels', 'desc')
        .limit(limit);

      // 获取联盟签到贡献
      const checkinCounts = await db('alliance_checkins')
        .where('alliance_id', id)
        .groupBy('user_id')
        .select('user_id')
        .count('* as checkin_count');

      const checkinMap = {};
      checkinCounts.forEach(c => {
        checkinMap[c.user_id] = parseInt(c.checkin_count);
      });

      // Normalize users for deleted accounts
      const normalizedContributions = normalizeUsersForDisplay(contributions, {
        includeStats: true
      });

      const ranked = normalizedContributions.map((member, index) => ({
        rank: index + 1,
        user_id: member.id,
        username: member.display_name,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
        avatar: null, // Exclude raw pixel data for performance
        is_deleted: member.is_deleted,
        clickable: member.clickable,
        total_pixels: member.total_pixels || 0,
        role: member.role,
        joined_at: member.joined_at,
        checkin_count: checkinMap[member.id] || 0,
        is_current_user: member.id === userId
      }));

      res.json({
        success: true,
        data: ranked
      });
    } catch (error) {
      console.error('获取联盟贡献排行失败:', error);
      res.status(500).json({ success: false, message: '获取联盟贡献排行失败', error: error.message });
    }
  }
}

// 生成联盟邀请链接
const generateInviteLink = async (req, res) => {
  try {
    const { allianceId } = req.params;
    const userId = req.user.id;

    // 检查用户是否是联盟成员
    const membership = await db('alliance_members')
      .where({ alliance_id: allianceId, user_id: userId })
      .first();

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: '您不是该联盟的成员'
      });
    }

    // 检查联盟是否存在
    const alliance = await db('alliances')
      .where({ id: allianceId })
      .first();

    if (!alliance) {
      return res.status(404).json({
        success: false,
        message: '联盟不存在'
      });
    }

    // 生成邀请链接
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

    // 保存邀请链接到数据库
    await db('alliance_invites').insert({
      id: uuidv4(),
      alliance_id: allianceId,
      invite_code: inviteCode,
      created_by: userId,
      expires_at: expiresAt,
      is_active: true
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/alliance/join?code=${inviteCode}`;

    res.json({
      success: true,
      message: '邀请链接生成成功',
      data: {
        invite_link: inviteLink,
        invite_code: inviteCode,
        expires_at: expiresAt,
        alliance_name: alliance.name
      }
    });

  } catch (error) {
    console.error('生成邀请链接失败:', error);
    res.status(500).json({
      success: false,
      message: '生成邀请链接失败',
      error: error.message
    });
  }
};

// 通过邀请链接加入联盟
const joinByInviteLink = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    // 查找邀请链接
    const invite = await db('alliance_invites')
      .where({
        invite_code: inviteCode,
        is_active: true
      })
      .first();

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: '邀请链接无效或已过期'
      });
    }

    // 检查是否已过期
    if (new Date() > new Date(invite.expires_at)) {
      return res.status(400).json({
        success: false,
        message: '邀请链接已过期'
      });
    }

    // 检查用户是否已经是联盟成员
    const existingMembership = await db('alliance_members')
      .where({
        alliance_id: invite.alliance_id,
        user_id: userId
      })
      .first();

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: '您已经是该联盟的成员'
      });
    }

    // 获取联盟信息
    const alliance = await db('alliances')
      .where({ id: invite.alliance_id })
      .first();

    if (!alliance) {
      return res.status(404).json({
        success: false,
        message: '联盟不存在'
      });
    }

    // 检查联盟是否已满员
    const memberCount = await db('alliance_members')
      .where({ alliance_id: invite.alliance_id })
      .count('* as count')
      .first();

    if (memberCount.count >= 100) { // 假设最大成员数为100
      return res.status(400).json({
        success: false,
        message: '联盟已满员'
      });
    }

    // 加入联盟
    await db('alliance_members').insert({
      id: uuidv4(),
      alliance_id: invite.alliance_id,
      user_id: userId,
      role: 'member',
      joined_at: new Date()
    });

    // 触发成就：加入联盟
    await Achievement.updateUserStats(userId, { alliance_join_count: 1 });

    // 🚀 清除用户联盟缓存
    clearUserAllianceCache(userId);

    // 标记邀请链接为已使用
    await db('alliance_invites')
      .where({ id: invite.id })
      .update({
        is_active: false,
        used_by: userId,
        used_at: new Date()
      });

    res.json({
      success: true,
      message: '成功加入联盟',
      data: {
        alliance: {
          id: alliance.id,
          name: alliance.name,
          description: alliance.description,
          notice: alliance.notice,
          color: alliance.color,
          flag_pattern_id: alliance.flag_pattern_id,
          flag_unicode_char: alliance.flag_unicode_char,
          flag_render_type: alliance.flag_render_type,
          flag_payload: alliance.flag_payload,
          banner_url: alliance.banner_url,
          leader_id: alliance.leader_id,
          member_count: alliance.member_count || 1,
          max_members: alliance.max_members || 50,
          is_public: alliance.is_public !== false,
          is_active: alliance.is_active !== false,
          approval_required: alliance.approval_required !== false,
          created_at: alliance.created_at,
          updated_at: alliance.updated_at,
          user_role: 'member'
        }
      }
    });

  } catch (error) {
    console.error('通过邀请链接加入联盟失败:', error);
    res.status(500).json({
      success: false,
      message: '加入联盟失败'
    });
  }
};

// 获取联盟邀请链接列表
const getInviteLinks = async (req, res) => {
  try {
    const { allianceId } = req.params;
    const userId = req.user.id;

    // 检查用户是否是联盟管理员或盟主
    const membership = await db('alliance_members')
      .where({
        alliance_id: allianceId,
        user_id: userId
      })
      .first();

    if (!membership || !['leader', 'admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    // 获取邀请链接列表
    const invites = await db('alliance_invites')
      .where({ alliance_id: allianceId })
      .orderBy('created_at', 'desc')
      .select('*');

    res.json({
      success: true,
      data: {
        invites: invites.map(invite => ({
          id: invite.id,
          invite_code: invite.invite_code,
          created_at: invite.created_at,
          expires_at: invite.expires_at,
          is_active: invite.is_active,
          used_by: invite.used_by,
          used_at: invite.used_at
        }))
      }
    });

  } catch (error) {
    console.error('获取邀请链接列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取邀请链接列表失败'
    });
  }
};

// 删除邀请链接
const deleteInviteLink = async (req, res) => {
  try {
    const { allianceId, inviteId } = req.params;
    const userId = req.user.id;

    // 检查用户是否是联盟管理员或盟主
    const membership = await db('alliance_members')
      .where({
        alliance_id: allianceId,
        user_id: userId
      })
      .first();

    if (!membership || !['leader', 'admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    // 删除邀请链接
    await db('alliance_invites')
      .where({
        id: inviteId,
        alliance_id: allianceId
      })
      .del();

    res.json({
      success: true,
      message: '邀请链接删除成功'
    });

  } catch (error) {
    console.error('删除邀请链接失败:', error);
    res.status(500).json({
      success: false,
      message: '删除邀请链接失败'
    });
  }
};

// 生成邀请码的辅助函数
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  AllianceController,
  generateInviteLink,
  joinByInviteLink,
  getInviteLinks,
  deleteInviteLink
};
