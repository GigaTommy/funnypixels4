# 生产环境部署修复指南

## 🚨 当前问题

排行榜API仍然返回HTML错误：
```
加载排行榜失败: Error: 服务器返回了非JSON响应: text/html; charset=utf-8
```

## 🔍 问题诊断结果

✅ **数据库表结构正常**：
- `leaderboard_personal` 表存在，有12条记录
- `leaderboard_alliance` 表存在，有10条记录
- 数据库查询测试通过

✅ **代码已修复**：
- Leaderboard模型已更新使用新表
- 移除了对旧`leaderboards`表的所有引用
- 本地测试完全通过

❌ **部署未生效**：
- 生产环境应用服务器仍在使用旧代码
- 需要重新部署和重启服务器

## 🚀 解决方案

### 方案1：重启应用服务器（推荐）

如果代码已经部署但服务器未重启：

```bash
# 1. 重启Node.js应用
pm2 restart all
# 或者
systemctl restart your-app-service
# 或者
docker-compose restart backend

# 2. 清除可能的负载均衡器缓存
# （如果使用nginx等反向代理）
nginx -s reload
```

### 方案2：重新部署代码

如果代码修复未部署到生产环境：

```bash
# 1. 确保最新代码已推送到代码仓库
git add .
git commit -m "fix: 修复排行榜API使用正确的数据库表"
git push origin main

# 2. 在生产服务器上更新代码
git pull origin main

# 3. 重新安装依赖（如果有变化）
npm install

# 4. 重启应用
pm2 restart all
```

### 方案3：Docker部署

如果使用Docker：

```bash
# 1. 重新构建镜像
docker build -t your-app:latest .

# 2. 重启容器
docker-compose down
docker-compose up -d

# 或者
docker restart backend-container-name
```

## 🧪 验证修复

部署后运行以下验证：

### 1. 检查应用日志
```bash
# 查看应用启动日志
pm2 logs your-app
# 或者
docker logs backend-container

# 确认没有数据库错误
```

### 2. 测试API端点
```bash
# 测试排行榜API
curl -X GET "https://your-domain/api/social/leaderboard?type=user&period=daily" \
  -H "Authorization: Bearer your-token"

# 应该返回JSON而不是HTML
```

### 3. 运行远程诊断
```bash
# 在服务器上运行诊断脚本
node scripts/diagnose-leaderboard-api.js
```

## 📋 部署检查清单

- [ ] **代码已推送**：最新修复已在代码仓库
- [ ] **服务器代码更新**：生产服务器拉取了最新代码
- [ ] **依赖已安装**：npm install 执行无错误
- [ ] **应用已重启**：Node.js进程重新启动
- [ ] **数据库连接正常**：应用能连接到数据库
- [ ] **API测试通过**：排行榜API返回JSON数据
- [ ] **前端错误消失**：浏览器控制台无排行榜错误

## 🔧 常见问题排查

### 问题1：API仍然返回HTML
**可能原因**：
- 代码未更新到生产环境
- 应用服务器未重启
- 负载均衡器缓存旧响应

**解决方案**：
1. 确认代码版本：`git log -1`
2. 强制重启：`pm2 kill && pm2 start ecosystem.config.js`
3. 清除缓存：重启nginx/apache

### 问题2：数据库连接错误
**可能原因**：
- 数据库配置错误
- 网络连接问题
- 权限问题

**解决方案**：
1. 检查数据库配置文件
2. 测试数据库连接：`node scripts/check-db-connection.js`
3. 检查防火墙设置

### 问题3：内存或性能问题
**可能原因**：
- 代码中的内存泄漏
- 数据库查询性能问题

**解决方案**：
1. 监控内存使用：`pm2 monit`
2. 检查慢查询日志
3. 优化数据库索引

## 🎯 验证成功标志

修复成功后应该看到：

1. **前端正常**：
   - 排行榜页面正常加载
   - 不再有"服务器返回了非JSON响应"错误
   - 显示用户和联盟排行榜数据

2. **API正常**：
   - `/api/social/leaderboard` 返回JSON格式数据
   - 包含用户排名、像素数量等信息
   - 响应时间正常（< 1秒）

3. **日志正常**：
   - 应用日志没有数据库错误
   - 没有"table does not exist"错误
   - API访问日志显示200状态码

## 📞 应急联系

如果问题持续存在：

1. **立即回滚**：恢复到上一个稳定版本
2. **数据库备份**：确保数据安全
3. **详细日志**：收集完整的错误日志
4. **逐步调试**：使用诊断脚本逐一排查

## 🔄 后续监控

建议设置：
1. **健康检查**：定期检查API状态
2. **日志监控**：监控错误日志
3. **性能监控**：跟踪响应时间
4. **自动重启**：配置自动故障恢复