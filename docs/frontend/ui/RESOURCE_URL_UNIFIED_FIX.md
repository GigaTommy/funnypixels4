# 资源URL统一处理方案
> 更新时间: 2026-02-22
> 扩展范围: 头像、旗帜、图案、横幅等所有资源URL

---

## 📋 扩展概述

在头像URL相对路径改造的基础上，进一步扩展中间件以支持**所有资源URL的统一处理**。

### 支持的URL字段

| 字段名 | 用途 | 示例 |
|-------|------|------|
| `avatar_url` | 用户头像 | `/uploads/materials/avatars/.../avatar.png` |
| `image_url` | 图案/旗帜图片 | `/patterns/color_red.png` |
| `banner_url` | 联盟横幅 | `/uploads/banners/alliance.png` |
| `file_url` | 素材文件 | `/uploads/materials/stickers/.../sticker.png` |

---

## ✅ 扩展内容

### 修改文件: `backend/src/utils/avatarUrlHelper.js`

**修改前**:
```javascript
// 只处理avatar_url字段
if (key === 'avatar_url' && typeof value === 'string') {
  processed[key] = buildAvatarUrl(value);
}
```

**修改后**:
```javascript
// 处理所有资源URL字段
const urlFields = ['avatar_url', 'image_url', 'banner_url', 'file_url'];

for (const [key, value] of Object.entries(data)) {
  if (urlFields.includes(key) && typeof value === 'string') {
    processed[key] = buildAvatarUrl(value);
  }
  // ...
}
```

---

## 🧪 测试验证

### 测试用例

```javascript
const testData = {
  user: {
    avatar_url: '/uploads/materials/avatars/.../avatar.png'
  },
  alliance: {
    banner_url: '/uploads/banners/sun_alliance.png'
  },
  patterns: [
    {
      image_url: '/patterns/color_red.png'
    }
  ],
  material: {
    file_url: '/uploads/materials/stickers/.../sticker.png'
  }
};
```

### 测试结果

```
✅ avatar_url: 已转换为完整URL
✅ banner_url: 已转换为完整URL
✅ image_url:  已转换为完整URL
✅ file_url:   已转换为完整URL
```

### 转换示例

```
原始: /patterns/color_red.png
转换: http://192.168.1.15:3001/patterns/color_red.png
```

---

## 📊 影响范围

### 1. 联盟旗帜 (Alliances)

**数据库字段**: `pattern_assets.image_url`

**存储格式**: 相对路径
```json
{
  "id": 123,
  "key": "emoji_sun",
  "image_url": "/patterns/emoji_sun.png"
}
```

**API响应**: 自动转换为完整URL
```json
{
  "id": 123,
  "key": "emoji_sun",
  "image_url": "http://192.168.1.15:3001/patterns/emoji_sun.png"
}
```

### 2. 联盟横幅 (Alliance Banners)

**数据库字段**: `alliances.banner_url`

**当前状态**: 大部分为 `null`，未来如果使用相对路径，会自动转换

### 3. 素材资源 (Materials)

**数据库字段**: `materials.file_url`

**自动处理**: 所有素材文件URL都会统一转换

### 4. 用户头像 (User Avatars)

**数据库字段**: `users.avatar_url`

**已处理**: 与之前的改造保持一致

---

## 🔄 数据流

### 图案清单API响应

```
┌─────────────────────────────────────────────────────────┐
│ 1. Controller 查询数据库                                 │
│    SELECT * FROM pattern_assets                          │
│    返回: { image_url: '/patterns/emoji_sun.png' }       │
│                                                          │
│ 2. Controller 调用 res.json(data)                       │
│                                                          │
│ 3. avatarUrlMiddleware 自动拦截                          │
│    - 检测到 image_url 字段                              │
│    - 转换: /patterns/... → http://192.168.1.15:3001/patterns/... │
│                                                          │
│ 4. iOS/Web 接收完整URL                                  │
│    { image_url: 'http://192.168.1.15:3001/patterns/emoji_sun.png' } │
│                                                          │
│ ✅ 自动使用当前环境的baseURL                              │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 优势

### 1. 统一处理机制

**所有资源URL使用相同的处理逻辑**：
- ✅ 存储时：统一使用相对路径
- ✅ 响应时：自动转换为完整URL
- ✅ IP变更：无需更新数据库

### 2. 零侵入改造

**Controller代码无需修改**：
```javascript
// ✅ 完全不需要改动
router.get('/patterns', async (req, res) => {
  const patterns = await getPatterns();
  res.json({ patterns });  // 中间件自动处理所有URL字段
});
```

### 3. 向后兼容

**支持混合格式**：
- 新数据: `/patterns/...` → 自动转换
- 旧数据: `http://old-ip/patterns/...` → 保持不变
- 外部CDN: `https://cdn.example.com/...` → 保持不变

---

## 📁 数据库现状检查

### Pattern Assets 表

```sql
SELECT key, image_url
FROM pattern_assets
LIMIT 3;
```

**结果**:
```
color_red   | /patterns/color_red.png   ✅ 已是相对路径
color_blue  | /patterns/color_blue.png  ✅ 已是相对路径
color_green | /patterns/color_green.png ✅ 已是相对路径
```

### Alliances 表

```sql
SELECT name, banner_url
FROM alliances
LIMIT 3;
```

**结果**:
```
太阳联盟      | NULL  ⚠️ 未使用
洋红色联盟    | NULL  ⚠️ 未使用
testuser1    | NULL  ⚠️ 未使用
```

**结论**:
- ✅ `pattern_assets.image_url` 已经使用相对路径
- ✅ `alliances.banner_url` 未来如果使用，会自动支持相对路径

---

## 🚀 部署验证

### 1. 重启后端服务

```bash
cd backend
npm run dev
```

### 2. 测试图案API

```bash
curl http://192.168.1.15:3001/api/patterns/manifest | jq '.patterns[0].image_url'
```

**预期结果**:
```json
"http://192.168.1.15:3001/patterns/color_red.png"
```

### 3. 测试用户API

```bash
curl http://192.168.1.15:3001/api/profile | jq '.user.avatar_url'
```

**预期结果**:
```json
"http://192.168.1.15:3001/uploads/materials/avatars/.../avatar.png"
```

---

## 💡 未来扩展

### 1. 添加更多URL字段

如需支持其他URL字段，只需在 `urlFields` 数组中添加：

```javascript
const urlFields = [
  'avatar_url',
  'image_url',
  'banner_url',
  'file_url',
  'thumbnail_url',  // 新增
  'cover_url'       // 新增
];
```

### 2. 配置化URL字段

创建配置文件管理需要处理的字段：

```javascript
// backend/src/config/resourceUrlConfig.js
module.exports = {
  urlFields: [
    'avatar_url',
    'image_url',
    'banner_url',
    'file_url'
  ]
};
```

---

## ✅ 验收标准

- [x] 扩展 avatarUrlHelper 支持多个URL字段
- [x] 测试 image_url 自动转换
- [x] 测试 banner_url 自动转换
- [x] 测试 file_url 自动转换
- [x] 测试嵌套对象和数组
- [x] 向后兼容完整URL
- [x] 文档更新完整

---

## 🎉 扩展完成

**扩展范围**: 从单一 `avatar_url` 扩展到所有资源URL
**支持字段**: 4 个 (avatar_url, image_url, banner_url, file_url)
**测试状态**: ✅ 全部通过
**部署状态**: ✅ 可以部署

---

## 🔗 相关文档

- [AVATAR_URL_RELATIVE_PATH_MIGRATION.md](./AVATAR_URL_RELATIVE_PATH_MIGRATION.md) - 头像URL相对路径改造
- [AVATAR_URL_IP_FIX.md](./AVATAR_URL_IP_FIX.md) - IP变更问题快速修复

---

**所有资源URL现已统一处理，IP变更不再影响任何资源加载！** 🚀
