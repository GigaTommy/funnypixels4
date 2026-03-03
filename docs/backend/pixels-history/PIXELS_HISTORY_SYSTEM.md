# 像素历史系统 (Pixels History System)

## 📋 概述

像素历史系统是一个高性能的分区表系统，用于记录和管理所有像素操作的历史流水。系统采用按日期分区、冷热数据分离、异步处理等策略，确保高并发写入和高效查询。

## 🏗️ 系统架构

### 核心组件

1. **分区表** (`pixels_history`) - 按月分区的主表
2. **历史服务** (`PixelsHistoryService`) - 核心业务逻辑
3. **队列处理器** - 异步处理历史记录
4. **管理脚本** - 分区管理和数据归档
5. **API控制器** - 提供查询接口

### 数据流

```
像素操作 → 主表写入 → 异步历史记录 → 队列处理 → 历史表存储
                ↓
            实时查询 ← 历史表查询 ← 索引优化
```

## 📊 表结构

### 主表字段

```sql
CREATE TABLE pixels_history (
    id BIGSERIAL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    color VARCHAR(7) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    grid_id VARCHAR(50) NOT NULL,
    
    -- 图案字段
    pattern_id VARCHAR(100),
    pattern_anchor_x INTEGER DEFAULT 0,
    pattern_anchor_y INTEGER DEFAULT 0,
    pattern_rotation INTEGER DEFAULT 0,
    pattern_mirror BOOLEAN DEFAULT false,
    
    -- 历史特有字段
    history_date DATE NOT NULL,           -- 分区键
    region_id INTEGER,                    -- 区域ID
    action_type VARCHAR(20) DEFAULT 'draw', -- 操作类型
    original_pixel_id INTEGER,            -- 原始像素ID
    version BIGINT DEFAULT 1,             -- 版本号
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- 计算字段
    user_created_idx BIGINT GENERATED ALWAYS AS (
        user_id * 1000000 + EXTRACT(EPOCH FROM created_at)::BIGINT
    ) STORED
) PARTITION BY RANGE (history_date);
```

### 分区策略

- **按月分区**: 每个分区包含一个月的数据
- **自动创建**: 系统自动创建未来3个月的分区
- **自动清理**: 定期清理12个月前的旧分区

## 🚀 快速开始

### 1. 数据库迁移

```bash
# 运行迁移创建分区表
npm run migrate

# 或者直接运行迁移文件
npx knex migrate:latest
```

### 2. 启动队列处理器

```bash
# 持续运行
node scripts/process-pixels-history-queue.js

# 单次运行
node scripts/process-pixels-history-queue.js --once

# 自定义间隔（10秒）
node scripts/process-pixels-history-queue.js --interval 10000
```

### 3. 集成到现有服务

像素绘制服务已自动集成历史记录功能，无需额外配置。

## 🔧 管理命令

### 分区管理

```bash
# 创建指定日期的分区
node scripts/manage-pixels-history.js create-partition 2025-02-01

# 创建未来3个月的分区
node scripts/manage-pixels-history.js create-future 3

# 清理12个月前的旧分区
node scripts/manage-pixels-history.js cleanup-partitions 12

# 优化索引
node scripts/manage-pixels-history.js optimize-indexes

# 查看统计信息
node scripts/manage-pixels-history.js stats

# 性能监控
node scripts/manage-pixels-history.js monitor
```

### 数据归档

```bash
# 归档指定日期之前的数据
node scripts/archive-pixels-history.js archive 2024-12-01

# 从归档文件恢复数据
node scripts/archive-pixels-history.js restore 2024-12-01

# 列出所有归档文件
node scripts/archive-pixels-history.js list

# 清理归档文件
node scripts/archive-pixels-history.js cleanup 2024-12-01
```

### 队列管理

```bash
# 查看队列状态
node scripts/process-pixels-history-queue.js --status

# 清空队列
node scripts/process-pixels-history-queue.js --clear

# 性能监控
node scripts/process-pixels-history-queue.js --monitor
```

## 📡 API 接口

### 基础路径
```
/api/pixels-history
```

### 接口列表

#### 1. 获取用户像素历史
```http
GET /api/pixels-history/user/:userId
```

**查询参数:**
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)
- `actionType`: 操作类型 (draw, bomb, clear等)
- `limit`: 限制条数 (默认100, 最大1000)
- `offset`: 偏移量 (默认0)

**示例:**
```bash
curl "http://localhost:3000/api/pixels-history/user/123?startDate=2025-01-01&limit=50"
```

#### 2. 获取像素位置历史
```http
GET /api/pixels-history/location/:gridId
```

**查询参数:**
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)
- `limit`: 限制条数 (默认100, 最大1000)
- `offset`: 偏移量 (默认0)

**示例:**
```bash
curl "http://localhost:3000/api/pixels-history/location/grid_123_456?limit=20"
```

#### 3. 获取用户行为统计
```http
GET /api/pixels-history/user/:userId/stats
```

**查询参数:**
- `startDate`: 开始日期 (默认30天前)
- `endDate`: 结束日期 (默认今天)

**示例:**
```bash
curl "http://localhost:3000/api/pixels-history/user/123/stats"
```

#### 4. 获取区域活跃度统计
```http
GET /api/pixels-history/region/stats
```

**查询参数:**
- `startDate`: 开始日期 (默认7天前)
- `endDate`: 结束日期 (默认今天)
- `regionId`: 区域ID (可选)

**示例:**
```bash
curl "http://localhost:3000/api/pixels-history/region/stats?regionId=1"
```

#### 5. 获取统计概览
```http
GET /api/pixels-history/stats/overview
```

**查询参数:**
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)

**示例:**
```bash
curl "http://localhost:3000/api/pixels-history/stats/overview?startDate=2025-01-01"
```

## 🔍 查询优化

### 索引策略

1. **用户行为索引**: `(user_id, created_at DESC)`
2. **位置历史索引**: `(grid_id, created_at DESC)`
3. **日期范围索引**: `(history_date DESC)`
4. **复合查询索引**: `(user_id, history_date, action_type)`
5. **区域查询索引**: `(region_id, history_date DESC)`

### 查询最佳实践

1. **使用日期范围**: 始终指定日期范围以提高查询性能
2. **限制结果集**: 使用 `limit` 和 `offset` 进行分页
3. **利用索引**: 查询条件应匹配索引字段
4. **避免全表扫描**: 不要在没有索引的字段上进行范围查询

## 📈 性能监控

### 关键指标

1. **写入性能**: 每秒处理的像素历史记录数
2. **查询性能**: 平均查询响应时间
3. **存储使用**: 分区大小和索引大小
4. **队列状态**: 队列长度和处理延迟

### 监控命令

```bash
# 查看系统统计
node scripts/manage-pixels-history.js stats

# 性能监控
node scripts/manage-pixels-history.js monitor

# 队列状态
node scripts/process-pixels-history-queue.js --status
```

## 🔄 数据生命周期

### 热数据 (0-7天)
- 存储在PostgreSQL主数据库
- 支持实时查询和写入
- 使用SSD存储，高性能

### 温数据 (7-30天)
- 存储在PostgreSQL中
- 支持查询，性能略低
- 使用较便宜的存储

### 冷数据 (30天以上)
- 归档到对象存储
- 压缩存储，成本极低
- 需要时再加载到数据库

## 🛠️ 维护任务

### 定期任务

1. **每日**: 创建未来分区
2. **每周**: 优化索引和统计信息
3. **每月**: 清理旧分区和归档数据
4. **每季度**: 性能调优和容量规划

### 自动化脚本

```bash
# 添加到 crontab
# 每天凌晨2点创建未来分区
0 2 * * * cd /path/to/project && node scripts/manage-pixels-history.js create-future 1

# 每周日凌晨3点优化索引
0 3 * * 0 cd /path/to/project && node scripts/manage-pixels-history.js optimize-indexes

# 每月1号凌晨4点清理旧分区
0 4 1 * * cd /path/to/project && node scripts/manage-pixels-history.js cleanup-partitions 12
```

## 🚨 故障排除

### 常见问题

1. **分区创建失败**
   - 检查数据库权限
   - 确认日期格式正确
   - 查看错误日志

2. **查询性能慢**
   - 检查索引是否存在
   - 优化查询条件
   - 更新表统计信息

3. **队列积压**
   - 增加队列处理器数量
   - 检查数据库连接
   - 监控系统资源

4. **存储空间不足**
   - 清理旧分区
   - 归档历史数据
   - 扩展存储容量

### 日志位置

- 应用日志: `backend/logs/`
- 数据库日志: PostgreSQL 日志
- 系统日志: `/var/log/`

## 📚 扩展功能

### 未来计划

1. **实时分析**: 集成流式分析引擎
2. **机器学习**: 用户行为预测
3. **可视化**: 历史数据可视化界面
4. **告警系统**: 异常行为检测

### 自定义开发

1. **添加新的操作类型**: 修改 `action_type` 枚举
2. **扩展字段**: 在迁移中添加新字段
3. **自定义查询**: 在服务中添加新方法
4. **集成外部系统**: 通过API或消息队列

## 📞 支持

如有问题或建议，请：

1. 查看日志文件
2. 运行诊断命令
3. 联系开发团队
4. 提交 Issue

---

**注意**: 本系统设计用于高并发场景，请在生产环境中谨慎操作，建议先在测试环境验证。
