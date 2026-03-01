const { db } = require('../config/database');
const logger = require('../utils/logger');

class PixelSessionService {
  /**
   * 获取用户的绘制会话历史
   * @param {string} userId - 用户ID
   * @param {object} options - 查询选项
   * @returns {Promise<Object>} 会话历史数据
   */
  static async getUserDrawingSessions(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      sessionThreshold = 30 // 30分钟间隔阈值
    } = options;

    try {
      const offset = (page - 1) * limit;

      // 使用简化的两步方法：先获取基础数据，再进行处理
      const baseQuery = db.raw(`
        WITH session_gaps AS (
          SELECT
            created_at,
            EXTRACT(EPOCH FROM (
              created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at)
            )) / 60 as minutes_from_prev,
            CASE
              WHEN LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) IS NULL THEN true
              WHEN EXTRACT(EPOCH FROM (
                created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at)
              )) / 60 > :sessionThreshold THEN true
              ELSE false
            END as starts_new_session
          FROM pixels_history
          WHERE user_id = :userId
            AND created_at >= CURRENT_DATE - INTERVAL '90 days'
          WHERE user_id = :userId
          ORDER BY created_at DESC
        ),
        session_numbers AS (
          SELECT
            created_at,
            SUM(CASE WHEN starts_new_session THEN 1 ELSE 0 END) OVER (ORDER BY created_at DESC) as session_number
          FROM session_gaps
        )
        SELECT
          ph.*,
          sn.session_number
        FROM pixels_history ph
        JOIN session_numbers sn ON ph.created_at = sn.created_at
        WHERE ph.user_id = :userId
          AND ph.created_at >= CURRENT_DATE - INTERVAL '90 days'
        WHERE ph.user_id = :userId
        ORDER BY ph.created_at DESC
        LIMIT 2000
      `, {
        userId,
        sessionThreshold
      });

      const baseData = await baseQuery;

      // 在应用层进行分组和处理
      const sessions = new Map();

      baseData.rows.forEach(row => {
        const sessionNum = row.session_number;

        if (!sessions.has(sessionNum)) {
          sessions.set(sessionNum, {
            sessionNumber: sessionNum,
            pixelCount: 0,
            uniquePatterns: new Set(),
            uniqueGrids: new Set(),
            cities: new Set(),
            startTime: row.created_at,
            endTime: row.created_at,
            startLat: row.latitude,
            startLng: row.longitude,
            startCity: row.city,
            startCountry: row.country,
            startGrid: row.grid_id,
            endLat: row.latitude,
            endLng: row.longitude,
            endCity: row.city,
            endCountry: row.country,
            endGrid: row.grid_id,
            patternCounts: {},
            allPixels: []
          });
        }

        const session = sessions.get(sessionNum);
        session.pixelCount++;
        session.endTime = row.created_at;
        session.endLat = row.latitude;
        session.endLng = row.longitude;

        // 🆕 增强地理位置：如果city为空，尝试使用province或district作为显示名称
        const rowDisplayName = row.city || row.province || row.district;

        if (!session.startCity && rowDisplayName) {
          session.startCity = rowDisplayName;
          session.startCountry = row.country;
        }

        session.endCity = rowDisplayName || session.endCity;
        session.endCountry = row.country || session.endCountry;
        session.endGrid = row.grid_id;

        if (row.pattern_id) {
          session.uniquePatterns.add(row.pattern_id);
          session.patternCounts[row.pattern_id] = (session.patternCounts[row.pattern_id] || 0) + 1;
        }
        session.uniqueGrids.add(row.grid_id);
        if (rowDisplayName) session.cities.add(rowDisplayName);

        session.allPixels.push(row);
      });

      // 转换为数组并排序
      const sessionList = Array.from(sessions.values())
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(offset, offset + limit);

      // 计算总会话数
      const totalSessions = sessions.size;

      // 获取联盟信息
      const allianceQuery = db.raw(`
        SELECT a.name
        FROM alliances a
        JOIN alliance_members am ON a.id = am.alliance_id
        WHERE am.user_id = :userId
        LIMIT 1
      `, { userId });

      const allianceResult = await allianceQuery;
      const allianceName = allianceResult.rows[0]?.name || '无联盟';

      // 格式化会话数据
      const formattedSessions = sessionList.map(session => {
        // 计算持续时间
        const durationMs = new Date(session.endTime) - new Date(session.startTime);
        const durationMinutes = Math.round(durationMs / (1000 * 60));

        // 找出主要图案
        const mainPatternId = Object.keys(session.patternCounts)
          .sort((a, b) => session.patternCounts[b] - session.patternCounts[a])[0];

        return {
          sessionId: `session_${session.sessionNumber}`,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: {
            minutes: durationMinutes,
            formatted: this.formatDuration(durationMinutes)
          },
          statistics: {
            pixelCount: session.pixelCount,
            uniqueGrids: session.uniqueGrids.size,
            citiesVisited: session.cities.size,
            patternsUsed: session.uniquePatterns.size
          },
          locations: {
            start: {
              coordinates: session.startLat && session.startLng ?
                [parseFloat(session.startLng), parseFloat(session.startLat)] : null,
              city: session.startCity,
              country: session.startCountry,
              gridId: session.startGrid
            },
            end: {
              coordinates: session.endLat && session.endLng ?
                [parseFloat(session.endLng), parseFloat(session.endLat)] : null,
              city: session.endCity,
              country: session.endCountry,
              gridId: session.endGrid
            }
          },
          patterns: {
            main: {
              id: mainPatternId,
              name: mainPatternId ? '自定义图案' : '无图案'
            },
            all: Array.from(session.uniquePatterns),
            uniqueCount: session.uniquePatterns.size
          },
          alliance: {
            name: allianceName
          }
        };
      });

      return {
        success: true,
        data: {
          sessions: formattedSessions,
          pagination: {
            page,
            limit,
            total: totalSessions,
            totalPages: Math.ceil(totalSessions / limit),
            hasNext: page * limit < totalSessions,
            hasPrev: page > 1
          },
          summary: {
            totalSessions,
            totalPixels: formattedSessions.reduce((sum, s) => sum + s.statistics.pixelCount, 0),
            averageDuration: formattedSessions.length > 0 ?
              Math.round(formattedSessions.reduce((sum, s) => sum + s.statistics.pixelCount, 0) / formattedSessions.length) : 0
          }
        }
      };

    } catch (error) {
      logger.error('获取用户绘制会话失败:', error);
      return {
        success: false,
        message: '获取绘制历史失败',
        error: error.message
      };
    }
  }

  /**
   * 获取会话详情（包含具体的绘制记录）
   * @param {string} userId - 用户ID
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object>} 会话详情
   */
  static async getSessionDetails(userId, sessionId) {
    try {
      const sessionNumber = parseInt(sessionId.replace('session_', ''));

      const detailsQuery = db.raw(`
        WITH user_pixels AS (
          SELECT
            id,
            created_at,
            latitude,
            longitude,
            city,
            country,
            grid_id,
            pattern_id,
            action_type,
            color,
            EXTRACT(EPOCH FROM (
              created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at)
            )) / 60 as minutes_from_prev,
            CASE
              WHEN LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) IS NULL THEN 1
              WHEN EXTRACT(EPOCH FROM (
                created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at)
              )) / 60 > 30 THEN 1
              ELSE 0
            END as is_new_session
          FROM pixels_history
          WHERE user_id = :userId
          ORDER BY created_at DESC
        ),
        session_grouped AS (
          SELECT
            *,
            SUM(is_new_session) OVER (ORDER BY created_at DESC) as session_number
          FROM user_pixels
        )
        SELECT
          sg.id,
          sg.created_at,
          latitude,
          longitude,
          city,
          country,
          grid_id,
          pattern_id,
          action_type,
          color,
          minutes_from_prev,
          p.name as pattern_name,
          p.description as pattern_description
        FROM session_grouped sg
        LEFT JOIN patterns p ON sg.pattern_id = p.id
        WHERE sg.session_number = :sessionNumber
        ORDER BY sg.created_at DESC
      `, {
        userId,
        sessionNumber
      });

      const pixels = await detailsQuery;

      return {
        success: true,
        data: {
          sessionId,
          pixels: pixels.rows.map(pixel => ({
            id: pixel.id,
            timestamp: pixel.created_at,
            location: {
              coordinates: pixel.latitude && pixel.longitude ?
                [parseFloat(pixel.longitude), parseFloat(pixel.latitude)] : null,
              city: pixel.city,
              country: pixel.country,
              gridId: pixel.grid_id
            },
            pattern: pixel.pattern_id ? {
              id: pixel.pattern_id,
              name: pixel.pattern_name || '自定义图案',
              description: pixel.pattern_description
            } : null,
            action: pixel.action_type || 'draw',
            color: pixel.color,
            timeFromPrevious: pixel.minutes_from_prev ?
              Math.round(pixel.minutes_from_prev * 60) : null // 转换为秒
          }))
        }
      };

    } catch (error) {
      logger.error('获取会话详情失败:', error);
      return {
        success: false,
        message: '获取会话详情失败',
        error: error.message
      };
    }
  }

  /**
   * 格式化时长显示
   * @param {number} minutes - 分钟数
   * @returns {string} 格式化的时长字符串
   */
  static formatDuration(minutes) {
    if (minutes < 1) {
      return '少于1分钟';
    } else if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return `${days}天${hours > 0 ? hours + '小时' : ''}`;
    }
  }

  /**
   * 获取用户绘制统计数据
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 统计数据
   */
  static async getUserDrawingStats(userId) {
    try {
      const statsQuery = db.raw(`
        SELECT
          COUNT(*) as total_pixels,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(DISTINCT grid_id) as unique_grids,
          COUNT(DISTINCT pattern_id) as unique_patterns,
          COUNT(DISTINCT city) as cities_count,
          COUNT(DISTINCT country) as countries_count,
          MIN(created_at) as first_draw,
          MAX(created_at) as last_draw,
          -- 计算最活跃的城市
          (
            SELECT city
            FROM pixels_history
            WHERE user_id = :userId AND city IS NOT NULL
            GROUP BY city
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_active_city,
          -- 计算最常用的图案
          (
            SELECT pattern_id
            FROM pixels_history
            WHERE user_id = :userId AND pattern_id IS NOT NULL
            GROUP BY pattern_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as favorite_pattern
        FROM pixels_history
        WHERE user_id = :userId
      `, { userId });

      const stats = await statsQuery;
      const result = stats.rows[0];

      return {
        success: true,
        data: {
          totalPixels: result.total_pixels,
          activeDays: result.active_days,
          uniqueGrids: result.unique_grids,
          uniquePatterns: result.unique_patterns,
          citiesVisited: result.cities_count,
          countriesVisited: result.countries_count,
          firstDraw: result.first_draw,
          lastDraw: result.last_draw,
          mostActiveCity: result.most_active_city || '未知',
          favoritePattern: result.favorite_pattern || '无',
          experience: this.calculateUserExperience(result.total_pixels)
        }
      };

    } catch (error) {
      logger.error('获取用户绘制统计失败:', error);
      return {
        success: false,
        message: '获取统计数据失败',
        error: error.message
      };
    }
  }

  /**
   * 计算用户经验等级
   * @param {number} totalPixels - 总绘制像素数
   * @returns {Object} 经验等级信息
   */
  static calculateUserExperience(totalPixels) {
    // 简单的经验等级计算
    const levels = [
      { name: '新手画家', min: 0, color: '#666' },
      { name: '业余画手', min: 100, color: '#8B4513' },
      { name: '专业画师', min: 500, color: '#4169E1' },
      { name: '艺术大师', min: 1000, color: '#8A2BE2' },
      { name: '传奇画圣', min: 5000, color: '#FFD700' }
    ];

    let currentLevel = levels[0];
    for (const level of levels) {
      if (totalPixels >= level.min) {
        currentLevel = level;
      }
    }

    const nextLevel = levels[levels.indexOf(currentLevel) + 1];
    const progress = nextLevel ?
      ((totalPixels - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100 : 100;

    return {
      level: currentLevel.name,
      color: currentLevel.color,
      totalPixels,
      progress: Math.round(progress),
      nextLevel: nextLevel ? nextLevel.name : null,
      pixelsToNext: nextLevel ? Math.max(0, nextLevel.min - totalPixels) : 0
    };
  }
}

module.exports = PixelSessionService;