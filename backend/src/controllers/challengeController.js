const DailyChallenge = require('../models/DailyChallenge');

class ChallengeController {
    /**
     * 获取用户今日挑战
     */
    static async getTodayChallenge(req, res) {
        try {
            const userId = req.user.id;
            const challenge = await DailyChallenge.getTodayChallenge(userId);

            res.json({
                success: true,
                data: challenge
            });
        } catch (error) {
            console.error('获取今日挑战失败:', error);
            res.status(500).json({
                success: false,
                message: '获取今日挑战失败'
            });
        }
    }

    /**
     * 领取挑战奖励
     */
    static async claimReward(req, res) {
        try {
            const userId = req.user.id;
            const { challengeId } = req.params;

            const result = await DailyChallenge.claimReward(userId, challengeId);

            res.json({
                success: true,
                message: '奖励领取成功',
                data: result
            });
        } catch (error) {
            console.error('领取奖励失败:', error);
            res.status(400).json({
                success: false,
                message: error.message || '领取奖励失败'
            });
        }
    }
}

module.exports = ChallengeController;
