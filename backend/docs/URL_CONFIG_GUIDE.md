# URL 配置指南

## 概述

新的 URL 配置系统能够根据环境（开发/生产）自动适配所有 URL，无需手动硬编码。

## 特性

✅ **自动环境检测** - 根据 `NODE_ENV` 自动切换开发/生产配置
✅ **智能IP检测** - 开发环境自动检测局域网IP，支持手机访问
✅ **统一管理** - 所有URL配置集中在 `src/config/urlConfig.js`
✅ **零配置开发** - 开发环境无需配置，自动工作
✅ **灵活覆盖** - 生产环境可通过环境变量完全控制

## 开发环境使用

### 零配置（推荐）

无需任何配置，系统会自动：
1. 检测局域网IP（如 `192.168.0.3`）
2. 生成 BASE_URL: `http://192.168.0.3:3001`
3. 生成 API_BASE_URL: `http://192.168.0.3:3001/api`
4. 生成 CDN_BASE_URL: `http://192.168.0.3:3001/uploads`

### 手动指定IP（可选）

如果自动检测的IP不正确，可以在 `.env` 中指定：

```bash
LOCAL_IP=192.168.0.3
```

### 查看当前配置

启动服务器时，会在控制台显示：

```
🌐 URL Configuration:
   Environment: development
   Base URL: http://192.168.0.3:3001
   API Base URL: http://192.168.0.3:3001/api
   CDN Base URL: http://192.168.0.3:3001/uploads
   WebSocket URL: ws://192.168.0.3:3001
   Frontend URL: http://192.168.0.3:3000
```

## 生产环境使用

### 方法1：环境变量（推荐）

在服务器或容器平台（如 Vercel、Railway、Fly.io）设置环境变量：

```bash
NODE_ENV=production
BASE_URL=https://api.funnypixels.com
FRONTEND_URL=https://funnypixels.com
CDN_BASE_URL=https://cdn.funnypixels.com/uploads
WS_URL=wss://api.funnypixels.com
```

### 方法2：.env.production 文件

复制模板并修改：

```bash
cp .env.production.example .env.production
# 编辑 .env.production 填入实际配置
```

### Vercel 配置示例

在 Vercel Dashboard → Project → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://api.funnypixels.com` |
| `FRONTEND_URL` | `https://funnypixels.com` |
| `CDN_BASE_URL` | `https://cdn.funnypixels.com/uploads` |

### Railway 配置示例

在 Railway Dashboard → Variables:

```
NODE_ENV=production
BASE_URL=https://api.funnypixels.com
FRONTEND_URL=https://funnypixels.com
```

## 代码中使用

### 基础用法

```javascript
const { getBaseURL, getCDNBaseURL, getAPIURL } = require('./config/urlConfig');

// 获取基础URL
const baseURL = getBaseURL();
// 开发: http://192.168.0.3:3001
// 生产: https://api.funnypixels.com

// 获取CDN URL
const cdnURL = getCDNBaseURL();
// 开发: http://192.168.0.3:3001/uploads
// 生产: https://cdn.funnypixels.com/uploads

// 生成完整API URL
const apiURL = getAPIURL('/users/profile');
// 开发: http://192.168.0.3:3001/api/users/profile
// 生产: https://api.funnypixels.com/api/users/profile
```

### 高级用法

```javascript
const { urlConfig } = require('./config/urlConfig');

// 生成上传文件的完整URL
const imageURL = urlConfig.getUploadURL('/materials/avatars/a7/9a/avatar_xxx.png');
// 开发: http://192.168.0.3:3001/uploads/materials/avatars/a7/9a/avatar_xxx.png
// 生产: https://cdn.funnypixels.com/uploads/materials/avatars/a7/9a/avatar_xxx.png

// 生成分享链接
const shareURL = urlConfig.getShareURL('/pixels/abc123');
// 开发: http://192.168.0.3:3000/pixels/abc123
// 生产: https://funnypixels.com/pixels/abc123

// 获取完整配置对象
const config = urlConfig.getConfig();
console.log(config);
/*
{
  env: 'development',
  isDevelopment: true,
  isProduction: false,
  host: '0.0.0.0',
  port: 3001,
  baseURL: 'http://192.168.0.3:3001',
  apiBaseURL: 'http://192.168.0.3:3001/api',
  cdnBaseURL: 'http://192.168.0.3:3001/uploads',
  wsURL: 'ws://192.168.0.3:3001',
  frontendURL: 'http://192.168.0.3:3000'
}
*/
```

## 迁移指南

### 从硬编码URL迁移

**之前（不推荐）：**
```javascript
const baseUrl = process.env.BASE_URL || 'http://192.168.0.3:3001';
const avatarUrl = `${baseUrl}/uploads/avatars/avatar.png`;
```

**现在（推荐）：**
```javascript
const { getUploadURL } = require('./config/urlConfig');
const avatarUrl = getUploadURL('/materials/avatars/avatar.png');
```

### 从 .env 硬编码迁移

**之前（.env）：**
```bash
BASE_URL=http://192.168.0.3:3001  # ❌ 硬编码，换设备需要修改
```

**现在（.env）：**
```bash
# ✅ 无需配置，自动检测局域网IP
# 或者手动指定（可选）
LOCAL_IP=192.168.0.3
```

## 常见问题

### Q: 为什么开发环境不需要配置 BASE_URL？
A: 系统会自动检测局域网IP并生成URL，无需手动配置。

### Q: 如果自动检测的IP不对怎么办？
A: 在 `.env` 中设置 `LOCAL_IP=你的IP地址`。

### Q: 生产环境必须设置 BASE_URL 吗？
A: 强烈推荐设置。如果不设置，会使用默认值 `https://api.funnypixels.com`。

### Q: 可以在中控台动态修改URL吗？
A: 可以！在服务器平台（如Vercel）的环境变量设置中修改后，重新部署即可生效。

### Q: 头像URL还是 192.168.0.3 怎么办？
A: 确保已重启后端服务以加载新配置：
```bash
npm restart
```

## 技术细节

### 自动IP检测逻辑

1. 优先使用 `LOCAL_IP` 环境变量
2. 扫描网络接口，查找局域网IP（`192.168.x.x` 或 `10.x.x.x`）
3. 如果找不到，回退到 `localhost`

### URL优先级

**开发环境：**
1. 环境变量 `BASE_URL`（如果设置）
2. 自动生成：`http://{局域网IP}:{PORT}`

**生产环境：**
1. 环境变量 `BASE_URL`（必须）
2. 默认值：`https://api.funnypixels.com`

## 相关文件

- `backend/src/config/urlConfig.js` - URL配置核心逻辑
- `backend/src/services/storage/LocalFileStorage.js` - 使用示例
- `backend/.env.production.example` - 生产环境配置模板

## 参考

前端也有类似的自动配置系统：
- `FunnyPixelsApp/FunnyPixelsApp/Config/AppConfig.swift`

```swift
// iOS端自动适配
public static var apiBaseURL: String {
    isDebugMode ? "http://192.168.0.3:3001/api" : "https://api.funnypixels.com/api"
}
```

现在后端也实现了相同的智能配置机制！
