# GPS绘制功能验证指南

## ✅ 已完成的修复

### 1. GPS跟随功能检查

**功能状态**: ✅ 正常工作

**实现位置**: `MapController.swift`

**关键功能**:
```swift
func updateForGPSFollowing(location: CLLocation)
```

**工作流程**:
1. GPS绘制开始时调用 `startGPSFollowing()`
2. 每次位置更新时调用 `updateForGPSFollowing(location:)`
3. 地图自动跟随到新位置
4. 根据速度动态调整缩放级别：
   - 低速（<3km/h）：zoom 17-18
   - 中速（3-10km/h）：zoom 16
   - 高速（>10km/h）：zoom 15

**暂停机制**:
- 用户手动拖动地图时自动暂停10秒
- 暂停期间仍更新位置数据，但不移动地图
- 10秒后自动恢复跟随

**日志示例**:
```
🎯 GPS跟随模式已启动
🎯 GPS跟随: 速度=0.0km/h, zoom=18.0
```

### 2. 瓦片失效事件处理（新增）

**问题**: iOS app未监听后端发送的`tileInvalidate`事件

**修复**: 添加WebSocket事件处理器

**修改文件**:
- `Services/Network/SocketIOManager.swift`
- `Services/Map/HighPerformanceMVTRenderer.swift`

**新增功能**:

#### SocketIOManager (Line ~350)
```swift
// 监听tileInvalidate事件
socket.on("tileInvalidate") { [weak self] data, ack in
    guard let self = self else { return }
    Task {
        await self.handleTileInvalidate(data)
    }
}
```

#### TileInvalidate发布者 (Line ~56)
```swift
/// 瓦片失效发布者 (当像素更新需要刷新MVT瓦片时触发)
private let tileInvalidateSubject = PassthroughSubject<(gridId: String, tileIds: [String], reason: String), Never>()

public var tileInvalidatePublisher: AnyPublisher<(gridId: String, tileIds: [String], reason: String), Never> {
    tileInvalidateSubject.eraseToAnyPublisher()
}
```

#### HighPerformanceMVTRenderer订阅 (Line ~1504)
```swift
// 注册瓦片失效处理器
invalidatePublisher
    .receive(on: DispatchQueue.main)
    .sink { [weak self] event in
        guard let self else { return }
        Logger.info("🔄 收到瓦片失效: gridId=\(event.gridId), tiles=\(event.tileIds.count)")
        Task { @MainActor in
            await self.handleTileInvalidate(gridId: event.gridId, tileIds: event.tileIds, reason: event.reason)
        }
    }
    .store(in: &cancellables)
```

**工作流程**:
```
用户绘制像素
    ↓
后端保存到数据库
    ↓
后端发送WebSocket事件: tileInvalidate
    ↓
iOS SocketIOManager接收事件
    ↓
发布到tileInvalidatePublisher
    ↓
HighPerformanceMVTRenderer处理
    ↓
记录日志（MapLibre自动处理缓存刷新）
```

### 3. 诊断日志增强

**GPS绘制流程日志**:

#### 测试GPS模式
```
🎯 [LocationPicker] User selected coordinate: XX.XXX, XX.XXX
🎯 [LocationPicker] Location name: 先烈中路辅路
🎯 [Callback] Received coordinate from picker: XX.XXX, XX.XXX
🎯 [Callback] After 500ms sleep, coordinate is: XX.XXX, XX.XXX
🎯 [ContentView] Received center parameter: XX.XXX, XX.XXX
🎯 [ContentView] Using testCenter: XX.XXX, XX.XXX
🎯 [GPS Test] Starting GPS test with baseCoord: XX.XXX, XX.XXX
🎯 [GPS Test] Point 1: XX.XXX, XX.XXX (offset: 10.3m)
🎯 [GPS Test] Point 2: XX.XXX, XX.XXX (offset: 8.7m)
🎯 [GPS Test] Point 3: XX.XXX, XX.XXX (offset: 12.1m)
```

#### 真实GPS模式
```
🎯 [Real GPS] Received location: XX.XXX, XX.XXX, accuracy: 15.5m
🎯 [GPS Draw] Original coordinate: XX.XXX, XX.XXX
🎯 [GPS Draw] Snapped coordinate: XX.XXX, XX.XXX
```

#### 瓦片失效事件
```
🔄 收到瓦片失效通知: gridId=grid_2933022_1131430, reason=pixelUpdate, tiles=7
🔄 处理瓦片失效: gridId=grid_2933022_1131430, reason=pixelUpdate
```

## 🧪 验证步骤

### 测试1: GPS跟随功能

**目标**: 确认地图跟随绘制点移动

**步骤**:
1. 打开TestLocationPicker
2. 选择一个位置（如：先烈中路）
3. 点击"Start Test Here"
4. 观察地图行为

**预期结果**:
- ✅ 地图自动跟随每个绘制点
- ✅ 缩放级别保持在18
- ✅ 日志显示 `🎯 GPS跟随: 速度=0.0km/h, zoom=18.0`

**问题排查**:
- 如果地图不移动：检查 `MapController.isFollowingGPS` 是否为true
- 如果地图跳来跳去：检查是否有其他地方调用了setCenter

### 测试2: 像素渲染显示

**目标**: 确认绘制的像素能正确显示

**步骤**:
1. 完成一次GPS测试绘制（10个点）
2. 观察绘制过程中的预览
3. 停止绘制
4. 查看最终结果

**预期结果**:

**绘制过程中**:
- ✅ 看到绿色预览方块（头像sprite加载需要时间）
- ✅ 日志显示：`✅ 添加像素预览: XX.XXX, XX.XXX, type: color, sprite: preview_color_#4ECDC4`

**绘制完成后**:
- ✅ 接收到WebSocket事件：`🔄 收到瓦片失效: gridId=grid_XXX_XXX`
- ✅ 像素在数据库中存在
- ✅ 后续刷新时从MVT加载显示

**问题排查**:
- 如果看不到预览：检查 `GPSDrawingService.addPixelPreview` 是否被调用
- 如果预览一直是绿色：正常，sprite加载需要时间
- 如果没有收到tileInvalidate：检查WebSocket连接状态

### 测试3: 真实GPS绘制

**目标**: 验证真实GPS模式也能正常工作

**步骤**:
1. 在室外启动真实GPS绘制
2. 等待GPS精度稳定（<20米）
3. 开始绘制
4. 观察日志和地图

**预期结果**:
```
🎯 [Real GPS] Received location: XX.XXX, XX.XXX, accuracy: 12.3m
🎯 [GPS Draw] Original coordinate: XX.XXX, XX.XXX
🎯 [GPS Draw] Snapped coordinate: XX.XXX, XX.XXX
🎯 GPS跟随: 速度=0.5km/h, zoom=17.5
🔄 收到瓦片失效: gridId=grid_XXX_XXX
```

**GPS精度参考**:
| 环境 | 预期精度 | 是否可用 |
|-----|---------|---------|
| 室外空旷 | 5-10米 | ✅ 推荐 |
| 城市街道 | 10-20米 | ✅ 可用 |
| 高楼区 | 20-40米 | ⚠️ 可能偏移较大 |
| 室内 | 40米+ | ❌ 不建议 |

## 🎯 功能确认清单

### GPS跟随功能
- [ ] 地图自动跟随绘制点移动
- [ ] 缩放级别根据速度调整
- [ ] 用户手动拖动时暂停跟随
- [ ] 10秒后自动恢复跟随
- [ ] 日志正确显示GPS跟随状态

### 像素显示功能
- [ ] 绘制时显示预览（绿色方块）
- [ ] 接收到tileInvalidate事件
- [ ] 像素成功保存到数据库
- [ ] 后续能从MVT加载显示
- [ ] WebSocket连接正常

### 真实GPS功能
- [ ] 接收真实GPS位置更新
- [ ] 过滤低精度位置（>40米）
- [ ] 日志显示GPS精度
- [ ] 坐标网格对齐正确
- [ ] 绘制结果符合预期

## 📊 预期日志流程

### 完整的GPS绘制流程日志

```
# 1. 用户选择位置
🎯 [LocationPicker] User selected coordinate: 23.143094590053177, 113.30231330040561
🎯 [LocationPicker] Location name: 先烈中路辅路, 越秀区, 广州市

# 2. Callback传递
🎯 [Callback] Received coordinate from picker: 23.143094590053177, 113.30231330040561
🎯 [Callback] After 500ms sleep, coordinate is: 23.143094590053177, 113.30231330040561

# 3. 开始测试
🎯 [ContentView] Received center parameter: 23.143094590053177, 113.30231330040561
🎯 [ContentView] Using testCenter: 23.143094590053177, 113.30231330040561
🎯 GPS跟随模式已启动
🎯 [GPS Test] Starting GPS test with baseCoord: 23.143094590053177, 113.30231330040561

# 4. 绘制点
🎯 [GPS Test] Point 1: 23.14300515114284, 113.30228756289446 (offset: 10.3m)
🎯 GPS跟随: 速度=0.0km/h, zoom=18.0
🎯 [GPS Draw] Original coordinate: 23.14300515114284, 113.30228756289446
🎯 [GPS Draw] Snapped coordinate: 23.143050000000002, 113.30225000000003

# 5. 预览显示
✅ 添加像素预览: 23.143050000000002, 113.30225000000003, type: color, sprite: preview_color_#4ECDC4

# 6. API调用
🎨 Drawing pixel at: 23.143050000000002, 113.30225000000003 - Type: complex, Mode: gps
✅ Pixel drawn successfully: grid_2933022_1131430

# 7. WebSocket事件
🔄 收到瓦片失效: gridId=grid_2933022_1131430, tiles=7
🔄 处理瓦片失效: gridId=grid_2933022_1131430, reason=pixelUpdate

# 8. 重复Point 2-10...
```

## 🐛 常见问题排查

### 问题1: 地图不跟随

**症状**: 绘制时地图不移动

**检查**:
```bash
# 搜索日志
grep "GPS跟随" Xcode日志

# 应该看到:
🎯 GPS跟随模式已启动
🎯 GPS跟随: 速度=X.Xkm/h, zoom=XX.X
```

**解决**:
- 确认 `GPSDrawingService.startGPSDrawing()` 调用了 `MapController.shared.startGPSFollowing()`
- 检查 `isFollowingGPS` 是否为true

### 问题2: 没有收到tileInvalidate事件

**症状**: 日志中没有 `🔄 收到瓦片失效`

**检查**:
```bash
# 搜索WebSocket日志
grep "tileInvalidate" Xcode日志

# 应该看到:
LOG SocketIOClient{/}: Handling event: tileInvalidate
🔄 收到瓦片失效通知: gridId=...
```

**解决**:
- 检查WebSocket连接状态
- 确认后端正在发送tileInvalidate事件
- 检查SocketIOManager是否注册了tileInvalidate处理器

### 问题3: 像素不显示

**症状**: 绘制完成后看不到像素

**检查步骤**:

1. **预览是否显示**:
   ```
   grep "添加像素预览" Xcode日志
   ```

2. **API是否成功**:
   ```
   grep "Pixel drawn successfully" Xcode日志
   ```

3. **WebSocket事件**:
   ```
   grep "tileInvalidate" Xcode日志
   ```

4. **数据库验证**:
   ```bash
   # 后端查询
   node -e "
   require('./src/config/env').loadEnvConfig();
   const { db } = require('./src/config/database');
   (async () => {
     const pixels = await db('pixels')
       .where('grid_id', 'grid_2933022_1131430')
       .select('*');
     console.log(pixels);
     await db.destroy();
   })();
   "
   ```

**可能原因**:
- MVT瓦片缓存未刷新 → 重启App或缩放地图触发刷新
- Sprite未加载 → 等待或重试
- 权限问题 → 检查用户points余额

## ✅ 验证成功标准

所有测试通过后，应该满足：

1. ✅ **GPS跟随正常**: 地图自动跟随绘制点移动
2. ✅ **坐标传递正确**: 日志显示坐标流向正确
3. ✅ **像素预览显示**: 绘制时能看到预览
4. ✅ **WebSocket事件接收**: 收到tileInvalidate通知
5. ✅ **数据库保存成功**: 像素存在数据库中
6. ✅ **最终渲染正常**: 刷新后能看到像素

## 🎉 总结

已完成的改进：
- ✅ GPS跟随功能验证正常
- ✅ 添加tileInvalidate事件处理
- ✅ 增强诊断日志
- ✅ 真实GPS和测试GPS都有完整日志

现在GPS绘制功能应该能够：
- 自动跟随绘制点移动
- 正确接收WebSocket更新事件
- 显示预览并最终渲染像素
- 提供完整的调试信息

请按照验证步骤测试，如有任何问题请提供完整日志！
