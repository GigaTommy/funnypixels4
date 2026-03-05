# 世界状态流设计方案

> **核心定位：World State Feed = 世界日志（World Log）**
>
> 系统自动生成，展示世界正在发生的变化

---

## 🎯 核心定位

### 不是什么

❌ **内容社区**：用户主动发布文字/图片/视频
❌ **社交广场**：朋友圈式的UGC平台
❌ **创作平台**：用户生产内容

### 是什么

✅ **世界日志（World Log）**：系统记录世界变化
✅ **状态可视化**：把地图演变展示给用户
✅ **参与激励器**：让用户看到变化，想要参与

### 三个核心目标

```
1. 让用户感知"世界在变化"
   → 地图颜色变化、区域被占领、热点诞生

2. 让用户感知"自己有影响力"
   → 我的绘制改变了区域、我的作品被赞

3. 让用户感知"他人也在参与"
   → Tommy完成500像素、纽约区域蓝色占比上升
```

---

## 📋 动态来源（5类严格限制）

### 原则
- ✅ 系统自动生成（不依赖用户主动发布）
- ✅ 结构化信息（统一模板）
- ✅ 可行动（每条都引导用户去做某事）

### 类型定义

#### 1️⃣ 绘制突破类（个人成就型）

**触发条件**：
```javascript
触发时机：
- 用户完成100像素（里程碑）
- 用户完成500像素
- 用户完成1000像素
- 用户连续7天绘制（连续成就）
- 用户进入本周前10名（排名突破）

生成逻辑：
if (user.total_pixels % 100 === 0 && user.total_pixels > 0) {
  generateEvent({
    type: 'MILESTONE_PIXELS',
    user: user,
    milestone: user.total_pixels,
    region: user.current_region
  });
}
```

**卡片示例**：
```
┌─────────────────────────────────┐
│ [头像] Tommy                     │
│ ────────────────────────────    │
│ 🏆 完成 500 像素里程碑           │
│ ────────────────────────────    │
│ 在纽约区域持续绘制 3 天          │
│ ────────────────────────────    │
│ 📍纽约 | ⏰ 5分钟前              │
│ [查看地图] [去挑战]              │
└─────────────────────────────────┘
```

**用途**：强化个人成就感

---

#### 2️⃣ 作品完成类（创作结果型）

**触发条件**：
```javascript
触发时机：
- 用户完成作品（session结束）
- 作品达到50赞（社交认可）
- 作品成为区域标志性作品（算法评分>80）
- 某区域被完整填充（协作成果）

生成逻辑：
if (session.pixel_count > 100 && session.end_city) {
  generateEvent({
    type: 'ARTWORK_COMPLETED',
    user: user,
    session: session,
    region: session.end_city,
    pixel_count: session.pixel_count
  });
}

// 高质量作品额外生成
if (artwork.likes > 50) {
  generateEvent({
    type: 'ARTWORK_TRENDING',
    artwork: artwork,
    likes: artwork.likes
  });
}
```

**卡片示例**：
```
┌─────────────────────────────────┐
│ [头像] Alice                     │
│ ────────────────────────────    │
│ 🎨 完成作品：上海外滩             │
│ ────────────────────────────    │
│ [作品缩略图]                      │
│ ────────────────────────────    │
│ 🎨 1,234像素 | ⏱ 12:35          │
│ ❤️ 52赞 | 📍上海                │
│ [查看详情] [前往该区域]           │
└─────────────────────────────────┘
```

**用途**：强化成果展示

---

#### 3️⃣ 地图变化类（世界演变型）⭐ **最重要**

**触发条件**：
```javascript
触发时机：
- 某区域颜色占比发生重大变化（>10%波动）
- 某区域被"攻占"（单一联盟占比>60%）
- 热点区域诞生（24小时内绘制密度Top10）
- 城市排名变化（前10名城市排名变动）
- 新区域被开拓（首次有人绘制的区域）

生成逻辑：
// 每小时计算一次区域变化
cron.schedule('0 * * * *', async () => {
  const regions = await getActiveRegions();

  for (const region of regions) {
    const colorChange = calculateColorChange(region, '1h');

    if (colorChange.maxChange > 10) {  // 颜色占比变化>10%
      generateEvent({
        type: 'REGION_COLOR_SHIFT',
        region: region.name,
        dominant_color: colorChange.newDominant,
        change_percent: colorChange.maxChange,
        top_alliance: colorChange.topAlliance
      });
    }

    // 检查是否被攻占
    const dominance = calculateDominance(region);
    if (dominance.percent > 60 && !region.is_conquered) {
      generateEvent({
        type: 'REGION_CONQUERED',
        region: region.name,
        alliance: dominance.alliance,
        percent: dominance.percent
      });

      region.is_conquered = true;
      region.save();
    }
  }
});
```

**卡片示例1：颜色变化**
```
┌─────────────────────────────────┐
│ 🌍 世界变化                      │
│ ────────────────────────────    │
│ 📍 东京区域发生重大变化           │
│ ────────────────────────────    │
│ [地图缩略图：蓝色扩张]            │
│ ────────────────────────────    │
│ 🔵 蓝色阵营占比上升至 48% (+12%) │
│ 🏆 像素联盟正在进攻               │
│ ────────────────────────────    │
│ ⏰ 1小时前                       │
│ [前往东京] [加入防守]             │
└─────────────────────────────────┘
```

**卡片示例2：区域攻占**
```
┌─────────────────────────────────┐
│ ⚔️ 区域攻占                      │
│ ────────────────────────────    │
│ 🏴 纽约被像素联盟占领！           │
│ ────────────────────────────    │
│ [地图缩略图：纽约变蓝]            │
│ ────────────────────────────    │
│ 🔵 像素联盟占比: 67%             │
│ 📊 控制度: 完全占领               │
│ ────────────────────────────    │
│ ⏰ 30分钟前                      │
│ [前往围观] [加入反击]             │
└─────────────────────────────────┘
```

**卡片示例3：热点诞生**
```
┌─────────────────────────────────┐
│ 🔥 热点区域                      │
│ ────────────────────────────    │
│ 上海成为今日最活跃区域            │
│ ────────────────────────────    │
│ [热力图：上海区域高亮]            │
│ ────────────────────────────    │
│ 📊 24小时内：                    │
│ • 234人参与绘制                  │
│ • 12,340像素产生                │
│ • 3个联盟争夺                    │
│ ────────────────────────────    │
│ ⏰ 刚刚更新                      │
│ [前往上海] [查看实时]             │
└─────────────────────────────────┘
```

**用途**：强化"世界在变化"的感知（最核心）

---

#### 4️⃣ 活动进展类（赛事驱动型）

**触发条件**：
```javascript
触发时机：
- 活动进入最后24小时（紧迫感）
- 榜单前3名发生变化（竞争激烈）
- 活动奖励已发放（结果公布）
- 新活动开启（号召参与）
- 活动里程碑达成（50%/75%/100%）

生成逻辑：
// 活动倒计时检查
if (challenge.end_time - Date.now() < 24 * 60 * 60 * 1000) {
  generateEvent({
    type: 'CHALLENGE_ENDING_SOON',
    challenge: challenge,
    hours_left: Math.floor((challenge.end_time - Date.now()) / 3600000),
    top_3_users: await getTop3(challenge.id)
  });
}

// 排名变化监控
if (ranking.position_change && ranking.position <= 3) {
  generateEvent({
    type: 'LEADERBOARD_CHANGE',
    challenge: challenge,
    new_leader: ranking.user,
    old_leader: ranking.previous_user
  });
}
```

**卡片示例**：
```
┌─────────────────────────────────┐
│ 🏆 活动进展                      │
│ ────────────────────────────    │
│ 本周像素挑战榜首易主！            │
│ ────────────────────────────    │
│ 🥇 第1名：Alice (1,234像素)      │
│    ↑ 从第3名超越                │
│ 🥈 第2名：Bob (1,180像素)        │
│ 🥉 第3名：Charlie (1,156像素)    │
│ ────────────────────────────    │
│ ⏰ 距离结束还有 6 小时            │
│ [查看榜单] [立即参与]             │
└─────────────────────────────────┘
```

**用途**：驱动参与

---

#### 5️⃣ 官方事件类（节奏控制型）

**触发条件**：
```javascript
触发时机：
- 新区域开放（地图扩张）
- 限时加倍奖励（运营刺激）
- 系统维护公告（信息通知）
- 版本更新说明（功能介绍）
- 重大节日活动（节日运营）

生成逻辑：
// 手动触发或定时任务
adminPanel.createOfficialEvent({
  type: 'NEW_REGION_OPEN',
  region: '东京',
  description: '东京区域现已开放绘制',
  reward_multiplier: 2.0,
  duration: '48小时'
});
```

**卡片示例**：
```
┌─────────────────────────────────┐
│ 🎯 官方公告                      │
│ ────────────────────────────    │
│ 新区域开放：东京                 │
│ ────────────────────────────    │
│ [东京地标图片]                   │
│ ────────────────────────────    │
│ 🎁 限时双倍奖励（48小时）        │
│ 🗾 解锁日本区域                  │
│ 🏆 首批绘制者额外奖励             │
│ ────────────────────────────    │
│ ⏰ 现已开放                      │
│ [前往东京] [了解详情]             │
└─────────────────────────────────┘
```

**用途**：运营调节

---

## 🎨 卡片设计规范

### 基本原则

```
❌ 不能长得像朋友圈（自由文本+图片）
✅ 必须是信息卡片（结构化+统一模板）

❌ 不展示用户评论（避免社交广场化）
✅ 展示结构化数据（数字/变化/位置）

❌ 不支持用户点赞评论（初期）
✅ 支持"查看详情""前往行动"（引导参与）
```

### 统一模板

```
┌─────────────────────────────────┐
│ [图标/头像]  标题                │  ← 视觉识别
│ ────────────────────────────    │
│ 主要内容（发生了什么）            │  ← 核心信息
│ ────────────────────────────    │
│ [缩略图]（可选）                  │  ← 视觉吸引
│ ────────────────────────────    │
│ 元数据行（地点/时间/数据）        │  ← 详细信息
│ ────────────────────────────    │
│ ⏰ 时间戳                        │  ← 时效性
│ [主CTA] [次CTA]                  │  ← 行动引导
└─────────────────────────────────┘
```

### 5类卡片的图标系统

| 类型 | 图标 | 主色调 | 识别性 |
|------|------|--------|--------|
| 绘制突破 | 🏆 trophy.fill | 金色 | 个人成就 |
| 作品完成 | 🎨 paintbrush.fill | 蓝色 | 创作结果 |
| 地图变化 | 🌍 globe.fill | 绿色 | 世界演变 |
| 活动进展 | 🏆 flag.checkered | 橙色 | 赛事激励 |
| 官方事件 | 📢 megaphone.fill | 红色 | 官方信息 |

### 缩略图规范

```swift
// 不同类型的缩略图
switch eventType {
case .milestone:
    // 无缩略图，用大图标

case .artwork_completed:
    // 显示作品地图截图
    SessionMapThumbnail(sessionId)

case .region_color_shift:
    // 显示区域热力图（前后对比）
    RegionHeatmapComparison(region, before, after)

case .region_conquered:
    // 显示区域占领地图（联盟颜色）
    RegionConquerMap(region, alliance)

case .challenge_update:
    // 显示活动封面图
    ChallengeCoverImage(challenge)

case .official_announcement:
    // 显示官方配图
    OfficialImage(announcement)
}
```

---

## 🔄 交互流程设计

### 核心原则

```
每条动态必须引导用户"去行动"。

不能只是展示内容，必须有明确的下一步。
```

### 点击动态卡片后的路径

```
用户点击卡片
  ↓
进入可行动页面（3种路径）:

路径1: 跳转地图
  → 定位到具体区域
  → 用户可以立即开始绘制
  → 例：点击"东京区域变化" → 跳转到东京地图视图

路径2: 跳转活动详情
  → 显示活动规则和排行榜
  → 用户可以立即参与
  → 例：点击"挑战榜首易主" → 跳转到活动详情页

路径3: 跳转用户主页/作品详情
  → 显示该用户的所有作品
  → 用户可以关注/查看/挑战
  → 例：点击"Tommy完成500像素" → 跳转到Tommy主页
```

### CTA按钮设计

```
主CTA（蓝色，突出）:
  - 前往地图
  - 立即参与
  - 查看详情
  - 加入活动

次CTA（灰色，辅助）:
  - 查看榜单
  - 了解更多
  - 查看区域
  - 分享
```

### 反模式（禁止）

```
❌ 点击后只显示"详情页"（无法行动）
❌ 点击后进入评论区（变成社交讨论）
❌ 点击后只能点赞（无实质引导）
❌ 没有明确的下一步路径
```

---

## 📊 排序逻辑设计

### 原则

```
冷启动阶段：不要算法推荐

原因：
1. 数据不足（无法训练模型）
2. 容易暴露规模小（推荐不准）
3. 简单规则就足够
```

### 排序规则

```javascript
// 优先级权重
const PRIORITY_WEIGHTS = {
  official: 1.0,        // 官方事件（最高）
  challenge: 0.8,       // 活动进展
  region_change: 0.7,   // 地图变化
  following: 0.6,       // 关注用户
  global: 0.3           // 全局事件
};

// 时间衰减
function timeDecay(hoursAgo) {
  return Math.exp(-hoursAgo / 24);  // 24小时衰减到0.37
}

// 综合排序分数
function calculateScore(event) {
  const priorityScore = PRIORITY_WEIGHTS[event.priority] || 0.3;
  const timeScore = timeDecay(event.hours_ago);
  const impactScore = event.impact_score || 0.5;  // 事件影响力（0-1）

  return (
    priorityScore * 0.5 +
    timeScore * 0.3 +
    impactScore * 0.2
  );
}

// 排序逻辑
events.sort((a, b) => {
  // 1. 官方事件置顶
  if (a.type === 'official' && b.type !== 'official') return -1;
  if (b.type === 'official' && a.type !== 'official') return 1;

  // 2. 活动事件优先
  if (a.type === 'challenge' && b.type !== 'challenge') return -1;
  if (b.type === 'challenge' && a.type !== 'challenge') return 1;

  // 3. 关注用户优先
  if (a.is_following && !b.is_following) return -1;
  if (b.is_following && !a.is_following) return 1;

  // 4. 综合分数排序
  return calculateScore(b) - calculateScore(a);
});
```

### 筛选器（简化为3个）

```
[全部] [关注] [官方]
  ↑      ↑      ↑
全局流  关注流  公告流
```

---

## 🚫 初期不开放用户主动发布

### 原因分析

#### 1️⃣ 冷启动期内容密度不足

```
问题：
- 可能没人发 → 暴露"冷清"
- 可能发低质量内容 → 拉低体验
- 评论区空 → 尴尬
- 阅读量低 → 打击积极性

例如：
用户发布："今天画了一个圆"
  → 0点赞 0评论 0阅读
  → 用户感觉"没人看"
  → 不再发布
```

#### 2️⃣ 核心资产不是文字表达

```
FunnyPixels的核心资产是：
  ✅ 地图变化
  ✅ 区域占领
  ✅ 协作绘制

不是：
  ❌ 文字表达能力
  ❌ 图文创作能力
  ❌ 社交互动能力

如果开放主动发布，会变成：
  → 无内容优势的泛社区
  → 与小红书/朋友圈竞争（必败）
```

#### 3️⃣ 自动生成更安全可控

```
自动生成的优势：
✅ 内容结构统一（信息卡片）
✅ 无审核压力（规则生成）
✅ 无垃圾信息（系统筛选）
✅ 可控节奏（运营调节）
✅ 可批量模拟活跃（冷启动）

例如：
系统生成："东京区域蓝色占比上升12%"
  → 信息清晰
  → 引导用户去东京
  → 不需要审核
  → 不会有低质内容
```

---

## ⏰ 未来开放主动发布的时机

### 三个前置条件

```
1. DAU > 3,000
   → 足够的内容密度
   → 不会暴露"冷清"

2. 日均作品生成 > 200
   → 核心行为稳定
   → 不会偏离主线

3. 有基础审核机制
   → 能处理垃圾内容
   → 能处理违规信息
```

### 开放范围（限制）

```
可以开放：
✅ 作品附带说明（100字以内）
✅ 发布作品动态（自动生成+用户补充）
✅ 简短文本（限制字数，140字）

依然不开放：
❌ 自由图文社区（不与小红书竞争）
❌ 长文发布（不是内容平台）
❌ 视频发布（资源消耗大）
```

---

## 📍 Tab位置和权重

### 推荐结构

```
底部Tab（4个）:
┌──────┬──────┬──────┬──────┐
│ 地图 │ 活动 │ 动态 │ 我的 │
│ Map  │Event │Feed  │Mine  │
└──────┴──────┴──────┴──────┘
   ↑      ↑      ↑      ↑
  核心  参与   增强   个人

权重：
- 地图：60%（核心）
- 活动：25%（参与驱动）
- 动态：10%（增强层）
- 我的：5%（个人管理）
```

### 定位说明

```
动态Tab排第三，是"增强层"，不是"主驱动层"。

它的作用：
✅ 让用户感知世界在变化（信息透明）
✅ 激发用户去参与（引导行动）
✅ 强化社区氛围（他人也在参与）

但不是：
❌ 核心体验（核心是地图）
❌ 主要流量入口（主要是地图+活动）
❌ 内容消费中心（不做内容平台）
```

---

## 🎬 冷启动强化策略

### 上线前30天运营计划

#### 官方账号内容生产

```
官方账号每天产生 5-10 条动态：

每日内容配比：
- 2条 地图变化事件（核心）
- 2条 官方公告/活动进展
- 1-2条 精选用户成就
- 1-2条 区域热点
- 1条 运营刺激（限时奖励等）

示例时间线：
09:00 - 官方公告："东京区域现已开放"
12:00 - 地图变化："上海区域蓝色占比上升15%"
15:00 - 用户成就："Tommy完成1000像素"
18:00 - 活动进展："周挑战榜首易主"
21:00 - 地图变化："纽约被红色联盟占领"
```

#### 制造地图变化事件

```
运营手段：
1. 官方账号参与绘制（模拟活跃）
2. 内部测试账号制造对抗（区域颜色变化）
3. 人工触发"区域攻占"事件（运营节奏）
4. 定时开放新区域（制造新鲜感）
5. 限时双倍奖励（刺激参与）

节奏控制：
- 每3天开放1个新区域
- 每周制造2-3次"区域攻占"
- 每天至少2次"颜色变化"事件
- 保持动态流有持续更新
```

#### 让用户感知"世界在运转"

```
目标：
用户打开App后，看到动态Tab有5-10条新内容。

感知：
"哇，刚才1小时又发生了这么多事情"
"世界一直在变化，我得参与进去"

避免：
"动态Tab是空的"
"没人玩这个App"
```

---

## ✅ 终极判断标准

### 一个好的世界状态流，必须做到：

```
1. ✅ 不依赖用户主动生产
   → 系统自动生成足够的内容

2. ✅ 不暴露用户规模
   → 即使只有100用户，也看起来"热闹"

3. ✅ 不需要复杂算法
   → 简单规则排序就足够

4. ✅ 每条动态都可以"去行动"
   → 不是被动消费，是主动参与

5. ✅ 强化"世界感"
   → 用户感觉自己在参与一个活的世界
```

### 反向验证

```
如果做成这样，就是失败的：
❌ 用户主动发帖，但没人互动
❌ 动态流很长，但用户只是刷
❌ 点赞评论很多，但没人去画画
❌ 内容质量参差不齐，需要大量审核
```

---

## 🛠️ 技术实现架构

### 事件生成服务

```javascript
// backend/src/services/worldEventService.js

class WorldEventService {
  // 监听用户行为，自动生成事件
  async onSessionComplete(session) {
    const events = [];

    // 1. 检查里程碑
    const milestone = this.checkMilestone(session.user_id);
    if (milestone) {
      events.push(await this.generateMilestoneEvent(milestone));
    }

    // 2. 检查作品质量
    if (session.pixel_count > 100) {
      events.push(await this.generateArtworkEvent(session));
    }

    // 3. 检查区域影响
    const regionImpact = await this.calculateRegionImpact(session);
    if (regionImpact.isSignificant) {
      events.push(await this.generateRegionChangeEvent(regionImpact));
    }

    // 批量插入事件
    await this.saveEvents(events);

    // 通知相关用户
    await this.notifySubscribers(events);
  }

  // 定时任务：检查区域变化
  async checkRegionChanges() {
    const regions = await this.getActiveRegions();

    for (const region of regions) {
      const analysis = await this.analyzeRegion(region);

      // 颜色占比变化
      if (analysis.colorShift > 10) {
        await this.generateEvent({
          type: 'REGION_COLOR_SHIFT',
          region: region,
          data: analysis
        });
      }

      // 区域攻占
      if (analysis.dominance > 60) {
        await this.generateEvent({
          type: 'REGION_CONQUERED',
          region: region,
          alliance: analysis.topAlliance
        });
      }
    }
  }

  // 生成事件
  async generateEvent(eventData) {
    const event = {
      id: uuid(),
      type: eventData.type,
      priority: this.calculatePriority(eventData.type),
      impact_score: this.calculateImpact(eventData),
      data: eventData.data,
      created_at: new Date()
    };

    await knex('world_events').insert(event);
    return event;
  }
}

// 定时任务
cron.schedule('0 * * * *', () => {
  worldEventService.checkRegionChanges();
});
```

### 前端组件结构

```swift
// FunnyPixelsApp/Views/Feed/WorldStateFeedView.swift

struct WorldStateFeedView: View {
    @StateObject private var viewModel = WorldEventViewModel()
    @State private var selectedFilter: FeedFilter = .all

    var body: some View {
        VStack(spacing: 0) {
            // 筛选器
            FeedFilterPicker(selection: $selectedFilter)

            // 事件流
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(viewModel.events) { event in
                        WorldEventCard(event: event)
                            .onTapGesture {
                                handleEventTap(event)
                            }
                    }

                    if viewModel.hasMore {
                        ProgressView()
                            .onAppear {
                                Task { await viewModel.loadMore() }
                            }
                    }
                }
                .padding()
            }
        }
        .task {
            await viewModel.loadEvents(filter: selectedFilter)
        }
    }

    private func handleEventTap(_ event: WorldEvent) {
        switch event.type {
        case .milestone, .artwork:
            // 跳转用户主页
            navigateToProfile(event.userId)

        case .regionChange, .regionConquered:
            // 跳转地图，定位到区域
            navigateToMap(region: event.region)

        case .challenge:
            // 跳转活动详情
            navigateToChallengeDetail(event.challengeId)

        case .official:
            // 显示公告详情
            showAnnouncementDetail(event.announcementId)
        }
    }
}

// 世界事件卡片
struct WorldEventCard: View {
    let event: WorldEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 头部
            HStack {
                eventIcon
                Text(event.title)
                    .font(.headline)
                Spacer()
                Text(event.timeAgo)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            // 内容
            eventContent

            // 缩略图（可选）
            if let thumbnail = event.thumbnail {
                eventThumbnail(thumbnail)
            }

            Divider()

            // CTA按钮
            HStack(spacing: 12) {
                eventPrimaryCTA
                if let secondaryCTA = event.secondaryCTA {
                    eventSecondaryCTA(secondaryCTA)
                }
                Spacer()
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }

    private var eventIcon: some View {
        ZStack {
            Circle()
                .fill(event.iconColor.opacity(0.2))
                .frame(width: 40, height: 40)
            Image(systemName: event.iconName)
                .foregroundColor(event.iconColor)
        }
    }

    private var eventContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.subtitle)
                .font(.subheadline)
                .foregroundColor(.secondary)

            if let stats = event.stats {
                statsRow(stats)
            }
        }
    }
}
```

---

## 📊 核心指标定义

### 主指标

| 指标 | 定义 | 目标 | 说明 |
|------|------|------|------|
| **事件生成率** | 每小时生成的事件数 | ≥5个/小时 | 世界活跃度 |
| **事件点击率** | 点击事件/浏览事件 | ≥50% | 内容吸引力 |
| **CTA转化率** | 点击CTA/点击事件 | ≥40% | 引导效果 |
| **地图跳转率** | 跳转地图/点击事件 | ≥30% | 参与转化 |

### 辅助指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 动态Tab打开率 | ≥60% | Tab可见度 |
| 人均浏览事件数 | 10-15个/天 | 适度浏览 |
| 事件类型分布 | 地图变化≥40% | 核心内容占比 |
| 官方事件占比 | 10-20% | 运营节奏 |

### 反向指标（需要控制）

| 指标 | 上限 | 原因 |
|------|------|------|
| 动态Tab停留时长 | <5分钟/天 | 不希望长时间停留 |
| 人均浏览深度 | <30个/天 | 避免过度消费 |

---

## 🎯 核心总结

### 动态Tab的本质

```
✅ 世界日志（World Log）
   → 记录世界正在发生的变化

✅ 状态可视化（State Visualization）
   → 把抽象的地图变化具象化

✅ 参与激励器（Participation Motivator）
   → 让用户看到变化，想要参与

❌ 不是社交广场
❌ 不是内容社区
❌ 不是UGC平台
```

### 三个核心目标

```
1. 让用户感知"世界在变化"
   → 地图变化类事件（40%+）

2. 让用户感知"自己有影响力"
   → 绘制突破类事件（强化成就）

3. 让用户感知"他人也在参与"
   → 作品完成类事件（社区氛围）
```

### 五个关键原则

```
1. 系统自动生成（不依赖用户发布）
2. 结构化信息卡片（不是朋友圈）
3. 每条都引导行动（不是被动消费）
4. 简单规则排序（不做复杂算法）
5. 冷启动强化（官方制造活跃）
```

---

**文档版本**: v4.0 - World State Feed
**更新日期**: 2026-03-04
**核心定位**: 世界日志（World Log）
**关键特性**: 系统自动生成、结构化卡片、行动引导
