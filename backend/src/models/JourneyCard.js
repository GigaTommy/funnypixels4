const { db } = require('../config/database');
const logger = require('../utils/logger');

class JourneyCard {
  /**
   * 获取用户的旅途卡片列表(分页)
   */
  static async getCardsByUser(userId, { page = 1, limit = 20 } = {}) {
    try {
      const offset = (page - 1) * limit;

      const cards = await db('journey_cards as jc')
        .join('drift_bottles as db', 'jc.bottle_id', 'db.bottle_id')
        .where('jc.participant_id', userId)
        .select([
          'jc.id',
          'jc.bottle_id',
          'jc.participant_role',
          'jc.station_number',
          'jc.city',
          'jc.country',
          'jc.message',
          'jc.is_read',
          'jc.created_at',
          'db.pixel_snapshot',
          'db.origin_city',
          'db.origin_country',
          'db.total_distance',
          'db.open_count',
          'db.max_openers',
          'db.is_sunk',
          'db.sunk_at',
          'db.created_at as bottle_created_at'
        ])
        .orderBy('jc.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      // 获取总数
      const totalResult = await db('journey_cards')
        .where({ participant_id: userId })
        .count('* as count')
        .first();

      // 为每张卡片计算总站数和总天数
      const enrichedCards = cards.map(card => {
        const totalDays = card.bottle_created_at
          ? Math.ceil((Date.now() - new Date(card.bottle_created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          ...card,
          total_stations: card.open_count + 1,
          total_days: totalDays,
          pixel_snapshot: typeof card.pixel_snapshot === 'string'
            ? JSON.parse(card.pixel_snapshot)
            : card.pixel_snapshot
        };
      });

      return {
        cards: enrichedCards,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.count),
          total_pages: Math.ceil(parseInt(totalResult.count) / limit)
        }
      };
    } catch (error) {
      logger.error('获取用户旅途卡片失败:', error);
      throw error;
    }
  }

  /**
   * 获取旅途卡片详情(含完整站点信息)
   */
  static async getCardDetail(bottleId) {
    try {
      // 获取瓶子基本信息
      const bottle = await db('drift_bottles')
        .where({ bottle_id: bottleId })
        .first();

      if (!bottle) {
        throw new Error('漂流瓶不存在');
      }

      // 获取所有站点(journey_cards)
      const stations = await db('journey_cards as jc')
        .leftJoin('users as u', 'jc.participant_id', 'u.id')
        .where('jc.bottle_id', bottleId)
        .orderBy('jc.station_number', 'asc')
        .select([
          'jc.id',
          'jc.participant_id',
          'jc.participant_role',
          'jc.station_number',
          'jc.city',
          'jc.country',
          'jc.message',
          'jc.distance_from_prev',
          'jc.cumulative_distance',
          'jc.created_at',
          'u.username',
          'u.avatar',
          'u.avatar_url'
        ]);

      // 获取所有留言
      const messages = await db('drift_bottle_messages')
        .where({ bottle_id: bottleId })
        .orderBy('station_number', 'asc');

      const totalDays = Math.ceil(
        (Date.now() - new Date(bottle.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        bottle_id: bottleId,
        pixel_snapshot: typeof bottle.pixel_snapshot === 'string'
          ? JSON.parse(bottle.pixel_snapshot)
          : bottle.pixel_snapshot,
        origin_city: bottle.origin_city,
        origin_country: bottle.origin_country,
        total_distance: bottle.total_distance,
        total_stations: stations.length,
        total_days: totalDays,
        is_sunk: bottle.is_sunk,
        sunk_at: bottle.sunk_at,
        created_at: bottle.created_at,
        stations,
        messages
      };
    } catch (error) {
      logger.error('获取旅途卡片详情失败:', error);
      throw error;
    }
  }

  /**
   * 标记旅途卡片为已读
   */
  static async markAsRead(cardId, userId) {
    try {
      await db('journey_cards')
        .where({ id: cardId, participant_id: userId })
        .update({ is_read: true });

      return true;
    } catch (error) {
      logger.error('标记旅途卡片已读失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户未读旅途卡片数量
   */
  static async getUnreadCount(userId) {
    try {
      const result = await db('journey_cards')
        .where({ participant_id: userId, is_read: false })
        .count('* as count')
        .first();

      return parseInt(result.count);
    } catch (error) {
      logger.error('获取未读旅途卡片数量失败:', error);
      return 0;
    }
  }
}

module.exports = JourneyCard;
