# 增强图案系统文档

## 概述

本系统实现了完整的像素战争游戏增强功能，包括：

- **图案旗帜系统**：支持颜色和图案两种旗帜类型
- **炸弹系统**：6x6区域的图案炸弹，24小时冷却
- **广告系统**：可配置的广告投放，支持冷冻期
- **商店系统**：完整的购买和库存管理

## 核心概念

### 1. Pattern ID 统一存储

每个像素现在存储一个 `pattern_id`，而不是直接存储颜色：
- `pattern_id` 映射到颜色或复杂图案
- 客户端根据 `pattern_id` 解析实际颜色/图案
- 支持图案的旋转、镜像、锚点等变换

### 2. 双轨渲染策略

- **px事件**：单像素绘制，客户端解析颜色
- **pt事件**：图案应用，一次性广播N个像素

### 3. 资源优化

- 图案使用RLE或PNG base64编码
- 客户端缓存机制（IndexedDB + LRU）
- 服务端Redis缓冲 + 异步落库

## 数据库结构

### 核心表

1. **pattern_assets** - 图案模板
   - `id`, `key`, `w`, `h`, `encoding`, `payload`
   - `verified`, `created_by`

2. **pattern_apply** - 图案应用（炸弹/道具）
   - `pattern_id`, `x`, `y`, `w`, `h`
   - `rotation`, `mirror`, `tint_color`
   - `owner_user_id`, `owner_alliance_id`
   - `type`, `expires_at`

3. **ads** - 广告投放
   - `pattern_id`, `x`, `y`, `w`, `h`
   - `schedule` (JSONB), `status`
   - `starts_at`, `ends_at`

4. **user_inventory** - 用户库存
   - `user_id`, `sku_id`, `quantity`
   - `consumable`, `consumed_at`

5. **shop_skus** - 商店商品
   - `type` (flag_color/flag_pattern/bomb/ad_slot)
   - `price`, `cooldown_hours`, `metadata`

### 扩展表

- **alliances** - 新增旗帜相关字段
- **audit_log** - 审计日志
- **ad_metrics** - 广告统计

## API接口

### 图案相关

```
GET /api/patterns/manifest          # 获取图案清单
GET /api/patterns/:id               # 获取图案详情
GET /api/patterns/verified/list     # 获取已验证图案
```

### 炸弹相关

```
POST /api/bomb/use                  # 使用炸弹
GET /api/bomb/cooldown              # 获取冷却状态
GET /api/bomb/history               # 获取使用历史
GET /api/bomb/inventory             # 获取炸弹库存
```

### 广告相关

```
POST /api/ads/submit                # 提交广告申请
GET /api/ads/user                   # 获取用户广告
GET /api/ads/active                 # 获取活跃广告
GET /api/ads/region                 # 获取区域广告
POST /api/ads/:id/activate          # 激活广告
POST /api/ads/:id/deactivate        # 停用广告
```

### 管理员接口

```
GET /api/ads/pending                # 获取待审核广告
POST /api/ads/:id/review            # 审核广告
```

## WebSocket事件

### 新增事件类型

1. **pt** - 图案应用事件
```json
{
  "t": "pt",
  "id": "apply_id",
  "pattern_id": "pattern_id",
  "x": 123, "y": 456,
  "rotation": 0, "mirror": false,
  "tint": "#1E90FF",
  "owner_alliance_id": "alliance_id",
  "ts": 1732000000,
  "expires_at": null
}
```

2. **bomb** - 炸弹使用事件
```json
{
  "t": "bomb",
  "id": "bomb_id",
  "pattern_id": "pattern_id",
  "cx": 100, "cy": 200, "r": 3,
  "owner_user_id": "user_id",
  "owner_alliance_id": "alliance_id",
  "ts": 1732000000
}
```

3. **ad_activate** - 广告激活事件
```json
{
  "t": "ad_activate",
  "id": "ad_id",
  "pattern_id": "pattern_id",
  "x": 123, "y": 456, "w": 32, "h": 32,
  "duration": 30,
  "freeze": 10,
  "ts": 1732000000
}
```

4. **ad_deactivate** - 广告停用事件
```json
{
  "t": "ad_deactivate",
  "id": "ad_id",
  "ts": 1732000000
}
```

## 业务规则

### 旗帜系统

1. **自由人**：使用系统默认颜色/图案
2. **联盟成员**：使用联盟旗帜（颜色或图案）
3. **图案旗帜**：需在商店购买，创建联盟时可选

### 炸弹系统

1. **尺寸**：6x6像素区域
2. **冷却**：24小时/用户
3. **消耗**：需要购买炸弹道具
4. **效果**：30秒后过期，可被覆盖

### 广告系统

1. **审核**：需要管理员审核
2. **播放**：按schedule配置播放
3. **冷冻**：播放期间区域不可绘制
4. **统计**：记录展示时长、被覆盖次数

## 安装和配置

### 1. 环境要求

- Node.js 16+
- PostgreSQL 12+
- Redis 6+

### 2. 环境变量

```env
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=pixelwar_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 服务器
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### 3. 初始化步骤

```bash
# 1. 安装依赖
npm install

# 2. 运行迁移
npx knex migrate:latest

# 3. 运行种子数据
npx knex seed:run --specific=005_pattern_assets.js
npx knex seed:run --specific=006_shop_skus.js
npx knex seed:run --specific=007_enhanced_shop_skus.js

# 4. 链接图案和SKU
node scripts/link-patterns.js

# 5. 启动服务器
npm start
```

### 4. 快速初始化（Windows）

```bash
scripts/init-enhanced-system.bat
```

## 测试

### 运行测试

```bash
node scripts/test-enhanced-system.js
```

### 测试内容

1. 图案API功能
2. 商店API功能
3. 炸弹API功能
4. 广告API功能
5. 数据库连接
6. 表结构完整性

## 性能优化

### 服务端优化

1. **Redis缓冲**：所有写入先到Redis
2. **异步处理**：BullMQ Worker异步落库
3. **瓦片合并**：50-200ms窗口内合并事件
4. **热点限流**：防止同一区域过度写入

### 客户端优化

1. **OffscreenCanvas**：Web Worker渲染
2. **Dirty Rect**：只重绘受影响区域
3. **PatternCache**：IndexedDB + LRU缓存
4. **懒加载**：按需加载图案资源

## 监控和日志

### 审计日志

所有重要操作都会记录到 `audit_log` 表：
- 炸弹使用
- 广告创建
- 图案上传
- 购买行为

### 性能监控

- WebSocket连接数
- 数据库查询性能
- Redis命中率
- 客户端渲染帧率

## 故障排除

### 常见问题

1. **Redis连接失败**
   - 检查Redis服务是否启动
   - 验证连接配置

2. **数据库迁移失败**
   - 检查数据库连接
   - 确认表不存在冲突

3. **图案加载失败**
   - 检查pattern_assets表
   - 验证payload格式

4. **炸弹无法使用**
   - 检查用户库存
   - 验证冷却时间

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm start

# 查看Redis状态
redis-cli info

# 查看数据库状态
psql -d pixelwar_dev -c "SELECT * FROM pattern_assets LIMIT 5;"
```

## 扩展开发

### 添加新图案类型

1. 在 `pattern_assets` 表中添加记录
2. 更新 `shop_skus` 表
3. 运行链接脚本

### 自定义炸弹效果

1. 修改 `PatternApply` 模型
2. 更新炸弹控制器
3. 调整前端渲染逻辑

### 广告投放策略

1. 修改 `Ad` 模型的 `shouldPlay` 方法
2. 调整schedule配置
3. 更新播放逻辑

## 许可证

MIT License
