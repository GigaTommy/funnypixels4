const { db } = require('../config/database');

class Alliance {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.color = data.color;
    this.flag_payload = data.flag_payload;
    this.banner_url = data.banner_url;
    this.notice = data.notice; // Alliance Notification
    this.flag_type = data.flag_type;
    this.flag_color = data.flag_color;
    this.flag_pattern_id = data.flag_pattern_id;
    this.flag_unicode_char = data.flag_unicode_char;
    this.flag_render_type = data.flag_render_type;
    this.flag_pattern_anchor_x = data.flag_pattern_anchor_x;
    this.flag_pattern_anchor_y = data.flag_pattern_anchor_y;
    this.flag_pattern_rotation = data.flag_pattern_rotation;
    this.flag_pattern_mirror = data.flag_pattern_mirror;
    this.approval_required = data.approval_required !== undefined ? data.approval_required : true;
    this.leader_id = data.leader_id;
    this.member_count = data.member_count;
    this.max_members = data.max_members || 50;
    this.is_public = data.is_public;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建联盟
  static async create(allianceData) {
    const {
      name,
      description,
      flagPatternId,
      notice,
      leader_id,
      is_public = true,
      approval_required = true
    } = allianceData;

    try {
      const result = await db.transaction(async (trx) => {
        // 检查是否是基础颜色、emoji图案或自定义图案
        const isBasicColor = flagPatternId && flagPatternId.startsWith('color_');
        const isEmojiPattern = flagPatternId && flagPatternId.startsWith('emoji_');
        const isAlliancePattern = flagPatternId && flagPatternId.startsWith('alliance_');
        const isCustomPattern = flagPatternId && flagPatternId.startsWith('custom_');

        // 获取UNICODE编码信息和payload
        let flagUnicodeChar = null;
        let flagRenderType = 'complex';
        let flagPayload = null;

        if (isBasicColor || isEmojiPattern || isAlliancePattern || isCustomPattern) {
          // 从pattern_assets表获取UNICODE信息、render_type和payload（使用key字段）
          const patternAsset = await trx('pattern_assets')
            .where('key', flagPatternId)
            .select('unicode_char', 'render_type', 'payload')
            .first();

          if (patternAsset) {
            flagUnicodeChar = patternAsset.unicode_char;
            flagRenderType = patternAsset.render_type || 'complex';
            flagPayload = patternAsset.payload;
            console.log(`✅ 获取到图案信息: ${flagPatternId} -> unicode=${flagUnicodeChar}, type=${flagRenderType}, hasPayload=${!!flagPayload}`);
          } else {
            console.warn(`⚠️ 未找到图案信息: ${flagPatternId}`);
          }
        } else {
          // 对于其他图案（可能是整数ID），尝试获取UNICODE信息
          const patternAsset = await trx('pattern_assets')
            .where('id', flagPatternId)
            .select('unicode_char', 'render_type', 'payload')
            .first();

          if (patternAsset) {
            flagUnicodeChar = patternAsset.unicode_char;
            flagRenderType = patternAsset.render_type || 'complex';
            flagPayload = patternAsset.payload;
            console.log(`✅ 获取到复杂图案信息: ${flagPatternId} -> unicode=${flagUnicodeChar}, type=${flagRenderType}, hasPayload=${!!flagPayload}`);
          }
        }

        // 准备联盟数据
        const allianceData = {
          name,
          description,
          notice,
          flag_pattern_id: flagPatternId,
          flag_unicode_char: flagUnicodeChar,
          flag_render_type: flagRenderType,
          flag_payload: flagPayload,  // 保存payload，用于渲染complex图案
          leader_id,
          member_count: 1, // 初始包含盟主
          is_public,
          approval_required,
          // 设置默认锚点和变换
          flag_pattern_anchor_x: 0,
          flag_pattern_anchor_y: 0,
          flag_pattern_rotation: 0,
          flag_pattern_mirror: false
        };

        // 创建联盟
        const [alliance] = await trx('alliances')
          .insert(allianceData)
          .returning('*');

        // 添加创建者为盟主
        await trx('alliance_members').insert({
          alliance_id: alliance.id,
          user_id: leader_id,
          role: 'leader'
        });

        return alliance;
      });

      return new Alliance(result);
    } catch (error) {
      throw error;
    }
  }

  // 根据ID获取联盟
  static async findById(id) {
    try {
      const alliance = await db('alliances')
        .where('id', id)
        .where('is_active', true)
        .first();

      return alliance ? new Alliance(alliance) : null;
    } catch (error) {
      throw error;
    }
  }

  // 根据名称获取联盟
  static async findByName(name) {
    try {
      const alliance = await db('alliances')
        .where('name', name)
        .where('is_active', true)
        .first();

      return alliance ? new Alliance(alliance) : null;
    } catch (error) {
      throw error;
    }
  }

  // 搜索联盟
  static async search(query, limit = 20, offset = 0) {
    try {
      const alliances = await db('alliances')
        .where('is_public', true)
        .where('is_active', true)
        .where(function () {
          this.where('name', 'ilike', `%${query}%`)
            .orWhere('description', 'ilike', `%${query}%`);
        })
        .orderBy('member_count', 'desc')
        .limit(limit)
        .offset(offset);

      return alliances.map(alliance => new Alliance(alliance));
    } catch (error) {
      throw error;
    }
  }

  // 获取联盟成员
  async getMembers() {
    try {
      const members = await db('alliance_members')
        .join('users', 'alliance_members.user_id', 'users.id')
        .where('alliance_members.alliance_id', this.id)
        .select(
          'alliance_members.*',
          'users.username',
          'users.avatar_url'
        )
        .orderBy('alliance_members.role', 'desc')
        .orderBy('alliance_members.joined_at', 'asc');

      return members;
    } catch (error) {
      throw error;
    }
  }

  // 检查用户是否为联盟成员
  async isMember(userId) {
    try {
      const member = await db('alliance_members')
        .where('alliance_id', this.id)
        .where('user_id', userId)
        .first();

      return !!member;
    } catch (error) {
      throw error;
    }
  }

  // 获取用户角色
  async getUserRole(userId) {
    try {
      const member = await db('alliance_members')
        .where('alliance_id', this.id)
        .where('user_id', userId)
        .first();

      return member ? member.role : null;
    } catch (error) {
      throw error;
    }
  }

  // 添加成员
  async addMember(userId, role = 'member') {
    try {
      const result = await db.transaction(async (trx) => {

        // 允许用户加入多个联盟
        /*
        // 检查用户是否已在其他联盟
        const existingMember = await trx('alliance_members')
          .where('user_id', userId)
          .first();

        if (existingMember) {
          throw new Error('用户已在其他联盟中');
        }
        */

        // 检查联盟是否已满
        if (this.member_count >= this.max_members) {
          throw new Error('联盟成员已满');
        }

        // 添加成员
        await trx('alliance_members').insert({
          alliance_id: this.id,
          user_id: userId,
          role
        });

        // 更新成员数量
        await trx('alliances')
          .where('id', this.id)
          .increment('member_count', 1);
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 移除成员
  async removeMember(userId) {
    try {
      const result = await db.transaction(async (trx) => {
        // 检查是否为盟主
        const member = await trx('alliance_members')
          .where('alliance_id', this.id)
          .where('user_id', userId)
          .first();

        if (!member) {
          throw new Error('用户不是联盟成员');
        }

        if (member.role === 'leader') {
          throw new Error('不能移除盟主，请先转让盟主');
        }

        // 移除成员
        await trx('alliance_members')
          .where('alliance_id', this.id)
          .where('user_id', userId)
          .del();

        // 更新成员数量
        await trx('alliances')
          .where('id', this.id)
          .decrement('member_count', 1);
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 转让盟主
  async transferLeadership(newLeaderId) {
    try {
      const result = await db.transaction(async (trx) => {
        // 检查新盟主是否为联盟成员
        const newLeader = await trx('alliance_members')
          .where('alliance_id', this.id)
          .where('user_id', newLeaderId)
          .first();

        if (!newLeader) {
          throw new Error('新盟主必须是联盟成员');
        }

        // 更新原盟主角色
        await trx('alliance_members')
          .where('alliance_id', this.id)
          .where('role', 'leader')
          .update({ role: 'member' });

        // 更新新盟主角色
        await trx('alliance_members')
          .where('alliance_id', this.id)
          .where('user_id', newLeaderId)
          .update({ role: 'leader' });

        // 更新联盟表
        await trx('alliances')
          .where('id', this.id)
          .update({ leader_id: newLeaderId });
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 更新联盟信息
  async update(updateData) {
    try {
      const allowedFields = ['name', 'description', 'notice', 'color', 'banner_url', 'flag_pattern_id', 'is_public', 'approval_required'];
      const filteredData = {};

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      // 🆕 如果更新了旗帜图案，需要同时更新相关的渲染字段
      if (filteredData.flag_pattern_id) {
        const flagPatternId = String(filteredData.flag_pattern_id);

        // 检查是否是基础颜色、emoji图案或自定义图案
        const isBasicColor = flagPatternId.startsWith('color_');
        const isEmojiPattern = flagPatternId.startsWith('emoji_');
        const isAlliancePattern = flagPatternId.startsWith('alliance_');
        const isCustomPattern = flagPatternId.startsWith('custom_');

        // 获取UNICODE编码信息和payload
        let flagUnicodeChar = null;
        let flagRenderType = 'complex';
        let flagPayload = null;

        if (isBasicColor || isEmojiPattern || isAlliancePattern || isCustomPattern) {
          // 从pattern_assets表获取UNICODE信息、render_type和payload（使用key字段）
          const patternAsset = await db('pattern_assets')
            .where('key', flagPatternId)
            .select('unicode_char', 'render_type', 'payload')
            .first();

          if (patternAsset) {
            flagUnicodeChar = patternAsset.unicode_char;
            flagRenderType = patternAsset.render_type;
            flagPayload = patternAsset.payload;

            // 如果数据库中没指定 render_type，根据前缀推断
            if (!flagRenderType) {
              if (isBasicColor) flagRenderType = 'color';
              else if (isEmojiPattern) flagRenderType = 'emoji';
              else flagRenderType = 'complex';
            }

            console.log(`✅ 更新旗帜图案信息: ${flagPatternId} -> unicode=${flagUnicodeChar}, type=${flagRenderType}, hasPayload=${!!flagPayload}`);
          } else {
            console.warn(`⚠️ 未找到图案信息: ${flagPatternId}`);
            // 尝试根据前缀设置默认值，避免完全损坏
            if (isBasicColor) flagRenderType = 'color';
            else if (isEmojiPattern) flagRenderType = 'emoji';
            else flagRenderType = 'complex';
          }
        } else {
          // 对于其他图案（可能是整数ID），尝试获取UNICODE信息
          const patternAsset = await db('pattern_assets')
            .where('id', flagPatternId)
            .select('unicode_char', 'render_type', 'payload')
            .first();

          if (patternAsset) {
            flagUnicodeChar = patternAsset.unicode_char;
            flagRenderType = patternAsset.render_type;
            flagPayload = patternAsset.payload;

            if (!flagRenderType && flagPayload) {
              flagRenderType = 'complex';
            }

            console.log(`✅ 更新复杂图案信息: ${flagPatternId} -> unicode=${flagUnicodeChar}, type=${flagRenderType}, hasPayload=${!!flagPayload}`);
          }
        }

        // 添加旗帜渲染相关字段到更新数据
        filteredData.flag_unicode_char = flagUnicodeChar;
        filteredData.flag_render_type = flagRenderType;
        filteredData.flag_payload = flagPayload;
      }

      const [updated] = await db('alliances')
        .where('id', this.id)
        .update(filteredData)
        .returning('*');

      Object.assign(this, updated);

      // 广播联盟更新到所有在线用户
      try {
        const socketManager = require('./socketManagerInstance');
        if (socketManager && socketManager.broadcastAllianceUpdate) {
          await socketManager.broadcastAllianceUpdate(this.id, filteredData);
        }
      } catch (socketError) {
        console.error('广播联盟更新失败:', socketError);
        // 不影响主流程
      }

      return this;
    } catch (error) {
      throw error;
    }
  }

  // 解散联盟
  async disband() {
    try {
      const result = await db.transaction(async (trx) => {
        // 移除所有成员
        await trx('alliance_members')
          .where('alliance_id', this.id)
          .del();

        // 删除联盟
        await trx('alliances')
          .where('id', this.id)
          .del();
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 获取用户所属联盟
  static async getUserAlliance(userId) {
    try {
      const alliance = await db('alliances')
        .join('alliance_members', 'alliances.id', 'alliance_members.alliance_id')
        .where('alliance_members.user_id', userId)
        .where('alliances.is_active', true)
        .select('alliances.*')
        .first();

      return alliance ? new Alliance(alliance) : null;
    } catch (error) {
      throw error;
    }
  }

  // 获取用户所有所属联盟
  static async getUserAlliances(userId) {
    try {
      const alliances = await db('alliances')
        .join('alliance_members', 'alliances.id', 'alliance_members.alliance_id')
        .where('alliance_members.user_id', userId)
        .where('alliances.is_active', true)
        .select(
          'alliances.*',
          'alliance_members.role as user_role',
          'alliance_members.joined_at'
        )
        .orderBy('alliance_members.joined_at', 'desc');

      return alliances.map(alliance => {
        const allianceObj = new Alliance(alliance);
        allianceObj.userRole = alliance.user_role;
        return allianceObj;
      });
    } catch (error) {
      throw error;
    }
  }

  // 获取用户联盟颜色
  static async getUserAllianceColor(userId) {
    try {
      const alliance = await this.getUserAlliance(userId);
      return alliance ? alliance.color : '#808080'; // 默认灰色
    } catch (error) {
      console.error('获取用户联盟颜色失败:', error);
      return '#808080'; // 出错时返回默认灰色
    }
  }

  // 获取联盟成员数量
  async getMemberCount() {
    try {
      const result = await db('alliance_members')
        .where('alliance_id', this.id)
        .count('* as count')
        .first();

      return parseInt(result.count);
    } catch (error) {
      throw error;
    }
  }

  // 获取联盟统计数据（直接查询pixels表获取实时数据）
  async getStats() {
    const startTime = Date.now();
    try {
      // 获取成员数量
      const memberCount = await this.getMemberCount();

      // 获取联盟所有成员的ID
      const memberIds = await db('alliance_members')
        .where('alliance_id', this.id)
        .select('user_id')
        .then(rows => rows.map(row => row.user_id));

      if (memberIds.length === 0) {
        const queryTime = Date.now() - startTime;
        console.log(`✅ 联盟统计数据获取成功 (无成员), 联盟ID: ${this.id}, 耗时: ${queryTime}ms`);
        return {
          totalPixels: 0,
          currentPixels: 0,
          memberCount: 0,
          territory: 0,
          rank: 0,
          data_source: 'direct_pixels_query'
        };
      }

      // 获取当前时间范围（今日开始到现在）
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // 直接查询pixels表获取统计数据
      try {
        // 🆕 使用新的像素统计服务，剔除道具类像素
        const PixelStatsService = require('../services/pixelStatsService');
        const realStats = await PixelStatsService.getAllianceRealPixelStats(
          this.id,
          memberIds,
          {
            includeToday: true,
            includeWeek: false,
            includeAllTime: true
          }
        );

        const currentPixels = realStats.todayPixels;
        const totalPixels = realStats.totalPixels;

        // 3. 获取联盟排名（当前周期）- 使用真实绘制数据
        // 使用窗口函数获取所有联盟的当前像素数排名
        const rankQuery = await db.raw(`
          SELECT alliance_rank
          FROM (
            SELECT
              am.alliance_id,
              COUNT(p.id) as pixel_count,
              RANK() OVER (ORDER BY COUNT(p.id) DESC) as alliance_rank
            FROM alliance_members am
            LEFT JOIN pixels p ON am.user_id = p.user_id
              AND p.created_at >= ?
              AND p.pixel_type = 'basic'
            WHERE am.alliance_id IS NOT NULL
              AND am.alliance_id IN (
                SELECT DISTINCT alliance_id
                FROM alliance_members
                WHERE alliance_id IS NOT NULL
              )
            GROUP BY am.alliance_id
          ) ranked_alliances
          WHERE alliance_id = ?
        `, [todayStart, this.id]);

        const rank = parseInt(rankQuery.rows?.[0]?.alliance_rank || 0);

        const queryTime = Date.now() - startTime;
        console.log(`✅ 联盟统计数据获取成功 (真实绘制统计), 联盟ID: ${this.id}, 总像素: ${totalPixels}, 当前像素: ${currentPixels}, 排名: ${rank}, 耗时: ${queryTime}ms`);

        return {
          totalPixels,
          currentPixels,
          memberCount,
          territory: currentPixels, // 领地等于当前像素数
          rank,
          data_source: 'real_pixels_stats',
          // 🆕 添加对比信息
          comparison: {
            originalTotalPixels: realStats.originalTotalPixels,
            originalCurrentPixels: realStats.originalCurrentPixels,
            proposedPixelsDelta: realStats.proposedPixelsDelta,
            proposedOwnershipDelta: realStats.proposedOwnershipDelta
          }
        };
      } catch (pixelQueryError) {
        console.warn('从pixels表获取统计数据失败，使用备用方案:', pixelQueryError.message);

        // 备用方案：从users表获取统计数据
        const userStats = await db('users')
          .whereIn('id', memberIds)
          .select('total_pixels', 'current_pixels')
          .then(rows => ({
            totalPixels: rows.reduce((sum, user) => sum + parseInt(user.total_pixels || 0), 0),
            currentPixels: rows.reduce((sum, user) => sum + parseInt(user.current_pixels || 0), 0)
          }));

        const queryTime = Date.now() - startTime;
        console.log(`✅ 联盟统计数据获取成功 (备用users表), 联盟ID: ${this.id}, 总像素: ${userStats.totalPixels}, 当前像素: ${userStats.currentPixels}, 耗时: ${queryTime}ms`);

        return {
          totalPixels: userStats.totalPixels,
          currentPixels: userStats.currentPixels,
          memberCount,
          territory: userStats.currentPixels,
          rank: 0, // 备用方案无法获取排名
          data_source: 'users_table_fallback'
        };
      }
    } catch (error) {
      console.error('获取联盟统计失败:', error);
      // 返回默认值而不是抛出错误，避免API超时
      return {
        totalPixels: 0,
        currentPixels: 0,
        memberCount: 0,
        territory: 0,
        rank: 0,
        data_source: 'error_fallback'
      };
    }
  }
}

module.exports = Alliance;
