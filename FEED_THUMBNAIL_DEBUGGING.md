# 动态流缩略图调试指南

## 🐛 当前问题

**症状**: 缩略图不显示，Xcode日志报错 `decodingFailed`

**错误信息**:
```
SessionDetailMapView.swift:99 loadSession(id:) - Failed to load session map:
decodingFailed(Swift.DecodingError.keyNotFound(CodingKeys(stringValue: "data", intValue: nil), ...))
```

## 🔍 问题分析

### 可能原因

1. **后端返回错误响应**
   - API返回 `{ success: false, message: "..." }` 没有 `data` 字段
   - iOS代码尝试解码为 `DataResponse<T>` 时失败

2. **会话不存在** (404)
   - `drawing_session_id` 在feed中有值，但数据库中找不到对应会话

3. **权限被拒绝** (403)
   - 会话状态不是 `completed`（可能是 `active` 或 `paused`）

4. **网络问题** (500)
   - 后端抛出异常

## ✅ 已添加的调试日志

### iOS端 (SessionThumbnailView.swift)

```swift
Logger.info("📸 [Thumbnail] Loading pixels for session: \(sessionId)")
Logger.info("📸 [Thumbnail] Loaded \(pixels.count) pixels")

// 错误日志
Logger.error("❌ [Thumbnail] API Error: \(apiError)")
Logger.error("❌ [Thumbnail] Decoding Error: \(decodingError)")
Logger.error("❌ [Thumbnail] Unknown Error: \(error)")
```

### 后端 (drawingSessionController.js)

```javascript
logger.info(`📸 [getSessionPixels] Request: userId=${userId}, sessionId=${sessionId}`);
logger.info(`📸 [getSessionPixels] First attempt result: ${result ? 'found' : 'not found'}`);
logger.info(`📸 [getSessionPixels] Second attempt result: ${result ? 'found' : 'not found'}`);
logger.warn(`📸 [getSessionPixels] Access denied: session status=${result.session.status}`);
logger.warn(`📸 [getSessionPixels] Session not found: ${sessionId}`);
logger.info(`📸 [getSessionPixels] Success: returning ${result.pixels.length} pixels`);
```

## 🧪 调试步骤

### 步骤1: 查看iOS日志

1. 在Xcode中打开"动态"tab
2. 滚动到有 `drawing_complete` 或 `showcase` 类型的动态
3. 查看控制台日志

**期望看到**:
```
📸 [Thumbnail] Loading pixels for session: <session_id>
```

**如果看到错误**:
```
❌ [Thumbnail] API Error: ...
❌ [Thumbnail] Decoding Error: ...
```

记录下完整的错误信息和session ID。

### 步骤2: 查看后端日志

打开后端日志终端：
```bash
cd /Users/ginochow/code/funnypixels3/backend
npm run dev
```

或查看PM2日志：
```bash
pm2 logs funnypixels-api
```

**期望看到**:
```
📸 [getSessionPixels] Request: userId=xxx, sessionId=xxx
📸 [getSessionPixels] First attempt result: found/not found
📸 [getSessionPixels] Success: returning X pixels
```

**可能的错误**:
```
📸 [getSessionPixels] Session not found: <session_id>
📸 [getSessionPixels] Access denied: session status=active
❌ [getSessionPixels] Error: ...
```

### 步骤3: 检查数据库

如果后端说session不存在，检查数据库：

```sql
-- 查找会话
SELECT id, user_id, status, pixel_count, start_time, end_time
FROM drawing_sessions
WHERE id = '<session_id>';

-- 检查会话像素
SELECT COUNT(*) as pixel_count
FROM pixels_history
WHERE session_id = '<session_id>';
```

### 步骤4: 检查Feed数据

检查feed表中的 `drawing_session_id` 是否有效：

```sql
-- 查找feed中的session_id
SELECT id, type, drawing_session_id, content
FROM feed
WHERE type IN ('drawing_complete', 'showcase')
ORDER BY created_at DESC
LIMIT 10;

-- 检查session是否存在
SELECT f.id as feed_id,
       f.drawing_session_id,
       ds.id as session_exists,
       ds.status,
       ds.pixel_count
FROM feed f
LEFT JOIN drawing_sessions ds ON f.drawing_session_id = ds.id
WHERE f.type IN ('drawing_complete', 'showcase')
ORDER BY f.created_at DESC
LIMIT 10;
```

## 🔧 常见问题解决

### 问题1: session_id 为 null 或空字符串

**症状**: 缩略图不显示，但无错误日志

**原因**: Feed数据中 `drawing_session_id` 为空

**解决**:
```sql
-- 修复：为现有feed填充session_id（如果可能）
UPDATE feed
SET drawing_session_id = (
    SELECT id FROM drawing_sessions
    WHERE user_id = feed.user_id
    AND type = 'gps'
    AND status = 'completed'
    ORDER BY end_time DESC
    LIMIT 1
)
WHERE type IN ('drawing_complete', 'showcase')
AND (drawing_session_id IS NULL OR drawing_session_id = '');
```

### 问题2: 会话状态不是 completed

**症状**: 后端日志显示 "Access denied: session status=active"

**原因**: 会话还在进行中，未完成

**解决**:
```sql
-- 修复：标记为已完成（仅用于测试）
UPDATE drawing_sessions
SET status = 'completed', end_time = NOW()
WHERE id = '<session_id>';
```

### 问题3: 会话像素数据为空

**症状**: 后端成功返回，但pixels数组为空

**原因**: `pixels_history` 表中没有对应session_id的记录

**解决**:
```sql
-- 检查是否有像素数据
SELECT COUNT(*) FROM pixels_history WHERE session_id = '<session_id>';

-- 如果没有，可能需要：
-- 1. 用户还没有真正画过像素
-- 2. 数据迁移问题
```

### 问题4: 解码错误（缺少data字段）

**症状**: iOS报 `decodingFailed keyNotFound("data")`

**原因**: 后端返回错误响应，没有data字段

**检查后端响应格式**:

✅ **成功响应**:
```json
{
  "success": true,
  "data": {
    "pixels": [...]
  }
}
```

❌ **错误响应**:
```json
{
  "success": false,
  "message": "会话不存在"
}
```

**解决**:
- 检查后端日志，找出为什么返回错误
- 修复根本原因（session不存在、权限问题等）

## 📊 测试用户信息

已重置密码的测试用户：

| 用户名 | 密码 | 状态 |
|--------|------|------|
| testuser | password123 | ✅ 已重置 |
| testuser1 | password123 | ✅ 已重置 |
| testuser3 | password123 | ❌ 不存在 |
| avatar_test_user_1757000778445 | password123 | ✅ 已重置 |
| admin | password123 | ✅ 已重置 |

可以使用这些账号登录测试：
1. 创建绘制会话
2. 画一些像素
3. 结束会话
4. 查看动态流

## 🎯 下一步行动

1. **重现问题**
   - 使用测试用户登录
   - 查看动态流
   - 观察Xcode和后端日志

2. **收集信息**
   - 记录iOS日志中的session_id
   - 记录后端日志中的详细信息
   - 检查数据库中的实际数据

3. **定位根因**
   - 根据日志判断是哪种错误（404/403/500/解码错误）
   - 追踪数据流：feed表 → drawing_sessions表 → pixels_history表

4. **修复问题**
   - 数据问题：修复数据库数据
   - 代码问题：修复后端逻辑或iOS解码逻辑
   - 配置问题：检查路由、权限配置

## 📝 日志收集清单

请提供以下信息以便诊断：

- [ ] iOS控制台完整错误日志
- [ ] 后端服务器日志（包含 📸 标记的行）
- [ ] 问题出现时的session_id
- [ ] 数据库查询结果：
  ```sql
  SELECT * FROM drawing_sessions WHERE id = '<session_id>';
  SELECT COUNT(*) FROM pixels_history WHERE session_id = '<session_id>';
  SELECT * FROM feed WHERE drawing_session_id = '<session_id>';
  ```

---

**文档版本**: v1.0
**创建日期**: 2026-03-03
**最后更新**: 2026-03-03
