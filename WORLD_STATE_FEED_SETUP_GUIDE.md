# World State Feed 部署指南

## 🚀 快速开始

### 1. 运行数据库迁移

创建territory_control_history表（领地控制历史表）：

```bash
cd backend
npx knex migrate:latest
```

或者只运行特定的迁移：

```bash
npx knex migrate:up 20260304000000_create_territory_control_history.js
```

### 2. 生成测试数据

运行测试数据生成脚本：

```bash
cd backend
node scripts/generate_world_state_test_data.js
```

这个脚本会生成：
- ✅ 10个达成里程碑的用户（100, 1K, 5K, 10K, 50K, 100K像素）
- ✅ 15个高质量绘画会话（>100像素，>5分钟）
- ✅ 20条领地控制历史记录
- ✅ 3个活动进度事件
- ✅ 5条官方公告

### 3. 启动后端服务

```bash
cd backend
npm start
```

### 4. 测试API

#### 获取所有世界状态事件
```bash
curl -X GET "http://localhost:3001/api/feed/world-state?filter=all&offset=0&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 只获取领地变化事件
```bash
curl -X GET "http://localhost:3001/api/feed/world-state?filter=territories&offset=0&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 只获取里程碑事件
```bash
curl -X GET "http://localhost:3001/api/feed/world-state?filter=milestones&offset=0&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. iOS应用测试

1. 打开Xcode项目：
   ```bash
   open FunnyPixelsApp/FunnyPixelsApp.xcodeproj
   ```

2. 选择iOS Simulator设备（iPhone 17 Pro或其他）

3. 运行应用（⌘+R）

4. 登录后导航到"动态"Tab

5. 点击"广场"子标签

6. 验证World State Events正确显示

## 📊 测试检查清单

### Backend API测试

- [ ] ✅ `/api/feed/world-state?filter=all` 返回混合事件（5种类型）
- [ ] ✅ `/api/feed/world-state?filter=milestones` 只返回里程碑事件
- [ ] ✅ `/api/feed/world-state?filter=territories` 只返回领地变化事件（40%比例）
- [ ] ✅ `/api/feed/world-state?filter=events` 只返回活动进度事件
- [ ] ✅ `/api/feed/world-state?filter=official` 只返回官方公告
- [ ] ✅ 分页功能正常（offset, limit参数）
- [ ] ✅ 事件按优先级和时间正确排序
- [ ] ✅ 所有事件都有必需的字段（id, event_type, title, description, metadata, action_buttons）

### iOS App测试

- [ ] ✅ 广场Tab显示WorldStateFeedView而非SocialFeedView
- [ ] ✅ 5个筛选器可点击且工作正常
- [ ] ✅ 事件卡片显示正确（图标、标题、描述、元数据、按钮）
- [ ] ✅ 下拉刷新功能正常
- [ ] ✅ 滚动到底部自动加载更多事件
- [ ] ✅ 点击操作按钮导航正确
  - 查看主页 → 用户Profile页
  - 查看作品 → 会话详情页
  - 前往位置 → 地图定位
  - 立即参与 → 活动详情页
  - 查看联盟 → 联盟页面
  - 查看详情 → 公告详情
- [ ] ✅ 空状态显示正确
- [ ] ✅ 6种语言本地化文本显示正确
  - 中文（zh-Hans）
  - 英文（en）
  - 西班牙语（es）
  - 日语（ja）
  - 韩语（ko）
  - 葡萄牙语（pt-BR）

## 🔍 故障排查

### 问题：API返回空数组

**原因**: 数据库中没有测试数据

**解决**: 运行测试数据生成脚本
```bash
node backend/scripts/generate_world_state_test_data.js
```

### 问题：领地变化事件为占位文本

**原因**: territory_control_history表不存在或为空

**解决**:
1. 运行迁移创建表：
   ```bash
   npx knex migrate:up 20260304000000_create_territory_control_history.js
   ```

2. 生成测试数据：
   ```bash
   node backend/scripts/generate_world_state_test_data.js
   ```

### 问题：iOS构建失败

**原因**: 可能的命名冲突或缺少文件

**解决**:
1. 清理构建缓存：
   ```bash
   cd FunnyPixelsApp
   rm -rf ~/Library/Developer/Xcode/DerivedData/FunnyPixelsApp-*
   ```

2. 重新构建：
   ```bash
   xcodebuild -project FunnyPixelsApp.xcodeproj -scheme FunnyPixelsApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro' clean build
   ```

### 问题：本地化字符串未显示

**原因**: 语言文件未正确更新或缓存问题

**解决**:
1. 检查Localizable.strings文件是否包含所需的键
2. 在Xcode中Clean Build Folder（⌘+Shift+K）
3. 重新运行应用

## 📝 数据库Schema

### territory_control_history 表结构

| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | UUID | 主键 |
| territory_name | VARCHAR(255) | 领地名称 |
| alliance_id | UUID | 当前控制联盟ID |
| previous_alliance_id | UUID | 前一个控制联盟ID（可选） |
| changed_at | TIMESTAMP | 控制权变化时间 |
| metadata | JSONB | 额外元数据（战斗信息等） |
| created_at | TIMESTAMP | 记录创建时间 |

### 索引
- `idx_territory_changed_at` - 用于按时间查询
- `idx_territory_alliance_id` - 用于按联盟查询
- `idx_territory_name` - 用于按领地查询

### 外键
- `alliance_id` → `alliances(id)` (CASCADE)
- `previous_alliance_id` → `alliances(id)` (SET NULL)

## 🎯 性能优化建议

### 后端
1. **添加Redis缓存**（5分钟TTL）
   ```javascript
   // 缓存键：world_state_feed:{filter}:{offset}:{limit}
   const cacheKey = `world_state_feed:${filter}:${offset}:${limit}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

2. **数据库查询优化**
   - 对hot table添加适当索引
   - 使用materialized view缓存复杂查询
   - 限制查询范围（如只查询最近30天的数据）

3. **并发控制**
   - 使用Promise.all并行查询不同类型的事件
   - 设置单个查询的超时时间

### iOS端
1. **图片懒加载**
   - SessionThumbnailView使用Kingfisher的懒加载
   - 滚动时取消不可见图片的加载

2. **列表性能**
   - 使用LazyVStack减少内存占用
   - 实现预加载逻辑（滚动到倒数第5项时加载下一页）

3. **本地缓存**
   - 使用UserDefaults或Realm缓存最近的事件列表
   - 冷启动时先显示缓存，再刷新

## 📚 相关文档

- [实施总结](./WORLD_STATE_FEED_IMPLEMENTATION.md)
- [设计文档](./World_State_Feed_Design.md)（如存在）
- [API文档](./backend/docs/api/feed.md)（如存在）

## 🆘 获取帮助

如遇到问题：
1. 检查后端日志：`backend/logs/`
2. 检查Xcode控制台输出
3. 使用Postman测试API端点
4. 查看数据库数据：`psql -d funnypixels`

---

**最后更新**: 2026-03-04
**版本**: v1.0
