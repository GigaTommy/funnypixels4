---
name: update-dev-ip
description: Update development environment IP address across all project configurations (Backend, Frontend, Admin Frontend, iOS App). Use when your local network IP changes.
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Bash(node *), Bash(npm *), Bash(sed *), Bash(grep *)
argument-hint: [new-ip-address]
---

# 更新开发环境 IP 地址

自动化更新项目中所有配置文件的开发环境 IP 地址，包括 Backend、Frontend、Admin Frontend 和 iOS App。

## 目标 IP 地址
新 IP: $ARGUMENTS

## 执行流程

### 阶段 1: 验证和准备 (5分钟)

1. **验证 IP 地址格式**
   - 检查参数是否提供
   - 验证 IP 格式是否正确 (xxx.xxx.xxx.xxx)
   - 获取当前配置的 IP 地址

2. **列出将要修改的文件**
   - `.env` (根目录)
   - `backend/.env`
   - `frontend/.env`
   - `admin-frontend/.env`
   - `admin-frontend/vite.config.ts`
   - `app/FunnyPixels/Sources/FunnyPixels/Config/AppConfig.swift`

3. **创建备份**
   - 为所有配置文件创建时间戳备份
   - 备份格式: `filename.backup.TIMESTAMP`

### 阶段 2: 更新配置文件 (10分钟)

#### 1. 更新根目录配置 (.env)

修改以下变量：
```bash
DEV_SERVER_IP=<NEW_IP>
DEV_API_BASE_URL=http://<NEW_IP>:3001
DEV_WEB_BASE_URL=http://<NEW_IP>:3000
DEV_WS_URL=ws://<NEW_IP>:3001
```

#### 2. 运行同步脚本

```bash
# 自动同步到 Backend 和 Frontend
npm run sync-config
# 或
node sync-config.js
```

这会自动更新：
- `backend/.env`: LOCAL_IP, CDN_BASE_URL
- `frontend/.env`: VITE_API_BASE_URL, VITE_WS_URL, VITE_WS_HOST

#### 3. 更新 Admin Frontend

**文件 1: `admin-frontend/.env`**
```bash
VITE_BACKEND_URL=http://<NEW_IP>:3001
```

**文件 2: `admin-frontend/vite.config.ts`**
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_BACKEND_URL || 'http://<NEW_IP>:3001',
    changeOrigin: true,
  },
}
```

**文件 3: `admin-frontend/src/pages/System/PerformanceMonitor.tsx`**
确保 Grafana URL 动态适配：
```typescript
const GRAFANA_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : `http://${window.location.hostname}:3000`
```

#### 4. 更新 iOS App

**文件: `app/FunnyPixels/Sources/FunnyPixels/Config/AppConfig.swift`**
```swift
private static let developmentServerIP = "<NEW_IP>"
```

确保环境切换逻辑存在：
```swift
public static var apiBaseURL: String {
  switch Environment.current {
  case .development:
    return "http://\(developmentServerIP):3001"
  case .production:
    return "https://api.funnypixelsapp.com"
  }
}
```

#### 5. 更新 Backend CORS 配置

确保 CORS_ORIGIN 包含新 IP：
```bash
CORS_ORIGIN=http://localhost:3000,http://<NEW_IP>:3000,http://<NEW_IP>:8000
```

### 阶段 3: 验证和重启 (10分钟)

#### 1. 验证配置文件

检查所有文件是否正确更新：
```bash
# 检查根目录配置
grep "DEV_SERVER_IP" .env

# 检查 backend
grep "LOCAL_IP\|CDN_BASE_URL\|CORS_ORIGIN" backend/.env

# 检查 frontend
grep "VITE_API_BASE_URL\|VITE_WS_URL" frontend/.env

# 检查 admin-frontend
grep "VITE_BACKEND_URL" admin-frontend/.env
grep "target:" admin-frontend/vite.config.ts

# 检查 iOS
grep "developmentServerIP" app/FunnyPixels/Sources/FunnyPixels/Config/AppConfig.swift
```

#### 2. 重启服务

**Docker 服务：**
```bash
docker-compose restart
```

**Backend：**
```bash
cd backend
npm start
# 验证启动日志中的 IP 地址
```

**Frontend：**
```bash
cd frontend
npm run dev
# 验证 Vite 显示的网络地址
```

**Admin Frontend：**
```bash
cd admin-frontend
npm run dev
# 验证 Vite 显示的网络地址
```

**iOS App：**
在 Xcode 中：
1. Clean Build Folder (⇧⌘K)
2. Build (⌘B)
3. Run (⌘R)

#### 3. 测试连接

**测试 Backend API：**
```bash
# 本机测试
curl http://localhost:3001/health

# 新 IP 测试
curl http://<NEW_IP>:3001/health
```

**测试 Frontend：**
```bash
# 浏览器访问
open http://<NEW_IP>:3000
```

**测试 Admin Frontend：**
```bash
# 浏览器访问
open http://<NEW_IP>:8000
```

**测试 CORS：**
```bash
curl -H "Origin: http://<NEW_IP>:3000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://<NEW_IP>:3001/api/auth/me
```

### 阶段 4: 生成报告 (5分钟)

#### 1. 创建更新日志

生成包含以下信息的报告：
- 旧 IP 地址
- 新 IP 地址
- 更新的文件列表
- 备份文件位置
- 服务状态
- 访问地址汇总

#### 2. 访问地址汇总

**本机访问：**
- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Admin Frontend: http://localhost:8000
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090

**局域网访问：**
- Backend: http://<NEW_IP>:3001
- Frontend: http://<NEW_IP>:3000
- Admin Frontend: http://<NEW_IP>:8000
- Grafana: http://<NEW_IP>:3000
- Prometheus: http://<NEW_IP>:9090

**iOS App：**
- Debug 模式自动使用: http://<NEW_IP>:3001
- Release 模式使用: https://api.funnypixelsapp.com

## 错误处理

### 常见问题

1. **同步脚本失败**
   - 检查 Node.js 是否安装
   - 检查文件权限
   - 手动编辑配置文件

2. **服务启动失败**
   - 检查端口是否被占用
   - 检查环境变量是否正确
   - 查看错误日志

3. **CORS 错误**
   - 确认 CORS_ORIGIN 包含新 IP
   - 重启 Backend 服务
   - 清除浏览器缓存

4. **iOS App 无法连接**
   - 确认设备在同一 WiFi
   - 检查防火墙设置
   - 验证 IP 地址是否正确

## 回滚操作

如果更新后出现问题，可以快速回滚：

```bash
# 恢复根目录配置
cp .env.backup.<TIMESTAMP> .env

# 恢复 backend
cp backend/.env.backup.<TIMESTAMP> backend/.env

# 恢复 frontend
cp frontend/.env.backup.<TIMESTAMP> frontend/.env

# 恢复 admin-frontend
cp admin-frontend/.env.backup.<TIMESTAMP> admin-frontend/.env

# 重新运行同步脚本使用旧配置
npm run sync-config

# 重启所有服务
```

## 成功标准

- ✅ 所有配置文件已更新
- ✅ 同步脚本执行成功
- ✅ 所有服务成功重启
- ✅ Backend API 可访问（localhost + 新IP）
- ✅ Frontend 可访问（localhost + 新IP）
- ✅ Admin Frontend 可访问（localhost + 新IP）
- ✅ iOS App 可以连接到新 IP
- ✅ CORS 验证通过
- ✅ WebSocket 连接正常
- ✅ 监控面板可访问
- ✅ 创建了备份文件
- ✅ 生成了更新报告

## 注意事项

1. **确保所有服务已停止**再开始更新
2. **备份文件保留至少7天**以便回滚
3. **更新后立即测试**所有关键功能
4. **通知团队成员**IP 地址变更
5. **更新文档**中的 IP 地址引用
6. **移动设备需要在同一 WiFi**才能访问
7. **防火墙设置**可能需要调整
8. **生产环境不受影响**，只更新开发配置

## 🎯 头像 URL 自动处理（无需手动操作）

### 背景说明

数据库中可能存储了包含旧 IP 的头像 URL，例如：
```
http://192.168.0.3:3001/uploads/materials/avatars/xxx.png
```

### ✅ 自动处理机制

后端已实现 `sanitizeAvatarUrl()` 函数，**自动移除所有 IP 前缀**：

**处理流程：**
```
数据库存储: http://192.168.0.3:3001/uploads/materials/avatars/xxx.png
后端处理:   移除 "http://192.168.0.3:3001"
返回给客户端: /uploads/materials/avatars/xxx.png
iOS/Web 组装: http://192.168.1.15:3001/uploads/materials/avatars/xxx.png ✅
```

**涉及文件：**
- `backend/src/controllers/leaderboardController.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/profileController.js`
- `backend/src/services/privacyService.js`

### 📝 可选：清理数据库中的旧 URL

虽然不是必需的，但如果想清理数据库中的硬编码 URL，可以执行：

```sql
-- 移除头像 URL 中的 IP 前缀（保留相对路径）
UPDATE users
SET avatar_url = REGEXP_REPLACE(avatar_url, '^https?://[^/]+', '')
WHERE avatar_url ~ '^https?://[\d.]+';

-- 验证更新结果
SELECT id, username, avatar_url
FROM users
WHERE avatar_url LIKE '/uploads/materials/avatars/%'
LIMIT 10;
```

**注意：** 这个 SQL 操作是可选的，因为后端已经自动处理了 URL 清理。

## 附加功能

### 快速检查当前 IP

```bash
# 查看根目录配置
grep "DEV_SERVER_IP" .env

# 查看 backend 配置
grep "LOCAL_IP" backend/.env

# 查看 iOS 配置
grep "developmentServerIP" app/FunnyPixels/Sources/FunnyPixels/Config/AppConfig.swift
```

### 批量查找 IP 引用

```bash
# 查找所有硬编码的 IP
grep -r "192\.168\." --include="*.env" --include="*.swift" --include="*.ts" --include="*.js" .
```

### 自动获取当前机器 IP

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# 或使用 Node.js
node -e "require('os').networkInterfaces()['en0'].forEach(i => i.family === 'IPv4' && console.log(i.address))"
```

---

**执行时长预估**: 30-40分钟
**前置要求**: Node.js, npm, Docker, Xcode (for iOS)
**风险等级**: 低（有备份机制）
