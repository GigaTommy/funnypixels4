# FunnyPixels 底部菜单栏功能完善方案 v2.0 (Production-Ready)

> 基于现有代码架构（Express + Knex + PostgreSQL + Socket.IO / SwiftUI + Alamofire + MapLibre）的生产级功能升级规划。
> 每个功能点均包含：数据库变更、API 契约、iOS 实现路径、验收标准。

---

## 目录

- [架构约束与前置说明](#架构约束与前置说明)
- [Phase 0: 技术债务清理](#phase-0-技术债务清理)
- [Phase 1: 地图 Tab — 社交存在感与信息密度](#phase-1-地图-tab)
- [Phase 2: 历史 Tab — 升级为「动态中心」](#phase-2-历史-tab)
- [Phase 3: 联盟 Tab — 组织协作与成长体系](#phase-3-联盟-tab)
- [Phase 4: 排行榜 Tab — 竞技驱动与段位体系](#phase-4-排行榜-tab)
- [Phase 5: 我的 Tab — 个人中心与任务系统](#phase-5-我的-tab)
- [Phase 6: Tab Bar 全局增强与跨 Tab 联动](#phase-6-tab-bar-全局增强)
- [实施路线图](#实施路线图)
- [附录 A: 完整新增数据库表清单](#附录-a-完整新增数据库表清单)
- [附录 B: 完整新增 API 端点清单](#附录-b-完整新增-api-端点清单)
- [附录 C: 完整新增 iOS 文件清单](#附录-c-完整新增-ios-文件清单)

---

## 架构约束与前置说明

### 现有技术栈

| 层 | 技术 | 关键约束 |
|----|------|----------|
| 后端框架 | Express 4.18 (单体) | 所有路由挂载在 `server.js`，需在对应位置注册新路由 |
| 数据库 | PostgreSQL + PostGIS + Knex.js | 新表通过 Knex migration 创建，模型为静态方法类 |
| 缓存 | Redis (ioredis) | 排行榜、在线状态等热数据走 Redis |
| 实时通信 | Socket.IO 4.7 + 原生 WebSocket | 新实时功能优先复用 Socket.IO `SocketManager` |
| 任务队列 | Bull / BullMQ | 定时任务（每日结算、赛季切换）走 Bull 队列 |
| iOS 网络层 | Alamofire (via `APIManager.shared`) | 新 Service 统一走 `APIManager`，不再直接用 `URLSession` |
| iOS 状态管理 | `@MainActor` 单例 `ObservableObject` | 新 ViewModel 遵循此模式 |
| iOS 设计系统 | `AppColors` / `AppTypography` / `AppSpacing` / `AppRadius` | 新 UI 统一使用 `DesignSystem.swift` 中的 token |
| iOS 地图 | MapLibre GL (`MLNMapView`) | 新地图图层通过 `MLNStyle` 添加 source + layer |
| 认证 | JWT (access + refresh) via `AuthManager.shared` | 新接口统一使用 `authenticateToken` 中间件 |

### 命名约定

| 类型 | 后端约定 | iOS 约定 |
|------|---------|---------|
| 数据库表 | snake_case 复数 (`daily_tasks`) | — |
| API 路径 | kebab-case (`/api/daily-tasks`) | — |
| 路由文件 | camelCase (`dailyTaskRoutes.js`) | — |
| 控制器 | camelCase (`dailyTaskController.js`) | — |
| 模型文件 | PascalCase (`DailyTask.js`) | — |
| Service | — | `XxxService.swift` (singleton `shared`) |
| ViewModel | — | `XxxViewModel.swift` (`@MainActor ObservableObject`) |
| View | — | `XxxView.swift` (SwiftUI struct) |
| 数据模型 | — | 嵌套在 Service 内部或独立 `XxxModels.swift` |

---

## Phase 0: 技术债务清理

> 在新功能开发前，先统一现有混乱的双重系统，降低后续开发复杂度。

### 0.1 统一认证管理器

**现状**: `AuthManager` 和 `SessionManager` 两个单例共存，职责重叠。

**方案**: 保留 `AuthManager` 作为唯一认证源，`SessionManager` 标记为 `@available(*, deprecated)` 并逐步迁移调用方。

**任务**:
- [ ] 将 `SessionManager` 的独有功能（定时 refresh timer）合并到 `AuthManager`
- [ ] 全局搜索替换 `SessionManager.shared` → `AuthManager.shared`
- [ ] 将 `SessionManager.swift` 标记 deprecated

### 0.2 统一数据模型

**现状**: `AllianceService.Alliance`（id: Int）与 `AllianceModels.Alliance`（id: String）并存；`LeaderboardService.LeaderboardEntry` 与 `LeaderboardModels.LeaderboardEntry` 并存。

**方案**: 以 Service 内部定义为准（因直接对接 API 响应），`Models/` 目录文件标记 deprecated。

**任务**:
- [ ] 统一 Alliance 模型到 `AllianceService` 内部定义
- [ ] 统一 Leaderboard 模型到 `LeaderboardService` 内部定义
- [ ] 清理 `AllianceModels.swift` 和 `LeaderboardModels.swift` 中不再使用的类型

### 0.3 统一网络层

**现状**: `DrawingSessionService`、`DrawingHistoryService`、`SpriteService` 等直接使用 `URLSession`。

**方案**: 逐步迁移到 `APIManager.shared`，复用 token 注入和 refresh 逻辑。

**任务**:
- [ ] 迁移 `DrawingSessionService` 到 `APIManager`
- [ ] 迁移 `DrawingHistoryService` 到 `APIManager`
- [ ] 迁移 `SpriteService` 到 `APIManager`

---

## Phase 1: 地图 Tab

> 核心目标：让用户在地图上感受到「其他人的存在」和「有事可做」。

### 1.1 附近活跃玩家展示

**产品描述**: 地图上以脉冲光点显示附近正在绘画的玩家（模糊到 ~500m 精度以保护隐私）。点击光点弹出玩家简要卡片。

**后端实现**:

数据库: 无需新表，复用 Redis。

Redis 数据结构:
```
Key: active_drawers (Sorted Set)
Score: timestamp
Member: JSON { userId, lat, lng, allianceColor, displayName, avatarUrl }

Key: active_drawers:geo (Geo Set, Redis GEOADD)
Member: userId
Longitude/Latitude: 模糊化后的坐标 (精度降至小数点后 2 位, ~1km)
```

写入时机: `pixelDrawController.js` 中 `drawPixel`/`drawGPSPixel` 成功后，`GEOADD` + `ZADD` 写入用户位置，TTL 5 分钟（EXPIRE 由定时清理）。

新增 API:
```
GET /api/map/nearby-players?lat={}&lng={}&radius=5000
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "players": [
      {
        "userId": "uuid",
        "displayName": "string",
        "avatarUrl": "string|null",
        "allianceColor": "#hex|null",
        "fuzzyLat": 39.91,
        "fuzzyLng": 116.40,
        "lastActiveSeconds": 120
      }
    ],
    "totalActive": 42
  }
}
```

新增文件:
- `backend/src/routes/mapSocialRoutes.js`
- `backend/src/controllers/mapSocialController.js`
- `backend/src/services/activePlayerService.js` (Redis geo 查询封装)

Socket.IO 扩展: 在 `socketManager.js` 中新增事件：
```
Server → Client: 'nearby_player_update'
Payload: { players: [...], totalActive: number }
```
触发条件: 客户端订阅的 tile 范围内有新玩家活跃时，通过 Redis Pub/Sub 广播。
推送频率: 最多每 30 秒推送一次（服务端节流）。

**iOS 实现**:

新增文件:
- `Services/API/MapSocialService.swift` — 调用 nearby-players API
- `Views/Map/NearbyPlayerAnnotation.swift` — 脉冲光点标注视图
- `Views/Map/NearbyPlayerCard.swift` — 点击弹出的玩家简要卡片

修改文件:
- `Views/MapLibreMapView.swift` — 添加 `MLNShapeSource("nearby-players")` + `MLNSymbolStyleLayer` / `MLNCircleStyleLayer`，圆形脉冲动画
- `Views/ContentView.swift` — 在地图 ZStack 中接收 Socket 事件并更新标注
- `Services/Network/SocketIOManager.swift` — 监听 `nearby_player_update` 事件

交互流:
1. 地图可见区域变化时（`mapViewRegionDidChange` 回调），若 zoom ≥ 12，按中心坐标调用 API
2. 同时通过 Socket.IO 接收实时更新
3. 点击光点 → 弹出 `NearbyPlayerCard`（半透明底板 + 头像 + 昵称 + 联盟色条 + 关注按钮 + 查看主页按钮）
4. zoom < 12 时自动隐藏光点图层

**验收标准**:
- [ ] zoom ≥ 12 时可见附近正在绘画的玩家（5km 范围）
- [ ] 玩家位置模糊化，不暴露精确坐标
- [ ] 点击光点可查看简要信息并关注
- [ ] 用户停止绘画 5 分钟后自动从地图消失
- [ ] 隐私设置中可关闭「显示我的位置」

---

### 1.2 区域信息状态条

**产品描述**: 地图顶部常驻一条半透明状态条，显示当前视野中心区域的名称、该区域像素总数、当前活跃玩家数。下拉可展开查看区域排行快照。

**后端实现**:

新增 API:
```
GET /api/map/region-info?lat={}&lng={}&zoom={}
Authorization: Bearer <token> (optional)

Response 200:
{
  "success": true,
  "data": {
    "regionName": "北京市朝阳区",
    "totalPixels": 12580,
    "activePlayers": 23,
    "dominantAlliance": { "name": "string", "color": "#hex", "percentage": 45.2 } | null,
    "topPlayers": [
      { "displayName": "string", "pixelCount": 500, "rank": 1 }
    ]
  }
}
```

实现: 在 `mapSocialController.js` 中新增方法。`regionName` 通过反向地理编码（复用 `geocodingService.js`）；`totalPixels` 通过 PostGIS 查询可视区域内像素数（可按 H3 index 聚合缓存）；`activePlayers` 从 Redis geo set 查询。缓存策略：按 H3 resolution 6 index 缓存 60 秒。

**iOS 实现**:

新增文件:
- `Views/Map/RegionInfoBar.swift` — 顶部状态条 SwiftUI 视图

修改文件:
- `Views/ContentView.swift` — 在地图 ZStack 顶部添加 `RegionInfoBar`

视图结构:
```
RegionInfoBar (高度 44pt, 背景 .ultraThinMaterial)
├── HStack
│   ├── Text(regionName) — AppTypography.subheadline, bold
│   ├── Spacer
│   ├── HStack(spacing: AppSpacing.m)
│   │   ├── Image(systemName: "square.grid.3x3.fill") + Text(totalPixels.formatted)
│   │   ├── Image(systemName: "person.2.fill") + Text(activePlayers)
│   └── Image(systemName: "chevron.down") — 展开指示
└── 下拉展开区域 (conditionally visible)
    ├── 占领联盟信息
    └── Top 3 玩家列表
```

数据刷新: 地图移动停止 0.5 秒后（`debounce`）请求新区域数据，避免频繁调用。

**验收标准**:
- [ ] 地图顶部始终显示当前区域名称和统计数据
- [ ] 下拉可展开区域详情
- [ ] 移动地图自动更新数据（有 debounce）
- [ ] GPS 绘画模式下状态条自动隐藏以腾出空间

---

### 1.3 每日地图任务标记

**产品描述**: 地图上显示当天可完成的地图任务点位（最多 5 个），标记为带图标的 pin。靠近并完成任务获得奖励。任务类型包括：在指定地点绘画 N 个像素、连续绘画 N 米等。

**后端实现**:

新增数据库表:

```sql
-- Migration: create_daily_tasks
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  task_type VARCHAR(30) NOT NULL, -- 'draw_at_location', 'draw_distance', 'draw_count', 'visit_location'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_value INT NOT NULL,       -- 目标值 (像素数/米数)
  current_value INT DEFAULT 0,     -- 当前进度
  reward_points INT DEFAULT 50,
  reward_items JSONB,              -- [{ itemId, quantity }]
  location_lat DECIMAL(10,8),      -- 任务地点 (可选)
  location_lng DECIMAL(11,8),
  location_radius INT DEFAULT 500, -- 触发半径(米)
  location_name VARCHAR(200),
  is_completed BOOLEAN DEFAULT false,
  is_claimed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL, -- 当天 23:59:59
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_daily_tasks_user_date ON daily_tasks(user_id, created_at);
CREATE INDEX idx_daily_tasks_location ON daily_tasks USING GIST (
  ST_MakePoint(location_lng, location_lat)
) WHERE location_lat IS NOT NULL;

-- 每日任务奖励领取的额外宝箱
CREATE TABLE daily_task_bonus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  all_completed BOOLEAN DEFAULT false,
  bonus_claimed BOOLEAN DEFAULT false,
  bonus_points INT DEFAULT 200,
  claimed_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);
```

任务生成逻辑: Bull 定时任务，每天 00:00 为每个活跃用户生成 5 个任务（3 简单 + 1 中等 + 1 困难）。任务模板配置化存于 `task_templates` 表。对于 `draw_at_location` 类型，基于用户最近活跃位置附近 5km 内随机选点（确保不在水域/建筑内）。

新增 API:
```
GET /api/daily-tasks
Authorization: Bearer <token>
Response: { tasks: [...], bonusStatus: { allCompleted, bonusClaimed } }

GET /api/daily-tasks/map-pins
Authorization: Bearer <token>
Response: { pins: [{ taskId, lat, lng, radius, type, title, iconName }] }

POST /api/daily-tasks/:taskId/claim
Authorization: Bearer <token>
Response: { reward: { points, items }, newBalance }

POST /api/daily-tasks/bonus/claim
Authorization: Bearer <token>
Response: { reward: { points, items }, newBalance }
```

进度更新: 在 `pixelDrawController.js` 的 `drawPixel` 成功回调中，调用 `dailyTaskService.checkProgress(userId, pixelData)` 检查是否推进了任务进度。若完成则通过 Socket.IO 推送 `task_completed` 事件。

新增文件:
- `backend/src/routes/dailyTaskRoutes.js`
- `backend/src/controllers/dailyTaskController.js`
- `backend/src/models/DailyTask.js`
- `backend/src/services/dailyTaskService.js` (含 `generateDailyTasks`, `checkProgress`, `claimReward`)
- `backend/src/services/taskTemplateService.js`

**iOS 实现**:

新增文件:
- `Services/API/DailyTaskService.swift`
- `ViewModels/DailyTaskViewModel.swift`
- `Views/Map/TaskPinAnnotation.swift` — 地图上的任务标记
- `Views/DailyTask/DailyTaskListView.swift` — 「我的」Tab 中的任务列表
- `Views/DailyTask/TaskRewardAnimation.swift` — 奖励领取动画

修改文件:
- `Views/MapLibreMapView.swift` — 添加任务 pin 图层
- `Views/ContentView.swift` — 监听 `task_completed` Socket 事件，弹出完成 Toast
- `Services/Network/SocketIOManager.swift` — 监听 `task_completed`, `task_progress` 事件

地图 Pin 样式: 使用 `MLNSymbolStyleLayer` + SF Symbol 图标渲染。任务 pin 带脉冲动画（`MLNCircleStyleLayer` 配合 `pulsing` 效果）。半径用 `MLNFillStyleLayer` 半透明圆形展示。

**验收标准**:
- [ ] 每天 00:00 自动生成 5 个任务
- [ ] 有位置要求的任务在地图上显示 pin
- [ ] 绘画行为自动推进任务进度
- [ ] 任务完成后弹出奖励动画
- [ ] 全部完成可领取额外宝箱奖励
- [ ] 过期任务自动清理

---

### 1.4 领地控制可视化

**产品描述**: zoom 10-14 级别下，显示各联盟的领地边界（基于 H3 六边形网格聚合）。占据某个 H3 区域 60% 以上像素的联盟获得该区域控制权。争夺区（无明确控制方）用虚线标记。

**后端实现**:

新增数据库表:
```sql
CREATE TABLE territory_control (
  h3_index VARCHAR(20) PRIMARY KEY, -- H3 resolution 7 index
  dominant_alliance_id UUID REFERENCES alliances(id),
  dominant_percentage DECIMAL(5,2),
  total_pixels INT DEFAULT 0,
  alliance_pixels JSONB DEFAULT '{}', -- { "allianceId": pixelCount, ... }
  is_contested BOOLEAN DEFAULT false, -- 争夺区域标记
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_territory_alliance ON territory_control(dominant_alliance_id);
```

计算逻辑: Bull 定时任务每 15 分钟运行一次。按 H3 resolution 7 聚合 `pixels` 表的 `alliance_id`，计算每个 H3 cell 中各联盟像素占比。占比 ≥ 60% 标记为该联盟领地；最高占比 < 40% 且有 ≥ 2 个联盟标记为争夺区。

新增 API:
```
GET /api/map/territories?bounds={sw_lat,sw_lng,ne_lat,ne_lng}&zoom={}
Authorization: optional

Response 200:
{
  "success": true,
  "data": {
    "territories": [
      {
        "h3Index": "872830828ffffff",
        "boundary": [[lat,lng], ...],  -- H3 六边形顶点
        "allianceId": "uuid|null",
        "allianceName": "string|null",
        "allianceColor": "#hex|null",
        "percentage": 72.5,
        "isContested": false,
        "totalPixels": 340
      }
    ]
  }
}
```

新增文件:
- `backend/src/routes/territoryRoutes.js`
- `backend/src/controllers/territoryController.js`
- `backend/src/services/territoryCalculationService.js`
- `backend/src/models/TerritoryControl.js`

**iOS 实现**:

新增文件:
- `Services/API/TerritoryService.swift`
- `Views/Map/TerritoryLayer.swift` — 领地六边形渲染逻辑

修改文件:
- `Views/MapLibreMapView.swift` — 在 zoom 10-14 时加载领地图层。使用 `MLNShapeSource` + `MLNFillStyleLayer`（联盟颜色 20% 透明度填充）+ `MLNLineStyleLayer`（联盟颜色边线，争夺区虚线）。zoom 变化时按 `minzoom`/`maxzoom` 自动控制可见性。

领地图层 Z-order: 插入到 pixel layer 之下、底图之上。

数据刷新: 地图视野变化停止 1 秒后请求，按 bounds 查询。客户端缓存 5 分钟。

**验收标准**:
- [ ] zoom 10-14 可见领地六边形色块
- [ ] 颜色对应联盟旗帜颜色
- [ ] 争夺区域用虚线边框区分
- [ ] 点击领地区域显示控制信息卡片
- [ ] zoom < 10 或 > 14 时自动隐藏

---

### 1.5 快速统计浮窗

**产品描述**: 地图右侧 Toolbar 新增统计按钮，点击弹出半透明浮窗，显示今日核心数据，无需切换 Tab。

**后端**: 无需新 API，复用已有端点组合请求。

**iOS 实现**:

新增文件:
- `Views/Map/QuickStatsPopover.swift`

视图结构:
```
QuickStatsPopover (宽 200pt, .ultraThinMaterial 背景, AppRadius.l 圆角)
├── VStack(spacing: AppSpacing.m)
│   ├── 今日像素: Image("square.grid.3x3.fill") + Text(todayPixels)
│   ├── 连续登录: Image("flame.fill") + Text(streakDays) + "天"
│   ├── 当前排名: Image("trophy.fill") + Text("#" + rank)
│   ├── 积分余额: Image("star.circle.fill") + Text(points)
│   └── 资源值: Image("drop.fill") + Text(pixelPoints) + "/" + Text(maxPoints)
```

数据来源: `PixelDrawService.shared`（资源值）、`CheckinService`（连续登录）、`ProfileViewModel`（排名、积分）。首次打开时聚合请求，缓存 60 秒。

修改文件:
- `Views/Map/MapToolbarView.swift` — 新增统计按钮图标 `chart.bar.fill`，点击 toggle popover

**验收标准**:
- [ ] 点击 Toolbar 统计按钮弹出/收起浮窗
- [ ] 数据正确展示，60 秒缓存
- [ ] 浮窗外点击自动关闭
- [ ] GPS 绘画模式下隐藏此按钮

---

## Phase 2: 历史 Tab

> 核心策略：从「个人记录查看器」升级为「动态中心」（三子标签: 动态 / 我的记录 / 数据）。

### 2.1 Tab 结构重构

**产品描述**: 历史 Tab 顶部增加三个子标签切换器（类似现有联盟 Tab 的 "我的联盟/搜索" 双标签）。默认选中「动态」子标签。

修改文件:
- `Views/DrawingHistoryView.swift` → 重命名为 `Views/FeedTabView.swift`（顶层容器）

新增子标签视图:
- `Views/Feed/SocialFeedView.swift` — 动态 Feed
- `Views/Feed/MyRecordsView.swift` — 原 `DrawingHistoryView` 内容迁移
- `Views/Feed/DataDashboardView.swift` — 数据仪表盘

顶部切换器: 使用自定义 `Picker(.segmented)` 样式或与联盟 Tab 一致的自定义 `SegmentedControl`。

Tab 标题 & 图标更新:
- Tab 名称从 "历史" 改为 "动态"
- 图标从 `timer.circle.fill` 改为 `bubble.left.and.text.bubble.right.fill`
- 修改 `ContentView.swift` 中 Tab 配置

---

### 2.2 社交动态 Feed

**产品描述**: 展示已关注用户的绘画动态、成就达成、排名变动。支持点赞和评论。

**后端实现**:

新增数据库表:
```sql
CREATE TABLE feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  feed_type VARCHAR(30) NOT NULL,
    -- 'drawing_session': 完成一次绘画
    -- 'achievement_unlocked': 达成成就
    -- 'rank_change': 排名变动
    -- 'alliance_joined': 加入联盟
    -- 'level_up': 段位提升
  title VARCHAR(300),
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
    -- drawing_session: { sessionId, pixelCount, distance, city, thumbnailUrl, startLat, startLng }
    -- achievement_unlocked: { achievementId, achievementName, rarity }
    -- rank_change: { oldRank, newRank, period }
  visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'followers', 'private'
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feed_items_user ON feed_items(user_id, created_at DESC);
CREATE INDEX idx_feed_items_created ON feed_items(created_at DESC);

CREATE TABLE feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_item_id, user_id)
);

CREATE TABLE feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES feed_comments(id), -- 回复某条评论
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feed_comments_item ON feed_comments(feed_item_id, created_at);
```

Feed 生成时机（在现有代码中插入钩子）:
- **绘画 Session 结束**: `drawingSessionController.js` 的 `endSession` 成功后，若 session 像素数 ≥ 10，自动创建 `drawing_session` feed item
- **成就解锁**: `achievementService.js` 的 `checkAndAward` 中，奖励成就后创建 `achievement_unlocked` feed item
- **排名变动**: 每日排名结算 Bull job 中，对排名变化 ≥ 10 位的用户创建 `rank_change` feed item

新增 API:
```
GET /api/feed?page=1&limit=20&type=following|nearby|all
Authorization: Bearer <token>
-- type=following: 仅关注的人
-- type=nearby: 附近 10km (需传 lat/lng)
-- type=all: 全部公开
Response: { items: [FeedItem], pagination: {...} }

POST /api/feed/:itemId/like
DELETE /api/feed/:itemId/unlike

GET /api/feed/:itemId/comments?page=1&limit=20
POST /api/feed/:itemId/comments  Body: { content: "string", replyToId?: "uuid" }
DELETE /api/feed/comments/:commentId
```

新增文件:
- `backend/src/routes/feedRoutes.js`
- `backend/src/controllers/feedController.js`
- `backend/src/models/FeedItem.js`
- `backend/src/services/feedService.js`

**iOS 实现**:

新增文件:
- `Services/API/FeedService.swift`
- `ViewModels/FeedViewModel.swift`
- `Views/Feed/SocialFeedView.swift` — 主 Feed 列表
- `Views/Feed/FeedItemCard.swift` — 单条动态卡片
- `Views/Feed/FeedCommentSheet.swift` — 评论底部弹窗
- `Views/Feed/FeedFilterPicker.swift` — "关注/附近/全部" 筛选

`FeedItemCard` 视图结构:
```
FeedItemCard
├── HStack — 用户头像 + 昵称 + 联盟徽章 + 时间
├── 内容区域 (根据 feed_type 渲染不同内容)
│   ├── drawing_session: 轨迹缩略图 + 统计数据横栏 (像素数/距离/时长)
│   ├── achievement_unlocked: 成就图标 + 名称 + 稀有度标签
│   └── rank_change: 排名变化箭头 + 旧排名 → 新排名
├── HStack — 互动按钮: 赞(❤️ + count) / 评论(💬 + count) / 分享 / 飞往(🗺️)
└── Divider
```

**验收标准**:
- [ ] Feed 按时间倒序展示，支持下拉刷新和上拉加载更多
- [ ] 可切换 关注/附近/全部 三种 Feed 流
- [ ] 点赞有即时动画反馈
- [ ] 评论支持回复
- [ ] 绘画类动态可点击「飞往」跳转到地图 Tab 对应位置
- [ ] Session 完成后 Feed 自动生成（≥10 像素）

---

### 2.3 数据仪表盘

**产品描述**: 可视化展示个人绘画数据，包括绘画热力日历、趋势折线图、城市足迹。

**后端实现**:

新增 API:
```
GET /api/stats/dashboard
Authorization: Bearer <token>
Response:
{
  "heatmap": { "2026-02-01": 45, "2026-02-02": 120, ... }, -- 每日像素数
  "streak": { "current": 7, "longest": 23 },
  "trends": {
    "pixelsPerDay": [{ "date": "2026-02-01", "count": 45 }, ...],  -- 最近 30 天
    "distancePerDay": [{ "date": "2026-02-01", "meters": 3200 }, ...]
  },
  "cities": [
    { "city": "北京", "country": "CN", "pixelCount": 5000, "firstVisit": "2025-09-01" }
  ],
  "summary": {
    "totalPixels": 28500,
    "totalDistance": 142.5,  -- km
    "totalSessions": 85,
    "totalCities": 12,
    "totalDaysActive": 63,
    "avgPixelsPerDay": 120,
    "avgDistancePerDay": 2.3  -- km
  }
}
```

实现: `statsController.js` 聚合查询 `pixels`、`drawing_sessions` 表。热力图数据按 `date_trunc('day', created_at)` 分组。城市数据从 `pixels` 的 `city` 列 `DISTINCT` 聚合。结果 Redis 缓存 10 分钟。

新增文件:
- `backend/src/routes/statsRoutes.js`
- `backend/src/controllers/statsController.js`

**iOS 实现**:

新增文件:
- `Services/API/StatsService.swift`
- `ViewModels/DashboardViewModel.swift`
- `Views/Feed/DataDashboardView.swift` — 主容器 ScrollView
- `Views/Feed/HeatmapCalendarView.swift` — GitHub 风格热力日历（使用 SwiftUI `LazyVGrid`，7 列）
- `Views/Feed/TrendChartView.swift` — 趋势折线图（使用 Swift Charts `Chart { LineMark }`)
- `Views/Feed/CityFootprintView.swift` — 城市列表 + 点亮数量

`DataDashboardView` 布局:
```
ScrollView
├── 概览卡片 — 4 栏横排: 总像素 / 总距离 / 总城市 / 活跃天数
├── HeatmapCalendarView — 最近 90 天热力日历
│   ├── 5 级色阶: 0=灰, 1-10=浅绿, 11-50=绿, 51-100=深绿, 100+=最深绿
│   └── 点击某天 → 显示当天统计 popover
├── TrendChartView — 30天像素数趋势折线图 (Swift Charts)
│   └── 可切换: 像素数 / 距离 / Session数
├── CityFootprintView — 城市足迹列表
│   ├── 城市数量 banner: "已点亮 12 座城市"
│   └── 列表: 国旗 emoji + 城市名 + 像素数 + 首次到访日期
└── 连续记录卡片 — 当前连续 N 天 / 最长连续 N 天
```

**验收标准**:
- [ ] 热力日历正确展示最近 90 天数据
- [ ] 趋势图支持切换指标维度
- [ ] 城市列表按像素数降序
- [ ] 数据 10 分钟缓存

---

## Phase 3: 联盟 Tab

> 核心目标：从「组织管理工具」升级为「团队协作平台」，增加成长体系和实时沟通。

### 3.1 联盟聊天室

**产品描述**: 联盟详情页内嵌实时聊天面板，基于现有 Socket.IO 和 `chat_messages` 表。支持文字、表情、位置分享。

**后端**: 已有 `chat_messages` 表和 `/api/chat/alliance/:allianceId/messages`、`/api/chat/alliance/send` 等 API。Socket.IO 已有 `join_chat_room`、`chat_message_batch` 事件。

需要补充的:
- 在 `chatRoutes.js` 中确保联盟聊天的鉴权（用户必须是联盟成员）
- 新增未读消息计数: `GET /api/chat/alliance/:allianceId/unread-count`
- Socket.IO: 用户打开联盟聊天时 `join_chat_room({ channelType: 'alliance', channelId: allianceId })`

新增文件 (后端):
- 检查并补充 `chatController.js` 中的联盟鉴权逻辑

**iOS 实现**:

新增文件:
- `Views/Alliance/AllianceChatView.swift` — 联盟聊天主视图
- `Views/Alliance/ChatMessageBubble.swift` — 消息气泡组件
- `Views/Alliance/ChatInputBar.swift` — 输入框 + 发送按钮 + 表情按钮
- `ViewModels/AllianceChatViewModel.swift` — 管理消息列表、发送、Socket 监听

修改文件:
- `Views/AllianceTabView.swift` — 联盟详情页新增「聊天」入口按钮 / 子标签
- `Services/Network/SocketIOManager.swift` — 确保 `chat_message_batch` 事件正确解析并通过 Publisher 转发

消息列表: 使用 `ScrollViewReader` + `LazyVStack`，新消息自动滚动到底部。历史消息上拉加载（分页 20 条）。

未读 Badge: 联盟 Tab 的 `AllianceListRow` 中显示未读消息数红点。

**验收标准**:
- [ ] 联盟成员可实时发送和接收文字消息
- [ ] 消息包含发送者头像、昵称、时间
- [ ] 支持表情选择
- [ ] 新消息自动滚动到底部
- [ ] 历史消息可上拉加载
- [ ] 联盟列表显示未读消息数

---

### 3.2 联盟等级与成长系统

**产品描述**: 联盟通过成员活动积累经验值升级（1-30 级），等级解锁成员上限提升和功能特权。

**后端实现**:

数据库修改（修改现有 `alliances` 表）:
```sql
-- Migration: add_alliance_level
ALTER TABLE alliances ADD COLUMN level INT DEFAULT 1;
ALTER TABLE alliances ADD COLUMN experience BIGINT DEFAULT 0;
ALTER TABLE alliances ADD COLUMN next_level_exp BIGINT DEFAULT 1000;
```

等级经验表（种子数据 / 常量配置）:
```javascript
// backend/src/constants/allianceLevels.js
const ALLIANCE_LEVELS = {
  1: { exp: 0, maxMembers: 20 },
  2: { exp: 1000, maxMembers: 22 },
  3: { exp: 3000, maxMembers: 24 },
  5: { exp: 10000, maxMembers: 30 },       // 解锁联盟任务板
  10: { exp: 50000, maxMembers: 40 },      // 解锁联盟公告
  15: { exp: 150000, maxMembers: 50 },
  20: { exp: 400000, maxMembers: 60 },
  25: { exp: 800000, maxMembers: 80 },
  30: { exp: 2000000, maxMembers: 100 },   // 满级
};
```

经验获取来源:
- 成员绘画像素: 每像素 +1 经验（在 `pixelDrawController` 中，若用户有联盟则给联盟加经验）
- 联盟签到: 每人签到 +10 经验（见 3.3）
- 联盟任务完成: +50~500 经验

新增 API:
```
GET /api/alliances/:id/level-info
Response: { level, experience, nextLevelExp, maxMembers, privileges: [...] }
```

修改文件:
- `backend/src/controllers/pixelDrawController.js` — `drawPixel` 成功后，异步调用 `allianceService.addExperience(allianceId, 1)`
- `backend/src/services/allianceLevelService.js` (新增) — `addExperience`, `checkLevelUp`, `getLevelPrivileges`

**iOS 实现**:

修改文件:
- `AllianceService.swift` — `getAllianceDetail` 响应中解析 `level`, `experience`, `nextLevelExp`
- 联盟详情页 Header — 显示等级徽章 + 经验进度条

新增文件:
- `Views/Alliance/AllianceLevelBadge.swift` — 等级徽章组件 (Lv.1 ~ Lv.30)
- `Views/Alliance/AllianceLevelProgressBar.swift` — 经验进度条

**验收标准**:
- [ ] 联盟详情页展示当前等级和经验进度
- [ ] 成员绘画自动给联盟增加经验
- [ ] 升级时成员上限自动提升
- [ ] 升级时 Socket.IO 推送通知给所有在线成员

---

### 3.3 联盟签到

**产品描述**: 每个联盟每天独立签到（与个人签到分开），签到贡献联盟经验。全员签到额外奖励。

**后端实现**:

新增数据库表:
```sql
CREATE TABLE alliance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  contribution_points INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alliance_id, user_id, date)
);
CREATE INDEX idx_alliance_checkins_date ON alliance_checkins(alliance_id, date);
```

新增 API:
```
POST /api/alliances/:id/checkin
Authorization: Bearer <token>
Response: { success: true, contributionPoints: 10, todayCount: 15, memberCount: 30 }

GET /api/alliances/:id/checkin-status
Response: { hasCheckedIn: true, todayCheckins: [{ userId, displayName, avatarUrl, checkedInAt }], totalMembers: 30 }
```

新增文件:
- 在 `allianceRoutes.js` 中新增路由
- `backend/src/controllers/allianceCheckinController.js`
- `backend/src/services/allianceCheckinService.js`

**iOS 实现**:

修改文件:
- `Views/AllianceTabView.swift` — 联盟详情页新增签到按钮 + 今日签到头像列表

新增文件:
- `Views/Alliance/AllianceCheckinButton.swift` — 签到按钮（已签到显示勾号 + 今日已签 N 人）
- `Views/Alliance/AllianceCheckinMemberRow.swift` — 今日已签到成员头像横排

**验收标准**:
- [ ] 每天每人每联盟只能签到一次
- [ ] 签到增加联盟经验和个人贡献值
- [ ] 联盟页面显示今日已签到成员
- [ ] 防止重复签到（接口幂等）

---

### 3.4 联盟贡献排行

**产品描述**: 联盟成员详情页中展示贡献排行榜，贡献值 = 绘画像素数 + 签到次数 × 5 + 联盟任务完成 × 10。

**后端**: 已有 `alliance_members.contribution_points` 字段。

需增强:
- `GET /api/alliances/:id/members` 已有，确保按 `contribution_points DESC` 排序
- 在绘画、签到、任务完成时自动增加 `contribution_points`

**iOS 实现**:

修改文件:
- `Views/Alliance/AllianceMemberListView.swift` — 成员列表增加贡献值列 + 排行序号

**验收标准**:
- [ ] 成员列表默认按贡献值排序
- [ ] 贡献值来源透明可查
- [ ] Top 3 成员有特殊标记

---

### 3.5 联盟主页重构

**产品描述**: 将联盟详情页从简单列表升级为信息丰富的「联盟主页」，含 Hero Banner + 等级 + 公告 + 签到 + 聊天入口 + 成员排行。

**iOS 实现**:

修改文件:
- 重构 `AllianceDetailPage` 的布局

新增布局结构:
```
ScrollView
├── Hero Banner Section
│   ├── 背景: 联盟旗帜颜色渐变
│   ├── 联盟名称 (largeTitle)
│   ├── Lv.{level} 徽章 + 经验进度条
│   ├── 核心数据横栏: 成员数 / 总像素 / 排名
│   └── 联盟宣言 (subheadline, 最多 2 行)
├── 公告卡片 (若有 notice)
│   └── 公告内容 + 发布时间
├── 签到区域
│   ├── 签到按钮
│   └── 今日已签到成员头像列表 (HScrollView)
├── 快捷操作栏
│   ├── 聊天 → AllianceChatView
│   ├── 成员 → AllianceMemberListView
│   ├── 设置 → AllianceEditView (仅管理员)
│   └── 邀请 → 邀请链接分享
└── 贡献排行 Top 5
    └── 5 行 AllianceMemberRow
```

**验收标准**:
- [ ] 联盟主页信息密度显著提升
- [ ] Hero Banner 视觉突出
- [ ] 各入口点击响应正确
- [ ] 非成员看到的是精简版（无签到、无聊天）

---

## Phase 4: 排行榜 Tab

> 核心目标：增加竞争感知和成长目标，让「看排名」变成「追排名」。

### 4.1 个人排名卡 (Sticky Header)

**产品描述**: 排行榜列表顶部固定显示当前用户的排名信息卡片，包含排名、像素数、距离上一名的差距。

**后端**: 需在排行榜 API 响应中增加当前用户的排名信息。

修改 API:
```
GET /api/leaderboard/personal?period=weekly
Response 增加字段:
{
  "myRank": {
    "rank": 42,
    "totalPixels": 1280,
    "gapToNext": 55,          -- 距上一名差多少像素
    "previousRank": 45,       -- 上一次查看时的排名 (用于变动展示)
    "percentile": 15.2        -- 击败了 84.8% 的玩家
  },
  "entries": [...]
}
```

修改文件:
- `backend/src/controllers/leaderboardController.js` — `getPersonalLeaderboard` 中增加 `myRank` 计算
- `backend/src/services/leaderboardService.js` — 新增 `getUserRank(userId, period)` 和 `getGapToNextRank(userId, period)`
- `backend/src/models/LeaderboardStats.js` — 新增存储上次排名用于变动计算

**iOS 实现**:

新增文件:
- `Views/Leaderboard/MyRankCard.swift`

视图结构:
```
MyRankCard (StandardCard 样式)
├── HStack
│   ├── RankBadge(rank: 42) — 大号
│   ├── VStack(alignment: .leading)
│   │   ├── "我的排名" — caption
│   │   ├── "1,280 像素" — headline, bold
│   │   └── "距上一名还差 55 像素" — caption, AppColors.textTertiary
│   ├── Spacer
│   └── 排名变化指示器
│       ├── 上升: Image("arrow.up") + Text("+3"), 绿色
│       └── 下降: Image("arrow.down") + Text("-2"), 红色
```

修改文件:
- `Views/LeaderboardTabView.swift` — 在列表顶部添加 `MyRankCard`（Section header，不随列表滚动或使用 `pinnedViews: [.sectionHeaders]`）
- `ViewModels/LeaderboardViewModel.swift` — 增加 `myRank` 属性

**验收标准**:
- [ ] 排行榜顶部固定显示个人排名卡
- [ ] 显示与上一名的差距
- [ ] 排名变动有箭头和颜色标识
- [ ] 点击排名卡可滚动到自己在列表中的位置

---

### 4.2 Top 3 展台

**产品描述**: 前三名以特殊领奖台样式展示在排行榜顶部（排名卡下方），金银铜三色，替代列表中的前三行。

**iOS 实现**:

新增文件:
- `Views/Leaderboard/Top3PodiumView.swift`

视图结构:
```
Top3PodiumView (高度约 180pt)
├── HStack(alignment: .bottom, spacing: AppSpacing.l)
│   ├── PodiumItem(rank: 2, height: 100) — 银色
│   │   ├── AvatarView(size: 48) + 联盟旗帜 badge
│   │   ├── 昵称 (caption, maxWidth 80)
│   │   └── 像素数 (subheadline, bold)
│   ├── PodiumItem(rank: 1, height: 130) — 金色
│   │   ├── 皇冠图标
│   │   ├── AvatarView(size: 56) + 联盟旗帜 badge
│   │   ├── 昵称 (subheadline, bold)
│   │   └── 像素数 (headline, bold)
│   └── PodiumItem(rank: 3, height: 80) — 铜色
│       ├── AvatarView(size: 44) + 联盟旗帜 badge
│       ├── 昵称 (caption, maxWidth 80)
│       └── 像素数 (subheadline, bold)
```

颜色: 金 `Color(hex: "#FFD700")`，银 `Color(hex: "#C0C0C0")`，铜 `Color(hex: "#CD7F32")`。

修改文件:
- `Views/LeaderboardTabView.swift` — 列表顶部添加 `Top3PodiumView`，列表数据从第 4 名开始显示

**验收标准**:
- [ ] 前三名以领奖台样式突出展示
- [ ] 第一名视觉上最突出（最高柱 + 皇冠）
- [ ] 排行列表从第 4 名开始
- [ ] 切换维度/时段时领奖台数据同步更新

---

### 4.3 好友排行

**产品描述**: 排行榜维度新增「好友」Tab，仅展示已关注 / 互关用户的排名。

**后端实现**:

新增 API:
```
GET /api/leaderboard/friends?period=weekly&limit=50&offset=0
Authorization: Bearer <token>

Response:
{
  "entries": [
    {
      "rank": 1,
      "userId": "uuid",
      "displayName": "string",
      "avatarUrl": "string",
      "allianceName": "string|null",
      "allianceColor": "#hex|null",
      "totalPixels": 5000,
      "isCurrentUser": false,
      "isMutual": true  -- 是否互关
    }
  ],
  "myRank": { "rank": 3, "totalPixels": 2800 },
  "totalFriends": 25
}
```

实现: 查询 `user_follows` 获取当前用户关注列表，JOIN `pixels` 按时段聚合像素数。结果按像素数 DESC 排序，添加序号作为 rank。

新增文件:
- 在 `leaderboardController.js` 中新增 `getFriendsLeaderboard` 方法
- 在 `leaderboardRoutes.js` 中新增 `GET /friends` 路由

**iOS 实现**:

修改文件:
- `Views/LeaderboardTabView.swift` — 子标签从 3 个 (个人/联盟/城市) 增加为 4 个 (个人/好友/联盟/城市)
- `ViewModels/LeaderboardViewModel.swift` — 新增 `friendsEntries`, `loadFriendsLeaderboard()`, 并纳入 parallel loading `withTaskGroup`
- `LeaderboardService.swift` — 新增 `getFriendsLeaderboard(period:limit:offset:)`

**验收标准**:
- [ ] 好友排行仅展示已关注用户
- [ ] 互关好友有特殊标记
- [ ] 好友数为 0 时显示空状态引导关注
- [ ] 支持时段切换

---

### 4.4 段位/军衔系统

**产品描述**: 基于累计总像素数的段位体系，影响全局身份展示。

**后端实现**:

段位为纯计算逻辑，不需要新表。在用户信息返回时实时计算。

新增文件:
- `backend/src/constants/rankTiers.js`

```javascript
const RANK_TIERS = [
  { id: 'recruit',    name: '新兵',   nameEn: 'Recruit',    minPixels: 0,       icon: 'star.fill',         color: '#9E9E9E' },
  { id: 'private',    name: '列兵',   nameEn: 'Private',    minPixels: 100,     icon: 'star.fill',         color: '#8D6E63' },
  { id: 'corporal',   name: '下士',   nameEn: 'Corporal',   minPixels: 500,     icon: 'shield.fill',       color: '#CD7F32' },
  { id: 'sergeant',   name: '中士',   nameEn: 'Sergeant',   minPixels: 2000,    icon: 'shield.fill',       color: '#C0C0C0' },
  { id: 'lieutenant', name: '少尉',   nameEn: 'Lieutenant', minPixels: 5000,    icon: 'shield.fill',       color: '#FFD700' },
  { id: 'captain',    name: '上尉',   nameEn: 'Captain',    minPixels: 15000,   icon: 'crown.fill',        color: '#CD7F32' },
  { id: 'major',      name: '少校',   nameEn: 'Major',      minPixels: 40000,   icon: 'crown.fill',        color: '#C0C0C0' },
  { id: 'colonel',    name: '上校',   nameEn: 'Colonel',    minPixels: 100000,  icon: 'crown.fill',        color: '#FFD700' },
  { id: 'general',    name: '将军',   nameEn: 'General',    minPixels: 250000,  icon: 'crown.fill',        color: '#00BCD4' },
  { id: 'marshal',    name: '元帅',   nameEn: 'Marshal',    minPixels: 1000000, icon: 'crown.fill',        color: '#E91E63' },
];
```

服务端: 新增 `rankTierService.js`，提供 `getTierForPixels(totalPixels)` 函数。在 `auth.js` 的 `GET /me` 和 `profileController` 的 `getUserProfile` 返回中附加 `rankTier` 字段。

修改 API 返回（无需新端点，增强现有返回）:
```json
// GET /api/auth/me, GET /api/profile/:userId 响应增加:
{
  "rankTier": {
    "id": "captain",
    "name": "上尉",
    "nameEn": "Captain",
    "icon": "crown.fill",
    "color": "#CD7F32",
    "currentPixels": 18500,
    "nextTierPixels": 40000,
    "progress": 0.14   // (18500-15000)/(40000-15000)
  }
}
```

排行榜增强: `getPersonalLeaderboard` 返回的每个 entry 也附加 `rankTier`。

**iOS 实现**:

新增文件:
- `Models/RankTier.swift` — 段位模型 + 本地计算逻辑
- `Views/Common/RankTierBadge.swift` — 段位徽章组件（图标 + 颜色 + 名称）
- `Views/Common/RankTierProgressBar.swift` — 段位进度条（当前段位图标 → 进度条 → 下一段位图标）

修改文件:
- `Views/ProfileTabView.swift` — 个人主页显示段位徽章 + 进度条
- `Views/Leaderboard/LeaderboardEntryRow` 内置显示段位小图标
- `Views/Feed/FeedItemCard.swift` — 用户名旁显示段位图标
- `Views/Map/NearbyPlayerCard.swift` — 玩家卡片显示段位

`RankTierBadge` 组件:
```
HStack(spacing: 4)
├── Image(systemName: tier.icon)
│   .font(.system(size: 12))
│   .foregroundColor(Color(hex: tier.color))
└── Text(tier.name)
    .font(AppTypography.caption)
    .foregroundColor(Color(hex: tier.color))
```

**验收标准**:
- [ ] 段位根据总像素实时计算
- [ ] 段位图标在个人主页、排行榜、动态卡片等处统一展示
- [ ] 段位进度条显示距下一级的进度
- [ ] 段位晋升时触发庆祝动画 + 成就通知
- [ ] 最高段位（元帅）需 100 万像素

---

### 4.5 排名变动动画

**产品描述**: 排行榜中每一行显示相比上次的排名变化（绿色上升/红色下降箭头）。

**后端实现**:

修改数据库:
```sql
-- Migration: add_rank_history
ALTER TABLE leaderboard_personal ADD COLUMN previous_rank INT;
ALTER TABLE leaderboard_alliance ADD COLUMN previous_rank INT;
```

在排行榜定时刷新 job 中，更新前先把当前 rank 存入 `previous_rank`，再计算新 rank。

修改 API: `getPersonalLeaderboard` 和 `getAllianceLeaderboard` 的每个 entry 增加 `previousRank` 和 `rankChange` 字段。

**iOS 实现**:

修改文件:
- `LeaderboardService.swift` — `LeaderboardEntry` 增加 `previousRank: Int?` 字段
- `Views/Leaderboard/LeaderboardEntryRow` 或同等视图 — 添加排名变化指示器

排名变化指示器:
```swift
@ViewBuilder
var rankChangeIndicator: some View {
    if let change = entry.rankChange, change != 0 {
        HStack(spacing: 2) {
            Image(systemName: change > 0 ? "arrow.up" : "arrow.down")
                .font(.system(size: 10, weight: .bold))
            Text("\(abs(change))")
                .font(AppTypography.caption)
        }
        .foregroundColor(change > 0 ? AppColors.secondary : AppColors.tertiary)
    }
}
```

**验收标准**:
- [ ] 排名上升显示绿色向上箭头
- [ ] 排名下降显示红色向下箭头
- [ ] 未变化不显示
- [ ] 新进入榜单标记「NEW」

---

## Phase 5: 我的 Tab

> 核心目标：从「设置入口」升级为「个人中心」，增加成长目标、社交数据、每日任务驱动。

### 5.1 个人主页 Header 重构

**产品描述**: 将简陋的 Profile Card 升级为信息密集的 Hero Banner + 核心数据横栏。

**iOS 实现** (前端重构为主，无需新后端 API):

修改文件:
- `Views/ProfileTabView.swift` — 重构顶部布局

新增布局:
```
ScrollView
├── Profile Hero Section
│   ├── 背景: 联盟色渐变 / 默认蓝灰渐变
│   ├── HStack
│   │   ├── AvatarView(size: 72) + 联盟旗帜小徽章(右下角)
│   │   └── VStack(alignment: .leading)
│   │       ├── HStack: 昵称 + RankTierBadge
│   │       ├── 签名 (caption, textSecondary, 1 行)
│   │       └── 联盟名称 (caption, 可点击跳转联盟 Tab)
│   └── 编辑按钮(右上角 pencil icon)
├── 核心数据横栏 (4 列)
│   ├── 关注 {count} — 点击 → 关注列表
│   ├── 粉丝 {count} — 点击 → 粉丝列表
│   ├── 像素 {totalPixels} — 点击 → 历史 Tab
│   └── 成就 {achievementCount} — 点击 → 成就页
├── 段位进度卡片 (StandardCard)
│   ├── HStack: RankTierBadge(current) + ProgressBar + RankTierBadge(next)
│   └── "还差 {gap} 像素升级" (caption)
├── 今日卡片 (StandardCard, 渐变背景)
│   ├── 今日像素: 环形进度条 + {today}/{goal}
│   ├── 每日任务: {completed}/{total} 已完成
│   ├── 连续登录: 🔥 {streak} 天
│   └── 快捷按钮: "开始绘画" → 地图Tab + 开始GPS绘画
├── 菜单列表 (保留原有菜单项，重新分组)
│   ├── 功能区: 每日任务 / 商店 / 活动中心
│   ├── 社交区: 消息 / 邀请好友
│   ├── 收藏区: 背包 / 成就 / 旅途收藏
│   └── 系统区: 设置
└── (去掉登出按钮，移入设置页)
```

数据来源:
- 关注/粉丝数: 新增 `GET /api/social/user-stats/{userId}` (已有)
- 今日像素: 从 `PixelDrawService.shared` 或通过 `GET /api/stats/today` (新增简单 API)
- 连续签到: `CheckinService`
- 每日任务进度: `DailyTaskService`

新增 API:
```
GET /api/stats/today
Authorization: Bearer <token>
Response: { todayPixels: 85, todaySessions: 2, todayDistance: 1.2 }
```

新增后端文件:
- 在 `statsController.js` 新增 `getTodayStats`

**验收标准**:
- [ ] 个人主页信息密度大幅提升
- [ ] 关注/粉丝可点击进入列表
- [ ] 段位进度直观展示
- [ ] 今日卡片引导用户行动
- [ ] 菜单分组清晰

---

### 5.2 关注/粉丝列表页

**产品描述**: 点击「关注」或「粉丝」数字进入列表页，展示用户列表，支持关注/取关操作。

**后端**: 已有 `GET /api/social/following/:userId` 和 `GET /api/social/followers/:userId`。

**iOS 实现**:

新增文件:
- `Views/Social/FollowListView.swift` — 关注/粉丝列表
- `Views/Social/UserListRow.swift` — 单行用户（头像 + 昵称 + 段位 + 关注/取关按钮）

`FollowListView` 结构:
```
NavigationStack
├── Picker: 关注 / 粉丝 (segmented)
├── List
│   └── ForEach(users)
│       └── UserListRow
│           ├── AvatarView(size: 40)
│           ├── VStack: 昵称 + RankTierBadge + 签名
│           ├── Spacer
│           └── Button("关注" / "已关注" / "互关")
└── 空状态: "还没有关注任何人 / 还没有粉丝"
```

修改文件:
- `Views/ProfileTabView.swift` — 核心数据横栏中关注/粉丝数添加 `NavigationLink` 到 `FollowListView`
- `SocialService.swift` — 确保有 `getFollowing(userId:)` 和 `getFollowers(userId:)` 方法

**验收标准**:
- [ ] 关注/粉丝列表正确展示
- [ ] 可直接在列表中关注/取关
- [ ] 互关关系有标识

---

### 5.3 每日任务入口页

**产品描述**: 「我的」Tab 菜单中的「每日任务」入口，进入后展示当天 5 个任务的列表和进度。

**iOS 实现** (后端已在 Phase 1.3 中实现):

新增文件:
- `Views/DailyTask/DailyTaskListView.swift` — 任务列表页

视图结构:
```
NavigationStack
├── 顶部: 全任务完成度环形图 + "{completed}/5 已完成"
├── List
│   └── ForEach(tasks)
│       └── DailyTaskRow
│           ├── 任务图标 (根据 type: draw_at_location=📍, draw_distance=🏃, draw_count=🎨)
│           ├── VStack: 标题 + 描述
│           ├── ProgressView(value: current/target) — 进度条
│           └── Button("领取") — is_completed && !is_claimed 时显示
└── 底部: 额外宝箱区域
    ├── 宝箱图标 (已完成全部: 金色可领取 / 否则: 灰色锁定)
    └── "完成全部任务领取额外奖励"
```

修改文件:
- `Views/ProfileTabView.swift` — 菜单中的「每日任务」项使用 `NavigationLink(destination: DailyTaskListView())`

**验收标准**:
- [ ] 展示当天所有任务及进度
- [ ] 已完成未领取的任务可一键领取
- [ ] 全部完成显示可领取的额外宝箱
- [ ] 领取奖励有积分增加动画

---

### 5.4 签到系统升级

**产品描述**: 将签到页面从单次弹窗升级为 7 天循环 + 里程碑展示。

**后端**: 已有 `daily_checkin` 表和 `CheckinService`。

需增强:
```
GET /api/checkin/stats 增加返回:
{
  "currentStreak": 7,
  "longestStreak": 23,
  "totalCheckins": 85,
  "weekRewards": [
    { "day": 1, "points": 10, "claimed": true },
    { "day": 2, "points": 15, "claimed": true },
    ...
    { "day": 7, "points": 100, "claimed": false }
  ],
  "milestones": [
    { "days": 30, "reward": 500, "claimed": true },
    { "days": 90, "reward": 2000, "claimed": false },
    { "days": 180, "reward": 5000, "claimed": false },
    { "days": 365, "reward": 20000, "claimed": false }
  ]
}
```

**iOS 实现**:

修改文件:
- 重构签到弹窗视图，改为完整页面

新增文件:
- `Views/Checkin/CheckinCalendarView.swift` — 7 天循环签到 UI + 里程碑进度

视图结构:
```
VStack
├── 连续签到天数: "🔥 连续 {streak} 天"
├── 7 天奖励格子 (HStack, 7 个圆形)
│   ├── 已签到: 绿色勾号 + 已领积分
│   ├── 今日: 高亮蓝色 + "签到"按钮
│   └── 未来: 灰色 + 预览积分
├── 签到按钮 (大号, 主色调, 或已签到灰色)
├── Divider
└── 里程碑列表
    ├── 30 天: ✅ 已领 / 🔒 还差 N 天
    ├── 90 天: 🔒 还差 N 天
    ├── 180 天: 🔒
    └── 365 天: 🔒
```

**验收标准**:
- [ ] 7 天循环签到奖励正确展示
- [ ] 第 7 天奖励显著高于其他天
- [ ] 里程碑进度清晰
- [ ] 断签重置 7 天循环但不影响累计
- [ ] 签到成功有积分飞入动画

---

## Phase 6: Tab Bar 全局增强

### 6.1 Badge 系统

**产品描述**: 每个 Tab 根据条件显示红点/数字 Badge，提醒用户有未处理事项。

**后端实现**:

新增聚合 API:
```
GET /api/badges
Authorization: Bearer <token>

Response:
{
  "map": { "hasActivity": true },        -- 有限时活动进行中
  "feed": { "count": 5 },                -- 5 条未读互动 (赞/评论/新粉丝)
  "alliance": { "count": 3 },            -- 3 条未读联盟消息/待审核申请
  "leaderboard": { "rankChanged": true }, -- 排名有变化
  "profile": { "count": 2 }              -- 2 个可领取奖励 (任务/成就)
}
```

实现: 聚合查询各模块未读/待处理计数。Redis 缓存 30 秒。

新增文件:
- `backend/src/routes/badgeRoutes.js`
- `backend/src/controllers/badgeController.js`
- `backend/src/services/badgeService.js`

**iOS 实现**:

新增文件:
- `Services/API/BadgeService.swift`
- `ViewModels/BadgeViewModel.swift` — `@MainActor ObservableObject` 单例，`@Published` 各 Tab badge 状态

修改文件:
- `Views/ContentView.swift` — `TabBar` 中每个 `TabBarItem` 根据 `BadgeViewModel` 状态显示 badge

Badge UI: 在 Tab 图标右上角叠加红色圆点（无数字时）或红色数字气泡（有数字时）。使用 `.overlay(alignment: .topTrailing)` 实现。

刷新策略:
- App 进入前台时请求一次
- 每 60 秒轮询一次
- 切换 Tab 时对应 Tab 的 badge 清零（本地立即清除，同时调用标记已读接口）

**验收标准**:
- [ ] 各 Tab 在有待处理事项时显示红色 badge
- [ ] 点进 Tab 后对应 badge 消失
- [ ] Badge 数据定时刷新
- [ ] 不影响 Tab 切换性能

---

### 6.2 跨 Tab 导航联动

**产品描述**: 各功能点之间支持一键跳转到其他 Tab 的特定位置。

**iOS 实现**:

使用现有的 `selectedTab` state 和 NotificationCenter 事件实现跨 Tab 导航:

新增文件:
- `Services/Navigation/NavigationCoordinator.swift`

```swift
@MainActor
class NavigationCoordinator: ObservableObject {
    static let shared = NavigationCoordinator()

    enum Destination {
        case mapLocation(lat: Double, lng: Double)       // 飞往地图某位置
        case mapStartDrawing                              // 开始绘画
        case feedDetail(sessionId: String)                // 查看某条动态
        case allianceChat(allianceId: String)             // 联盟聊天
        case allianceDetail(allianceId: String)           // 联盟详情
        case leaderboardPersonal                          // 个人排行
        case dailyTasks                                   // 每日任务
        case achievementDetail(achievementId: String)     // 成就详情
        case profileUser(userId: String)                  // 他人主页
    }

    @Published var pendingDestination: Destination?

    func navigate(to destination: Destination, switchingTab: inout Int) {
        // 根据 destination 切换到对应 Tab，设置 pendingDestination
        // 目标 Tab 的视图 onAppear 时检查 pendingDestination 并执行内部导航
    }
}
```

修改文件:
- `Views/ContentView.swift` — 注入 `NavigationCoordinator`，Tab 切换时检查 `pendingDestination`
- 各 Tab 视图 — `onAppear` 检查是否有 pending navigation

典型联动场景:
| 来源 | 操作 | 目标 |
|------|------|------|
| 动态 Feed 中的绘画动态 | 点击「飞往」| 切换到地图 Tab → 飞往坐标 |
| 排行榜某用户 | 点击头像 | 弹出用户主页 Sheet |
| 联盟任务 | 点击「前往」| 切换到地图 Tab → 标记任务区域 |
| 每日任务 | 点击位置任务 | 切换到地图 Tab → 飞往任务点 |
| 个人主页今日卡片 | 点击「开始绘画」| 切换到地图 Tab → 触发 GPS 绘画 |

**验收标准**:
- [ ] 各跨 Tab 跳转场景均能正确导航
- [ ] Tab 切换有平滑过渡
- [ ] 跳转后目标位置正确聚焦
- [ ] 返回时回到原始位置

---

## 实施路线图

### Sprint 1 (第 1-2 周): 基础设施

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 0.1 | 统一 AuthManager (清理 SessionManager) | iOS | 无 |
| 0.2 | 统一数据模型 (Alliance, Leaderboard) | iOS | 无 |
| 0.3 | 统一网络层 (迁移 URLSession → APIManager) | iOS | 无 |
| 6.1a | Badge API 后端实现 | Backend | 无 |
| 6.1b | Badge 前端实现 | iOS | 6.1a |

### Sprint 2 (第 3-4 周): 排行榜 + 段位

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 4.4a | 段位常量定义 + 后端计算逻辑 | Backend | 无 |
| 4.4b | RankTierBadge 组件 + 全局展示 | iOS | 4.4a |
| 4.1a | 个人排名卡后端 (myRank 字段) | Backend | 无 |
| 4.1b | MyRankCard 前端组件 | iOS | 4.1a |
| 4.2 | Top3 展台前端组件 | iOS | 无 |
| 4.3a | 好友排行后端 API | Backend | 无 |
| 4.3b | 好友排行前端实现 | iOS | 4.3a |
| 4.5a | 排名变动后端 (previous_rank) | Backend | 无 |
| 4.5b | 排名变动前端动画 | iOS | 4.5a |

### Sprint 3 (第 5-6 周): 动态 Feed + 历史重构

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 2.1 | 历史 Tab 结构重构 (3 子标签) | iOS | 无 |
| 2.2a | Feed 数据库表 + API + 生成钩子 | Backend | 无 |
| 2.2b | SocialFeedView + FeedItemCard | iOS | 2.2a |
| 2.2c | Feed 点赞/评论功能 | Full Stack | 2.2b |
| 2.3a | 数据仪表盘后端 API | Backend | 无 |
| 2.3b | 热力日历 + 趋势图 + 城市足迹 | iOS | 2.3a |

### Sprint 4 (第 7-8 周): 联盟增强

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 3.1 | 联盟聊天室前端 (复用现有后端) | iOS | 无 |
| 3.2a | 联盟等级后端 (表修改 + 经验逻辑) | Backend | 无 |
| 3.2b | 联盟等级前端展示 | iOS | 3.2a |
| 3.3a | 联盟签到后端 API | Backend | 无 |
| 3.3b | 联盟签到前端组件 | iOS | 3.3a |
| 3.4 | 联盟贡献排行前端增强 | iOS | 3.2a |
| 3.5 | 联盟主页 UI 重构 | iOS | 3.1, 3.2b, 3.3b |

### Sprint 5 (第 9-10 周): 个人中心 + 每日任务

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 5.1 | 个人主页 Header 重构 | iOS | 4.4b |
| 5.2 | 关注/粉丝列表页 | iOS | 无 |
| 1.3a | 每日任务后端 (表 + API + 生成逻辑) | Backend | 无 |
| 1.3b | 每日任务前端列表 | iOS | 1.3a |
| 5.3 | 每日任务入口页 (我的Tab) | iOS | 1.3b |
| 5.4 | 签到系统升级 | iOS | 无 |

### Sprint 6 (第 11-12 周): 地图增强

| # | 任务 | 涉及层 | 依赖 |
|---|------|--------|------|
| 1.1a | 附近玩家后端 (Redis geo + API) | Backend | 无 |
| 1.1b | 附近玩家前端 (地图标注 + 卡片) | iOS | 1.1a |
| 1.2a | 区域信息后端 API | Backend | 无 |
| 1.2b | RegionInfoBar 前端组件 | iOS | 1.2a |
| 1.3c | 地图任务 Pin 图层 | iOS | 1.3a |
| 1.4a | 领地控制后端 (H3 + 计算job) | Backend | 无 |
| 1.4b | 领地控制前端 (地图图层) | iOS | 1.4a |
| 1.5 | 快速统计浮窗 | iOS | 无 |
| 6.2 | NavigationCoordinator + 跨Tab联动 | iOS | 全部 |

---

## 附录 A: 完整新增数据库表清单

| 表名 | Phase | 用途 | 关键索引 |
|------|-------|------|----------|
| `daily_tasks` | 1.3 | 每日地图任务 | user_id+created_at, GIST(location) |
| `daily_task_bonus` | 1.3 | 全任务完成奖励 | user_id+date (unique) |
| `territory_control` | 1.4 | H3 领地控制数据 | h3_index (PK), alliance_id |
| `feed_items` | 2.2 | 社交动态 | user_id+created_at, created_at |
| `feed_likes` | 2.2 | 动态点赞 | feed_item_id+user_id (unique) |
| `feed_comments` | 2.2 | 动态评论 | feed_item_id+created_at |
| `alliance_checkins` | 3.3 | 联盟签到 | alliance_id+user_id+date (unique) |

现有表修改:

| 表名 | Phase | 变更 |
|------|-------|------|
| `alliances` | 3.2 | 新增 level, experience, next_level_exp 字段 |
| `leaderboard_personal` | 4.5 | 新增 previous_rank 字段 |
| `leaderboard_alliance` | 4.5 | 新增 previous_rank 字段 |

---

## 附录 B: 完整新增 API 端点清单

| Method | Path | Phase | 认证 | 描述 |
|--------|------|-------|------|------|
| GET | `/api/map/nearby-players` | 1.1 | Yes | 附近活跃玩家 |
| GET | `/api/map/region-info` | 1.2 | Optional | 区域信息 |
| GET | `/api/daily-tasks` | 1.3 | Yes | 今日任务列表 |
| GET | `/api/daily-tasks/map-pins` | 1.3 | Yes | 任务地图标记 |
| POST | `/api/daily-tasks/:id/claim` | 1.3 | Yes | 领取任务奖励 |
| POST | `/api/daily-tasks/bonus/claim` | 1.3 | Yes | 领取全完成奖励 |
| GET | `/api/map/territories` | 1.4 | Optional | 领地控制数据 |
| GET | `/api/feed` | 2.2 | Yes | 社交动态流 |
| POST | `/api/feed/:id/like` | 2.2 | Yes | 点赞动态 |
| DELETE | `/api/feed/:id/unlike` | 2.2 | Yes | 取消点赞 |
| GET | `/api/feed/:id/comments` | 2.2 | Yes | 获取评论 |
| POST | `/api/feed/:id/comments` | 2.2 | Yes | 发表评论 |
| DELETE | `/api/feed/comments/:id` | 2.2 | Yes | 删除评论 |
| GET | `/api/stats/dashboard` | 2.3 | Yes | 数据仪表盘 |
| POST | `/api/alliances/:id/checkin` | 3.3 | Yes | 联盟签到 |
| GET | `/api/alliances/:id/checkin-status` | 3.3 | Yes | 联盟签到状态 |
| GET | `/api/alliances/:id/level-info` | 3.2 | Optional | 联盟等级信息 |
| GET | `/api/leaderboard/friends` | 4.3 | Yes | 好友排行榜 |
| GET | `/api/stats/today` | 5.1 | Yes | 今日统计 |
| GET | `/api/badges` | 6.1 | Yes | Tab badge 聚合 |

---

## 附录 C: 完整新增 iOS 文件清单

### Services (8 个)
| 文件 | Phase | 职责 |
|------|-------|------|
| `Services/API/MapSocialService.swift` | 1.1 | 附近玩家、区域信息 API |
| `Services/API/DailyTaskService.swift` | 1.3 | 每日任务 API |
| `Services/API/TerritoryService.swift` | 1.4 | 领地控制 API |
| `Services/API/FeedService.swift` | 2.2 | 社交动态 API |
| `Services/API/StatsService.swift` | 2.3 | 数据仪表盘 API |
| `Services/API/BadgeService.swift` | 6.1 | Badge 聚合 API |
| `Services/Navigation/NavigationCoordinator.swift` | 6.2 | 跨 Tab 导航 |
| `Models/RankTier.swift` | 4.4 | 段位模型 |

### ViewModels (5 个)
| 文件 | Phase | 职责 |
|------|-------|------|
| `ViewModels/DailyTaskViewModel.swift` | 1.3 | 每日任务状态管理 |
| `ViewModels/FeedViewModel.swift` | 2.2 | 动态 Feed 状态管理 |
| `ViewModels/DashboardViewModel.swift` | 2.3 | 数据仪表盘状态管理 |
| `ViewModels/AllianceChatViewModel.swift` | 3.1 | 联盟聊天状态管理 |
| `ViewModels/BadgeViewModel.swift` | 6.1 | Tab Badge 状态管理 |

### Views (25 个)
| 文件 | Phase | 职责 |
|------|-------|------|
| `Views/Map/NearbyPlayerAnnotation.swift` | 1.1 | 玩家地图标注 |
| `Views/Map/NearbyPlayerCard.swift` | 1.1 | 玩家信息卡 |
| `Views/Map/RegionInfoBar.swift` | 1.2 | 区域信息状态条 |
| `Views/Map/TaskPinAnnotation.swift` | 1.3 | 任务 Pin 标注 |
| `Views/Map/TerritoryLayer.swift` | 1.4 | 领地图层渲染 |
| `Views/Map/QuickStatsPopover.swift` | 1.5 | 快速统计浮窗 |
| `Views/Feed/FeedTabView.swift` | 2.1 | 动态 Tab 主容器 |
| `Views/Feed/SocialFeedView.swift` | 2.2 | 社交动态列表 |
| `Views/Feed/FeedItemCard.swift` | 2.2 | 动态卡片 |
| `Views/Feed/FeedCommentSheet.swift` | 2.2 | 评论弹窗 |
| `Views/Feed/FeedFilterPicker.swift` | 2.2 | Feed 筛选器 |
| `Views/Feed/MyRecordsView.swift` | 2.1 | 原历史记录(迁移) |
| `Views/Feed/DataDashboardView.swift` | 2.3 | 数据仪表盘 |
| `Views/Feed/HeatmapCalendarView.swift` | 2.3 | 热力日历 |
| `Views/Feed/TrendChartView.swift` | 2.3 | 趋势图表 |
| `Views/Feed/CityFootprintView.swift` | 2.3 | 城市足迹 |
| `Views/Alliance/AllianceChatView.swift` | 3.1 | 联盟聊天 |
| `Views/Alliance/ChatMessageBubble.swift` | 3.1 | 消息气泡 |
| `Views/Alliance/ChatInputBar.swift` | 3.1 | 聊天输入框 |
| `Views/Alliance/AllianceLevelBadge.swift` | 3.2 | 联盟等级徽章 |
| `Views/Alliance/AllianceLevelProgressBar.swift` | 3.2 | 联盟经验进度条 |
| `Views/Alliance/AllianceCheckinButton.swift` | 3.3 | 联盟签到按钮 |
| `Views/Leaderboard/MyRankCard.swift` | 4.1 | 个人排名卡 |
| `Views/Leaderboard/Top3PodiumView.swift` | 4.2 | 前三名展台 |
| `Views/Common/RankTierBadge.swift` | 4.4 | 段位徽章组件 |
| `Views/Common/RankTierProgressBar.swift` | 4.4 | 段位进度条 |
| `Views/DailyTask/DailyTaskListView.swift` | 5.3 | 任务列表页 |
| `Views/DailyTask/TaskRewardAnimation.swift` | 1.3 | 奖励动画 |
| `Views/Social/FollowListView.swift` | 5.2 | 关注/粉丝列表 |
| `Views/Social/UserListRow.swift` | 5.2 | 用户列表行 |
| `Views/Checkin/CheckinCalendarView.swift` | 5.4 | 签到日历 |

### 后端新增文件 (约 20 个)
| 文件 | Phase |
|------|-------|
| `routes/mapSocialRoutes.js` | 1.1 |
| `controllers/mapSocialController.js` | 1.1 |
| `services/activePlayerService.js` | 1.1 |
| `routes/dailyTaskRoutes.js` | 1.3 |
| `controllers/dailyTaskController.js` | 1.3 |
| `models/DailyTask.js` | 1.3 |
| `services/dailyTaskService.js` | 1.3 |
| `services/taskTemplateService.js` | 1.3 |
| `routes/territoryRoutes.js` | 1.4 |
| `controllers/territoryController.js` | 1.4 |
| `services/territoryCalculationService.js` | 1.4 |
| `models/TerritoryControl.js` | 1.4 |
| `routes/feedRoutes.js` | 2.2 |
| `controllers/feedController.js` | 2.2 |
| `models/FeedItem.js` | 2.2 |
| `services/feedService.js` | 2.2 |
| `routes/statsRoutes.js` | 2.3 |
| `controllers/statsController.js` | 2.3 |
| `controllers/allianceCheckinController.js` | 3.3 |
| `services/allianceCheckinService.js` | 3.3 |
| `services/allianceLevelService.js` | 3.2 |
| `constants/allianceLevels.js` | 3.2 |
| `constants/rankTiers.js` | 4.4 |
| `services/rankTierService.js` | 4.4 |
| `routes/badgeRoutes.js` | 6.1 |
| `controllers/badgeController.js` | 6.1 |
| `services/badgeService.js` | 6.1 |
| Migration 文件 x 7 | 各 Phase |

---

> **文档版本**: v2.0 (Production-Ready)
> **生成日期**: 2026-02-18
> **技术基线**: 基于代码库 commit `f3bc9a82f` 分析
> **预计总工期**: 12 周 (6 个 Sprint)
> **审阅状态**: 待 Product Owner 审阅
