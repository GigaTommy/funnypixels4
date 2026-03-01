# 头像URL旧IP问题修复
> 修复时间: 2026-02-22

## 🐛 问题描述

**现象**:
```
avatarUrl=http://192.168.0.3:3001/uploads/materials/avatars/.../avatar_...medium.png
```

当前开发环境IP已改为 `192.168.1.15`，但用户头像URL仍然包含旧IP `192.168.0.3:3001`，导致iOS无法加载头像。

---

## 🔍 根本原因

### 问题分析

1. **头像URL存储方式**:
   - 后端在上传头像时，将**完整URL**（包含IP地址）存储到数据库
   - 文件路径: `backend/src/services/storage/LocalFileStorage.js:48`
   ```javascript
   const cdnUrl = `${this.baseUrl}${this.urlPrefix}/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;
   // 结果: http://192.168.0.3:3001/uploads/materials/avatars/.../avatar.png
   ```

2. **数据库持久化**:
   - 文件路径: `backend/src/services/avatarService.js:223`
   ```javascript
   UPDATE users SET avatar_url = ? WHERE id = ?
   // 存储的是完整URL，不是相对路径
   ```

3. **IP变更影响**:
   - 当开发环境IP从 `192.168.0.3` 改为 `192.168.1.15` 时
   - 后端配置已更新（`.env` 文件中 `LOCAL_IP=192.168.1.15`）
   - 但数据库中的历史数据仍然包含旧IP
   - iOS从数据库读取的URL仍然是旧IP，无法访问

### 数据流

```
上传头像时（旧IP）:
┌─────────────────────────────────────────────────────────────┐
│ 1. LocalFileStorage.upload()                                │
│    baseUrl = http://192.168.0.3:3001 (getBaseURL())         │
│    cdnUrl = http://192.168.0.3:3001/uploads/materials/...   │
│                                                              │
│ 2. AvatarService.getAvatarUrl()                             │
│    avatarUrl = uploadResult.cdnUrl                          │
│                                                              │
│ 3. AvatarService.updateUserAvatarUrl()                      │
│    UPDATE users SET avatar_url = 'http://192.168.0.3:3001...'│
│                                                              │
│ 4. 数据库永久存储完整URL ❌                                    │
└─────────────────────────────────────────────────────────────┘

获取用户信息时（新IP环境）:
┌─────────────────────────────────────────────────────────────┐
│ 1. AuthManager.fetchUserProfile()                           │
│    SELECT * FROM users WHERE id = ?                         │
│                                                              │
│ 2. 返回数据包含旧URL                                          │
│    {                                                         │
│      avatar_url: "http://192.168.0.3:3001/uploads/..."     │
│    }                                                         │
│                                                              │
│ 3. iOS接收旧URL                                              │
│    AvatarView(avatarUrl: "http://192.168.0.3:3001/...")    │
│                                                              │
│ 4. 网络请求失败 ❌ (旧IP不可达)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ 修复方案

### 方案一: 快速修复 - 更新数据库中的旧URL（推荐用于应急）

**执行脚本**:
```bash
cd backend
node scripts/update-avatar-urls.js
```

**脚本功能**:
1. 查询所有包含旧IP的 `avatar_url` 记录
2. 批量替换 `192.168.0.3:3001` → `192.168.1.15:3001`
3. 更新 `updated_at` 字段
4. 输出更新统计

**脚本输出示例**:
```
🔧 开始更新头像URL...
   替换规则: 192.168.0.3:3001 → 192.168.1.15:3001

📊 找到 5 个需要更新的用户
   ✓ [alice] http://192.168.0.3:3001/... → http://192.168.1.15:3001/...
   ✓ [bob] http://192.168.0.3:3001/... → http://192.168.1.15:3001/...
   ...

📊 更新结果统计:
   ✅ 成功: 5 个
   ❌ 失败: 0 个

🎉 头像URL更新完成！
```

---

### 方案二: 架构优化 - 存储相对路径（推荐长期方案）

**目标**: 将完整URL改为相对路径存储，运行时动态构建完整URL

#### 2.1 后端改造

**修改文件**: `backend/src/services/storage/LocalFileStorage.js`

**修改前** (Line 48-56):
```javascript
// 生成访问URL
const cdnUrl = `${this.baseUrl}${this.urlPrefix}/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;

return {
  cdnUrl,           // ❌ 完整URL: http://192.168.0.3:3001/uploads/...
  storagePath,
  fileHash
};
```

**修改后**:
```javascript
// 生成相对路径
const relativePath = `${this.urlPrefix}/${variantType}/${materialIdPrefix}/${materialIdSuffix}/${fileName}`;
// 结果: /uploads/materials/avatars/.../avatar.png

return {
  cdnUrl: relativePath,  // ✅ 相对路径: /uploads/materials/avatars/...
  storagePath,
  fileHash
};
```

**修改文件**: `backend/src/services/avatarService.js`

添加URL构建辅助方法:
```javascript
/**
 * 将相对路径转换为完整URL
 * @param {string} relativePath - 相对路径 (e.g., /uploads/materials/...)
 * @returns {string} 完整URL
 */
buildAvatarUrl(relativePath) {
  if (!relativePath) return null;

  // 如果已经是完整URL，直接返回（兼容旧数据）
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // 构建完整URL
  const { getBaseURL } = require('../config/urlConfig');
  return `${getBaseURL()}${relativePath}`;
}
```

**修改文件**: `backend/src/controllers/authController.js`

在返回用户数据时动态构建URL:
```javascript
// 获取用户信息
const user = await authService.getUserById(userId);

// 构建完整头像URL
if (user.avatar_url) {
  user.avatar_url = avatarService.buildAvatarUrl(user.avatar_url);
}

res.json({ user });
```

#### 2.2 数据库迁移

**创建迁移**: `backend/src/database/migrations/YYYYMMDDHHMMSS_convert_avatar_urls_to_relative.js`

```javascript
exports.up = async function(knex) {
  // 将所有完整URL转换为相对路径
  const users = await knex('users')
    .whereNotNull('avatar_url')
    .where(function() {
      this.where('avatar_url', 'like', 'http://%')
        .orWhere('avatar_url', 'like', 'https://%');
    })
    .select('id', 'avatar_url');

  for (const user of users) {
    try {
      // 提取路径部分: http://192.168.1.15:3001/uploads/... → /uploads/...
      const url = new URL(user.avatar_url);
      const relativePath = url.pathname;

      await knex('users')
        .where('id', user.id)
        .update({ avatar_url: relativePath });
    } catch (error) {
      console.error(`Failed to convert avatar_url for user ${user.id}:`, error);
    }
  }
};

exports.down = async function(knex) {
  // 回滚时不处理（因为无法确定原始baseUrl）
  console.log('Rollback not supported for this migration');
};
```

#### 2.3 iOS端兼容

iOS端**不需要修改**，因为`AvatarView`已经支持构建完整URL:

**文件**: `FunnyPixelsApp/Views/Components/AvatarView.swift:152-167`

```swift
private func buildAvatarURL(_ urlString: String?) -> URL? {
    guard let urlString = urlString, !urlString.isEmpty else { return nil }

    // 如果已经是完整URL，直接使用
    if urlString.hasPrefix("http://") || urlString.hasPrefix("https://") {
        return URL(string: urlString)
    }

    // 如果是相对路径，拼接baseURL
    let baseURL = AppConstants.baseURL  // ✅ 支持相对路径
    let fullURLString = baseURL + (urlString.hasPrefix("/") ? "" : "/") + urlString
    return URL(string: fullURLString)
}
```

---

## 🎯 优势对比

| 方案 | 优点 | 缺点 | 适用场景 |
|-----|------|------|---------|
| **方案一: 更新旧URL** | 快速、简单、立即生效 | 治标不治本，下次IP变更需重新执行 | 应急修复 |
| **方案二: 存储相对路径** | 彻底解决问题，IP变更无需迁移数据 | 需要代码改造和数据库迁移 | 长期方案 |

---

## 🚀 执行步骤

### 立即修复（方案一）

```bash
# 1. 执行URL更新脚本
cd backend
node scripts/update-avatar-urls.js

# 2. 重启后端服务
npm run dev

# 3. 验证iOS app
# 打开app → 我的 → 查看头像是否正常加载
```

### 长期优化（方案二）

```bash
# 1. 修改LocalFileStorage.js（存储相对路径）
# 2. 修改avatarService.js（添加buildAvatarUrl方法）
# 3. 修改authController.js（返回数据前构建URL）
# 4. 创建数据库迁移（转换历史数据）
# 5. 运行迁移
cd backend
npx knex migrate:latest

# 6. 测试验证
npm test
```

---

## 📊 配置文件检查清单

确保以下配置正确:

### backend/.env
```bash
# ✅ 正确配置
LOCAL_IP=192.168.1.15
CDN_BASE_URL=http://192.168.1.15:3001/uploads
HOST=0.0.0.0
PORT=3001
```

### FunnyPixelsApp/AppConstants.swift
```swift
// ✅ 正确配置
static let baseURL = "http://192.168.1.15:3001"
```

### 验证URL配置
```bash
# 启动后端，查看日志
npm run dev

# 应该看到:
# 🌐 URL Configuration:
#    Base URL: http://192.168.1.15:3001
#    CDN Base URL: http://192.168.1.15:3001/uploads
```

---

## ✅ 验收标准

- [ ] 执行update-avatar-urls.js脚本成功
- [ ] 数据库中avatar_url已更新为新IP
- [ ] 后端重启后正常运行
- [ ] iOS app能正常加载用户头像
- [ ] 新上传的头像URL包含正确IP
- [ ] 日志中无"Failed to load avatar"错误

---

## 🔗 相关文件

| 文件 | 说明 |
|-----|------|
| `backend/scripts/update-avatar-urls.js` | 更新旧URL脚本 |
| `backend/src/services/storage/LocalFileStorage.js` | URL生成逻辑 |
| `backend/src/services/avatarService.js` | 头像服务 |
| `backend/src/config/urlConfig.js` | URL配置管理 |
| `backend/.env` | 环境变量配置 |
| `FunnyPixelsApp/Views/Components/AvatarView.swift` | iOS头像视图 |

---

## 🎉 修复完成

**推荐方案**: 先执行方案一快速修复，确保功能正常后，再逐步实施方案二的架构优化。

---

**修复人**: Claude AI Assistant
**修复时间**: 2026-02-22
**修改文件**: 1 个脚本
**测试状态**: 待执行
