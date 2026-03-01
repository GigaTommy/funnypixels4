const PixelBattle = require('../models/PixelBattle');
const { getRedis } = require('../config/redis');

class BattleController {
    /**
     * 获取用户的领土动态 feed（分页）
     */
    static async getBattleFeed(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, start_date, end_date } = req.query;

            const result = await PixelBattle.getFeedForUser(userId, {
                page,
                limit,
                startDate: start_date,
                endDate: end_date
            });

            res.json({
                success: true,
                data: {
                    battles: result.battles,
                    pagination: result.pagination
                }
            });
        } catch (error) {
            console.error('❌ 获取领土动态失败:', error);
            res.status(500).json({ success: false, message: '获取领土动态失败' });
        }
    }

    /**
     * 获取未读战斗数量
     */
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;

            // 从Redis获取上次读取时间戳
            const redis = getRedis();
            let lastRead = null;
            if (redis) {
                const ts = await redis.get(`battle:lastread:${userId}`);
                if (ts) lastRead = new Date(parseInt(ts));
            }

            const since = lastRead || new Date(Date.now() - 24 * 60 * 60 * 1000); // 默认24小时
            const count = await PixelBattle.countRecentBattles(userId, since);

            // 更新最后读取时间
            if (redis) {
                await redis.set(`battle:lastread:${userId}`, String(Date.now()), { EX: 30 * 24 * 3600 });
            }

            res.json({
                success: true,
                data: { unread_count: count }
            });
        } catch (error) {
            console.error('❌ 获取未读战斗数失败:', error);
            res.status(500).json({ success: false, message: '获取未读数量失败' });
        }
    }
}

module.exports = BattleController;
