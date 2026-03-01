# 用户头像动态渲染架构

## 概述

为避免性能问题，用户头像不预存在 `pattern_assets` 表中，改为**动态查询**：
- ❌ 不在保存头像时写入 `pattern_assets`
- ❌ 不在更新头像时更新 `pattern_assets`
- ✅ 在渲染时动态从 `users.avatar_url` 获取

## 性能优化原因

### 预存方案的问题：
1. **频繁写入**：每次用户保存/更新头像都写数据库
2. **表膨胀**：100万用户 = 100万条 user_avatar_ 记录（大部分从不使用）
3. **缓存失效**：每次更新 `updated_at`，sprite 列表缓存失效
4. **数据冗余**：`users.avatar_url` 和 `pattern_assets.file_url` 重复存储

### 动态查询方案的优势：
1. ✅ **零写入开销**：保存头像时不写 `pattern_assets`
2. ✅ **表轻量化**：`pattern_assets` 只存储 256 + 16 = 272 条颜色 patterns
3. ✅ **无缓存失效**：sprite 列表不包含 user_avatar_ patterns
4. ✅ **单一数据源**：只在 `users.avatar_url` 存储

---

## 完整流程

### 1. 用户保存头像（iOS → Backend）

```
用户上传头像
    ↓
iOS: AvatarService 转换为 PNG
    ↓
Backend: profileController.updateProfile()
    ↓
生成 CDN URL → 存储到 users.avatar_url
    ↓
❌ 不写入 pattern_assets（优化点）
```

**代码位置：**
- `backend/src/controllers/profileController.js:188-193`

```javascript
const avatarUrl = await avatarService.getAvatarUrl(avatar, 'medium', userId);
if (avatarUrl) {
  updateData.avatar_url = avatarUrl;
  // ⚠️ 不再预先写入 pattern_assets
}
```

---

### 2. 用户绘制像素（iOS → Backend）

```
用户选择使用头像绘制
    ↓
iOS: 构造 patternId = "user_avatar_{userId}"
    ↓
Backend: pixelDrawService 识别 user_avatar_ 前缀
    ↓
返回 { pattern_id: "user_avatar_xxx", color: "custom_pattern" }
    ↓
存储到 pixels 表
```

**代码位置：**

**iOS 端：** `FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/AllianceDrawingPatternProvider.swift:98-111`

```swift
if hasCustomAvatar {
    let patternId = "user_avatar_\(userId)"
    currentDrawingPattern = DrawingPattern(
        type: .complex,
        patternId: patternId,
        // ...
    )
}
```

**Backend：** `backend/src/services/pixelDrawService.js:1437-1449`

```javascript
if (patternId && patternId.startsWith('user_avatar_')) {
  return {
    color: 'custom_pattern',
    patternId: patternId,
    // ...
  };
}
```

---

### 3. 地图渲染（MVT 查询）

```
客户端请求 MVT tile
    ↓
Backend: MVT 查询检测到 pattern_id LIKE 'user_avatar_%'
    ↓
动态从 users.avatar_url 获取头像 URL
    ↓
返回 MVT 数据（包含 image_url）
    ↓
客户端渲染到地图
```

**代码位置：** `backend/src/models/productionPixelTileQuery.js:124-135`

```sql
-- complex类型的图片URL
CASE
  -- 用户头像：动态从 users.avatar_url 获取
  WHEN p.pattern_id LIKE 'user_avatar_%' THEN u.avatar_url
  -- pattern_assets 中的 complex 图案
  WHEN pa.render_type = 'complex' THEN
    CASE
      WHEN pa.file_url IS NOT NULL THEN pa.file_url
      WHEN pa.file_path IS NOT NULL THEN pa.file_path
      ELSE NULL
    END
  ELSE NULL
END AS image_url
```

---

### 4. Sprite 图标（预览/选择器）

```
客户端请求 sprite 图标
    ↓
Backend: /api/sprites/icon/1/complex/user_avatar_xxx.png
    ↓
spriteService 检测到 user_avatar_ 前缀
    ↓
动态从 users 表查询 avatar_url
    ↓
下载并调整大小 → 返回 PNG
```

**代码位置：** `backend/src/services/spriteService.js:271-291`

```javascript
// Special handling for user avatars
if (patternId.startsWith('user_avatar_')) {
  const userId = patternId.replace('user_avatar_', '');
  const user = await db('users')
    .where('id', userId)
    .select('avatar_url')
    .first();

  if (user && user.avatar_url) {
    asset = {
      file_url: user.avatar_url,
      imageUrl: user.avatar_url
    };
  }
}
```

---

## 数据流图

```
┌─────────────────────────────────────────────────────────┐
│ 1. 保存头像                                               │
│    users.avatar_url ← CDN URL                            │
│    ❌ 不写 pattern_assets                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. 绘制像素                                               │
│    iOS: 构造 pattern_id = "user_avatar_{userId}"         │
│    Backend: 存储到 pixels.pattern_id                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. 渲染查询                                               │
│    MVT: 检测 user_avatar_ → 查 users.avatar_url          │
│    Sprite: 检测 user_avatar_ → 查 users.avatar_url       │
│    ✅ 动态获取，无需预存                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 关键特性

### ✅ 自动识别
- **iOS 端**：根据 `avatarData` 是否为空，自动构造正确的 `patternId`
- **Backend**：通过 `startsWith('user_avatar_')` 自动识别用户头像

### ✅ 自动渲染
- **MVT 查询**：SQL 层面自动处理 `user_avatar_` 前缀
- **Sprite 服务**：代码层面自动查询 `users` 表

### ✅ 零维护成本
- 用户保存/更新/删除头像时，无需手动触发任何操作
- 系统自动从 `users.avatar_url` 获取最新头像

### ✅ Fallback 机制
- 如果 `users.avatar_url` 为空 → 使用默认 OSM fallback icon
- 如果图片加载失败 → 使用灰色方块 fallback

---

## 性能对比

| 指标 | 预存方案 | 动态查询方案 |
|-----|---------|------------|
| 保存头像 | 1 写 users + 1 写 pattern_assets | 1 写 users |
| 更新头像 | 1 更新 users + 1 更新 pattern_assets | 1 更新 users |
| pattern_assets 表大小 | 272 + 100万 | 272 |
| sprite 列表大小 | 272 + 100万 | 272 |
| 缓存失效频率 | 每次头像更新 | 从不 |

---

## 相关文件

### Backend
- `src/controllers/profileController.js` - 移除头像保存时的 pattern_assets 写入
- `src/services/pixelDrawService.js` - 识别 user_avatar_ 前缀
- `src/models/productionPixelTileQuery.js` - MVT 查询动态获取头像 URL
- `src/services/spriteService.js` - Sprite 服务动态加载头像

### iOS
- `FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/AllianceDrawingPatternProvider.swift` - 构造 user_avatar_ patternId
- `FunnyPixelsApp/FunnyPixelsApp/Models/PersonalColorPalette.swift` - 默认颜色映射

---

## 测试验证

运行测试脚本验证流程：

```bash
cd backend
node -e "
const { db } = require('./src/config/database');
const spriteService = require('./src/services/spriteService');

(async () => {
  // 1. 查找测试用户
  const user = await db('users')
    .whereNotNull('avatar_url')
    .select('id', 'avatar_url')
    .first();

  // 2. 测试 sprite 动态加载
  const patternId = \`user_avatar_\${user.id}\`;
  const png = await spriteService.renderComplex(patternId, 1);

  console.log('✅ 动态渲染成功:', png.length, 'bytes');
  process.exit(0);
})();
"
```

预期输出：
```
✅ 动态加载用户头像: userId=xxx, url=https://...
✅ 动态渲染成功: 974 bytes
```
