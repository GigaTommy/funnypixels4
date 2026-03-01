const { db } = require('../config/database');
const cron = require('node-cron');
const logger = require('../utils/logger');
const UserPoints = require('../models/UserPoints');

class DailyRewardService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('⚠️ DailyRewardService already running');
      return;
    }

    this.isRunning = true;
    logger.info('🏆 DailyRewardService started');

    // Run daily at 1:00 AM to settle yesterday's rewards
    cron.schedule('0 1 * * *', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      logger.info(`🏆 Running daily reward settlement for ${dateStr}`);
      await this.settleDailyRewards(dateStr);
    });
  }

  /**
   * Settle daily ranking rewards for all eligible users.
   * @param {string} date - YYYY-MM-DD format date to settle
   */
  async settleDailyRewards(date) {
    const startTime = Date.now();

    try {
      // Calculate period range for the given date
      const periodStart = `${date}T00:00:00.000Z`;
      const periodEnd = `${date}T23:59:59.999Z`;

      // Get all users who appear on the personal daily leaderboard
      const personalRanks = await db('leaderboard_personal')
        .select('user_id', 'rank')
        .where('period', 'daily')
        .where('period_start', '>=', periodStart)
        .where('period_start', '<', periodEnd);

      if (personalRanks.length === 0) {
        logger.info(`🏆 No leaderboard entries found for ${date}, skipping settlement`);
        return;
      }

      // Get alliance leaderboard ranks (map alliance_id -> rank)
      const allianceRanks = await db('leaderboard_alliance')
        .select('alliance_id', 'rank')
        .where('period', 'daily')
        .where('period_start', '>=', periodStart)
        .where('period_start', '<', periodEnd);

      const allianceRankMap = new Map();
      for (const entry of allianceRanks) {
        allianceRankMap.set(entry.alliance_id, entry.rank);
      }

      // Get user-alliance memberships to map users to alliance ranks
      const userAllianceMap = new Map();
      if (allianceRankMap.size > 0) {
        const memberships = await db('alliance_members')
          .select('user_id', 'alliance_id')
          .whereIn('alliance_id', Array.from(allianceRankMap.keys()));
        for (const m of memberships) {
          const rank = allianceRankMap.get(m.alliance_id);
          if (rank != null) {
            userAllianceMap.set(m.user_id, rank);
          }
        }
      }

      // Build friends rank map per user
      // For each user on the personal leaderboard, check their rank among friends
      const friendsRankMap = await this._computeFriendsRanks(personalRanks);

      let settledCount = 0;

      for (const entry of personalRanks) {
        const userId = entry.user_id;
        const personalRank = entry.rank;
        const allianceRank = userAllianceMap.get(userId) || null;
        const friendsRank = friendsRankMap.get(userId) || null;

        const personalPoints = this._calcPersonalPoints(personalRank);
        const alliancePoints = this._calcAlliancePoints(allianceRank);
        const friendsPoints = this._calcFriendsPoints(friendsRank);
        const totalPoints = personalPoints + alliancePoints + friendsPoints;

        // Skip users with 0 total points
        if (totalPoints === 0) continue;

        try {
          // Insert reward credit (skip if already exists via unique constraint)
          await db('daily_reward_credits')
            .insert({
              user_id: userId,
              reward_date: date,
              personal_rank: personalRank,
              alliance_rank: allianceRank,
              friends_rank: friendsRank,
              personal_points: personalPoints,
              alliance_points: alliancePoints,
              friends_points: friendsPoints,
              total_points: totalPoints
            })
            .onConflict(['user_id', 'reward_date'])
            .ignore();

          // Credit points to user's balance
          await UserPoints.addPoints(userId, totalPoints, `排名奖励 ${date}`);

          settledCount++;
        } catch (err) {
          logger.error(`🏆 Failed to settle reward for user ${userId}:`, err.message);
        }
      }

      logger.info(`🏆 Daily reward settlement complete for ${date}: ${settledCount} users rewarded in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error(`🏆 Daily reward settlement failed for ${date}:`, error.message);
    }
  }

  /**
   * Get the most recent unacknowledged reward summary for a user.
   */
  async getPendingSummary(userId) {
    const row = await db('daily_reward_credits')
      .leftJoin('daily_reward_acknowledgements', function() {
        this.on('daily_reward_credits.user_id', '=', 'daily_reward_acknowledgements.user_id')
            .andOn('daily_reward_credits.reward_date', '=', 'daily_reward_acknowledgements.reward_date');
      })
      .whereNull('daily_reward_acknowledgements.id')
      .where('daily_reward_credits.user_id', userId)
      .select('daily_reward_credits.*')
      .orderBy('daily_reward_credits.reward_date', 'desc')
      .first();

    if (!row) {
      return { has_pending: false, summary: null };
    }

    return {
      has_pending: true,
      summary: {
        reward_date: row.reward_date instanceof Date
          ? row.reward_date.toISOString().split('T')[0]
          : String(row.reward_date),
        personal_rank: row.personal_rank,
        alliance_rank: row.alliance_rank,
        friends_rank: row.friends_rank,
        personal_points: row.personal_points,
        alliance_points: row.alliance_points,
        friends_points: row.friends_points,
        total_points: row.total_points
      }
    };
  }

  /**
   * Mark a reward summary as acknowledged by the user.
   */
  async acknowledgeSummary(userId, date) {
    await db('daily_reward_acknowledgements')
      .insert({
        user_id: userId,
        reward_date: date
      })
      .onConflict(['user_id', 'reward_date'])
      .ignore();
  }

  // --- Point calculation helpers ---

  _calcPersonalPoints(rank) {
    if (rank == null) return 0;
    if (rank <= 10) return 100;
    if (rank <= 50) return 50;
    if (rank <= 100) return 25;
    return 0;
  }

  _calcAlliancePoints(rank) {
    if (rank == null) return 0;
    if (rank <= 3) return 50;
    if (rank <= 10) return 30;
    return 0;
  }

  _calcFriendsPoints(rank) {
    if (rank == null) return 0;
    if (rank <= 1) return 50;
    if (rank <= 3) return 30;
    return 0;
  }

  /**
   * Compute each user's rank among their friends on the personal leaderboard.
   * Returns Map<userId, friendsRank>.
   */
  async _computeFriendsRanks(personalRanks) {
    const friendsRankMap = new Map();
    const userIds = personalRanks.map(e => e.user_id);

    if (userIds.length === 0) return friendsRankMap;

    // Build pixel_count lookup from personalRanks (rank correlates with pixel count order)
    // For friends ranking, we need the pixel counts. Use rank as proxy — lower rank = better.
    const userRankMap = new Map();
    for (const entry of personalRanks) {
      userRankMap.set(entry.user_id, entry.rank);
    }

    // Get all follow relationships where both follower and followed are on the leaderboard
    const follows = await db('follows')
      .select('follower_id', 'following_id')
      .whereIn('follower_id', userIds)
      .whereIn('following_id', userIds);

    // Build adjacency: user -> set of friends (mutual or just following)
    const friendsMap = new Map();
    for (const f of follows) {
      if (!friendsMap.has(f.follower_id)) {
        friendsMap.set(f.follower_id, new Set());
      }
      friendsMap.get(f.follower_id).add(f.following_id);
    }

    // For each user, rank them among their friends (including themselves)
    for (const userId of userIds) {
      const friends = friendsMap.get(userId);
      if (!friends || friends.size === 0) continue;

      // Include self
      const group = [userId, ...Array.from(friends)];
      // Sort by personal rank (ascending = better)
      const sorted = group
        .filter(id => userRankMap.has(id))
        .sort((a, b) => (userRankMap.get(a) || 9999) - (userRankMap.get(b) || 9999));

      const idx = sorted.indexOf(userId);
      if (idx >= 0) {
        friendsRankMap.set(userId, idx + 1);
      }
    }

    return friendsRankMap;
  }
}

module.exports = DailyRewardService;
