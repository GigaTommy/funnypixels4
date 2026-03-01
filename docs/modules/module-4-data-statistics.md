# Module 4: 数据统计与报告 - 技术方案

> **模块代号**: Module 4
> **模块名称**: 数据统计与报告 (Data Statistics & Reports)
> **依赖模块**: 无
> **预计工作量**: 2周 (约75小时)
> **优先级**: 高 (独立模块，可立即为用户提供价值)

---

## 一、产品需求

### 1.1 功能需求

#### FR1: 趋势数据可视化
- **描述**: 用户可查看个人绘画数据趋势（像素数、距离、时长、Session次数）
- **时间维度**: 最近7天、30天、90天、全部时间
- **图表类型**: 折线图（趋势）、柱状图（对比）、环形进度（今日目标）
- **数据点**: 每日、每周、每月聚合数据
- **用户故事**:
  ```
  作为用户，我希望看到自己最近7天的绘画趋势图，
  以便了解自己的活跃度变化和进步情况。
  ```

#### FR2: 热力日历
- **描述**: GitHub风格的365天活动热力图
- **展示维度**:
  - 每日像素数（颜色深度代表活跃度）
  - 点击日期查看当天详细数据
  - 显示最长连续天数、总活跃天数
- **颜色梯度**: 无活动（灰色） → 低活跃（浅绿） → 高活跃（深绿）
- **用户故事**:
  ```
  作为用户，我希望通过热力日历一眼看出自己今年的活跃分布，
  以便激励自己保持连续绘画习惯。
  ```

#### FR3: 城市足迹
- **描述**: 用户去过的城市可视化地图
- **展示内容**:
  - 地图上标记去过的城市（圆点标记）
  - 城市列表（按首次到达时间或访问次数排序）
  - 统计维度：城市数、省份数、国家数
  - 城市详情：首次到达时间、总像素数、总Session数
- **地图底图**: 使用MapKit，支持缩放、拖拽
- **用户故事**:
  ```
  作为用户，我希望看到自己在地图上"点亮"了哪些城市，
  以便有成就感并分享给朋友。
  ```

#### FR4: 周报/月报
- **描述**: 自动生成的周度/月度数据报告
- **报告内容**:
  - 总览卡片：总像素数、总距离、总时长、Session次数
  - 排名变化：本周/月排名 vs 上周/月排名
  - 最佳成就：最长单次Session、单日最多像素、连续天数
  - 对比数据：环比增长率、同比增长率
- **触发时机**:
  - 周报：每周一早8点生成
  - 月报：每月1日早8点生成
- **分享功能**: 生成精美分享卡片（含二维码、邀请链接）
- **用户故事**:
  ```
  作为用户，我希望每周一早上收到上周的数据报告，
  以便回顾自己的表现并分享到社交媒体。
  ```

---

### 1.2 非功能需求

#### NFR1: 性能要求
- 趋势数据API响应时间 P95 < 200ms
- 热力日历数据API响应时间 P95 < 300ms
- 城市足迹数据API响应时间 P95 < 500ms
- 报告生成时间 < 3秒/用户

#### NFR2: 数据准确性
- 聚合数据与原始数据误差 < 0.1%
- 缓存数据与实时数据延迟 < 1小时

#### NFR3: 可扩展性
- 图表类型可扩展（未来支持饼图、热力图等）
- 数据维度可扩展（未来支持速度、海拔等）

---

## 二、架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     iOS App (SwiftUI)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ TrendChart   │  │ HeatmapView  │  │ CityMapView  │ │
│  │ (Swift Charts)│  │ (Custom Grid)│  │ (MapKit)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           │                            │
│                  ┌────────▼────────┐                   │
│                  │  StatsService   │                   │
│                  │  (Data Fetching)│                   │
│                  └────────┬────────┘                   │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  Backend (Node.js/Express)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Trend API    │  │ Heatmap API  │  │ City API     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│                  ┌────────▼────────┐                    │
│                  │ statsController │                    │
│                  └────────┬────────┘                    │
│                           │                             │
│         ┌─────────────────┼─────────────────┐           │
│         │                 │                 │           │
│  ┌──────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐   │
│  │ Redis Cache  │  │ Aggregation │  │ City Cache  │   │
│  │ (24h TTL)    │  │ Service     │  │ (7d TTL)    │   │
│  └──────────────┘  └──────┬──────┘  └─────────────┘   │
│                           │                            │
│                  ┌────────▼────────┐                   │
│                  │   PostgreSQL    │                   │
│                  │ (Raw + Agg Data)│                   │
│                  └─────────────────┘                   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              Scheduled Job (Cron)                      │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Weekly Report    │  │ Monthly Report   │          │
│  │ (Mon 8:00 AM)    │  │ (1st 8:00 AM)    │          │
│  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │
│           └─────────────────────┼─────────────────────┘
│                                 │
│                        ┌────────▼────────┐
│                        │ reportGenerator │
│                        │ Service         │
│                        └─────────────────┘
└────────────────────────────────────────────────────────┘
```

### 2.2 数据流

#### 趋势数据查询流程
```
1. iOS App: TrendChartView.onAppear
   ↓
2. StatsService.fetchTrendData(days: 7)
   ↓
3. GET /api/stats/trend?days=7
   ↓
4. Backend: statsController.getTrendData
   ↓
5. Check Redis: stats:trend:{userId}:{days}
   ├─ HIT: Return cached data
   └─ MISS:
      ↓
6. Aggregation Query on drawing_sessions
   ↓
7. Store in Redis (TTL=24h)
   ↓
8. Return JSON to iOS
   ↓
9. SwiftUI: Render Swift Charts
```

#### 热力日历数据流程
```
1. iOS: HeatmapView.onAppear
   ↓
2. GET /api/stats/heatmap?year=2026
   ↓
3. Check Redis: stats:heatmap:{userId}:{year}
   ├─ HIT: Return cached (365 days array)
   └─ MISS:
      ↓
4. Aggregation Query: GROUP BY DATE(created_at)
   ↓
5. Fill missing dates with 0
   ↓
6. Store in Redis (TTL=24h)
   ↓
7. Return [{ date: '2026-01-01', pixels: 150 }, ...]
   ↓
8. SwiftUI: Render 365 grid cells
```

---

## 三、数据库设计

### 3.1 数据源表（已存在）

#### drawing_sessions 表
```sql
-- 已存在表，用于数据聚合
CREATE TABLE drawing_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_pixels INTEGER DEFAULT 0,
  total_distance NUMERIC(10,2) DEFAULT 0.00,  -- meters
  duration INTEGER DEFAULT 0,                  -- seconds
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  start_location GEOGRAPHY(POINT, 4326),       -- PostGIS
  end_location GEOGRAPHY(POINT, 4326),
  center_point GEOGRAPHY(POINT, 4326)
);

CREATE INDEX idx_sessions_user_created ON drawing_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_created ON drawing_sessions(created_at DESC);
CREATE INDEX idx_sessions_center_point USING GIST (center_point);
```

### 3.2 新增表

#### user_stats_daily 表（物化每日聚合数据）
```sql
-- 物化每日统计数据，提升查询性能
CREATE TABLE user_stats_daily (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_pixels INTEGER DEFAULT 0,
  total_distance NUMERIC(10,2) DEFAULT 0.00,
  total_duration INTEGER DEFAULT 0,           -- seconds
  session_count INTEGER DEFAULT 0,
  unique_cities INTEGER DEFAULT 0,            -- 当天去过的城市数

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, date)
);

CREATE INDEX idx_daily_user_date ON user_stats_daily(user_id, date DESC);
CREATE INDEX idx_daily_date ON user_stats_daily(date DESC);
```

**为什么需要物化表？**
- 实时聚合 `drawing_sessions` 表在百万级数据时性能下降
- 每日统计数据不会变化（已过去的日期），适合缓存
- 热力日历需要365天数据，单次查询扫描大量行

**数据同步策略**:
- 定时任务：每天凌晨0:30聚合前一天数据
- 增量更新：当天数据实时查询 `drawing_sessions`（缓存1小时）

#### city_visits 表（用户访问过的城市）
```sql
CREATE TABLE city_visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  city_name VARCHAR(100) NOT NULL,
  city_name_en VARCHAR(100),
  province VARCHAR(100),
  country VARCHAR(100) DEFAULT 'China',

  first_visit_at TIMESTAMP,
  last_visit_at TIMESTAMP,
  visit_count INTEGER DEFAULT 1,
  total_pixels INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,

  location GEOGRAPHY(POINT, 4326),             -- 城市中心坐标

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, city_name, country)
);

CREATE INDEX idx_city_visits_user ON city_visits(user_id);
CREATE INDEX idx_city_visits_location USING GIST (location);
```

**城市识别策略**:
- 使用高德地图逆地理编码API（已在iOS端集成）
- Session结束时，逆地理编码 `center_point` → 城市名
- 后端接收城市名，更新 `city_visits` 表

#### user_reports 表（周报/月报存储）
```sql
CREATE TABLE user_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(20) NOT NULL,           -- 'weekly' | 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- 报告数据（JSON格式）
  summary_data JSONB NOT NULL,
  /* 示例结构:
  {
    "total_pixels": 5000,
    "total_distance": 12500.00,
    "total_duration": 7200,
    "session_count": 25,
    "rank": 150,
    "rank_change": +20,
    "best_achievements": {
      "longest_session": { "id": 123, "duration": 1800, "distance": 2500 },
      "most_pixels_day": { "date": "2026-02-15", "pixels": 500 }
    },
    "comparison": {
      "week_over_week": { "pixels": "+20%", "distance": "+15%" }
    }
  }
  */

  share_image_url VARCHAR(500),               -- 分享卡片图片URL

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, report_type, period_start)
);

CREATE INDEX idx_reports_user_type ON user_reports(user_id, report_type, period_start DESC);
```

### 3.3 数据库迁移脚本

#### Migration: 20260228100001_create_stats_tables.js
```javascript
exports.up = async function(knex) {
  // 1. Create user_stats_daily table
  await knex.schema.createTable('user_stats_daily', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.date('date').notNullable();
    table.integer('total_pixels').defaultTo(0);
    table.decimal('total_distance', 10, 2).defaultTo(0.00);
    table.integer('total_duration').defaultTo(0);
    table.integer('session_count').defaultTo(0);
    table.integer('unique_cities').defaultTo(0);
    table.timestamps(true, true);

    table.unique(['user_id', 'date']);
    table.index(['user_id', 'date']);
    table.index('date');
  });

  // 2. Create city_visits table
  await knex.schema.createTable('city_visits', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('city_name', 100).notNullable();
    table.string('city_name_en', 100);
    table.string('province', 100);
    table.string('country', 100).defaultTo('China');

    table.timestamp('first_visit_at');
    table.timestamp('last_visit_at');
    table.integer('visit_count').defaultTo(1);
    table.integer('total_pixels').defaultTo(0);
    table.integer('total_sessions').defaultTo(0);

    table.specificType('location', 'geography(point, 4326)');

    table.timestamps(true, true);

    table.unique(['user_id', 'city_name', 'country']);
    table.index('user_id');
  });

  // 3. Create GiST index on location (PostGIS)
  await knex.raw(`
    CREATE INDEX idx_city_visits_location
    ON city_visits
    USING GIST (location);
  `);

  // 4. Create user_reports table
  await knex.schema.createTable('user_reports', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('report_type', 20).notNullable();
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.jsonb('summary_data').notNullable();
    table.string('share_image_url', 500);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'report_type', 'period_start']);
    table.index(['user_id', 'report_type', 'period_start']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_reports');
  await knex.schema.dropTableIfExists('city_visits');
  await knex.schema.dropTableIfExists('user_stats_daily');
};
```

#### Migration: 20260228100002_backfill_daily_stats.js
```javascript
// 回填历史数据到 user_stats_daily
exports.up = async function(knex) {
  console.log('Backfilling user_stats_daily from drawing_sessions...');

  // 聚合历史数据（限制最近90天，避免单次执行时间过长）
  await knex.raw(`
    INSERT INTO user_stats_daily (user_id, date, total_pixels, total_distance, total_duration, session_count)
    SELECT
      user_id,
      DATE(created_at AT TIME ZONE 'Asia/Shanghai') AS date,
      SUM(total_pixels) AS total_pixels,
      SUM(total_distance) AS total_distance,
      SUM(duration) AS total_duration,
      COUNT(*) AS session_count
    FROM drawing_sessions
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY user_id, date
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      total_pixels = EXCLUDED.total_pixels,
      total_distance = EXCLUDED.total_distance,
      total_duration = EXCLUDED.total_duration,
      session_count = EXCLUDED.session_count,
      updated_at = NOW();
  `);

  console.log('Backfill completed.');
};

exports.down = async function(knex) {
  // 回滚时清空表（保留表结构）
  await knex('user_stats_daily').del();
};
```

---

## 四、Backend API 设计

### 4.1 API Endpoints

#### 1. 趋势数据 API

**Endpoint**: `GET /api/stats/trend`

**Query Parameters**:
```
days: Integer (optional, default=7)
  - 可选值: 7, 30, 90, 365, 'all'
  - 示例: ?days=30
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "period": "last_7_days",
    "start_date": "2026-02-21",
    "end_date": "2026-02-27",
    "data_points": [
      {
        "date": "2026-02-21",
        "pixels": 150,
        "distance": 500.00,
        "duration": 1200,
        "sessions": 3
      },
      {
        "date": "2026-02-22",
        "pixels": 200,
        "distance": 650.00,
        "duration": 1500,
        "sessions": 4
      }
      // ... 7 days total
    ],
    "summary": {
      "total_pixels": 1200,
      "total_distance": 4500.00,
      "total_duration": 9000,
      "total_sessions": 25,
      "avg_pixels_per_day": 171,
      "avg_distance_per_day": 642.86,
      "most_active_day": "2026-02-24"
    }
  }
}
```

**Error Responses**:
```json
// 401 Unauthorized
{ "success": false, "error": "Authentication required" }

// 400 Bad Request
{ "success": false, "error": "Invalid days parameter" }
```

---

#### 2. 热力日历数据 API

**Endpoint**: `GET /api/stats/heatmap`

**Query Parameters**:
```
year: Integer (optional, default=current year)
  - 示例: ?year=2026
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "days": [
      { "date": "2026-01-01", "pixels": 0 },
      { "date": "2026-01-02", "pixels": 150 },
      { "date": "2026-01-03", "pixels": 200 },
      // ... 365 days total
      { "date": "2026-12-31", "pixels": 180 }
    ],
    "stats": {
      "total_active_days": 180,
      "total_pixels": 45000,
      "max_pixels_day": { "date": "2026-06-15", "pixels": 500 },
      "longest_streak": 15,
      "current_streak": 3
    },
    "color_scale": {
      "level_0": { "threshold": 0, "color": "#ebedf0" },      // 无活动
      "level_1": { "threshold": 1, "color": "#9be9a8" },      // 1-50 像素
      "level_2": { "threshold": 50, "color": "#40c463" },     // 51-150
      "level_3": { "threshold": 150, "color": "#30a14e" },    // 151-300
      "level_4": { "threshold": 300, "color": "#216e39" }     // 300+
    }
  }
}
```

---

#### 3. 城市足迹 API

**Endpoint**: `GET /api/stats/cities`

**Query Parameters**:
```
sort: String (optional, default='first_visit')
  - 可选值: 'first_visit', 'last_visit', 'pixels', 'sessions'
  - 示例: ?sort=pixels
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_cities": 15,
      "total_provinces": 5,
      "total_countries": 2
    },
    "cities": [
      {
        "id": 123,
        "city_name": "杭州",
        "city_name_en": "Hangzhou",
        "province": "浙江省",
        "country": "China",
        "first_visit_at": "2026-01-15T10:30:00Z",
        "last_visit_at": "2026-02-20T15:45:00Z",
        "visit_count": 12,
        "total_pixels": 2500,
        "total_sessions": 35,
        "location": {
          "latitude": 30.2741,
          "longitude": 120.1551
        }
      },
      {
        "id": 124,
        "city_name": "上海",
        "city_name_en": "Shanghai",
        "province": "上海市",
        "country": "China",
        "first_visit_at": "2026-02-01T08:00:00Z",
        "last_visit_at": "2026-02-05T18:30:00Z",
        "visit_count": 5,
        "total_pixels": 800,
        "total_sessions": 15,
        "location": {
          "latitude": 31.2304,
          "longitude": 121.4737
        }
      }
      // ... more cities
    ]
  }
}
```

---

#### 4. 报告详情 API

**Endpoint**: `GET /api/stats/reports/:reportType`

**Path Parameters**:
```
reportType: String ('weekly' | 'monthly')
```

**Query Parameters**:
```
period: String (optional, default='latest')
  - 'latest': 最新一期报告
  - ISO date: 指定周期开始日期，如 '2026-02-17'
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "report_id": 456,
    "report_type": "weekly",
    "period_start": "2026-02-17",
    "period_end": "2026-02-23",
    "summary": {
      "total_pixels": 1200,
      "total_distance": 5000.00,
      "total_duration": 10800,
      "session_count": 30
    },
    "ranking": {
      "current_rank": 150,
      "previous_rank": 170,
      "rank_change": 20,
      "percentile": 85.5
    },
    "best_achievements": {
      "longest_session": {
        "session_id": 789,
        "duration": 1800,
        "distance": 2500.00,
        "date": "2026-02-20"
      },
      "most_pixels_day": {
        "date": "2026-02-22",
        "pixels": 350
      },
      "longest_streak": 7
    },
    "comparison": {
      "week_over_week": {
        "pixels": "+20.5%",
        "distance": "+15.3%",
        "sessions": "+10.0%"
      }
    },
    "share_image_url": "https://cdn.example.com/reports/weekly_456.png",
    "created_at": "2026-02-24T08:00:00Z"
  }
}
```

---

#### 5. 城市访问记录 API (用于Session完成后更新)

**Endpoint**: `POST /api/stats/cities/visit`

**Request Body**:
```json
{
  "session_id": 123,
  "city_name": "杭州",
  "city_name_en": "Hangzhou",
  "province": "浙江省",
  "country": "China",
  "location": {
    "latitude": 30.2741,
    "longitude": 120.1551
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "city_visit_id": 456,
    "is_first_visit": false,
    "total_cities": 15
  }
}
```

---

### 4.2 Controller 实现

#### backend/src/controllers/statsController.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');
const { startOfDay, endOfDay, subDays, startOfYear, endOfYear } = require('date-fns');

/**
 * GET /api/stats/trend
 * 获取用户趋势数据
 */
async function getTrendData(req, res) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 7;

    // 验证参数
    if (![7, 30, 90, 365].includes(days) && req.query.days !== 'all') {
      return res.status(400).json({ success: false, error: 'Invalid days parameter' });
    }

    // 检查Redis缓存
    const cacheKey = `stats:trend:${userId}:${days}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    // 计算日期范围
    const endDate = new Date();
    const startDate = days === 'all' ? new Date('2020-01-01') : subDays(endDate, days - 1);

    // 查询聚合数据（优先使用物化表）
    const cutoffDate = subDays(new Date(), 1); // 昨天及之前的数据从物化表读取

    // 1. 从物化表读取历史数据
    const historicalData = await db('user_stats_daily')
      .where('user_id', userId)
      .whereBetween('date', [startDate.toISOString().split('T')[0], cutoffDate.toISOString().split('T')[0]])
      .orderBy('date', 'asc')
      .select('date', 'total_pixels as pixels', 'total_distance as distance', 'total_duration as duration', 'session_count as sessions');

    // 2. 实时聚合今天的数据
    const todayData = await db('drawing_sessions')
      .where('user_id', userId)
      .whereBetween('created_at', [startOfDay(new Date()), endOfDay(new Date())])
      .select(
        db.raw(`DATE(created_at AT TIME ZONE 'Asia/Shanghai') AS date`),
        db.raw('SUM(total_pixels) AS pixels'),
        db.raw('SUM(total_distance) AS distance'),
        db.raw('SUM(duration) AS duration'),
        db.raw('COUNT(*) AS sessions')
      )
      .groupByRaw(`DATE(created_at AT TIME ZONE 'Asia/Shanghai')`);

    // 3. 合并数据
    const allData = [...historicalData, ...todayData];

    // 4. 填充缺失日期（用0补齐）
    const dataPoints = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const existingData = allData.find(item => item.date === dateStr || item.date.toISOString().split('T')[0] === dateStr);
      dataPoints.push({
        date: dateStr,
        pixels: existingData ? parseInt(existingData.pixels) : 0,
        distance: existingData ? parseFloat(existingData.distance) : 0.00,
        duration: existingData ? parseInt(existingData.duration) : 0,
        sessions: existingData ? parseInt(existingData.sessions) : 0
      });
    }

    // 5. 计算汇总统计
    const summary = {
      total_pixels: dataPoints.reduce((sum, d) => sum + d.pixels, 0),
      total_distance: dataPoints.reduce((sum, d) => sum + d.distance, 0),
      total_duration: dataPoints.reduce((sum, d) => sum + d.duration, 0),
      total_sessions: dataPoints.reduce((sum, d) => sum + d.sessions, 0),
      avg_pixels_per_day: Math.round(dataPoints.reduce((sum, d) => sum + d.pixels, 0) / days),
      avg_distance_per_day: parseFloat((dataPoints.reduce((sum, d) => sum + d.distance, 0) / days).toFixed(2)),
      most_active_day: dataPoints.reduce((max, d) => d.pixels > max.pixels ? d : max, dataPoints[0])?.date
    };

    const result = {
      period: `last_${days}_days`,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      data_points: dataPoints,
      summary
    };

    // 缓存24小时
    await redisUtils.setex(cacheKey, 86400, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getTrendData error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trend data' });
  }
}

/**
 * GET /api/stats/heatmap
 * 获取热力日历数据（365天）
 */
async function getHeatmapData(req, res) {
  try {
    const userId = req.user.id;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // 检查Redis缓存
    const cacheKey = `stats:heatmap:${userId}:${year}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    // 计算年份范围
    const startDate = startOfYear(new Date(year, 0, 1));
    const endDate = endOfYear(new Date(year, 11, 31));

    // 查询全年数据（优先使用物化表）
    const rawData = await db('user_stats_daily')
      .where('user_id', userId)
      .whereBetween('date', [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])
      .orderBy('date', 'asc')
      .select('date', 'total_pixels as pixels');

    // 填充365天（闰年366天）
    const daysInYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
    const days = [];
    for (let i = 0; i < daysInYear; i++) {
      const d = new Date(year, 0, 1 + i);
      const dateStr = d.toISOString().split('T')[0];
      const existingData = rawData.find(item => item.date === dateStr || item.date.toISOString().split('T')[0] === dateStr);
      days.push({
        date: dateStr,
        pixels: existingData ? parseInt(existingData.pixels) : 0
      });
    }

    // 计算统计数据
    const activeDays = days.filter(d => d.pixels > 0);
    const maxPixelsDay = activeDays.reduce((max, d) => d.pixels > max.pixels ? d : max, { pixels: 0 });

    // 计算连续天数
    let longestStreak = 0, currentStreak = 0, tempStreak = 0;
    for (const day of days) {
      if (day.pixels > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    // 计算当前连续天数（从最后一天倒推）
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].pixels > 0) currentStreak++;
      else break;
    }

    const stats = {
      total_active_days: activeDays.length,
      total_pixels: days.reduce((sum, d) => sum + d.pixels, 0),
      max_pixels_day: maxPixelsDay,
      longest_streak: longestStreak,
      current_streak: currentStreak
    };

    const result = {
      year,
      days,
      stats,
      color_scale: {
        level_0: { threshold: 0, color: '#ebedf0' },
        level_1: { threshold: 1, color: '#9be9a8' },
        level_2: { threshold: 50, color: '#40c463' },
        level_3: { threshold: 150, color: '#30a14e' },
        level_4: { threshold: 300, color: '#216e39' }
      }
    };

    // 缓存24小时
    await redisUtils.setex(cacheKey, 86400, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getHeatmapData error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch heatmap data' });
  }
}

/**
 * GET /api/stats/cities
 * 获取城市足迹
 */
async function getCityFootprint(req, res) {
  try {
    const userId = req.user.id;
    const sortBy = req.query.sort || 'first_visit';

    // 检查Redis缓存
    const cacheKey = `stats:cities:${userId}:${sortBy}`;
    const cached = await redisUtils.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    // 排序字段映射
    const sortFieldMap = {
      'first_visit': 'first_visit_at',
      'last_visit': 'last_visit_at',
      'pixels': 'total_pixels',
      'sessions': 'total_sessions'
    };
    const sortField = sortFieldMap[sortBy] || 'first_visit_at';

    // 查询城市列表
    const cities = await db('city_visits')
      .where('user_id', userId)
      .orderBy(sortField, 'desc')
      .select(
        'id',
        'city_name',
        'city_name_en',
        'province',
        'country',
        'first_visit_at',
        'last_visit_at',
        'visit_count',
        'total_pixels',
        'total_sessions',
        db.raw(`ST_Y(location::geometry) AS latitude`),
        db.raw(`ST_X(location::geometry) AS longitude`)
      );

    // 格式化返回数据
    const formattedCities = cities.map(city => ({
      id: city.id,
      city_name: city.city_name,
      city_name_en: city.city_name_en,
      province: city.province,
      country: city.country,
      first_visit_at: city.first_visit_at,
      last_visit_at: city.last_visit_at,
      visit_count: city.visit_count,
      total_pixels: city.total_pixels,
      total_sessions: city.total_sessions,
      location: {
        latitude: parseFloat(city.latitude),
        longitude: parseFloat(city.longitude)
      }
    }));

    // 计算汇总统计
    const uniqueProvinces = new Set(cities.map(c => c.province)).size;
    const uniqueCountries = new Set(cities.map(c => c.country)).size;

    const result = {
      summary: {
        total_cities: cities.length,
        total_provinces: uniqueProvinces,
        total_countries: uniqueCountries
      },
      cities: formattedCities
    };

    // 缓存7天（城市数据变化较慢）
    await redisUtils.setex(cacheKey, 604800, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getCityFootprint error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch city footprint' });
  }
}

/**
 * POST /api/stats/cities/visit
 * 记录城市访问（Session完成时调用）
 */
async function recordCityVisit(req, res) {
  try {
    const userId = req.user.id;
    const { session_id, city_name, city_name_en, province, country, location } = req.body;

    // 验证参数
    if (!session_id || !city_name || !location) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // 查询Session数据
    const session = await db('drawing_sessions').where({ id: session_id, user_id: userId }).first();
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // 检查是否已存在该城市记录
    const existingCity = await db('city_visits')
      .where({ user_id: userId, city_name, country: country || 'China' })
      .first();

    let cityVisitId, isFirstVisit;

    if (existingCity) {
      // 更新已有记录
      await db('city_visits')
        .where({ id: existingCity.id })
        .update({
          last_visit_at: new Date(),
          visit_count: db.raw('visit_count + 1'),
          total_pixels: db.raw('total_pixels + ?', [session.total_pixels]),
          total_sessions: db.raw('total_sessions + 1'),
          updated_at: new Date()
        });
      cityVisitId = existingCity.id;
      isFirstVisit = false;
    } else {
      // 插入新记录
      const [newCity] = await db('city_visits').insert({
        user_id: userId,
        city_name,
        city_name_en,
        province,
        country: country || 'China',
        first_visit_at: session.created_at,
        last_visit_at: session.created_at,
        visit_count: 1,
        total_pixels: session.total_pixels,
        total_sessions: 1,
        location: db.raw(`ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography`, [location.longitude, location.latitude])
      }).returning('id');
      cityVisitId = newCity.id;
      isFirstVisit = true;
    }

    // 清除相关缓存
    const cachePatterns = [`stats:cities:${userId}:*`];
    for (const pattern of cachePatterns) {
      await redisUtils.delPattern(pattern);
    }

    // 查询总城市数
    const totalCities = await db('city_visits').where('user_id', userId).count('id as count').first();

    res.json({
      success: true,
      data: {
        city_visit_id: cityVisitId,
        is_first_visit: isFirstVisit,
        total_cities: parseInt(totalCities.count)
      }
    });
  } catch (error) {
    console.error('recordCityVisit error:', error);
    res.status(500).json({ success: false, error: 'Failed to record city visit' });
  }
}

/**
 * GET /api/stats/reports/:reportType
 * 获取报告详情
 */
async function getReport(req, res) {
  try {
    const userId = req.user.id;
    const reportType = req.params.reportType; // 'weekly' | 'monthly'
    const period = req.query.period || 'latest';

    // 验证报告类型
    if (!['weekly', 'monthly'].includes(reportType)) {
      return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    let report;
    if (period === 'latest') {
      // 查询最新报告
      report = await db('user_reports')
        .where({ user_id: userId, report_type: reportType })
        .orderBy('period_start', 'desc')
        .first();
    } else {
      // 查询指定周期报告
      report = await db('user_reports')
        .where({ user_id: userId, report_type: reportType, period_start: period })
        .first();
    }

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // 解析JSON数据
    const data = {
      report_id: report.id,
      report_type: report.report_type,
      period_start: report.period_start,
      period_end: report.period_end,
      ...report.summary_data,
      share_image_url: report.share_image_url,
      created_at: report.created_at
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('getReport error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch report' });
  }
}

module.exports = {
  getTrendData,
  getHeatmapData,
  getCityFootprint,
  recordCityVisit,
  getReport
};
```

### 4.3 Routes 配置

#### backend/src/routes/stats.js

```javascript
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');

// 所有stats路由都需要认证
router.use(authenticate);

// 趋势数据
router.get('/trend', statsController.getTrendData);

// 热力日历
router.get('/heatmap', statsController.getHeatmapData);

// 城市足迹
router.get('/cities', statsController.getCityFootprint);
router.post('/cities/visit', statsController.recordCityVisit);

// 报告
router.get('/reports/:reportType', statsController.getReport);

module.exports = router;
```

#### 注册路由（backend/src/server.js）

```javascript
// 在现有路由注册后添加
const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);
```

---

## 五、定时任务设计

### 5.1 每日数据聚合任务

**执行时间**: 每天凌晨0:30

**功能**: 聚合前一天的 `drawing_sessions` 数据到 `user_stats_daily`

#### backend/src/services/dailyStatsAggregationService.js

```javascript
const db = require('../config/database');
const { subDays } = require('date-fns');

/**
 * 聚合指定日期的用户统计数据
 */
async function aggregateDailyStats(targetDate) {
  const dateStr = targetDate.toISOString().split('T')[0];
  console.log(`[DailyStatsAggregation] Aggregating data for ${dateStr}...`);

  try {
    // 聚合并插入/更新
    const result = await db.raw(`
      INSERT INTO user_stats_daily (user_id, date, total_pixels, total_distance, total_duration, session_count)
      SELECT
        user_id,
        DATE(created_at AT TIME ZONE 'Asia/Shanghai') AS date,
        SUM(total_pixels) AS total_pixels,
        SUM(total_distance) AS total_distance,
        SUM(duration) AS total_duration,
        COUNT(*) AS session_count
      FROM drawing_sessions
      WHERE DATE(created_at AT TIME ZONE 'Asia/Shanghai') = ?
      GROUP BY user_id, date
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        total_pixels = EXCLUDED.total_pixels,
        total_distance = EXCLUDED.total_distance,
        total_duration = EXCLUDED.total_duration,
        session_count = EXCLUDED.session_count,
        updated_at = NOW()
    `, [dateStr]);

    console.log(`[DailyStatsAggregation] Completed for ${dateStr}. Rows affected: ${result.rowCount}`);
    return result.rowCount;
  } catch (error) {
    console.error(`[DailyStatsAggregation] Error for ${dateStr}:`, error);
    throw error;
  }
}

/**
 * 定时任务：每天凌晨0:30执行
 */
async function scheduledAggregation() {
  const yesterday = subDays(new Date(), 1);
  await aggregateDailyStats(yesterday);
}

module.exports = {
  aggregateDailyStats,
  scheduledAggregation
};
```

### 5.2 周报生成任务

**执行时间**: 每周一早上8:00

**功能**: 为所有活跃用户生成上周报告

#### backend/src/services/reportGenerationService.js

```javascript
const db = require('../config/database');
const { startOfWeek, endOfWeek, subWeeks, format } = require('date-fns');

/**
 * 生成周报
 */
async function generateWeeklyReport(userId, weekStart) {
  console.log(`[WeeklyReport] Generating for user ${userId}, week starting ${weekStart}...`);

  try {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // 周一为起始日
    const previousWeekStart = subWeeks(weekStart, 1);
    const previousWeekEnd = endOfWeek(previousWeekStart, { weekStartsOn: 1 });

    // 1. 查询本周数据
    const currentWeekData = await db('user_stats_daily')
      .where('user_id', userId)
      .whereBetween('date', [format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')])
      .select(
        db.raw('SUM(total_pixels) AS total_pixels'),
        db.raw('SUM(total_distance) AS total_distance'),
        db.raw('SUM(total_duration) AS total_duration'),
        db.raw('SUM(session_count) AS session_count')
      )
      .first();

    // 2. 查询上周数据（用于对比）
    const previousWeekData = await db('user_stats_daily')
      .where('user_id', userId)
      .whereBetween('date', [format(previousWeekStart, 'yyyy-MM-dd'), format(previousWeekEnd, 'yyyy-MM-dd')])
      .select(
        db.raw('SUM(total_pixels) AS total_pixels'),
        db.raw('SUM(total_distance) AS total_distance')
      )
      .first();

    // 3. 查询排名（基于累计像素）
    const user = await db('users').where('id', userId).first('total_pixels');
    const currentRank = await db('users')
      .where('total_pixels', '>', user.total_pixels)
      .count('id as count')
      .first();

    // 4. 查询最佳成就
    const longestSession = await db('drawing_sessions')
      .where('user_id', userId)
      .whereBetween('created_at', [weekStart, weekEnd])
      .orderBy('duration', 'desc')
      .first('id', 'duration', 'total_distance', 'created_at');

    const mostPixelsDay = await db('user_stats_daily')
      .where('user_id', userId)
      .whereBetween('date', [format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')])
      .orderBy('total_pixels', 'desc')
      .first('date', 'total_pixels');

    // 5. 计算环比增长
    const pixelsGrowth = previousWeekData.total_pixels > 0
      ? ((currentWeekData.total_pixels - previousWeekData.total_pixels) / previousWeekData.total_pixels * 100).toFixed(1)
      : '100';
    const distanceGrowth = previousWeekData.total_distance > 0
      ? ((currentWeekData.total_distance - previousWeekData.total_distance) / previousWeekData.total_distance * 100).toFixed(1)
      : '100';

    // 6. 组装报告数据
    const summaryData = {
      total_pixels: parseInt(currentWeekData.total_pixels) || 0,
      total_distance: parseFloat(currentWeekData.total_distance) || 0.00,
      total_duration: parseInt(currentWeekData.total_duration) || 0,
      session_count: parseInt(currentWeekData.session_count) || 0,
      ranking: {
        current_rank: parseInt(currentRank.count) + 1,
        previous_rank: null, // 需要额外查询历史排名表
        rank_change: null,
        percentile: null
      },
      best_achievements: {
        longest_session: longestSession ? {
          session_id: longestSession.id,
          duration: longestSession.duration,
          distance: parseFloat(longestSession.total_distance),
          date: format(new Date(longestSession.created_at), 'yyyy-MM-dd')
        } : null,
        most_pixels_day: mostPixelsDay ? {
          date: format(new Date(mostPixelsDay.date), 'yyyy-MM-dd'),
          pixels: mostPixelsDay.total_pixels
        } : null
      },
      comparison: {
        week_over_week: {
          pixels: `${pixelsGrowth >= 0 ? '+' : ''}${pixelsGrowth}%`,
          distance: `${distanceGrowth >= 0 ? '+' : ''}${distanceGrowth}%`
        }
      }
    };

    // 7. 插入报告记录
    const [report] = await db('user_reports').insert({
      user_id: userId,
      report_type: 'weekly',
      period_start: format(weekStart, 'yyyy-MM-dd'),
      period_end: format(weekEnd, 'yyyy-MM-dd'),
      summary_data: summaryData,
      share_image_url: null // 可选：生成分享图片
    }).returning('*');

    console.log(`[WeeklyReport] Generated report ${report.id} for user ${userId}`);
    return report;
  } catch (error) {
    console.error(`[WeeklyReport] Error for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 批量生成周报（定时任务）
 */
async function generateAllWeeklyReports() {
  console.log('[WeeklyReport] Starting batch generation...');

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  // 查询上周有活动的所有用户
  const activeUsers = await db('user_stats_daily')
    .whereBetween('date', [format(lastWeekStart, 'yyyy-MM-dd'), format(endOfWeek(lastWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd')])
    .distinct('user_id')
    .pluck('user_id');

  console.log(`[WeeklyReport] Found ${activeUsers.length} active users`);

  // 批量生成（限制并发数为10）
  const batchSize = 10;
  for (let i = 0; i < activeUsers.length; i += batchSize) {
    const batch = activeUsers.slice(i, i + batchSize);
    await Promise.all(batch.map(userId => generateWeeklyReport(userId, lastWeekStart)));
  }

  console.log('[WeeklyReport] Batch generation completed');
}

module.exports = {
  generateWeeklyReport,
  generateAllWeeklyReports
};
```

### 5.3 Cron 配置

#### backend/src/services/cronJobs.js

```javascript
const cron = require('node-cron');
const { scheduledAggregation } = require('./dailyStatsAggregationService');
const { generateAllWeeklyReports } = require('./reportGenerationService');

/**
 * 启动所有定时任务
 */
function startCronJobs() {
  // 每天凌晨0:30聚合前一天数据
  cron.schedule('30 0 * * *', async () => {
    console.log('[Cron] Running daily stats aggregation...');
    try {
      await scheduledAggregation();
    } catch (error) {
      console.error('[Cron] Daily aggregation failed:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每周一早上8:00生成周报
  cron.schedule('0 8 * * 1', async () => {
    console.log('[Cron] Generating weekly reports...');
    try {
      await generateAllWeeklyReports();
    } catch (error) {
      console.error('[Cron] Weekly report generation failed:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log('[Cron] All cron jobs started');
}

module.exports = { startCronJobs };
```

#### 在服务器启动时启用（backend/src/server.js）

```javascript
// 在文件末尾添加
const { startCronJobs } = require('./services/cronJobs');
startCronJobs();
```

---

## 六、iOS Frontend 设计

### 6.1 Service 层

#### FunnyPixelsApp/Services/StatsService.swift

```swift
import Foundation
import Combine

class StatsService {
    static let shared = StatsService()
    private let apiClient = APIClient.shared

    // MARK: - 趋势数据

    func fetchTrendData(days: Int = 7) -> AnyPublisher<TrendDataResponse, Error> {
        let endpoint = APIEndpoint.stats.appendingPathComponent("trend")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "days", value: "\(days)")]

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<TrendDataResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 热力日历

    func fetchHeatmapData(year: Int? = nil) -> AnyPublisher<HeatmapDataResponse, Error> {
        let endpoint = APIEndpoint.stats.appendingPathComponent("heatmap")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        if let year = year {
            components.queryItems = [URLQueryItem(name: "year", value: "\(year)")]
        }

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<HeatmapDataResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 城市足迹

    func fetchCityFootprint(sortBy: String = "first_visit") -> AnyPublisher<CityFootprintResponse, Error> {
        let endpoint = APIEndpoint.stats.appendingPathComponent("cities")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "sort", value: sortBy)]

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<CityFootprintResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 记录城市访问

    func recordCityVisit(sessionId: Int, cityInfo: CityInfo) -> AnyPublisher<CityVisitResponse, Error> {
        let endpoint = APIEndpoint.stats.appendingPathComponent("cities/visit")
        let body = CityVisitRequest(
            sessionId: sessionId,
            cityName: cityInfo.cityName,
            cityNameEn: cityInfo.cityNameEn,
            province: cityInfo.province,
            country: cityInfo.country,
            location: cityInfo.location
        )

        return apiClient.request(url: endpoint, method: "POST", body: body)
            .decode(type: APIResponse<CityVisitResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    // MARK: - 报告

    func fetchReport(type: ReportType, period: String = "latest") -> AnyPublisher<ReportResponse, Error> {
        let endpoint = APIEndpoint.stats.appendingPathComponent("reports/\(type.rawValue)")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "period", value: period)]

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<ReportResponse>.self, decoder: JSONDecoder.snakeCase)
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

struct TrendDataResponse: Codable {
    let period: String
    let startDate: String
    let endDate: String
    let dataPoints: [TrendDataPoint]
    let summary: TrendSummary
}

struct TrendDataPoint: Codable, Identifiable {
    var id: String { date }
    let date: String
    let pixels: Int
    let distance: Double
    let duration: Int
    let sessions: Int
}

struct TrendSummary: Codable {
    let totalPixels: Int
    let totalDistance: Double
    let totalDuration: Int
    let totalSessions: Int
    let avgPixelsPerDay: Int
    let avgDistancePerDay: Double
    let mostActiveDay: String
}

struct HeatmapDataResponse: Codable {
    let year: Int
    let days: [HeatmapDay]
    let stats: HeatmapStats
    let colorScale: ColorScale
}

struct HeatmapDay: Codable, Identifiable {
    var id: String { date }
    let date: String
    let pixels: Int
}

struct HeatmapStats: Codable {
    let totalActiveDays: Int
    let totalPixels: Int
    let maxPixelsDay: HeatmapDay
    let longestStreak: Int
    let currentStreak: Int
}

struct ColorScale: Codable {
    let level0: ColorLevel
    let level1: ColorLevel
    let level2: ColorLevel
    let level3: ColorLevel
    let level4: ColorLevel
}

struct ColorLevel: Codable {
    let threshold: Int
    let color: String
}

struct CityFootprintResponse: Codable {
    let summary: CityFootprintSummary
    let cities: [CityVisit]
}

struct CityFootprintSummary: Codable {
    let totalCities: Int
    let totalProvinces: Int
    let totalCountries: Int
}

struct CityVisit: Codable, Identifiable {
    let id: Int
    let cityName: String
    let cityNameEn: String?
    let province: String
    let country: String
    let firstVisitAt: Date
    let lastVisitAt: Date
    let visitCount: Int
    let totalPixels: Int
    let totalSessions: Int
    let location: Coordinate
}

struct Coordinate: Codable {
    let latitude: Double
    let longitude: Double
}

struct CityInfo {
    let cityName: String
    let cityNameEn: String?
    let province: String
    let country: String
    let location: Coordinate
}

struct CityVisitRequest: Codable {
    let sessionId: Int
    let cityName: String
    let cityNameEn: String?
    let province: String
    let country: String
    let location: Coordinate
}

struct CityVisitResponse: Codable {
    let cityVisitId: Int
    let isFirstVisit: Bool
    let totalCities: Int
}

enum ReportType: String {
    case weekly
    case monthly
}

struct ReportResponse: Codable {
    let reportId: Int
    let reportType: String
    let periodStart: String
    let periodEnd: String
    let summary: ReportSummary
    let ranking: ReportRanking
    let bestAchievements: BestAchievements
    let comparison: Comparison
    let shareImageUrl: String?
    let createdAt: Date
}

struct ReportSummary: Codable {
    let totalPixels: Int
    let totalDistance: Double
    let totalDuration: Int
    let sessionCount: Int
}

struct ReportRanking: Codable {
    let currentRank: Int
    let previousRank: Int?
    let rankChange: Int?
    let percentile: Double?
}

struct BestAchievements: Codable {
    let longestSession: SessionAchievement?
    let mostPixelsDay: DayAchievement?
    let longestStreak: Int?
}

struct SessionAchievement: Codable {
    let sessionId: Int
    let duration: Int
    let distance: Double
    let date: String
}

struct DayAchievement: Codable {
    let date: String
    let pixels: Int
}

struct Comparison: Codable {
    let weekOverWeek: ComparisonMetrics?
}

struct ComparisonMetrics: Codable {
    let pixels: String
    let distance: String
    let sessions: String?
}

// JSON Decoder extension
extension JSONDecoder {
    static var snakeCase: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
```

### 6.2 ViewModel 层

#### FunnyPixelsApp/ViewModels/TrendChartViewModel.swift

```swift
import Foundation
import Combine

class TrendChartViewModel: ObservableObject {
    @Published var trendData: TrendDataResponse?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var selectedPeriod: TrendPeriod = .week

    private var cancellables = Set<AnyCancellable>()
    private let statsService = StatsService.shared

    enum TrendPeriod: Int, CaseIterable {
        case week = 7
        case month = 30
        case quarter = 90

        var title: String {
            switch self {
            case .week: return "最近7天"
            case .month: return "最近30天"
            case .quarter: return "最近90天"
            }
        }
    }

    func fetchData() {
        isLoading = true
        errorMessage = nil

        statsService.fetchTrendData(days: selectedPeriod.rawValue)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                }
            } receiveValue: { [weak self] data in
                self?.trendData = data
            }
            .store(in: &cancellables)
    }

    func changePeriod(_ period: TrendPeriod) {
        selectedPeriod = period
        fetchData()
    }
}
```

#### FunnyPixelsApp/ViewModels/HeatmapViewModel.swift

```swift
import Foundation
import Combine

class HeatmapViewModel: ObservableObject {
    @Published var heatmapData: HeatmapDataResponse?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var selectedYear: Int
    @Published var selectedDay: HeatmapDay?

    private var cancellables = Set<AnyCancellable>()
    private let statsService = StatsService.shared

    init() {
        let calendar = Calendar.current
        self.selectedYear = calendar.component(.year, from: Date())
    }

    func fetchData() {
        isLoading = true
        errorMessage = nil

        statsService.fetchHeatmapData(year: selectedYear)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                }
            } receiveValue: { [weak self] data in
                self?.heatmapData = data
            }
            .store(in: &cancellables)
    }

    func changeYear(_ year: Int) {
        selectedYear = year
        fetchData()
    }

    func selectDay(_ day: HeatmapDay) {
        selectedDay = day
    }

    func getColorForPixels(_ pixels: Int) -> String {
        guard let colorScale = heatmapData?.colorScale else { return "#ebedf0" }

        if pixels >= colorScale.level4.threshold {
            return colorScale.level4.color
        } else if pixels >= colorScale.level3.threshold {
            return colorScale.level3.color
        } else if pixels >= colorScale.level2.threshold {
            return colorScale.level2.color
        } else if pixels >= colorScale.level1.threshold {
            return colorScale.level1.color
        } else {
            return colorScale.level0.color
        }
    }
}
```

### 6.3 View 层

#### FunnyPixelsApp/Views/Stats/TrendChartView.swift

```swift
import SwiftUI
import Charts

struct TrendChartView: View {
    @StateObject private var viewModel = TrendChartViewModel()

    var body: some View {
        VStack(spacing: 20) {
            // 1. 时间周期选择器
            Picker("周期", selection: $viewModel.selectedPeriod) {
                ForEach(TrendChartViewModel.TrendPeriod.allCases, id: \.self) { period in
                    Text(period.title).tag(period)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .onChange(of: viewModel.selectedPeriod) { newPeriod in
                viewModel.changePeriod(newPeriod)
            }

            // 2. 数据卡片
            if let trendData = viewModel.trendData {
                SummaryCardsView(summary: trendData.summary)
            }

            // 3. 趋势图表
            if viewModel.isLoading {
                ProgressView("加载中...")
                    .frame(height: 250)
            } else if let errorMessage = viewModel.errorMessage {
                Text("加载失败: \(errorMessage)")
                    .foregroundColor(.red)
                    .frame(height: 250)
            } else if let trendData = viewModel.trendData {
                VStack(alignment: .leading, spacing: 10) {
                    Text("像素趋势")
                        .font(.headline)
                        .padding(.horizontal)

                    Chart(trendData.dataPoints) { dataPoint in
                        LineMark(
                            x: .value("日期", parseDate(dataPoint.date)),
                            y: .value("像素", dataPoint.pixels)
                        )
                        .foregroundStyle(Color.blue)
                        .interpolationMethod(.catmullRom)

                        AreaMark(
                            x: .value("日期", parseDate(dataPoint.date)),
                            y: .value("像素", dataPoint.pixels)
                        )
                        .foregroundStyle(Color.blue.opacity(0.2))
                        .interpolationMethod(.catmullRom)
                    }
                    .frame(height: 200)
                    .padding(.horizontal)
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .day, count: viewModel.selectedPeriod == .week ? 1 : 7)) { value in
                            AxisValueLabel(format: .dateTime.month().day())
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading)
                    }
                }
                .padding(.vertical)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .padding(.horizontal)
            }

            Spacer()
        }
        .navigationTitle("数据趋势")
        .onAppear {
            viewModel.fetchData()
        }
    }

    private func parseDate(_ dateString: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.date(from: dateString) ?? Date()
    }
}

struct SummaryCardsView: View {
    let summary: TrendSummary

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 15) {
            SummaryCard(title: "总像素", value: "\(summary.totalPixels)", icon: "paintbrush.fill", color: .blue)
            SummaryCard(title: "总距离", value: String(format: "%.1f km", summary.totalDistance / 1000), icon: "figure.walk", color: .green)
            SummaryCard(title: "总时长", value: formatDuration(summary.totalDuration), icon: "clock.fill", color: .orange)
            SummaryCard(title: "Session数", value: "\(summary.totalSessions)", icon: "list.bullet", color: .purple)
        }
        .padding(.horizontal)
    }

    private func formatDuration(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        if hours > 0 {
            return "\(hours)h\(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

#### FunnyPixelsApp/Views/Stats/HeatmapCalendarView.swift

```swift
import SwiftUI

struct HeatmapCalendarView: View {
    @StateObject private var viewModel = HeatmapViewModel()

    private let columns = 53 // 一年52-53周
    private let cellSize: CGFloat = 12
    private let cellSpacing: CGFloat = 3

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // 1. 年份选择器
                HStack {
                    Button(action: { viewModel.changeYear(viewModel.selectedYear - 1) }) {
                        Image(systemName: "chevron.left")
                    }
                    Spacer()
                    Text("\(viewModel.selectedYear)年活动日历")
                        .font(.headline)
                    Spacer()
                    Button(action: { viewModel.changeYear(viewModel.selectedYear + 1) }) {
                        Image(systemName: "chevron.right")
                    }
                    .disabled(viewModel.selectedYear >= Calendar.current.component(.year, from: Date()))
                }
                .padding(.horizontal)

                // 2. 统计卡片
                if let stats = viewModel.heatmapData?.stats {
                    HStack(spacing: 15) {
                        StatBadge(title: "活跃天数", value: "\(stats.totalActiveDays)", color: .green)
                        StatBadge(title: "最长连续", value: "\(stats.longestStreak)天", color: .orange)
                        StatBadge(title: "当前连续", value: "\(stats.currentStreak)天", color: .blue)
                    }
                    .padding(.horizontal)
                }

                // 3. 热力日历网格
                if viewModel.isLoading {
                    ProgressView("加载中...")
                        .frame(height: 200)
                } else if let heatmapData = viewModel.heatmapData {
                    VStack(alignment: .leading, spacing: 5) {
                        // 星期标签
                        HStack(spacing: 0) {
                            Text("")
                                .frame(width: 30)
                            ForEach(["一", "二", "三", "四", "五", "六", "日"], id: \.self) { day in
                                Text(day)
                                    .font(.caption2)
                                    .frame(height: cellSize)
                            }
                        }

                        // 日历网格
                        HeatmapGrid(days: heatmapData.days, viewModel: viewModel)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal)

                    // 4. 颜色图例
                    HStack {
                        Text("少")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        ForEach(0..<5) { level in
                            Rectangle()
                                .fill(Color(hex: getColorForLevel(level, colorScale: heatmapData.colorScale)))
                                .frame(width: cellSize, height: cellSize)
                        }
                        Text("多")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                }

                // 5. 选中日期详情
                if let selectedDay = viewModel.selectedDay {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(selectedDay.date)
                            .font(.headline)
                        Text("绘制像素: \(selectedDay.pixels)")
                            .font(.subheadline)
                        // 可扩展：显示当天的Session列表
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("活动热力图")
        .onAppear {
            viewModel.fetchData()
        }
    }

    private func getColorForLevel(_ level: Int, colorScale: ColorScale) -> String {
        switch level {
        case 0: return colorScale.level0.color
        case 1: return colorScale.level1.color
        case 2: return colorScale.level2.color
        case 3: return colorScale.level3.color
        case 4: return colorScale.level4.color
        default: return colorScale.level0.color
        }
    }
}

struct HeatmapGrid: View {
    let days: [HeatmapDay]
    @ObservedObject var viewModel: HeatmapViewModel

    private let cellSize: CGFloat = 12
    private let cellSpacing: CGFloat = 3

    var body: some View {
        let weeks = groupDaysByWeek(days)

        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: cellSpacing) {
                ForEach(Array(weeks.enumerated()), id: \.offset) { weekIndex, week in
                    VStack(spacing: cellSpacing) {
                        ForEach(week) { day in
                            Rectangle()
                                .fill(Color(hex: viewModel.getColorForPixels(day.pixels)))
                                .frame(width: cellSize, height: cellSize)
                                .cornerRadius(2)
                                .onTapGesture {
                                    viewModel.selectDay(day)
                                }
                        }
                    }
                }
            }
        }
    }

    private func groupDaysByWeek(_ days: [HeatmapDay]) -> [[HeatmapDay]] {
        var weeks: [[HeatmapDay]] = []
        var currentWeek: [HeatmapDay] = []

        let calendar = Calendar.current
        for day in days {
            let date = ISO8601DateFormatter().date(from: day.date + "T00:00:00Z") ?? Date()
            let weekday = calendar.component(.weekday, from: date)

            if weekday == 2 && !currentWeek.isEmpty { // 周一开始新一周
                weeks.append(currentWeek)
                currentWeek = []
            }
            currentWeek.append(day)
        }
        if !currentWeek.isEmpty {
            weeks.append(currentWeek)
        }

        return weeks
    }
}

struct StatBadge: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

// Color extension for hex support
extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted))
        var hexNumber: UInt64 = 0

        if scanner.scanHexInt64(&hexNumber) {
            let r = Double((hexNumber & 0xff0000) >> 16) / 255
            let g = Double((hexNumber & 0x00ff00) >> 8) / 255
            let b = Double(hexNumber & 0x0000ff) / 255
            self.init(red: r, green: g, blue: b)
            return
        }

        self.init(red: 0, green: 0, blue: 0)
    }
}
```

#### FunnyPixelsApp/Views/Stats/CityFootprintView.swift

```swift
import SwiftUI
import MapKit

struct CityFootprintView: View {
    @StateObject private var viewModel = CityFootprintViewModel()
    @State private var selectedSortOption: SortOption = .firstVisit

    enum SortOption: String, CaseIterable {
        case firstVisit = "first_visit"
        case lastVisit = "last_visit"
        case pixels = "pixels"
        case sessions = "sessions"

        var title: String {
            switch self {
            case .firstVisit: return "首次到达"
            case .lastVisit: return "最近到达"
            case .pixels: return "像素数"
            case .sessions: return "Session数"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // 1. 统计摘要
            if let summary = viewModel.footprintData?.summary {
                HStack(spacing: 30) {
                    SummaryItem(title: "城市", value: "\(summary.totalCities)")
                    SummaryItem(title: "省份", value: "\(summary.totalProvinces)")
                    SummaryItem(title: "国家", value: "\(summary.totalCountries)")
                }
                .padding()
                .background(Color(.systemGray6))
            }

            // 2. 地图视图
            if let cities = viewModel.footprintData?.cities {
                CityMapView(cities: cities)
                    .frame(height: 300)
            }

            // 3. 排序选择器
            Picker("排序", selection: $selectedSortOption) {
                ForEach(SortOption.allCases, id: \.self) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            .onChange(of: selectedSortOption) { newOption in
                viewModel.fetchData(sortBy: newOption.rawValue)
            }

            // 4. 城市列表
            if viewModel.isLoading {
                ProgressView("加载中...")
                    .frame(maxHeight: .infinity)
            } else if let cities = viewModel.footprintData?.cities {
                List(cities) { city in
                    CityListRow(city: city)
                }
            }
        }
        .navigationTitle("城市足迹")
        .onAppear {
            viewModel.fetchData(sortBy: selectedSortOption.rawValue)
        }
    }
}

struct SummaryItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 5) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.blue)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct CityMapView: UIViewRepresentable {
    let cities: [CityVisit]

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        // 清除已有标注
        mapView.removeAnnotations(mapView.annotations)

        // 添加城市标注
        let annotations = cities.map { city -> MKPointAnnotation in
            let annotation = MKPointAnnotation()
            annotation.coordinate = CLLocationCoordinate2D(
                latitude: city.location.latitude,
                longitude: city.location.longitude
            )
            annotation.title = city.cityName
            annotation.subtitle = "\(city.totalPixels)像素 | \(city.visitCount)次"
            return annotation
        }
        mapView.addAnnotations(annotations)

        // 调整地图区域以显示所有标注
        if !annotations.isEmpty {
            mapView.showAnnotations(annotations, animated: true)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            let identifier = "CityPin"
            var view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
            if view == nil {
                view = MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
                view?.canShowCallout = true
            } else {
                view?.annotation = annotation
            }
            return view
        }
    }
}

struct CityListRow: View {
    let city: CityVisit

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(city.cityName)
                    .font(.headline)
                if let cityNameEn = city.cityNameEn {
                    Text(cityNameEn)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(city.visitCount)次")
                    .font(.caption)
                    .padding(5)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(5)
            }

            HStack {
                Label("\(city.totalPixels)像素", systemImage: "paintbrush.fill")
                    .font(.caption)
                    .foregroundColor(.blue)
                Spacer()
                Text("首次: \(formatDate(city.firstVisitAt))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 5)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

class CityFootprintViewModel: ObservableObject {
    @Published var footprintData: CityFootprintResponse?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private var cancellables = Set<AnyCancellable>()
    private let statsService = StatsService.shared

    func fetchData(sortBy: String = "first_visit") {
        isLoading = true
        errorMessage = nil

        statsService.fetchCityFootprint(sortBy: sortBy)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                }
            } receiveValue: { [weak self] data in
                self?.footprintData = data
            }
            .store(in: &cancellables)
    }
}
```

---

## 七、性能优化

### 7.1 缓存策略

| 数据类型 | Redis Key | TTL | 失效条件 |
|---------|-----------|-----|---------|
| 趋势数据 | `stats:trend:{userId}:{days}` | 24h | 新Session完成 |
| 热力日历 | `stats:heatmap:{userId}:{year}` | 24h | 新Session完成 |
| 城市足迹 | `stats:cities:{userId}:{sortBy}` | 7d | 新城市访问 |
| 报告详情 | 无（直接查DB） | - | - |

### 7.2 数据库查询优化

**优化点**:
1. **物化表**: `user_stats_daily` 避免实时聚合大表
2. **复合索引**: `(user_id, date)` 覆盖大部分查询
3. **分页查询**: 城市列表支持分页（未来扩展）
4. **GIST索引**: PostGIS地理位置查询

---

## 八、实施步骤

| 序号 | 任务 | 负责人 | 预计时间 | 依赖 |
|-----|------|--------|---------|------|
| **Phase 1: 数据库与后端基础** |  |  | **4天** |  |
| 1 | 编写数据库迁移脚本（3张表） | Backend | 4h | - |
| 2 | 回填历史数据到 user_stats_daily | Backend | 2h | 1 |
| 3 | 实现 statsController（5个API） | Backend | 8h | 1 |
| 4 | 实现 dailyStatsAggregationService | Backend | 3h | 1 |
| 5 | 实现 reportGenerationService | Backend | 5h | 1 |
| 6 | 配置Cron定时任务 | Backend | 2h | 4,5 |
| 7 | 单元测试（Controller + Service） | Backend | 6h | 3,4,5 |
| **Phase 2: iOS数据层** |  |  | **2天** |  |
| 8 | 实现 StatsService（API调用） | iOS | 4h | 3 |
| 9 | 定义数据模型（Codable） | iOS | 2h | 8 |
| 10 | 实现 ViewModel（3个） | iOS | 6h | 8,9 |
| 11 | 单元测试（Service + ViewModel） | iOS | 4h | 8,10 |
| **Phase 3: iOS UI实现** |  |  | **4天** |  |
| 12 | 实现 TrendChartView（Swift Charts） | iOS | 6h | 10 |
| 13 | 实现 HeatmapCalendarView（自定义网格） | iOS | 8h | 10 |
| 14 | 实现 CityFootprintView（MapKit） | iOS | 6h | 10 |
| 15 | 实现 SummaryCardsView（复用组件） | iOS | 3h | 12 |
| 16 | 集成到 FeedTabView 的"数据"Sub-Tab | iOS | 2h | 12,13,14 |
| 17 | UI测试（截图测试） | iOS | 3h | 16 |
| **Phase 4: 城市识别集成** |  |  | **1天** |  |
| 18 | Session完成时触发逆地理编码 | iOS | 3h | - |
| 19 | 调用 POST /api/stats/cities/visit | iOS | 2h | 3,18 |
| 20 | 首次访问城市Toast提示 | iOS | 1h | 19 |
| 21 | 集成测试（完整Session流程） | iOS | 2h | 19,20 |
| **Phase 5: 报告系统（可选）** |  |  | **2天** |  |
| 22 | 实现 ReportCardView（周报/月报展示） | iOS | 4h | 10 |
| 23 | 实现分享卡片生成（UIImage） | iOS | 6h | 22 |
| 24 | 集成到通知中心（报告生成时推送） | iOS | 4h | 22 |
| 25 | 端到端测试（生成报告 → 查看 → 分享） | iOS | 2h | 24 |

**总计**: 约75小时（约10个工作日，考虑调试和优化）

---

## 九、测试方案

### 9.1 单元测试

#### Backend Tests

```javascript
// backend/tests/controllers/statsController.test.js
describe('Stats Controller', () => {
  describe('GET /api/stats/trend', () => {
    it('should return 7-day trend data', async () => {
      const res = await request(app)
        .get('/api/stats/trend?days=7')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dataPoints).toHaveLength(7);
    });

    it('should cache results in Redis', async () => {
      const cacheKey = `stats:trend:${testUserId}:7`;
      const cached = await redisUtils.get(cacheKey);
      expect(cached).not.toBeNull();
    });
  });

  describe('GET /api/stats/heatmap', () => {
    it('should return 365 days of data', async () => {
      const res = await request(app)
        .get('/api/stats/heatmap?year=2026')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.days).toHaveLength(365);
    });
  });

  describe('POST /api/stats/cities/visit', () => {
    it('should create new city visit on first visit', async () => {
      const res = await request(app)
        .post('/api/stats/cities/visit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          session_id: testSessionId,
          city_name: '杭州',
          province: '浙江省',
          country: 'China',
          location: { latitude: 30.2741, longitude: 120.1551 }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isFirstVisit).toBe(true);
    });

    it('should update existing city visit on repeat visit', async () => {
      // 第二次访问同一城市
      const res = await request(app)
        .post('/api/stats/cities/visit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ /* same city data */ });

      expect(res.body.data.isFirstVisit).toBe(false);

      const cityVisit = await db('city_visits').where({ user_id: testUserId, city_name: '杭州' }).first();
      expect(cityVisit.visit_count).toBe(2);
    });
  });
});
```

#### iOS Tests

```swift
// FunnyPixelsAppTests/StatsServiceTests.swift
class StatsServiceTests: XCTestCase {
    var statsService: StatsService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        statsService = StatsService.shared
        cancellables = []
    }

    func testFetchTrendData() {
        let expectation = XCTestExpectation(description: "Fetch trend data")

        statsService.fetchTrendData(days: 7)
            .sink { completion in
                if case .failure(let error) = completion {
                    XCTFail("Failed with error: \(error)")
                }
            } receiveValue: { trendData in
                XCTAssertEqual(trendData.dataPoints.count, 7)
                XCTAssertNotNil(trendData.summary)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        wait(for: [expectation], timeout: 5.0)
    }

    func testFetchHeatmapData() {
        let expectation = XCTestExpectation(description: "Fetch heatmap data")

        statsService.fetchHeatmapData(year: 2026)
            .sink { completion in
                if case .failure(let error) = completion {
                    XCTFail("Failed with error: \(error)")
                }
            } receiveValue: { heatmapData in
                XCTAssertEqual(heatmapData.days.count, 365)
                XCTAssertNotNil(heatmapData.stats)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        wait(for: [expectation], timeout: 5.0)
    }
}
```

### 9.2 集成测试

**测试场景**:
1. 完成Session → 触发每日聚合 → 查询趋势数据 → 验证数据准确性
2. 完成Session（新城市） → 记录城市访问 → 查询城市足迹 → 验证首次访问标记
3. 周一早8点 → 触发周报生成 → 查询报告API → 验证报告数据完整性

### 9.3 性能测试

**性能基准**:
- 趋势数据API（7天）: P95 < 200ms
- 热力日历API（365天）: P95 < 300ms
- 城市足迹API: P95 < 500ms
- 每日聚合任务: 100万Session数据 < 60秒
- 周报生成（1000用户）: < 5分钟

---

## 十、验收标准

### 10.1 功能验收

- [ ] FR1: 用户可查看7/30/90天趋势图，数据准确无误
- [ ] FR2: 热力日历显示365天数据，点击日期可查看详情
- [ ] FR3: 城市足迹地图正确显示所有访问过的城市
- [ ] FR4: 周报/月报按时生成，数据完整
- [ ] 首次访问新城市时显示Toast提示

### 10.2 性能验收

- [ ] 趋势数据API P95 < 200ms
- [ ] 热力日历API P95 < 300ms
- [ ] 城市足迹API P95 < 500ms
- [ ] Redis缓存命中率 > 80%

### 10.3 数据验收

- [ ] `user_stats_daily` 数据与原始Session数据误差 < 0.1%
- [ ] 城市访问计数准确（无重复计数）
- [ ] 报告数据与实际数据一致

### 10.4 UI/UX验收

- [ ] Swift Charts图表渲染流畅（60fps）
- [ ] 热力日历网格布局正确（52-53周 × 7天）
- [ ] 城市地图标注可点击查看详情
- [ ] 分享卡片样式美观，符合品牌规范

---

## 十一、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 物化表数据延迟 | 今日数据不准确 | 今日数据实时查询，历史数据用物化表 |
| 逆地理编码API限流 | 城市识别失败 | 客户端缓存城市名，批量提交 |
| 报告生成任务超时 | 用户收不到报告 | 分批生成，限制并发数为10 |
| Swift Charts兼容性 | iOS 16以下用户看不到图表 | 降级方案：简单文字+列表展示 |
| 热力日历渲染性能 | 365个格子卡顿 | 使用LazyVGrid，仅渲染可见区域 |

---

## 十二、后续优化方向

1. **HealthKit集成**: 同步步数、卡路里数据
2. **对比功能**: 与好友/联盟成员对比数据
3. **目标设定**: 用户设置每日/每周目标，显示完成进度
4. **成就系统**: 基于数据解锁成就徽章（如"连续7天"、"访问10城"）
5. **数据导出**: 支持导出CSV/PDF格式报告
6. **AI分析**: 智能分析用户习惯，提供个性化建议

---

## 附录

### A. API Endpoint 汇总

| Method | Endpoint | 描述 |
|--------|----------|------|
| GET | `/api/stats/trend?days=7` | 趋势数据 |
| GET | `/api/stats/heatmap?year=2026` | 热力日历 |
| GET | `/api/stats/cities?sort=first_visit` | 城市足迹 |
| POST | `/api/stats/cities/visit` | 记录城市访问 |
| GET | `/api/stats/reports/weekly?period=latest` | 周报 |
| GET | `/api/stats/reports/monthly?period=latest` | 月报 |

### B. 数据库表汇总

| 表名 | 行数估算 | 说明 |
|------|---------|------|
| `user_stats_daily` | 365 × 用户数 | 物化每日统计 |
| `city_visits` | 平均20 × 用户数 | 城市访问记录 |
| `user_reports` | 52 × 用户数 | 周报/月报存储 |

### C. Redis Key 汇总

| Key Pattern | TTL | 说明 |
|-------------|-----|------|
| `stats:trend:{userId}:{days}` | 24h | 趋势数据 |
| `stats:heatmap:{userId}:{year}` | 24h | 热力日历 |
| `stats:cities:{userId}:{sortBy}` | 7d | 城市足迹 |

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
**负责人**: Backend Team + iOS Team
