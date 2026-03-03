# 数据库环境同步脚本

本目录包含了用于同步开发环境和生产环境数据库的脚本工具。

## 脚本列表

### 1. 数据导出脚本

#### `export-development-data.js`
导出开发环境的基础数据到JSON文件。

**使用方法:**
```bash
node scripts/export-development-data.js
```

**功能:**
- 导出以下表的基础数据：
  - `pattern_assets` - 图案资源
  - `shop_skus` - 商店SKU
  - `store_items` - 商店物品
  - `regions` - 地区数据
  - `achievements` - 成就系统
  - `ad_products` - 广告产品
  - `advertisements` - 广告数据

**输出文件:**
- `data-export/development-base-data-{timestamp}.json`
- `data-export/development-base-data-latest.json`

### 2. 表结构检查脚本

#### `check-production-schema.js`
检查生产环境数据库的表结构。

**使用方法:**
```bash
node scripts/check-production-schema.js
```

**功能:**
- 获取所有表的列信息
- 获取所有表的索引信息
- 获取所有表的约束信息
- 生成详细的表结构报告

**输出文件:**
- `data-export/production-schema-{timestamp}.json`
- `data-export/production-schema-latest.json`

#### `check-development-schema.js`
检查开发环境数据库的表结构。

**使用方法:**
```bash
node scripts/check-development-schema.js
```

**功能:**
- 获取所有表的列信息
- 获取所有表的索引信息
- 获取所有表的约束信息
- 生成详细的表结构报告

**输出文件:**
- `data-export/development-schema-{timestamp}.json`
- `data-export/development-schema-latest.json`

### 3. 表结构对比脚本

#### `compare-schemas.js`
对比生产环境和开发环境的表结构差异。

**使用方法:**
```bash
node scripts/compare-schemas.js
```

**前置条件:**
1. 先运行 `check-production-schema.js`
2. 先运行 `check-development-schema.js`

**功能:**
- 对比表数量差异
- 对比表结构差异（列、索引、约束）
- 重点分析关键表的结构差异
- 生成详细的差异报告

**输出文件:**
- `data-export/schema-differences-{timestamp}.json`
- `data-export/schema-differences-latest.json`

### 4. 数据同步脚本

#### `sync-data-to-production.js`
将开发环境的基础数据同步到生产环境。

**使用方法:**
```bash
node scripts/sync-data-to-production.js
```

**前置条件:**
1. 先运行 `export-development-data.js`
2. 确保生产环境数据库表结构已修复

**功能:**
- 按依赖关系顺序同步数据
- 批量插入数据（每批50条）
- 处理ID冲突和时间字段
- 生成同步结果报告

**输出文件:**
- `data-export/sync-report-{timestamp}.json`
- `data-export/sync-report-latest.json`

## 完整工作流程

### 1. 环境对比流程
```bash
# 1. 检查生产环境表结构
node scripts/check-production-schema.js

# 2. 检查开发环境表结构
node scripts/check-development-schema.js

# 3. 对比两个环境的差异
node scripts/compare-schemas.js
```

### 2. 数据同步流程
```bash
# 1. 导出开发环境数据
node scripts/export-development-data.js

# 2. 同步数据到生产环境
node scripts/sync-data-to-production.js
```

## 注意事项

### 安全提醒
- 所有脚本都包含生产环境数据库连接信息
- 请确保在安全的环境中运行这些脚本
- 建议在同步前备份生产环境数据

### 数据同步策略
- 基础数据表（如pattern_assets、shop_skus）会清空现有数据后重新插入
- 用户数据表不会被同步，避免覆盖用户数据
- 所有操作都有详细的日志记录

### 错误处理
- 脚本包含完整的错误处理机制
- 批量插入失败时会尝试逐条插入
- 所有操作结果都会保存到报告中

## 文件结构

```
backend/
├── scripts/
│   ├── export-development-data.js
│   ├── check-production-schema.js
│   ├── check-development-schema.js
│   ├── compare-schemas.js
│   ├── sync-data-to-production.js
│   └── README-DATABASE-SYNC.md
└── data-export/
    ├── development-base-data-latest.json
    ├── production-schema-latest.json
    ├── development-schema-latest.json
    ├── schema-differences-latest.json
    └── sync-report-latest.json
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查网络连接
   - 验证数据库连接信息
   - 确认数据库服务状态

2. **表不存在**
   - 运行数据库迁移
   - 检查表名拼写
   - 确认环境配置

3. **数据插入失败**
   - 检查数据类型匹配
   - 验证约束条件
   - 查看详细错误日志

### 日志查看
所有脚本都会输出详细的执行日志，包括：
- 操作进度
- 成功/失败状态
- 错误信息
- 数据统计

## 更新历史

- 2025-01-11: 初始版本，包含基础的数据导出、表结构检查和同步功能
