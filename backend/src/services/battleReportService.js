/**
 * 领土动态 - 战斗报告服务
 * 队列处理像素覆盖事件，持久化、实时推送、聚合摘要
 */

const { db } = require('../config/database');
const { getRedis } = require('../config/redis');
const PixelBattle = require('../models/PixelBattle');
const SystemMessage = require('../models/SystemMessage');
const { getSocketManager } = require('./socketManagerInstance');
const pushNotificationService = require('./pushNotificationService');

const QUEUE_KEY = 'battle:events:queue';
const AGG_PREFIX = 'battle:agg:';
const AGG_WINDOW_MS = 5 * 60 * 1000; // 5分钟聚合窗口
const AGG_TTL_S = 330; // 5.5分钟TTL（略大于窗口）
const POLL_INTERVAL_MS = 1000;

function getRedisClient() {
  return getRedis();
}

class BattleReportService {
  constructor() {
    this.isProcessing = false;
    this.pollTimer = null;
    this.aggFlushTimer = null;

    this.startQueueProcessor();
    this.startAggregationFlusher();
    console.log('🛡️ BattleReportService 已初始化');
  }

  /**
   * 将战斗事件推入Redis队列（fire-and-forget入口）
   */
  async queueBattleEvents(events) {
    try {
      const redis = getRedisClient();
      if (!redis) {
        console.warn('⚠️ Redis不可用，跳过战斗事件入队');
        return;
      }

      const pipeline = redis.multi();
      for (const event of events) {
        pipeline.lPush(QUEUE_KEY, JSON.stringify(event));
      }
      await pipeline.exec();
    } catch (error) {
      console.error('❌ 战斗事件入队失败:', error);
    }
  }

  /**
   * 启动队列轮询处理器
   */
  startQueueProcessor() {
    this.pollTimer = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processQueue();
      } catch (error) {
        console.error('❌ 战斗事件处理失败:', error);
      } finally {
        this.isProcessing = false;
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * 从队列中取出并处理事件
   */
  async processQueue() {
    const redis = getRedisClient();
    if (!redis) return;

    const batchSize = 50;
    const events = [];

    for (let i = 0; i < batchSize; i++) {
      const raw = await redis.rPop(QUEUE_KEY);
      if (!raw) break;
      try {
        events.push(JSON.parse(raw));
      } catch (e) {
        console.error('❌ 解析战斗事件失败:', e);
      }
    }

    if (events.length === 0) return;

    // 1. 持久化到数据库
    try {
      await PixelBattle.batchCreate(events);
    } catch (error) {
      console.error('❌ 持久化战斗日志失败:', error);
    }

    // 2. 按受害者聚合后推送 WebSocket（避免每个像素都推一次）
    const victimMap = new Map(); // victim_id → events[]
    for (const event of events) {
      const arr = victimMap.get(event.victim_id) || [];
      arr.push(event);
      victimMap.set(event.victim_id, arr);
    }

    for (const [victimId, victimEvents] of victimMap) {
      this.notifyVictimBatch(victimId, victimEvents);
    }

    // 3. 聚合计数（并行，不阻塞）
    for (const event of events) {
      this.updateAggregation(event).catch(console.error);
    }
  }

  /**
   * 按受害者聚合推送 WebSocket 通知（一个victim一条消息）
   */
  notifyVictimBatch(victimId, events) {
    try {
      const socketManager = getSocketManager();
      if (!socketManager) return;

      // 取第一个事件作为样本坐标
      const sample = events[0];
      socketManager.sendToUser(victimId, 'territory_battle', {
        attacker_id: sample.attacker_id,
        grid_id: sample.grid_id,
        latitude: sample.latitude,
        longitude: sample.longitude,
        old_color: sample.old_color,
        new_color: sample.new_color,
        old_pattern_id: sample.old_pattern_id,
        new_pattern_id: sample.new_pattern_id,
        count: events.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ WebSocket推送失败:', error);
    }
  }

  /**
   * 更新5分钟聚合窗口（attacker:victim pair）
   */
  async updateAggregation(event) {
    const redis = getRedisClient();
    if (!redis) return;

    const slot = Math.floor(Date.now() / AGG_WINDOW_MS);
    const aggKey = `${AGG_PREFIX}${event.attacker_id}:${event.victim_id}:${slot}`;

    await redis.hIncrBy(aggKey, 'count', 1);
    // 存储最新的攻击者信息（后续flush时用）
    await redis.hSet(aggKey, 'attacker_id', event.attacker_id);
    await redis.hSet(aggKey, 'victim_id', event.victim_id);
    await redis.hSet(aggKey, 'sample_lat', String(event.latitude));
    await redis.hSet(aggKey, 'sample_lng', String(event.longitude));
    await redis.expire(aggKey, AGG_TTL_S);
  }

  /**
   * 启动聚合窗口刷新器（每分钟检查过期的聚合窗口）
   */
  startAggregationFlusher() {
    this.aggFlushTimer = setInterval(async () => {
      try {
        await this.flushExpiredAggregations();
      } catch (error) {
        console.error('❌ 聚合窗口刷新失败:', error);
      }
    }, 60 * 1000); // 每分钟检查
  }

  /**
   * 刷新已过期的聚合窗口 → 创建系统消息
   */
  async flushExpiredAggregations() {
    const redis = getRedisClient();
    if (!redis) return;

    const currentSlot = Math.floor(Date.now() / AGG_WINDOW_MS);
    // 扫描前一个窗口（已经关闭的窗口）
    const prevSlot = currentSlot - 1;
    const pattern = `${AGG_PREFIX}*:${prevSlot}`;

    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      const keys = result.keys;

      for (const key of keys) {
        try {
          const data = await redis.hGetAll(key);
          if (!data || !data.count) continue;

          const count = parseInt(data.count);
          if (count <= 0) continue;

          // 获取攻击者名称
          let attackerName = '某位用户';
          try {
            const attacker = await db('users')
              .where('id', data.attacker_id)
              .select('username')
              .first();
            if (attacker) attackerName = attacker.username;
          } catch (e) {
            // 使用默认名称
          }

          const msgContent = `${attackerName} 踩了你 ${count} 块地盘！`;
          const msgAttachments = {
            attacker_id: data.attacker_id,
            attacker_name: attackerName,
            count,
            sample_lat: parseFloat(data.sample_lat),
            sample_lng: parseFloat(data.sample_lng)
          };

          // 创建系统消息
          await SystemMessage.create({
            receiver_id: data.victim_id,
            title: '领土动态',
            content: msgContent,
            type: 'territory_battle',
            attachments: msgAttachments
          });

          // APNs 推送（用户不在线时通过系统推送通知）
          pushNotificationService.sendToUser(
            data.victim_id,
            '领土动态',
            msgContent,
            'territory_battle',
            msgAttachments
          ).catch(err => console.error('❌ APNs推送失败:', err));

          // 删除已处理的key
          await redis.del(key);
        } catch (error) {
          console.error('❌ 处理聚合窗口失败:', error, key);
        }
      }
    } while (cursor !== '0');
  }

  /**
   * 停止服务
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.aggFlushTimer) {
      clearInterval(this.aggFlushTimer);
      this.aggFlushTimer = null;
    }
    console.log('🛡️ BattleReportService 已停止');
  }
}

const battleReportService = new BattleReportService();
module.exports = battleReportService;
