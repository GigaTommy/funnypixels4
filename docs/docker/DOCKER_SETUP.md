# FunnyPixels Docker 环境配置指南

本文档介绍如何使用 Docker 启动和管理 FunnyPixels 项目所需的服务（PostgreSQL + PostGIS、Redis、pgAdmin）。

## 📦 服务说明

### PostgreSQL + PostGIS
- **版本**: PostgreSQL 15 + PostGIS 3.3
- **端口**: 5432
- **数据库**: funnypixels_postgres
- **用户名**: postgres
- **密码**: password
- **功能**: 主数据库，支持地理空间数据

### Redis
- **版本**: Redis 7
- **端口**: 6379
- **无密码**
- **功能**: 缓存和会话存储

### pgAdmin
- **版本**: Latest
- **端口**: 5050
- **访问地址**: http://localhost:5050
- **邮箱**: admin@funnypixels.com
- **密码**: admin123
- **功能**: PostgreSQL 数据库可视化管理工具

## 🚀 快速开始

### 1. 启动所有服务

使用提供的管理脚本：

```bash
./docker-services.sh start
```

或使用 docker-compose：

```bash
docker-compose up -d
```

### 2. 查看服务状态

```bash
./docker-services.sh status
```

### 3. 查看服务日志

```bash
./docker-services.sh logs
```

## 🛠️ 管理命令

### 使用管理脚本

```bash
# 启动服务
./docker-services.sh start

# 停止服务
./docker-services.sh stop

# 重启服务
./docker-services.sh restart

# 查看状态
./docker-services.sh status

# 查看日志
./docker-services.sh logs

# 备份数据库
./docker-services.sh backup

# 恢复数据库
./docker-services.sh restore <backup_file>

# 进入 PostgreSQL 命令行
./docker-services.sh psql

# 进入 Redis 命令行
./docker-services.sh redis

# 清理所有数据（危险操作！）
./docker-services.sh clean

# 显示帮助
./docker-services.sh help
```

### 使用 Docker Compose 命令

```bash
# 启动所有服务
docker-compose up -d

# 启动特定服务
docker-compose up -d postgres
docker-compose up -d redis
docker-compose up -d pgadmin

# 停止所有服务
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器、网络和卷（会删除数据！）
docker-compose down -v

# 查看日志
docker-compose logs -f

# 查看特定服务的日志
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f pgadmin
```

## 📊 服务访问

### PostgreSQL 连接

**命令行访问**:
```bash
# 使用脚本
./docker-services.sh psql

# 或直接使用 docker
docker-compose exec postgres psql -U postgres funnypixels_postgres
```

**外部工具连接**:
- Host: localhost
- Port: 5432
- Database: funnypixels_postgres
- Username: postgres
- Password: password

**支持的应用**:
- pgAdmin: http://localhost:5050
- TablePlus、DBeaver 等数据库工具

### Redis 连接

**命令行访问**:
```bash
# 使用脚本
./docker-services.sh redis

# 或直接使用 docker
docker-compose exec redis redis-cli
```

**外部工具连接**:
- Host: localhost
- Port: 6379
- 无密码

**支持的应用**:
- RedisInsight
- Another Redis Desktop Manager

### pgAdmin 访问

1. 打开浏览器访问: http://localhost:5050
2. 使用以下凭据登录：
   - Email: admin@funnypixels.com
   - Password: admin123
3. 左侧服务器列表会自动显示 "FunnyPixels PostgreSQL" 服务器
4. 输入密码: password
5. 即可浏览和管理数据库

## 💾 数据备份与恢复

### 自动备份

创建备份脚本 `backup.sh`:

```bash
#!/bin/bash
./docker-services.sh backup
```

设置定时任务（每天凌晨2点备份）:
```bash
# 编辑 crontab
crontab -e

# 添加以下行
0 2 * * * /path/to/funnypixels3/backup.sh
```

### 手动备份

```bash
# 备份到默认位置
./docker-services.sh backup

# 备份文件会保存在 backups/ 目录
# 文件名格式: funnypixels_backup_YYYYMMDD_HHMMSS.sql
```

### 恢复数据

```bash
# 查看可用备份
ls -lt backups/

# 恢复指定备份
./docker-services.sh restore funnypixels_backup_20250108_120000.sql
```

### 导出/导入数据

**导出数据**:
```bash
# 导出整个数据库
docker-compose exec postgres pg_dump -U postgres funnypixels_postgres > backup.sql

# 导出特定表
docker-compose exec postgres pg_dump -U postgres funnypixels_postgres -t table_name > table_backup.sql

# 导出数据（不含结构）
docker-compose exec postgres pg_dump -U postgres funnypixels_postgres --data-only > data_only.sql
```

**导入数据**:
```bash
# 导入数据
docker-compose exec -T postgres psql -U postgres funnypixels_postgres < backup.sql
```

## 🔍 常见问题

### 1. 端口冲突

如果端口已被占用，修改 `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # 使用 5433 端口

  redis:
    ports:
      - "6380:6379"  # 使用 6380 端口

  pgadmin:
    ports:
      - "5051:80"    # 使用 5051 端口
```

### 2. 数据持久化

数据存储在 Docker 卷中，即使容器删除也不会丢失：

```bash
# 查看卷
docker volume ls | grep funnypixels

# 备份卷
docker run --rm -v funnypixels_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/postgres_backup.tar.gz /data

# 恢复卷
docker run --rm -v funnypixels_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/postgres_backup.tar.gz -C /
```

### 3. 内存不足

如果遇到内存问题，可以在 `docker-compose.yml` 中限制资源：

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  redis:
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
```

### 4. PostGIS 功能不可用

如果 PostGIS 功能不可用，在 PostgreSQL 中启用：

```sql
-- 连接到数据库
\c funnypixels_postgres

-- 启用 PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 验证安装
SELECT PostGIS_Version();
```

### 5. 清理和重建

完全清理并重建环境：

```bash
# 停止并删除所有容器、网络和卷
docker-compose down -v

# 重新启动
./docker-services.sh start

# 运行迁移
cd backend
npm run migrate
```

## 🔧 高级配置

### 修改 PostgreSQL 配置

创建自定义配置文件 `config/postgresql.conf`:

```conf
# 内存配置
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB

# 连接配置
max_connections = 200

# 日志配置
log_statement = 'mod'
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

在 `docker-compose.yml` 中挂载：

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### 修改 Redis 配置

创建自定义配置文件 `config/redis.conf`:

```conf
# 内存配置
maxmemory 256mb
maxmemory-policy allkeys-lru

# 持久化
save 900 1
save 300 10
save 60 10000

# 日志
loglevel notice
```

在 `docker-compose.yml` 中挂载：

```yaml
services:
  redis:
    volumes:
      - redis_data:/data
      - ./config/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
```

### 开发环境配置

修改 `.env.local` 文件以匹配 Docker 服务：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=funnypixels_postgres
DB_USER=postgres
DB_PASSWORD=password

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 本地验证模式
LOCAL_VALIDATION=true
```

## 📚 参考资料

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [PostGIS 官方文档](https://postgis.net/documentation/)
- [Redis 官方文档](https://redis.io/documentation)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [pgAdmin 文档](https://www.pgadmin.org/docs/)

## 🆘 获取帮助

如果遇到问题：

1. 查看服务日志: `./docker-services.sh logs`
2. 检查服务状态: `./docker-services.sh status`
3. 查看 Docker 日志: `docker-compose logs <service_name>`
4. 重启服务: `./docker-services.sh restart`
5. 完全重建: `./docker-services.sh clean && ./docker-services.sh start`
