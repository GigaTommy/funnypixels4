# 开发环境 IP 更新指南

## 🚀 快速使用（推荐）

当您的开发环境 IP 地址变更时，使用 Claude Code skill 一键更新：

```bash
# 启动 Claude Code
cd /Users/ginochow/code/funnypixels3
claude

# 在 Claude 中执行
/update-dev-ip 192.168.1.15
```

**就这么简单！** ✨

---

## 📋 Skill 会自动完成

### 1. 验证和备份
- ✅ 验证 IP 地址格式
- ✅ 显示当前 IP 配置
- ✅ 创建所有配置文件的备份

### 2. 更新配置文件
- ✅ `.env` (根目录)
- ✅ `backend/.env`
- ✅ `frontend/.env`
- ✅ `admin-frontend/.env`
- ✅ `admin-frontend/vite.config.ts`
- ✅ `app/FunnyPixels/Sources/FunnyPixels/Config/AppConfig.swift`

### 3. 验证配置
- ✅ 检查所有文件是否正确更新
- ✅ 验证 CORS 配置
- ✅ 验证 WebSocket URL

### 4. 生成报告
- ✅ 创建详细的更新报告
- ✅ 列出所有修改的文件
- ✅ 提供重启服务的指令
- ✅ 列出新的访问地址

---

## 🔄 执行后的操作

Skill 执行完成后，按照报告中的指令重启服务：

### 1. 重启 Docker 服务
```bash
docker-compose restart
```

### 2. 重启 Backend
```bash
cd backend
npm start
```

### 3. 重启 Frontend
```bash
cd frontend
npm run dev
```

### 4. 重启 Admin Frontend
```bash
cd admin-frontend
npm run dev
```

### 5. 重新编译 iOS App
在 Xcode 中：
- Clean Build Folder: ⇧⌘K
- Build: ⌘B
- Run: ⌘R

---

## 🎯 新的访问地址

Skill 会在报告中列出所有新的访问地址：

### 本机访问
```
Backend:         http://localhost:3001
Frontend:        http://localhost:3000
Admin Frontend:  http://localhost:8000
Grafana:         http://localhost:3000
```

### 局域网访问
```
Backend:         http://192.168.1.15:3001
Frontend:        http://192.168.1.15:3000
Admin Frontend:  http://192.168.1.15:8000
Grafana:         http://192.168.1.15:3000
```

---

## 🎯 头像 URL 自动处理

### 重要说明

数据库中可能存储了包含旧 IP 的头像 URL（如 `http://192.168.0.3:3001/uploads/...`）。

**✅ 无需担心！** 后端已实现自动处理机制：

1. **`sanitizeAvatarUrl()` 函数**自动移除所有 IP 前缀
2. 客户端收到**相对路径**（如 `/uploads/materials/avatars/xxx.png`）
3. 客户端使用**新 IP** 组装完整 URL
4. **无需手动更新数据库**

**涉及文件：**
- `backend/src/controllers/leaderboardController.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/profileController.js`
- `backend/src/services/privacyService.js`

更多详细说明请查看：`.claude/skills/update-dev-ip/SKILL.md`

---

## 💡 手动方法（备选）

如果不使用 skill，可以手动更新：

### 方法 1: 使用同步脚本

```bash
# 1. 编辑根目录 .env
vim .env
# 修改 DEV_SERVER_IP=192.168.1.15

# 2. 运行同步脚本
npm run sync-config

# 3. 手动更新以下文件
vim admin-frontend/.env                           # VITE_BACKEND_URL
vim admin-frontend/vite.config.ts                 # proxy.target
vim app/.../AppConfig.swift                       # developmentServerIP

# 4. 重启所有服务
```

### 方法 2: 使用自动化脚本

如果之前创建了 `scripts/update-dev-ip.sh`：

```bash
./scripts/update-dev-ip.sh 192.168.1.15
```

---

## 📊 对比：Skill vs 手动

| 特性 | 使用 Skill | 手动更新 |
|------|-----------|---------|
| **执行时间** | 5-10分钟 | 20-30分钟 |
| **出错风险** | 极低 | 中等 |
| **文件遗漏** | 不会 | 可能 |
| **自动备份** | ✅ 是 | ❌ 需手动 |
| **验证检查** | ✅ 自动 | ❌ 需手动 |
| **生成报告** | ✅ 是 | ❌ 无 |
| **回滚能力** | ✅ 简单 | ⚠️ 复杂 |
| **学习成本** | ⭐ 低 | ⭐⭐⭐ 高 |

**推荐使用 Skill！** 🎯

---

## 🔧 故障排查

### Skill 执行失败？

1. **检查 Claude Code 版本**
   ```bash
   claude --version
   ```

2. **查看 skill 是否加载**
   ```bash
   claude
   > /help
   # 应该看到 /update-dev-ip
   ```

3. **检查文件权限**
   ```bash
   ls -la .claude/skills/update-dev-ip/
   ```

### 配置更新后服务无法启动？

1. **检查备份文件**
   ```bash
   ls -la *.backup.*
   ls -la backend/.env.backup.*
   ```

2. **回滚配置**
   ```bash
   # 从备份恢复
   cp .env.backup.<timestamp> .env
   cp backend/.env.backup.<timestamp> backend/.env
   # 重新运行同步
   npm run sync-config
   ```

3. **验证 IP 地址**
   ```bash
   # 检查本机 IP
   ipconfig getifaddr en0  # macOS
   hostname -I             # Linux
   ```

### 服务可以访问但 iOS App 无法连接？

1. **检查防火墙**
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   ```

2. **确认设备在同一 WiFi**
   - iOS 设备和开发机必须在同一网络

3. **重新编译 iOS App**
   - Clean Build Folder (⇧⌘K)
   - 重新 Build

---

## 📚 相关文档

- **Skill 详细说明**: `.claude/skills/update-dev-ip/SKILL.md`
- **Skills 总览**: `.claude/skills/README.md`
- **监控配置**: [`MONITORING_QUICKSTART.md`](../monitoring/MONITORING_QUICKSTART.md)
- **项目配置**: `.env`

---

## ✨ Skill 的优势

### 1. 零遗漏
自动识别并更新所有需要修改的配置文件，不会遗漏任何一个。

### 2. 智能验证
自动验证 IP 格式、文件路径、配置正确性。

### 3. 安全备份
每次更新前自动创建带时间戳的备份文件。

### 4. 详细报告
生成完整的更新报告，包括修改清单、访问地址、重启指令。

### 5. 快速回滚
如有问题，可以快速从备份恢复。

### 6. 团队友好
新成员可以快速上手，不需要了解所有配置文件位置。

---

## 🎯 最佳实践

### ✅ 推荐做法

1. **IP 变更后立即更新**
   ```bash
   # 发现 IP 变更
   ipconfig getifaddr en0
   # 立即使用 skill 更新
   /update-dev-ip 192.168.1.15
   ```

2. **定期检查配置一致性**
   ```bash
   # 检查当前配置
   grep "DEV_SERVER_IP" .env
   grep "LOCAL_IP" backend/.env
   ```

3. **保留备份文件7天**
   ```bash
   # 定期清理旧备份（保留最近7天）
   find . -name "*.backup.*" -mtime +7 -delete
   ```

### ⚠️ 注意事项

1. **不要手动编辑同步后的文件**
   - 优先编辑根目录 `.env`
   - 然后使用 skill 或同步脚本更新

2. **iOS 需要重新编译**
   - Swift 代码修改后必须重新编译
   - Debug 和 Release 使用不同的 IP

3. **生产环境不受影响**
   - Skill 只更新开发环境配置
   - 生产配置保持不变

---

**开始使用**: `claude` → `/update-dev-ip <your-new-ip>`

**祝你开发顺利！** 🚀
