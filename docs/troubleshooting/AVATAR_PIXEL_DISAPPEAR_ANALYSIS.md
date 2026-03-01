# iOS App 用户头像像素消失问题 - 深度分析报告

## 问题描述
使用用户头像（avatar）绘制的像素，在绘制时可以正常显示，但切换菜单再回到地图屏幕后就消失了。使用联盟旗帜（alliance flag）的像素可以正常显示。

## 根本原因

### 1. WebSocket 同步路径中 `imageUrl` 丢失

**位置：** `HighPerformanceMVTRenderer.swift` 第1469-1521行

**问题代码：**
```swift
let update = PixelUpdate(
    id: pixel.id,
    type: resolved.type,
    lat: pixel.latitude,
    lng: pixel.longitude,
    color: pixel.color,
    emoji: resolved.emoji,
    patternId: pixel.patternId,
    materialId: pixel.materialId,
    imageUrl: nil,  // ⚠️ BUG: Pixel model doesn't have imageUrl (第1490行)
    payload: pixel.payload,
    likeCount: pixel.likeCount,
    updatedAt: pixel.updatedAt.ISO8601Format()
)
```

**问题分析：**
- WebSocket 监听器在接收到像素更新时，创建 `PixelUpdate` 对象
- `imageUrl` 字段被**硬编码为 `nil`**，导致用户头像的URL丢失
- 注释说"Pixel model doesn't have imageUrl"是**错误的**，因为 `Pixel.swift` 第24行明确定义了 `imageUrl` 字段
- 当切换菜单后，地图重新渲染依赖 WebSocket 推送的像素数据，但此时 `imageUrl` 为空，导致无法加载用户头像 sprite

### 2. MVT 瓦片扫描逻辑的限制

**位置：** `HighPerformanceMVTRenderer.swift` 第1782-1831行

**问题代码：**
```swift
guard let patternId = feature.attribute(forKey: "pattern_id") as? String,
      !loadedSprites.contains(patternId),
      let imageUrl = feature.attribute(forKey: "image_url") as? String,
      !imageUrl.isEmpty else {
    continue
}
```

**问题分析：**
- `scanAndLoadMissingComplexSprites` 方法要求同时存在 `pattern_id` 和 `image_url`
- **用户头像像素可能缺少 `pattern_id`**，导致被跳过
- 即使 MVT 瓦片包含 `image_url`，也无法被扫描和加载

### 3. GPS 绘制时临时成功的原因

**位置：** `GPSDrawingService.swift` 第946-963行，`HighPerformanceMVTRenderer.swift` 第115-159行

**成功路径：**
```swift
// GPSDrawingService 发送通知时包含 imageUrl
let userInfo: [String: Any] = [
    "imageUrl": pixel.imageUrl ?? ""  // ✅ 正确传递
]

// HighPerformanceMVTRenderer 接收通知
let pixelUpdate = PixelUpdate(
    imageUrl: userInfo["imageUrl"] as? String,  // ✅ 正确接收
)

// handleGPSPixelUpdate 注册 sprite
if let imageUrl = pixelUpdate.imageUrl {
    await registerComplexSpriteFromURL(id: patternId, urlString: imageUrl)  // ✅ 成功注册
}
```

**分析：**
- GPS 绘制使用 `NotificationCenter.default.post(name: .gpsPixelDidDraw)` 直接传递 `imageUrl`
- `handleGPSPixelUpdate` 立即注册 sprite，所以**绘制时可以显示**
- 但这只是**临时的内存中注册**，切换视图后依赖持久化数据（WebSocket/MVT），此时 sprite 丢失

### 4. 联盟旗帜正常显示的原因

**位置：** `HighPerformanceMVTRenderer.swift` 第341-434行

**成功路径：**
```swift
// SpriteService 在启动时预加载所有联盟旗帜 sprite
let loadedCount = try await spriteService.loadSpritesFromAPI(scale: 1)

// 联盟旗帜有明确的 patternId（如 "alliance_flag_1"）
// 即使 imageUrl 丢失，也能通过 patternId 找到预加载的 sprite
```

**对比：**
- **联盟旗帜：**
  - 有预定义的 `patternId`（如 "alliance_flag_1"）
  - 启动时就被 `SpriteService` 预加载
  - 不依赖运行时的 `imageUrl` 动态加载

- **用户头像：**
  - 没有预定义的 `patternId`（或 patternId 不规范）
  - 完全依赖 `imageUrl` 动态加载
  - WebSocket 同步时 `imageUrl` 丢失，导致无法加载

## 数据流对比

### 用户头像像素（失败）
```
1. GPS 绘制
   └─> GPSDrawingService.drawPixelAtLocation
       └─> 后端 API: drawPixel (返回 pixel.imageUrl ✅)
       └─> 发送通知: .gpsPixelDidDraw (包含 imageUrl ✅)
       └─> handleGPSPixelUpdate (注册 sprite ✅)
       └─> 地图显示 ✅

2. 切换菜单
   └─> 地图视图销毁，sprite 缓存清空

3. 返回地图
   └─> MapView 重新加载
   └─> 依赖 WebSocket 同步像素
       └─> setupHotpatchWebSocket
           └─> PixelUpdate.imageUrl = nil ❌  // BUG!
           └─> handlePixelUpdate (无法注册 sprite ❌)
       └─> 地图显示空白 ❌
   └─> 或依赖 MVT 瓦片
       └─> scanAndLoadMissingComplexSprites
           └─> 要求 pattern_id 存在 ❌  // 用户头像可能没有
           └─> 无法加载 sprite ❌
       └─> 地图显示空白 ❌
```

### 联盟旗帜像素（成功）
```
1. GPS 绘制
   └─> patternId = "alliance_flag_1" ✅
   └─> SpriteService 已预加载此 sprite ✅
   └─> 地图显示 ✅

2. 切换菜单
   └─> 内存中的 sprite 缓存虽然清空

3. 返回地图
   └─> MapView 重新加载
   └─> patternId = "alliance_flag_1" ✅
   └─> SpriteService 中已有 sprite ✅
   └─> 地图显示 ✅
```

## 修复方案

### 方案 1: 修复 WebSocket 同步中的 imageUrl 丢失 ⭐ 推荐

**文件：** `HighPerformanceMVTRenderer.swift`

**修改位置：** 第1469-1521行，`setupHotpatchWebSocket` 方法

**修改前：**
```swift
let update = PixelUpdate(
    id: pixel.id,
    type: resolved.type,
    lat: pixel.latitude,
    lng: pixel.longitude,
    color: pixel.color,
    emoji: resolved.emoji,
    patternId: pixel.patternId,
    materialId: pixel.materialId,
    imageUrl: nil,  // ❌ BUG
    payload: pixel.payload,
    likeCount: pixel.likeCount,
    updatedAt: pixel.updatedAt.ISO8601Format()
)
```

**修改后：**
```swift
let update = PixelUpdate(
    id: pixel.id,
    type: resolved.type,
    lat: pixel.latitude,
    lng: pixel.longitude,
    color: pixel.color,
    emoji: resolved.emoji,
    patternId: pixel.patternId,
    materialId: pixel.materialId,
    imageUrl: pixel.imageUrl,  // ✅ 使用 Pixel 模型的 imageUrl 字段
    payload: pixel.payload,
    likeCount: pixel.likeCount,
    updatedAt: pixel.updatedAt.ISO8601Format()
)
```

**影响：**
- WebSocket 同步的像素将正确保留 `imageUrl`
- `handlePixelUpdate` → `processBatchedUpdates` → `applyBatchedUpdates` 流程中会调用 `createFeatureSafe`，将 `imageUrl` 存入 feature attributes（第1714-1716行）
- 但 hotpatch 图层的渲染逻辑仍需配合修复（见方案2）

### 方案 2: 修复 handlePixelUpdate 中 complex 像素的 sprite 注册

**文件：** `HighPerformanceMVTRenderer.swift`

**修改位置：** 第1539-1568行，`handlePixelUpdate` 方法

**问题：**
- `handlePixelUpdate` 只负责将像素添加到 `pendingUpdates` 队列，并不注册 sprite
- Sprite 注册只在 `handleGPSPixelUpdate` 中执行（GPS 专用通道）
- 普通 WebSocket 像素更新不会触发 sprite 注册

**修改建议：**
在 `applyBatchedUpdates` 或 `processBatchedUpdates` 中，检查 complex 类型像素的 sprite 是否已加载，如果未加载则动态注册：

```swift
// 在 processBatchedUpdates 中添加 sprite 检查和注册
for update in updatesSnapshot {
    // 🔧 检查 complex 类型是否需要加载 sprite
    if update.type == "complex", let patternId = update.patternId ?? update.id {
        await MainActor.run { [weak self] in
            guard let self = self else { return }
            if !self.loadedSprites.contains(patternId) {
                Task {
                    if let imageUrl = update.imageUrl {
                        await self.registerComplexSpriteFromURL(id: patternId, urlString: imageUrl)
                    } else if let payload = update.payload {
                        await self.registerComplexSprite(id: patternId, payload: payload)
                    }
                }
            }
        }
    }

    let feature = self.createFeatureSafe(from: update)
    // ... 后续逻辑
}
```

### 方案 3: 修复 MVT 瓦片扫描逻辑（备选）

**文件：** `HighPerformanceMVTRenderer.swift`

**修改位置：** 第1782-1831行，`scanAndLoadMissingComplexSprites` 方法

**修改前：**
```swift
guard let patternId = feature.attribute(forKey: "pattern_id") as? String,
      !loadedSprites.contains(patternId),
      let imageUrl = feature.attribute(forKey: "image_url") as? String,
      !imageUrl.isEmpty else {
    continue
}
```

**修改后：**
```swift
// 优先使用 pattern_id，如果没有则使用 grid_id
let patternId = (feature.attribute(forKey: "pattern_id") as? String)
                ?? (feature.attribute(forKey: "grid_id") as? String)

guard let patternId = patternId,
      !loadedSprites.contains(patternId),
      let imageUrl = feature.attribute(forKey: "image_url") as? String,
      !imageUrl.isEmpty else {
    continue
}
```

**影响：**
- 允许没有 `pattern_id` 的用户头像像素被扫描
- 使用 `grid_id` 作为 fallback key

### 方案 4: 后端修复 - 为用户头像生成 patternId（最佳长期方案）

**文件：** `backend/src/services/pixelDrawService.js`（或相关后端文件）

**建议：**
后端在处理用户头像绘制时，生成唯一的 `pattern_id`：

```javascript
// 如果是用户头像类型
if (flagChoice === 'personalAvatar') {
    patternId = `user_avatar_${userId}`;
    // 确保返回 image_url 字段
    imageUrl = user.avatar_url;
}
```

**优势：**
- 统一 complex 类型像素的处理逻辑
- 利用现有的 patternId 缓存机制
- 避免重复加载同一用户的头像

## 验证步骤

1. **应用方案1修复后：**
   ```bash
   # 清理并重新构建
   cd FunnyPixelsApp
   xcodebuild clean
   xcodebuild build
   ```

2. **测试场景：**
   - 使用用户头像绘制像素
   - 切换到其他Tab（如商店、联盟）
   - 返回地图Tab
   - 检查用户头像像素是否仍然显示

3. **日志验证：**
   搜索日志关键字：
   - `"✅ [Renderer] Registered complex sprite SUCCESS"` - sprite 注册成功
   - `"imageUrl"` - 检查 WebSocket 同步是否包含 imageUrl
   - `"🔍 [Renderer] Found ... missing complex sprites"` - MVT 扫描是否识别缺失的 sprite

## 相关文件清单

### iOS App 端
1. **FunnyPixelsApp/FunnyPixelsApp/Models/Pixel.swift**
   - 定义了 `imageUrl` 字段（第24行）

2. **FunnyPixelsApp/FunnyPixelsApp/Services/Map/HighPerformanceMVTRenderer.swift**
   - `setupHotpatchWebSocket` (第1469-1521行) - **主要 BUG 位置**
   - `handlePixelUpdate` (第1539-1568行)
   - `scanAndLoadMissingComplexSprites` (第1782-1831行)
   - `registerComplexSpriteFromURL` (第202-261行)

3. **FunnyPixelsApp/FunnyPixelsApp/Services/Drawing/GPSDrawingService.swift**
   - `drawPixelAtLocation` (第849-989行) - GPS 绘制成功的参考实现

4. **FunnyPixelsApp/FunnyPixelsApp/Services/Network/SocketIOManager.swift**
   - `handlePixelDiff` (第451-467行) - WebSocket 像素差异处理

### 后端
1. **backend/src/services/pixelDrawService.js**
   - 像素绘制逻辑，应确保返回 `image_url` 字段

2. **backend/src/models/Pixel.js**
   - 像素模型定义

3. **backend/src/routes/productionMVTRoutes.js**
   - MVT 瓦片生成，应包含 `image_url` 字段

## 总结

**主要问题：**
- WebSocket 同步时 `imageUrl` 被错误地设为 `nil`
- MVT 瓦片扫描要求 `pattern_id` 存在，但用户头像可能缺少此字段

**解决方案：**
1. **立即修复：** 将 `setupHotpatchWebSocket` 中的 `imageUrl: nil` 改为 `imageUrl: pixel.imageUrl`
2. **配合修复：** 在批量更新逻辑中添加 sprite 动态注册
3. **长期优化：** 后端为用户头像生成规范的 `pattern_id`

**影响范围：**
- 所有使用用户头像绘制的像素
- 其他依赖 `imageUrl` 的 complex 类型像素（如自定义图案）
