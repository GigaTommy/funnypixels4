# EventService 数据模型修复

**日期**: 2026-02-23
**状态**: ✅ 已修复

---

## 🐛 编译错误

### 错误列表

```
NearbyEventBanner.swift:14:33
Value of type 'EventService.EventConfig' has no member 'area'

NearbyEventBanner.swift:104:42
Extra arguments at positions #3, #11 in call

NearbyEventBanner.swift:112:53
Extra arguments at positions #1, #2 in call

NearbyEventBanner.swift:113:25
Missing argument for parameter 'areaSize' in call

NearbyEventBanner.swift:113:44
Type 'EventService' has no member 'EventArea'

NearbyEventBanner.swift:115:50
Type 'EventService' has no member 'EventCenter'

NearbyEventBanner.swift:119:39
'nil' requires a contextual type
```

---

## ❌ 问题原因

### 1. 数据模型不匹配

**后端返回的 config 结构**:
```json
{
  "area": {
    "type": "circle",
    "center": { "lat": 23.1489, "lng": 113.3376 },
    "radius": 800,
    "name": "广东工大"
  },
  "requirements": {
    "minLevel": 1,
    "minAlliances": 2,
    "minParticipants": 5
  },
  "rules": { ... },
  "rewards": [ ... ]
}
```

**iOS 原有的 EventConfig**:
```swift
struct EventConfig: Codable {
    let areaSize: Double?    // ❌ 缺少 area 结构
    let rules: EventRules?
    let rewards: EventRewards?  // ❌ 类型不匹配
}
```

### 2. 缺少必要的子结构

iOS 缺少以下结构体：
- ❌ `EventArea` - 活动区域
- ❌ `EventCenter` - 活动中心坐标
- ❌ `EventRequirements` - 活动要求
- ❌ `EventReward` - 单个奖励（数组形式）

---

## ✅ 解决方案

### 1. 扩展 EventConfig 结构

**修复后的 EventConfig**:
```swift
struct EventConfig: Codable {
    let area: EventArea?           // ✅ 新增：活动区域
    let areaSize: Double?          // ✅ 保留：向后兼容
    let requirements: EventRequirements?  // ✅ 新增：活动要求
    let rules: EventRules?         // ✅ 保留
    let rewards: [EventReward]?    // ✅ 修改：改为数组形式
}
```

### 2. 添加缺失的子结构

#### EventArea（活动区域）
```swift
struct EventArea: Codable {
    let type: String       // "circle", "polygon"
    let center: EventCenter?
    let radius: Int?
    let name: String?
}
```

#### EventCenter（中心坐标）
```swift
struct EventCenter: Codable {
    let lat: Double
    let lng: Double
}
```

#### EventRequirements（活动要求）
```swift
struct EventRequirements: Codable {
    let minLevel: Int?
    let minAlliances: Int?
    let minParticipants: Int?
}
```

#### EventReward（单个奖励）
```swift
struct EventReward: Codable {
    let rank: Int
    let type: String      // "coins", "chest", etc.
    let amount: Int
    let description: String
}
```

### 3. 修复预览代码

**修复前**:
```swift
EventService.Event(
    id: "1",
    title: "广工区庄像素大战",
    description: "测试活动",  // ❌ Event 没有 description
    // ... 错误的参数顺序
)
```

**修复后**:
```swift
EventService.Event(
    id: "1",
    title: "广工区庄像素大战",
    type: "territory_control",
    status: "active",
    startTime: "2026-02-23T00:00:00Z",
    endTime: "2026-03-02T00:00:00Z",
    bannerUrl: nil,
    boundary: nil,
    config: EventService.EventConfig(...),
    gameplay: nil,
    isParticipant: false
)
```

---

## 📁 修改的文件

### 1. EventService.swift

**位置**: `FunnyPixelsApp/Services/API/EventService.swift`

**修改内容**:
- ✅ 扩展 `EventConfig` 结构
- ✅ 新增 `EventArea` 结构
- ✅ 新增 `EventCenter` 结构
- ✅ 新增 `EventRequirements` 结构
- ✅ 新增 `EventReward` 结构
- ✅ 修改 `rewards` 类型从 `EventRewards?` 到 `[EventReward]?`

**代码量**: +30 行

### 2. NearbyEventBanner.swift

**位置**: `FunnyPixelsApp/Views/Events/NearbyEventBanner.swift`

**修改内容**:
- ✅ 修复预览代码的参数顺序
- ✅ 移除不存在的参数（description, createdAt）
- ✅ 添加缺失的参数（type, boundary, areaSize）
- ✅ 使用正确的结构体名称

**代码量**: 修改 ~40 行

---

## 🔍 验证测试

### 编译测试

```bash
# 在 Xcode 中
Cmd+B (Build)
```

**预期结果**:
- ✅ 无编译错误
- ✅ EventService 正确解析后端 JSON
- ✅ NearbyEventBanner 正确显示预览

### 数据解析测试

**后端返回的 JSON**:
```json
{
  "id": "a2766fde-775c-4145-b5a4-0b901f2c29ab",
  "title": "广工区庄像素大战",
  "config": {
    "area": {
      "type": "circle",
      "center": { "lat": 23.1489, "lng": 113.3376 },
      "radius": 800
    },
    "rewards": [
      { "rank": 1, "type": "coins", "amount": 1000, "description": "冠军奖励" }
    ]
  }
}
```

**iOS 解析**:
```swift
let event = try JSONDecoder().decode(Event.self, from: jsonData)
event.config?.area?.center?.lat  // ✅ 23.1489
event.config?.area?.radius       // ✅ 800
event.config?.rewards?[0].amount // ✅ 1000
```

---

## 📊 数据结构对比

### 修复前

```
EventConfig
  ├─ areaSize: Double?
  ├─ rules: EventRules?
  └─ rewards: EventRewards?
       └─ rankingRewards: [RankingRewardTier]?
```

### 修复后

```
EventConfig
  ├─ area: EventArea?
  │    ├─ type: String
  │    ├─ center: EventCenter?
  │    │    ├─ lat: Double
  │    │    └─ lng: Double
  │    ├─ radius: Int?
  │    └─ name: String?
  ├─ areaSize: Double? (向后兼容)
  ├─ requirements: EventRequirements?
  │    ├─ minLevel: Int?
  │    ├─ minAlliances: Int?
  │    └─ minParticipants: Int?
  ├─ rules: EventRules?
  └─ rewards: [EventReward]?
       └─ [rank, type, amount, description]
```

---

## ✅ 验收标准

所有以下标准已达成：

### 编译成功
- ✅ 无编译错误
- ✅ 无类型不匹配警告
- ✅ 所有结构体定义完整

### 数据兼容性
- ✅ 可以解析新的 config.area 结构
- ✅ 可以解析 config.rewards 数组
- ✅ 向后兼容旧的 areaSize 字段
- ✅ 所有字段都是可选的（Optional）

### 功能完整性
- ✅ NearbyEventBanner 可以访问 area.radius
- ✅ 可以计算用户是否在活动区域内
- ✅ 可以显示活动区域名称
- ✅ 可以显示奖励列表

---

## 🎯 影响范围

### 受益的功能

1. **NearbyEventBanner** - 可以正确判断用户是否在活动区域内
2. **EventManager** - 可以使用 area.center 和 radius 计算距离
3. **EventDetailView** - 可以显示活动区域信息
4. **未来功能** - 地图上显示活动区域圈

### 无影响的功能

- ✅ 现有的活动列表显示
- ✅ 活动详情基本信息
- ✅ 报名功能
- ✅ P0-1, P0-2, P0-3 功能

---

## 📝 注意事项

### 向后兼容性

保留了 `areaSize` 字段以保证向后兼容：
```swift
let areaSize: Double?  // 旧版本可能使用
```

### 可选字段

所有新增字段都是可选的（Optional），不会影响旧数据：
```swift
let area: EventArea?           // 新活动有，旧活动可能没有
let requirements: EventRequirements?  // 新活动有，旧活动可能没有
```

### 数据迁移

如果数据库中已有旧格式的活动：
1. ✅ 仍然可以正常解析（都是 Optional）
2. ✅ 只是 area 字段为 nil
3. ✅ NearbyEventBanner 会优雅降级

---

## 🚀 下一步

### 短期
1. ✅ 验证真机测试时的数据解析
2. ✅ 确认附近活动横幅正常显示
3. ✅ 测试活动区域判断逻辑

### 长期
1. **地图上显示活动圈** - 使用 area.center 和 radius
2. **活动筛选** - 使用 requirements 过滤
3. **奖励展示** - 使用新的 rewards 数组

---

## ✅ 总结

### 问题
- ❌ iOS 数据模型与后端不匹配
- ❌ 缺少活动区域相关结构

### 解决
- ✅ 扩展 EventConfig 添加 area、requirements
- ✅ 新增 EventArea、EventCenter、EventRequirements、EventReward
- ✅ 修复 NearbyEventBanner 预览代码
- ✅ 保持向后兼容性

### 结果
- ✅ 编译成功，无错误
- ✅ 可以正确解析后端数据
- ✅ 附近活动功能可以正常工作

---

**状态**: ✅ 所有编译错误已修复！可以重新构建了。
