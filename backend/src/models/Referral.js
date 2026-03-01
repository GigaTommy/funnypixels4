const { db } = require('../config/database');
const UserPoints = require('./UserPoints');
const logger = require('../utils/logger');

// 分层奖励机制
const REWARD_TIERS = {
  tier1: { threshold: 0, inviterReward: 50, inviteeReward: 20 },   // 前5人
  tier2: { threshold: 5, inviterReward: 80, inviteeReward: 30 },   // 6-15人
  tier3: { threshold: 15, inviterReward: 120, inviteeReward: 50 }, // 16-30人
  tier4: { threshold: 30, inviterReward: 200, inviteeReward: 100 } // 31+人
};

// 里程碑奖励
const MILESTONE_REWARDS = {
  5: { points: 500, achievement: 'social_expert', badge: '社交达人' },
  20: { points: 2000, achievement: 'ambassador', badge: '推广大使', vipDays: 7 },
  50: { points: 10000, achievement: 'legendary_referrer', badge: '传奇推荐人', vipTier: 'elite_permanent' }
};

// 二级邀请奖励（你邀请的人再邀请他人时，你获得的奖励）
const SECOND_LEVEL_REWARD = 10;

const MAX_REFERRAL_REWARDS = null; // 移除上限限制

class Referral {
  /**
   * Generate a unique referral code for a user.
   * If user already has one, return the existing code.
   */
  static async getOrCreateCode(userId) {
    const user = await db('users').where('id', userId).first('referral_code');
    if (user && user.referral_code) {
      return user.referral_code;
    }

    // Generate unique 8-char code
    let code;
    let attempts = 0;
    do {
      code = this.generateCode();
      const exists = await db('users').where('referral_code', code).first();
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    await db('users').where('id', userId).update({ referral_code: code });
    return code;
  }

  /**
   * Generate a random 8-character alphanumeric code
   */
  static generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I/L)
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 根据邀请数量计算当前奖励等级
   */
  static getTierForInviteCount(count) {
    if (count >= REWARD_TIERS.tier4.threshold) return REWARD_TIERS.tier4;
    if (count >= REWARD_TIERS.tier3.threshold) return REWARD_TIERS.tier3;
    if (count >= REWARD_TIERS.tier2.threshold) return REWARD_TIERS.tier2;
    return REWARD_TIERS.tier1;
  }

  /**
   * Redeem a referral code for a new user.
   * Called during or after registration.
   */
  static async redeemCode(inviteeId, code) {
    const trx = await db.transaction();
    try {
      // Find the inviter by referral code
      const inviter = await trx('users').where('referral_code', code).first();
      if (!inviter) {
        await trx.rollback();
        return { success: false, error: 'INVALID_CODE' };
      }

      // Can't invite yourself
      if (inviter.id === inviteeId) {
        await trx.rollback();
        return { success: false, error: 'SELF_REFERRAL' };
      }

      // Check if invitee already used a referral code
      const existing = await trx('referrals').where('invitee_id', inviteeId).first();
      if (existing) {
        await trx.rollback();
        return { success: false, error: 'ALREADY_REFERRED' };
      }

      // 获取邀请者当前邀请数量
      const inviterCount = await trx('referrals')
        .where('inviter_id', inviter.id)
        .count('* as count')
        .first();
      const currentInviteCount = parseInt(inviterCount?.count || 0);

      // 根据邀请数量计算奖励等级
      const tier = this.getTierForInviteCount(currentInviteCount);
      const inviterReward = tier.inviterReward;
      const inviteeReward = tier.inviteeReward;

      // Record the referral
      const [referralRecord] = await trx('referrals').insert({
        inviter_id: inviter.id,
        invitee_id: inviteeId,
        referral_code: code,
        inviter_reward: inviterReward,
        invitee_reward: inviteeReward,
        reward_claimed: true,
        tier_level: currentInviteCount >= 30 ? 4 : currentInviteCount >= 15 ? 3 : currentInviteCount >= 5 ? 2 : 1,
        created_at: new Date()
      }).returning('*');

      // Update invitee's referred_by
      await trx('users').where('id', inviteeId).update({ referred_by: inviter.id });

      // 🔥 处理二级邀请奖励
      // 如果邀请者本身也是被邀请来的，给邀请者的邀请者发放二级奖励
      if (inviter.referred_by) {
        await trx('referrals').insert({
          inviter_id: inviter.referred_by,
          invitee_id: inviteeId,
          referral_code: null,
          inviter_reward: SECOND_LEVEL_REWARD,
          invitee_reward: 0,
          reward_claimed: true,
          tier_level: 0,
          is_second_level: true,
          created_at: new Date()
        });
      }

      await trx.commit();

      // Award points (outside transaction - using UserPoints own transactions)
      await UserPoints.addPoints(inviter.id, inviterReward, '邀请奖励', `referral:${inviteeId}`);
      await UserPoints.addPoints(inviteeId, inviteeReward, '受邀奖励', `referred_by:${inviter.id}`);

      // 二级邀请奖励
      if (inviter.referred_by) {
        await UserPoints.addPoints(inviter.referred_by, SECOND_LEVEL_REWARD, '二级邀请奖励', `referral_2nd:${inviteeId}`);
      }

      // 检查里程碑奖励
      const newInviteCount = currentInviteCount + 1;
      const milestone = MILESTONE_REWARDS[newInviteCount];
      if (milestone) {
        await UserPoints.addPoints(inviter.id, milestone.points, `里程碑奖励: ${milestone.badge}`, `milestone:${newInviteCount}`);

        // 记录成就
        await db('user_achievements').insert({
          user_id: inviter.id,
          achievement_id: milestone.achievement,
          earned_at: new Date()
        }).onConflict(['user_id', 'achievement_id']).ignore();

        // 如果奖励包含VIP
        if (milestone.vipDays) {
          await db('vip_subscriptions').insert({
            user_id: inviter.id,
            tier: 'premium',
            start_date: new Date(),
            end_date: new Date(Date.now() + milestone.vipDays * 24 * 60 * 60 * 1000),
            is_active: true,
            source: 'milestone_reward'
          });
        } else if (milestone.vipTier === 'elite_permanent') {
          await db('vip_subscriptions').insert({
            user_id: inviter.id,
            tier: 'elite',
            start_date: new Date(),
            end_date: new Date('2099-12-31'),
            is_active: true,
            source: 'milestone_reward'
          });
        }
      }

      logger.info('Referral redeemed', {
        inviterId: inviter.id,
        inviteeId,
        inviterReward,
        inviteeReward,
        tier: tier,
        currentInviteCount: newInviteCount,
        milestone: milestone ? milestone.badge : null,
        secondLevelReward: inviter.referred_by ? SECOND_LEVEL_REWARD : 0
      });

      return {
        success: true,
        inviterReward,
        inviteeReward,
        inviterName: inviter.display_name || inviter.username,
        tier: tier,
        milestone: milestone,
        secondLevelBonus: inviter.referred_by ? SECOND_LEVEL_REWARD : 0
      };

    } catch (error) {
      await trx.rollback();
      logger.error('Referral redeem failed', { error: error.message, inviteeId, code });
      throw error;
    }
  }

  /**
   * Get referral stats for a user
   */
  static async getStats(userId) {
    const user = await db('users').where('id', userId).first('referral_code');

    const referrals = await db('referrals')
      .where('inviter_id', userId)
      .where('is_second_level', false)
      .orWhereNull('is_second_level')
      .orderBy('created_at', 'desc');

    const secondLevelReferrals = await db('referrals')
      .where('inviter_id', userId)
      .where('is_second_level', true)
      .count('* as count')
      .first();

    const totalRewardsEarned = referrals.reduce((sum, r) => sum + (r.inviter_reward || 0), 0);
    const totalInvites = referrals.length;

    // 计算当前等级和下一等级
    const currentTier = this.getTierForInviteCount(totalInvites);
    let nextTier = null;
    let nextMilestone = null;

    if (totalInvites < 5) {
      nextTier = { threshold: 5, ...REWARD_TIERS.tier2 };
    } else if (totalInvites < 15) {
      nextTier = { threshold: 15, ...REWARD_TIERS.tier3 };
    } else if (totalInvites < 30) {
      nextTier = { threshold: 30, ...REWARD_TIERS.tier4 };
    }

    // 下一个里程碑
    const milestoneKeys = Object.keys(MILESTONE_REWARDS).map(Number).sort((a, b) => a - b);
    for (const key of milestoneKeys) {
      if (totalInvites < key) {
        nextMilestone = {
          threshold: key,
          ...MILESTONE_REWARDS[key],
          remaining: key - totalInvites
        };
        break;
      }
    }

    // 已获得的里程碑
    const earnedMilestones = milestoneKeys
      .filter(key => totalInvites >= key)
      .map(key => ({
        threshold: key,
        ...MILESTONE_REWARDS[key]
      }));

    return {
      referralCode: user?.referral_code || null,
      totalInvites,
      totalSecondLevelInvites: parseInt(secondLevelReferrals?.count || 0),
      totalRewardsEarned,
      currentTier: {
        level: totalInvites >= 30 ? 4 : totalInvites >= 15 ? 3 : totalInvites >= 5 ? 2 : 1,
        inviterReward: currentTier.inviterReward,
        inviteeReward: currentTier.inviteeReward
      },
      nextTier: nextTier ? {
        threshold: nextTier.threshold,
        remaining: nextTier.threshold - totalInvites,
        inviterReward: nextTier.inviterReward,
        inviteeReward: nextTier.inviteeReward
      } : null,
      nextMilestone,
      earnedMilestones,
      secondLevelRewardPerInvite: SECOND_LEVEL_REWARD
    };
  }
}

module.exports = Referral;
