# 管理后台活动创建指南

**日期**: 2026-02-23
**状态**: ✅ 已完成

---

## 📋 概述

本指南介绍如何**模拟管理后台操作**创建活动，而不是通过硬编码直接插入数据库。

### 为什么使用管理后台 API？

✅ **更接近生产环境** - 模拟真实的管理后台操作流程
✅ **数据验证完整** - 通过后端 API 的所有验证逻辑
✅ **触发业务逻辑** - 自动触发缓存刷新、Socket 通知等
✅ **可审计追踪** - 符合管理后台的操作规范

---

## 🔧 脚本文件

### 主脚本

**路径**: `scripts/admin-create-event-gdut.js`

**功能**:
- 通过管理后台 API (`POST /api/admin/events`) 创建活动
- 自动获取管理员 Token
- 生成符合规范的活动数据
- 自动生成圆形 GeoJSON 边界

---

## 🚀 使用方法

### 1. 环境配置

确保 `.env` 文件中配置了以下参数：

```bash
# 后端 API 地址
API_URL=http://localhost:3000/api

# 管理员账号（用于获取 Token）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

**注意**:
- 如果管理员账号不同，请修改 `.env` 文件
- 默认使用本地开发环境 `http://localhost:3000`

### 2. 确保后端运行

```bash
# 启动后端服务
cd backend
npm start

# 或使用 pm2
pm2 start ecosystem.config.js
```

### 3. 执行脚本

```bash
# 在项目根目录执行
node scripts/admin-create-event-gdut.js
```

### 4. 预期输出

```
🚀 开始通过管理后台 API 创建测试活动...

🔐 正在获取管理员 Token...
✅ 管理员登录成功
🎯 正在通过管理后台 API 创建活动...
✅ 活动创建成功！
📋 活动详情:
   ID: a2766fde-775c-4145-b5a4-0b901f2c29ab
   标题: 广工区庄像素大战
   状态: published
   类型: territory_control
   开始时间: 2026-02-23T01:20:34.000Z
   结束时间: 2026-03-02T01:20:34.000Z

🎮 您现在可以在 iOS 应用中看到此活动了！
   - 地图页面（如果在区庄附近）
   - 个人中心 → 赛事中心 → 活跃标签

✅ 所有操作完成！

📱 测试建议:
   1. 打开 FunnyPixels iOS 应用
   2. 前往区庄地铁站（或使用 GPS 模拟）
   3. 查看地图页顶部是否出现活动横幅
   4. 或前往 个人中心 → 赛事中心 查看活动列表

🎯 活动位置: 广东工业大学东风路校区
   坐标: 23.1489, 113.3376
   半径: 800米
```

---

## 📦 活动数据结构

### 完整的活动数据

脚本会创建包含以下数据的活动：

```javascript
{
  id: "a2766fde-775c-4145-b5a4-0b901f2c29ab",
  title: "广工区庄像素大战",
  type: "territory_control",
  status: "published",
  start_time: "2026-02-23T00:00:00Z",
  end_time: "2026-03-02T00:00:00Z",
  banner_url: null,

  // GeoJSON 边界（自动生成的圆形区域）
  boundary: {
    type: "Polygon",
    coordinates: [[...]]  // 64个点组成的圆形
  },

  // 活动配置
  config: {
    area: {
      type: "circle",
      center: { lat: 23.1489, lng: 113.3376 },
      radius: 800,
      name: "广东工业大学东风路校区"
    },
    requirements: {
      minLevel: 1,
      minAlliances: 2,
      minParticipants: 5
    },
    rules: {
      pixelScore: 1,
      maxAlliances: 10,
      minParticipants: 5
    },
    rewards: [
      { rank: 1, type: "coins", amount: 1000, description: "第一名奖励 1000 金币" },
      { rank: 2, type: "coins", amount: 500, description: "第二名奖励 500 金币" },
      { rank: 3, type: "coins", amount: 300, description: "第三名奖励 300 金币" }
    ]
  },

  // 玩法说明（多语言）
  gameplay: {
    zh: { objective: "...", rules: [...], tips: [...] },
    en: { objective: "...", rules: [...], tips: [...] },
    ja: { objective: "...", rules: [...], tips: [...] }
  }
}
```

---

## 🔍 API 流程

### 1. 获取管理员 Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

### 2. 创建活动

```http
POST /api/admin/events
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "id": "...",
  "title": "广工区庄像素大战",
  "type": "territory_control",
  "status": "published",
  ...
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "a2766fde-775c-4145-b5a4-0b901f2c29ab",
    "title": "广工区庄像素大战",
    "status": "published",
    ...
  }
}
```

---

## ✅ 验证活动是否创建成功

### 方法 1: 查询数据库

```bash
# 进入数据库
psql -U postgres -d funnypixels

# 查询活动
SELECT id, title, status, start_time, end_time
FROM events
WHERE title LIKE '%广工%';
```

### 方法 2: 调用 API

```bash
# 获取活跃活动列表
curl http://localhost:3000/api/events/active

# 获取特定活动详情
curl http://localhost:3000/api/events/<event_id>
```

### 方法 3: iOS 应用验证

1. **地图页面**
   - 前往区庄地铁站附近（或使用 GPS 模拟）
   - 地图顶部应该出现 "广工区庄像素大战" 横幅

2. **赛事中心**
   - 打开应用 → 个人标签页
   - 点击 "赛事中心"
   - 在 "活跃" 标签页中应该看到活动卡片

---

## 🎯 与硬编码脚本的对比

### 硬编码方式（旧）

```javascript
// 直接插入数据库，绕过业务逻辑
await knex('events').insert({
  id: uuidv4(),
  title: '广工区庄像素大战',
  ...
});
```

**缺点**:
❌ 不触发缓存刷新
❌ 不触发 Socket 通知
❌ 不经过数据验证
❌ 不符合生产环境流程

### 管理后台 API 方式（新）

```javascript
// 通过 API 创建，完整业务流程
await axios.post('/api/admin/events', eventData, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**优点**:
✅ 自动触发 `eventService.createEvent()`
✅ 自动刷新缓存 (`lastRefresh = 0`)
✅ 自动广播通知 (`broadcastEventsUpdated()`)
✅ 经过完整的数据验证
✅ 符合生产环境操作规范

---

## 🔧 自定义活动

### 修改活动位置

在脚本中修改中心坐标和半径：

```javascript
const eventData = {
  // ...
  boundary: {
    type: 'Polygon',
    coordinates: [
      generateCircleCoordinates(
        23.1489,   // ← 修改纬度
        113.3376,  // ← 修改经度
        800        // ← 修改半径（米）
      )
    ]
  },
  config: {
    area: {
      center: {
        lat: 23.1489,   // ← 同步修改
        lng: 113.3376   // ← 同步修改
      },
      radius: 800,      // ← 同步修改
      name: '自定义区域名称'
    }
  }
};
```

### 修改活动时间

```javascript
const eventData = {
  // ...
  start_time: new Date('2026-02-25T00:00:00Z'),  // 开始时间
  end_time: new Date('2026-03-05T00:00:00Z'),    // 结束时间
};
```

### 修改奖励配置

```javascript
config: {
  rewards: [
    { rank: 1, type: 'coins', amount: 2000, description: '冠军奖励' },
    { rank: 2, type: 'coins', amount: 1000, description: '亚军奖励' },
    { rank: 3, type: 'chest', amount: 1, description: '季军宝箱' }
  ]
}
```

---

## 🐛 常见问题

### Q: 提示 "管理员登录失败"

**原因**: 管理员账号密码不正确

**解决**:
1. 检查 `.env` 文件中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`
2. 确认数据库中存在管理员账号
3. 如果没有管理员账号，先创建一个

### Q: 提示 "创建活动失败: 401 Unauthorized"

**原因**: Token 无效或过期

**解决**:
1. 检查后端 JWT 配置
2. 确认管理员账号有正确的 admin 角色

### Q: 活动创建成功但 iOS 看不到

**原因**: 可能的原因有多种

**解决**:
1. 检查活动状态是否为 `published` 或 `active`
2. 检查 GPS 位置是否在活动区域 2公里内
3. 重启 iOS 应用或拉取刷新
4. 检查 EventManager 是否正常轮询

### Q: 如何删除测试活动？

**方法 1**: 通过管理后台 API
```bash
curl -X DELETE \
  http://localhost:3000/api/admin/events/<event_id> \
  -H "Authorization: Bearer <token>"
```

**方法 2**: 直接操作数据库
```sql
DELETE FROM events WHERE id = '<event_id>';
```

---

## 📊 测试清单

创建活动后，建议进行以下测试：

### 后端验证
- [ ] 数据库中活动记录已创建
- [ ] `GET /api/events/active` 返回新活动
- [ ] 活动配置 JSON 格式正确
- [ ] GeoJSON 边界格式正确

### iOS 验证
- [ ] 地图页显示附近活动横幅
- [ ] 赛事中心显示活动卡片
- [ ] 活动详情页正常显示
- [ ] P0-1 报名统计正常
- [ ] P0-2 玩法说明正常
- [ ] 可以成功报名活动

### 功能验证
- [ ] EventManager 自动检测活动
- [ ] 进入活动区域触发通知
- [ ] Socket 实时数据推送正常
- [ ] 在活动区域内绘制像素计入战绩

---

## 🎉 总结

### 优势

1. **完整业务流程** - 通过管理后台 API，触发所有必要的业务逻辑
2. **生产环境一致** - 模拟真实的管理后台操作
3. **易于维护** - 活动数据结构统一管理
4. **可扩展性强** - 可轻松修改活动参数

### 使用场景

- ✅ **开发测试** - 创建测试活动验证功能
- ✅ **真机测试** - 在真实位置测试地理围栏
- ✅ **演示 Demo** - 快速创建演示活动
- ✅ **压力测试** - 批量创建活动测试性能

---

## 🔗 相关文档

- [EVENT_INTEGRATION_STATUS.md](./EVENT_INTEGRATION_STATUS.md) - 活动集成状态
- [NEARBY_EVENT_FEATURE.md](./NEARBY_EVENT_FEATURE.md) - 附近活动功能
- [COMPILATION_FIX_EVENT_MODELS.md](./COMPILATION_FIX_EVENT_MODELS.md) - 数据模型修复

---

**最后更新**: 2026-02-23
**状态**: ✅ 已完成并测试
