# iOS 排行榜 API 修复总结

## 修复日期
2026-01-11

## 问题概述
iOS App 无法正确加载排行榜数据，出现以下解码错误：
- 城市榜：缺少 `id` 字段，`id` 类型应为 String
- 个人榜：`total_pixels` 和 `pixel_count` 类型应为 Int
- 联盟榜：缺少 `id` 字段，字段类型不匹配

## 后端修复清单

### 1. 城市排行榜 (City Leaderboard)

**文件**: `src/controllers/leaderboardController.js`

**修复内容**:
- ✅ 添加 `id` 字段（String 类型）：`id: String(rank)`
- ✅ 添加 `city_name` 字段：`city_name: item.city`
- ✅ 确保所有数值字段为整数：使用 `parseInt()`

**影响的方法**:
- `generateDailyLeaderboard()`
- `generateWeeklyLeaderboard()`
- `generateMonthlyLeaderboard()`
- `generateYearlyLeaderboard()`
- `generateAllTimeLeaderboard()`

**修复后的响应示例**:
```json
{
  "id": "1",           // ✅ String 类型
  "city_name": "广州市", // ✅ 新增字段
  "region_name": "广州市",
  "region_code": "广州市",
  "user_count": 1,     // ✅ Int 类型
  "total_pixels": 15,  // ✅ Int 类型
  "pixel_count": 15,   // ✅ Int 类型
  "rank": 1            // ✅ Int 类型
}
```

### 2. 个人排行榜 (Personal Leaderboard)

**文件**: `src/controllers/leaderboardController.js`

**修复内容**:
- ✅ 添加 `total_pixels` 字段：`total_pixels: parseInt(user.pixel_count) || 0`
- ✅ 确保 `pixel_count` 为整数：`pixel_count: parseInt(user.pixel_count) || 0`
- ✅ 确保 `id` 为 String 类型（来自数据库）

**修复后的响应示例**:
```json
{
  "id": "1",                        // ✅ String 类型
  "user_id": "38ba1df3-...",        // ✅ String 类型
  "username": "bbb",
  "pixel_count": 15,                // ✅ Int 类型（修复后）
  "total_pixels": 15,               // ✅ Int 类型（新增）
  "rank": 1                         // ✅ Int 类型
}
```

### 3. 联盟排行榜 (Alliance Leaderboard)

**文件**: `src/controllers/leaderboardController.js`

**修复内容**:
- ✅ 确保 `id` 为 String 类型：`id: String(alliance.id || alliance.alliance_id || index + 1)`
- ✅ 添加 `total_pixels` 字段：`total_pixels: parseInt(alliance.pixel_count) || 0`
- ✅ 确保 `pixel_count` 为整数：`pixel_count: parseInt(alliance.pixel_count) || 0`

**修复后的响应示例**:
```json
{
  "id": "1",              // ✅ String 类型（修复后）
  "name": "联盟名称",
  "pixel_count": 100,     // ✅ Int 类型（修复后）
  "total_pixels": 100,    // ✅ Int 类型（新增）
  "rank": 1,              // ✅ Int 类型
  "member_count": 5       // ✅ Int 类型
}
```

### 4. 缓存清理

**问题**: 旧的缓存数据包含旧格式（缺少新字段）
**解决**: 创建了缓存清理脚本并执行
- 清理了 22 个旧的地区排行榜缓存键
- 缓存键格式：`region_leaderboard:*`

**清理脚本**:
- `clear-region-cache.js` - 清空地区排行榜缓存

### 5. 测试验证

**测试脚本**:
- `test-leaderboard-api.js` - 测试城市排行榜
- `test-personal-leaderboard-api.js` - 测试个人排行榜
- `test-alliance-leaderboard-api.js` - 测试联盟排行榜
- `test-all-leaderboards.js` - 测试所有排行榜

## 字段类型对照表

| 排行榜类型 | 字段 | 后端类型 | iOS 期望类型 | 状态 |
|----------|-----|---------|------------|------|
| **城市榜** | id | String | String | ✅ |
| | rank | Int | Int | ✅ |
| | city_name | String | String | ✅ |
| | region_code | String | String? | ✅ |
| | user_count | Int | Int | ✅ |
| | total_pixels | Int | Int | ✅ |
| | pixel_count | Int | - | ✅ |
| **个人榜** | id | String | String | ✅ |
| | user_id | String | String | ✅ |
| | username | String | String | ✅ |
| | pixel_count | Int | Int | ✅ (已修复) |
| | total_pixels | Int | Int | ✅ (已添加) |
| | rank | Int | Int | ✅ |
| **联盟榜** | id | String | String | ✅ (已修复) |
| | name | String | String | ✅ |
| | pixel_count | Int | Int | ✅ (已修复) |
| | total_pixels | Int | Int | ✅ (已添加) |
| | rank | Int | Int | ✅ |
| | member_count | Int | Int | ✅ |

## 下一步操作

### 后端操作
1. **重启后端服务**:
   ```bash
   pm2 restart funnypixels
   # 或
   npm run dev
   ```

2. **验证 API 响应**:
   ```bash
   node test-all-leaderboards.js
   ```

### iOS 端操作
根据之前的实施计划进行修改：

**修改 1**: 增强 `CityLeaderboardEntry` 数据模型
- 文件: `LeaderboardService.swift`
- 添加自定义解码器，支持 `region_code` → `country_code` 和 `user_count` → `total_users` 的字段映射

**修改 2**: 增强错误日志
- 文件: `APIManager.swift`
- 添加原始 JSON 响应输出，便于调试

### 验证步骤
1. 重启后端服务
2. 在 Xcode 中重新编译并运行 iOS App
3. 查看 Xcode 控制台日志
4. 确认排行榜能正常加载

## 相关文件

### 后端文件
- `src/controllers/leaderboardController.js` - 排行榜控制器（已修改）
- `clear-region-cache.js` - 缓存清理脚本（新增）
- `test-leaderboard-api.js` - 城市榜测试脚本（新增）
- `test-personal-leaderboard-api.js` - 个人榜测试脚本（新增）
- `test-alliance-leaderboard-api.js` - 联盟榜测试脚本（新增）
- `test-all-leaderboards.js` - 全部排行榜测试脚本（新增）

### iOS 文件（待修改）
- `FunnyPixelsApp/FunnyPixelsApp/Services/API/LeaderboardService.swift`
- `FunnyPixelsApp/FunnyPixelsApp/Services/Network/APIManager.swift`

## 技术要点

1. **字段类型转换**: 数据库返回的数字字段可能是字符串，需要使用 `parseInt()` 转换
2. **字段映射**: iOS 端可能使用不同的字段名，需要提供兼容映射
3. **缓存失效**: 代码修改后必须清理相关缓存，否则会返回旧格式数据
4. **String vs Int**: iOS 的 Codable 对类型非常敏感，必须严格匹配
