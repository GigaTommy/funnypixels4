# 🍾 漂流瓶核心功能实现状态

## ✅ 已完成的部分

### 后端实现 (Backend)

#### 1. 数据库迁移 ✅
- **文件**: `backend/src/database/migrations/20260223000000_drift_bottle_quota_system.js`
- **内容**:
  - 创建 `drift_bottle_daily_usage` 表（记录每日使用）
  - 为 `users` 表添加 `drift_bottle_pixels_redeemed` 字段
- **执行**: 运行 `npm run migrate` 应用迁移

#### 2. 配额服务 ✅
- **文件**: `backend/src/services/driftBottleQuotaService.js`
- **功能**:
  - `getQuota(userId)` - 获取用户配额
  - `consumeQuota(userId, trx)` - 消耗配额（优先级：每日免费 > 画像素奖励）
  - `hasAvailableQuota(userId)` - 检查是否有可用配额
  - `resetDailyQuota()` - 重置每日配额

#### 3. 控制器更新 ✅
- **文件**: `backend/src/controllers/driftBottleController.js`
- **修改**:
  - 导入配额服务
  - 更新 `getQuota` 方法使用新配额系统
  - 其他方法（`throwBottle`, `openBottle`, `checkEncounter`）保持不变

#### 4. 模型更新 ✅
- **文件**: `backend/src/models/DriftBottle.js`
- **修改**:
  - `createBottle` 方法使用新配额系统
  - 在事务中检查和消耗配额
  - 移除旧的 `user_bottle_quota` 表依赖

#### 5. 定时任务 ✅
- **文件**: `backend/src/tasks/resetDailyBottleQuota.js`
- **功能**: 每天凌晨0点（Asia/Shanghai）重置每日配额
- **集成**: 在 `server.js` 中启动

### 前端实现 (iOS App)

#### 1. 配额模型更新 ✅
- **文件**: `FunnyPixelsApp/FunnyPixelsApp/Models/DriftBottleModels.swift`
- **修改**: `BottleQuota` 结构体使用新字段
  - `dailyFree`, `dailyUsed`, `dailyRemaining`
  - `bonusFromPixels`, `totalAvailable`
  - `pixelsForNextBottle`, `resetTime`
  - 新增计算属性：`canThrow`, `pixelProgress`, `displayText`, `formattedResetTime`

---

## 🚧 待完成的部分

### 前端实现 (iOS App)

#### 1. DriftBottleManager 完善
**文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/DriftBottle/DriftBottleManager.swift`

**需要修改**:
```swift
// ❌ 删除这个方法（旧配额系统）
func onPixelsDrawn(count: Int) {
    // ...
}

// ✅ 保留这些方法
func startEncounterDetection()
func stopEncounterDetection()
func refreshQuota() async
func throwBottle(message: String?, pixelSnapshot: PixelSnapshot?) async throws
func dismissEncounter()
func openEncounteredBottle()
```

**实施步骤**:
1. 移除 `onPixelsDrawn` 方法
2. 确保 `refreshQuota` 使用新的API响应格式
3. 测试配额刷新逻辑

#### 2. 侧边指示器更新
**文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/DriftBottle/DriftBottleSideIndicator.swift`

**需要修改**:
```swift
// 删除旧的进度条逻辑
❌ progressSection 中的 pixels_since_last_bottle 相关代码

// 添加新的画像素奖励进度条
✅ if q.bonusFromPixels == 0 && q.dailyRemaining >= q.dailyFree {
    VStack {
        Text("再画 \(q.pixelsForNextBottle) 像素获得奖励")
        ProgressView(value: q.pixelProgress)
    }
}
```

#### 3. 声音集成
**需要添加的位置**:

| 事件 | 文件 | 位置 | 音效 |
|------|------|------|------|
| 遭遇漂流瓶 | `DriftBottleManager.swift` | `checkForNearbyBottles()` | `.bottleEncounter` |
| 打开漂流瓶 | `DriftBottleOpenView.swift` | `.onAppear` | `.bottleOpen` |
| 扔瓶成功 | `DriftBottleSideIndicator.swift` | `submitBottle()` 成功后 | `.success` |
| 获得新瓶子 | `DriftBottleManager.swift` | `refreshQuota()` 检测到增加时 | `.success` |

**实施代码**:
```swift
// DriftBottleManager.swift
private func checkForNearbyBottles() async {
    // ... 检测逻辑 ...
    if let bottle = encounter.bottles.first {
        currentEncounter = bottle
        showEncounterBanner = true

        // 🆕 播放遭遇音效
        SoundManager.shared.play(.bottleEncounter)

        startBannerDismissTimer()
    }
}
```

#### 4. 地图UI集成
**文件**: `FunnyPixelsApp/FunnyPixelsApp/Views/MapTabContent.swift`

**需要修改**:
```swift
// ❌ 删除这个显示条件
if let quota = driftBottleManager.quota, quota.availableBottles > 0 {
    DriftBottleSideIndicator()
}

// ✅ 改为始终显示（只要配额已加载）
if driftBottleManager.quota != nil,
   !GPSDrawingService.shared.isGPSDrawingMode {
    HStack {
        DriftBottleSideIndicator()
            .padding(.leading, 0)
        Spacer()
    }
    .zIndex(96)
}
```

#### 5. GPSDrawingService 集成
**文件**: `FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift`

**需要移除的调用**:
```swift
// ❌ 删除画像素时调用 DriftBottleManager
// 因为配额不再与画像素直接绑定，而是后端自动计算

// 在画像素成功后，不需要调用:
// DriftBottleManager.shared.onPixelsDrawn(count: 1)
```

**替代方案**:
- 每次打开地图时自动刷新配额（已实现）
- 完成GPS绘画后刷新配额（建议添加）

```swift
// 在 GPSDrawingService.swift 的结束绘画方法中添加:
func endDrawingSession() async {
    // ... 现有逻辑 ...

    // 🆕 刷新漂流瓶配额
    await DriftBottleManager.shared.refreshQuota()
}
```

---

## 🧪 测试清单

### 后端测试

- [ ] **配额获取测试**
  ```bash
  curl -X GET "http://localhost:3001/drift-bottles/quota" \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
  预期返回:
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

- [ ] **抛出漂流瓶测试**
  ```bash
  curl -X POST "http://localhost:3001/drift-bottles/throw" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "lat": 24.4439,
      "lng": 118.0655,
      "message": "测试留言"
    }'
  ```

- [ ] **配额消耗测试**
  - 抛出1个瓶子后，`daily_used` 应该 +1
  - `daily_remaining` 应该 -1
  - `total_available` 应该 -1

- [ ] **画像素奖励测试**
  - 画50个像素后
  - 调用配额API，`bonus_from_pixels` 应该为 1
  - 再抛1个瓶子，优先消耗 `daily_remaining`
  - `daily_remaining` 用完后，再抛瓶子消耗 `bonus_from_pixels`

- [ ] **每日重置测试**
  - 等待到第二天0点（或手动调用 `resetDailyQuota()`）
  - 检查 `daily_remaining` 是否重置为 5
  - 检查 `daily_used` 是否重置为 0

### 前端测试

- [ ] **配额显示测试**
  - 打开地图，左侧漂流瓶图标应该始终显示
  - 角标颜色：有每日免费 = 绿色，只有奖励/购买 = 蓝色，用完 = 橙色"+"
  - 点击图标，侧边面板显示详细配额

- [ ] **抛瓶流程测试**
  - 在侧边面板输入留言（可选）
  - 点击"抛出漂流瓶"
  - 应该播放成功音效
  - 显示成功动画
  - 配额自动减1
  - 面板自动关闭

- [ ] **遭遇流程测试**
  - 走到有漂流瓶的地方
  - 底部弹出遭遇横幅
  - 播放遭遇音效
  - 点击"打开"
  - 显示打开视图，播放打开音效
  - 可选留言，然后放流
  - 显示放流动画

- [ ] **配额刷新测试**
  - 画50个像素
  - 回到地图查看配额
  - 应该看到 `bonusFromPixels` 增加

- [ ] **重逢功能测试**
  - 用同一账号走到自己扔的瓶子附近
  - 应该触发重逢视图（紫色主题）
  - 显示瓶子的旅程数据

---

## 📝 数据库迁移执行

### 步骤

1. **进入后端目录**
   ```bash
   cd backend
   ```

2. **运行迁移**
   ```bash
   npm run migrate
   ```

3. **验证迁移**
   ```sql
   -- 检查表是否创建
   SELECT table_name FROM information_schema.tables
   WHERE table_name = 'drift_bottle_daily_usage';

   -- 检查users表字段
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users'
   AND column_name = 'drift_bottle_pixels_redeemed';
   ```

4. **如果需要回滚**
   ```bash
   npm run migrate:rollback
   ```

---

## 🚀 启动服务

### 后端

```bash
cd backend
npm install  # 首次需要安装node-cron依赖
npm run dev
```

### 前端

```bash
cd FunnyPixelsApp
# 在Xcode中打开并运行
```

---

## 🐛 常见问题

### 问题1: 配额API返回404
**原因**: 路由未正确配置
**解决**: 检查 `backend/src/routes/*.js` 中是否有 `/drift-bottles/quota` 路由

### 问题2: 配额一直是0
**原因**: 可能是数据库迁移未执行
**解决**:
1. 检查 `drift_bottle_daily_usage` 表是否存在
2. 手动插入一条记录测试
3. 检查 `users.drift_bottle_pixels_redeemed` 字段是否存在

### 问题3: 定时任务未执行
**原因**: `node-cron` 未安装或配置错误
**解决**:
```bash
npm install node-cron --save
```
检查 `server.js` 中是否启动了任务

### 问题4: 前端角标不显示
**原因**: 显示条件限制过严
**解决**: 确保 `MapTabContent.swift` 中的显示条件为:
```swift
if driftBottleManager.quota != nil,
   !GPSDrawingService.shared.isGPSDrawingMode
```

---

## 📊 下一步工作

### 短期（本周）
- [ ] 完成前端剩余UI修改
- [ ] 集成声音反馈
- [ ] 端到端测试

### 中期（下周）
- [ ] 添加漂流瓶沉没通知
- [ ] 旅程卡片红点提示
- [ ] 性能优化

### 长期（未来）
- [ ] 商店购买集成
- [ ] 月卡订阅
- [ ] 数据分析和埋点

---

## 📄 相关文件清单

### 后端文件
```
backend/
├── src/
│   ├── controllers/driftBottleController.js (已修改)
│   ├── models/DriftBottle.js (已修改)
│   ├── services/driftBottleQuotaService.js (新建)
│   ├── tasks/resetDailyBottleQuota.js (新建)
│   ├── database/migrations/20260223000000_drift_bottle_quota_system.js (新建)
│   └── server.js (已修改)
```

### 前端文件
```
FunnyPixelsApp/
├── Models/DriftBottleModels.swift (已修改)
├── Services/DriftBottle/
│   └── DriftBottleManager.swift (待修改)
├── Views/
│   ├── MapTabContent.swift (待修改)
│   └── DriftBottle/
│       ├── DriftBottleSideIndicator.swift (待修改)
│       ├── DriftBottleOpenView.swift (需添加声音)
│       └── DriftBottleEncounterBanner.swift (需添加声音)
```

---

## ✅ 最终检查清单

在提交PR前，确保：

- [ ] 后端迁移已执行成功
- [ ] 定时任务已启动
- [ ] 配额API测试通过
- [ ] 抛瓶/开瓶流程测试通过
- [ ] 前端UI显示正确
- [ ] 声音反馈已集成
- [ ] 无控制台报错
- [ ] 代码已格式化
- [ ] 已更新相关文档

---

**实施负责人**: 待定
**预计完成时间**: 2026-02-24
**当前状态**: 🟡 进行中（后端完成70%，前端完成30%）
