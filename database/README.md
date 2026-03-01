# 数据库模块 (Database)

PostgreSQL主数据库和Redis缓存数据库的配置、迁移和种子数据。

## 技术栈

- **PostgreSQL** - 主数据库（用户数据、像素数据、地理数据）
- **Redis** - 缓存数据库（会话、实时状态、队列）
- **PostGIS** - 地理空间扩展
- **Knex.js** - 数据库查询构建器
- **Redis** - 内存数据库

## 目录结构

```
database/
├── migrations/             # 数据库迁移文件
├── seeds/                  # 种子数据文件
├── schemas/                # 数据库模式定义
├── scripts/                # 数据库脚本
├── docker-compose.yml      # 数据库服务编排
└── README.md               # 说明文档
```

## 数据库设计

### PostgreSQL 主数据库

#### 核心表结构

**users 表** - 用户信息
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  points INTEGER DEFAULT 64,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**pixels 表** - 像素数据
```sql
CREATE TABLE pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(50) NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  color VARCHAR(7) NOT NULL,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**grids 表** - 网格信息
```sql
CREATE TABLE grids (
  id VARCHAR(50) PRIMARY KEY,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  bounds_lat_min DECIMAL(10, 8) NOT NULL,
  bounds_lat_max DECIMAL(10, 8) NOT NULL,
  bounds_lng_min DECIMAL(11, 8) NOT NULL,
  bounds_lng_max DECIMAL(11, 8) NOT NULL,
  pixel_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

**sessions 表** - 用户会话
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**audit_logs 表** - 审计日志
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Redis 缓存数据库

#### 键值结构

**用户会话**
```
session:{session_id} -> {user_id, expires_at, data}
```

**实时状态**
```
user:{user_id}:status -> {online, last_seen, current_position}
```

**像素缓存**
```
pixel:{grid_id} -> {pixel_data}
grid:{bounds} -> [grid_ids]
```

**队列任务**
```
queue:pixel_processing -> [job_data]
queue:user_activity -> [job_data]
```

## 开发指南

### 启动数据库服务
```bash
# 使用Docker Compose
docker-compose up -d postgres redis

# 或分别启动
docker run -d --name postgres -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7
```

### 运行迁移
```bash
npm run migrate
```

### 运行种子数据
```bash
npm run seed
```

### 重置数据库
```bash
npm run db:reset
```

## 地理空间功能

### PostGIS扩展
```sql
-- 启用PostGIS扩展
CREATE EXTENSION IF NOT EXISTS postgis;

-- 添加地理空间列
ALTER TABLE pixels ADD COLUMN geom GEOMETRY(POINT, 4326);
ALTER TABLE grids ADD COLUMN geom GEOMETRY(POLYGON, 4326);

-- 创建空间索引
CREATE INDEX idx_pixels_geom ON pixels USING GIST(geom);
CREATE INDEX idx_grids_geom ON grids USING GIST(geom);
```

### 地理查询示例
```sql
-- 查找指定范围内的像素
SELECT * FROM pixels 
WHERE ST_Within(geom, ST_GeomFromText('POLYGON((...))', 4326));

-- 计算网格中心点
UPDATE grids SET geom = ST_Centroid(ST_GeomFromText(
  'POLYGON((' || bounds_lng_min || ' ' || bounds_lat_min || ', ' ||
           bounds_lng_max || ' ' || bounds_lat_min || ', ' ||
           bounds_lng_max || ' ' || bounds_lat_max || ', ' ||
           bounds_lng_min || ' ' || bounds_lat_max || ', ' ||
           bounds_lng_min || ' ' || bounds_lat_min || '))', 4326
));
```

## 性能优化

### 索引策略
- 主键索引（自动创建）
- 外键索引（自动创建）
- 复合索引：`(grid_id, created_at)`
- 空间索引：PostGIS GIST索引
- 部分索引：活跃用户、最近像素

### 分区策略
- 按时间分区：像素表按月分区
- 按地理分区：网格表按区域分区

### 缓存策略
- 热点像素数据缓存
- 用户会话缓存
- 查询结果缓存
- 实时状态缓存
