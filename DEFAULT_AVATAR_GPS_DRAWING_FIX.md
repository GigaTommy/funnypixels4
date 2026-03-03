# 默认头像用户GPS绘制显示灰色背景问题修复

## 🐛 问题描述

**用户反馈**: test1@example/password123 登录，使用默认头像进行GPS绘制时，地图上显示的是"灰色背景？"图案（异常），而不是预期的绿色/彩色默认头像。

## 🔍 问题分析

### 用户数据状态

test1@example.com (username: testuser1):
- ✅ 有头像URL: `https://api.dicebear.com/7.x/avatars/svg?seed=testuser1`
- ❌ **没有像素头像数据** (users.avatar 字段为空)
- ❌ **没有加入联盟**

### 预期行为

对于没有自定义像素头像的用户：
1. iOS端应该使用 `PersonalColorPalette.colorForUser(userId)` 获取一个基于用户ID映射的颜色
2. 生成对应的 `patternId = "personal_color_XXXXXX"`
3. 后端在 `pattern_assets` 表中查找对应记录
4. 地图上显示对应的纯色方块

### 实际行为

用户看到"灰色背景？"图案，可能的原因：

1. **iOS端选择了错误的模式**
   - 用户可能在"我的"tab选择了"使用我的头像"模式
   - 但users.avatar字段为空（只有avatar_url）
   - iOS生成了 `user_avatar_{userId}` pattern
   - 后端sprite服务找不到有效的头像，返回占位符图片

2. **Sprite服务返回错误占位符**
   - 当 `user_avatar_` pattern对应的用户没有avatar_url时
   - Sprite服务可能返回一个带"?"的灰色占位符图片

## ✅ 验证假设

让我检查几个关键点：

### 1. 检查用户最近绘制的像素使用的pattern

```sql
SELECT
  grid_id,
  color,
  pattern_id,
  pixel_type,
  created_at
FROM pixels
WHERE user_id = '661bdcc1-b4dd-4c76-8c73-7331a80732e0'  -- testuser1的UUID
ORDER BY created_at DESC
LIMIT 10;
```

### 2. 检查sprite服务如何处理user_avatar pattern

当请求 `/api/sprites/icon/1/complex/user_avatar_661bdcc1-b4dd-4c76-8c73-7331a80732e0.png` 时：
- 应该从 `users.avatar_url` 获取头像
- 如果avatar_url是DiceBear SVG，需要下载并转换为PNG
- 如果avatar_url为空，应该返回什么？

### 3. 检查iOS端用户选择的模式

用户在"我的"tab可能有以下选择：
- 个人颜色 (personal_color)
- 我的头像 (user_avatar)  ← **可能是这个导致问题**
- 联盟旗帜 (alliance)

## 🔧 修复方案

### 方案1: 修复sprite服务处理DiceBear头像

**问题**: 当用户有DiceBear头像URL但没有上传自定义像素头像时，sprite服务需要下载并渲染DiceBear SVG。

**修改文件**: `backend/src/services/spriteService.js`

在 `renderComplex` 函数中添加DiceBear头像处理：

```javascript
async function renderComplex(patternKey, scale) {
  // 检查是否为user_avatar pattern
  if (patternKey.startsWith('user_avatar_')) {
    const userId = patternKey.replace('user_avatar_', '');

    // 从users表获取avatar_url
    const user = await db('users')
      .where('id', userId)
      .select('avatar', 'avatar_url')
      .first();

    if (!user) {
      logger.warn(`⚠️ User not found for user_avatar pattern: ${userId}`);
      return renderFallbackAvatar(scale); // 返回默认头像
    }

    // 优先使用自定义像素头像（users.avatar）
    if (user.avatar && user.avatar.length > 0) {
      return renderPixelAvatar(user.avatar, scale);
    }

    // 回退到avatar_url（可能是DiceBear或上传的图片URL）
    if (user.avatar_url) {
      try {
        // 下载并转换为PNG
        const response = await fetch(user.avatar_url);
        const buffer = await response.buffer();
        return sharp(buffer)
          .resize(64 * scale, 64 * scale)
          .png()
          .toBuffer();
      } catch (error) {
        logger.error(`❌ Failed to fetch avatar_url for user ${userId}:`, error.message);
        return renderFallbackAvatar(scale);
      }
    }

    // 没有任何头像，返回默认头像
    return renderFallbackAvatar(scale);
  }

  // ... 其他complex pattern处理
}

function renderFallbackAvatar(scale) {
  // 返回基于PersonalColorPalette的默认颜色方块
  // 而不是带"?"的灰色占位符
  const size = 64 * scale;
  const defaultColor = '#4ECDC4'; // 默认青色

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${defaultColor}"/>
    </svg>`;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}
```

### 方案2: iOS端自动回退到个人颜色模式

**问题**: 当用户选择"使用我的头像"但没有上传自定义头像时，iOS应该自动回退到个人颜色模式。

**修改文件**: `FunnyPixelsApp/Services/Drawing/AllianceDrawingPatternProvider.swift`

在 `setPatternFromFlagChoice` 方法的 `personalAvatar` 分支（第93-130行）中：

```swift
case .personalAvatar(let avatarData):
    let userId = AuthManager.shared.currentUser?.id ?? ""
    let hasCustomAvatar = !avatarData.isEmpty && !avatarData.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

    // ✅ 新增检查：验证avatar_url是否为有效的自定义头像
    // DiceBear URL不算作"自定义头像"
    let isDiceBearUrl = avatarData.contains("dicebear.com")
    let hasValidCustomAvatar = hasCustomAvatar && !isDiceBearUrl

    if hasValidCustomAvatar {
        // 用户上传了真正的自定义头像
        // ... 现有的 complex 模式代码
    } else {
        // 用户没有上传自定义头像，使用基于用户ID的默认颜色
        let personalColor = PersonalColorPalette.colorForUser(userId)
        // ... 现有的 color 模式代码
    }
```

### 方案3: 后端MVT生成时优化user_avatar处理

**文件**: `backend/src/models/productionPixelTileQuery.js`

在第146-156行的 `image_url` CASE语句中，添加DiceBear处理：

```sql
WHEN p.color = 'custom_pattern' AND p.alliance_id IS NULL THEN
  CASE
    -- 如果avatar_url是DiceBear，设为NULL（让前端使用默认颜色）
    WHEN u.avatar_url LIKE '%dicebear%' THEN NULL
    -- 如果有真实上传的头像，使用它
    WHEN u.avatar_url IS NOT NULL THEN u.avatar_url
    ELSE NULL
  END
```

## 📊 推荐方案

**组合方案（方案1 + 方案2）**：

1. **短期**：修复sprite服务，当user_avatar pattern对应的用户没有有效头像时，返回基于PersonalColorPalette的默认颜色（方案1）

2. **长期**：iOS端优化，自动过滤DiceBear URL，将其视为"无自定义头像"，自动使用个人颜色模式（方案2）

3. **可选**：后端MVT优化，避免在瓦片中包含DiceBear URL（方案3）

## 🧪 测试步骤

1. **当前状态测试**:
   ```sql
   -- 查看testuser1最近绘制的像素使用的pattern
   SELECT grid_id, color, pattern_id, pixel_type
   FROM pixels
   WHERE user_id = '661bdcc1-b4dd-4c76-8c73-7331a80732e0'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

2. **Sprite服务测试**:
   ```bash
   # 测试user_avatar pattern渲染
   curl -o test_avatar.png "http://localhost:3001/api/sprites/icon/1/complex/user_avatar_661bdcc1-b4dd-4c76-8c73-7331a80732e0.png"
   ```

3. **修复后验证**:
   - 使用test1@example/password123登录
   - 进入地图tab，开始GPS绘制
   - 检查地图上显示的像素颜色
   - 应该看到基于PersonalColorPalette的颜色（不是灰色问号）

## 📝 下一步行动

1. ✅ 确认用户实际使用的pattern类型（查询pixels表）
2. ⏳ 实施方案1（修复sprite服务）
3. ⏳ 实施方案2（iOS端优化）
4. ⏳ 测试验证
5. ⏳ 清理testuser1的错误像素（如果需要）

---

**创建日期**: 2026-03-03
**问题状态**: 待确认具体原因
**优先级**: 高（影响默认用户体验）
