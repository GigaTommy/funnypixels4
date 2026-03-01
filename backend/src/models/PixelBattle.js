const { db } = require('../config/database');

class PixelBattle {
    constructor(data) {
        this.id = data.id;
        this.attacker_id = data.attacker_id;
        this.victim_id = data.victim_id;
        this.grid_id = data.grid_id;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.old_color = data.old_color;
        this.new_color = data.new_color;
        this.old_pattern_id = data.old_pattern_id;
        this.new_pattern_id = data.new_pattern_id;
        this.region_name = data.region_name;
        this.created_at = data.created_at;
    }

    static async create(data) {
        try {
            const [row] = await db('pixel_battle_logs')
                .insert(data)
                .returning('*');
            return new PixelBattle(row);
        } catch (error) {
            console.error('❌ 创建战斗日志失败:', error);
            throw error;
        }
    }

    static async batchCreate(dataArray) {
        try {
            if (!dataArray || dataArray.length === 0) return [];
            const rows = await db('pixel_battle_logs')
                .insert(dataArray)
                .returning('*');
            return rows.map(row => new PixelBattle(row));
        } catch (error) {
            console.error('❌ 批量创建战斗日志失败:', error);
            throw error;
        }
    }

    static async getFeedForUser(userId, { page = 1, limit = 20, startDate, endDate } = {}) {
        try {
            const safeLimit = Math.min(parseInt(limit) || 20, 50);
            const safePage = Math.max(parseInt(page) || 1, 1);
            const offset = (safePage - 1) * safeLimit;

            // 默认查询30天内
            const defaultStart = new Date();
            defaultStart.setDate(defaultStart.getDate() - 30);
            const queryStart = startDate ? new Date(startDate) : defaultStart;

            let query = db('pixel_battle_logs as b')
                .join('users as u', 'b.attacker_id', 'u.id')
                .where('b.victim_id', userId)
                .where('b.created_at', '>=', queryStart)
                .orderBy('b.created_at', 'desc');

            if (endDate) {
                query = query.where('b.created_at', '<=', new Date(endDate));
            }

            const countQuery = query.clone().count('b.id as count').first();

            const battles = await query
                .select(
                    'b.*',
                    'u.username as attacker_name',
                    'u.avatar as attacker_avatar'
                )
                .limit(safeLimit)
                .offset(offset);

            const total = await countQuery;

            return {
                battles: battles.map(row => ({
                    ...row,
                    attacker_name: row.attacker_name,
                    attacker_avatar: row.attacker_avatar
                })),
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total: parseInt(total.count),
                    total_pages: Math.ceil(parseInt(total.count) / safeLimit)
                }
            };
        } catch (error) {
            console.error('❌ 获取战斗日志失败:', error);
            throw error;
        }
    }

    static async countRecentBattles(userId, since) {
        try {
            const result = await db('pixel_battle_logs')
                .where('victim_id', userId)
                .where('created_at', '>=', since)
                .count('id as count')
                .first();
            return parseInt(result.count);
        } catch (error) {
            console.error('❌ 统计最近战斗失败:', error);
            return 0;
        }
    }
}

module.exports = PixelBattle;
