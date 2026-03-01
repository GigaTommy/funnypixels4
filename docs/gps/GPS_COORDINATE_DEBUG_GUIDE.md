# GPS坐标调试指南

## 🎯 问题描述

用户选择**张民达墓**，但绘制时显示在**广州动物园**。
这不是逐渐漂移问题，而是从一开始就在错误的位置。

## 🔍 新增诊断日志

已在以下位置添加日志以追踪坐标流向：

### 1. TestLocationPickerView (选择位置时)
```swift
🎯 [LocationPicker] User selected coordinate: 23.148xxx, 113.293xxx
🎯 [LocationPicker] Location name: 张民达墓
```

### 2. ContentView.runRandomGPSTest (接收坐标时)
```swift
🎯 [ContentView] Received center parameter: 23.148xxx, 113.293xxx
🎯 [ContentView] Using testCenter: 23.148xxx, 113.293xxx
```

### 3. GPS测试循环开始时
```swift
🎯 [GPS Test] Starting GPS test with baseCoord: 23.148xxx, 113.293xxx
```

### 4. 前3个绘制点
```swift
🎯 [GPS Test] Point 1: 23.14812, 113.29305 (offset: 8.5m)
🎯 [GPS Test] Point 2: 23.14795, 113.29320 (offset: 12.3m)
🎯 [GPS Test] Point 3: 23.14805, 113.29310 (offset: 10.1m)
```

## 🧪 测试步骤

### 第1步：重新编译iOS App
```bash
# 在Xcode中
1. Product → Clean Build Folder (⌘⇧K)
2. Product → Build (⌘B)
3. Product → Run (⌘R)
```

### 第2步：打开TestLocationPicker
1. 点击测试位置选择器
2. **移动地图到张民达墓**
3. 观察底部显示的地址名称（应该包含"张民达墓"）
4. 观察显示的坐标（大约 23.148, 113.293）

### 第3步：点击"Start Test Here"

**预期日志**:
```
🎯 [LocationPicker] User selected coordinate: 23.148xxx, 113.293xxx
🎯 [LocationPicker] Location name: 张民达墓
🎯 [ContentView] Received center parameter: 23.148xxx, 113.293xxx
🎯 [ContentView] Using testCenter: 23.148xxx, 113.293xxx
🎯 [GPS Test] Starting GPS test with baseCoord: 23.148xxx, 113.293xxx
🎯 [GPS Test] Point 1: 23.148xxx, 113.293xxx (offset: Xm)
🎯 [GPS Test] Point 2: 23.148xxx, 113.293xxx (offset: Xm)
🎯 [GPS Test] Point 3: 23.148xxx, 113.293xxx (offset: Xm)
```

## 🔍 诊断问题

### 场景A：坐标在LocationPicker就是错的

**症状**:
```
🎯 [LocationPicker] User selected coordinate: 23.158xxx, 113.286xxx  ← 这是广州动物园！
🎯 [LocationPicker] Location name: 张民达墓  ← 但名称是对的
```

**原因**: currentCenter状态更新有问题，或者地图实际没有移动到张民达墓

**解决**:
1. 检查用户是否真的移动了地图到张民达墓
2. 检查onMapCameraChange是否正确更新currentCenter

### 场景B：坐标在传递过程中变了

**症状**:
```
🎯 [LocationPicker] User selected coordinate: 23.148xxx, 113.293xxx  ✅ 正确
🎯 [ContentView] Received center parameter: 23.158xxx, 113.286xxx  ❌ 变了！
```

**原因**: callback参数传递有问题

**解决**: 检查ContentView中的onSelect回调实现

### 场景C：testCenter使用了fallback

**症状**:
```
🎯 [ContentView] Received center parameter: 23.148xxx, 113.293xxx  ✅ 正确
🎯 [ContentView] Using testCenter: 23.158xxx, 113.286xxx  ❌ 使用了mapController
```

**原因**: center参数是nil，使用了mapController.getCenterCoordinate()作为fallback

**解决**: 检查为什么center参数变成了nil

### 场景D：所有日志都是正确的坐标

**症状**:
```
所有日志显示: 23.148xxx, 113.293xxx  ✅ 张民达墓的坐标
但绘制结果还是在广州动物园
```

**原因**: 问题在DrawingService或后端API

**解决**: 检查DrawingService的坐标对齐逻辑

## 📍 参考坐标

### 张民达墓
- 纬度: ~23.148
- 经度: ~113.293
- 附近: 先烈中路、中山三院

### 广州动物园
- 纬度: ~23.158
- 经度: ~113.286
- 差距: 约1-1.5公里

## 🎯 快速验证

在Xcode控制台执行：
```
# 筛选诊断日志
grep "🎯" Xcode日志

# 应该看到完整的坐标流向
```

## 📊 预期vs实际

| 步骤 | 预期坐标 | 实际坐标 | 状态 |
|-----|---------|---------|------|
| LocationPicker选择 | 23.148, 113.293 | ??? | ❓ |
| ContentView接收 | 23.148, 113.293 | ??? | ❓ |
| GPS Test使用 | 23.148, 113.293 | ??? | ❓ |
| 绘制Point 1-3 | 23.148±0.0001, 113.293±0.0001 | ??? | ❓ |

## 🔧 下一步

1. **运行测试并收集日志**
2. **根据日志判断问题出现在哪个环节**
3. **对症下药修复**

请提供完整的日志输出，包含所有🎯标记的行！
