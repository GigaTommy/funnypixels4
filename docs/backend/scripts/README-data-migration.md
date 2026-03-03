# 数据迁移脚本使用说明

## 概述

这些脚本用于将开发环境的基础数据表迁移到生产环境，包括：
- `pattern_assets` - 图案资源表
- `shop_skus` - 商店SKU表
- `store_items` - 商店物品表
- `achievements` - 成就表
- `ad_products` - 广告产品表

## 脚本说明

### 1. export-dev-data.js
从开发环境导出基础数据表到JSON文件

**使用方法：**
```bash
npm run data:export
```

**输出：**
- 在 `backend/data-export/` 目录下生成各表的JSON文件
- 生成 `export-summary.json` 汇总报告

### 2. import-to-production.js
将导出的JSON文件导入到生产环境

**使用方法：**
```bash
npm run data:import
```

**前置条件：**
- 需要设置生产环境数据库环境变量：
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

**输出：**
- 清空生产环境对应表的数据
- 导入新的基础数据
- 生成 `import-summary.json` 汇总报告

### 3. migrate-dev-to-prod.js
一键完成导出和导入流程

**使用方法：**
```bash
npm run data:migrate
```

**功能：**
- 自动导出开发环境数据
- 自动导入到生产环境
- 生成完整的迁移报告

## 使用步骤

### 方法一：一键迁移（推荐）
```bash
# 在开发环境运行
npm run data:migrate
```

### 方法二：分步执行
```bash
# 步骤1：导出开发环境数据
npm run data:export

# 步骤2：导入到生产环境（需要设置生产环境变量）
npm run data:import
```

## 环境变量配置

### 开发环境
使用 `backend/.env` 或 `backend/.env.local` 中的数据库配置

### 生产环境
需要设置以下环境变量：
```bash
export DB_HOST=your_production_host
export DB_PORT=5432
export DB_USER=your_production_user
export DB_PASSWORD=your_production_password
export DB_NAME=your_production_database
```

## 安全注意事项

1. **备份生产数据**：在导入前请备份生产环境的数据
2. **测试环境验证**：建议先在测试环境验证迁移脚本
3. **权限检查**：确保数据库用户有足够的权限进行数据操作
4. **网络连接**：确保能够连接到生产环境数据库

## 故障排除

### 常见问题

1. **连接失败**
   - 检查环境变量是否正确设置
   - 确认网络连接和防火墙设置
   - 验证数据库用户权限

2. **导入失败**
   - 检查JSON文件是否存在
   - 确认表结构是否匹配
   - 查看详细错误日志

3. **数据不完整**
   - 检查导出日志
   - 确认开发环境数据完整性
   - 重新执行导出和导入

### 日志文件
- 导出日志：`backend/data-export/export-summary.json`
- 导入日志：`backend/data-export/import-summary.json`
- 迁移报告：`backend/data-export/migration-report.json`

## 数据验证

迁移完成后，建议验证以下内容：
1. 各表记录数量是否正确
2. 关键字段数据是否完整
3. 外键关系是否正确
4. 业务功能是否正常

## 回滚方案

如果需要回滚，可以：
1. 从备份恢复生产环境数据
2. 或者重新运行导入脚本（会清空现有数据）
