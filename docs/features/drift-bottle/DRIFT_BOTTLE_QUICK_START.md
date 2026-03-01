# 🚀 漂流瓶功能快速启动指南

## ⚡ 5分钟快速启动

### 第一步：后端部署 (2分钟)

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖（如果是首次）
npm install node-cron

# 3. 运行数据库迁移
npm run migrate

# 4. 启动服务器
npm run dev
```

**验证后端**: 访问 `http://localhost:3001/health` 应该返回成功

---

### 第二步：测试配额API (1分钟)

```bash
# 获取配额（需要替换YOUR_TOKEN）
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

### 第三步：前端运行 (2分钟)

```bash
# 1. 进入iOS项目目录
cd FunnyPixelsApp

# 2. 在Xcode中打开项目
open FunnyPixelsApp.xcodeproj

# 3. 运行项目 (Cmd+R)
```

**验证前端**:
1. 进入地图界面
2. 左侧应该看到漂流瓶图标（蓝绿色船锚图标）
3. 点击图标，侧边面板滑出
4. 应该显示"可用总数: 5"

---

## 🧪 完整测试流程

### 测试1: 抛出漂流瓶

1. **打开侧边面板**
   - 点击地图左侧的漂流瓶图标

2. **输入留言（可选）**
   - 在文本框输入任意留言（最多50字）

3. **抛出瓶子**
   - 点击"抛出漂流瓶"按钮
   - 应该看到成功动画
   - 听到成功音效
   - 配额减1（显示"可用总数: 4"）

4. **验证后端**
   ```bash
   # 再次查询配额
   curl -X GET "http://localhost:3001/drift-bottles/quota" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   应该看到 `daily_used: 1`, `daily_remaining: 4`

---

### 测试2: 遭遇漂流瓶

**准备工作**: 需要2个测试账号

1. **账号A抛出瓶子**
   - 在某个位置抛出漂流瓶

2. **账号B接近该位置**
   - 走到瓶子1公里范围内
   - 等待最多60秒（轮询间隔）

3. **遭遇触发**
   - 地图底部弹出遭遇横幅
   - 播放遭遇音效
   - 显示瓶子来源、距离、站数

4. **打开瓶子**
   - 点击"打开"按钮
   - 显示全屏打开视图
   - 播放打开音效
   - 可以阅读留言
   - 可选择留言后放流

---

### 测试3: 画像素获得奖励

1. **开始GPS绘画**
   - 点击地图右下角GPS绘画按钮
   - 走动绘制至少50个像素

2. **结束绘画**
   - 完成绘画后返回地图

3. **查看配额**
   - 点击漂流瓶图标
   - 应该看到"画像素奖励: +1"
   - 总可用数增加1

4. **使用奖励**
   - 抛出瓶子，优先消耗每日免费次数
   - 每日免费用完后，才会消耗画像素奖励

---

### 测试4: 每日重置

**方式A: 等待自然重置**
- 等到第二天凌晨0点
- 重新打开App
- 查看配额，`daily_remaining` 应该重置为5

**方式B: 手动触发（开发环境）**
```javascript
// 在backend控制台执行
const quotaService = require('./src/services/driftBottleQuotaService');
await quotaService.resetDailyQuota();
```

---

## 🐛 常见问题排查

### 问题1: 后端启动失败

**错误**: `Error: Cannot find module 'node-cron'`

**解决**:
```bash
cd backend
npm install node-cron --save
npm run dev
```

---

### 问题2: 配额API返回500

**错误**: `数据库表不存在`

**解决**:
```bash
cd backend

# 检查迁移状态
npm run migrate:status

# 运行迁移
npm run migrate

# 验证表已创建
npm run migrate:status
```

---

### 问题3: 前端角标不显示

**原因**: 配额未加载或显示条件错误

**解决**:
1. 检查网络请求是否成功
   - 在Xcode控制台查看日志
   - 搜索 "Quota updated"

2. 检查显示条件
   ```swift
   // 确保 MapTabContent.swift 中有:
   if driftBottleManager.quota != nil,
      !GPSDrawingService.shared.isGPSDrawingMode {
       DriftBottleSideIndicator()
   }
   ```

3. 重新加载配额
   - 杀掉App重启
   - 切换到其他Tab再切回来

---

### 问题4: 遭遇检测不工作

**原因**: Socket未连接或轮询未启动

**解决**:
1. 检查Socket连接状态
   - 查看Xcode控制台
   - 搜索 "Socket connected"

2. 确认遭遇检测已启动
   - 在 ContentView.swift 的 `.onAppear` 中
   - 应该调用 `DriftBottleManager.shared.startEncounterDetection()`

3. 手动触发检测
   ```swift
   // 在代码中临时添加
   Task {
       await DriftBottleManager.shared.checkForNearbyBottles()
   }
   ```

---

### 问题5: 音效不播放

**原因**: 音频文件不存在或SoundManager未初始化

**解决**:
1. 检查音频文件是否存在
   ```
   FunnyPixelsApp/Resources/Sounds/bottle_encounter.m4a
   FunnyPixelsApp/Resources/Sounds/bottle_open.m4a
   ```

2. 确认文件已添加到Xcode项目
   - 在Project Navigator中查看
   - Target Membership 已勾选

3. 检查SoundManager配置
   ```swift
   // 确保 SoundEffect.swift 中定义了:
   case bottleEncounter = "bottle_encounter"
   case bottleOpen = "bottle_open"
   ```

---

## 📊 数据验证SQL

### 查看每日使用记录
```sql
SELECT * FROM drift_bottle_daily_usage
WHERE user_id = 'YOUR_USER_ID'
ORDER BY date DESC
LIMIT 10;
```

### 查看用户像素统计
```sql
SELECT
  id,
  username,
  total_pixels_drawn,
  drift_bottle_pixels_redeemed,
  total_pixels_drawn - drift_bottle_pixels_redeemed AS unredeemed_pixels
FROM users
WHERE id = 'YOUR_USER_ID';
```

### 查看所有漂流瓶
```sql
SELECT
  bottle_id,
  original_owner_id,
  origin_city,
  open_count,
  max_openers,
  is_sunk,
  created_at
FROM drift_bottles
WHERE original_owner_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 功能验收清单

在告知完成前，确保以下所有项都通过:

### 后端
- [ ] 迁移执行成功，表已创建
- [ ] 配额API返回正确数据
- [ ] 抛瓶API工作正常
- [ ] 打开瓶子API工作正常
- [ ] 遭遇检测API返回数据
- [ ] 定时任务已启动（检查日志）

### 前端
- [ ] 地图左侧漂流瓶图标始终显示
- [ ] 角标颜色正确（绿色=有免费，蓝色=只剩奖励，橙色=用完）
- [ ] 侧边面板显示详细配额
- [ ] 抛瓶流程完整（输入→抛出→动画→音效→配额减少）
- [ ] 遭遇横幅正常弹出（有瓶子时）
- [ ] 打开瓶子流程完整（阅读→留言→放流→动画）
- [ ] 所有音效播放正常

### 集成测试
- [ ] 用户A抛瓶，用户B能遭遇
- [ ] 用户B打开后，瓶子open_count增加
- [ ] 画50像素后，获得奖励瓶子
- [ ] 第二天配额自动重置
- [ ] 5人打开后瓶子沉没，创建旅程卡片

---

## 📞 需要帮助？

如果遇到问题：

1. **检查日志**
   - 后端: 查看控制台输出
   - 前端: Xcode控制台搜索关键词

2. **查看状态文档**
   - 阅读 `DRIFT_BOTTLE_IMPLEMENTATION_STATUS.md`
   - 确认所有文件已修改

3. **数据库调试**
   - 使用上面的SQL语句验证数据
   - 检查迁移是否执行

4. **重启服务**
   - 后端: Ctrl+C 后重新 `npm run dev`
   - 前端: Cmd+Q 杀掉App，重新运行

---

**最后更新**: 2026-02-23
**版本**: v1.0
**状态**: ✅ 可用
