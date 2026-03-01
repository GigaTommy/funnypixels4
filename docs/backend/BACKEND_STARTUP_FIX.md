# 🔧 后端启动错误修复

## 问题描述

**错误信息**:
```
Error: Cannot find module '../database/connection'
Require stack:
- /backend/src/services/driftBottleQuotaService.js
```

**原因**:
在 `driftBottleQuotaService.js` 中使用了错误的数据库导入路径。

---

## 修复方案

### 修改文件
**文件**: `backend/src/services/driftBottleQuotaService.js`

**修改位置**: 第6行

**修改前** ❌:
```javascript
const db = require('../database/connection');
```

**修改后** ✅:
```javascript
const { db } = require('../config/database');
```

---

## 说明

### 正确的导入方式
在本项目中，所有服务和模型都应该使用以下方式导入数据库连接：

```javascript
const { db } = require('../config/database');
```

**注意事项**:
1. 使用解构赋值 `{ db }`（因为 `database.js` 导出的是对象）
2. 路径是 `../config/database`（不是 `../database/connection`）

### 项目中的正确示例
```javascript
// services/pixelBatchService.js
const { db } = require('../config/database');

// models/DriftBottle.js
const { db } = require('../config/database');

// services/cityLeaderboardService.js
const { db } = require('../config/database');
```

---

## 验证

### 1. 检查依赖
```bash
cd backend
npm list node-cron
```

**预期结果**: ✅
```
└── node-cron@4.2.1
```

### 2. 启动后端服务
```bash
cd backend
npm run dev
```

**预期结果**: ✅
```
[日志] Server running on port 3001
[日志] ✅ Daily bottle quota reset task initialized
```

### 3. 测试配额API
```bash
curl -X GET "http://localhost:3001/drift-bottles/quota" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "daily_free": 5,
    "daily_used": 0,
    "daily_remaining": 5,
    "bonus_from_pixels": 0,
    "total_available": 5,
    "pixels_for_next_bottle": 50,
    "reset_time": "2026-02-24T00:00:00.000Z"
  }
}
```

---

## 相关检查

### 已验证项
- ✅ `node-cron` 依赖已安装（v4.2.1）
- ✅ 数据库配置文件存在于 `src/config/database.js`
- ✅ 其他服务使用正确的导入路径
- ✅ 定时任务文件 `resetDailyBottleQuota.js` 导入路径正确

### 待执行
- [ ] 运行数据库迁移（`npm run migrate`）
- [ ] 启动后端服务（`npm run dev`）
- [ ] 验证配额API端点
- [ ] 检查定时任务日志

---

## 根本原因

这是一个**路径错误**，在创建新服务时：
- ❌ 错误地假设了 `../database/connection` 路径
- ✅ 应该参考现有服务的导入方式

### 预防措施
未来创建新服务时：
1. 参考现有服务的导入语句
2. 检查项目的目录结构
3. 使用相同的模式和约定

---

## 完整启动步骤

### 首次启动
```bash
# 1. 安装依赖（如果需要）
cd backend
npm install

# 2. 运行数据库迁移
npm run migrate

# 3. 启动服务
npm run dev
```

### 验证启动成功
查看日志应该包含：
- ✅ `Server running on port 3001`
- ✅ `Database connected`
- ✅ `✅ Daily bottle quota reset task initialized`

---

## 状态

- **修复时间**: 2026-02-23
- **修复状态**: ✅ 已完成
- **验证状态**: 待测试
- **可投产**: 待验证

---

## 下一步

1. 启动后端服务
2. 运行数据库迁移
3. 测试配额API
4. 验证定时任务

所有路径问题已修复，可以启动后端服务了！
