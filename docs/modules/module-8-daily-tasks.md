# Module 8: 每日任务系统 - 技术方案

> **模块代号**: Module 8
> **模块名称**: 每日任务系统 (Daily Task System)
> **依赖模块**: 无
> **预计工作量**: 1-2周 (约60小时)
> **优先级**: 高 (核心留存功能)

---

## 一、产品需求

### 1.1 功能需求

#### FR1: 每日任务生成
- **描述**: 系统每天0点为所有用户生成当日任务
- **任务类型**:
  - **新手任务**: 完成首次Session、加入联盟、上传头像等
  - **日常任务**: 绘制N像素、连续绘画N米、完成N个Session
  - **挑战任务**: 连续绘画7天、在3个不同城市绘画、获得N个点赞
- **任务难度**: 简单、中等、困难（奖励递增）
- **个性化**: 根据用户等级、历史活跃度动态调整任务难度
- **用户故事**:
  ```
  作为用户，我希望每天登录时看到3个新的每日任务，
  以便通过完成任务获得奖励并保持活跃。
  ```

#### FR2: 任务进度实时追踪
- **描述**: 用户进行绘画等操作时，任务进度实时更新
- **追踪维度**:
  - 像素数累加（当日、全局）
  - 距离累加（当日、全局）
  - Session次数统计（当日、全局）
  - 城市访问记录（去重）
  - 连续天数统计
- **更新策略**:
  - 高频操作（绘画）: Redis实时更新
  - 低频操作（加入联盟）: 直接写DB
  - 每5分钟同步Redis → PostgreSQL
- **用户故事**:
  ```
  作为用户，我希望在绘画过程中看到任务进度条实时增长，
  以便了解距离完成还有多远。
  ```

#### FR3: 任务完成与奖励领取
- **描述**: 任务完成后，用户可领取奖励
- **奖励类型**:
  - **积分**: 用于商城兑换道具
  - **经验值**: 提升用户等级
  - **道具**: 特殊画笔、颜色包、加速卡等
  - **称号**: 任务大师、绘画达人等
- **领取方式**:
  - 手动领取（默认）: 用户点击"领取奖励"按钮
  - 自动领取（可选）: 任务完成后自动发放
- **奖励发放**: 集成背包系统，奖励直接进入用户背包
- **用户故事**:
  ```
  作为用户，我希望在完成任务后领取奖励，
  并能在背包中查看获得的道具。
  ```

#### FR4: 任务历史与成就
- **描述**: 用户可查看历史任务完成情况
- **展示维度**:
  - 今日任务完成度（3/3）
  - 本周任务完成总数
  - 总完成任务数（成就统计）
  - 连续完成天数
- **成就徽章**: 完成特定里程碑解锁徽章（如"7日任务大师"）
- **用户故事**:
  ```
  作为用户，我希望查看自己连续完成任务的天数，
  以便有成就感并保持习惯。
  ```

---

### 1.2 非功能需求

#### NFR1: 性能要求
- 任务列表查询 P95 < 100ms
- 任务进度更新 P95 < 50ms（Redis）
- 任务完成验证 < 200ms
- 每日任务生成（100万用户）< 5分钟

#### NFR2: 数据准确性
- 任务进度与实际操作一致（误差 < 1%）
- 防止重复领取奖励
- 防止刷任务作弊

#### NFR3: 可扩展性
- 任务类型可扩展（未来支持社交任务、联盟任务等）
- 奖励类型可扩展（未来支持VIP天数、皮肤等）

---

## 二、架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     iOS App (SwiftUI)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ TaskListView │  │ TaskCardView │  │ RewardPopup  │ │
│  │ (任务列表)   │  │ (进度条)     │  │ (奖励弹窗)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           │                            │
│                  ┌────────▼────────┐                   │
│                  │  TaskService    │                   │
│                  │  (任务查询/领取)│                   │
│                  └────────┬────────┘                   │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  Backend (Node.js/Express)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Task API     │  │ Progress API │  │ Reward API   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│                  ┌────────▼────────┐                    │
│                  │ taskController  │                    │
│                  └────────┬────────┘                    │
│                           │                             │
│         ┌─────────────────┼─────────────────┐           │
│         │                 │                 │           │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐  │
│  │ Task        │   │ Progress    │   │ Reward      │  │
│  │ Generator   │   │ Tracker     │   │ Distributor │  │
│  │ (每日0点)   │   │ (Redis实时) │   │ (背包集成)  │  │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘  │
│         │                 │                 │          │
│         │        ┌────────▼────────┐        │          │
│         │        │  Redis Cache    │        │          │
│         │        │ (进度/状态)     │        │          │
│         │        └────────┬────────┘        │          │
│         │                 │                 │          │
│  ┌──────▼─────────────────▼─────────────────▼──────┐  │
│  │              PostgreSQL Database               │  │
│  │  - task_templates (任务模板)                   │  │
│  │  - user_tasks (用户任务实例)                   │  │
│  │  - task_rewards (奖励配置)                     │  │
│  │  - user_inventory (用户背包)                   │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              Scheduled Jobs (Cron)                     │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Daily Task       │  │ Progress Sync    │          │
│  │ Generator        │  │ (Redis → DB)     │          │
│  │ (00:00 Daily)    │  │ (Every 5 min)    │          │
│  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │
│           └─────────────────────┼─────────────────────┘
│                                 │
│                        ┌────────▼────────┐
│                        │ taskGenerator   │
│                        │ Service         │
│                        └─────────────────┘
└────────────────────────────────────────────────────────┘
```

### 2.2 数据流

#### 任务生成流程 (每日0点)
```
1. Cron Job触发: 每天0:00 (Asia/Shanghai)
   ↓
2. taskGeneratorService.generateDailyTasks()
   ↓
3. 查询所有活跃用户（最近7天有登录）
   ↓
4. For each user:
   ├─ 查询用户等级、历史活跃度
   ├─ 选择3个任务模板（简单1 + 中等1 + 困难1）
   ├─ 插入user_tasks表（status='active', progress=0）
   └─ 初始化Redis进度缓存
   ↓
5. 发送Push通知（可选）
```

#### 任务进度更新流程 (实时)
```
1. 用户完成Session / 加入联盟 / 其他操作
   ↓
2. 触发Event Hook: taskProgressService.updateProgress(userId, eventType, eventData)
   ↓
3. 查询用户今日活跃任务: SELECT * FROM user_tasks WHERE user_id=? AND date=today
   ↓
4. 遍历任务，检查event_type匹配
   ↓
5. 更新Redis进度: HINCRBY task:progress:{taskId} current_progress delta
   ↓
6. 检查是否完成:
   ├─ 如果 current_progress >= target_value:
   │  ├─ 更新DB: status='completed', completed_at=NOW()
   │  ├─ 触发通知: "任务已完成！"
   │  └─ 返回 { completed: true, reward: {...} }
   └─ 否则: 返回 { completed: false, progress: 60% }
```

#### 奖励领取流程
```
1. iOS: 用户点击"领取奖励"按钮
   ↓
2. POST /api/tasks/:taskId/claim
   ↓
3. Backend验证:
   ├─ 任务是否完成 (status='completed')
   ├─ 奖励是否已领取 (reward_claimed=false)
   └─ 防重复领取（Redis SET NX）
   ↓
4. 发放奖励:
   ├─ 积分: users.points += reward.points
   ├─ 经验值: users.exp += reward.exp
   ├─ 道具: INSERT INTO user_inventory
   └─ 称号: INSERT INTO user_titles
   ↓
5. 更新任务状态: reward_claimed=true, claimed_at=NOW()
   ↓
6. 返回奖励详情 + 领取动画数据
```

---

## 三、数据库设计

### 3.1 任务模板表

#### task_templates 表（静态模板，运营配置）
```sql
CREATE TABLE task_templates (
  id SERIAL PRIMARY KEY,
  template_code VARCHAR(50) UNIQUE NOT NULL,  -- 模板唯一标识，如 'daily_pixels_100'
  name VARCHAR(100) NOT NULL,                 -- 任务名称（中文）
  name_en VARCHAR(100),                        -- 任务名称（英文）
  description TEXT,                            -- 任务描述

  category VARCHAR(20) NOT NULL,               -- 任务类别: 'newbie', 'daily', 'challenge'
  difficulty VARCHAR(20) NOT NULL,             -- 难度: 'easy', 'medium', 'hard'

  -- 触发条件
  event_type VARCHAR(50) NOT NULL,             -- 触发事件类型: 'session_complete', 'pixels_draw', 'alliance_join', etc.
  target_type VARCHAR(50) NOT NULL,            -- 目标类型: 'cumulative', 'count', 'boolean', 'streak'
  target_value INTEGER NOT NULL,               -- 目标值（如绘制100像素、完成3个Session）

  -- 奖励配置
  reward_points INTEGER DEFAULT 0,             -- 积分奖励
  reward_exp INTEGER DEFAULT 0,                -- 经验值奖励
  reward_items JSONB,                          -- 道具奖励（JSON数组）
  /* 示例:
  [
    { "item_id": "brush_rainbow", "quantity": 1 },
    { "item_id": "color_pack_premium", "quantity": 1 }
  ]
  */

  -- 可见性与权重
  is_active BOOLEAN DEFAULT TRUE,              -- 是否启用
  weight INTEGER DEFAULT 1,                    -- 随机选择权重（越大越容易被选中）
  min_user_level INTEGER DEFAULT 1,            -- 最低用户等级要求
  max_user_level INTEGER DEFAULT 999,          -- 最高用户等级（超过后不再出现）

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON task_templates(category);
CREATE INDEX idx_templates_difficulty ON task_templates(difficulty);
CREATE INDEX idx_templates_active ON task_templates(is_active);
```

**示例数据**:
```sql
INSERT INTO task_templates (template_code, name, name_en, description, category, difficulty, event_type, target_type, target_value, reward_points, reward_exp, reward_items, weight) VALUES
  ('daily_pixels_50', '每日绘画：50像素', 'Daily Drawing: 50 Pixels', '今天绘制50个像素', 'daily', 'easy', 'pixels_draw', 'cumulative', 50, 10, 5, NULL, 10),
  ('daily_pixels_200', '每日绘画：200像素', 'Daily Drawing: 200 Pixels', '今天绘制200个像素', 'daily', 'medium', 'pixels_draw', 'cumulative', 200, 30, 15, '[ {"item_id": "color_pack_basic", "quantity": 1} ]', 8),
  ('daily_pixels_500', '挑战：500像素', 'Challenge: 500 Pixels', '今天绘制500个像素', 'daily', 'hard', 'pixels_draw', 'cumulative', 500, 100, 50, '[ {"item_id": "brush_rainbow", "quantity": 1} ]', 5),
  ('daily_sessions_3', '完成3个Session', 'Complete 3 Sessions', '今天完成3个绘画Session', 'daily', 'medium', 'session_complete', 'count', 3, 40, 20, NULL, 7),
  ('daily_distance_1000', '绘画1000米', 'Draw 1000 Meters', '今天连续绘画1000米', 'daily', 'hard', 'distance_draw', 'cumulative', 1000, 80, 40, NULL, 6),
  ('newbie_first_session', '首次绘画', 'First Drawing', '完成你的第一次绘画', 'newbie', 'easy', 'session_complete', 'count', 1, 50, 25, '[ {"item_id": "welcome_gift", "quantity": 1} ]', 1),
  ('newbie_join_alliance', '加入联盟', 'Join Alliance', '加入一个联盟', 'newbie', 'easy', 'alliance_join', 'boolean', 1, 30, 15, NULL, 1),
  ('challenge_7day_streak', '连续7天绘画', '7-Day Streak', '连续7天完成绘画任务', 'challenge', 'hard', 'daily_task_complete', 'streak', 7, 200, 100, '[ {"item_id": "title_7day_master", "quantity": 1} ]', 3);
```

### 3.2 用户任务实例表

#### user_tasks 表（用户每日任务实例）
```sql
CREATE TABLE user_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES task_templates(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,                     -- 任务所属日期（用于区分每日任务）

  -- 任务快照（防止模板修改影响已生成任务）
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL,
  reward_points INTEGER DEFAULT 0,
  reward_exp INTEGER DEFAULT 0,
  reward_items JSONB,

  -- 进度追踪
  current_progress INTEGER DEFAULT 0,          -- 当前进度（如已绘制50像素）
  status VARCHAR(20) DEFAULT 'active',         -- 状态: 'active', 'completed', 'expired', 'claimed'

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,                      -- 任务完成时间
  claimed_at TIMESTAMP,                        -- 奖励领取时间
  expires_at TIMESTAMP,                        -- 任务过期时间（默认次日0点）

  UNIQUE (user_id, template_id, task_date)     -- 同一天同一用户不能有重复任务
);

CREATE INDEX idx_user_tasks_user_date ON user_tasks(user_id, task_date DESC);
CREATE INDEX idx_user_tasks_status ON user_tasks(status);
CREATE INDEX idx_user_tasks_expires ON user_tasks(expires_at);
```

### 3.3 用户背包表

#### user_inventory 表（用户道具背包）
```sql
CREATE TABLE user_inventory (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL,                -- 道具ID（如 'brush_rainbow', 'color_pack_premium'）
  quantity INTEGER DEFAULT 1,                  -- 数量
  source VARCHAR(50),                          -- 来源: 'daily_task', 'purchase', 'gift', 'achievement'
  source_id INTEGER,                           -- 来源ID（如task_id）

  obtained_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,                        -- 道具过期时间（可选，如限时道具）
  used_at TIMESTAMP,                           -- 使用时间（如果是一次性道具）

  UNIQUE (user_id, item_id, source, source_id) -- 防止重复发放同一任务奖励
);

CREATE INDEX idx_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_inventory_item ON user_inventory(item_id);
```

### 3.4 扩展users表

```sql
-- 添加积分和经验值字段
ALTER TABLE users
  ADD COLUMN points INTEGER DEFAULT 0,         -- 积分（用于商城兑换）
  ADD COLUMN exp INTEGER DEFAULT 0,            -- 经验值（用于等级提升）
  ADD COLUMN level INTEGER DEFAULT 1;          -- 用户等级
```

### 3.5 数据库迁移脚本

#### Migration: 20260228100003_create_task_tables.js
```javascript
exports.up = async function(knex) {
  // 1. Create task_templates table
  await knex.schema.createTable('task_templates', (table) => {
    table.increments('id').primary();
    table.string('template_code', 50).unique().notNullable();
    table.string('name', 100).notNullable();
    table.string('name_en', 100);
    table.text('description');

    table.string('category', 20).notNullable();
    table.string('difficulty', 20).notNullable();

    table.string('event_type', 50).notNullable();
    table.string('target_type', 50).notNullable();
    table.integer('target_value').notNullable();

    table.integer('reward_points').defaultTo(0);
    table.integer('reward_exp').defaultTo(0);
    table.jsonb('reward_items');

    table.boolean('is_active').defaultTo(true);
    table.integer('weight').defaultTo(1);
    table.integer('min_user_level').defaultTo(1);
    table.integer('max_user_level').defaultTo(999);

    table.timestamps(true, true);

    table.index('category');
    table.index('difficulty');
    table.index('is_active');
  });

  // 2. Create user_tasks table
  await knex.schema.createTable('user_tasks', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('template_id').unsigned().references('id').inTable('task_templates').onDelete('CASCADE');
    table.date('task_date').notNullable();

    table.string('name', 100).notNullable();
    table.text('description');
    table.integer('target_value').notNullable();
    table.integer('reward_points').defaultTo(0);
    table.integer('reward_exp').defaultTo(0);
    table.jsonb('reward_items');

    table.integer('current_progress').defaultTo(0);
    table.string('status', 20).defaultTo('active');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.timestamp('claimed_at');
    table.timestamp('expires_at');

    table.unique(['user_id', 'template_id', 'task_date']);
    table.index(['user_id', 'task_date']);
    table.index('status');
    table.index('expires_at');
  });

  // 3. Create user_inventory table
  await knex.schema.createTable('user_inventory', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('item_id', 50).notNullable();
    table.integer('quantity').defaultTo(1);
    table.string('source', 50);
    table.integer('source_id');

    table.timestamp('obtained_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at');
    table.timestamp('used_at');

    table.unique(['user_id', 'item_id', 'source', 'source_id']);
    table.index('user_id');
    table.index('item_id');
  });

  // 4. Extend users table
  await knex.schema.table('users', (table) => {
    table.integer('points').defaultTo(0);
    table.integer('exp').defaultTo(0);
    table.integer('level').defaultTo(1);
  });
};

exports.down = async function(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('points');
    table.dropColumn('exp');
    table.dropColumn('level');
  });
  await knex.schema.dropTableIfExists('user_inventory');
  await knex.schema.dropTableIfExists('user_tasks');
  await knex.schema.dropTableIfExists('task_templates');
};
```

#### Migration: 20260228100004_seed_task_templates.js
```javascript
exports.up = async function(knex) {
  await knex('task_templates').insert([
    // 新手任务
    {
      template_code: 'newbie_first_session',
      name: '首次绘画',
      name_en: 'First Drawing',
      description: '完成你的第一次绘画Session',
      category: 'newbie',
      difficulty: 'easy',
      event_type: 'session_complete',
      target_type: 'count',
      target_value: 1,
      reward_points: 50,
      reward_exp: 25,
      reward_items: JSON.stringify([{ item_id: 'welcome_gift', quantity: 1 }]),
      weight: 1
    },
    {
      template_code: 'newbie_join_alliance',
      name: '加入联盟',
      name_en: 'Join Alliance',
      description: '加入一个联盟，开始团队协作',
      category: 'newbie',
      difficulty: 'easy',
      event_type: 'alliance_join',
      target_type: 'boolean',
      target_value: 1,
      reward_points: 30,
      reward_exp: 15,
      weight: 1
    },

    // 简单日常任务
    {
      template_code: 'daily_pixels_50',
      name: '每日绘画：50像素',
      name_en: 'Daily Drawing: 50 Pixels',
      description: '今天绘制50个像素',
      category: 'daily',
      difficulty: 'easy',
      event_type: 'pixels_draw',
      target_type: 'cumulative',
      target_value: 50,
      reward_points: 10,
      reward_exp: 5,
      weight: 10
    },
    {
      template_code: 'daily_sessions_1',
      name: '完成1个Session',
      name_en: 'Complete 1 Session',
      description: '今天完成1个绘画Session',
      category: 'daily',
      difficulty: 'easy',
      event_type: 'session_complete',
      target_type: 'count',
      target_value: 1,
      reward_points: 15,
      reward_exp: 8,
      weight: 9
    },

    // 中等日常任务
    {
      template_code: 'daily_pixels_200',
      name: '每日绘画：200像素',
      name_en: 'Daily Drawing: 200 Pixels',
      description: '今天绘制200个像素',
      category: 'daily',
      difficulty: 'medium',
      event_type: 'pixels_draw',
      target_type: 'cumulative',
      target_value: 200,
      reward_points: 30,
      reward_exp: 15,
      reward_items: JSON.stringify([{ item_id: 'color_pack_basic', quantity: 1 }]),
      weight: 8
    },
    {
      template_code: 'daily_sessions_3',
      name: '完成3个Session',
      name_en: 'Complete 3 Sessions',
      description: '今天完成3个绘画Session',
      category: 'daily',
      difficulty: 'medium',
      event_type: 'session_complete',
      target_type: 'count',
      target_value: 3,
      reward_points: 40,
      reward_exp: 20,
      weight: 7
    },
    {
      template_code: 'daily_distance_500',
      name: '绘画500米',
      name_en: 'Draw 500 Meters',
      description: '今天连续绘画500米',
      category: 'daily',
      difficulty: 'medium',
      event_type: 'distance_draw',
      target_type: 'cumulative',
      target_value: 500,
      reward_points: 35,
      reward_exp: 18,
      weight: 7
    },

    // 困难日常任务
    {
      template_code: 'daily_pixels_500',
      name: '挑战：500像素',
      name_en: 'Challenge: 500 Pixels',
      description: '今天绘制500个像素',
      category: 'daily',
      difficulty: 'hard',
      event_type: 'pixels_draw',
      target_type: 'cumulative',
      target_value: 500,
      reward_points: 100,
      reward_exp: 50,
      reward_items: JSON.stringify([{ item_id: 'brush_rainbow', quantity: 1 }]),
      weight: 5
    },
    {
      template_code: 'daily_distance_1000',
      name: '绘画1000米',
      name_en: 'Draw 1000 Meters',
      description: '今天连续绘画1000米',
      category: 'daily',
      difficulty: 'hard',
      event_type: 'distance_draw',
      target_type: 'cumulative',
      target_value: 1000,
      reward_points: 80,
      reward_exp: 40,
      weight: 6
    },

    // 挑战任务
    {
      template_code: 'challenge_7day_streak',
      name: '连续7天绘画',
      name_en: '7-Day Streak',
      description: '连续7天完成绘画任务',
      category: 'challenge',
      difficulty: 'hard',
      event_type: 'daily_task_complete',
      target_type: 'streak',
      target_value: 7,
      reward_points: 200,
      reward_exp: 100,
      reward_items: JSON.stringify([{ item_id: 'title_7day_master', quantity: 1 }]),
      weight: 3
    }
  ]);
};

exports.down = async function(knex) {
  await knex('task_templates').del();
};
```

---

## 四、Backend API 设计

### 4.1 API Endpoints

#### 1. 获取今日任务列表

**Endpoint**: `GET /api/tasks/today`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 123,
        "name": "每日绘画：50像素",
        "description": "今天绘制50个像素",
        "difficulty": "easy",
        "target_value": 50,
        "current_progress": 30,
        "progress_percentage": 60,
        "status": "active",
        "reward": {
          "points": 10,
          "exp": 5,
          "items": []
        },
        "expires_at": "2026-02-29T00:00:00Z"
      },
      {
        "id": 124,
        "name": "完成3个Session",
        "description": "今天完成3个绘画Session",
        "difficulty": "medium",
        "target_value": 3,
        "current_progress": 1,
        "progress_percentage": 33,
        "status": "active",
        "reward": {
          "points": 40,
          "exp": 20,
          "items": []
        },
        "expires_at": "2026-02-29T00:00:00Z"
      },
      {
        "id": 125,
        "name": "挑战：500像素",
        "description": "今天绘制500个像素",
        "difficulty": "hard",
        "target_value": 500,
        "current_progress": 0,
        "progress_percentage": 0,
        "status": "active",
        "reward": {
          "points": 100,
          "exp": 50,
          "items": [
            { "item_id": "brush_rainbow", "name": "彩虹画笔", "quantity": 1 }
          ]
        },
        "expires_at": "2026-02-29T00:00:00Z"
      }
    ],
    "summary": {
      "total_tasks": 3,
      "completed_tasks": 0,
      "completion_percentage": 0
    }
  }
}
```

---

#### 2. 领取任务奖励

**Endpoint**: `POST /api/tasks/:taskId/claim`

**Request**: 无Body

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "task_id": 123,
    "reward": {
      "points": 10,
      "exp": 5,
      "items": [],
      "total_points_now": 1150,
      "total_exp_now": 325,
      "level_up": false
    },
    "claimed_at": "2026-02-28T15:30:00Z"
  }
}
```

**Error Responses**:
```json
// 任务未完成
{ "success": false, "error": "Task not completed yet" }

// 奖励已领取
{ "success": false, "error": "Reward already claimed" }

// 任务已过期
{ "success": false, "error": "Task expired" }
```

---

#### 3. 获取任务历史

**Endpoint**: `GET /api/tasks/history`

**Query Parameters**:
```
limit: Integer (optional, default=30)
offset: Integer (optional, default=0)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2026-02-27",
        "tasks": [
          {
            "id": 120,
            "name": "每日绘画：50像素",
            "status": "claimed",
            "completed_at": "2026-02-27T18:30:00Z",
            "claimed_at": "2026-02-27T18:31:00Z",
            "reward": { "points": 10, "exp": 5 }
          },
          {
            "id": 121,
            "name": "完成3个Session",
            "status": "expired",
            "completed_at": null,
            "current_progress": 2,
            "target_value": 3
          }
        ],
        "completion_rate": 0.5
      }
      // ... more dates
    ],
    "stats": {
      "total_completed": 45,
      "current_streak": 5,
      "longest_streak": 12,
      "completion_rate": 0.75
    }
  }
}
```

---

#### 4. 获取用户背包

**Endpoint**: `GET /api/inventory`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 456,
        "item_id": "brush_rainbow",
        "name": "彩虹画笔",
        "description": "绘制时显示彩虹轨迹",
        "quantity": 2,
        "source": "daily_task",
        "obtained_at": "2026-02-25T10:00:00Z",
        "icon_url": "https://cdn.example.com/items/brush_rainbow.png"
      },
      {
        "id": 457,
        "item_id": "color_pack_premium",
        "name": "高级颜色包",
        "description": "解锁20种特殊颜色",
        "quantity": 1,
        "source": "daily_task",
        "obtained_at": "2026-02-26T15:30:00Z",
        "icon_url": "https://cdn.example.com/items/color_pack_premium.png"
      }
    ],
    "total_items": 2
  }
}
```

---

### 4.2 Controller 实现

#### backend/src/controllers/taskController.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');
const { format, startOfDay, endOfDay } = require('date-fns');

/**
 * GET /api/tasks/today
 * 获取今日任务列表
 */
async function getTodayTasks(req, res) {
  try {
    const userId = req.user.id;
    const today = format(new Date(), 'yyyy-MM-dd');

    // 查询今日任务
    const tasks = await db('user_tasks')
      .where({ user_id: userId, task_date: today })
      .whereIn('status', ['active', 'completed'])
      .select('*');

    // 从Redis获取实时进度
    const tasksWithProgress = await Promise.all(tasks.map(async (task) => {
      let currentProgress = task.current_progress;

      // 如果任务还active，从Redis获取最新进度
      if (task.status === 'active') {
        const redisKey = `task:progress:${task.id}`;
        const redisProgress = await redisUtils.get(redisKey);
        if (redisProgress !== null) {
          currentProgress = parseInt(redisProgress);
        }
      }

      return {
        id: task.id,
        name: task.name,
        description: task.description,
        difficulty: await getDifficultyFromTemplate(task.template_id),
        target_value: task.target_value,
        current_progress: currentProgress,
        progress_percentage: Math.min(100, Math.round((currentProgress / task.target_value) * 100)),
        status: task.status,
        reward: {
          points: task.reward_points,
          exp: task.reward_exp,
          items: task.reward_items || []
        },
        expires_at: task.expires_at
      };
    }));

    const completedCount = tasksWithProgress.filter(t => t.status === 'completed').length;

    res.json({
      success: true,
      data: {
        tasks: tasksWithProgress,
        summary: {
          total_tasks: tasks.length,
          completed_tasks: completedCount,
          completion_percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('getTodayTasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today tasks' });
  }
}

async function getDifficultyFromTemplate(templateId) {
  const template = await db('task_templates').where({ id: templateId }).first('difficulty');
  return template?.difficulty || 'easy';
}

/**
 * POST /api/tasks/:taskId/claim
 * 领取任务奖励
 */
async function claimReward(req, res) {
  const trx = await db.transaction();

  try {
    const userId = req.user.id;
    const taskId = parseInt(req.params.taskId);

    // 1. 查询任务
    const task = await trx('user_tasks')
      .where({ id: taskId, user_id: userId })
      .first();

    if (!task) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // 2. 验证任务状态
    if (task.status !== 'completed') {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Task not completed yet' });
    }

    if (task.claimed_at) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Reward already claimed' });
    }

    if (task.expires_at && new Date(task.expires_at) < new Date()) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Task expired' });
    }

    // 3. 防重复领取（Redis SET NX）
    const claimLockKey = `task:claim:${taskId}`;
    const lockAcquired = await redisUtils.setnx(claimLockKey, '1');
    if (!lockAcquired) {
      await trx.rollback();
      return res.status(409).json({ success: false, error: 'Reward claim already in progress' });
    }
    await redisUtils.expire(claimLockKey, 10); // 10秒后自动释放

    // 4. 发放奖励
    const user = await trx('users').where({ id: userId }).first('points', 'exp', 'level');
    const newPoints = user.points + task.reward_points;
    const newExp = user.exp + task.reward_exp;

    // 检查是否升级（简化版，100经验 = 1级）
    const newLevel = Math.floor(newExp / 100) + 1;
    const levelUp = newLevel > user.level;

    await trx('users')
      .where({ id: userId })
      .update({
        points: newPoints,
        exp: newExp,
        level: newLevel
      });

    // 5. 发放道具奖励
    if (task.reward_items && Array.isArray(task.reward_items)) {
      for (const item of task.reward_items) {
        await trx('user_inventory').insert({
          user_id: userId,
          item_id: item.item_id,
          quantity: item.quantity || 1,
          source: 'daily_task',
          source_id: taskId
        });
      }
    }

    // 6. 更新任务状态
    await trx('user_tasks')
      .where({ id: taskId })
      .update({
        status: 'claimed',
        claimed_at: new Date()
      });

    await trx.commit();

    // 释放锁
    await redisUtils.del(claimLockKey);

    res.json({
      success: true,
      data: {
        task_id: taskId,
        reward: {
          points: task.reward_points,
          exp: task.reward_exp,
          items: task.reward_items || [],
          total_points_now: newPoints,
          total_exp_now: newExp,
          level_up: levelUp,
          new_level: levelUp ? newLevel : user.level
        },
        claimed_at: new Date()
      }
    });
  } catch (error) {
    await trx.rollback();
    console.error('claimReward error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
}

/**
 * GET /api/tasks/history
 * 获取任务历史
 */
async function getTaskHistory(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;

    // 查询历史任务（按日期分组）
    const tasks = await db('user_tasks')
      .where('user_id', userId)
      .orderBy('task_date', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    // 按日期分组
    const groupedByDate = {};
    for (const task of tasks) {
      const dateStr = format(new Date(task.task_date), 'yyyy-MM-dd');
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push({
        id: task.id,
        name: task.name,
        status: task.status === 'claimed' ? 'claimed' : task.status,
        completed_at: task.completed_at,
        claimed_at: task.claimed_at,
        current_progress: task.current_progress,
        target_value: task.target_value,
        reward: {
          points: task.reward_points,
          exp: task.reward_exp,
          items: task.reward_items || []
        }
      });
    }

    // 转换为数组格式
    const history = Object.keys(groupedByDate).map(date => ({
      date,
      tasks: groupedByDate[date],
      completion_rate: groupedByDate[date].filter(t => t.status === 'claimed').length / groupedByDate[date].length
    }));

    // 计算统计数据
    const totalCompleted = await db('user_tasks')
      .where({ user_id: userId, status: 'claimed' })
      .count('id as count')
      .first();

    // 计算连续天数（简化版）
    const recentDays = await db('user_tasks')
      .where('user_id', userId)
      .where('status', 'claimed')
      .orderBy('task_date', 'desc')
      .limit(30)
      .distinct('task_date')
      .pluck('task_date');

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');

    for (let i = 0; i < 30; i++) {
      const checkDate = format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd');
      const hasCompleted = recentDays.some(d => format(new Date(d), 'yyyy-MM-dd') === checkDate);

      if (hasCompleted) {
        tempStreak++;
        if (checkDate === today || i === 0) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (checkDate < today) {
          tempStreak = 0;
        }
      }
    }

    res.json({
      success: true,
      data: {
        history,
        stats: {
          total_completed: parseInt(totalCompleted.count),
          current_streak: currentStreak,
          longest_streak: longestStreak,
          completion_rate: 0.75 // 可进一步优化计算逻辑
        }
      }
    });
  } catch (error) {
    console.error('getTaskHistory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task history' });
  }
}

/**
 * GET /api/inventory
 * 获取用户背包
 */
async function getInventory(req, res) {
  try {
    const userId = req.user.id;

    const items = await db('user_inventory')
      .where('user_id', userId)
      .whereNull('used_at')
      .orderBy('obtained_at', 'desc')
      .select('*');

    // 扩展道具信息（从静态配置或数据库获取）
    const itemsWithInfo = items.map(item => ({
      id: item.id,
      item_id: item.item_id,
      name: getItemName(item.item_id),
      description: getItemDescription(item.item_id),
      quantity: item.quantity,
      source: item.source,
      obtained_at: item.obtained_at,
      icon_url: `https://cdn.example.com/items/${item.item_id}.png`
    }));

    res.json({
      success: true,
      data: {
        items: itemsWithInfo,
        total_items: items.length
      }
    });
  } catch (error) {
    console.error('getInventory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
}

// 道具信息辅助函数（未来可迁移到数据库）
function getItemName(itemId) {
  const itemNames = {
    'brush_rainbow': '彩虹画笔',
    'color_pack_basic': '基础颜色包',
    'color_pack_premium': '高级颜色包',
    'welcome_gift': '新手礼包',
    'title_7day_master': '7日任务大师称号'
  };
  return itemNames[itemId] || itemId;
}

function getItemDescription(itemId) {
  const itemDescs = {
    'brush_rainbow': '绘制时显示彩虹轨迹',
    'color_pack_basic': '解锁10种基础颜色',
    'color_pack_premium': '解锁20种特殊颜色',
    'welcome_gift': '包含画笔、颜色包等新手道具',
    'title_7day_master': '连续7天完成任务的成就称号'
  };
  return itemDescs[itemId] || '';
}

module.exports = {
  getTodayTasks,
  claimReward,
  getTaskHistory,
  getInventory
};
```

### 4.3 Routes 配置

#### backend/src/routes/tasks.js

```javascript
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

// 所有任务路由都需要认证
router.use(authenticate);

// 今日任务
router.get('/today', taskController.getTodayTasks);

// 领取奖励
router.post('/:taskId/claim', taskController.claimReward);

// 任务历史
router.get('/history', taskController.getTaskHistory);

// 用户背包
router.get('/inventory', taskController.getInventory);

module.exports = router;
```

---

## 五、任务生成与进度追踪服务

### 5.1 每日任务生成服务

#### backend/src/services/taskGeneratorService.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');
const { format, addDays } = require('date-fns');

/**
 * 为所有活跃用户生成今日任务
 */
async function generateDailyTasksForAll() {
  console.log('[TaskGenerator] Starting daily task generation...');
  const startTime = Date.now();

  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // 查询最近7天有登录的活跃用户
    const activeUsers = await db('users')
      .where('last_login_at', '>=', new Date(Date.now() - 7 * 86400000))
      .select('id', 'level');

    console.log(`[TaskGenerator] Found ${activeUsers.length} active users`);

    // 批量生成（限制并发数为50）
    const batchSize = 50;
    let generatedCount = 0;

    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);
      await Promise.all(batch.map(user => generateDailyTasksForUser(user.id, user.level, today, tomorrow)));
      generatedCount += batch.length;
      console.log(`[TaskGenerator] Progress: ${generatedCount}/${activeUsers.length}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[TaskGenerator] Completed in ${duration}ms. Generated for ${generatedCount} users.`);
  } catch (error) {
    console.error('[TaskGenerator] Error:', error);
    throw error;
  }
}

/**
 * 为单个用户生成3个今日任务（简单1 + 中等1 + 困难1）
 */
async function generateDailyTasksForUser(userId, userLevel, today, tomorrow) {
  try {
    // 检查是否已生成今日任务
    const existingTasks = await db('user_tasks')
      .where({ user_id: userId, task_date: today })
      .count('id as count')
      .first();

    if (existingTasks.count > 0) {
      console.log(`[TaskGenerator] User ${userId} already has tasks for ${today}`);
      return;
    }

    // 选择3个任务模板（分别是简单、中等、困难）
    const easyTask = await selectRandomTemplate('easy', userLevel);
    const mediumTask = await selectRandomTemplate('medium', userLevel);
    const hardTask = await selectRandomTemplate('hard', userLevel);

    const templates = [easyTask, mediumTask, hardTask].filter(Boolean);

    // 插入user_tasks
    for (const template of templates) {
      await db('user_tasks').insert({
        user_id: userId,
        template_id: template.id,
        task_date: today,
        name: template.name,
        description: template.description,
        target_value: template.target_value,
        reward_points: template.reward_points,
        reward_exp: template.reward_exp,
        reward_items: template.reward_items,
        current_progress: 0,
        status: 'active',
        expires_at: `${tomorrow}T00:00:00Z`
      });
    }

    console.log(`[TaskGenerator] Generated ${templates.length} tasks for user ${userId}`);
  } catch (error) {
    console.error(`[TaskGenerator] Error for user ${userId}:`, error);
  }
}

/**
 * 随机选择任务模板（基于权重）
 */
async function selectRandomTemplate(difficulty, userLevel) {
  const templates = await db('task_templates')
    .where({
      difficulty: difficulty,
      is_active: true,
      category: 'daily'
    })
    .where('min_user_level', '<=', userLevel)
    .where('max_user_level', '>=', userLevel)
    .select('*');

  if (templates.length === 0) return null;

  // 加权随机选择
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const template of templates) {
    random -= template.weight;
    if (random <= 0) {
      return template;
    }
  }

  return templates[0]; // fallback
}

module.exports = {
  generateDailyTasksForAll,
  generateDailyTasksForUser
};
```

### 5.2 任务进度追踪服务

#### backend/src/services/taskProgressService.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');
const { format } = require('date-fns');

/**
 * 更新任务进度（由事件钩子调用）
 */
async function updateProgress(userId, eventType, eventData) {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');

    // 查询用户今日活跃任务
    const tasks = await db('user_tasks')
      .join('task_templates', 'user_tasks.template_id', 'task_templates.id')
      .where({
        'user_tasks.user_id': userId,
        'user_tasks.task_date': today,
        'user_tasks.status': 'active'
      })
      .where('task_templates.event_type', eventType)
      .select('user_tasks.*', 'task_templates.target_type', 'task_templates.event_type');

    if (tasks.length === 0) {
      return; // 没有匹配的任务
    }

    // 遍历任务，更新进度
    for (const task of tasks) {
      const delta = calculateDelta(task, eventData);
      if (delta === 0) continue;

      // 更新Redis进度
      const redisKey = `task:progress:${task.id}`;
      const newProgress = await redisUtils.hincrby(`task:${task.id}`, 'current_progress', delta);

      console.log(`[TaskProgress] Task ${task.id}: ${newProgress}/${task.target_value}`);

      // 检查是否完成
      if (newProgress >= task.target_value) {
        await completeTask(task.id, userId);
      }
    }
  } catch (error) {
    console.error('[TaskProgress] Error:', error);
  }
}

/**
 * 计算进度增量
 */
function calculateDelta(task, eventData) {
  switch (task.target_type) {
    case 'cumulative':
      // 累加型（如绘制像素数）
      return eventData.value || 0;

    case 'count':
      // 计数型（如完成Session次数）
      return 1;

    case 'boolean':
      // 布尔型（如加入联盟）
      return task.target_value;

    case 'streak':
      // 连续天数型（需额外逻辑）
      return eventData.streak || 0;

    default:
      return 0;
  }
}

/**
 * 完成任务
 */
async function completeTask(taskId, userId) {
  try {
    await db('user_tasks')
      .where({ id: taskId })
      .update({
        status: 'completed',
        completed_at: new Date()
      });

    // 清除Redis缓存
    await redisUtils.del(`task:${taskId}`);

    console.log(`[TaskProgress] Task ${taskId} completed for user ${userId}`);

    // TODO: 发送Push通知

  } catch (error) {
    console.error(`[TaskProgress] Error completing task ${taskId}:`, error);
  }
}

/**
 * 定时同步Redis进度到数据库（每5分钟）
 */
async function syncProgressToDB() {
  try {
    console.log('[TaskProgress] Syncing Redis progress to DB...');

    const today = format(new Date(), 'yyyy-MM-dd');

    // 查询今日所有活跃任务
    const tasks = await db('user_tasks')
      .where({ task_date: today, status: 'active' })
      .select('id', 'current_progress');

    for (const task of tasks) {
      const redisKey = `task:${task.id}`;
      const redisProgress = await redisUtils.hget(redisKey, 'current_progress');

      if (redisProgress !== null && parseInt(redisProgress) !== task.current_progress) {
        await db('user_tasks')
          .where({ id: task.id })
          .update({ current_progress: parseInt(redisProgress) });
      }
    }

    console.log(`[TaskProgress] Synced ${tasks.length} tasks`);
  } catch (error) {
    console.error('[TaskProgress] Sync error:', error);
  }
}

module.exports = {
  updateProgress,
  syncProgressToDB
};
```

### 5.3 事件钩子集成

#### backend/src/services/pixelDrawService.js（示例集成）

```javascript
const taskProgressService = require('./taskProgressService');

// 在Session完成后，触发任务进度更新
async function handleSessionComplete(userId, sessionData) {
  // ... 原有Session完成逻辑 ...

  // 触发任务进度更新
  await taskProgressService.updateProgress(userId, 'session_complete', { value: 1 });
  await taskProgressService.updateProgress(userId, 'pixels_draw', { value: sessionData.total_pixels });
  await taskProgressService.updateProgress(userId, 'distance_draw', { value: sessionData.total_distance });
}
```

---

## 六、iOS Frontend 设计

### 6.1 Service 层

#### FunnyPixelsApp/Services/TaskService.swift

```swift
import Foundation
import Combine

class TaskService {
    static let shared = TaskService()
    private let apiClient = APIClient.shared

    // MARK: - 获取今日任务

    func fetchTodayTasks() -> AnyPublisher<TaskListResponse, Error> {
        let endpoint = APIEndpoint.tasks.appendingPathComponent("today")

        return apiClient.request(url: endpoint, method: "GET", body: nil as String?)
            .decode(type: APIResponse<TaskListResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 领取奖励

    func claimReward(taskId: Int) -> AnyPublisher<ClaimRewardResponse, Error> {
        let endpoint = APIEndpoint.tasks.appendingPathComponent("\(taskId)/claim")

        return apiClient.request(url: endpoint, method: "POST", body: nil as String?)
            .decode(type: APIResponse<ClaimRewardResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 获取任务历史

    func fetchTaskHistory(limit: Int = 30, offset: Int = 0) -> AnyPublisher<TaskHistoryResponse, Error> {
        let endpoint = APIEndpoint.tasks.appendingPathComponent("history")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<TaskHistoryResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 获取背包

    func fetchInventory() -> AnyPublisher<InventoryResponse, Error> {
        let endpoint = APIEndpoint.tasks.appendingPathComponent("inventory")

        return apiClient.request(url: endpoint, method: "GET", body: nil as String?)
            .decode(type: APIResponse<InventoryResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }
}

// MARK: - Models

struct TaskListResponse: Codable {
    let tasks: [DailyTask]
    let summary: TaskSummary
}

struct DailyTask: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String
    let difficulty: String
    let targetValue: Int
    let currentProgress: Int
    let progressPercentage: Int
    let status: String
    let reward: TaskReward
    let expiresAt: Date
}

struct TaskSummary: Codable {
    let totalTasks: Int
    let completedTasks: Int
    let completionPercentage: Int
}

struct TaskReward: Codable {
    let points: Int
    let exp: Int
    let items: [RewardItem]
}

struct RewardItem: Codable, Identifiable {
    var id: String { itemId }
    let itemId: String
    let name: String?
    let quantity: Int
}

struct ClaimRewardResponse: Codable {
    let taskId: Int
    let reward: ClaimedReward
    let claimedAt: Date
}

struct ClaimedReward: Codable {
    let points: Int
    let exp: Int
    let items: [RewardItem]
    let totalPointsNow: Int
    let totalExpNow: Int
    let levelUp: Bool
    let newLevel: Int?
}

struct TaskHistoryResponse: Codable {
    let history: [DayHistory]
    let stats: TaskStats
}

struct DayHistory: Codable, Identifiable {
    var id: String { date }
    let date: String
    let tasks: [HistoricalTask]
    let completionRate: Double
}

struct HistoricalTask: Codable, Identifiable {
    let id: Int
    let name: String
    let status: String
    let completedAt: Date?
    let claimedAt: Date?
    let currentProgress: Int?
    let targetValue: Int?
    let reward: TaskReward
}

struct TaskStats: Codable {
    let totalCompleted: Int
    let currentStreak: Int
    let longestStreak: Int
    let completionRate: Double
}

struct InventoryResponse: Codable {
    let items: [InventoryItem]
    let totalItems: Int
}

struct InventoryItem: Codable, Identifiable {
    let id: Int
    let itemId: String
    let name: String
    let description: String
    let quantity: Int
    let source: String
    let obtainedAt: Date
    let iconUrl: String
}
```

### 6.2 ViewModel 层

#### FunnyPixelsApp/ViewModels/TaskListViewModel.swift

```swift
import Foundation
import Combine

class TaskListViewModel: ObservableObject {
    @Published var tasks: [DailyTask] = []
    @Published var summary: TaskSummary?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    @Published var showRewardPopup: Bool = false
    @Published var claimedReward: ClaimedReward?

    private var cancellables = Set<AnyCancellable>()
    private let taskService = TaskService.shared

    func fetchTasks() {
        isLoading = true
        errorMessage = nil

        taskService.fetchTodayTasks()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                }
            } receiveValue: { [weak self] response in
                self?.tasks = response.tasks
                self?.summary = response.summary
            }
            .store(in: &cancellables)
    }

    func claimReward(taskId: Int) {
        taskService.claimReward(taskId: taskId)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                }
            } receiveValue: { [weak self] response in
                self?.claimedReward = response.reward
                self?.showRewardPopup = true

                // 更新任务状态
                if let index = self?.tasks.firstIndex(where: { $0.id == taskId }) {
                    self?.tasks[index] = DailyTask(
                        id: self!.tasks[index].id,
                        name: self!.tasks[index].name,
                        description: self!.tasks[index].description,
                        difficulty: self!.tasks[index].difficulty,
                        targetValue: self!.tasks[index].targetValue,
                        currentProgress: self!.tasks[index].targetValue,
                        progressPercentage: 100,
                        status: "claimed",
                        reward: self!.tasks[index].reward,
                        expiresAt: self!.tasks[index].expiresAt
                    )
                }
            }
            .store(in: &cancellables)
    }
}
```

### 6.3 View 层

#### FunnyPixelsApp/Views/Tasks/TaskListView.swift

```swift
import SwiftUI

struct TaskListView: View {
    @StateObject private var viewModel = TaskListViewModel()

    var body: some View {
        ZStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 1. 每日任务进度摘要
                    if let summary = viewModel.summary {
                        TaskSummaryCard(summary: summary)
                            .padding(.horizontal)
                            .padding(.top)
                    }

                    // 2. 任务列表
                    if viewModel.isLoading {
                        ProgressView("加载中...")
                            .frame(height: 200)
                    } else if let errorMessage = viewModel.errorMessage {
                        Text("加载失败: \(errorMessage)")
                            .foregroundColor(.red)
                            .frame(height: 200)
                    } else {
                        ForEach(viewModel.tasks) { task in
                            TaskCard(task: task) {
                                viewModel.claimReward(taskId: task.id)
                            }
                            .padding(.horizontal)
                        }
                    }

                    Spacer(minLength: 100)
                }
            }

            // 奖励弹窗
            if viewModel.showRewardPopup, let reward = viewModel.claimedReward {
                RewardPopupView(reward: reward, isPresented: $viewModel.showRewardPopup)
            }
        }
        .navigationTitle("每日任务")
        .onAppear {
            viewModel.fetchTasks()
        }
    }
}

struct TaskSummaryCard: View {
    let summary: TaskSummary

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text("今日任务")
                    .font(.headline)
                Spacer()
                Text("\(summary.completedTasks)/\(summary.totalTasks)")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)
            }

            ProgressView(value: Double(summary.completedTasks), total: Double(summary.totalTasks))
                .progressViewStyle(LinearProgressViewStyle(tint: .blue))

            Text("完成度: \(summary.completionPercentage)%")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct TaskCard: View {
    let task: DailyTask
    let onClaim: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 1. 任务标题 + 难度标签
            HStack {
                Text(task.name)
                    .font(.headline)
                Spacer()
                DifficultyBadge(difficulty: task.difficulty)
            }

            // 2. 任务描述
            Text(task.description)
                .font(.subheadline)
                .foregroundColor(.secondary)

            // 3. 进度条
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("进度")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(task.currentProgress)/\(task.targetValue)")
                        .font(.caption)
                        .fontWeight(.semibold)
                }

                ProgressView(value: Double(task.currentProgress), total: Double(task.targetValue))
                    .progressViewStyle(LinearProgressViewStyle(tint: progressColor))
            }

            // 4. 奖励 + 领取按钮
            HStack {
                // 奖励图标
                HStack(spacing: 10) {
                    Label("\(task.reward.points)", systemImage: "star.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                    Label("\(task.reward.exp) EXP", systemImage: "arrow.up.circle.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                    if !task.reward.items.isEmpty {
                        Label("\(task.reward.items.count)道具", systemImage: "gift.fill")
                            .font(.caption)
                            .foregroundColor(.purple)
                    }
                }

                Spacer()

                // 领取按钮
                if task.status == "completed" {
                    Button(action: onClaim) {
                        Text("领取奖励")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .background(Color.blue)
                            .cornerRadius(8)
                    }
                } else if task.status == "claimed" {
                    Text("已领取")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .background(Color(.systemGray5))
                        .cornerRadius(8)
                } else {
                    Text("\(task.progressPercentage)%")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private var progressColor: Color {
        if task.progressPercentage >= 100 {
            return .green
        } else if task.progressPercentage >= 50 {
            return .blue
        } else {
            return .orange
        }
    }
}

struct DifficultyBadge: View {
    let difficulty: String

    var body: some View {
        Text(difficultyText)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(difficultyColor)
            .cornerRadius(5)
    }

    private var difficultyText: String {
        switch difficulty {
        case "easy": return "简单"
        case "medium": return "中等"
        case "hard": return "困难"
        default: return difficulty
        }
    }

    private var difficultyColor: Color {
        switch difficulty {
        case "easy": return .green
        case "medium": return .orange
        case "hard": return .red
        default: return .gray
        }
    }
}

struct RewardPopupView: View {
    let reward: ClaimedReward
    @Binding isPresented: Bool

    var body: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }

            VStack(spacing: 20) {
                // 庆祝图标
                Image(systemName: "checkmark.circle.fill")
                    .resizable()
                    .frame(width: 80, height: 80)
                    .foregroundColor(.green)

                Text("任务完成！")
                    .font(.title)
                    .fontWeight(.bold)

                // 奖励列表
                VStack(spacing: 10) {
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundColor(.orange)
                        Text("积分: +\(reward.points)")
                            .font(.headline)
                    }

                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                            .foregroundColor(.green)
                        Text("经验值: +\(reward.exp)")
                            .font(.headline)
                    }

                    if !reward.items.isEmpty {
                        ForEach(reward.items) { item in
                            HStack {
                                Image(systemName: "gift.fill")
                                    .foregroundColor(.purple)
                                Text("\(item.name ?? item.itemId) x\(item.quantity)")
                                    .font(.headline)
                            }
                        }
                    }

                    if reward.levelUp, let newLevel = reward.newLevel {
                        Divider()
                        HStack {
                            Image(systemName: "crown.fill")
                                .foregroundColor(.yellow)
                            Text("恭喜升级到 Lv.\(newLevel)!")
                                .font(.headline)
                                .foregroundColor(.yellow)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)

                Button(action: { isPresented = false }) {
                    Text("确定")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                }
            }
            .padding(30)
            .background(Color(.systemBackground))
            .cornerRadius(20)
            .shadow(radius: 20)
            .frame(maxWidth: 350)
        }
    }
}
```

---

## 七、定时任务配置

### 7.1 Cron Jobs

#### backend/src/services/cronJobs.js（扩展）

```javascript
const cron = require('node-cron');
const { generateDailyTasksForAll } = require('./taskGeneratorService');
const { syncProgressToDB } = require('./taskProgressService');

function startCronJobs() {
  // 每天凌晨0:00生成每日任务
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Generating daily tasks...');
    try {
      await generateDailyTasksForAll();
    } catch (error) {
      console.error('[Cron] Daily task generation failed:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每5分钟同步Redis进度到DB
  cron.schedule('*/5 * * * *', async () => {
    try {
      await syncProgressToDB();
    } catch (error) {
      console.error('[Cron] Progress sync failed:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log('[Cron] Task-related cron jobs started');
}

module.exports = { startCronJobs };
```

---

## 八、实施步骤

| 序号 | 任务 | 预计时间 | 依赖 |
|-----|------|---------|------|
| **Phase 1: 数据库与模板** |  | **1天** |  |
| 1 | 编写数据库迁移脚本（3张表） | 3h | - |
| 2 | Seed任务模板数据（10个模板） | 2h | 1 |
| 3 | 扩展users表（积分/经验/等级） | 1h | 1 |
| **Phase 2: 后端任务系统** |  | **3天** |  |
| 4 | 实现taskController（4个API） | 6h | 1 |
| 5 | 实现taskGeneratorService | 5h | 1,2 |
| 6 | 实现taskProgressService | 6h | 1 |
| 7 | 集成事件钩子（pixelDrawService等） | 4h | 6 |
| 8 | 配置Cron定时任务 | 2h | 5,6 |
| 9 | 单元测试（Controller + Service） | 6h | 4,5,6 |
| **Phase 3: iOS数据层** |  | **1.5天** |  |
| 10 | 实现TaskService（API调用） | 3h | 4 |
| 11 | 定义数据模型（Codable） | 2h | 10 |
| 12 | 实现TaskListViewModel | 4h | 10,11 |
| 13 | 单元测试（Service + ViewModel） | 3h | 10,12 |
| **Phase 4: iOS UI实现** |  | **2.5天** |  |
| 14 | 实现TaskCard组件 | 4h | 12 |
| 15 | 实现TaskListView | 4h | 12,14 |
| 16 | 实现RewardPopupView（动画） | 4h | 12 |
| 17 | 实现TaskHistoryView | 3h | 12 |
| 18 | 实现InventoryView（背包） | 3h | 12 |
| 19 | UI测试 | 2h | 15,16,17,18 |
| **Phase 5: 集成测试** |  | **1天** |  |
| 20 | 端到端测试（生成→进度→完成→领取） | 4h | 所有 |
| 21 | 性能测试（100万用户任务生成） | 3h | 5 |
| 22 | Bug修复与优化 | 5h | 20,21 |

**总计**: 约60小时（约8个工作日）

---

## 九、验收标准

### 9.1 功能验收

- [ ] 每天0点为所有活跃用户生成3个任务（简单/中等/困难）
- [ ] 用户完成绘画操作后，任务进度实时更新
- [ ] 任务完成后，用户可领取奖励（积分/经验/道具）
- [ ] 防止重复领取奖励
- [ ] 任务历史正确显示过去30天数据
- [ ] 用户背包正确显示已获得道具

### 9.2 性能验收

- [ ] 任务列表查询 P95 < 100ms
- [ ] 任务进度更新 P95 < 50ms
- [ ] 每日任务生成（100万用户）< 5分钟
- [ ] Redis进度同步无数据丢失

### 9.3 数据验收

- [ ] 任务进度与实际操作一致（误差 < 1%）
- [ ] 无重复领取奖励记录
- [ ] 用户积分/经验值计算正确

---

## 十、后续优化方向

1. **社交任务**: 邀请好友、点赞他人作品等社交互动任务
2. **联盟任务**: 联盟协作任务（与Module 6联动）
3. **限时任务**: 周末双倍奖励、节日特殊任务
4. **成就系统**: 完成特定里程碑解锁徽章
5. **任务推荐**: 基于用户行为智能推荐个性化任务
6. **奖励动画**: 更炫酷的奖励领取动画（粒子效果、音效）

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
**负责人**: Backend Team + iOS Team
