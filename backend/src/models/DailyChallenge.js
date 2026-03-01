const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const UserPoints = require('./UserPoints');
const ChallengeTemplate = require('./ChallengeTemplate');

/**
 * 每日挑战模型 (Daily Challenge)
 * 负责每日任务的生成、进度追踪和奖励发放
 */
class DailyChallenge {
    /**
     * 获取用户今日挑战
     * @param {string} userId 
     */
    static async getTodayChallenge(userId) {
        const today = new Date().toISOString().split('T')[0];

        // 检查是否已生成今日挑战
        let challenge = await db('user_challenges')
            .where({ user_id: userId, date: today })
            .first();

        if (!challenge) {
            // 生成新挑战
            challenge = await this.generateRandomChallenge(userId, today);
        }

        return challenge;
    }

    /**
     * 为用户生成随机挑战
     */
    static async generateRandomChallenge(userId, date) {
        // Try to select from challenge_templates first
        let selected = null;
        try {
            const template = await ChallengeTemplate.selectRandomTemplate();
            if (template) {
                selected = {
                    type: template.type,
                    target: template.target_value,
                    title: template.title,
                    description: template.description,
                    reward_points: template.reward_points || 20
                };
            }
        } catch (e) {
            // Template table may not exist yet, fall back to hardcoded
        }

        // Fallback to hardcoded challenges
        if (!selected) {
            const challengeTypes = [
                { type: 'draw_count', target: 50, title: '勤劳画匠', description: '今日累积绘制 50 个像素' },
                { type: 'region_draw', target: 20, title: '城市足迹', description: '在当前活跃区域内绘制 20 个像素' },
                { type: 'pattern_draw', target: 1, title: '艺术创作', description: '今日绘制 1 个自定义图案' }
            ];
            const randomIdx = Math.floor(Math.random() * challengeTypes.length);
            selected = challengeTypes[randomIdx];
        }

        const challenge = {
            id: uuidv4(),
            user_id: userId,
            date: date,
            type: selected.type,
            target_value: selected.target,
            current_value: 0,
            title: selected.title,
            description: selected.description,
            is_completed: false,
            is_claimed: false,
            reward_points: selected.reward_points || 20,
            created_at: new Date(),
            updated_at: new Date()
        };

        const [inserted] = await db('user_challenges').insert(challenge).returning('*');
        return inserted;
    }

    /**
     * 更新进度
     * @param {string} userId 
     * @param {string} type 
     * @param {number} increment 
     */
    static async updateProgress(userId, type, increment = 1) {
        const today = new Date().toISOString().split('T')[0];

        const challenge = await db('user_challenges')
            .where({ user_id: userId, date: today, type: type, is_completed: false })
            .first();

        if (challenge) {
            const newValue = challenge.current_value + increment;
            const isCompleted = newValue >= challenge.target_value;

            await db('user_challenges')
                .where('id', challenge.id)
                .update({
                    current_value: newValue,
                    is_completed: isCompleted,
                    updated_at: new Date()
                });

            return { completed: isCompleted, newValue };
        }

        return null;
    }

    /**
     * 批量更新进度（优化版：合并多种类型的进度更新为更少的查询）
     * @param {string} userId
     * @param {Array<{type: string, increment: number}>} updates
     */
    static async batchUpdateProgress(userId, updates) {
        if (!updates || updates.length === 0) return [];

        const today = new Date().toISOString().split('T')[0];
        const types = updates.map(u => u.type);

        // Single SELECT to get all matching challenges
        const challenges = await db('user_challenges')
            .where({ user_id: userId, date: today, is_completed: false })
            .whereIn('type', types)
            .select('*');

        if (challenges.length === 0) return [];

        const results = [];
        for (const challenge of challenges) {
            const update = updates.find(u => u.type === challenge.type);
            if (!update) continue;

            const newValue = challenge.current_value + update.increment;
            const isCompleted = newValue >= challenge.target_value;

            await db('user_challenges')
                .where('id', challenge.id)
                .update({
                    current_value: newValue,
                    is_completed: isCompleted,
                    updated_at: new Date()
                });

            results.push({ type: challenge.type, completed: isCompleted, newValue });
        }

        return results;
    }

    /**
     * 领取奖励
     */
    static async claimReward(userId, challengeId) {
        const challenge = await db('user_challenges')
            .where({ id: challengeId, user_id: userId })
            .first();

        if (!challenge || !challenge.is_completed || challenge.is_claimed) {
            throw new Error('无法领取该挑战奖励');
        }

        await db.transaction(async (trx) => {
            // 标记已领取
            await trx('user_challenges')
                .where('id', challengeId)
                .update({ is_claimed: true, updated_at: new Date() });

            // 增加积分 (使用统一服务以记录账本)
            await UserPoints.addPoints(userId, challenge.reward_points, `每日挑战奖励: ${challenge.title}`, challengeId);
        });

        return { success: true, reward: challenge.reward_points };
    }
}

module.exports = DailyChallenge;
