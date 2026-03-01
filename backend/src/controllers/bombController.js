const PatternApply = require('../models/PatternApply');
const UserInventory = require('../models/UserInventory');
const { redis, redisUtils } = require('../config/redis');
const { db } = require('../config/database');

class BombController {
  // 使用炸弹
  static async useBomb(req, res) {
    try {
      const { x, y, pattern_id, sku_id } = req.body;
      const userId = req.user.id;
      const allianceId = req.user.alliance_id;

      // 验证必需字段
      if (x === undefined || y === undefined || !sku_id) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段'
        });
      }

      // 检查用户是否有炸弹库存
      const hasBomb = await UserInventory.hasEnough(userId, sku_id, 1);
      if (!hasBomb) {
        return res.status(400).json({
          success: false,
          message: '炸弹库存不足'
        });
      }

      // 检查冷却时间（使用统一冷却时间服务）
      const BombCooldownService = require('../services/bombCooldownService');
      const validation = await BombCooldownService.validateBombUsage(userId, 'general');
      
      if (!validation.canUse) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          cooldown_remaining: 0
        });
      }

      // 设置炸弹参数（6x6区域）
      const bombSize = 6;
      const bombX = Math.floor(x - bombSize / 2);
      const bombY = Math.floor(y - bombSize / 2);

      // 创建炸弹图案应用
      const bomb = await PatternApply.create({
        pattern_id: pattern_id || null, // 如果没有指定图案，使用默认
        x: bombX,
        y: bombY,
        w: bombSize,
        h: bombSize,
        owner_user_id: userId,
        owner_alliance_id: allianceId,
        type: 'bomb',
        expires_at: new Date(Date.now() + 30 * 1000) // 30秒后过期
      });

      // 消耗炸弹库存
      await UserInventory.consume(userId, sku_id, 1);

      // 设置冷却时间（使用统一冷却时间服务）
      await BombCooldownService.setCooldown(userId, 30, 'general'); // 30分钟冷却

      // 记录审计日志
      await this.logAudit(userId, 'bomb_used', {
        bomb_id: bomb.id,
        x, y,
        pattern_id,
        sku_id
      });

      res.json({
        success: true,
        message: '炸弹使用成功',
        bomb: {
          id: bomb.id,
          x: bombX,
          y: bombY,
          w: bombSize,
          h: bombSize,
          pattern_id: bomb.pattern_id,
          expires_at: bomb.expires_at
        }
      });

    } catch (error) {
      console.error('使用炸弹失败:', error);
      res.status(500).json({
        success: false,
        message: '使用炸弹失败',
        error: error.message
      });
    }
  }

  // 获取用户炸弹冷却状态
  static async getCooldownStatus(req, res) {
    try {
      const userId = req.user.id;
      const BombCooldownService = require('../services/bombCooldownService');
      
      const cooldownCheck = await BombCooldownService.checkCooldown(userId, 'general');
      
      return res.json({
        success: true,
        can_use: cooldownCheck.canUse,
        cooldown_remaining: cooldownCheck.remainingSeconds,
        remaining_minutes: cooldownCheck.remainingMinutes
      });

    } catch (error) {
      console.error('获取冷却状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取冷却状态失败',
        error: error.message
      });
    }
  }

  // 获取用户炸弹使用历史
  static async getBombHistory(req, res) {
    try {
      const userId = req.user.id;
      const bombs = await PatternApply.getBombsByUser(userId, 24);

      const bombHistory = bombs.map(bomb => ({
        id: bomb.id,
        x: bomb.x,
        y: bomb.y,
        w: bomb.w,
        h: bomb.h,
        pattern_id: bomb.pattern_id,
        created_at: bomb.created_at,
        expires_at: bomb.expires_at
      }));

      res.json({
        success: true,
        bombs: bombHistory
      });

    } catch (error) {
      console.error('获取炸弹历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取炸弹历史失败',
        error: error.message
      });
    }
  }

  // 获取用户炸弹库存
  static async getBombInventory(req, res) {
    try {
      const userId = req.user.id;
      const bombs = await UserInventory.getBombs(userId);

      const inventory = bombs.map(bomb => ({
        sku_id: bomb.sku_id,
        quantity: bomb.quantity,
        name: bomb.name,
        price: bomb.price,
        description: bomb.description
      }));

      res.json({
        success: true,
        inventory
      });

    } catch (error) {
      console.error('获取炸弹库存失败:', error);
      res.status(500).json({
        success: false,
        message: '获取炸弹库存失败',
        error: error.message
      });
    }
  }

  // 记录审计日志
  static async logAudit(userId, action, details) {
    try {
      await db('audit_log').insert({
        user_id: userId,
        action,
        details: JSON.stringify(details),
        x: details.x,
        y: details.y,
        created_at: new Date()
      });
    } catch (error) {
      console.error('记录审计日志失败:', error);
    }
  }
}

module.exports = BombController;
