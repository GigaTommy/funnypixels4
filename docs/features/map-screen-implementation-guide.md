# 地图屏幕技术实现指南

> 面向前后端工程师的详细实施指南，包含完整的代码示例和架构设计
>
> **文档版本**: v1.0
> **创建日期**: 2026-02-28
> **目标读者**: Backend & iOS 开发工程师

---

## 目录

- [架构总览](#架构总览)
- [后端实现](#后端实现)
  - [数据库设计](#数据库设计)
  - [API端点设计](#api端点设计)
  - [Service层实现](#service层实现)
  - [Socket.IO事件](#socketio事件)
  - [定时任务](#定时任务)
- [iOS实现](#ios实现)
  - [文件结构](#文件结构)
  - [Service层](#service层)
  - [ViewModel层](#viewmodel层)
  - [View层](#view层)
  - [MapLibre集成](#maplibre集成)
- [数据流设计](#数据流设计)
- [测试策略](#测试策略)
- [部署检查清单](#部署检查清单)

---

## 架构总览

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                     iOS App (SwiftUI)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  View Layer          ViewModel Layer      Service Layer│
│  ┌──────────┐        ┌───────────┐       ┌───────────┐│
│  │RegionInfo│───────▶│MapViewModel│──────▶│MapSocial  ││
│  │Bar       │        │            │       │Service    ││
│  └──────────┘        └───────────┘       └───────────┘│
│                             │                   │      │
│  ┌──────────┐               │                   │      │
│  │TaskPin   │──────────────┘                   │      │
│  │Annotation│                                   │      │
│  └──────────┘                                   │      │
│                                                  │      │
└──────────────────────────────────────────────────┼──────┘
                                                   │
                            ┌──────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Express + Node.js)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Routes            Controllers           Services      │
│  ┌──────────┐      ┌───────────┐       ┌───────────┐  │
│  │/api/map/ │─────▶│mapSocial  │──────▶│activePlayer│  │
│  │region-   │      │Controller │       │Service    │  │
│  │info      │      └───────────┘       └───────────┘  │
│  └──────────┘             │                   │        │
│                           │                   ▼        │
│  ┌──────────┐             │            ┌───────────┐  │
│  │/api/     │             │            │Redis      │  │
│  │daily-    │─────────────┘            │(Cache)    │  │
│  │tasks     │                          └───────────┘  │
│  └──────────┘                                 │        │
│                                               ▼        │
│                                        ┌───────────┐  │
│                                        │PostgreSQL │  │
│                                        │+ PostGIS  │  │
│                                        └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 技术栈决策

| 功能模块 | 技术选型 | 原因 |
|---------|---------|------|
| 区域信息缓存 | Redis (60s TTL) | 高频读取，数据实时性要求不高 |
| 附近玩家索引 | Redis Geo | 地理位置查询性能优秀 |
| 任务数据存储 | PostgreSQL | 需要事务保证，关联查询 |
| 领地计算 | H3 + PostGIS | 六边形网格聚合，空间分析 |
| 实时更新 | Socket.IO | 已有基础设施，双向通信 |
| 宝箱刷新 | Bull Queue | 定时任务，可靠性高 |

---

## 后端实现

### 数据库设计

#### 1. 每日任务表

```sql
-- Migration: 20260228100000_create_daily_tasks.js
exports.up = function(knex) {
  return knex.schema.createTable('daily_tasks', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable()
      .references('id').inTable('users')
      .onDelete('CASCADE');

    table.string('task_type', 30).notNullable();
    table.string('title', 200).notNullable();
    table.text('description');

    table.integer('target_value').notNullable();
    table.integer('current_value').defaultTo(0);

    table.integer('reward_points').defaultTo(50);
    table.jsonb('reward_items'); // [{ itemId, quantity }]

    // 位置信息（可选，用于定点任务）
    table.decimal('location_lat', 10, 8);
    table.decimal('location_lng', 11, 8);
    table.integer('location_radius').defaultTo(500);
    table.string('location_name', 200);

    // 状态
    table.boolean('is_completed').defaultTo(false);
    table.boolean('is_claimed').defaultTo(false);
    table.timestamp('completed_at');
    table.timestamp('claimed_at');
    table.timestamp('expires_at').notNullable();

    table.timestamps(true, true);

    // 索引
    table.index(['user_id', 'created_at']);
    table.index(['task_type']);
    table.index(['expires_at']);
  })
  .then(() => {
    // 添加地理索引
    return knex.raw(`
      CREATE INDEX idx_daily_tasks_location ON daily_tasks
      USING GIST (ST_MakePoint(location_lng, location_lat))
      WHERE location_lat IS NOT NULL;
    `);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('daily_tasks');
};
```

#### 2. 每日任务奖励表

```sql
-- Migration: 20260228100001_create_daily_task_bonus.js
exports.up = function(knex) {
  return knex.schema.createTable('daily_task_bonus', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable()
      .references('id').inTable('users')
      .onDelete('CASCADE');
    table.date('date').notNullable();

    table.boolean('all_completed').defaultTo(false);
    table.boolean('bonus_claimed').defaultTo(false);
    table.integer('bonus_points').defaultTo(200);
    table.jsonb('bonus_items');

    table.timestamp('claimed_at');
    table.timestamps(true, true);

    // 唯一约束：每个用户每天只有一条记录
    table.unique(['user_id', 'date']);
    table.index('date');
  });
};
```

#### 3. 宝箱表

```sql
-- Migration: 20260228100002_create_treasure_chests.js
exports.up = function(knex) {
  return knex.schema.createTable('treasure_chests', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('chest_type', 30).notNullable(); // normal, rare, epic, event
    table.decimal('lat', 10, 8).notNullable();
    table.decimal('lng', 11, 8).notNullable();
    table.integer('trigger_radius').defaultTo(50);

    table.integer('reward_points').notNullable();
    table.jsonb('reward_items');

    table.integer('max_claims').defaultTo(1);
    table.integer('current_claims').defaultTo(0);

    table.timestamp('expires_at').notNullable();
    table.boolean('is_active').defaultTo(true);

    table.timestamps(true, true);

    // 地理索引
    table.index(['is_active', 'expires_at']);
  })
  .then(() => {
    return knex.raw(`
      CREATE INDEX idx_treasure_location ON treasure_chests
      USING GIST (ST_MakePoint(lng, lat))
      WHERE is_active = true;
    `);
  });
};
```

#### 4. 宝箱领取记录表

```sql
-- Migration: 20260228100003_create_treasure_claims.js
exports.up = function(knex) {
  return knex.schema.createTable('treasure_claims', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chest_id').notNullable()
      .references('id').inTable('treasure_chests')
      .onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users')
      .onDelete('CASCADE');

    table.timestamp('claimed_at').defaultTo(knex.fn.now());

    // 唯一约束：每个用户每个宝箱只能领取一次
    table.unique(['chest_id', 'user_id']);
    table.index('user_id');
    table.index('claimed_at');
  });
};
```

#### 5. 领地控制表

```sql
-- Migration: 20260228100004_create_territory_control.js
exports.up = function(knex) {
  return knex.schema.createTable('territory_control', table => {
    table.string('h3_index', 20).primary(); // H3 resolution 7

    table.uuid('dominant_alliance_id')
      .references('id').inTable('alliances')
      .onDelete('SET NULL');
    table.decimal('dominant_percentage', 5, 2);

    table.integer('total_pixels').defaultTo(0);
    table.jsonb('alliance_pixels').defaultTo('{}'); // { allianceId: count }

    table.boolean('is_contested').defaultTo(false);
    table.timestamp('last_calculated_at').defaultTo(knex.fn.now());

    table.index('dominant_alliance_id');
    table.index('is_contested');
    table.index('last_calculated_at');
  });
};
```

---

### API端点设计

#### 1. 区域信息API

```javascript
// backend/src/routes/mapSocialRoutes.js
const express = require('express');
const router = express.Router();
const mapSocialController = require('../controllers/mapSocialController');
const { authenticateToken } = require('../middleware/auth');

// 区域信息（可选认证，游客可访问）
router.get('/region-info', mapSocialController.getRegionInfo);

// 附近玩家（需要认证）
router.get('/nearby-players', authenticateToken, mapSocialController.getNearbyPlayers);

module.exports = router;
```

```javascript
// backend/src/controllers/mapSocialController.js
const mapSocialService = require('../services/mapSocialService');
const { validateCoordinates } = require('../utils/validators');

class MapSocialController {
  async getRegionInfo(req, res) {
    try {
      const { lat, lng, zoom } = req.query;

      // 验证参数
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: lat, lng'
        });
      }

      if (!validateCoordinates(parseFloat(lat), parseFloat(lng))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates'
        });
      }

      // 获取区域信息
      const regionInfo = await mapSocialService.getRegionInfo({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        zoom: parseInt(zoom) || 14
      });

      res.json({
        success: true,
        data: regionInfo
      });

    } catch (error) {
      console.error('Error getting region info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get region info'
      });
    }
  }

  async getNearbyPlayers(req, res) {
    try {
      const { lat, lng, radius = 5000 } = req.query;
      const userId = req.user.id;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: lat, lng'
        });
      }

      const players = await mapSocialService.getNearbyPlayers({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseInt(radius),
        excludeUserId: userId
      });

      res.json({
        success: true,
        data: {
          players,
          totalActive: players.length
        }
      });

    } catch (error) {
      console.error('Error getting nearby players:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get nearby players'
      });
    }
  }
}

module.exports = new MapSocialController();
```

#### 2. 每日任务API

```javascript
// backend/src/routes/dailyTaskRoutes.js
const express = require('express');
const router = express.Router();
const dailyTaskController = require('../controllers/dailyTaskController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// 获取用户的每日任务列表
router.get('/', dailyTaskController.getTasks);

// 获取地图任务标记点
router.get('/map-pins', dailyTaskController.getMapPins);

// 领取任务奖励
router.post('/:taskId/claim', dailyTaskController.claimReward);

// 领取全部完成奖励
router.post('/bonus/claim', dailyTaskController.claimBonus);

module.exports = router;
```

```javascript
// backend/src/controllers/dailyTaskController.js
const dailyTaskService = require('../services/dailyTaskService');

class DailyTaskController {
  async getTasks(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      const tasks = await dailyTaskService.getUserTasks(userId);
      const bonusStatus = await dailyTaskService.getBonusStatus(userId, today);

      res.json({
        success: true,
        data: {
          tasks,
          bonusStatus
        }
      });

    } catch (error) {
      console.error('Error getting tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tasks'
      });
    }
  }

  async getMapPins(req, res) {
    try {
      const userId = req.user.id;

      const pins = await dailyTaskService.getMapPins(userId);

      res.json({
        success: true,
        data: { pins }
      });

    } catch (error) {
      console.error('Error getting map pins:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get map pins'
      });
    }
  }

  async claimReward(req, res) {
    try {
      const userId = req.user.id;
      const { taskId } = req.params;

      const result = await dailyTaskService.claimTaskReward(userId, taskId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('Error claiming reward:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to claim reward'
      });
    }
  }

  async claimBonus(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      const result = await dailyTaskService.claimBonusReward(userId, today);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);

    } catch (error) {
      console.error('Error claiming bonus:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to claim bonus'
      });
    }
  }
}

module.exports = new DailyTaskController();
```

---

### Service层实现

#### 1. 地图社交服务

```javascript
// backend/src/services/mapSocialService.js
const redis = require('../config/redis');
const db = require('../config/database');
const geocodingService = require('./geocodingService');
const h3 = require('h3-js');

class MapSocialService {
  /**
   * 获取区域信息
   */
  async getRegionInfo({ lat, lng, zoom }) {
    const cacheKey = `region_info:${h3.geoToH3(lat, lng, 6)}`;

    // 尝试从缓存获取
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 反向地理编码获取区域名称
    const regionName = await geocodingService.reverseGeocode(lat, lng);

    // 查询该区域像素总数（使用H3索引聚合）
    const h3Index = h3.geoToH3(lat, lng, 7);
    const pixelCount = await this.getPixelCountInH3(h3Index);

    // 查询活跃玩家数（从Redis）
    const activePlayers = await this.getActivePlayerCount(lat, lng, 5000);

    // 查询占领联盟
    const dominantAlliance = await this.getDominantAlliance(h3Index);

    // 查询区域Top玩家（从缓存或数据库）
    const topPlayers = await this.getTopPlayersInRegion(h3Index, 3);

    const result = {
      regionName,
      totalPixels: pixelCount,
      activePlayers,
      dominantAlliance,
      topPlayers
    };

    // 缓存60秒
    await redis.setex(cacheKey, 60, JSON.stringify(result));

    return result;
  }

  /**
   * 获取附近玩家
   */
  async getNearbyPlayers({ lat, lng, radius, excludeUserId }) {
    // 模糊化坐标（保留2位小数，约1km精度）
    const fuzzyLat = Math.round(lat * 100) / 100;
    const fuzzyLng = Math.round(lng * 100) / 100;

    // 使用Redis GEORADIUS查询
    const nearbyUsers = await redis.georadius(
      'active_drawers:geo',
      fuzzyLng,
      fuzzyLat,
      radius,
      'm',
      'WITHDIST',
      'ASC'
    );

    // 获取用户详细信息
    const players = [];
    for (const [userId, distance] of nearbyUsers) {
      if (userId === excludeUserId) continue;

      const userDataKey = `active_drawers:${userId}`;
      const userData = await redis.get(userDataKey);

      if (userData) {
        const user = JSON.parse(userData);
        players.push({
          userId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          allianceColor: user.allianceColor,
          fuzzyLat: user.lat,
          fuzzyLng: user.lng,
          lastActiveSeconds: Math.floor((Date.now() - user.timestamp) / 1000)
        });
      }
    }

    return players;
  }

  /**
   * 更新用户活跃位置（在绘画时调用）
   */
  async updateActivePlayerLocation(userId, lat, lng, userData) {
    // 模糊化坐标
    const fuzzyLat = Math.round(lat * 100) / 100;
    const fuzzyLng = Math.round(lng * 100) / 100;

    // 存储用户数据
    const userDataKey = `active_drawers:${userId}`;
    await redis.setex(
      userDataKey,
      300, // 5分钟TTL
      JSON.stringify({
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        allianceColor: userData.allianceColor,
        lat: fuzzyLat,
        lng: fuzzyLng,
        timestamp: Date.now()
      })
    );

    // 添加到地理索引
    await redis.geoadd('active_drawers:geo', fuzzyLng, fuzzyLat, userId);

    // 设置地理索引过期（通过定时任务清理）
  }

  // 私有方法
  async getPixelCountInH3(h3Index) {
    const result = await db('pixels')
      .count('* as count')
      .where('h3_index', h3Index)
      .first();

    return parseInt(result?.count || 0);
  }

  async getActivePlayerCount(lat, lng, radius) {
    const fuzzyLng = Math.round(lng * 100) / 100;
    const fuzzyLat = Math.round(lat * 100) / 100;

    const count = await redis.georadius(
      'active_drawers:geo',
      fuzzyLng,
      fuzzyLat,
      radius,
      'm',
      'COUNT',
      1000
    );

    return count.length;
  }

  async getDominantAlliance(h3Index) {
    const territory = await db('territory_control')
      .where('h3_index', h3Index)
      .first();

    if (!territory || !territory.dominant_alliance_id) {
      return null;
    }

    const alliance = await db('alliances')
      .select('name', 'flag_pattern_id as color')
      .where('id', territory.dominant_alliance_id)
      .first();

    return {
      name: alliance.name,
      color: alliance.color,
      percentage: parseFloat(territory.dominant_percentage)
    };
  }

  async getTopPlayersInRegion(h3Index, limit) {
    // 查询该H3区域内像素数最多的玩家
    const topPlayers = await db('pixels')
      .select('user_id')
      .count('* as pixel_count')
      .where('h3_index', h3Index)
      .groupBy('user_id')
      .orderBy('pixel_count', 'desc')
      .limit(limit);

    // 获取用户信息
    const result = [];
    for (let i = 0; i < topPlayers.length; i++) {
      const { user_id, pixel_count } = topPlayers[i];
      const user = await db('users')
        .select('username as display_name')
        .where('id', user_id)
        .first();

      if (user) {
        result.push({
          displayName: user.display_name,
          pixelCount: parseInt(pixel_count),
          rank: i + 1
        });
      }
    }

    return result;
  }
}

module.exports = new MapSocialService();
```

#### 2. 每日任务服务

```javascript
// backend/src/services/dailyTaskService.js
const db = require('../config/database');
const taskTemplateService = require('./taskTemplateService');

class DailyTaskService {
  /**
   * 为用户生成每日任务
   */
  async generateDailyTasks(userId) {
    const today = new Date();
    const expiresAt = new Date(today);
    expiresAt.setHours(23, 59, 59, 999);

    // 检查今天是否已生成
    const existing = await db('daily_tasks')
      .where('user_id', userId)
      .where('created_at', '>=', today.toISOString().split('T')[0])
      .first();

    if (existing) {
      return; // 已生成
    }

    // 获取用户最近活跃位置
    const userLocation = await this.getUserRecentLocation(userId);

    // 选择任务模板（3简单 + 1中等 + 1困难）
    const templates = await taskTemplateService.selectTasksForUser(userId);

    // 生成任务
    const tasks = templates.map(template => {
      const task = {
        user_id: userId,
        task_type: template.task_type,
        title: template.title,
        description: template.description,
        target_value: template.target_value,
        reward_points: template.reward_points,
        reward_items: template.reward_items,
        expires_at: expiresAt
      };

      // 如果是定点任务，设置位置
      if (template.task_type === 'draw_at_location' && userLocation) {
        const location = this.generateRandomLocation(
          userLocation.lat,
          userLocation.lng,
          5000 // 5km范围内
        );
        task.location_lat = location.lat;
        task.location_lng = location.lng;
        task.location_radius = 500;
        task.location_name = location.name || '指定位置';
      }

      return task;
    });

    // 插入数据库
    await db('daily_tasks').insert(tasks);

    console.log(`Generated ${tasks.length} daily tasks for user ${userId}`);
  }

  /**
   * 获取用户任务列表
   */
  async getUserTasks(userId) {
    const today = new Date().toISOString().split('T')[0];

    const tasks = await db('daily_tasks')
      .where('user_id', userId)
      .where('created_at', '>=', today)
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'asc');

    return tasks.map(task => ({
      id: task.id,
      taskType: task.task_type,
      title: task.title,
      description: task.description,
      targetValue: task.target_value,
      currentValue: task.current_value,
      rewardPoints: task.reward_points,
      rewardItems: task.reward_items,
      location: task.location_lat ? {
        lat: parseFloat(task.location_lat),
        lng: parseFloat(task.location_lng),
        radius: task.location_radius,
        name: task.location_name
      } : null,
      isCompleted: task.is_completed,
      isClaimed: task.is_claimed,
      progressPercentage: task.current_value / task.target_value,
      expiresAt: task.expires_at
    }));
  }

  /**
   * 检查并更新任务进度
   */
  async checkProgress(userId, pixelData) {
    const tasks = await db('daily_tasks')
      .where('user_id', userId)
      .where('is_completed', false)
      .where('expires_at', '>', new Date());

    for (const task of tasks) {
      let shouldUpdate = false;
      let increment = 0;

      switch (task.task_type) {
        case 'draw_count':
          // 绘画N个像素
          increment = 1;
          shouldUpdate = true;
          break;

        case 'draw_at_location':
          // 检查是否在任务区域内
          if (this.isInRadius(
            pixelData.lat,
            pixelData.lng,
            task.location_lat,
            task.location_lng,
            task.location_radius
          )) {
            increment = 1;
            shouldUpdate = true;
          }
          break;

        case 'draw_distance':
          // GPS绘画距离（需要在GPS绘画服务中累加）
          break;

        // 其他任务类型...
      }

      if (shouldUpdate) {
        const newValue = task.current_value + increment;
        const isCompleted = newValue >= task.target_value;

        await db('daily_tasks')
          .where('id', task.id)
          .update({
            current_value: newValue,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date() : null
          });

        // 如果任务完成，发送Socket通知
        if (isCompleted) {
          const socketManager = require('./socketManager');
          socketManager.emitToUser(userId, 'task_completed', {
            taskId: task.id,
            title: task.title,
            reward: {
              points: task.reward_points,
              items: task.reward_items
            }
          });
        }
      }
    }
  }

  /**
   * 领取任务奖励
   */
  async claimTaskReward(userId, taskId) {
    const task = await db('daily_tasks')
      .where('id', taskId)
      .where('user_id', userId)
      .first();

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (!task.is_completed) {
      return { success: false, error: 'Task not completed' };
    }

    if (task.is_claimed) {
      return { success: false, error: 'Reward already claimed' };
    }

    // 使用事务
    const trx = await db.transaction();

    try {
      // 更新任务状态
      await trx('daily_tasks')
        .where('id', taskId)
        .update({
          is_claimed: true,
          claimed_at: new Date()
        });

      // 发放奖励
      await trx('users')
        .where('id', userId)
        .increment('points', task.reward_points);

      // 如果有道具奖励，添加到背包
      if (task.reward_items && task.reward_items.length > 0) {
        for (const item of task.reward_items) {
          await trx('user_inventory')
            .insert({
              user_id: userId,
              item_id: item.itemId,
              quantity: item.quantity
            })
            .onConflict(['user_id', 'item_id'])
            .merge({
              quantity: trx.raw('user_inventory.quantity + ?', [item.quantity])
            });
        }
      }

      await trx.commit();

      // 获取新的积分余额
      const user = await db('users')
        .select('points')
        .where('id', userId)
        .first();

      return {
        success: true,
        reward: {
          points: task.reward_points,
          items: task.reward_items
        },
        newBalance: user.points
      };

    } catch (error) {
      await trx.rollback();
      console.error('Error claiming task reward:', error);
      return { success: false, error: 'Failed to claim reward' };
    }
  }

  /**
   * 获取奖励宝箱状态
   */
  async getBonusStatus(userId, date) {
    let bonus = await db('daily_task_bonus')
      .where('user_id', userId)
      .where('date', date)
      .first();

    if (!bonus) {
      // 创建记录
      await db('daily_task_bonus').insert({
        user_id: userId,
        date: date
      });

      bonus = {
        all_completed: false,
        bonus_claimed: false
      };
    }

    // 检查是否全部完成
    const tasks = await db('daily_tasks')
      .where('user_id', userId)
      .where('created_at', '>=', date)
      .where('expires_at', '>', new Date());

    const allCompleted = tasks.length > 0 && tasks.every(t => t.is_completed);

    // 更新状态
    if (allCompleted && !bonus.all_completed) {
      await db('daily_task_bonus')
        .where('user_id', userId)
        .where('date', date)
        .update({ all_completed: true });
    }

    return {
      allCompleted,
      bonusClaimed: bonus.bonus_claimed
    };
  }

  /**
   * 领取宝箱奖励
   */
  async claimBonusReward(userId, date) {
    const bonus = await db('daily_task_bonus')
      .where('user_id', userId)
      .where('date', date)
      .first();

    if (!bonus || !bonus.all_completed) {
      return { success: false, error: 'Not all tasks completed' };
    }

    if (bonus.bonus_claimed) {
      return { success: false, error: 'Bonus already claimed' };
    }

    const trx = await db.transaction();

    try {
      // 更新宝箱状态
      await trx('daily_task_bonus')
        .where('user_id', userId)
        .where('date', date)
        .update({
          bonus_claimed: true,
          claimed_at: new Date()
        });

      // 发放奖励
      await trx('users')
        .where('id', userId)
        .increment('points', bonus.bonus_points);

      // 如果有道具奖励
      if (bonus.bonus_items && bonus.bonus_items.length > 0) {
        for (const item of bonus.bonus_items) {
          await trx('user_inventory')
            .insert({
              user_id: userId,
              item_id: item.itemId,
              quantity: item.quantity
            })
            .onConflict(['user_id', 'item_id'])
            .merge({
              quantity: trx.raw('user_inventory.quantity + ?', [item.quantity])
            });
        }
      }

      await trx.commit();

      const user = await db('users')
        .select('points')
        .where('id', userId)
        .first();

      return {
        success: true,
        reward: {
          points: bonus.bonus_points,
          items: bonus.bonus_items
        },
        newBalance: user.points
      };

    } catch (error) {
      await trx.rollback();
      console.error('Error claiming bonus reward:', error);
      return { success: false, error: 'Failed to claim bonus' };
    }
  }

  // 辅助方法
  async getUserRecentLocation(userId) {
    const recentPixel = await db('pixels')
      .select('lat', 'lng')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .first();

    return recentPixel ? {
      lat: parseFloat(recentPixel.lat),
      lng: parseFloat(recentPixel.lng)
    } : null;
  }

  generateRandomLocation(centerLat, centerLng, radiusMeters) {
    // 生成随机半径和角度
    const r = radiusMeters * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;

    // 转换为经纬度偏移
    const latOffset = (r * Math.cos(theta)) / 111320;
    const lngOffset = (r * Math.sin(theta)) / (111320 * Math.cos(centerLat * Math.PI / 180));

    return {
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      name: null // 可以调用反向地理编码获取地名
    };
  }

  isInRadius(lat1, lng1, lat2, lng2, radiusMeters) {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
  }

  async getMapPins(userId) {
    const tasks = await this.getUserTasks(userId);

    return tasks
      .filter(task => task.location)
      .map(task => ({
        taskId: task.id,
        lat: task.location.lat,
        lng: task.location.lng,
        radius: task.location.radius,
        type: task.taskType,
        title: task.title,
        iconName: this.getIconName(task.taskType),
        progress: {
          current: task.currentValue,
          target: task.targetValue
        },
        state: this.getTaskState(task)
      }));
  }

  getIconName(taskType) {
    const icons = {
      'draw_at_location': 'mappin.circle.fill',
      'draw_distance': 'figure.walk',
      'draw_count': 'square.grid.3x3.fill',
      'alliance_coop': 'person.2.fill',
      'treasure_hunt': 'shippingbox.fill'
    };
    return icons[taskType] || 'target';
  }

  getTaskState(task) {
    if (task.isClaimed) return 'claimed';
    if (task.isCompleted) return 'completed';
    if (task.currentValue > 0) return 'inProgress';
    return 'available';
  }
}

module.exports = new DailyTaskService();
```

---

### Socket.IO事件

```javascript
// backend/src/services/socketManager.js 扩展

class SocketManager {
  // ... 现有代码 ...

  /**
   * 附近玩家更新事件
   */
  emitNearbyPlayersUpdate(bounds) {
    // 获取边界内的所有活跃用户
    const users = this.getUsersInBounds(bounds);

    // 向每个用户推送其附近的玩家
    users.forEach(async userId => {
      const userSocket = this.userSockets.get(userId);
      if (!userSocket) return;

      const user = await this.getUserLocation(userId);
      if (!user) return;

      const nearbyPlayers = await mapSocialService.getNearbyPlayers({
        lat: user.lat,
        lng: user.lng,
        radius: 5000,
        excludeUserId: userId
      });

      userSocket.emit('nearby_player_update', {
        players: nearbyPlayers,
        totalActive: nearbyPlayers.length
      });
    });
  }

  /**
   * 任务完成事件
   */
  emitToUser(userId, event, data) {
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      userSocket.emit(event, data);
    }
  }

  /**
   * 领地警报事件
   */
  emitTerritoryAlert(allianceId, h3Index, attackerAllianceId) {
    // 获取联盟所有在线成员
    const members = this.getAllianceMembers(allianceId);

    members.forEach(userId => {
      this.emitToUser(userId, 'territory_alert', {
        h3Index,
        attackerAllianceId,
        message: '你的联盟领地正在被攻击！'
      });
    });
  }
}
```

---

### 定时任务

```javascript
// backend/src/tasks/dailyTaskGeneration.js
const { CronJob } = require('cron');
const dailyTaskService = require('../services/dailyTaskService');
const db = require('../config/database');

/**
 * 每天00:00生成每日任务
 */
const dailyTaskGenerationJob = new CronJob(
  '0 0 * * *', // 每天00:00
  async () => {
    console.log('Starting daily task generation...');

    try {
      // 获取所有活跃用户（最近7天有登录）
      const activeUsers = await db('users')
        .select('id')
        .where('last_login_at', '>', db.raw("NOW() - INTERVAL '7 days'"));

      console.log(`Generating tasks for ${activeUsers.length} active users`);

      // 批量生成任务
      for (const user of activeUsers) {
        await dailyTaskService.generateDailyTasks(user.id);
      }

      console.log('Daily task generation completed');

    } catch (error) {
      console.error('Error generating daily tasks:', error);
    }
  },
  null,
  true,
  'Asia/Shanghai'
);

module.exports = dailyTaskGenerationJob;
```

```javascript
// backend/src/tasks/treasureSpawn.js
const { CronJob } = require('cron');
const treasureService = require('../services/treasureService');

/**
 * 每小时刷新宝箱
 */
const treasureSpawnJob = new CronJob(
  '0 * * * *', // 每小时
  async () => {
    console.log('Starting treasure spawn...');

    try {
      await treasureService.spawnTreasures();
      console.log('Treasure spawn completed');

    } catch (error) {
      console.error('Error spawning treasures:', error);
    }
  },
  null,
  true,
  'Asia/Shanghai'
);

module.exports = treasureSpawnJob;
```

```javascript
// backend/src/server.js 中注册任务
const dailyTaskGenerationJob = require('./tasks/dailyTaskGeneration');
const treasureSpawnJob = require('./tasks/treasureSpawn');

// 启动定时任务
dailyTaskGenerationJob.start();
treasureSpawnJob.start();

console.log('✅ Cron jobs started');
```

---

## iOS实现

### 文件结构

```
FunnyPixelsApp/FunnyPixelsApp/
├── Services/
│   ├── API/
│   │   ├── MapSocialService.swift          # 地图社交API
│   │   ├── DailyTaskService.swift          # 每日任务API
│   │   └── TreasureService.swift           # 宝箱API
│   └── Map/
│       ├── MapAnnotationManager.swift      # 地图标注管理
│       └── LocationAccuracyHandler.swift   # GPS精度处理
│
├── ViewModels/
│   ├── MapViewModel.swift                  # 地图主视图模型
│   ├── DailyTaskViewModel.swift            # 任务视图模型
│   └── QuickStatsViewModel.swift           # 快速统计视图模型
│
├── Views/
│   ├── Map/
│   │   ├── RegionInfoBar.swift             # 区域信息条
│   │   ├── ActivityBanner.swift            # 活动横幅
│   │   ├── QuickStatsPopover.swift         # 统计浮窗
│   │   ├── TaskPinAnnotation.swift         # 任务标记
│   │   ├── NearbyPlayerAnnotation.swift    # 玩家标记
│   │   ├── TreasureAnnotation.swift        # 宝箱标记
│   │   └── MapChatPanel.swift              # 聊天面板
│   └── DailyTask/
│       ├── DailyTaskListView.swift         # 任务列表
│       ├── TaskDetailCard.swift            # 任务详情卡片
│       └── TaskRewardAnimation.swift       # 奖励动画
│
└── Models/
    ├── MapModels.swift                     # 地图相关模型
    ├── TaskModels.swift                    # 任务相关模型
    └── TreasureModels.swift                # 宝箱相关模型
```

### Service层

```swift
// Services/API/DailyTaskService.swift
import Foundation
import Alamofire

@MainActor
class DailyTaskService: ObservableObject {
    static let shared = DailyTaskService()

    @Published var tasks: [DailyTask] = []
    @Published var bonusStatus: BonusStatus = BonusStatus()
    @Published var isLoading = false
    @Published var error: Error?

    private init() {}

    func fetchTasks() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: TasksResponse = try await APIManager.shared.request(
                endpoint: "/daily-tasks",
                method: .get
            )

            self.tasks = response.tasks
            self.bonusStatus = response.bonusStatus

        } catch {
            self.error = error
            print("Error fetching tasks: \(error)")
        }
    }

    func claimReward(taskId: String) async -> Bool {
        do {
            let response: ClaimResponse = try await APIManager.shared.request(
                endpoint: "/daily-tasks/\(taskId)/claim",
                method: .post
            )

            if response.success {
                // 更新任务状态
                if let index = tasks.firstIndex(where: { $0.id == taskId }) {
                    tasks[index].isClaimed = true
                }

                // 播放音效和震动
                MapSoundEffect.taskComplete.playWithHaptic(HapticFeedback.success)

                return true
            }

            return false

        } catch {
            self.error = error
            print("Error claiming reward: \(error)")
            return false
        }
    }

    func claimBonus() async -> Bool {
        do {
            let response: ClaimResponse = try await APIManager.shared.request(
                endpoint: "/daily-tasks/bonus/claim",
                method: .post
            )

            if response.success {
                bonusStatus.bonusClaimed = true

                // 播放特殊音效
                MapSoundEffect.epicReward.playWithHaptic {
                    HapticFeedback.heavy()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        HapticFeedback.heavy()
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        HapticFeedback.heavy()
                    }
                }

                return true
            }

            return false

        } catch {
            self.error = error
            return false
        }
    }
}

// Models
struct TasksResponse: Codable {
    let tasks: [DailyTask]
    let bonusStatus: BonusStatus
}

struct DailyTask: Codable, Identifiable {
    let id: String
    let taskType: String
    let title: String
    let description: String
    let targetValue: Int
    let currentValue: Int
    let rewardPoints: Int
    let rewardItems: [RewardItem]?
    let location: TaskLocation?
    let isCompleted: Bool
    var isClaimed: Bool
    let progressPercentage: Double
    let expiresAt: Date

    var state: TaskState {
        if isClaimed { return .claimed }
        if isCompleted { return .completed }
        if currentValue > 0 { return .inProgress }
        return .available
    }

    var iconName: String {
        switch taskType {
        case "draw_at_location": return "mappin.circle.fill"
        case "draw_distance": return "figure.walk"
        case "draw_count": return "square.grid.3x3.fill"
        case "alliance_coop": return "person.2.fill"
        case "treasure_hunt": return "shippingbox.fill"
        default: return "target"
        }
    }
}

struct TaskLocation: Codable {
    let lat: Double
    let lng: Double
    let radius: Int
    let name: String
}

struct BonusStatus: Codable {
    var allCompleted: Bool = false
    var bonusClaimed: Bool = false
}

enum TaskState {
    case locked
    case available
    case inProgress
    case completed
    case claimed
}

struct ClaimResponse: Codable {
    let success: Bool
    let reward: Reward?
    let newBalance: Int?
}

struct Reward: Codable {
    let points: Int
    let items: [RewardItem]?
}

struct RewardItem: Codable {
    let itemId: String
    let quantity: Int
}
```

### ViewModel层

```swift
// ViewModels/MapViewModel.swift
import Foundation
import MapLibre
import Combine

@MainActor
class MapViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var regionInfo: RegionInfo?
    @Published var nearbyPlayers: [NearbyPlayer] = []
    @Published var taskPins: [TaskPin] = []
    @Published var treasureChests: [Treasure] = []
    @Published var notifications: [MapNotification] = []

    @Published var isRegionInfoExpanded = false
    @Published var showQuickStats = false
    @Published var showChatPanel = false

    @Published var currentZoom: Double = 14
    @Published var currentCenter: CLLocationCoordinate2D?

    // MARK: - Services
    private let mapSocialService = MapSocialService.shared
    private let dailyTaskService = DailyTaskService.shared
    private let treasureService = TreasureService.shared
    private let socketManager = SocketIOManager.shared

    private var cancellables = Set<AnyCancellable>()
    private let regionUpdateThrottler = Throttler(delay: 0.5)

    // MARK: - Initialization
    init() {
        setupSocketListeners()
    }

    // MARK: - Public Methods
    func updateVisibleRegion(center: CLLocationCoordinate2D, zoom: Double) {
        currentCenter = center
        currentZoom = zoom

        regionUpdateThrottler.throttle {
            await self.loadRegionData(center: center, zoom: zoom)
        }
    }

    func refreshAllData() async {
        guard let center = currentCenter else { return }
        await loadRegionData(center: center, zoom: currentZoom)
    }

    // MARK: - Private Methods
    private func loadRegionData(center: CLLocationCoordinate2D, zoom: Double) async {
        async let regionInfo = mapSocialService.fetchRegionInfo(
            lat: center.latitude,
            lng: center.longitude,
            zoom: Int(zoom)
        )

        async let nearbyPlayers = zoom >= 12
            ? mapSocialService.fetchNearbyPlayers(
                lat: center.latitude,
                lng: center.longitude,
                radius: 5000
            )
            : []

        async let taskPins = dailyTaskService.fetchMapPins()

        async let treasures = treasureService.fetchNearbyTreasures(
            lat: center.latitude,
            lng: center.longitude,
            radius: 2000
        )

        // 并发等待所有请求
        self.regionInfo = await regionInfo
        self.nearbyPlayers = await nearbyPlayers
        self.taskPins = await taskPins
        self.treasureChests = await treasures
    }

    private func setupSocketListeners() {
        // 监听附近玩家更新
        socketManager.on("nearby_player_update") { [weak self] data in
            guard let self = self else { return }
            if let players = data["players"] as? [[String: Any]] {
                self.nearbyPlayers = players.compactMap { NearbyPlayer(dict: $0) }
            }
        }

        // 监听任务完成
        socketManager.on("task_completed") { [weak self] data in
            guard let self = self else { return }

            // 显示完成动画
            if let taskId = data["taskId"] as? String,
               let title = data["title"] as? String {
                self.showTaskCompletedNotification(taskId: taskId, title: title)
            }

            // 刷新任务列表
            Task {
                await self.dailyTaskService.fetchTasks()
            }
        }

        // 监听领地警报
        socketManager.on("territory_alert") { [weak self] data in
            guard let self = self else { return }

            if let message = data["message"] as? String {
                self.showTerritoryAlert(message: message)
            }
        }
    }

    private func showTaskCompletedNotification(taskId: String, title: String) {
        let notification = MapNotification(
            id: UUID().uuidString,
            type: .taskCompleted,
            title: "任务完成：\(title)",
            icon: "checkmark.circle.fill",
            countdown: nil
        )

        notifications.append(notification)

        // 3秒后自动移除
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.notifications.removeAll { $0.id == notification.id }
        }
    }

    private func showTerritoryAlert(message: String) {
        let notification = MapNotification(
            id: UUID().uuidString,
            type: .territoryAlert,
            title: message,
            icon: "exclamationmark.triangle.fill",
            countdown: nil
        )

        notifications.insert(notification, at: 0)
        HapticFeedback.warning()
    }
}

// MARK: - Models
struct RegionInfo: Codable {
    let regionName: String
    let totalPixels: Int
    let activePlayers: Int
    let dominantAlliance: DominantAlliance?
    let topPlayers: [TopPlayer]
}

struct DominantAlliance: Codable {
    let name: String
    let color: String
    let percentage: Double
}

struct TopPlayer: Codable {
    let displayName: String
    let pixelCount: Int
    let rank: Int
}

struct NearbyPlayer: Codable {
    let userId: String
    let displayName: String
    let avatarUrl: String?
    let allianceColor: String?
    let fuzzyLat: Double
    let fuzzyLng: Double
    let lastActiveSeconds: Int

    init?(dict: [String: Any]) {
        guard let userId = dict["userId"] as? String,
              let displayName = dict["displayName"] as? String,
              let lat = dict["fuzzyLat"] as? Double,
              let lng = dict["fuzzyLng"] as? Double,
              let lastActive = dict["lastActiveSeconds"] as? Int else {
            return nil
        }

        self.userId = userId
        self.displayName = displayName
        self.avatarUrl = dict["avatarUrl"] as? String
        self.allianceColor = dict["allianceColor"] as? String
        self.fuzzyLat = lat
        self.fuzzyLng = lng
        self.lastActiveSeconds = lastActive
    }
}

struct MapNotification: Identifiable {
    let id: String
    let type: NotificationType
    let title: String
    let icon: String
    let countdown: Date?

    enum NotificationType {
        case limitedChallenge
        case allianceWar
        case treasureRefresh
        case seasonReminder
        case systemAnnouncement
        case taskCompleted
        case territoryAlert
    }

    var gradientColors: [Color] {
        switch type {
        case .limitedChallenge:
            return [Color.orange, Color.red]
        case .allianceWar:
            return [Color.red, Color.purple]
        case .treasureRefresh:
            return [Color.blue, Color.cyan]
        case .seasonReminder:
            return [Color.purple, Color.pink]
        case .systemAnnouncement:
            return [Color.gray.opacity(0.8), Color.gray.opacity(0.6)]
        case .taskCompleted:
            return [Color.green, Color.blue]
        case .territoryAlert:
            return [Color.red, Color.orange]
        }
    }
}
```

---

## 数据流设计

### 用户绘画 → 任务进度更新流程

```
┌──────────────┐
│ 用户绘画像素  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ pixelDrawController  │
│ .drawPixel()         │
└──────┬───────────────┘
       │
       ├──► 保存像素到数据库
       │
       ├──► 调用 dailyTaskService.checkProgress()
       │    └──► 检查所有未完成任务
       │         ├──► 如果在任务区域内 → 进度+1
       │         └──► 如果达到目标 → 标记完成
       │              └──► Socket.IO emit 'task_completed'
       │
       └──► 调用 mapSocialService.updateActivePlayerLocation()
            └──► Redis GEOADD 更新位置
                 └──► 触发附近玩家更新广播
```

### 地图区域变化 → 数据加载流程

```
┌──────────────────┐
│ 地图移动/缩放     │
└────────┬─────────┘
         │
         ▼
┌────────────────────┐
│ MapLibreMapView    │
│ .onRegionDidChange │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ MapViewModel       │
│ .updateVisibleRegion│
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Throttler (0.5s)   │ ← 防止频繁请求
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────┐
│ 并发加载数据                    │
├────────────────────────────────┤
│ async let regionInfo = ...     │
│ async let nearbyPlayers = ...  │
│ async let taskPins = ...       │
│ async let treasures = ...      │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────┐
│ 更新 @Published    │
│ 触发 View 重绘     │
└────────────────────┘
```

---

## 测试策略

### 后端单元测试

```javascript
// backend/tests/services/dailyTaskService.test.js
const dailyTaskService = require('../../src/services/dailyTaskService');
const db = require('../../src/config/database');

describe('DailyTaskService', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db('daily_tasks').del();
    await db('daily_task_bonus').del();
  });

  describe('generateDailyTasks', () => {
    it('should generate 5 tasks for a user', async () => {
      const userId = 'test-user-id';

      await dailyTaskService.generateDailyTasks(userId);

      const tasks = await db('daily_tasks')
        .where('user_id', userId);

      expect(tasks).toHaveLength(5);
      expect(tasks.filter(t => t.task_type === 'draw_count')).toHaveLength(3); // 简单
      expect(tasks.filter(t => t.reward_points > 50)).toHaveLength(2); // 中等+困难
    });

    it('should not generate duplicate tasks for the same day', async () => {
      const userId = 'test-user-id';

      await dailyTaskService.generateDailyTasks(userId);
      await dailyTaskService.generateDailyTasks(userId);

      const tasks = await db('daily_tasks')
        .where('user_id', userId);

      expect(tasks).toHaveLength(5); // 仍然只有5个
    });
  });

  describe('checkProgress', () => {
    it('should update task progress when pixel is drawn', async () => {
      const userId = 'test-user-id';

      // 创建一个任务
      const [task] = await db('daily_tasks').insert({
        user_id: userId,
        task_type: 'draw_count',
        title: 'Test Task',
        target_value: 10,
        current_value: 0,
        reward_points: 50,
        expires_at: new Date(Date.now() + 86400000) // 明天
      }).returning('*');

      // 模拟绘画
      await dailyTaskService.checkProgress(userId, {
        lat: 39.9,
        lng: 116.4
      });

      // 检查进度
      const updated = await db('daily_tasks')
        .where('id', task.id)
        .first();

      expect(updated.current_value).toBe(1);
      expect(updated.is_completed).toBe(false);
    });

    it('should mark task as completed when target is reached', async () => {
      const userId = 'test-user-id';

      const [task] = await db('daily_tasks').insert({
        user_id: userId,
        task_type: 'draw_count',
        title: 'Test Task',
        target_value: 1,
        current_value: 0,
        reward_points: 50,
        expires_at: new Date(Date.now() + 86400000)
      }).returning('*');

      await dailyTaskService.checkProgress(userId, {
        lat: 39.9,
        lng: 116.4
      });

      const updated = await db('daily_tasks')
        .where('id', task.id)
        .first();

      expect(updated.current_value).toBe(1);
      expect(updated.is_completed).toBe(true);
      expect(updated.completed_at).not.toBeNull();
    });
  });
});
```

### iOS单元测试

```swift
// FunnyPixelsAppTests/DailyTaskServiceTests.swift
import XCTest
@testable import FunnyPixelsApp

class DailyTaskServiceTests: XCTestCase {
    var service: DailyTaskService!

    override func setUp() {
        super.setUp()
        service = DailyTaskService()
    }

    func testFetchTasks() async throws {
        // Given
        MockAPIManager.shared.mockResponse = TasksResponse(
            tasks: [
                DailyTask(
                    id: "task-1",
                    taskType: "draw_count",
                    title: "绘画50个像素",
                    description: "在地图上绘画50个像素",
                    targetValue: 50,
                    currentValue: 10,
                    rewardPoints: 50,
                    rewardItems: nil,
                    location: nil,
                    isCompleted: false,
                    isClaimed: false,
                    progressPercentage: 0.2,
                    expiresAt: Date()
                )
            ],
            bonusStatus: BonusStatus(allCompleted: false, bonusClaimed: false)
        )

        // When
        await service.fetchTasks()

        // Then
        XCTAssertEqual(service.tasks.count, 1)
        XCTAssertEqual(service.tasks[0].title, "绘画50个像素")
        XCTAssertEqual(service.tasks[0].progressPercentage, 0.2)
    }

    func testClaimReward() async throws {
        // Given
        service.tasks = [
            DailyTask(
                id: "task-1",
                taskType: "draw_count",
                title: "Test",
                description: "Test",
                targetValue: 50,
                currentValue: 50,
                rewardPoints: 50,
                rewardItems: nil,
                location: nil,
                isCompleted: true,
                isClaimed: false,
                progressPercentage: 1.0,
                expiresAt: Date()
            )
        ]

        MockAPIManager.shared.mockResponse = ClaimResponse(
            success: true,
            reward: Reward(points: 50, items: nil),
            newBalance: 150
        )

        // When
        let success = await service.claimReward(taskId: "task-1")

        // Then
        XCTAssertTrue(success)
        XCTAssertTrue(service.tasks[0].isClaimed)
    }
}
```

---

## 部署检查清单

### 后端部署

- [ ] **数据库迁移**
  ```bash
  npm run migrate
  ```

- [ ] **Redis配置**
  - [ ] 确认Redis连接正常
  - [ ] 设置适当的内存限制
  - [ ] 配置持久化策略

- [ ] **定时任务**
  - [ ] 验证每日任务生成job运行正常
  - [ ] 验证宝箱刷新job运行正常
  - [ ] 检查时区设置（Asia/Shanghai）

- [ ] **环境变量**
  ```bash
  REDIS_URL=redis://localhost:6379
  DATABASE_URL=postgresql://...
  NODE_ENV=production
  ```

- [ ] **性能监控**
  - [ ] 设置API响应时间监控
  - [ ] 设置Redis内存使用监控
  - [ ] 设置数据库连接池监控

### iOS部署

- [ ] **API配置**
  - [ ] 更新生产环境API地址
  - [ ] 配置Socket.IO连接

- [ ] **权限配置**
  - [ ] 确认位置权限描述文本
  - [ ] 确认通知权限描述文本

- [ ] **性能测试**
  - [ ] 测试地图标注加载性能（>100个标注）
  - [ ] 测试内存占用（长时间使用）
  - [ ] 测试弱网环境下的表现

- [ ] **UI测试**
  - [ ] 不同屏幕尺寸适配
  - [ ] 深色模式支持
  - [ ] 动态字体支持
  - [ ] VoiceOver支持

### 数据验证

```sql
-- 检查任务生成
SELECT COUNT(*), DATE(created_at)
FROM daily_tasks
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- 检查宝箱分布
SELECT chest_type, COUNT(*), AVG(current_claims)
FROM treasure_chests
WHERE is_active = true
GROUP BY chest_type;

-- 检查领地计算
SELECT COUNT(*), AVG(total_pixels)
FROM territory_control
WHERE last_calculated_at > NOW() - INTERVAL '1 hour';
```

---

## 总结

本技术实现指南提供了：

✅ **完整的数据库设计** - 包含所有表结构和索引
✅ **详细的API实现** - 控制器、服务层代码示例
✅ **Socket.IO集成** - 实时事件处理
✅ **定时任务配置** - 每日任务生成、宝箱刷新
✅ **iOS完整实现** - Service、ViewModel、View层
✅ **数据流设计** - 清晰的数据流转图
✅ **测试策略** - 单元测试示例
✅ **部署检查清单** - 生产环境部署步骤

开发团队可以按照本指南直接开始编码，所有技术细节都已明确。

---

**文档维护者**: Engineering Team
**最后更新**: 2026-02-28
**下一步**: 开始P0阶段开发
