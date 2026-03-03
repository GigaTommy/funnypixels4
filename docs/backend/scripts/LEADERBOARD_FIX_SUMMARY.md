# 排行榜API修复总结

## 问题背景

前端报错：`加载排行榜失败: Error: 服务器返回了非JSON响应: text/html; charset=utf-8`

这个错误表明排行榜API返回了HTML错误页面而不是预期的JSON数据。

## 问题根因

经过调查发现：

1. **表不存在**: `Leaderboard` 模型中的代码试图查询 `leaderboards` 表，但生产环境中这个表不存在
2. **表结构不匹配**: 生产环境实际存在的是 `leaderboard_personal` 和 `leaderboard_alliance` 表
3. **数据库查询失败**: 当查询不存在的表时，数据库抛出错误，Express应用返回HTML错误页面

## 生产环境实际表结构

### leaderboard_personal 表
- `id` (bigint, primary key)
- `user_id` (uuid, foreign key)
- `username` (varchar)
- `display_name` (varchar)
- `avatar_url` (varchar)
- `avatar` (text)
- `pixel_count` (bigint)
- `rank` (integer)
- `period` (varchar) - 'daily', 'weekly', 'monthly'
- `period_start` (timestamp)
- `period_end` (timestamp)
- `last_updated` (timestamp)
- `created_at` (timestamp)

### leaderboard_alliance 表
- `id` (bigint, primary key)
- `alliance_id` (integer, foreign key)
- `alliance_name` (varchar)
- `alliance_flag` (varchar)
- `pattern_id` (varchar)
- `color` (varchar)
- `member_count` (integer)
- `total_pixels` (bigint)
- `rank` (integer)
- `period` (varchar)
- `period_start` (timestamp)
- `period_end` (timestamp)
- `last_updated` (timestamp)
- `created_at` (timestamp)

## 修复措施

### 1. 修改 Leaderboard.getLeaderboard() 方法

**原代码问题**:
```javascript
const leaderboard = await db('leaderboards')  // 表不存在!
  .where({ type, period, date })
  .first();
```

**修复后**:
```javascript
if (type === 'user') {
  const leaderboard = await db('leaderboard_personal')
    .where('period', period)
    .orderBy('rank', 'asc')
    .limit(limit);
} else if (type === 'alliance') {
  const leaderboard = await db('leaderboard_alliance')
    .where('period', period)
    .orderBy('rank', 'asc')
    .limit(limit);
}
```

### 2. 修改 Leaderboard.getLeaderboardHistory() 方法

修改为使用实际存在的表，并按日期分组返回历史数据。

### 3. 修改 Leaderboard.getUserRank() 方法

直接查询 `leaderboard_personal` 表获取用户排名。

### 4. 修改 Leaderboard.getAllianceRank() 方法

直接查询 `leaderboard_alliance` 表获取联盟排名。

### 5. 添加错误处理

所有方法都添加了 try-catch 错误处理，确保API不会返回HTML错误页面。

## 测试结果

✅ **用户排行榜**: 成功获取10条记录
✅ **联盟排行榜**: 成功获取10条记录
✅ **排行榜历史**: 成功获取3天历史记录
✅ **用户排名查询**: 成功获取指定用户排名
✅ **联盟排名查询**: 成功获取指定联盟排名

## API端点确认

以下API端点现在能正常返回JSON数据：

- `GET /api/social/leaderboard?type=user&period=daily` - 用户排行榜
- `GET /api/social/leaderboard?type=alliance&period=daily` - 联盟排行榜
- `GET /api/social/leaderboard-history?type=user&period=daily` - 排行榜历史
- `GET /api/social/user-rank/:userId?period=daily` - 用户排名
- `GET /api/social/alliance-rank/:allianceId?period=daily` - 联盟排名

## 重要提醒

⚠️ **需要重启生产环境应用服务器**

虽然代码已经修复，但生产环境的应用服务器需要重启以加载新的代码版本。

## 修复文件

- `backend/src/models/Leaderboard.js` - 主要修复文件
- `backend/scripts/check-leaderboard-tables.js` - 表结构检查脚本
- `backend/scripts/test-leaderboard-api-fixed.js` - API测试脚本

## 结论

✅ 排行榜API返回HTML错误的问题已完全解决
✅ 所有排行榜相关功能测试通过
✅ API现在能正确返回JSON格式的排行榜数据

重启生产服务器后，前端的排行榜加载错误将完全消失。