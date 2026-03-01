# 漂流瓶入口显示问题排查报告

## 问题描述
用户 bcd 看不到漂流瓶入口，无法使用漂流瓶功能。

---

## 漂流瓶入口位置

### 📍 在哪里？
**地图Tab (主页第一个Tab) 左侧**

### 🎨 外观特征
- **图标**：小船图标 (sailboat.fill)
- **颜色**：青色 (Cyan)
- **位置**：屏幕左侧中央垂直居中
- **角标**：右上角显示可用瓶子数量（红色圆圈）

### 📱 显示效果
```
┌──────────────────────────────┐
│  [地图 Tab]                  │
│                              │
│  🛥️ ← 左侧漂流瓶按钮          │
│   4  (角标显示可用数量)       │
│                              │
│        [地图内容]             │
│                              │
│                              │
└──────────────────────────────┘
```

---

## 显示条件（代码分析）

### 必须满足的条件
根据 `MapTabContent.swift` Line 467-473：

```swift
// 🍾 左侧漂流瓶指示器（始终显示，只要配额已加载）
if driftBottleManager.quota != nil,
   !GPSDrawingService.shared.isGPSDrawingMode {
    HStack {
        DriftBottleSideIndicator()
            .padding(.leading, 0)
        Spacer()
    }
```

**两个条件必须同时满足**：
1. ✅ `driftBottleManager.quota != nil` - 配额已成功加载
2. ✅ `!GPSDrawingService.shared.isGPSDrawingMode` - 不在GPS绘制模式

---

## 诊断结果

### ✅ 后端API状态
```
用户 bcd:
  ├─ 总像素: 221
  ├─ 可抛瓶数: 4 个 ✅
  ├─ 可拾取数: 5 次 ✅
  ├─ 每日免费: 5/5 ✅
  └─ API响应: 正常 ✅
```

**后端完全正常，配额计算正确。**

### 🔍 前端问题排查

#### 问题1: 配额未加载 (`quota == nil`)

**原因**：
- APP启动时配额API调用失败
- Token过期或无效
- 网络连接问题
- 后端服务未启动

**检查方法**：
在APP代码中查看日志，确认是否有以下错误：
```
"Failed to fetch quota: ..."
"Authentication failed"
"Network connection failed"
```

**解决方法**：
1. **完全退出登录，重新登录**（推荐）
2. 强制关闭APP，重新打开
3. 检查网络连接
4. 确认后端服务正在运行

---

#### 问题2: GPS绘制模式开启

**原因**：
当用户进入GPS轨迹绘制模式时，漂流瓶入口会自动隐藏，避免界面冲突。

**检查方法**：
- 查看屏幕底部是否有"GPS绘制"相关UI
- 查看地图上方是否有轨迹绘制控制按钮
- 检查是否正在进行路径记录

**解决方法**：
退出GPS绘制模式：
1. 点击屏幕上的"停止绘制"按钮
2. 或者点击GPS绘制的关闭按钮
3. 漂流瓶入口会自动重新显示

---

#### 问题3: Token过期

**检查方法**：
使用诊断脚本生成的Token测试API：

```bash
curl -X GET http://192.168.0.3:3001/api/drift-bottles/quota \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**预期响应**：
```json
{
  "quota": {
    "daily_free": 5,
    "daily_remaining": 5,
    "bonus_from_pixels": 4,
    "total_throw_available": 4,
    "total_pickup_available": 5
  }
}
```

**如果返回401错误**：
- Token已过期
- 需要重新登录

---

#### 问题4: 网络连接问题

**检查方法**：
1. APP其他功能是否正常（地图、像素绘制等）
2. 是否能看到其他用户的像素
3. 排行榜是否能加载

**解决方法**：
1. 检查WiFi/移动网络连接
2. 确认能访问 `http://192.168.0.3:3001`
3. 尝试切换网络

---

## 配额加载流程（代码）

### 1. APP启动时加载
**文件**: `ContentView.swift` Line 207-209

```swift
// 🍾 启动漂流瓶遭遇检测和配额刷新
DriftBottleManager.shared.startEncounterDetection()
await DriftBottleManager.shared.refreshQuota()
await DriftBottleManager.shared.refreshUnreadCount()
```

### 2. refreshQuota() 实现
**文件**: `DriftBottleManager.swift` Line 341-372

```swift
func refreshQuota() async {
    do {
        let newQuota = try await api.getQuota()
        quota = newQuota
        Logger.debug("📊 Quota updated: \(newQuota.totalAvailable) available")
    } catch {
        Logger.error("Failed to fetch quota: \(error)")
        // quota 保持为 nil，导致入口不显示
    }
}
```

**关键点**：
- 如果API调用失败，`quota` 会保持为 `nil`
- 入口不会显示

---

## 解决方案（按优先级）

### 方案1: 重新登录（推荐）✅
**操作步骤**：
1. 打开APP
2. 进入"个人"Tab（右下角）
3. 点击"退出登录"
4. 重新登录账号 bcd
5. 回到地图Tab
6. 检查左侧是否出现小船图标

**原理**：
- 清除所有缓存和状态
- 重新获取Token
- 重新加载配额

---

### 方案2: 检查GPS绘制模式
**操作步骤**：
1. 打开地图Tab
2. 检查是否在GPS绘制模式
3. 如果是，点击停止/退出按钮
4. 漂流瓶入口应该立即出现

---

### 方案3: 强制刷新APP
**操作步骤**：
1. 双击Home键（或上滑）
2. 完全关闭APP
3. 重新打开APP
4. 等待配额加载（约1-2秒）

---

### 方案4: 手动测试API（开发调试）
使用诊断脚本生成的curl命令测试：

```bash
# 1. 测试配额API
curl -X GET http://192.168.0.3:3001/api/drift-bottles/quota \
  -H "Authorization: Bearer <TOKEN>"

# 2. 测试抛瓶API（可选）
curl -X POST http://192.168.0.3:3001/api/drift-bottles/throw \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "测试留言",
    "pixelSnapshot": [["#FF5733","#33FF57","#3357FF","#F333FF","#FF33F3"],["#33FFF3","#FFD700","#FFA500","#FF5733","#33FF57"],["#3357FF","#F333FF","#FF33F3","#33FFF3","#FFD700"],["#FFA500","#FF5733","#33FF57","#3357FF","#F333FF"],["#FF33F3","#33FFF3","#FFD700","#FFA500","#FF5733"]]
  }'
```

---

## 功能使用指南（入口出现后）

### 1. 打开漂流瓶面板
- 点击左侧小船图标
- 侧边面板从左侧滑出

### 2. 查看配额
面板显示：
```
🛥️ 漂流瓶 x4

[留言输入框]
0/50

[扔出按钮]

━━━━━━━━━━━━
每日免费: 5/5
画像素奖励: +4
```

### 3. 抛出漂流瓶
1. 在输入框填写留言（最多50字，可选）
2. 点击"扔出"按钮
3. 系统自动：
   - 消耗50像素
   - 创建漂流瓶
   - 漂流瓶开始随机漂流
4. 成功后显示："漂流瓶已扔出！"

### 4. 拾取漂流瓶
- 当附近有漂流瓶时（100米内）
- 屏幕底部会弹出横幅通知
- 点击"打开"即可拾取

---

## 技术细节

### API端点
```
Base URL: http://192.168.0.3:3001

GET  /api/drift-bottles/quota          # 获取配额
POST /api/drift-bottles/throw          # 抛瓶
GET  /api/drift-bottles/encounter      # 检查遭遇
POST /api/drift-bottles/:id/lock       # 锁定瓶子
POST /api/drift-bottles/:id/open       # 打开瓶子
```

### 认证
所有API需要JWT Token：
```
Authorization: Bearer <token>
```

### 配额系统
- **抛瓶配额**: 每50像素 = 1个瓶子
- **拾取配额**: 每日免费5次 + 抛瓶奖励（每抛1瓶 = +2次拾取）
- **重置时间**: 每日0点

---

## 诊断工具

### 后端诊断脚本
```bash
cd /Users/ginochow/code/funnypixels3
node backend/scripts/diagnose-user-drift-bottle.js bcd
```

**输出内容**：
- 用户基本信息
- 配额计算详情
- 测试Token
- curl命令示例
- 问题诊断和解决方案

### 配额测试脚本
```bash
node backend/scripts/test-user-bcd-quota.js
```

**输出内容**：
- 用户配额信息
- 计算过程验证
- 操作指南

---

## 常见问题 (FAQ)

### Q1: 为什么我的配额是0？
**A**: 需要先画像素。每50像素 = 1个漂流瓶。

### Q2: 为什么我看不到入口？
**A**:
1. 检查是否在GPS绘制模式（退出即可）
2. 尝试重新登录
3. 检查网络连接

### Q3: 为什么抛瓶后配额没减少？
**A**:
- 后端已消耗50像素
- APP需要刷新配额
- 尝试重新打开面板

### Q4: 如何获得更多瓶子？
**A**:
1. 画更多像素（每50像素 = 1瓶）
2. 抛出瓶子后，可获得拾取奖励

### Q5: 漂流瓶会漂到哪里？
**A**:
- 随机方向漂流
- 每6小时自动漂流一次
- 初始距离30-80km
- 7天后加速到60-160km

---

## 总结

### 用户 bcd 当前状态
```
✅ 配额: 4个可用瓶子
✅ 后端API: 正常
✅ 配额计算: 正确
❓ 前端显示: 待检查
```

### 最可能的原因
1. **APP未加载配额** (最可能)
   - Token过期
   - 网络问题
   - 缓存问题

2. **GPS绘制模式开启**
   - 检查是否在绘制轨迹
   - 退出即可

### 推荐操作
**请用户执行**：
1. 完全退出登录
2. 重新登录账号 bcd
3. 进入地图Tab
4. 检查左侧是否有小船图标
5. 如果仍未显示，检查是否在GPS绘制模式

**开发调试**：
1. 使用诊断脚本验证后端API
2. 检查APP日志查看配额加载错误
3. 使用curl命令测试API连通性

---

**文档创建时间**: 2026-02-24 19:48
**诊断结果**: 后端正常，前端配额加载可能失败
**建议操作**: 重新登录APP
