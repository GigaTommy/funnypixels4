# 生产环境部署检查清单

本文档提供生产环境部署的完整检查清单，确保所有步骤都已正确执行。

## ✅ 部署前检查

### 系统环境
- [ ] 操作系统为 Ubuntu 20.04+ / CentOS 7+ / macOS
- [ ] 内存至少 4GB（推荐 8GB+）
- [ ] 磁盘可用空间至少 20GB
- [ ] 网络连接稳定

### 软件依赖
- [ ] Docker 20.10.0+ 已安装
- [ ] Docker Compose 2.0.0+ 已安装
- [ ] Node.js 18.0.0+ 已安装
- [ ] Git 2.0.0+ 已安装

### 验证安装
```bash
docker --version        # 应显示 Docker 版本
docker-compose version   # 应显示 Docker Compose 版本
node --version          # 应显示 Node.js 版本
git --version           # 应显示 Git 版本
```

## ✅ 第一步：Docker 环境

### Docker 安装
- [ ] Docker Desktop 已安装（macOS）或 Docker Engine 已安装（Linux）
- [ ] Docker 服务正在运行
- [ ] 可以执行 `docker info` 命令

### 验证 Docker
```bash
docker info              # 应显示 Docker 系统信息
docker ps                # 应显示容器列表（可能为空）
```

## ✅ 第二步：项目配置

### 项目克隆
- [ ] 项目已克隆到服务器
- [ ] 当前在项目根目录
- [ ] 可以访问 `docker-compose.yml` 文件

### 环境变量配置
- [ ] 已复制 `.env.example` 到 `.env`
- [ ] 已修改生产环境必需的配置：
  - [ ] `JWT_SECRET` 已修改为强密码（至少32字符）
  - [ ] `JWT_REFRESH_SECRET` 已修改
  - [ ] `DB_PASSWORD` 已修改
  - [ ] `NODE_ENV` 设置为 `production`
  - [ ] `API_URL` 设置为正确的域名
  - [ ] `FRONTEND_URL` 设置为正确的域名

### 验证配置
```bash
cd backend
cat .env | grep JWT_SECRET     # 应显示你设置的密码
cat .env | grep NODE_ENV       # 应显示 production
```

## ✅ 第三步：启动 Docker 服务

### 服务启动
- [ ] 执行 `./docker-services.sh start`
- [ ] 等待服务启动完成（约10-15秒）
- [ ] 执行 `./docker-services.sh status`

### 验证服务
```bash
docker ps                          # 应显示3个容器运行
docker-compose ps                   # 应显示所有服务为 "Up" 状态
```

**应显示以下容器**:
- [ ] funnypixels_postgres (PostgreSQL)
- [ ] funnypixels_redis (Redis)
- [ ] funnypixels_pgadmin (pgAdmin)

### 服务连接测试
- [ ] PostgreSQL 可连接: `docker-compose exec postgres pg_isready -U postgres`
- [ ] Redis 可连接: `docker-compose exec redis redis-cli ping` (应返回 PONG)

## ✅ 第四步：数据库迁移

### 依赖安装
- [ ] 执行 `cd backend`
- [ ] 执行 `npm install`
- [ ] 依赖安装完成，无错误

### 运行迁移
- [ ] 执行 `npm run migrate`
- [ ] 看到 "Migration completed successfully" 消息
- [ ] 无错误信息

### 验证迁移
```bash
./docker-services.sh psql
\dt                              # 应显示所有表
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
# 应显示表数量 > 50
\q
```

### 核心表检查
- [ ] users 表存在
- [ ] pixels 表存在
- [ ] pixels_history 表存在
- [ ] alliances 表存在
- [ ] sessions 表存在
- [ ] patterns 表存在
- [ ] products 表存在

## ✅ 第五步：种子数据初始化

### 运行种子数据
- [ ] 执行 `npm run seed`
- [ ] 看到 "Seed data completed successfully" 消息
- [ ] 无错误信息

### 验证种子数据
```bash
./docker-services.sh psql

# 验证管理员用户
SELECT username, email, role FROM users WHERE username = 'admin';
# 应显示: admin | admin@funnypixels.com | admin

# 验证测试用户
SELECT COUNT(*) FROM users WHERE username LIKE 'test%';
# 应显示: 10

# 验证联盟
SELECT COUNT(*) FROM alliances;
# 应显示: 5

# 验证图案
SELECT COUNT(*) FROM patterns;
# 应显示: > 50

# 验证商品
SELECT COUNT(*) FROM products;
# 应显示: > 10

\q
```

## ✅ 第六步：数据库备份

### 创建初始备份
- [ ] 执行 `./docker-services.sh backup`
- [ ] 备份文件已创建在 `backups/` 目录
- [ ] 备份文件大小合理（> 1MB）

### 验证备份
```bash
ls -lh backups/
# 应显示类似: funnypixels_backup_20250108_120000.sql
```

## ✅ 第七步：应用启动

### 构建应用
- [ ] 前端已构建: `cd admin-frontend && npm run build`
- [ ] 后端依赖已安装: `cd backend && npm install --production`

### 启动后端
- [ ] 执行 `npm install -g pm2`
- [ ] 执行 `pm2 start npm --name "funnypixels-backend" -- start`
- [ ] 执行 `pm2 status` (应显示 "online")

### 验证应用
```bash
# 健康检查
curl http://localhost:3000/api/health
# 应返回: {"status":"ok",...}

# 数据库连接检查
curl http://localhost:3000/api/health/database
# 应返回: {"status":"connected",...}

# Redis 连接检查
curl http://localhost:3000/api/health/redis
# 应返回: {"status":"connected",...}
```

## ✅ 第八步：Nginx 配置（可选）

如果需要配置域名和 HTTPS：

### Nginx 安装
- [ ] Nginx 已安装
- [ ] 站点配置文件已创建
- [ ] SSL 证书已配置（Let's Encrypt 或自签名）

### 配置验证
```bash
sudo nginx -t                # 测试配置文件
sudo systemctl restart nginx  # 重启 Nginx
sudo systemctl status nginx   # 检查状态（应显示 active）
```

### 域名访问
- [ ] 域名 DNS 已正确指向服务器
- [ ] HTTP 自动重定向到 HTTPS
- [ ] 前端可通过域名访问
- [ ] API 可通过域名访问

## ✅ 第九步：监控和日志

### 日志配置
- [ ] PM2 日志正常记录
- [ ] 应用日志文件已创建
- [ ] Docker 日志可查看

### 监控设置
- [ ] PM2 监控可查看: `pm2 monit`
- [ ] Docker 容器状态正常: `docker stats`
- [ ] 数据库性能正常

### 备份自动化
- [ ] 备份脚本已创建
- [ ] Cron 定时任务已设置
- [ ] 备份文件自动清理（保留7天）

## ✅ 第十步：安全检查

### 密码安全
- [ ] 所有默认密码已修改
- [ ] JWT_SECRET 使用强密码
- [ ] 数据库密码强度足够
- [ ] Redis 密码已设置（可选）

### 防火墙配置
- [ ] 仅开放必要端口（80, 443, 22）
- [ ] 数据库端口不对外暴露
- [ ] Redis 端口不对外暴露

### 环境变量保护
- [ ] `.env` 文件权限正确（600）
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 敏感信息未提交到 Git

## 📊 部署验收测试

### 功能测试
```bash
# 1. 测试管理员登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@funnypixels.com","password":"admin123"}'
# 应返回 JWT token

# 2. 测试数据库连接
./docker-services.sh psql
SELECT COUNT(*) FROM users;
\q

# 3. 测试 Redis 连接
./docker-services.sh redis
SET test "hello"
GET test
exit

# 4. 测试 API 健康检查
curl http://localhost:3000/api/health
```

### 性能测试
- [ ] API 响应时间 < 200ms
- [ ] 数据库查询 < 100ms
- [ ] Redis 响应 < 10ms
- [ ] 内存使用 < 80%

## 📝 部署文档记录

完成部署后，记录以下信息：

### 服务器信息
- 服务器IP: _________________
- 域名: _________________
- 操作系统: _________________
- Docker版本: _________________

### 数据库信息
- 数据库名: funnypixels_postgres
- 用户名: postgres
- 密码: _________________（记录在安全的地方）
- 备份位置: _________________

### 应用信息
- 后端端口: 3000
- 前端端口: 5173
- 管理员邮箱: admin@funnypixels.com
- 管理员密码: _________________（记录在安全的地方）

### 访问地址
- 后端API: _________________
- 前端地址: _________________
- pgAdmin: _________________

## 🔧 故障排查清单

如果部署失败，按以下顺序排查：

### Docker 服务问题
1. [ ] 检查 Docker 是否运行: `docker info`
2. [ ] 检查端口占用: `lsof -i :5432`, `lsof -i :6379`
3. [ ] 查看容器日志: `docker-compose logs postgres`
4. [ ] 重启 Docker 服务

### 数据库连接问题
1. [ ] 验证数据库容器运行: `docker ps | grep postgres`
2. [ ] 测试数据库连接: `docker-compose exec postgres pg_isready -U postgres`
3. [ ] 检查数据库配置: `cat backend/.env | grep DB_`
4. [ ] 验证网络连接: `docker network ls`

### 迁移失败问题
1. [ ] 查看详细日志: `npm run migrate -- --verbose`
2. [ ] 检查表是否已存在: `./docker-services.sh psql \dt`
3. [ ] 手动回滚: `npm run migrate:rollback`
4. [ ] 重置数据库: `npm run db:reset`

### 应用启动问题
1. [ ] 检查依赖安装: `npm list`
2. [ ] 查看应用日志: `pm2 logs funnypixels-backend`
3. [ ] 验证环境变量: `cat backend/.env`
4. [ ] 检查端口占用: `lsof -i :3000`

## 📞 获取帮助

如果以上步骤无法解决问题：

1. 查看详细文档
   - README.md - 项目主文档
   - DOCKER_SETUP.md - Docker 配置详解
   - INSTALL_DOCKER.md - Docker 安装指南

2. 查看日志文件
   - Docker 日志: `./docker-services.sh logs`
   - 应用日志: `pm2 logs funnypixels-backend`
   - 数据库日志: `docker-compose logs postgres`

3. 联系技术支持
   - 提供错误日志
   - 描述问题步骤
   - 提供系统环境信息

---

## ✅ 部署完成确认

当所有以上检查项都已完成，您的生产环境就部署成功了！

### 下一步建议
1. 定期监控服务状态
2. 定期备份数据库
3. 定期更新依赖包
4. 监控系统资源使用
5. 设置告警通知

### 定期维护任务
- 每日: 检查服务状态
- 每周: 检查磁盘空间
- 每月: 更新依赖包
- 每季度: 安全审计
