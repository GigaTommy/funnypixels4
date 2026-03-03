# 地图屏幕功能完善方案 - 产品专家深度优化版

> 基于现有代码架构和已实现功能，系统化规划地图屏幕的产品升级方案
>
> **文档版本**: v1.0
> **生成日期**: 2026-02-28
> **适用项目**: FunnyPixels - 地图社交运动游戏

---

## 目录

- [一、地图屏幕整体架构](#一地图屏幕整体架构)
- [二、核心功能模块详细规划](#二核心功能模块详细规划)
  - [模块1：顶部信息显示系统](#模块1顶部信息显示系统)
  - [模块2：每日任务系统](#模块2每日任务系统)
  - [模块3：地图工具栏增强](#模块3地图工具栏增强)
  - [模块4：地图内快捷社交](#模块4地图内快捷社交)
  - [模块5：地图探索激励系统](#模块5地图探索激励系统)
- [三、产品优化建议](#三产品优化建议)
- [四、实施优先级建议](#四实施优先级建议)
- [附录：相关文档](#附录相关文档)

---

## 一、地图屏幕整体架构

### 1.1 现有功能清单

✅ **已实现功能**：
- MVT像素地图渲染
- 手动/GPS绘画
- 漫游热点
- 战争区域
- **漂流瓶系统**（已完成，包含配额管理、遭遇机制、音效系统）
  - 详见：`docs/features/drift-bottle/DRIFT_BOTTLE_IMPLEMENTATION_COMPLETE.md`
- 成就提示
- 每日签到

📋 **规划中功能**（来源：`tab-bar-enhancement-plan-v2.md`）：
- 附近活跃玩家展示
- 区域信息状态条
- 每日地图任务标记
- 领地控制可视化
- 快速统计浮窗

### 1.2 地图UI层级规划

```
地图屏幕 UI 层级（从上到下）
├── 🔝 顶部信息栏（Layer 1 - 始终可见）
│   ├── 区域信息状态条（推荐新增⭐）
│   ├── 活动/赛事通知横幅
│   └── 领地警报条（联盟被攻击时）
│
├── 🎯 地图主画布（Layer 2 - 核心交互区）
│   ├── MVT像素层（基础层）
│   ├── 领地控制六边形层（zoom 10-14）
│   ├── 附近玩家脉冲光点（zoom ≥12）
│   ├── 每日任务标记点
│   ├── 漂流瓶遭遇标记
│   ├── 宝箱/资源点
│   └── 好友实时位置标记
│
├── 🧰 地图工具栏（Layer 3 - 右侧垂直栏）
│   ├── 快速统计浮窗按钮（新增⭐）
│   ├── 图层控制按钮
│   ├── 定位按钮
│   ├── 漂流瓶入口（已实现✅）
│   └── 热力图开关（新增⭐）
│
├── 💬 左下角快捷入口（Layer 4）
│   ├── 联盟聊天气泡（新增⭐）
│   └── 附近玩家列表（新增⭐）
│
└── 🎮 底部动态区域（Layer 5）
    ├── 每日任务进度条（收起/展开）
    ├── GPS绘画控制面板
    └── 漂流瓶遭遇横幅（已实现✅）
```

### 1.3 信息密度分级显示策略

为避免视觉混乱，根据缩放级别自适应显示不同元素：

| Zoom级别 | 显示内容 | 目的 |
|---------|---------|------|
| **< 10** | 仅领地色块、战争区域 | 宏观态势 |
| **10-12** | + 宝箱、任务标记 | 引导探索 |
| **12-14** | + 附近玩家、好友位置 | 社交互动 |
| **≥ 14** | + 实时绘画轨迹流 | 微观细节 |

---

## 二、核心功能模块详细规划

### 模块1：顶部信息显示系统

#### 1.1 区域信息状态条（P0 - 核心功能）

**产品目标**：让用户时刻了解当前区域的竞争态势

**UI设计**：
```
┌─────────────────────────────────────────────┐
│ 📍北京市朝阳区  ■ 12,580  👥 23  ▼         │  ← 半透明毛玻璃背景
└─────────────────────────────────────────────┘
   区域名称      像素数  活跃玩家  展开按钮
```

**下拉展开内容**：
- 🏴 占领联盟信息（名称、颜色、占比）
- 🏆 区域Top 3玩家快照
- 📊 像素密度热力图预览

**技术实现**：

后端 API:
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
    "dominantAlliance": {
      "name": "string",
      "color": "#hex",
      "percentage": 45.2
    } | null,
    "topPlayers": [
      { "displayName": "string", "pixelCount": 500, "rank": 1 }
    ]
  }
}
```

**交互逻辑**：
- 地图移动停止0.5秒后自动更新（防抖）
- GPS绘画模式自动隐藏腾出空间
- 点击区域名称可查看区域历史数据

**数据来源**：
- `regionName`: 通过反向地理编码（复用 `geocodingService.js`）
- `totalPixels`: PostGIS 查询可视区域内像素数
- `activePlayers`: Redis geo set 查询
- **缓存策略**：按H3 resolution 6索引缓存60秒

**iOS实现**：

新增文件:
- `Views/Map/RegionInfoBar.swift` — 顶部状态条 SwiftUI 视图

视图结构:
```swift
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

修改文件:
- `Views/ContentView.swift` — 在地图 ZStack 顶部添加 `RegionInfoBar`

**验收标准**:
- [ ] 地图顶部始终显示当前区域名称和统计数据
- [ ] 下拉可展开区域详情
- [ ] 移动地图自动更新数据（有 debounce）
- [ ] GPS 绘画模式下状态条自动隐藏以腾出空间

---

#### 1.2 活动/赛事通知横幅（P1）

**产品目标**：及时通知用户限时活动，提升参与率

**UI设计**：
```
┌────────────────────────────────────────────┐
│ 🎊 限时活动「春节争霸」进行中  剩余 02:35  │  ← 渐变色背景
└────────────────────────────────────────────┘
```

**通知类型**：

| 类型 | 图标 | 背景色 | 优先级 |
|-----|------|--------|--------|
| 限时区域挑战 | 🔥 | 橙色渐变 | 高 |
| 联盟战争 | ⚔️ | 红色渐变 | 高 |
| 宝箱刷新 | 🎁 | 蓝色渐变 | 中 |
| 赛季提醒 | 🏆 | 紫色渐变 | 中 |
| 系统公告 | 📢 | 灰色渐变 | 低 |

**交互逻辑**：
- 点击跳转活动详情或直接飞往活动区域
- 可手动关闭当次提醒（右侧×按钮）
- 支持优先级队列（多条通知按重要性轮播，每条停留5秒）
- 用户可在设置中关闭特定类型通知

**技术实现**：

后端推送:
- Socket.IO 事件: `map_notification`
- 本地通知展示逻辑在 iOS 端控制

iOS实现:
- `Views/Map/NotificationBanner.swift`
- 使用 SwiftUI `Animation` 实现滑入/滑出效果
- 自动消失计时器（5秒）

---

#### 1.3 领地警报系统（P2 - 联盟功能深化）

**产品目标**：激发联盟成员的防守行为

**触发条件**：
- 联盟领地被敌对联盟侵入（像素占比下降≥5%）
- 关键区域（首都/旗舰区）被攻击
- 仅推送给在线联盟成员

**UI设计**：
```
┌────────────────────────────────────────────┐
│ ⚠️ 警报！XX联盟正在入侵「朝阳区」  查看→  │  ← 红色闪烁边框
└────────────────────────────────────────────┘
```

**交互逻辑**：
- 点击「查看」飞往被攻击区域，地图自动缩放到合适级别
- 显示入侵联盟信息和当前态势（我方占比 vs 敌方占比）
- 一键参战：快速切换到对应联盟颜色开始绘画
- 防骚扰机制：同一区域警报最多每30分钟推送一次

**技术实现**：

后端逻辑:
- 领地计算服务检测到占比变化时触发
- Socket.IO 推送给联盟在线成员: `territory_alert`
- 记录警报历史到 `territory_alerts` 表

数据库表:
```sql
CREATE TABLE territory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id),
  h3_index VARCHAR(20) NOT NULL,
  region_name VARCHAR(200),
  attacker_alliance_id UUID REFERENCES alliances(id),
  old_percentage DECIMAL(5,2),
  new_percentage DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 模块2：每日任务系统

#### 2.1 地图任务标记（P0 - 日活驱动核心）

**产品目标**：通过任务引导用户探索和活跃

**任务类型设计**：

| 任务类型 | 描述 | 目标值示例 | 奖励 | 图标 | 难度 |
|---------|------|-----------|------|-----|------|
| **定点绘画** | 在指定地点绘画N个像素 | 50像素 | 50积分 | 📍 | 简单 |
| **距离挑战** | 连续GPS绘画N米 | 500米 | 100积分 | 🏃 | 中等 |
| **区域探索** | 在3个不同区域绘画 | 3区域 | 150积分 | 🗺️ | 中等 |
| **联盟协作** | 与联盟成员在同一位置绘画 | 2人 | 200积分 | 🤝 | 困难 |
| **宝箱猎人** | 拾取N个地图宝箱 | 3个 | 80积分 | 📦 | 简单 |

**每日任务配置**：
- 每天00:00自动生成5个任务
- 组合：3个简单 + 1个中等 + 1个困难
- 任务过期时间：当天23:59:59

**地图显示方案**：
```
地图上任务标记样式：
    📍  ← 任务类型图标
    │
    ○   ← 脉冲动画圆形底座
   ╱ ╲
  ○   ○  ← 半透明圆形范围（500m半径）
```

**进度追踪**：
- 底部任务进度条实时更新
- 完成瞬间弹出奖励动画（金币雨+音效）
- Socket.IO实时推送任务进度: `task_progress`, `task_completed`

**智能任务生成逻辑**：
1. 基于用户最近7天活跃区域中心点
2. 在中心点±5km范围内随机选择任务位置
3. 使用PostGIS过滤水域、建筑物内部
4. 难度根据用户等级动态调整：
   - 新手（<100像素）：目标值×0.5
   - 普通（100-1000）：标准目标值
   - 高级（>1000）：目标值×1.5

**技术实现**：

数据库表:
```sql
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  task_type VARCHAR(30) NOT NULL,
    -- 'draw_at_location', 'draw_distance', 'draw_count', 'visit_location'
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
```

后端 API:
```
GET /api/daily-tasks
Authorization: Bearer <token>
Response: {
  tasks: [...],
  bonusStatus: { allCompleted, bonusClaimed }
}

GET /api/daily-tasks/map-pins
Authorization: Bearer <token>
Response: {
  pins: [
    {
      taskId,
      lat,
      lng,
      radius,
      type,
      title,
      iconName,
      progress: { current, target }
    }
  ]
}

POST /api/daily-tasks/:taskId/claim
Authorization: Bearer <token>
Response: { reward: { points, items }, newBalance }

POST /api/daily-tasks/bonus/claim
Authorization: Bearer <token>
Response: { reward: { points, items }, newBalance }
```

进度更新:
- 在 `pixelDrawController.js` 的 `drawPixel` 成功回调中
- 调用 `dailyTaskService.checkProgress(userId, pixelData)`
- 若完成则通过 Socket.IO 推送 `task_completed` 事件

新增文件:
- `backend/src/routes/dailyTaskRoutes.js`
- `backend/src/controllers/dailyTaskController.js`
- `backend/src/models/DailyTask.js`
- `backend/src/services/dailyTaskService.js`
- `backend/src/services/taskTemplateService.js`

**iOS实现**：

新增文件:
- `Services/API/DailyTaskService.swift`
- `ViewModels/DailyTaskViewModel.swift`
- `Views/Map/TaskPinAnnotation.swift` — 地图上的任务标记
- `Views/DailyTask/DailyTaskListView.swift` — 「我的」Tab 中的任务列表
- `Views/DailyTask/TaskRewardAnimation.swift` — 奖励领取动画

修改文件:
- `Views/MapLibreMapView.swift` — 添加任务 pin 图层
- `Views/ContentView.swift` — 监听 `task_completed` Socket 事件
- `Services/Network/SocketIOManager.swift` — 监听 `task_completed`, `task_progress` 事件

地图 Pin 样式:
- 使用 `MLNSymbolStyleLayer` + SF Symbol 图标渲染
- 任务 pin 带脉冲动画（`MLNCircleStyleLayer` 配合 `pulsing` 效果）
- 半径用 `MLNFillStyleLayer` 半透明圆形展示

**验收标准**:
- [ ] 每天 00:00 自动生成 5 个任务
- [ ] 有位置要求的任务在地图上显示 pin
- [ ] 绘画行为自动推进任务进度
- [ ] 任务完成后弹出奖励动画
- [ ] 全部完成可领取额外宝箱奖励
- [ ] 过期任务自动清理

---

#### 2.2 全部完成奖励宝箱（P0）

**产品目标**：激励用户完成所有任务

**奖励机制**：
- 完成3个简单任务：解锁中等任务
- 完成4个任务：解锁困难任务
- **全部完成5个**：额外宝箱（200积分+稀有道具）

**UI展示**（我的Tab每日任务板）：
```
┌─────────────────────────────────┐
│ 今日任务  ✅ 4/5 完成            │
│ ━━━━━━━━━━━━━━━━━━ 80%        │  ← 进度条
│                                 │
│ ✅ 定点绘画：50/50 像素          │
│ ✅ 距离挑战：500/500 米          │
│ ✅ 区域探索：3/3 区域            │
│ ✅ 联盟协作：2/2 次              │
│ ⏳ 宝箱猎人：2/3 个              │
│                                 │
│   🎁 全部完成奖励                │
│   ┌──────────────────┐         │
│   │  🔒 神秘宝箱      │         │  ← 未完成时锁定
│   │  200积分+稀有道具  │         │
│   └──────────────────┘         │
│                                 │
│  [领取奖励]  (全部完成后激活)    │
└─────────────────────────────────┘
```

数据库表:
```sql
CREATE TABLE daily_task_bonus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  all_completed BOOLEAN DEFAULT false,
  bonus_claimed BOOLEAN DEFAULT false,
  bonus_points INT DEFAULT 200,
  bonus_items JSONB, -- [{ itemId, quantity }]
  claimed_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);
```

**奖励领取动画**：
- 宝箱打开动画（3D旋转+金光特效）
- 奖励物品飞出展示
- 音效：开箱音 + 获得奖励音

---

### 模块3：地图工具栏增强

#### 3.1 快速统计浮窗（P0 - 提升信息密度）

**产品目标**：无需切换Tab即可查看核心数据

**UI设计**：
```
点击工具栏 📊 按钮弹出：
┌────────────────────┐
│  📊 今日数据        │  ← 毛玻璃背景
│ ━━━━━━━━━━━━━━━━ │
│ ■ 今日像素  120    │
│ 🔥 连续登录  7天   │
│ 🏆 当前排名  #42   │
│ ⭐ 积分余额  1,280 │
│ 💧 资源值    80/100│
│                    │
│  [查看详情]  [×]   │
└────────────────────┘
```

**数据来源**：
- **今日像素**: `PixelDrawService.shared.todayPixels`
- **连续登录**: `CheckinService.shared.streakDays`
- **当前排名**: `ProfileViewModel.currentRank`
- **积分余额**: `ProfileViewModel.points`
- **资源值**: `PixelDrawService.shared.pixelPoints / maxPoints`

**优化策略**：
- 首次打开时聚合请求，缓存60秒
- 使用 `@AppStorage` 本地缓存，提升打开速度
- 点击「查看详情」跳转到我的Tab

**技术实现**：

新增文件:
- `Views/Map/QuickStatsPopover.swift`

视图结构:
```swift
QuickStatsPopover (宽 200pt, .ultraThinMaterial 背景, AppRadius.l 圆角)
├── VStack(spacing: AppSpacing.m)
│   ├── Header: "今日数据" + 关闭按钮
│   ├── 数据行1: Image("square.grid.3x3.fill") + Text(todayPixels)
│   ├── 数据行2: Image("flame.fill") + Text(streakDays) + "天"
│   ├── 数据行3: Image("trophy.fill") + Text("#" + rank)
│   ├── 数据行4: Image("star.circle.fill") + Text(points)
│   ├── 数据行5: Image("drop.fill") + Text(pixelPoints) + "/" + Text(maxPoints)
│   └── Footer: Button("查看详情")
```

修改文件:
- `Views/Map/MapToolbarView.swift` — 新增统计按钮图标 `chart.bar.fill`

**验收标准**:
- [ ] 点击 Toolbar 统计按钮弹出/收起浮窗
- [ ] 数据正确展示，60 秒缓存
- [ ] 浮窗外点击自动关闭
- [ ] GPS 绘画模式下隐藏此按钮

---

#### 3.2 图层控制中心（P1）

**产品目标**：让用户自定义地图显示内容

**可控图层列表**：

| 图层名称 | 默认状态 | 说明 |
|---------|---------|------|
| 像素层 | ✓（锁定） | 始终开启，不可关闭 |
| 领地控制 | ✓ | 联盟领地六边形色块 |
| 附近玩家 | ✓ | 实时活跃玩家位置 |
| 任务标记 | ✓ | 每日任务pin |
| 区域热力图 | ✗ | 像素密度热力图 |
| 战争区域 | ✓ | 联盟战争标记 |
| 宝箱资源点 | ✓ | 可拾取宝箱 |
| 好友位置 | ✓ | 已关注好友位置 |

**交互设计**：
```
图层控制面板：
┌──────────────────────┐
│ 地图图层             │
│ ━━━━━━━━━━━━━━━━━ │
│ [✓] 像素层 (🔒锁定)  │
│ [✓] 领地控制         │
│ [✓] 附近玩家         │
│ [✓] 任务标记         │
│ [ ] 区域热力图       │  ← 开关动画
│ [✓] 战争区域         │
│ [✓] 宝箱资源点       │
│ [✓] 好友位置         │
│                      │
│ [重置默认] [确定]    │
└──────────────────────┘
```

**数据持久化**：
- 用户选择保存到 `UserDefaults`
- Key: `map_layer_visibility`
- Value: `{ "territories": true, "players": true, ... }`

**技术实现**：

新增文件:
- `Views/Map/LayerControlSheet.swift`
- `ViewModels/MapLayerViewModel.swift`

修改文件:
- `Views/MapLibreMapView.swift` — 根据配置动态显示/隐藏图层

**验收标准**:
- [ ] 点击图层按钮弹出控制面板
- [ ] 切换图层立即生效
- [ ] 配置持久化保存
- [ ] 重置按钮恢复默认配置

---

### 模块4：地图内快捷社交

#### 4.1 附近玩家雷达（P1 - 社交存在感）

**产品目标**：让用户感知到"这个世界有其他人在玩"

**UI设计**：
```
地图上玩家标记：
  💚  ← 脉冲光点（联盟颜色）
  ↓
点击后弹出卡片：
┌────────────────────┐
│ 🎭 玩家昵称         │
│ 🏴 XX联盟 - 中士   │
│ 📍 距离你 800m     │
│ ⏱️ 2分钟前活跃     │
│                    │
│ [关注] [查看主页]  │
└────────────────────┘
```

**隐私保护机制**：
- 位置模糊化到~500m精度（小数点后2位）
- 用户可在设置中关闭「显示我的位置」
- 仅显示最近5分钟内活跃的玩家

**技术实现**：

后端 Redis 数据结构:
```
Key: active_drawers (Sorted Set)
Score: timestamp
Member: JSON { userId, lat, lng, allianceColor, displayName, avatarUrl }

Key: active_drawers:geo (Geo Set, Redis GEOADD)
Member: userId
Longitude/Latitude: 模糊化后的坐标
TTL: 5分钟
```

写入时机:
- `pixelDrawController.js` 中 `drawPixel`/`drawGPSPixel` 成功后
- `GEOADD` + `ZADD` 写入用户位置

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

Socket.IO 扩展:
```
Server → Client: 'nearby_player_update'
Payload: { players: [...], totalActive: number }
触发频率: 最多每 30 秒推送一次（节流）
```

新增文件:
- `backend/src/routes/mapSocialRoutes.js`
- `backend/src/controllers/mapSocialController.js`
- `backend/src/services/activePlayerService.js`

**iOS实现**：

新增文件:
- `Services/API/MapSocialService.swift`
- `Views/Map/NearbyPlayerAnnotation.swift` — 脉冲光点标注视图
- `Views/Map/NearbyPlayerCard.swift` — 玩家简要卡片

修改文件:
- `Views/MapLibreMapView.swift` — 添加 `MLNShapeSource("nearby-players")`
- `Views/ContentView.swift` — 接收 Socket 事件并更新标注
- `Services/Network/SocketIOManager.swift` — 监听 `nearby_player_update`

交互流:
1. 地图可见区域变化时（`mapViewRegionDidChange` 回调），若 zoom ≥ 12，按中心坐标调用 API
2. 同时通过 Socket.IO 接收实时更新
3. 点击光点 → 弹出 `NearbyPlayerCard`
4. zoom < 12 时自动隐藏光点图层

**验收标准**:
- [ ] zoom ≥ 12 时可见附近正在绘画的玩家（5km 范围）
- [ ] 玩家位置模糊化，不暴露精确坐标
- [ ] 点击光点可查看简要信息并关注
- [ ] 用户停止绘画 5 分钟后自动从地图消失
- [ ] 隐私设置中可关闭「显示我的位置」

---

#### 4.2 地图内快捷聊天（P2）

**产品目标**：增强即时社交互动

**入口设计**：
- 左下角气泡按钮💬
- 点击展开半屏聊天面板

**功能设计**：
```
┌─────────────────────┐
│ 💬 附近聊天         │  ← 半透明背景
│ ━━━━━━━━━━━━━━━ │
│ Tab: [附近] [联盟]  │
│                     │
│ 玩家A: 这里好多人！  │
│ 玩家B: 一起画吗？    │
│ 你: [预设快捷语 ▼]  │
│                     │
│ [📍位置] [😀表情]   │
└─────────────────────┘
```

**预设快捷语**：
- 👋 你好！
- 🤝 一起画吧
- 🏴 加入我们联盟
- 🎯 这里有任务
- 📍 分享我的位置

**附近聊天范围**：
- 5km范围内的公开消息
- 基于GeoHash索引
- 消息保留30分钟

**技术实现**：

新增 API:
```
GET /api/chat/nearby?lat={}&lng={}&radius=5000&page=1
POST /api/chat/nearby
  Body: { message, lat, lng, quickPhraseId? }

GET /api/chat/alliance/:allianceId
POST /api/chat/alliance/:allianceId
  Body: { message }
```

Socket.IO 事件:
- `nearby_message`: 附近聊天新消息
- `alliance_message`: 联盟聊天新消息

新增文件:
- `Views/Map/MapChatPanel.swift`
- `ViewModels/MapChatViewModel.swift`

**验收标准**:
- [ ] 附近聊天显示5km内消息
- [ ] 联盟聊天只有成员可见
- [ ] 支持快捷语和表情
- [ ] 可分享当前位置
- [ ] 实时Socket推送新消息

---

### 模块5：地图探索激励系统

#### 5.1 宝箱/资源点系统（P2）

**产品目标**：激励用户出门探索真实世界

**宝箱类型**：

| 类型 | 刷新频率 | 触发范围 | 奖励内容 | 图标 | 稀有度 |
|-----|---------|---------|---------|-----|--------|
| 普通宝箱 | 每小时100个/城市 | 50m | 20-50积分 | 📦 | 普通 |
| 稀有宝箱 | 每6小时10个/城市 | 30m | 100积分+道具 | 🎁 | 稀有 |
| 史诗宝箱 | 每天1个/城市 | 20m | 500积分+稀有颜色 | 💎 | 史诗 |
| 限时宝箱 | 活动期间 | 50m | 活动专属奖励 | ⏰ | 限定 |

**拾取机制**：
- **触发范围**：靠近指定距离内，宝箱图标变大+弹跳动画
- **拾取动作**：点击宝箱 → 开箱动画 → 奖励展示
- **冷却时间**：同一用户每个宝箱30分钟CD
- **竞争机制**：多人可拾取同一宝箱，先到先得（但有总拾取次数限制）

**地图显示距离分级**：
```
远距离（>200m）：半透明小图标
中距离（50-200m）：正常大小，发光效果
近距离（<50m）：放大+弹跳动画+箭头指引
```

**智能刷新算法**：
- 基于热力图避开人少的区域
- 优先刷新在POI（商圈、公园、地标）附近
- 避开水域、高速公路
- 用户密度高的区域宝箱数量更多

**技术实现**：

数据库表:
```sql
CREATE TABLE treasure_chests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chest_type VARCHAR(30) NOT NULL, -- 'normal', 'rare', 'epic', 'event'
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  trigger_radius INT DEFAULT 50,
  reward_points INT NOT NULL,
  reward_items JSONB,
  max_claims INT DEFAULT 1,
  current_claims INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_treasure_location ON treasure_chests USING GIST (location);

CREATE TABLE treasure_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chest_id UUID NOT NULL REFERENCES treasure_chests(id),
  user_id UUID NOT NULL REFERENCES users(id),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chest_id, user_id)
);
```

新增 API:
```
GET /api/map/treasures?lat={}&lng={}&radius=2000
Authorization: Bearer <token>
Response: { chests: [{ id, type, lat, lng, radius, reward }] }

POST /api/map/treasures/:id/claim
Authorization: Bearer <token>
Response: { success, reward: { points, items } }
```

定时任务:
- Bull job 每小时刷新宝箱
- `treasureSpawnService.js` 负责生成逻辑

**iOS实现**：

新增文件:
- `Services/API/TreasureService.swift`
- `Views/Map/TreasureAnnotation.swift`
- `Views/Map/TreasureOpenAnimation.swift`

地图显示:
- 使用 `MLNSymbolStyleLayer` 渲染不同类型宝箱图标
- 距离近时放大动画（`CABasicAnimation`）
- 拾取后播放开箱动画

**验收标准**:
- [ ] 定时刷新宝箱分布合理
- [ ] 靠近宝箱有视觉提示
- [ ] 拾取流程完整（动画+音效+奖励）
- [ ] CD机制正常工作
- [ ] 宝箱过期自动消失

---

#### 5.2 路线挑战（P3）

**产品目标**：鼓励用户探索特定路线

**挑战类型**：

| 类型 | 描述 | 奖励 | 示例 |
|-----|------|------|------|
| 历史街道 | 完整绘画历史文化街道 | 200积分+历史徽章 | 南锣鼓巷完整路线 |
| 公园环线 | 沿公园环线绘画 | 150积分+自然徽章 | 奥林匹克森林公园环线 |
| 地标打卡 | 连接多个地标的路线 | 300积分+探索者称号 | 故宫→天坛→天安门 |
| 系统推荐 | AI推荐的探索路线 | 100积分 | 基于用户历史生成 |

**UI设计**：
```
地图上显示虚线引导路线：
起点A → · · · → 中继点B → · · · → 终点C

进度追踪面板：
┌────────────────────────────┐
│ 🗺️ 南锣鼓巷历史路线         │
│ ━━━━━━━━━━━━━━━━━━━━ 60%│
│ 已完成 1.2km / 总计 2.0km  │
│                            │
│ 当前奖励：                  │
│ • 150积分                   │
│ • 探索者勋章                │
│                            │
│ 完美完成奖励（不偏离）：     │
│ • +50积分                   │
│ • 历史街道大师称号          │
└────────────────────────────┘
```

**奖励阶梯**：
- 完成50%：基础奖励（50%积分）
- 完成80%：加成奖励（80%积分+徽章）
- 完成100%不偏离：完美奖励（100%积分+特殊称号）

**偏离判定**：
- 允许偏离路线±30米
- 偏离超过30米持续1分钟 → 挑战中断
- 可重新开始但完美奖励失效

**技术实现**：

数据库表:
```sql
CREATE TABLE route_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  route_type VARCHAR(30), -- 'historic', 'park', 'landmark', 'custom'
  route_geojson JSONB NOT NULL, -- LineString GeoJSON
  total_distance_meters INT NOT NULL,
  reward_points INT DEFAULT 100,
  reward_items JSONB,
  perfect_reward_points INT DEFAULT 50,
  perfect_reward_title VARCHAR(100),
  difficulty VARCHAR(20), -- 'easy', 'medium', 'hard'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE route_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES route_challenges(id),
  user_id UUID NOT NULL REFERENCES users(id),
  completed_distance_meters INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  is_perfect BOOLEAN DEFAULT false,
  completion_percentage DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(challenge_id, user_id, started_at)
);
```

新增 API:
```
GET /api/routes/challenges
GET /api/routes/challenges/:id
POST /api/routes/challenges/:id/start
PUT /api/routes/challenges/:id/progress
  Body: { currentLat, currentLng, pixelCount }
POST /api/routes/challenges/:id/complete
```

**iOS实现**：

新增文件:
- `Services/API/RouteService.swift`
- `ViewModels/RouteViewModel.swift`
- `Views/Route/RouteMapOverlay.swift` — 路线虚线渲染
- `Views/Route/RouteProgressPanel.swift` — 进度面板

GPS追踪:
- 使用 `CoreLocation` 实时追踪用户位置
- 每10秒检测一次偏离情况
- 使用 `Turf.swift` 计算点到线的距离

**验收标准**:
- [ ] 路线虚线正确显示在地图上
- [ ] GPS追踪准确计算完成进度
- [ ] 偏离判定正常工作
- [ ] 完成后正确发放奖励
- [ ] 支持中途暂停和恢复

---

## 三、产品优化建议

### 建议1：新手引导优化

**问题**：功能过多，新用户容易迷失

**解决方案 - 分步引导**：

```
首次使用流程：
1️⃣ 欢迎页 → 介绍核心玩法（像素绘画）
2️⃣ 地图教学 → 高亮GPS绘画按钮，引导完成首次绘画
3️⃣ 任务引导 → 完成首次绘画后，弹出每日任务介绍
4️⃣ 宝箱教学 → 检测到附近有宝箱时，引导拾取
5️⃣ 漂流瓶引导 → 首次遭遇漂流瓶时，完整演示打开流程
6️⃣ 联盟引导 → 达到一定像素后，引导加入联盟
```

**实现**：
- 使用 `UserDefaults` 记录引导进度
- 每个功能首次使用时触发对应引导
- 可在设置中重新查看引导

---

### 建议2：性能优化策略

**关键优化点**：

#### 2.1 懒加载机制
```
仅加载可视区域±1屏的数据
- 地图移动时动态加载/卸载
- 使用 tile-based 加载策略
- MapLibre 的 bounds 自动管理
```

#### 2.2 分级缓存
```
L1: 内存缓存 (60秒)
  ├── 区域信息
  ├── 附近玩家
  └── 任务标记

L2: 本地存储 (5分钟)
  ├── 宝箱位置
  ├── 路线数据
  └── 领地信息

L3: API请求
  └── 实时数据
```

#### 2.3 请求合并
```
同一区域的多个请求合并为批量请求：
GET /api/map/batch-data?lat={}&lng={}&includes=region,players,tasks,treasures
```

#### 2.4 Socket节流
```
实时更新限制：
- 附近玩家：最多30秒推送一次
- 区域信息：最多60秒推送一次
- 任务进度：即时推送（重要）
```

---

### 建议3：昼夜/天气主题系统

**增强沉浸感设计**：

#### 3.1 昼夜自动切换
```
时间段划分：
06:00-08:00  黎明（浅蓝色调）
08:00-18:00  白天（标准色调）
18:00-20:00  黄昏（橙红色调）
20:00-06:00  夜晚（深蓝色调）
```

**地图样式切换**：
- MapLibre 使用不同的 style JSON
- 平滑过渡动画（30秒渐变）
- 用户可手动锁定某个主题

#### 3.2 天气效果叠加
```
实时天气获取（基于GPS）：
☀️ 晴天 → 阳光光晕效果
☁️ 多云 → 正常显示
🌧️ 雨天 → 雨滴粒子动画
❄️ 雪天 → 雪花飘落效果
🌫️ 雾天 → 地图半透明蒙层
```

**技术实现**：
- 使用天气API（如OpenWeather）
- SwiftUI粒子系统 / SpriteKit
- 性能优化：低端设备降级显示

#### 3.3 节日主题
```
春节（1.1-1.15农历）：
- 红色基调
- 灯笼、烟花装饰
- 特殊音效

圣诞节（12.20-12.26）：
- 绿色+红色基调
- 雪花常驻
- 圣诞树图标

万圣节（10.25-10.31）：
- 暗黑基调
- 南瓜灯装饰
- 神秘音效
```

---

### 建议4：无障碍访问优化

**关键改进点**：

1. **VoiceOver 支持**
   - 所有地图标注添加语音描述
   - 任务进度语音播报
   - 宝箱发现声音提示

2. **色盲友好**
   - 联盟颜色支持图案区分
   - 重要信息不依赖单一颜色
   - 提供色盲模式

3. **字体大小**
   - 支持系统动态字体
   - 最小字号不低于12pt
   - 关键信息支持放大

4. **手势简化**
   - 单指操作优先
   - 避免复杂手势
   - 提供按钮替代方案

---

## 四、实施优先级建议

### P0阶段（核心体验，1-2个月）

| 功能 | 原因 | 预估工期 | 前置依赖 |
|-----|------|---------|---------|
| ✅ **漂流瓶系统** | 已完成 | - | - |
| **区域信息状态条** | 提升信息密度，低成本高收益 | 3天 | 反向地理编码服务 |
| **每日任务系统** | 日活核心驱动 | 2周 | 任务模板系统 |
| **快速统计浮窗** | 无需切Tab查看数据 | 2天 | - |
| **附近玩家雷达** | 社交存在感基础 | 1周 | Redis Geo索引 |

**总工期**: ~4周
**核心KPI**:
- 日活提升20%
- 次日留存提升15%
- 单次使用时长提升5分钟

---

### P1阶段（社交深化，2-3个月）

| 功能 | 原因 | 预估工期 | 前置依赖 |
|-----|------|---------|---------|
| **领地控制可视化** | 竞争可视化，激发争夺 | 2周 | H3索引系统 |
| **活动通知横幅** | 运营活动触达 | 3天 | Socket.IO推送 |
| **图层控制中心** | 用户自定义体验 | 1周 | - |
| **地图内快捷聊天** | 即时社交互动 | 1.5周 | 聊天系统 |
| **任务进度优化** | 实时反馈增强 | 3天 | P0任务系统 |

**总工期**: ~5周
**核心KPI**:
- 社交互动率提升30%
- 联盟参与率提升25%
- 评论/点赞数提升40%

---

### P2阶段（探索激励，3-4个月）

| 功能 | 原因 | 预估工期 | 前置依赖 |
|-----|------|---------|---------|
| **宝箱/资源点** | 探索激励，拉动外出 | 2周 | POI数据库 |
| **领地警报系统** | 联盟防守行为 | 1周 | P1领地系统 |
| **路线挑战** | 深度探索内容 | 2周 | 路线数据库 |
| **昼夜/天气主题** | 沉浸感提升 | 1周 | 天气API |
| **新手引导优化** | 降低学习曲线 | 1周 | - |

**总工期**: ~7周
**核心KPI**:
- 外出探索频次提升35%
- 路线完成率≥60%
- 新用户7日留存提升20%

---

### P3阶段（生态完善，4-6个月）

| 功能 | 原因 | 预估工期 |
|-----|------|---------|
| **实时绘画轨迹流** | 地图活力感 | 1周 |
| **好友实时位置** | 深度社交 | 1周 |
| **区域热力图** | 数据可视化 | 1周 |
| **无障碍优化** | 包容性设计 | 2周 |
| **性能极致优化** | 体验提升 | 2周 |

**总工期**: ~7周
**核心KPI**:
- FPS稳定60
- 崩溃率<0.1%
- 内存占用<150MB

---

## 附录：相关文档

### 已完成功能文档
- [漂流瓶完整实现](./drift-bottle/DRIFT_BOTTLE_IMPLEMENTATION_COMPLETE.md)
- [漂流瓶快速开始指南](./drift-bottle/DRIFT_BOTTLE_QUICK_START.md)
- [漂流瓶地图标记实现](../../docs/drift-bottle-map-markers-implementation-complete.md)

### 规划文档
- [底部菜单栏完善方案 v1](../../tab-bar-enhancement-plan.md)
- [底部菜单栏完善方案 v2（生产级）](../../tab-bar-enhancement-plan-v2.md)
- [活动系统 v2.0](../../README.md#-v20-活动系统-最新上线)

### 技术架构文档
- [项目结构说明](../../docs/architecture/PROJECT_STRUCTURE.md)
- [API文档](../../docs/backend/architecture/API_DOCUMENTATION_v2.md)
- [性能优化报告](../../FINAL_PERFORMANCE_REPORT.md)

---

## 总结

这套地图屏幕增强方案的核心设计思路：

### 🎯 五大设计原则

1. **信息分层** - 顶部状态条→地图主画布→工具栏→底部动态区，各司其职
2. **社交可见性** - 通过附近玩家、聊天、联盟系统让用户感受到"真实的社交"
3. **目标驱动** - 每日任务+宝箱+路线挑战构建完整的日活循环
4. **竞争可视化** - 领地系统+警报机制激发用户参与感
5. **体验优先** - 分级显示+性能优化+新手引导确保流畅体验

### 📊 预期效果

完整实施后预期达成：

| 指标 | 当前 | P0完成 | P2完成 | 提升幅度 |
|-----|------|--------|--------|---------|
| 日活/月活比 | ~10% | ~25% | ~40% | +300% |
| 次日留存率 | ~20% | ~40% | ~55% | +175% |
| 单次使用时长 | ~3min | ~8min | ~15min | +400% |
| 社交互动率 | ~2% | ~15% | ~30% | +1400% |

### 🚀 下一步行动

建议按照 **P0 → P1 → P2** 的优先级逐步实施：
- P0阶段聚焦核心体验，快速上线验证
- 每个阶段结束后进行数据复盘
- 根据用户反馈迭代优化
- 灵活调整功能优先级

---

**文档维护者**: Product Team
**最后更新**: 2026-02-28
**状态**: 待评审
