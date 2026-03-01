# Sprint 1 影响分析报告

> 在动手写任何代码之前，逐项分析每个任务的影响范围、风险等级和安全操作步骤。

---

## 任务 0.1: 统一认证管理器（清理 SessionManager）

### 结论: 风险极低，SessionManager 实际上是死代码

### 影响范围

| 项目 | 详情 |
|------|------|
| **SessionManager.shared 外部调用者** | **0 个**。全局搜索确认没有任何 View/ViewModel/Service 调用 `SessionManager.shared` |
| **引用 SessionManager 的文件** | 仅 **2 个**: 自身定义文件 + `APIManager.swift`（仅一行注释 + 使用 `TokenResponse` 类型） |
| **与 AuthManager 重叠功能** | login、logout、isAuthenticated、currentUser、guest mode、token refresh — 全部重叠 |
| **SessionManager 独有功能** | guest drawing 缓存相关方法 — 但**无任何外部调用者** |

### 唯一阻断依赖

`APIManager.swift` 第 741 行使用了定义在 `SessionManager.swift` 中的 `TokenResponse` 结构体来解码 token refresh 响应。**删除 SessionManager.swift 会导致编译错误。**

### 安全操作步骤

```
步骤 1: 将 TokenResponse 结构体从 SessionManager.swift 迁移到 APIManager.swift 内部
        (仅移动类型定义，不改变任何逻辑)
步骤 2: 删除 APIManager.swift 第 931 行的注释引用
步骤 3: 编译验证，确认无错误
步骤 4: 删除 SessionManager.swift 文件
步骤 5: 删除空的 Services/Session/ 目录
步骤 6: 再次编译验证
```

### 风险评估

| 风险项 | 等级 | 说明 |
|--------|------|------|
| 编译失败 | 低 | 仅 TokenResponse 需迁移，结构简单 |
| 运行时影响 | 无 | SessionManager 无外部调用者 |
| Keychain 孤立数据 | 极低 | `session_data` key 会留在用户设备中但无害 |
| 双重 `.sessionExpired` 监听 | 正面 | 清理后只剩 AuthManager 一个监听者，逻辑更清晰 |

### 不做的事

- **不**触碰 AuthManager 的任何逻辑
- **不**修改 KeychainManager（`sessionData` key 定义保留无害）
- **不**改变登录/登出流程

---

## 任务 0.2: 统一数据模型（Alliance + Leaderboard）

### 结论: 风险极低，Models 文件中的独立类型全部是死代码

### 影响范围

**AllianceModels.swift 独立类型的外部使用者: 0 个**

| 死代码类型（可安全删除） | 说明 |
|-------------------------|------|
| `Alliance` (top-level, id: String) | 被 `AllianceService.Alliance` (id: Int) 完全替代 |
| `AllianceMember` (top-level) | 被 `AllianceService.AllianceMember` 替代 |
| `AllianceApplication` (top-level) | 被 `AllianceService.AllianceApplication` 替代 |
| `AllianceRole` / `AlliancePermissions` | 未使用 |
| `AllianceInviteLink` (top-level) | 未使用 |
| `FlagPattern` (top-level) / `FlagPatternType` | 被 `AllianceService.FlagPattern` 替代 |
| 所有 Request/Response 类型 (6 个) | 未使用 |

**必须保留的代码（AllianceModels.swift 中）:**
```swift
// 第 442-449 行: String.isValidHexColor 扩展
extension String {
    var isValidHexColor: Bool { ... }
}

// 第 453-458 行: AllianceService.FlagPattern 扩展 (spriteURL 计算属性)
extension AllianceService.FlagPattern {
    var spriteURL: URL? { ... }
}

// 第 468-479 行: AllianceService.Alliance 扩展 (flagSpriteURL 计算属性)
extension AllianceService.Alliance {
    var flagSpriteURL: URL? { ... }
}
```

这 3 个扩展被以下文件实际使用:
- `FlagPatternCache.swift` — 使用 `spriteURL`
- `AllianceBadge.swift` — 使用 `spriteURL`
- `AllianceTabView.swift` — 使用 `flagSpriteURL`

**LeaderboardModels.swift 独立类型的外部使用者: 0 个**

全部 20+ 类型（`PersonalLeaderboardEntry`, `AllianceLeaderboardEntry`, `RegionLeaderboardEntry`, 各种 Response/Request 类型）均无外部调用。实际使用的是 `LeaderboardService.LeaderboardEntry` 和 `LeaderboardService.CityLeaderboardEntry`。

### 安全操作步骤

```
步骤 1: AllianceModels.swift — 删除所有独立类型定义，仅保留 3 个 extension 块
步骤 2: 编译验证
步骤 3: LeaderboardModels.swift — 删除文件（或清空仅保留文件头注释）
步骤 4: 编译验证
步骤 5: 检查 app/FunnyPixels/Sources/ 下的 SPM 副本是否需要同步清理
```

### 风险评估

| 风险项 | 等级 | 说明 |
|--------|------|------|
| 编译失败 | 极低 | 删除的都是死代码 |
| 扩展丢失 | 中 | 若不小心删了 3 个 extension 块会导致编译错误，需仔细保留 |
| SPM 包 | 低 | SPM 副本也是死代码，需确认不参与编译 |
| 类型名冲突消除 | 正面 | 删除后不再有 `Alliance` 和 `AllianceService.Alliance` 的歧义 |

### 不做的事

- **不**修改 `AllianceService.swift` 内的任何类型定义
- **不**修改 `LeaderboardService.swift` 内的任何类型定义
- **不**重命名任何现有类型（如将 `AllianceService.Alliance` 提升为顶层类型 — 这是可选的后续优化，不在本 Sprint 范围）

---

## 任务 0.3: 统一网络层（URLSession → APIManager）

### 结论: 中等风险，需逐个服务迁移并验证

### 各服务现状对比

| 服务 | 请求方式 | Base URL | Auth | 特殊需求 | 调用者 |
|------|---------|----------|------|----------|--------|
| `DrawingSessionService` | `URLSession.shared` | `AppEnvironment.current.apiBaseURL` | 手动 Bearer | 无 | `SessionHeartbeatManager`, `DrawingMode` |
| `DrawingHistoryService` | `URLSession.shared` | `AppEnvironment.current.apiBaseURL` | 手动 Bearer | 自定义 DateFormatter (.iso8601) | `ArtworkThumbnailLoader`, `DrawingHistoryViewModel`, `SessionDetailViewModel` |
| `SpriteService` | **自有 URLSession 实例** | `AppEnvironment.current.apiBaseURL` | 可选 Bearer | 自定义连接配置(6并发), 处理 304 Not Modified, **下载图片二进制数据** | `HighPerformanceMVTRenderer` |
| `DeviceAttestationService` | `URLSession.shared` | `AppConfig.apiBaseURL` (不同!) | **无 Auth** | 安全相关的无认证端点 | 无外部调用者（自包含） |

### 迁移可行性分析

| 服务 | 可否迁移 | 说明 |
|------|---------|------|
| `DrawingSessionService` | **可以** | 标准 JSON POST/GET，完全可用 `APIManager.post/get` 替代 |
| `DrawingHistoryService` | **可以** | 标准 JSON GET，需确认 APIManager 的 JSONDecoder 配置兼容 iso8601 日期 |
| `SpriteService` | **部分可以** | JSON API 调用可迁移，但**图片下载（二进制 Data）无法使用 APIManager**（所有方法都要求 `T: Codable`）。需保留自有 URLSession 用于图片下载 |
| `DeviceAttestationService` | **不建议** | 故意不带 Auth token 的安全端点，且无外部调用者，迁移无收益 |

### 安全操作步骤

```
步骤 1: DrawingSessionService 迁移
  1a. 将 startSession/endSession/updateHeartbeat/getActiveSession 方法改为使用 APIManager.shared.post/get
  1b. 移除手动 token 注入代码
  1c. 运行 app 验证绘画 Session 功能正常（开始/结束/心跳）

步骤 2: DrawingHistoryService 迁移
  2a. 将 getSessions/getSessionDetail/getSessionPixels/getBatchPixels 改为 APIManager
  2b. 确认日期解码兼容（检查 APIManager 的 JSONDecoder 是否设置了 .iso8601）
  2c. 运行 app 验证历史记录加载正常

步骤 3: SpriteService 部分迁移
  3a. 仅将 loadSpritesFromAPI（获取 sprite 列表的 JSON API）迁移到 APIManager
  3b. 保留图片下载逻辑使用自有 URLSession (downloadSession)
  3c. 运行 app 验证地图 sprite 加载正常

步骤 4: DeviceAttestationService — 不迁移，保持原状
```

### 风险评估

| 风险项 | 等级 | 说明 |
|--------|------|------|
| DrawingSession 功能中断 | 中 | GPS 绘画核心路径，迁移后必须实机测试 |
| 日期解码不兼容 | 中 | DrawingHistoryService 使用 `.iso8601` + `.fractionalSeconds`，需确认 APIManager 的 decoder 配置一致 |
| Sprite 下载失败 | 高 | 不可将图片下载迁移到 APIManager（缺乏 raw Data 返回能力），必须保留自有 URLSession |
| Token refresh 改善 | 正面 | 迁移后自动获得 APIManager 的 401 自动 refresh + 重试能力 |

### 不做的事

- **不**迁移 SpriteService 的图片下载功能
- **不**迁移 DeviceAttestationService
- **不**修改 APIManager 的公共接口（不为此任务新增 raw Data 方法）
- **不**改变任何 API 端点路径或请求参数

---

## 任务 6.1: Tab Bar Badge 系统

### 结论: 后端中等复杂度（需聚合 8 个数据源），前端低风险

### 后端数据源可用性分析

| Badge 模块 | 现有可用方法 | 需要新查询 | 难度 |
|-----------|-------------|-----------|------|
| 未读通知 (Profile Tab) | `NotificationController.getUnreadCount` ✅ | 否，直接复用 | 低 |
| 每日签到 (Profile Tab) | `DailyCheckin.canCheckinToday` ✅ | 否，布尔值映射 | 低 |
| 待审核申请 (Alliance Tab) | 仅返回完整列表，无 count 方法 | **是**，需 `WHERE status='pending'` 计数，且需遍历用户管理的所有联盟 | 中 |
| 未读聊天 (Alliance Tab) | 仅单频道计数，无全局聚合 | **是**，需跨所有会话聚合未读数 | 中 |
| 活跃事件 (Map Tab) | `EventService.getActiveEvents` 返回列表 | 小改，改为 `.count()` | 低 |
| 未领取成就 (Profile Tab) | stats 接口返回 completed/claimed 分开计数 | **是**，需直接 `is_completed=true AND is_claimed=false` 计数 | 低 |
| 未领取挑战 (Profile Tab) | 仅返回今日挑战对象 | **是**，需 `is_completed=true AND is_claimed=false` 计数 | 低 |
| 排名变动 (Leaderboard Tab) | **无任何现有机制** | **是**，需要新增 `previous_rank` 字段到 `leaderboard_personal` 表 | 高 |

### 后端实现方案

**排名变动检测（最复杂部分）的两种方案:**

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: 新增 previous_rank 字段** | Migration 给 `leaderboard_personal` + `leaderboard_alliance` 加 `previous_rank INT`，排行榜定时刷新 job 更新前先把当前 rank 写入 previous_rank | 查询简单高效 | 需修改现有排行榜刷新逻辑 |
| **B: 客户端本地缓存对比** | 客户端将上次排名存入 UserDefaults，下次查看时对比 | 零后端改动 | 跨设备不同步，首次使用无数据 |

**建议: Sprint 1 先用方案 B（零后端风险），Sprint 2 再实施方案 A。**
Badge 的 leaderboard 项暂时由客户端本地判断排名是否变化，不依赖后端新字段。

### Badge API 聚合端点设计

```
GET /api/badges
Authorization: Bearer <token>

查询步骤（并行执行 Promise.all）:
1. notifications.where({ user_id, is_read: false }).count()
2. user_checkins.where({ user_id, checkin_date: today }).first() → canCheckin
3. alliance_applications.where({ status: 'pending' }).count() — 遍历用户管理的联盟
4. 跨会话未读消息聚合（新优化查询）
5. events.where({ status: 'active' }).count()
6. user_achievements.where({ is_completed: true, is_claimed: false }).count()
7. user_challenges.where({ is_completed: true, is_claimed: false }).count()

Redis 缓存 30 秒，key: badge:{userId}
```

### 前端实现方案

修改文件清单:

| 文件 | 改动 |
|------|------|
| `ContentView.swift` | `TabBarItem` 组件增加 badge overlay 参数 |
| 新增 `BadgeService.swift` | 调用 `/api/badges` |
| 新增 `BadgeViewModel.swift` | 单例，`@Published` 各 Tab badge 状态，60s 轮询 + App 回前台刷新 |

Badge UI 实现: 在 `TabBarItem` 的 `Image` 上叠加 `.overlay(alignment: .topTrailing) { BadgeDot/BadgeCount }`。

### 风险评估

| 风险项 | 等级 | 说明 |
|--------|------|------|
| Badge API 性能 | 中 | 7 个查询并行，但需控制总耗时 < 200ms。Redis 缓存 30s 是关键 |
| 未读聊天聚合查询 | 中 | 跨多会话聚合可能慢，需测试并考虑索引优化 |
| 排名变动 | 低 | Sprint 1 采用客户端本地方案，零后端风险 |
| Tab Bar 布局 | 低 | 仅增加 overlay，不改变原有布局逻辑 |

### 不做的事

- **不**在 Sprint 1 修改 `leaderboard_personal` 表结构
- **不**修改现有排行榜刷新 job
- **不**改变 TabBar 的整体布局或动画逻辑
- **不**新增推送通知（Badge 仅 app 内展示）

---

## Sprint 1 总结

### 执行顺序建议

```
1. 任务 0.2 (模型清理)     ← 最安全，纯删除死代码，≤ 1 小时
2. 任务 0.1 (SessionManager) ← 很安全，迁移 1 个类型后删文件，≤ 1 小时
3. 任务 6.1a (Badge 后端)   ← 纯新增代码，不修改现有逻辑，~ 1 天
4. 任务 0.3 (网络层)        ← 中等风险，需逐服务迁移+测试，~ 2 天
5. 任务 6.1b (Badge 前端)   ← 纯新增代码，~ 1 天
```

### 整体风险矩阵

| 任务 | 风险 | 影响文件数 | 需要实机测试 |
|------|------|-----------|------------|
| 0.1 SessionManager | 极低 | 2 | 否（编译通过即可） |
| 0.2 模型清理 | 极低 | 2 | 否（编译通过即可） |
| 0.3 网络层迁移 | 中 | 6 | **是**（GPS 绘画 + 历史记录 + 地图渲染） |
| 6.1a Badge 后端 | 低 | 0（纯新增） | 否（API 测试即可） |
| 6.1b Badge 前端 | 低 | 1（ContentView） | 是（视觉验证） |

### 回滚策略

- 所有改动前先 `git stash` 或创建分支
- 任务 0.1/0.2: 删除文件可通过 `git checkout` 恢复
- 任务 0.3: 逐服务分 commit，某服务迁移失败可单独 revert
- 任务 6.1: 纯新增文件，删除新文件即回滚

---

> 以上分析基于 commit `f3bc9a82f` 的代码快照。执行前请确认代码库无未提交变更。
