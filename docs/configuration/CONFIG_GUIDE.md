# FunnyPixels 开发环境配置指南

当开发环境的 IP 地址变更时，只需修改以下配置文件，**无需修改任何代码文件**。

## 📝 配置文件清单

### 1️⃣ iOS App 配置

**文件**: `FunnyPixelsApp/FunnyPixelsApp/Info.plist`

在 `<dict>` 标签内找到 `AppConfiguration` 部分，修改以下配置：

```xml
<key>AppConfiguration</key>
<dict>
    <key>DevelopmentServerIP</key>
    <string>192.168.0.3</string>  <!-- 修改为新的开发服务器 IP -->

    <key>DevelopmentServerPort</key>
    <string>3001</string>  <!-- 后端端口，通常不需要修改 -->

    <key>DevelopmentFrontendPort</key>
    <string>3000</string>  <!-- 前端端口，通常不需要修改 -->

    <key>ProductionAPIURL</key>
    <string>https://api.funnypixels.com</string>  <!-- 生产环境 URL -->

    <key>ProductionWebURL</key>
    <string>https://funnypixels.com</string>  <!-- 生产环境前端 URL -->
</dict>
```

### 2️⃣ Backend 配置

**文件**: `backend/.env`

修改以下行：

```bash
# CDN基础URL (修改为新的局域网IP)
CDN_BASE_URL=http://192.168.0.3:3001/uploads

# 可选：手动指定局域网IP（推荐设置）
LOCAL_IP=192.168.0.3
```

> **注意**: 如果不设置 `LOCAL_IP`，后端会自动检测局域网 IP（通过 `backend/src/config/urlConfig.js`）

### 3️⃣ Frontend 配置

**文件**: `frontend/.env`

修改以下行（将 `localhost` 替换为新的 IP 地址）：

```bash
# API配置
VITE_API_BASE_URL=http://192.168.0.3:3001
VITE_DOUYIN_API_BASE_URL=http://192.168.0.3:3001
VITE_WS_URL=ws://192.168.0.3:3001
VITE_WS_HOST=192.168.0.3:3001
```

### 4️⃣ Admin Frontend 配置

**文件**: `admin-frontend/.env`

通常使用相对路径，无需修改：

```bash
VITE_API_BASE_URL=/api
```

---

## 🚀 快速批量修改脚本

假设你的新 IP 是 `192.168.1.100`，可以使用以下脚本快速替换：

### macOS/Linux:

```bash
#!/bin/bash

OLD_IP="192.168.0.3"
NEW_IP="192.168.1.100"  # 修改为你的新IP

# 修改 iOS 配置
sed -i '' "s/$OLD_IP/$NEW_IP/g" FunnyPixelsApp/FunnyPixelsApp/Info.plist

# 修改 Backend 配置
sed -i '' "s/$OLD_IP/$NEW_IP/g" backend/.env

# 修改 Frontend 配置
sed -i '' "s/localhost/$NEW_IP/g" frontend/.env
sed -i '' "s/$OLD_IP/$NEW_IP/g" frontend/.env

echo "✅ 配置更新完成！"
echo "新的开发服务器地址: http://$NEW_IP:3001"
```

### Windows (PowerShell):

```powershell
$OLD_IP = "192.168.0.3"
$NEW_IP = "192.168.1.100"  # 修改为你的新IP

# 修改 iOS 配置
(Get-Content FunnyPixelsApp/FunnyPixelsApp/Info.plist) -replace $OLD_IP, $NEW_IP | Set-Content FunnyPixelsApp/FunnyPixelsApp/Info.plist

# 修改 Backend 配置
(Get-Content backend/.env) -replace $OLD_IP, $NEW_IP | Set-Content backend/.env

# 修改 Frontend 配置
(Get-Content frontend/.env) -replace "localhost", $NEW_IP | Set-Content frontend/.env
(Get-Content frontend/.env) -replace $OLD_IP, $NEW_IP | Set-Content frontend/.env

Write-Host "✅ 配置更新完成！"
Write-Host "新的开发服务器地址: http://$NEW_IP:3001"
```

---

## 🔄 修改后需要执行的操作

### 1. 重启 Backend 服务器

```bash
cd backend
npm run dev
```

### 2. 重启 Frontend 开发服务器

```bash
cd frontend
npm run dev
```

### 3. 重新编译 iOS App

在 Xcode 中：
1. 清理构建: **Product > Clean Build Folder** (⇧⌘K)
2. 重新构建: **Product > Build** (⌘B)
3. 运行: **Product > Run** (⌘R)

---

## 📌 验证配置

### 检查 Backend URL 配置

启动 Backend 后，查看日志输出：

```
🌐 URL Configuration:
   Environment: development
   Base URL: http://192.168.1.100:3001
   API Base URL: http://192.168.1.100:3001/api
   CDN Base URL: http://192.168.1.100:3001/uploads
   WebSocket URL: ws://192.168.1.100:3001
   Frontend URL: http://192.168.1.100:3000
```

### 检查 iOS App 配置

在 Xcode 控制台中，App 启动时会输出当前使用的 URL。

---

## ⚠️ 常见问题

### Q1: iOS 真机无法连接开发服务器？

**解决方案**:
1. 确保手机和电脑在同一个 WiFi 网络
2. 检查防火墙设置，允许端口 3000 和 3001
3. 在 iOS 设置中允许 App 访问本地网络

### Q2: 修改配置后 iOS App 仍然使用旧 IP？

**解决方案**:
1. 清理 Xcode 构建缓存: **Product > Clean Build Folder**
2. 删除 App 并重新安装
3. 检查 Info.plist 文件是否正确保存

### Q3: Frontend 显示网络错误？

**解决方案**:
1. 确保修改了 `frontend/.env` 文件
2. 重启 Vite 开发服务器 (`npm run dev`)
3. 清除浏览器缓存或使用无痕模式测试

---

## 🎯 最佳实践

1. **使用版本控制**: 不要将 `.env` 文件提交到 Git
2. **保留模板**: 使用 `.env.example` 作为配置模板
3. **团队协作**: 团队成员各自维护自己的 `.env` 文件
4. **文档更新**: IP 变更后及时更新团队文档

---

## 📚 相关文件说明

### 配置读取逻辑

- **iOS App**: `AppConfig.swift` 和 `Environment.swift` 从 `Info.plist` 读取配置
- **Backend**: `urlConfig.js` 从 `.env` 读取配置，支持自动检测 IP
- **Frontend**: `env.ts` 从 `.env` 读取环境变量

### 为什么不硬编码？

1. ✅ **灵活性**: 无需修改代码即可切换环境
2. ✅ **安全性**: 敏感配置不会被提交到代码库
3. ✅ **可维护性**: 统一管理所有环境配置
4. ✅ **团队协作**: 每个开发者可以使用不同的本地配置

---

**最后更新**: 2026-02-14
**维护者**: FunnyPixels 开发团队
