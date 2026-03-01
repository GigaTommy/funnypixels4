# 像素热门统计与可视化功能设计方案

> **状态**: 📋 待实现（后续版本）
> **优先级**: P2 - 增强功能
> **预计版本**: v2.1+
> **设计时间**: 2026-02-25

---

## 📊 功能概述

基于像素历史数据的统计分析与可视化展示系统，为用户提供个性化的像素回忆、社交发现和地图热力展示。通过数据驱动的方式增强用户参与感和社交互动性。

### 🎯 核心价值

1. **增强用户粘性**: 通过数据化展示用户的像素成就，提升成就感
2. **促进社交互动**: 发现"像素知音"，拓展社交网络
3. **激发竞争意识**: 热门像素排行榜，激励用户参与
4. **提升留存率**: 定期推送月度报告，召回沉睡用户

---

## 一、功能模块设计

### 🎨 模块 A：像素回忆（Pixel Memories）

**展示位置**: Feed Tab → 新增"发现"子页面

#### 功能点

##### 1. 热门像素成就卡片
**描述**: 展示用户绘制过的像素点中，有哪些成为了全球热门像素

**数据统计**:
- 用户绘制过的像素点列表
- 每个像素点的总被踩次数（全球）
- 用户在该像素点的贡献次数
- 该像素点在全球的排名（Top 1/10/100）

**UI设计**:
```
┌─────────────────────────────────────────┐
│ 🔥 你的像素成为热门！                    │
├─────────────────────────────────────────┤
│ [像素图标] 像素点 (123,456)              │
│            过去一个月被踩了 500 次        │
│            你贡献了 5 次                 │
│            🏆 Top 3 热门像素             │
│                                    [查看]│
├─────────────────────────────────────────┤
│ [像素图标] 像素点 (789,012)              │
│            过去一个月被踩了 380 次        │
│            你贡献了 3 次                 │
│            🏅 Top 15 热门像素            │
│                                    [查看]│
└─────────────────────────────────────────┘
```

##### 2. 重复绘制统计卡片
**描述**: 展示用户最"执着"绘制的像素点

**数据统计**:
- 用户在同一像素点的重复绘制次数
- 首次绘制时间和最后绘制时间
- 重复绘制排行榜（Top 10）

**UI设计**:
```
┌─────────────────────────────────────────┐
│ 🎯 你的执着                             │
├─────────────────────────────────────────┤
│ [像素图标] 像素点 (111,222)              │
│            重复绘制 50 次                │
│            ████████████ 100%            │
├─────────────────────────────────────────┤
│ [像素图标] 像素点 (333,444)              │
│            重复绘制 35 次                │
│            ████████░░░░  70%            │
└─────────────────────────────────────────┘
```

##### 3. 地理足迹回忆
**描述**: 展示用户绘制像素的地理历程

**数据统计**:
- 第一个像素点（里程碑）
- 访问过的城市/国家数量
- 最常绘制的城市
- 最远的像素点

**UI设计**:
```
┌─────────────────────────────────────────┐
│ 🌍 你的像素足迹                         │
├─────────────────────────────────────────┤
│ 📍 第一个像素                           │
│    北京市朝阳区，2025-01-15              │
│                                    [查看]│
├─────────────────────────────────────────┤
│ 🏙️ 访问过 15 个城市                     │
│    最常绘制: 上海市 (320个像素)          │
│                                    [详情]│
└─────────────────────────────────────────┘
```

##### 4. 时间线回忆
**描述**: 关键里程碑时刻展示

**数据统计**:
- 首次绘制
- 第100/1000/10000个像素
- 连续绘制天数记录
- 首次参加活动

---

### 👥 模块 B：社交发现（Social Discovery）

**展示位置**: Feed Tab → "发现"子页面

#### 功能点

##### 1. 像素知音推荐
**描述**: 发现和用户踩过相同像素点最多的其他用户

**推荐算法**:
```javascript
// 相似度计算公式
similarity = shared_pixels_count / min(user_total_pixels, other_total_pixels)

// 筛选条件
- 共同像素点 >= 10个
- 相似度 >= 0.1
- 排除已关注用户
```

**数据展示**:
- 用户头像、昵称
- 共同像素点数量
- 相似度百分比
- 对方的特色标签（活跃、高产、探险家等）

**UI设计**:
```
┌─────────────────────────────────────────┐
│ 💫 像素知音                             │
├─────────────────────────────────────────┤
│ [头像] @Alice                    [关注] │
│        和你踩过 500 个相同像素点         │
│        相似度 85% | 🌟活跃玩家           │
├─────────────────────────────────────────┤
│ [头像] @Bob                      [关注] │
│        和你踩过 320 个相同像素点         │
│        相似度 72% | 🎨创作大师           │
└─────────────────────────────────────────┘
```

##### 2. 像素社群推荐
**描述**: 推荐常在同一区域绘制的用户群体

**推荐逻辑**:
- 基于地理位置聚类（同一城市/区域）
- 绘制时间重叠度
- 共同参与的活动

##### 3. 创作风格推荐
**描述**: 根据用户的创作风格（颜色偏好、图案类型）推荐相似用户

**风格分析维度**:
- 主要使用颜色（色系分析）
- 图案偏好（Emoji、几何、文字）
- 绘制密度（密集型 vs 稀疏型）
- 协作倾向（联盟活动参与度）

---

### 🗺️ 模块 C：地图热力图层（Hot Pixels Layer）

**展示位置**: Map Tab → 地图覆盖层（可开关）

#### 功能点

##### 1. 热门像素标记
**描述**: 在地图上用特殊标记显示热门像素点

**标记分级**:
```
🥇 Top 1-3:   金色皇冠 + 脉冲光环
🥈 Top 4-10:  橙色火焰 + 中等光环
🥉 Top 11-50: 红色火焰 + 小光环
📍 Top 51+:   粉色标记
```

**交互设计**:
- 点击标记：显示详情弹窗
- 长按标记：快速定位到该像素
- 滑动筛选：按时间范围筛选（24h/7d/30d）

**UI示例**:
```
地图上的标记：
    👑
   ╱ ╲
  ● ◉ ●  ← 脉冲动画
   ╲ ╱
    #1
```

##### 2. 热力分布图
**描述**: 用颜色渐变展示像素热度密度

**渲染策略**:
- 低热度区域：蓝色 → 绿色
- 中热度区域：黄色 → 橙色
- 高热度区域：红色 → 紫色

##### 3. 图层控制器
**描述**: 地图工具栏中的图层开关按钮

**控制选项**:
- [ ] 显示热门像素标记
- [ ] 显示热力密度图
- 时间范围: [24h] [7d] [30d]
- 排名范围: [Top 10] [Top 50] [Top 100]

**UI设计**:
```
┌─────────────┐
│ 🔥 热度图层 │ ← 按钮
└─────────────┘

点击后展开：
┌─────────────────────────┐
│ 热度图层设置             │
├─────────────────────────┤
│ ☑️ 显示热门标记           │
│ ☑️ 显示热力图             │
│                         │
│ 时间范围:               │
│ ⚪ 24小时 🔘 7天 ⚪ 30天 │
│                         │
│ 排名范围:               │
│ 🔘 Top 10 ⚪ Top 50     │
└─────────────────────────┘
```

##### 4. 热门像素详情弹窗
**描述**: 点击热门标记后显示的详细信息

**展示内容**:
```
┌─────────────────────────────────────┐
│ 🏆 热门像素 #3                       │
├─────────────────────────────────────┤
│ 📍 位置: 北京市朝阳区 (123, 456)     │
│ 🔥 热度: 500次绘制                   │
│ 👥 参与: 320位用户                   │
│ 📅 活跃: 过去7天                     │
├─────────────────────────────────────┤
│ 📊 活跃趋势:                         │
│     ████████░░ 80%                  │
│     ██████░░░░ 60%                  │
│     ████░░░░░░ 40%                  │
│     ██░░░░░░░░ 20%                  │
│     1天 3天 5天 7天                  │
├─────────────────────────────────────┤
│ 👤 最近活跃用户:                     │
│ [头像] @Alice  (50次)                │
│ [头像] @Bob    (35次)                │
│ [头像] @Carol  (28次)                │
│                                     │
│            [查看更多]                │
└─────────────────────────────────────┘
```

---

### 📮 模块 D：定时推送报告系统

**功能**: 每月自动生成用户像素报告并推送

#### 推送策略

##### 1. 月度报告生成
**触发时间**: 每月1号凌晨2点

**报告内容**:
- 上月绘制统计（总数、日均、排名）
- 热门像素成就（有哪些成为热门）
- 重复绘制之最
- 新发现的像素知音
- 地理足迹新增（新访问的城市）

##### 2. 推送通知
**通知标题**: "📊 你的<月份>月度像素报告已生成"

**通知内容模板**:
```
🎉 你的像素成为热门！

你绘制的像素点成为本月热门Top 3，
被500人踩过，你贡献了5次。

查看完整报告 →
```

##### 3. 报告展示页面
**页面结构**:
```
┌───────────────────────────────────────┐
│ 📊 2026年2月 像素报告                  │
├───────────────────────────────────────┤
│ 🎨 本月概览                           │
│ • 绘制了 320 个像素                   │
│ • 访问了 5 个新城市                   │
│ • 排名上升 15 位 ↗️                   │
│ • 连续活跃 28 天 🔥                   │
├───────────────────────────────────────┤
│ 🏆 精彩瞬间                           │
│ • 你的像素成为热门 Top 3              │
│ • 发现了 12 位像素知音                │
│ • 重复绘制记录：50次                  │
├───────────────────────────────────────┤
│ 📈 数据对比                           │
│ 本月   上月   增长                    │
│ 320    280   +14% ▲                  │
│                                       │
│        [分享报告] [查看详情]          │
└───────────────────────────────────────┘
```

---

## 二、技术实现方案

### 📦 后端架构

#### 1. 新增API端点

```javascript
// 像素回忆
GET  /api/pixels/memories        // 获取用户像素回忆数据
GET  /api/pixels/memories/hot    // 获取用户的热门像素
GET  /api/pixels/memories/repeat // 获取重复绘制统计

// 社交发现
GET  /api/pixels/buddies         // 获取像素知音列表
GET  /api/pixels/communities     // 获取像素社群推荐

// 热门排行
GET  /api/pixels/hot-ranking     // 获取热门像素排行榜
GET  /api/pixels/hot-ranking/:gridId // 获取单个热门像素详情

// 月度报告
GET  /api/reports/monthly        // 获取月度报告列表
GET  /api/reports/monthly/:id    // 获取单个月度报告
POST /api/reports/generate       // 手动触发生成报告（管理员）
```

#### 2. 数据库设计

##### 新增表结构

```sql
-- 月度报告表
CREATE TABLE pixel_monthly_reports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    report_month DATE NOT NULL,  -- 报告月份（如 2026-02-01）

    -- 统计数据（JSONB格式，灵活扩展）
    overview JSONB,           -- 总览统计
    hot_pixels JSONB,         -- 热门像素列表
    repeat_pixels JSONB,      -- 重复绘制统计
    pixel_buddies JSONB,      -- 像素知音列表
    milestones JSONB,         -- 里程碑事件

    -- 元数据
    generated_at TIMESTAMP DEFAULT NOW(),
    is_viewed BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP,

    UNIQUE(user_id, report_month)
);

-- 索引
CREATE INDEX idx_reports_user_month ON pixel_monthly_reports(user_id, report_month DESC);
CREATE INDEX idx_reports_generated ON pixel_monthly_reports(generated_at DESC);

-- 热门像素缓存表（物化视图）
CREATE MATERIALIZED VIEW mv_hot_pixels_30d AS
SELECT
    grid_id,
    COUNT(*) as total_hits,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_activity,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
FROM pixels_history
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND action_type = 'draw'
GROUP BY grid_id
HAVING COUNT(*) >= 10
ORDER BY total_hits DESC
LIMIT 1000;

-- 索引
CREATE INDEX idx_mv_hot_pixels_rank ON mv_hot_pixels_30d(rank);
CREATE INDEX idx_mv_hot_pixels_grid ON mv_hot_pixels_30d(grid_id);

-- 定时刷新（每小时）
SELECT cron.schedule(
    'refresh-hot-pixels',
    '0 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hot_pixels_30d'
);
```

##### 优化索引

```sql
-- pixels_history 表优化
CREATE INDEX idx_pixels_history_grid_created
ON pixels_history(grid_id, created_at DESC);

CREATE INDEX idx_pixels_history_user_grid_created
ON pixels_history(user_id, grid_id, created_at DESC);

-- 支持相似用户查询的索引
CREATE INDEX idx_pixels_history_grid_user_created
ON pixels_history(grid_id, user_id, created_at);
```

#### 3. 核心服务实现

##### PixelAnalyticsService

```javascript
class PixelAnalyticsService {
    /**
     * 获取用户的热门像素成就
     */
    async getHotPixelsForUser(userId, timeRange = '30d') {
        const dateFilter = this.calculateDateFilter(timeRange);

        // 使用物化视图提升性能
        const query = `
            WITH user_pixels AS (
                SELECT DISTINCT grid_id, COUNT(*) as user_hits
                FROM pixels_history
                WHERE user_id = $1 AND created_at >= $2
                GROUP BY grid_id
            )
            SELECT hp.grid_id, hp.rank, hp.total_hits, hp.unique_users,
                   up.user_hits,
                   p.latitude, p.longitude, p.color, p.emoji
            FROM mv_hot_pixels_30d hp
            INNER JOIN user_pixels up ON hp.grid_id = up.grid_id
            LEFT JOIN pixels p ON hp.grid_id = p.grid_id
            WHERE hp.rank <= 100  -- 只看 Top 100
            ORDER BY hp.rank ASC
            LIMIT 10;
        `;

        return await db.query(query, [userId, dateFilter]);
    }

    /**
     * 获取重复绘制最多的像素
     */
    async getTopRepeatPixels(userId, timeRange = '30d') {
        const dateFilter = this.calculateDateFilter(timeRange);

        const query = `
            SELECT grid_id, COUNT(*) as repeat_count,
                   MIN(created_at) as first_draw,
                   MAX(created_at) as last_draw,
                   p.color, p.emoji, p.latitude, p.longitude
            FROM pixels_history ph
            LEFT JOIN pixels p ON ph.grid_id = p.grid_id
            WHERE ph.user_id = $1
              AND ph.created_at >= $2
              AND ph.action_type = 'draw'
            GROUP BY grid_id, p.color, p.emoji, p.latitude, p.longitude
            HAVING COUNT(*) > 1
            ORDER BY repeat_count DESC
            LIMIT 10;
        `;

        return await db.query(query, [userId, dateFilter]);
    }

    /**
     * 发现像素知音（相似用户）
     */
    async findPixelBuddies(userId, timeRange = '30d', minShared = 10) {
        const dateFilter = this.calculateDateFilter(timeRange);

        const query = `
            WITH user_pixels AS (
                SELECT DISTINCT grid_id
                FROM pixels_history
                WHERE user_id = $1 AND created_at >= $2
            ),
            shared_pixels AS (
                SELECT other.user_id,
                       COUNT(DISTINCT other.grid_id) as shared_count
                FROM pixels_history other
                INNER JOIN user_pixels up ON other.grid_id = up.grid_id
                WHERE other.user_id != $1
                  AND other.created_at >= $2
                GROUP BY other.user_id
                HAVING COUNT(DISTINCT other.grid_id) >= $3
            )
            SELECT sp.user_id, sp.shared_count,
                   u.username, u.avatar_url,
                   ROUND(sp.shared_count::numeric / NULLIF(
                       (SELECT COUNT(DISTINCT grid_id)
                        FROM pixels_history
                        WHERE user_id = $1 AND created_at >= $2), 0
                   ) * 100, 2) as similarity_percent
            FROM shared_pixels sp
            LEFT JOIN users u ON sp.user_id = u.id
            ORDER BY sp.shared_count DESC
            LIMIT 20;
        `;

        return await db.query(query, [userId, dateFilter, minShared]);
    }
}
```

##### MonthlyReportService

```javascript
class MonthlyReportService {
    /**
     * 定时任务：每月1号生成所有用户报告
     */
    async generateAllMonthlyReports() {
        const lastMonth = this.getLastMonth();
        const activeUsers = await this.getActiveUsers(lastMonth);

        Logger.info(`开始生成 ${lastMonth} 月度报告，共 ${activeUsers.length} 位活跃用户`);

        for (const user of activeUsers) {
            try {
                await this.generateUserReport(user.id, lastMonth);
                await this.sendReportNotification(user.id);
            } catch (error) {
                Logger.error(`用户 ${user.id} 报告生成失败:`, error);
            }
        }
    }

    /**
     * 生成单个用户的月度报告
     */
    async generateUserReport(userId, reportMonth) {
        const dateRange = this.getMonthDateRange(reportMonth);

        // 并行获取所有统计数据
        const [overview, hotPixels, repeatPixels, buddies, milestones] =
            await Promise.all([
                this.getMonthOverview(userId, dateRange),
                PixelAnalyticsService.getHotPixelsForUser(userId, '30d'),
                PixelAnalyticsService.getTopRepeatPixels(userId, '30d'),
                PixelAnalyticsService.findPixelBuddies(userId, '30d', 10),
                this.getMilestones(userId, dateRange)
            ]);

        // 保存报告
        const report = await db.query(`
            INSERT INTO pixel_monthly_reports
            (user_id, report_month, overview, hot_pixels, repeat_pixels, pixel_buddies, milestones)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, report_month)
            DO UPDATE SET
                overview = EXCLUDED.overview,
                hot_pixels = EXCLUDED.hot_pixels,
                repeat_pixels = EXCLUDED.repeat_pixels,
                pixel_buddies = EXCLUDED.pixel_buddies,
                milestones = EXCLUDED.milestones,
                generated_at = NOW()
            RETURNING id
        `, [
            userId, reportMonth,
            JSON.stringify(overview),
            JSON.stringify(hotPixels),
            JSON.stringify(repeatPixels),
            JSON.stringify(buddies),
            JSON.stringify(milestones)
        ]);

        return report.rows[0];
    }
}

// 启动定时任务
cron.schedule('0 2 1 * *', async () => {
    await MonthlyReportService.generateAllMonthlyReports();
});
```

---

### 📱 iOS 前端实现

#### 1. 新增视图结构

```swift
// Feed Tab 结构更新
Picker("FeedType", selection: $selectedSubTab) {
    Text("动态").tag(0)        // SocialFeedView
    Text("我的记录").tag(1)     // MyRecordsView
    Text("数据").tag(2)         // DataDashboardView
    Text("发现").tag(3)         // 🆕 PixelMemoriesView
}
```

#### 2. 核心视图组件

##### PixelMemoriesView.swift

```swift
struct PixelMemoriesView: View {
    @StateObject private var viewModel = PixelMemoriesViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // 热门像素成就
                if !viewModel.hotPixels.isEmpty {
                    HotPixelAchievementSection(pixels: viewModel.hotPixels)
                }

                // 重复绘制统计
                if !viewModel.repeatPixels.isEmpty {
                    RepeatPixelSection(pixels: viewModel.repeatPixels)
                }

                // 像素知音
                if !viewModel.buddies.isEmpty {
                    PixelBuddiesSection(buddies: viewModel.buddies)
                }

                // 地理足迹
                if let milestones = viewModel.milestones {
                    GeographicMilestonesSection(milestones: milestones)
                }
            }
            .padding()
        }
        .navigationTitle("发现")
        .task {
            await viewModel.loadMemories()
        }
        .refreshable {
            await viewModel.refresh()
        }
    }
}
```

##### HotPixelMarkerView.swift（地图标记）

```swift
struct HotPixelMarkerView: View {
    let marker: HotPixelMarker
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            // 脉冲光环
            Circle()
                .stroke(rankColor, lineWidth: 2)
                .frame(width: isPulsing ? 40 : 30, height: isPulsing ? 40 : 30)
                .opacity(isPulsing ? 0 : 0.8)

            // 热度光晕
            Circle()
                .fill(
                    RadialGradient(
                        colors: [rankColor.opacity(0.8), rankColor.opacity(0.3)],
                        center: .center,
                        startRadius: 5,
                        endRadius: 15
                    )
                )
                .frame(width: 24, height: 24)

            // 核心图标
            ZStack {
                Circle().fill(Color.white).frame(width: 20, height: 20)

                if marker.rank <= 3 {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 10))
                        .foregroundColor(rankColor)
                } else {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 10))
                        .foregroundColor(rankColor)
                }
            }

            // 排名徽章
            Text("#\(marker.rank)")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(Capsule().fill(rankColor))
                .offset(x: 0, y: -18)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: false)) {
                isPulsing = true
            }
        }
    }

    private var rankColor: Color {
        switch marker.rank {
        case 1: return .yellow
        case 2...3: return .orange
        case 4...10: return .red
        default: return .pink
        }
    }
}
```

---

## 三、性能优化策略

### 🚀 数据库优化

#### 1. 物化视图策略
```sql
-- 定期刷新热门像素缓存（每小时）
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hot_pixels_30d;

-- 支持并发刷新，不阻塞查询
CREATE UNIQUE INDEX idx_mv_hot_pixels_grid_unique ON mv_hot_pixels_30d(grid_id);
```

#### 2. 分区表优化
```sql
-- pixels_history 已按月分区，查询时指定分区
SELECT * FROM pixels_history_2026_02
WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01';
```

#### 3. 查询优化
```sql
-- 使用 EXPLAIN ANALYZE 分析慢查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM mv_hot_pixels_30d WHERE rank <= 100;

-- 添加必要的复合索引
CREATE INDEX idx_pixels_history_composite
ON pixels_history(created_at, grid_id, user_id)
WHERE action_type = 'draw';
```

### 📦 缓存策略

#### 1. Redis 缓存热门数据
```javascript
// 缓存热门像素排行榜（1小时有效）
const cacheKey = `hot_pixels:${timeRange}`;
let hotPixels = await redis.get(cacheKey);

if (!hotPixels) {
    hotPixels = await db.query(/* ... */);
    await redis.setex(cacheKey, 3600, JSON.stringify(hotPixels));
}
```

#### 2. 前端缓存
```swift
// iOS 本地缓存报告数据（24小时）
@AppStorage("cached_monthly_report") private var cachedReport: Data?
@AppStorage("cached_report_timestamp") private var cacheTimestamp: TimeInterval = 0

if Date().timeIntervalSince1970 - cacheTimestamp < 86400 {
    // 使用缓存
    return cachedReport
}
```

---

## 四、实施时间表

### Phase 1: 后端 API 开发（1周）
- **Day 1-2**: 数据库表设计 + 物化视图创建
- **Day 3-4**: PixelAnalyticsService 实现
- **Day 5-6**: MonthlyReportService + 定时任务
- **Day 7**: API 端点开发 + 测试

### Phase 2: iOS 前端开发（1.5周）
- **Day 1-3**: PixelMemoriesView + 子组件
- **Day 4-5**: 地图热力图层 + 标记组件
- **Day 6-7**: 月度报告展示页面
- **Day 8-9**: 推送通知集成
- **Day 10**: UI/UX 优化

### Phase 3: 测试与优化（0.5周）
- **Day 1-2**: 端到端测试
- **Day 3**: 性能优化 + Bug修复
- **Day 4**: 上线准备

**总预计时间**: 3周

---

## 五、风险评估

### ⚠️ 潜在风险

#### 1. 性能风险
**问题**: 大量用户时，相似用户查询可能很慢

**缓解措施**:
- 使用物化视图预计算
- 限制查询范围（最近30天）
- 异步计算，结果缓存
- 设置查询超时（5秒）

#### 2. 数据量风险
**问题**: pixels_history 表快速增长

**缓解措施**:
- 已有月分区策略
- 历史数据归档到冷存储
- 热数据保留3个月

#### 3. 推送风险
**问题**: 大量用户同时推送报告可能导致服务压力

**缓解措施**:
- 分批推送（每批1000用户）
- 使用消息队列（BullMQ）
- 限流控制（每秒100条）

---

## 六、成功指标（KPI）

### 📊 核心指标

| 指标 | 目标值 | 备注 |
|------|--------|------|
| **用户参与度** | +25% | 功能上线后月活跃度提升 |
| **社交互动** | +40% | 关注数、私聊数增长 |
| **留存率** | +15% | 次月留存率提升 |
| **报告打开率** | >60% | 推送通知点击率 |
| **分享率** | >20% | 报告分享到社交平台比例 |

### 🎯 次级指标

| 指标 | 目标值 |
|------|--------|
| API 响应时间 | <200ms (p95) |
| 报告生成耗时 | <3秒/用户 |
| 热力图层加载 | <1秒 |
| 缓存命中率 | >80% |

---

## 七、未来扩展方向

### 🚀 可能的增强功能

1. **AI 推荐系统**
   - 基于机器学习的用户推荐
   - 个性化内容推送

2. **实时热度排行**
   - WebSocket 实时更新
   - 热度变化推送

3. **像素艺术展览馆**
   - 精选作品展示
   - 用户投票评选

4. **成就徽章系统**
   - 热门创造者徽章
   - 社交达人徽章

5. **数据可视化增强**
   - 3D 热力图
   - 时间序列动画

---

## 八、文档更新清单

### 📚 相关文档

- [ ] API 文档更新（新增7个端点）
- [ ] 数据库 Schema 文档
- [ ] iOS 开发文档
- [ ] 部署文档（定时任务配置）
- [ ] 用户手册（新功能使用指南）

---

## 附录

### A. 数据结构定义

```typescript
// 热门像素数据结构
interface HotPixel {
    gridId: string;
    rank: number;
    totalHits: number;
    uniqueUsers: number;
    userHits: number;
    coordinate: {
        latitude: number;
        longitude: number;
    };
    color?: string;
    emoji?: string;
}

// 像素知音数据结构
interface PixelBuddy {
    userId: string;
    username: string;
    avatarUrl?: string;
    sharedPixels: number;
    similarityPercent: number;
    isFollowing: boolean;
}

// 月度报告数据结构
interface MonthlyReport {
    id: string;
    userId: string;
    reportMonth: string; // "2026-02"
    overview: {
        totalPixels: number;
        totalSessions: number;
        totalCities: number;
        currentStreak: number;
        rankChange: number;
    };
    hotPixels: HotPixel[];
    repeatPixels: RepeatPixel[];
    pixelBuddies: PixelBuddy[];
    milestones: Milestone[];
    generatedAt: string;
    isViewed: boolean;
}
```

### B. 示例查询

```sql
-- 查询用户的月度统计
SELECT
    COUNT(*) as total_pixels,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    COUNT(DISTINCT city) as cities_visited
FROM pixels_history
WHERE user_id = 123
  AND created_at >= '2026-02-01'
  AND created_at < '2026-03-01';

-- 查询热门像素中用户的贡献
SELECT hp.*, up.user_contribution
FROM mv_hot_pixels_30d hp
LEFT JOIN (
    SELECT grid_id, COUNT(*) as user_contribution
    FROM pixels_history
    WHERE user_id = 123
    GROUP BY grid_id
) up ON hp.grid_id = up.grid_id
WHERE up.user_contribution > 0
ORDER BY hp.rank ASC;
```

---

**文档版本**: v1.0
**最后更新**: 2026-02-25
**负责人**: Product Team
**审核状态**: ✅ 设计评审通过，待排期实施
