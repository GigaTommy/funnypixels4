# 📋 FunnyPixels 配置同步系统

## 🎯 概述

统一的配置管理系统，从根目录 `.env` 自动同步配置到所有客户端（iOS、Backend、Frontend）。

**核心原则：** 一处修改，全局生效 ✨

## 📁 配置文件结构

```
funnypixels3/
├── .env                                    # 🌟 主配置文件（修改这里）
├── sync-config.js                          # 同步脚本
├── sync-config.sh                          # Shell 包装器
├── FunnyPixelsApp/
│   └── FunnyPixelsApp/
│       └── Info.plist                      # iOS 配置（自动同步）
├── backend/
│   └── .env                                # Backend 配置（自动同步）
└── frontend/
    └── .env                                # Frontend 配置（自动同步）
```

## 🔧 配置项说明

### 根目录 `.env` 配置

```bash
# ==========================================
# 🌍 环境配置 (Environment Configuration)
# ==========================================

# 开发环境 (Development)
DEV_SERVER_IP=192.168.0.3           # 局域网 IP 地址
DEV_SERVER_PORT=3001                # 后端服务端口
DEV_FRONTEND_PORT=3000              # 前端服务端口
DEV_API_BASE_URL=http://192.168.0.3:3001
DEV_WEB_BASE_URL=http://192.168.0.3:3000
DEV_WS_URL=ws://192.168.0.3:3001

# 生产环境 (Production)
PROD_API_BASE_URL=https://api.funnypixelsapp.com
PROD_WEB_BASE_URL=https://funnypixelsapp.com
PROD_WS_URL=wss://api.funnypixelsapp.com
```

## 🚀 使用方法

### 方法 1: 使用 npm (推荐)

```bash
npm run sync-config
```

### 方法 2: 使用 Shell 脚本

```bash
./sync-config.sh
```

### 方法 3: 直接运行 Node.js

```bash
node sync-config.js
```

## 📝 修改配置流程

### 1. 修改开发环境 IP

```bash
# 1. 编辑根目录 .env
nano .env

# 2. 修改 DEV_SERVER_IP（例如：192.168.0.3 → 192.168.1.100）
DEV_SERVER_IP=192.168.1.100

# 3. 运行同步脚本
npm run sync-config

# 4. 重启服务
npm run dev:backend    # 重启后端
npm run dev:frontend   # 重启前端
# iOS: 在 Xcode 中 Clean Build (⇧⌘K) 然后重新编译
```

### 2. 修改生产环境域名

```bash
# 1. 编辑根目录 .env
nano .env

# 2. 修改生产环境配置
PROD_API_BASE_URL=https://api.yourdomain.com
PROD_WEB_BASE_URL=https://yourdomain.com

# 3. 运行同步脚本
npm run sync-config

# 4. 重新构建生产版本
npm run build
```

## 🔄 自动同步的配置

### iOS App (Info.plist)
- `DevelopmentServerIP`
- `DevelopmentServerPort`
- `DevelopmentFrontendPort`
- `ProductionAPIURL`
- `ProductionWebURL`

### Backend (.env)
- `LOCAL_IP`
- `CDN_BASE_URL`

### Frontend (.env)
- `VITE_API_BASE_URL`
- `VITE_DOUYIN_API_BASE_URL`
- `VITE_WS_URL`
- `VITE_WS_HOST`

## 💾 备份机制

每次同步前，脚本会自动备份所有被修改的配置文件：

```
Info.plist.backup.1771226671462
backend/.env.backup.1771226671463
frontend/.env.backup.1771226671464
```

如需恢复，只需将备份文件复制回原位置即可。

## 🛡️ 安全建议

1. **不要将 `.env` 提交到 Git**
   - 根目录 `.env` 应该在 `.gitignore` 中
   - 提供 `.env.example` 作为模板

2. **生产环境配置**
   - 生产环境使用环境变量或密钥管理服务
   - 不要在代码中硬编码敏感信息

3. **开发环境隔离**
   - 每个开发者的 IP 可能不同
   - 不要共享包含个人 IP 的配置文件

## 📚 常见问题

### Q: 同步后 iOS 还是使用旧配置？
**A:** 需要在 Xcode 中执行 Clean Build:
1. Product → Clean Build Folder (⇧⌘K)
2. Product → Build (⌘B)
3. 重新运行应用

### Q: 可以只同步特定客户端吗？
**A:** 目前脚本会同步所有客户端。如需单独同步，可以手动编辑对应的配置文件。

### Q: 如何查看当前配置？
**A:** 运行同步脚本会显示当前配置：
```bash
npm run sync-config
```

### Q: 配置同步失败怎么办？
**A:** 检查：
1. 根目录 `.env` 文件是否存在
2. 必需的配置项是否都已设置
3. 各个客户端的配置文件是否存在
4. 查看错误信息并根据提示修复

## 🔗 相关文档

- [Backend 配置说明](backend/README.md)
- [Frontend 配置说明](frontend/README.md)
- [iOS 开发指南](FunnyPixelsApp/README.md)

## 📞 支持

如有问题，请查看项目文档或联系开发团队。

---

**最后更新：** 2026-02-15
**维护者：** FunnyPixels Team
