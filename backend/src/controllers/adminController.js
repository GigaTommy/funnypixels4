const User = require('../models/User');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { db } = require('../config/database');
const UserPoints = require('../models/UserPoints');
const StorePayment = require('../models/StorePayment');
const Announcement = require('../models/Announcement');
const SystemMessage = require('../models/SystemMessage');
const SystemLog = require('../models/SystemLog');
const os = require('os');
const sharp = require('sharp');
const PatternAsset = require('../models/PatternAsset');
const CustomFlagProcessor = require('../services/customFlagProcessor');
const AdminAuditLog = require('../models/AdminAuditLog');

class AdminController {
  // 管理员登录
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: '用户名和密码不能为空'
        });
      }

      // 查找管理员用户
      const user = await db('users').where({ username }).first();

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 检查是否为管理员
      if (!user.is_admin && user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，非管理员用户'
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 检查用户状态
      if (user.is_banned) {
        return res.status(403).json({
          success: false,
          message: '账户已被禁用'
        });
      }

      // 生成 token
      const token = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // 返回用户信息
      const userData = {
        id: user.id,
        username: user.username,
        nickname: user.display_name || user.username,
        role: user.role || 'admin',
        is_admin: user.is_admin || user.role === 'admin' || user.role === 'super_admin',
        permissions: ['*'], // 管理员拥有所有权限
        avatar: user.avatar_url
      };

      res.json({
        success: true,
        message: '登录成功',
        data: {
          token,
          refreshToken,
          user: userData
        }
      });

    } catch (error) {
      logger.error('管理员登录失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 登出
  static async logout(req, res) {
    try {
      // 这里可以实现 token 黑名单逻辑
      res.json({
        success: true,
        message: '登出成功'
      });
    } catch (error) {
      logger.error('登出失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取当前用户信息
  static async getCurrentUser(req, res) {
    try {
      const user = req.user;

      const userData = {
        id: user.id,
        username: user.username,
        nickname: user.display_name || user.username,
        role: user.role || 'admin',
        permissions: ['*'], // 管理员拥有所有权限
        avatar: user.avatar_url
      };

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 刷新 token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token 不能为空'
        });
      }

      // 这里应该验证 refresh token 并生成新的 access token
      // 为了简化，暂时返回错误
      res.status(401).json({
        success: false,
        message: 'Refresh token 无效'
      });
    } catch (error) {
      logger.error('刷新 token 失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取用户列表
  static async getUsers(req, res) {
    try {
      const { current = 1, pageSize = 10, nickname, phone, status, role } = req.query;

      // 构建基础查询条件
      const baseQuery = User.query();
      if (nickname) {
        baseQuery.where('display_name', 'ilike', `%${nickname}%`);
      }
      if (phone) {
        baseQuery.where('phone', 'ilike', `%${phone}%`);
      }
      if (status) {
        // 将前端status映射到数据库的is_banned字段
        if (status === 'active') {
          baseQuery.where('is_banned', false);
        } else if (status === 'banned') {
          baseQuery.where('is_banned', true);
        }
      }
      if (role) {
        baseQuery.where('role', role);
      }

      // 获取总数 - 使用基础查询计算总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据 - 添加排序和选择字段
      const users = await baseQuery
        .clone()
        .orderBy('created_at', 'desc')
        .select(
          'id',
          'username',
          'display_name as nickname',
          'phone',
          'email',
          'avatar_url',
          'is_banned',
          'role',
          'created_at',
          'updated_at',
          'last_login',
          'is_online',
          'total_pixels',
          'level',
          'experience',
          'coins',
          'gems'
        )
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理状态映射，将is_banned转换为status
      const processedUsers = users.map(user => ({
        ...user,
        status: user.is_banned ? 'banned' : 'active'
      }));

      res.json({
        success: true,
        data: {
          list: processedUsers,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 创建用户
  static async createUser(req, res) {
    try {
      const { username, password, nickname, phone, email, role } = req.body;

      if (!username || !password || !nickname || !role) {
        return res.status(400).json({
          success: false,
          message: '必填字段不能为空'
        });
      }

      // 检查用户名是否已存在
      const existingUser = await User.query().where({ username }).first();
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '用户名已存在'
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const newUser = await User.query().insert({
        username,
        password_hash: hashedPassword,
        nickname,
        phone,
        email,
        role,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      // 返回用户信息（不包含密码）
      const { password_hash, ...userData } = newUser;

      res.status(201).json({
        success: true,
        message: '用户创建成功',
        data: userData
      });
    } catch (error) {
      logger.error('创建用户失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取用户详情
  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.query().where({ id }).first().select(
        'id',
        'username',
        'nickname',
        'phone',
        'email',
        'avatar_url',
        'status',
        'role',
        'created_at',
        'updated_at'
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('获取用户详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 更新用户
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { nickname, phone, email, status, role } = req.body;

      // 检查用户是否存在
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const [updatedUser] = await User.query().where({ id }).update({
        display_name: nickname,
        phone,
        email,
        // map frontend status to is_banned
        is_banned: status === 'banned',
        role,
        updated_at: new Date()
      }).returning('*');

      res.json({
        success: true,
        message: '用户更新成功',
        data: updatedUser
      });
    } catch (error) {
      logger.error('更新用户失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 删除用户
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      await User.query().where({ id }).del();

      res.json({
        success: true,
        message: '用户删除成功'
      });
    } catch (error) {
      logger.error('删除用户失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 切换用户状态 (Deprecated, use banUser)
  static async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive', 'banned'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // If passing compatible status, map to new fields
      const updateData = {
        updated_at: new Date()
      };

      if (status === 'banned') {
        updateData.is_banned = true;
        updateData.ban_type = 'login'; // Default to login ban if not specified
      } else {
        updateData.is_banned = false;
        updateData.ban_type = 'none';
      }

      await User.query().where({ id }).update(updateData);

      res.json({
        success: true,
        message: '用户状态更新成功'
      });
    } catch (error) {
      logger.error('切换用户状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 新版封禁用户
  static async banUser(req, res) {
    try {
      const { id } = req.params;
      const { banType, banReason, banDuration } = req.body; // banDuration in minutes, or 'permanent'

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }

      let expiresAt = null;
      if (banDuration && banDuration !== 'permanent') {
        // Assume banDuration is minutes
        expiresAt = new Date(Date.now() + parseInt(banDuration) * 60 * 1000);
      }

      await db('users').where({ id }).update({
        is_banned: banType !== 'none',
        ban_type: banType,
        ban_reason: banReason,
        ban_expires_at: expiresAt,
        updated_at: new Date()
      });

      res.json({ success: true, message: '用户封禁设置已更新' });
    } catch (error) {
      console.error('封禁用户失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 获取用户详情 (360视图)
  static async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      // 获取钱包信息
      const wallet = await StorePayment.getUserWallet(id);
      const pointsStats = await UserPoints.getPointsStats(id);

      // 获取联盟信息
      const allianceMember = await db('alliance_members')
        .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .where('alliance_members.user_id', id)
        .select('alliances.id', 'alliances.name', 'alliance_members.role', 'alliance_members.joined_at')
        .first();

      res.json({
        success: true,
        data: {
          user,
          wallet: { ...wallet, ...pointsStats },
          alliance: allianceMember || null
        }
      });
    } catch (error) {
      logger.error('获取用户详情失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 获取用户交易流水
  static async getUserTransactions(req, res) {
    try {
      const { id } = req.params;
      const { current = 1, pageSize = 20, type, startDate, endDate } = req.query;

      const result = await StorePayment.getUserTransactions(
        id,
        parseInt(pageSize),
        (parseInt(current) - 1) * parseInt(pageSize),
        { type, startDate, endDate }
      );

      res.json({
        success: true,
        data: {
          list: result.items,
          total: result.pagination.total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取用户流水失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 获取公告列表
  static async getAnnouncements(req, res) {
    try {
      const { type = 'global', current = 1, pageSize = 10, is_active } = req.query;

      let query = db('announcements as a')
        .join('users as u', 'a.author_id', 'u.id')
        .where('a.type', type);

      if (is_active !== undefined) {
        query = query.where('a.is_active', is_active === 'true');
      }

      const total = await query.clone().count('* as total').first();

      const announcements = await query
        .clone()
        .select('a.*', 'u.username as author_name')
        .orderBy('a.is_pinned', 'desc')
        .orderBy('a.priority', 'desc')
        .orderBy('a.publish_at', 'desc')
        .limit(parseInt(pageSize))
        .offset((parseInt(current) - 1) * parseInt(pageSize));

      res.json({
        success: true,
        data: {
          list: announcements,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取公告列表失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 创建公告
  static async createAnnouncement(req, res) {
    try {
      const { title, content, type, is_pinned, priority, display_style, expire_at } = req.body;
      const author_id = req.user.id;

      const announcement = await Announcement.create({
        author_id,
        title,
        content,
        type,
        is_pinned: is_pinned || false,
        priority: priority || 0,
        display_style: display_style || 'none',
        expire_at: expire_at || null,
        created_at: new Date(),
        updated_at: new Date()
      });

      res.status(201).json({ success: true, message: '公告创建成功', data: announcement });
    } catch (error) {
      logger.error('创建公告失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 更新公告
  static async updateAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const announcement = await db('announcements').where({ id }).first();
      if (!announcement) return res.status(404).json({ success: false, message: '公告不存在' });

      const instance = new Announcement(announcement);
      await instance.update(req.body);

      res.json({ success: true, message: '公告更新成功', data: instance });
    } catch (error) {
      logger.error('更新公告失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 删除公告
  static async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;
      await db('announcements').where({ id }).update({ is_active: false, updated_at: new Date() });
      res.json({ success: true, message: '公告已删除' });
    } catch (error) {
      logger.error('删除公告失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 发送系统邮件
  static async sendSystemMail(req, res) {
    try {
      const { title, content, receiver_id, attachments, type, expires_at } = req.body;
      const sender_id = req.user.id;

      // 如果 receiver_id 是字符串 "all" 或者为空，且是广播
      const msg = await SystemMessage.create({
        sender_id,
        receiver_id: receiver_id === 'all' ? null : (receiver_id || null),
        title,
        content,
        attachments,
        type: type || 'notification',
        expires_at: expires_at || null,
        created_at: new Date()
      });

      res.status(201).json({ success: true, message: '系统邮件已发送', data: msg });
    } catch (error) {
      logger.error('发送系统邮件失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 获取已发送系统邮件列表
  static async getSentMails(req, res) {
    try {
      const { current = 1, pageSize = 10 } = req.query;

      const total = await db('system_messages').count('* as total').first();
      const messages = await db('system_messages as sm')
        .leftJoin('users as u', 'sm.receiver_id', 'u.id')
        .select('sm.*', 'u.username as receiver_name')
        .orderBy('sm.created_at', 'desc')
        .limit(parseInt(pageSize))
        .offset((parseInt(current) - 1) * parseInt(pageSize));

      res.json({
        success: true,
        data: {
          list: messages,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取系统邮件列表失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }

  // 角色管理方法（暂时返回模拟数据）
  static async getRoles(req, res) {
    try {
      const mockRoles = [
        {
          id: 1,
          name: 'super_admin',
          description: '超级管理员',
          permissions: ['*'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'admin',
          description: '管理员',
          permissions: ['user:*', 'ad:*', 'role:view'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: {
          list: mockRoles,
          total: mockRoles.length,
          current: 1,
          pageSize: 10
        }
      });
    } catch (error) {
      logger.error('获取角色列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 联盟管理方法
  static async getAlliances(req, res) {
    try {
      const { current = 1, pageSize = 10, name, status } = req.query;

      // 构建基础查询条件
      const baseQuery = db('alliances');
      if (name) {
        baseQuery.where('alliances.name', 'ilike', `%${name}%`);
      }
      if (status) {
        baseQuery.where('alliances.status', status);
      }

      // 获取总数 - 使用基础查询计算总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据 - 添加排序和子查询
      const alliances = await baseQuery
        .clone()
        .select(
          'alliances.*',
          db.raw('(SELECT COUNT(*) FROM alliance_members WHERE alliance_members.alliance_id = alliances.id) as member_count')
        )
        .orderBy('alliances.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      res.json({
        success: true,
        data: {
          list: alliances,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取联盟列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  static async getAllianceMembers(req, res) {
    try {
      const { allianceId } = req.params;
      const { current = 1, pageSize = 10 } = req.query;

      let query = db('alliance_members')
        .join('users', 'alliance_members.user_id', '=', 'users.id')
        .select(
          'alliance_members.*',
          'users.username',
          'users.display_name as nickname',
          'users.avatar_url',
          'users.role'
        )
        .where('alliance_members.alliance_id', allianceId)
        .orderBy('alliance_members.joined_at', 'desc');

      // 获取总数
      const total = await query.clone().count('* as total').first();

      // 获取分页数据
      const members = await query
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      res.json({
        success: true,
        data: {
          list: members,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取联盟成员失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 图案资源管理方法
  static async getPatternAssets(req, res) {
    try {
      const { current = 1, pageSize = 10, category, type, name } = req.query;

      // 构建基础查询条件
      const baseQuery = db('pattern_assets');
      if (category) {
        baseQuery.where('category', category);
      }
      if (type) {
        baseQuery.where('type', type);
      }
      if (name) {
        baseQuery.where('name', 'ilike', `%${name}%`);
      }

      // 获取总数 - 使用基础查询计算总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据 - 添加排序
      const patterns = await baseQuery
        .clone()
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      res.json({
        success: true,
        data: {
          list: patterns,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取图案资源失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取待审批广告列表
  static async getPendingAds(req, res) {
    try {
      const { current = 1, pageSize = 10, title, user_id } = req.query;

      // 构建基础查询条件
      const baseQuery = db('advertisements').where('status', 'pending');
      if (title) {
        baseQuery.where('title', 'ilike', `%${title}%`);
      }
      if (user_id) {
        baseQuery.where('user_id', user_id);
      }

      // 获取总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据，关联用户信息
      const ads = await baseQuery
        .clone()
        .leftJoin('users', 'advertisements.user_id', '=', 'users.id')
        .select(
          'advertisements.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name'
        )
        .orderBy('advertisements.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedAds = ads.map(ad => ({
        id: ad.id,
        user_id: ad.user_id,
        title: ad.title,
        description: ad.description,
        image_url: ad.image_url,
        lat: ad.lat,
        lng: ad.lng,
        grid_id: ad.grid_id,
        width: ad.width,
        height: ad.height,
        start_time: ad.start_time,
        end_time: ad.end_time,
        repeat_count: ad.repeat_count,
        status: ad.status,
        created_at: ad.created_at,
        updated_at: ad.updated_at,
        applicantName: ad.applicant_name || ad.applicant_username || '未知用户',
        submittedAt: ad.created_at
      }));

      res.json({
        success: true,
        data: {
          list: processedAds,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取待审批广告失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取Dashboard统计数据
  static async getDashboardStats(req, res) {
    try {
      // 获取用户总数
      const totalUsers = await db('users').count('* as count').first();

      // 获取像素总数
      const totalPixels = await db('pixels').count('* as count').first();

      // 获取今日注册用户数
      const today = new Date().toISOString().split('T')[0];
      const todayUsers = await db('users')
        .andWhere(db.raw('DATE(created_at)'), '=', today)
        .count('* as count').first();

      // 获取活跃用户数（最近7天有活动的用户）
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeUsers = await db('users')
        .where('last_login', '>=', sevenDaysAgo.toISOString())
        .count('* as count').first();

      // 获取本周新增用户
      const newUsersWeekResult = await db('users')
        .where('created_at', '>=', sevenDaysAgo.toISOString())
        .count('* as count').first();

      // 获取用户角色分布
      const userRoleDistribution = await db('users')
        .select('role')
        .count('* as count')
        .groupBy('role');

      // 获取日新增用户趋势 (过去30天)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dailyNewUsers = await db('users')
        .select(db.raw("to_char(created_at, 'YYYY-MM-DD') as date"), db.raw('count(*)::int as count'))
        .where('created_at', '>=', thirtyDaysAgo.toISOString())
        .groupByRaw("to_char(created_at, 'YYYY-MM-DD')")
        .orderBy('date', 'asc');

      const totalUsersCount = parseInt(totalUsers.count) || 0;

      // 获取日新增内容趋势 (过去30天)
      const dailyContentStats = await db('pixels')
        .select(db.raw("to_char(created_at, 'YYYY-MM-DD') as date"), db.raw('count(*)::int as pixels'))
        .where('created_at', '>=', thirtyDaysAgo.toISOString())
        .groupByRaw("to_char(created_at, 'YYYY-MM-DD')")
        .orderBy('date', 'asc');

      // 获取内容类型分布 (Pixels vs Patterns vs Ads)
      const patternCount = await db('pattern_assets').count('* as count').first();
      const adCount = await db('ad_orders').count('* as count').first();
      const contentTypeDistribution = [
        { type: 'Pixel艺术', count: parseInt(totalPixels.count) || 0, percentage: 0 },
        { type: '图案素材', count: parseInt(patternCount.count) || 0, percentage: 0 },
        { type: '广告内容', count: parseInt(adCount.count) || 0, percentage: 0 }
      ];
      // 计算百分比
      const totalContent = contentTypeDistribution.reduce((sum, item) => sum + item.count, 0);
      contentTypeDistribution.forEach(item => {
        item.percentage = totalContent > 0 ? ((item.count / totalContent) * 100).toFixed(2) : 0;
      });

      // 获取热门内容 (浏览量最高的 Patterns) - 暂时模拟，因为 pixel 表没有 views 字段
      const popularContent = await db('pattern_assets')
        .select('name as title', 'id', 'created_by as user_id', db.raw('floor(random() * 1000 + 100)::int as views'), db.raw('floor(random() * 500 + 10)::int as downloads'))
        .whereNull('deleted_at')
        .orderByRaw('views desc')
        .limit(5);

      // 获取热门创作者 (上传 Pattern 最多的用户) - 暂时模拟 views/downloads
      const topCreators = await db('pattern_assets')
        .select('users.id as user_id', 'users.username', 'users.role', db.raw('count(pattern_assets.id)::int as content_count'), db.raw('sum(floor(random() * 1000 + 100))::int as total_views'), db.raw('sum(floor(random() * 500 + 10))::int as total_downloads'), db.raw('0 as total_likes'))
        .leftJoin('users', 'pattern_assets.created_by', 'users.id')
        .whereNull('pattern_assets.deleted_at')
        .groupBy('users.id', 'users.username', 'users.role')
        .orderBy('content_count', 'desc')
        .limit(10);

      // 获取收入分析数据 (monthlyRevenue, revenueBySource)
      // 1. 获取近6个月的月度收入
      const monthlyRevenue = await db('recharge_orders') // Correct table name
        .select(db.raw("to_char(created_at, 'YYYY-MM') as month"), db.raw('sum(amount_rmb)::int as revenue')) // Use amount_rmb for revenue
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '6 month'"))
        .where('status', 'paid') // Only count paid orders
        .groupByRaw("to_char(created_at, 'YYYY-MM')")
        .orderBy('month', 'asc');

      // 2. 获取收入来源分布 (模拟数据，因为目前只有recharge_orders)
      const revenueBySource = [
        { source: '商品销售', amount: 0, percentage: 0 },
        { source: '会员订阅', amount: parseInt(monthlyRevenue.reduce((sum, item) => sum + item.revenue, 0)) || 0, percentage: 100 }, // Assuming recharges are subscriptions/points for now
        { source: '广告收入', amount: 0, percentage: 0 },
        { source: '其他收入', amount: 0, percentage: 0 }
      ];

      // 计算总收入和月收入
      const totalRevenueResult = await db('recharge_orders').where('status', 'paid').sum('amount_rmb as total').first();
      const totalRevenue = parseInt(totalRevenueResult?.total) || 0;

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7); // YYYY-MM

      const currentMonthRevenue = monthlyRevenue.find(m => m.month === currentMonth)?.revenue || 0;
      const lastMonthRevenue = monthlyRevenue.find(m => m.month === lastMonth)?.revenue || 0;

      const revenueGrowthRate = lastMonthRevenue > 0
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(2)
        : 0;

      const stats = {
        totalUsers: totalUsersCount,
        totalPixels: parseInt(totalPixels.count) || 0,
        todayUsers: parseInt(todayUsers.count) || 0,
        activeUsers: parseInt(activeUsers.count) || 0,
        newUsersWeek: parseInt(newUsersWeekResult.count) || 0,
        userRoleDistribution: userRoleDistribution.map(r => ({
          role: r.role,
          count: parseInt(r.count),
          percentage: totalUsersCount > 0 ? ((parseInt(r.count) / totalUsersCount) * 100).toFixed(2) : 0
        })),
        dailyNewUsers: dailyNewUsers,
        // Content Analytics Data
        totalContent: totalContent,
        newContentToday: 0, // 暂无数据源
        contentGrowthRate: 0, // 暂无数据源
        averageViewsPerContent: 0, // 暂无数据源
        dailyContentStats: dailyContentStats.map(d => ({ date: d.date, pixels: d.pixels, patterns: 0 })),
        contentTypeDistribution: contentTypeDistribution,
        popularContent: popularContent,
        topCreators: topCreators,
        // Revenue Analytics Data
        totalRevenue: totalRevenue,
        monthRevenue: currentMonthRevenue,
        revenueGrowthRate: revenueGrowthRate,
        monthlyRevenue: monthlyRevenue,
        revenueBySource: revenueBySource
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取Dashboard统计数据失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误: ' + error.message,
        stack: error.stack
      });
    }
  }

  // 获取最近活动
  static async getRecentActivities(req, res) {
    try {
      const { current = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize);
      const offset = (parseInt(current) - 1) * limit;

      // 从多个数据源获取最近的活动记录
      const activities = [];

      // 1. 获取最近的用户注册
      let recentUsers = [];
      try {
        recentUsers = await db('users')
          .select('id', 'username', 'display_name', 'created_at')
          .where('created_at', '>', db.raw('NOW() - INTERVAL 7 DAY'))
          .orderBy('created_at', 'desc')
          .limit(5);
      } catch (error) {
        logger.warn('获取用户注册记录失败:', error);
      }

      if (recentUsers && recentUsers.length > 0) {
        recentUsers.forEach((user, index) => {
          activities.push({
            id: `user_${user.id}`,
            type: 'user_created',
            description: `新用户注册：${user.display_name || user.username}`,
            timestamp: user.created_at,
            user: user.username
          });
        });
      }

      // 2. 获取最近的广告审批记录
      let recentAds = [];
      try {
        recentAds = await db('ads')
          .select('id', 'title', 'status', 'reviewed_at', db.raw('"admin_users".username as reviewer_username'))
          .leftJoin('users as admin_users', 'ads.reviewed_by', 'admin_users.id')
          .whereNotNull('reviewed_at')
          .where('reviewed_at', '>', db.raw('NOW() - INTERVAL 7 DAY'))
          .orderBy('reviewed_at', 'desc')
          .limit(5);
      } catch (error) {
        logger.warn('获取广告审批记录失败:', error);
      }

      if (recentAds && recentAds.length > 0) {
        recentAds.forEach((ad) => {
          const action = ad.status === 'approved' ? '审批通过' : '审批拒绝';
          activities.push({
            id: `ad_${ad.id}`,
            type: ad.status === 'approved' ? 'ad_approved' : 'ad_rejected',
            description: `广告${action}：${ad.title || '广告ID:' + ad.id}`,
            timestamp: ad.reviewed_at,
            user: ad.reviewer_username || 'admin'
          });
        });
      }

      // 3. 获取最近的图案上传审批记录
      let recentPatterns = [];
      try {
        recentPatterns = await db('pattern_uploads')
          .select('id', 'name', 'review_status', 'reviewed_at', db.raw('"admin_users".username as reviewer_username'))
          .leftJoin('users as admin_users', 'pattern_uploads.reviewer_id', 'admin_users.id')
          .whereNotNull('reviewed_at')
          .where('reviewed_at', '>', db.raw('NOW() - INTERVAL 7 DAY'))
          .orderBy('reviewed_at', 'desc')
          .limit(5);
      } catch (error) {
        logger.warn('获取图案审批记录失败:', error);
      }

      if (recentPatterns && recentPatterns.length > 0) {
        recentPatterns.forEach((pattern) => {
          const statusMap = {
            'approved': '通过',
            'rejected': '拒绝',
            'certified': '认证通过'
          };
          const action = statusMap[pattern.review_status] || '处理';
          activities.push({
            id: `pattern_${pattern.id}`,
            type: `pattern_${pattern.review_status}`,
            description: `图案${action}：${pattern.name || '图案ID:' + pattern.id}`,
            timestamp: pattern.reviewed_at,
            user: pattern.reviewer_username || 'admin'
          });
        });
      }

      // 4. 获取最近的举报处理记录
      let recentReports = [];
      try {
        recentReports = await db('reports')
          .select('id', 'type', 'status', 'resolved_at', db.raw('"admin_users".username as reviewer_username'))
          .leftJoin('users as admin_users', 'reports.resolved_by', 'admin_users.id')
          .whereNotNull('resolved_at')
          .where('resolved_at', '>', db.raw('NOW() - INTERVAL 7 DAY'))
          .orderBy('resolved_at', 'desc')
          .limit(5);
      } catch (error) {
        logger.warn('获取举报处理记录失败:', error);
      }

      if (recentReports && recentReports.length > 0) {
        recentReports.forEach((report) => {
          const typeMap = {
            'pixel': '像素',
            'user': '用户',
            'advertisement': '广告',
            'comment': '评论',
            'alliance': '联盟'
          };
          const typeName = typeMap[report.type] || report.type;
          activities.push({
            id: `report_${report.id}`,
            type: 'report_resolved',
            description: `举报处理完成：${typeName}举报`,
            timestamp: report.resolved_at,
            user: report.reviewer_username || 'admin'
          });
        });
      }

      // 5. 获取最近的广告订单
      let recentOrders = [];
      try {
        recentOrders = await db('ad_orders')
          .select('id', 'ad_title', 'status', 'processed_at', db.raw('"admin_users".username as processor_username'))
          .leftJoin('users as admin_users', 'ad_orders.processed_by', 'admin_users.id')
          .whereNotNull('processed_at')
          .where('processed_at', '>', db.raw('NOW() - INTERVAL 7 DAY'))
          .orderBy('processed_at', 'desc')
          .limit(5);
      } catch (error) {
        logger.warn('获取广告订单记录失败:', error);
      }

      if (recentOrders && recentOrders.length > 0) {
        recentOrders.forEach((order) => {
          const statusMap = {
            'approved': '审批通过',
            'rejected': '审批拒绝',
            'processing': '开始处理'
          };
          const action = statusMap[order.status] || '处理';
          activities.push({
            id: `order_${order.id}`,
            type: `order_${order.status}`,
            description: `广告订单${action}：${order.ad_title || '订单ID:' + order.id}`,
            timestamp: order.processed_at,
            user: order.processor_username || 'admin'
          });
        });
      }

      // 按时间戳排序
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // 分页处理
      const startIndex = offset;
      const endIndex = startIndex + limit;
      const paginatedActivities = activities.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          list: paginatedActivities,
          total: activities.length
        }
      });
    } catch (error) {
      logger.error('获取最近活动失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 举报管理方法
  static async getReports(req, res) {
    try {
      const { current = 1, pageSize = 10, status, reported_type, reason, reporter_id, start_date, end_date } = req.query;

      // 构建基础查询条件
      const baseQuery = db('reports');
      if (status) {
        baseQuery.where('reports.status', status);
      }
      if (reported_type) {
        baseQuery.where('reports.reported_type', reported_type);
      }
      if (reason) {
        baseQuery.where('reports.reason', 'ilike', `%${reason}%`);
      }
      if (reporter_id) {
        baseQuery.where('reports.reporter_id', reporter_id);
      }
      if (start_date) {
        baseQuery.where('reports.created_at', '>=', start_date);
      }
      if (end_date) {
        baseQuery.where('reports.created_at', '<=', end_date);
      }

      // 获取总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据，关联用户信息
      const reports = await baseQuery
        .clone()
        .leftJoin('users as reporter', 'reports.reporter_id', '=', 'reporter.id')
        .leftJoin('users as admin', 'reports.resolved_by', '=', 'admin.id')
        .select(
          'reports.*',
          'reporter.username as reporter_username',
          'reporter.display_name as reporter_nickname',
          'admin.username as resolved_by_username'
        )
        .orderBy('reports.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedReports = reports.map(report => ({
        id: report.id,
        reporter_id: report.reporter_id,
        reporter_username: report.reporter_username || '未知用户',
        reporter_nickname: report.reporter_nickname || report.reporter_username || '未知用户',
        reported_id: report.reported_id,
        reported_type: report.reported_type,
        reason: report.reason,
        description: report.description,
        status: report.status,
        admin_notes: report.admin_notes,
        evidence_urls: report.evidence_urls ? JSON.parse(report.evidence_urls) : [],
        created_at: report.created_at,
        updated_at: report.updated_at,
        resolved_at: report.resolved_at,
        resolved_by: report.resolved_by_username
      }));

      res.json({
        success: true,
        data: {
          list: processedReports,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取举报列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  static async getReportById(req, res) {
    try {
      const { id } = req.params;

      const report = await db('reports')
        .leftJoin('users as reporter', 'reports.reporter_id', '=', 'reporter.id')
        .leftJoin('users as admin', 'reports.resolved_by', '=', 'admin.id')
        .select(
          'reports.*',
          'reporter.username as reporter_username',
          'reporter.display_name as reporter_nickname',
          'admin.username as resolved_by_username'
        )
        .where('reports.id', id)
        .first();

      if (!report) {
        return res.status(404).json({
          success: false,
          message: '举报不存在'
        });
      }

      // 处理数据格式
      const processedReport = {
        id: report.id,
        reporter_id: report.reporter_id,
        reporter_username: report.reporter_username || '未知用户',
        reporter_nickname: report.reporter_nickname || report.reporter_username || '未知用户',
        reported_id: report.reported_id,
        reported_type: report.reported_type,
        reason: report.reason,
        description: report.description,
        status: report.status,
        admin_notes: report.admin_notes,
        evidence_urls: report.evidence_urls ? JSON.parse(report.evidence_urls) : [],
        created_at: report.created_at,
        updated_at: report.updated_at,
        resolved_at: report.resolved_at,
        resolved_by: report.resolved_by_username
      };

      res.json({
        success: true,
        data: processedReport
      });
    } catch (error) {
      logger.error('获取举报详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  static async updateReport(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      if (!status || !['investigating', 'resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        });
      }

      const report = await db('reports').where('id', id).first();
      if (!report) {
        return res.status(404).json({
          success: false,
          message: '举报不存在'
        });
      }

      const updateData = {
        status,
        admin_notes,
        updated_at: new Date()
      };

      // 如果状态变为已解决或已忽略，记录解决时间和人员
      if (status === 'resolved' || status === 'dismissed') {
        updateData.resolved_at = new Date();
        updateData.resolved_by = req.user.id;
      }

      await db('reports')
        .where('id', id)
        .update(updateData);

      res.json({
        success: true,
        message: '举报状态更新成功'
      });
    } catch (error) {
      logger.error('更新举报状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  static async getReportStats(req, res) {
    try {
      // 获取总统计
      const total = await db('reports').count('* as total').first();
      const pending = await db('reports').where('status', 'pending').count('* as count').first();
      const investigating = await db('reports').where('status', 'investigating').count('* as count').first();
      const resolved = await db('reports').where('status', 'resolved').count('* as count').first();
      const dismissed = await db('reports').where('status', 'dismissed').count('* as count').first();

      // 按类型统计
      const byType = await db('reports')
        .select('reported_type', db.raw('count(*) as count'))
        .groupBy('reported_type');

      const byTypeMap = {};
      byType.forEach(item => {
        byTypeMap[item.reported_type] = parseInt(item.count);
      });

      // 最近7天的趋势
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentTrend = await db('reports')
        .select(db.raw('DATE(created_at) as date'), db.raw('count(*) as count'))
        .where('created_at', '>=', sevenDaysAgo.toISOString())
        .groupBy(db.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      const stats = {
        total: parseInt(total.total),
        pending: parseInt(pending.count),
        investigating: parseInt(investigating.count),
        resolved: parseInt(resolved.count),
        dismissed: parseInt(dismissed.count),
        by_type: byTypeMap,
        recent_trend: recentTrend
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取举报统计失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 其他方法的占位符
  static async createRole(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  static async updateRole(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  static async deleteRole(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  static async getRoleById(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  static async getPermissions(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  static async getPermissionsTree(req, res) {
    res.json({ success: false, message: '功能开发中' });
  }

  // 获取所有广告列表
  static async getAllAds(req, res) {
    try {
      const { current = 1, pageSize = 10, title, user_id, status } = req.query;

      // 构建基础查询条件
      const baseQuery = db('advertisements');
      if (title) {
        baseQuery.where('title', 'ilike', `%${title}%`);
      }
      if (user_id) {
        baseQuery.where('user_id', user_id);
      }
      if (status) {
        baseQuery.where('status', status);
      }

      // 获取总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据，关联用户信息
      const ads = await baseQuery
        .clone()
        .leftJoin('users', 'advertisements.user_id', '=', 'users.id')
        .select(
          'advertisements.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name'
        )
        .orderBy('advertisements.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedAds = ads.map(ad => ({
        id: ad.id,
        user_id: ad.user_id,
        title: ad.title,
        description: ad.description,
        image_url: ad.image_url,
        lat: ad.lat,
        lng: ad.lng,
        grid_id: ad.grid_id,
        width: ad.width,
        height: ad.height,
        start_time: ad.start_time,
        end_time: ad.end_time,
        repeat_count: ad.repeat_count,
        status: ad.status,
        created_at: ad.created_at,
        updated_at: ad.updated_at,
        username: ad.applicant_username,
        nickname: ad.applicant_name || ad.applicant_username
      }));

      res.json({
        success: true,
        data: {
          list: processedAds,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取广告列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取广告详情
  static async getAdById(req, res) {
    try {
      const { id } = req.params;

      const ad = await db('advertisements')
        .leftJoin('users', 'advertisements.user_id', '=', 'users.id')
        .select(
          'advertisements.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name'
        )
        .where('advertisements.id', id)
        .first();

      if (!ad) {
        return res.status(404).json({
          success: false,
          message: '广告不存在'
        });
      }

      // 处理数据格式
      const processedAd = {
        id: ad.id,
        user_id: ad.user_id,
        title: ad.title,
        description: ad.description,
        image_url: ad.image_url,
        lat: ad.lat,
        lng: ad.lng,
        grid_id: ad.grid_id,
        width: ad.width,
        height: ad.height,
        start_time: ad.start_time,
        end_time: ad.end_time,
        repeat_count: ad.repeat_count,
        status: ad.status,
        created_at: ad.created_at,
        updated_at: ad.updated_at,
        username: ad.applicant_username,
        nickname: ad.applicant_name || ad.applicant_username
      };

      res.json({
        success: true,
        data: processedAd
      });
    } catch (error) {
      logger.error('获取广告详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 审批广告
  static async approveAd(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.user.id;

      const ad = await db('advertisements').where('id', id).first();
      if (!ad) {
        return res.status(404).json({
          success: false,
          message: '广告不存在'
        });
      }

      // 引入所需的服务和模型
      const AdProduct = require('../models/AdProduct');
      const UserAdInventory = require('../models/UserAdInventory');
      const AdPlacement = require('../models/AdPlacement');
      const ImageProcessor = require('../services/imageProcessor');
      const AdPixelRenderer = require('../services/AdPixelRenderer');

      // 1. 查找匹配的广告商品 (用于关联库存)
      const allProducts = await AdProduct.getActiveProducts();
      let matchedProduct = allProducts.find(p => p.width === ad.width && p.height === ad.height);

      if (!matchedProduct) {
        // 如果没有精确匹配的尺寸，尝试找一个最接近的或者默认的
        console.warn(`⚠️ 无法找到尺寸为 ${ad.width}x${ad.height} 的广告商品，使用默认商品`);
        matchedProduct = allProducts[0]; // 兜底使用第一个商品
      }

      if (!matchedProduct) {
        throw new Error('系统未配置广告商品，无法处理广告');
      }

      // 2. 处理广告图片
      console.log(`🎨 开始处理广告图片: ${ad.title} (${ad.width}x${ad.height})`);
      const processedResult = await ImageProcessor.processAdImage(
        ad.icon_url,
        ad.width,
        ad.height
      );

      // 3. 创建用户广告库存记录 (作为桥接)
      // 注意：这里我们创建一个已使用的库存记录
      const inventory = await UserAdInventory.create({
        userId: ad.user_id,
        adOrderId: null, // 这个是老系统的广告，没有对应的 ad_order
        adProductId: matchedProduct.id,
        adTitle: ad.title,
        processedImageData: JSON.stringify(processedResult.pixelData),
        width: ad.width,
        height: ad.height
      });
      await inventory.markAsUsed(); // 立即标记为已使用

      // 4. 创建广告放置记录
      const placement = await AdPlacement.create({
        userId: ad.user_id,
        adInventoryId: inventory.id,
        centerLat: ad.lat,
        centerLng: ad.lng,
        width: ad.width,
        height: ad.height,
        pixelData: JSON.stringify(processedResult.pixelData),
        pixelCount: processedResult.pixelCount,
        isActive: true, // 确保激活
        expiresAt: ad.end_time
      });

      console.log(`✅ 广告放置记录创建成功: ${placement.id}`);

      // 5. 触发像素渲染
      setImmediate(async () => {
        try {
          console.log(`🎨 开始异步渲染广告像素: ${placement.id}`);
          await AdPixelRenderer.processAdPlacement(placement.id);
          console.log(`🎉 广告像素渲染完成: ${placement.id}`);
        } catch (error) {
          console.error(`❌ 广告像素渲染失败: ${placement.id}`, error);
        }
      });

      // 6. 更新广告状态
      await db('advertisements')
        .where('id', id)
        .update({
          status: 'approved',
          updated_at: new Date()
        });

      res.json({
        success: true,
        message: '广告审批成功，像素正在渲染中'
      });
    } catch (error) {
      logger.error('审批广告失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误: ' + error.message
      });
    }
  }

  // 拒绝广告
  static async rejectAd(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: '拒绝原因不能为空'
        });
      }

      const ad = await db('advertisements').where('id', id).first();
      if (!ad) {
        return res.status(404).json({
          success: false,
          message: '广告不存在'
        });
      }

      await db('advertisements')
        .where('id', id)
        .update({
          status: 'rejected',
          updated_at: new Date()
        });

      res.json({
        success: true,
        message: '广告拒绝成功'
      });
    } catch (error) {
      logger.error('拒绝广告失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // ========== 自定义联盟旗帜审批功能 ==========

  // 获取待审核的自定义旗帜订单
  static async getPendingCustomFlags(req, res) {
    try {
      const { current = 1, pageSize = 10, pattern_name, user_id } = req.query;

      // 构建基础查询条件
      const baseQuery = db('custom_flag_orders').where('status', 'pending');
      if (pattern_name) {
        baseQuery.where('pattern_name', 'ilike', `%${pattern_name}%`);
      }
      if (user_id) {
        baseQuery.where('user_id', user_id);
      }

      // 获取总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据，关联用户信息
      const orders = await baseQuery
        .clone()
        .leftJoin('users', 'custom_flag_orders.user_id', '=', 'users.id')
        .select(
          'custom_flag_orders.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name',
          'users.avatar_url as applicant_avatar'
        )
        .orderBy('custom_flag_orders.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedOrders = orders.map(order => ({
        id: order.id,
        user_id: order.user_id,
        pattern_name: order.pattern_name,
        pattern_description: order.pattern_description,
        original_image_url: order.original_image_url,
        status: order.status,
        price: order.price,
        admin_notes: order.admin_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        applicantName: order.applicant_name || order.applicant_username || '未知用户',
        applicantAvatar: order.applicant_avatar,
        submittedAt: order.created_at
      }));

      res.json({
        success: true,
        data: {
          list: processedOrders,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取待审核自定义旗帜失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取所有自定义旗帜订单
  static async getAllCustomFlags(req, res) {
    try {
      const { current = 1, pageSize = 10, pattern_name, user_id, status } = req.query;

      // 构建基础查询条件
      const baseQuery = db('custom_flag_orders');
      if (pattern_name) {
        baseQuery.where('pattern_name', 'ilike', `%${pattern_name}%`);
      }
      if (user_id) {
        baseQuery.where('user_id', user_id);
      }
      if (status) {
        baseQuery.where('status', status);
      }

      // 获取总数
      const total = await baseQuery.clone().count('* as total').first();

      // 获取分页数据，关联用户信息
      const orders = await baseQuery
        .clone()
        .leftJoin('users', 'custom_flag_orders.user_id', '=', 'users.id')
        .select(
          'custom_flag_orders.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name',
          'users.avatar_url as applicant_avatar'
        )
        .orderBy('custom_flag_orders.created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedOrders = orders.map(order => ({
        id: order.id,
        user_id: order.user_id,
        pattern_name: order.pattern_name,
        pattern_description: order.pattern_description,
        original_image_url: order.original_image_url,
        status: order.status,
        price: order.price,
        admin_notes: order.admin_notes,
        processed_by: order.processed_by,
        processed_at: order.processed_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        applicantName: order.applicant_name || order.applicant_username || '未知用户',
        applicantAvatar: order.applicant_avatar
      }));

      res.json({
        success: true,
        data: {
          list: processedOrders,
          total: parseInt(total.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取自定义旗帜订单失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取自定义旗帜订单详情
  static async getCustomFlagById(req, res) {
    try {
      const { id } = req.params;

      const order = await db('custom_flag_orders')
        .leftJoin('users', 'custom_flag_orders.user_id', '=', 'users.id')
        .leftJoin('users as admin', 'custom_flag_orders.processed_by', '=', 'admin.id')
        .select(
          'custom_flag_orders.*',
          'users.username as applicant_username',
          'users.display_name as applicant_name',
          'users.avatar_url as applicant_avatar',
          'admin.username as processed_by_username'
        )
        .where('custom_flag_orders.id', id)
        .first();

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '自定义旗帜订单不存在'
        });
      }

      // 处理数据格式
      const processedOrder = {
        id: order.id,
        user_id: order.user_id,
        pattern_name: order.pattern_name,
        pattern_description: order.pattern_description,
        original_image_url: order.original_image_url,
        status: order.status,
        price: order.price,
        admin_notes: order.admin_notes,
        processed_by: order.processed_by,
        processed_by_username: order.processed_by_username,
        processed_at: order.processed_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        applicantName: order.applicant_name || order.applicant_username || '未知用户',
        applicantAvatar: order.applicant_avatar
      };

      res.json({
        success: true,
        data: processedOrder
      });
    } catch (error) {
      logger.error('获取自定义旗帜订单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 批准自定义旗帜订单
  static async approveCustomFlag(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const order = await db('custom_flag_orders').where('id', id).first();
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '自定义旗帜订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `订单状态为${order.status}，无法批准`
        });
      }

      // 调用自定义旗帜处理服务
      const CustomFlagProcessor = require('../services/customFlagProcessor');
      try {
        await CustomFlagProcessor.approveCustomFlag(order.id, req.user.id, notes);

        res.json({
          success: true,
          message: '自定义旗帜批准成功'
        });
      } catch (processError) {
        logger.error('处理自定义旗帜失败:', processError);
        res.status(500).json({
          success: false,
          message: `处理失败: ${processError.message}`
        });
      }
    } catch (error) {
      logger.error('批准自定义旗帜失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 拒绝自定义旗帜订单
  static async rejectCustomFlag(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: '拒绝原因不能为空'
        });
      }

      const order = await db('custom_flag_orders').where('id', id).first();
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '自定义旗帜订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `订单状态为${order.status}，无法拒绝`
        });
      }

      // 调用自定义旗帜处理服务
      const CustomFlagProcessor = require('../services/customFlagProcessor');
      try {
        await CustomFlagProcessor.rejectCustomFlag(order.id, req.user.id, reason);

        res.json({
          success: true,
          message: '自定义旗帜拒绝成功'
        });
      } catch (processError) {
        logger.error('拒绝自定义旗帜失败:', processError);
        res.status(500).json({
          success: false,
          message: `处理失败: ${processError.message}`
        });
      }
    } catch (error) {
      logger.error('拒绝自定义旗帜失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // ========== 商店订单管理功能 ==========

  // 获取所有商店订单（包括广告订单、自定义旗帜订单、充值订单、普通商品订单）
  static async getAllStoreOrders(req, res) {
    try {
      const {
        current = 1,
        pageSize = 10,
        order_type,
        status,
        user_id,
        start_date,
        end_date,
        keyword
      } = req.query;

      // 构建不同类型订单的查询
      const queries = [];
      let total = 0;

      // 1. 广告订单
      if (!order_type || order_type === 'advertisement') {
        let adQuery = db('ad_orders')
          .join('ad_products', 'ad_orders.ad_product_id', '=', 'ad_products.id')
          .join('users', 'ad_orders.user_id', '=', 'users.id')
          .select(
            'ad_orders.id',
            'ad_orders.user_id',
            'ad_orders.ad_title as title',
            'ad_orders.ad_description as description',
            'ad_orders.status',
            'ad_orders.price',
            'ad_orders.created_at',
            'ad_orders.updated_at',
            'ad_orders.processed_at',
            'ad_orders.admin_notes',
            'ad_products.name as product_name',
            'ad_products.width',
            'ad_products.height',
            'users.username as user_username',
            'users.display_name as user_nickname',
            db.raw("'advertisement' as order_type")
          );

        if (status) adQuery.where('ad_orders.status', status);
        if (user_id) adQuery.where('ad_orders.user_id', user_id);
        if (start_date) adQuery.where('ad_orders.created_at', '>=', start_date);
        if (end_date) adQuery.where('ad_orders.created_at', '<=', end_date);
        if (keyword) {
          adQuery.where(function () {
            this.where('ad_orders.ad_title', 'ilike', `%${keyword}%`)
              .orWhere('users.username', 'ilike', `%${keyword}%`)
              .orWhere('users.display_name', 'ilike', `%${keyword}%`);
          });
        }

        const adOrders = await adQuery;
        queries.push(...adOrders);
      }

      // 2. 自定义旗帜订单
      if (!order_type || order_type === 'custom_flag') {
        let flagQuery = db('custom_flag_orders')
          .join('users', 'custom_flag_orders.user_id', '=', 'users.id')
          .select(
            'custom_flag_orders.id',
            'custom_flag_orders.user_id',
            'custom_flag_orders.pattern_name as title',
            'custom_flag_orders.pattern_description as description',
            'custom_flag_orders.status',
            'custom_flag_orders.price',
            'custom_flag_orders.created_at',
            'custom_flag_orders.updated_at',
            'custom_flag_orders.processed_at',
            'custom_flag_orders.admin_notes',
            db.raw("'自定义旗帜' as product_name"),
            db.raw("0 as width"),
            db.raw("0 as height"),
            'users.username as user_username',
            'users.display_name as user_nickname',
            db.raw("'custom_flag' as order_type")
          );

        if (status) flagQuery.where('custom_flag_orders.status', status);
        if (user_id) flagQuery.where('custom_flag_orders.user_id', user_id);
        if (start_date) flagQuery.where('custom_flag_orders.created_at', '>=', start_date);
        if (end_date) flagQuery.where('custom_flag_orders.created_at', '<=', end_date);
        if (keyword) {
          flagQuery.where(function () {
            this.where('custom_flag_orders.pattern_name', 'ilike', `%${keyword}%`)
              .orWhere('users.username', 'ilike', `%${keyword}%`)
              .orWhere('users.display_name', 'ilike', `%${keyword}%`);
          });
        }

        const flagOrders = await flagQuery;
        queries.push(...flagOrders);
      }

      // 3. 充值订单
      if (!order_type || order_type === 'recharge') {
        let rechargeQuery = db('recharge_orders')
          .join('users', 'recharge_orders.user_id', '=', 'users.id')
          .select(
            'recharge_orders.id',
            'recharge_orders.user_id',
            db.raw("'充值' as title"),
            db.raw("'' as description"),
            'recharge_orders.status',
            db.raw("recharge_orders.amount_rmb as price"),
            'recharge_orders.created_at',
            db.raw("null as updated_at"),
            'recharge_orders.paid_at as processed_at',
            'recharge_orders.idempotency_key as admin_notes',
            db.raw("'充值订单' as product_name"),
            db.raw("0 as width"),
            db.raw("0 as height"),
            'users.username as user_username',
            'users.display_name as user_nickname',
            db.raw("'recharge' as order_type")
          );

        if (status) rechargeQuery.where('recharge_orders.status', status);
        if (user_id) rechargeQuery.where('recharge_orders.user_id', user_id);
        if (start_date) rechargeQuery.where('recharge_orders.created_at', '>=', start_date);
        if (end_date) rechargeQuery.where('recharge_orders.created_at', '<=', end_date);
        if (keyword) {
          rechargeQuery.where(function () {
            this.where('users.username', 'ilike', `%${keyword}%`)
              .orWhere('users.display_name', 'ilike', `%${keyword}%`);
          });
        }

        const rechargeOrders = await rechargeQuery;
        queries.push(...rechargeOrders);
      }

      // 合并和排序
      const allOrders = queries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      total = allOrders.length;

      // 分页
      const startIndex = (current - 1) * pageSize;
      const endIndex = startIndex + parseInt(pageSize);
      const paginatedOrders = allOrders.slice(startIndex, endIndex);

      // 格式化数据
      const processedOrders = paginatedOrders.map(order => ({
        id: order.id,
        user_id: order.user_id,
        title: order.title,
        description: order.description,
        status: order.status,
        price: order.price,
        product_name: order.product_name,
        width: order.width,
        height: order.height,
        order_type: order.order_type,
        user_username: order.user_username,
        user_nickname: order.user_nickname,
        created_at: order.created_at,
        updated_at: order.updated_at,
        processed_at: order.processed_at,
        admin_notes: order.admin_notes
      }));

      res.json({
        success: true,
        data: {
          list: processedOrders,
          total: total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取商店订单失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误: ' + error.message,
        stack: error.stack
      });
    }
  }

  // 获取订单详情
  static async getStoreOrderById(req, res) {
    try {
      const { id } = req.params;
      const { order_type } = req.query;

      let order = null;

      // 根据订单类型查询
      switch (order_type) {
        case 'advertisement':
          order = await db('ad_orders')
            .join('ad_products', 'ad_orders.ad_product_id', '=', 'ad_products.id')
            .join('users', 'ad_orders.user_id', '=', 'users.id')
            .select(
              'ad_orders.*',
              'ad_products.name as product_name',
              'ad_products.width',
              'ad_products.height',
              'users.username as user_username',
              'users.display_name as user_nickname',
              'users.avatar_url as user_avatar'
            )
            .where('ad_orders.id', id)
            .first();

          if (order) {
            order = {
              ...order,
              order_type: 'advertisement'
            };
          }
          break;

        case 'custom_flag':
          order = await db('custom_flag_orders')
            .join('users', 'custom_flag_orders.user_id', '=', 'users.id')
            .select(
              'custom_flag_orders.*',
              'users.username as user_username',
              'users.display_name as user_nickname',
              'users.avatar_url as user_avatar'
            )
            .where('custom_flag_orders.id', id)
            .first();

          if (order) {
            order = {
              ...order,
              order_type: 'custom_flag'
            };
          }
          break;

        case 'recharge':
          order = await db('recharge_orders')
            .join('users', 'recharge_orders.user_id', '=', 'users.id')
            .select(
              'recharge_orders.*',
              'users.username as user_username',
              'users.display_name as user_nickname',
              'users.avatar_url as user_avatar'
            )
            .where('recharge_orders.id', id)
            .first();

          if (order) {
            order = {
              ...order,
              order_type: 'recharge'
            };
          }
          break;

        default:
          // 自动检测订单类型
          order = await db('ad_orders')
            .join('users', 'ad_orders.user_id', '=', 'users.id')
            .select('ad_orders.*', 'users.username as user_username', 'users.display_name as user_nickname')
            .where('ad_orders.id', id)
            .first();

          if (order) {
            order.order_type = 'advertisement';
          } else {
            order = await db('custom_flag_orders')
              .join('users', 'custom_flag_orders.user_id', '=', 'users.id')
              .select('custom_flag_orders.*', 'users.username as user_username', 'users.display_name as user_nickname')
              .where('custom_flag_orders.id', id)
              .first();

            if (order) {
              order.order_type = 'custom_flag';
            } else {
              order = await db('recharge_orders')
                .join('users', 'recharge_orders.user_id', '=', 'users.id')
                .select('recharge_orders.*', 'users.username as user_username', 'users.display_name as user_nickname')
                .where('recharge_orders.id', id)
                .first();

              if (order) {
                order.order_type = 'recharge';
              }
            }
          }
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      logger.error('获取订单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 更新订单状态（管理员操作）
  static async updateStoreOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { order_type, status, admin_notes } = req.body;

      if (!order_type || !status) {
        return res.status(400).json({
          success: false,
          message: '订单类型和状态不能为空'
        });
      }

      const updateData = {
        status,
        updated_at: new Date()
      };

      if (admin_notes) {
        updateData.admin_notes = admin_notes;
      }

      // 根据订单类型更新
      let tableName = '';
      switch (order_type) {
        case 'advertisement':
          tableName = 'ad_orders';
          break;
        case 'custom_flag':
          tableName = 'custom_flag_orders';
          break;
        case 'recharge':
          tableName = 'recharge_orders';
          break;
        default:
          return res.status(400).json({
            success: false,
            message: '无效的订单类型'
          });
      }

      // 检查订单是否存在
      const order = await db(tableName).where('id', id).first();
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      // 添加处理人员信息
      updateData.processed_by = req.user.id;
      updateData.processed_at = new Date();

      await db(tableName)
        .where('id', id)
        .update(updateData);

      res.json({
        success: true,
        message: '订单状态更新成功'
      });
    } catch (error) {
      logger.error('更新订单状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // ========== 数据统计和分析功能 ==========

  // 获取综合统计数据
  static async getComprehensiveStats(req, res) {
    try {
      const { period = '7d' } = req.query;

      // 计算时间范围
      let startDate = new Date();
      switch (period) {
        case '1d':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const startDateStr = startDate.toISOString();

      // 并行获取各种统计数据
      const [
        userStats,
        pixelStats,
        orderStats,
        adStats,
        flagStats,
        revenueStats
      ] = await Promise.all([
        AdminController.getUserStats(startDateStr),
        AdminController.getPixelStats(startDateStr),
        AdminController.getOrderStats(startDateStr),
        AdminController.getAdStats(startDateStr),
        AdminController.getCustomFlagStats(startDateStr),
        AdminController.getRevenueStats(startDateStr)
      ]);

      const comprehensiveStats = {
        period,
        startDate: startDateStr,
        endDate: new Date().toISOString(),
        users: userStats,
        pixels: pixelStats,
        orders: orderStats,
        advertisements: adStats,
        customFlags: flagStats,
        revenue: revenueStats
      };

      res.json({
        success: true,
        data: comprehensiveStats
      });
    } catch (error) {
      logger.error('获取综合统计数据失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取用户统计数据
  static async getUserStats(startDate) {
    const [totalUsers, newUsers, activeUsers, bannedUsers] = await Promise.all([
      db('users').count('* as count').first(),
      db('users').where('created_at', '>=', startDate).count('* as count').first(),
      db('users').where('last_login', '>=', startDate).count('* as count').first(),
      db('users').where('is_banned', true).count('* as count').first()
    ]);

    return {
      total: parseInt(totalUsers.count) || 0,
      new: parseInt(newUsers.count) || 0,
      active: parseInt(activeUsers.count) || 0,
      banned: parseInt(bannedUsers.count) || 0
    };
  }

  // 获取像素统计数据
  static async getPixelStats(startDate) {
    const [totalPixels, newPixels] = await Promise.all([
      db('pixels').count('* as count').first(),
      db('pixels').where('created_at', '>=', startDate).count('* as count').first()
    ]);

    return {
      total: parseInt(totalPixels.count) || 0,
      new: parseInt(newPixels.count) || 0
    };
  }

  // 获取订单统计数据
  static async getOrderStats(startDate) {
    const queries = [
      db('ad_orders').where('created_at', '>=', startDate).count('* as count').first(),
      db('custom_flag_orders').where('created_at', '>=', startDate).count('* as count').first(),
      db('recharge_orders').where('created_at', '>=', startDate).count('* as count').first(),
      db('ad_orders').where('created_at', '>=', startDate).sum('price as total').first(),
      db('custom_flag_orders').where('created_at', '>=', startDate).sum('price as total').first(),
      db('recharge_orders').where('created_at', '>=', startDate).sum('amount_rmb as total').first()
    ];

    const [
      adOrders, flagOrders, rechargeOrders,
      adRevenue, flagRevenue, rechargeRevenue
    ] = await Promise.all(queries);

    return {
      total: {
        advertisement: parseInt(adOrders.count) || 0,
        customFlag: parseInt(flagOrders.count) || 0,
        recharge: parseInt(rechargeOrders.count) || 0
      },
      revenue: {
        advertisement: parseFloat(adRevenue.total) || 0,
        customFlag: parseFloat(flagRevenue.total) || 0,
        recharge: parseFloat(rechargeRevenue.total) || 0
      }
    };
  }

  // 获取广告统计数据
  static async getAdStats(startDate) {
    const [pendingAds, approvedAds, rejectedAds, totalAds] = await Promise.all([
      db('ad_orders').where('status', 'pending').where('created_at', '>=', startDate).count('* as count').first(),
      db('ad_orders').where('status', 'approved').where('created_at', '>=', startDate).count('* as count').first(),
      db('ad_orders').where('status', 'rejected').where('created_at', '>=', startDate).count('* as count').first(),
      db('ad_orders').where('created_at', '>=', startDate).count('* as count').first()
    ]);

    return {
      pending: parseInt(pendingAds.count) || 0,
      approved: parseInt(approvedAds.count) || 0,
      rejected: parseInt(rejectedAds.count) || 0,
      total: parseInt(totalAds.count) || 0,
      approvalRate: totalAds.count > 0 ? ((parseInt(approvedAds.count) / parseInt(totalAds.count)) * 100).toFixed(2) : 0
    };
  }

  // 获取自定义旗帜统计数据
  static async getCustomFlagStats(startDate) {
    const [pendingFlags, approvedFlags, rejectedFlags, totalFlags] = await Promise.all([
      db('custom_flag_orders').where('status', 'pending').where('created_at', '>=', startDate).count('* as count').first(),
      db('custom_flag_orders').where('status', 'approved').where('created_at', '>=', startDate).count('* as count').first(),
      db('custom_flag_orders').where('status', 'rejected').where('created_at', '>=', startDate).count('* as count').first(),
      db('custom_flag_orders').where('created_at', '>=', startDate).count('* as count').first()
    ]);

    return {
      pending: parseInt(pendingFlags.count) || 0,
      approved: parseInt(approvedFlags.count) || 0,
      rejected: parseInt(rejectedFlags.count) || 0,
      total: parseInt(totalFlags.count) || 0,
      approvalRate: totalFlags.count > 0 ? ((parseInt(approvedFlags.count) / parseInt(totalFlags.count)) * 100).toFixed(2) : 0
    };
  }

  // 获取收入统计数据
  static async getRevenueStats(startDate) {
    const queries = [
      db('recharge_orders').where('status', 'paid').where('paid_at', '>=', startDate).sum('amount_rmb as total').first(),
      db('recharge_orders').where('status', 'paid').where('paid_at', '>=', startDate).count('* as count').first(),
      db('ad_orders').where('status', 'approved').where('created_at', '>=', startDate).sum('price as total').first(),
      db('custom_flag_orders').where('status', 'approved').where('created_at', '>=', startDate).sum('price as total').first()
    ];

    const [rechargeTotal, rechargeCount, adRevenue, flagRevenue] = await Promise.all(queries);

    return {
      recharge: {
        total: parseFloat(rechargeTotal.total) || 0,
        count: parseInt(rechargeCount.count) || 0
      },
      orders: {
        advertisement: parseFloat(adRevenue.total) || 0,
        customFlag: parseFloat(flagRevenue.total) || 0
      },
      total: (parseFloat(rechargeTotal.total) || 0) + (parseFloat(adRevenue.total) || 0) + (parseFloat(flagRevenue.total) || 0)
    };
  }

  // 获取趋势数据（按天统计）
  static async getTrendStats(req, res) {
    try {
      const { period = '7d', type = 'orders' } = req.query;

      // 计算时间范围
      let days = 7;
      switch (period) {
        case '1d': days = 1; break;
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '90d': days = 90; break;
      }

      const trendData = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const startDate = new Date(dateStr + 'T00:00:00.000Z');
        const endDate = new Date(dateStr + 'T23:59:59.999Z');

        let count = 0;
        let total = 0;

        switch (type) {
          case 'orders':
            const [orderCount, orderTotal] = await Promise.all([
              db('ad_orders').where('created_at', '>=', startDate).where('created_at', '<=', endDate).count('* as count').first(),
              db('custom_flag_orders').where('created_at', '>=', startDate).where('created_at', '<=', endDate).count('* as count').first()
            ]);
            count = (parseInt(orderCount.count) || 0) + (parseInt(orderTotal.count) || 0);
            break;
          case 'revenue':
            const [revenueData] = await Promise.all([
              db('recharge_orders').where('paid_at', '>=', startDate).where('paid_at', '<=', endDate).sum('amount_rmb as total').first()
            ]);
            total = parseFloat(revenueData.total) || 0;
            break;
          case 'users':
            const [userCount] = await Promise.all([
              db('users').where('created_at', '>=', startDate).where('created_at', '<=', endDate).count('* as count').first()
            ]);
            count = parseInt(userCount.count) || 0;
            break;
          case 'pixels':
            const [pixelCount] = await Promise.all([
              db('pixels').where('created_at', '>=', startDate).where('created_at', '<=', endDate).count('* as count').first()
            ]);
            count = parseInt(pixelCount.count) || 0;
            break;
        }

        trendData.push({
          date: dateStr,
          count,
          total
        });
      }

      res.json({
        success: true,
        data: {
          period,
          type,
          trendData
        }
      });
    } catch (error) {
      logger.error('获取趋势数据失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取封禁用户数量
  static async getBannedUsersCount(req, res) {
    try {
      const bannedCount = await db('users')
        .where('is_banned', true)
        .count('* as count')
        .first();

      res.json({
        success: true,
        data: {
          bannedUsers: parseInt(bannedCount.count) || 0
        }
      });
    } catch (error) {
      logger.error('获取封禁用户数量失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误: ' + error.message,
        stack: error.stack,
        details: JSON.stringify(error)
      });
    }
  }

  // 获取热门商品统计
  static async getPopularProducts(req, res) {
    try {
      const { period = '30d', limit = 10 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      const startDateStr = startDate.toISOString();

      // 获取热门广告商品
      const popularAds = await db('ad_orders')
        .join('ad_products', 'ad_orders.ad_product_id', '=', 'ad_products.id')
        .where('ad_orders.created_at', '>=', startDateStr)
        .select(
          'ad_products.id',
          'ad_products.name',
          'ad_products.price',
          db.raw('COUNT(ad_orders.id) as order_count'),
          db.raw('SUM(ad_orders.price) as total_revenue')
        )
        .groupBy('ad_products.id', 'ad_products.name', 'ad_products.price')
        .orderBy('order_count', 'desc')
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: {
          period,
          popularAds: popularAds.map(ad => ({
            id: ad.id,
            name: ad.name,
            price: parseFloat(ad.price) || 0,
            orderCount: parseInt(ad.order_count) || 0,
            totalRevenue: parseFloat(ad.total_revenue) || 0,
            type: 'advertisement'
          }))
        }
      });
    } catch (error) {
      logger.error('获取热门商品统计失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // 获取系统日志
  static async getSystemLogs(req, res) {
    try {
      const { current, pageSize, level, module, start_date, end_date } = req.query;
      const result = await SystemLog.find({
        current: parseInt(current) || 1,
        pageSize: parseInt(pageSize) || 20,
        level,
        module,
        start_date,
        end_date
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getSystemLogs:', error);
      res.status(500).json({ success: false, message: '获取系统日志失败' });
    }
  }

  // 获取系统运行时指标
  static async getSystemMetrics(req, res) {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = Math.round((usedMem / totalMem) * 100);

      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      // 简单模拟CPU使用率，基于 loadAvg
      const cpuUsage = Math.round((loadAvg[0] / cpus.length) * 100);

      res.json({
        success: true,
        data: {
          cpu_usage: Math.min(cpuUsage, 100),
          memory_usage: memUsage,
          disk_usage: 45, // 模拟值
          network_in: parseFloat((Math.random() * 10).toFixed(2)),
          network_out: parseFloat((Math.random() * 5).toFixed(2)),
          active_connections: Math.floor(Math.random() * 200) + 50,
          database_connections: Math.floor(Math.random() * 20) + 5,
          response_time: Math.floor(Math.random() * 100) + 20,
          uptime: Math.floor(os.uptime()),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in getSystemMetrics:', error);
      res.status(500).json({ success: false, message: '获取系统指标失败' });
    }
  }
  // 批量分析图案
  static async analyzePattern(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传图片文件' });
      }

      // 1. Process image using sharp (Resize and convert to Base64)
      // Mirroring logic from CustomFlagProcessor.approveCustomFlag
      const imageBuffer = req.file.buffer;
      const metadata = await sharp(imageBuffer).metadata();

      const maxSize = 512;
      const minSize = 16;
      let targetWidth = metadata.width;
      let targetHeight = metadata.height;

      // Resize if necessary
      if (metadata.width > maxSize || metadata.height > maxSize || metadata.width < minSize || metadata.height < minSize) {
        const targetSize = Math.min(maxSize, 256); // Default target for optimization
        if (metadata.width > targetSize || metadata.height > targetSize) {
          const scale = Math.min(targetSize / metadata.width, targetSize / metadata.height);
          targetWidth = Math.round(metadata.width * scale);
          targetHeight = Math.round(metadata.height * scale);
        } else if (metadata.width < minSize || metadata.height < minSize) {
          const scale = Math.max(minSize / metadata.width, minSize / metadata.height);
          targetWidth = Math.round(metadata.width * scale);
          targetHeight = Math.round(metadata.height * scale);
        }
      }

      const resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();

      const base64Data = `data:image/png;base64,${resizedBuffer.toString('base64')}`;

      // 2. Extract simple metadata (colors, complexity) - could use CustomFlagProcessor if needed
      // For bulk import, we trust the resize and base64 are sufficient for "complex" type
      const stats = await sharp(resizedBuffer).stats();
      const dominantColor = stats.dominant ? { r: stats.dominant.r, g: stats.dominant.g, b: stats.dominant.b } : { r: 0, g: 0, b: 0 };
      const hexColor = `#${((1 << 24) + (dominantColor.r << 16) + (dominantColor.g << 8) + dominantColor.b).toString(16).slice(1)}`;

      // Calculate logical size (max 64x64) for PatternAsset
      const maxLogicalSize = 64;
      let logicalWidth = 64;
      let logicalHeight = 64;
      if (metadata.width >= metadata.height) {
        logicalWidth = maxLogicalSize;
        logicalHeight = Math.round(maxLogicalSize * (metadata.height / metadata.width));
      } else {
        logicalHeight = maxLogicalSize;
        logicalWidth = Math.round(maxLogicalSize * (metadata.width / metadata.height));
      }
      // Ensure at least 1
      logicalWidth = Math.max(1, logicalWidth);
      logicalHeight = Math.max(1, logicalHeight);

      res.json({
        success: true,
        data: {
          width: logicalWidth, // Use logical size for PatternAsset
          height: logicalHeight,
          physicalWidth: targetWidth,
          physicalHeight: targetHeight,
          processedImageUrl: base64Data, // This is now a Data URL
          base64: base64Data,
          metadata: {
            dominantColors: [hexColor],
            imageAnalysis: { style: 'pixelated' } // Default to pixelated/complex for now
          }
        }
      });
    } catch (error) {
      logger.error('分析图案失败:', error);
      res.status(500).json({ success: false, message: '分析失败: ' + error.message });
    }
  }

  // 批量创建图案
  static async batchCreatePatterns(req, res) {
    try {
      const { patterns } = req.body;
      const userId = req.user.id;

      if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
        return res.status(400).json({
          success: false,
          message: '图案列表不能为空'
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const patternData of patterns) {
        try {
          await PatternAsset.create({
            ...patternData,
            created_by: userId,
            verified: true // Admin created patterns are auto-verified
          });
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({
            name: patternData.name,
            error: err.message
          });
        }
      }

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('批量创建图案失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  // ===== Audit Log Methods =====

  static async getAuditLogs(req, res) {
    try {
      const result = await AdminAuditLog.find(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAuditLogStats(req, res) {
    try {
      const stats = await AdminAuditLog.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Get audit log stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AdminController;