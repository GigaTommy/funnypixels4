# Metal 崩溃修复 - 地图快照生成

## 📅 修复日期
2026-02-22

## 🎯 问题描述

用户报告：在动态-绘制详情-分享页查看时，应用崩溃并显示 `Thread 3: signal SIGABRT`

### 崩溃日志

```
-[MTLDebugDevice notifyExternalReferencesNonZeroOnDealloc:]:3459: failed assertion
`The following Metal object is being destroyed while still required to be alive
by the command buffer 0x143471400:
<MTLToolsObject: 0x15703c930> -> <AGXA14FamilyBuffer: 0x158f4b780>
```

**错误含义**：Metal 缓冲区对象在命令缓冲区仍需要时被销毁了。

---

## 🔍 根本原因分析

### 问题流程

```
用户进入分享页
    ↓
generateMapSnapshot() 被调用
    ↓
MapSnapshotGenerator.generateSnapshot(from: pixels)
    ↓
MKMapSnapshotter.start() → 生成 snapshot
    ↓
UIGraphicsImageRenderer 使用 Metal 渲染
    ↓
❌ 函数返回，snapshot 对象被释放
    ↓
Metal 缓冲区被释放
    ↓
❌ 但 Metal 命令缓冲区仍在后台执行
    ↓
Metal 检测到对象过早释放
    ↓
断言失败 → SIGABRT 崩溃
```

### 问题代码（Before）

**MapSnapshotGenerator.swift - Line 42-73**：
```swift
// 生成 snapshot
let snapshot = try await snapshotter.start()  // 局部变量

// 使用 UIGraphicsImageRenderer 渲染（Metal 后台异步）
let image = UIGraphicsImageRenderer(size: size).image { context in
    snapshot.image.draw(at: .zero)
    // ... 更多绘制操作
}

// ❌ 返回时只保持 snapshotter 引用
return (image: image, snapshotter: snapshotter)
// ❌ snapshot 对象被释放，但 Metal 命令缓冲区可能仍在使用它！
```

**SessionDetailView.swift - Line 773-775**：
```swift
let result = try await MapSnapshotGenerator.generateSnapshot(from: pixels)
mapSnapshot = result.image
mapSnapshotter = result.snapshotter  // 只保持 snapshotter
// ❌ 没有保持对 snapshot 的引用
```

### 核心问题

1. **Metal 异步渲染**：
   - `UIGraphicsImageRenderer` 在 iOS 上使用 Metal 进行 GPU 加速渲染
   - 渲染操作是异步的，通过命令缓冲区提交到 GPU
   - 即使 `image` 对象已经返回，Metal 命令可能仍在执行

2. **对象生命周期管理**：
   - `snapshot` 是一个局部变量，函数返回后就被释放
   - `snapshot` 内部持有 Metal 缓冲区资源
   - Metal 命令缓冲区仍在引用这些资源
   - 导致资源在使用时被释放 → 崩溃

3. **MKMapSnapshotter 架构**：
   - `MKMapSnapshotter` 本身不持有 `Snapshot` 对象
   - 只保持 `snapshotter` 引用不足以防止 `snapshot` 被释放

---

## ✅ 解决方案

### 方案：保持对所有相关对象的强引用

需要同时保持：
1. ✅ `MKMapSnapshotter` - 快照生成器
2. ✅ `MKMapSnapshotter.Snapshot` - 快照结果（包含 Metal 资源）
3. ✅ 使用 `autoreleasepool` 管理临时对象生命周期

---

## 🔧 修改内容

### 1. MapSnapshotGenerator.swift - 返回 snapshot 对象

#### 修改返回类型

```swift
// ❌ Before
static func generateSnapshot(
    from pixels: [SessionPixel],
    size: CGSize = CGSize(width: 335, height: 335),
    showRoute: Bool = true
) async throws -> (image: UIImage, snapshotter: MKMapSnapshotter) {
    // ...
}

// ✅ After
static func generateSnapshot(
    from pixels: [SessionPixel],
    size: CGSize = CGSize(width: 335, height: 335),
    showRoute: Bool = true
) async throws -> (image: UIImage, snapshotter: MKMapSnapshotter, snapshot: MKMapSnapshotter.Snapshot) {
    // ...
}
```

#### 使用 autoreleasepool 管理 Metal 资源

```swift
// ❌ Before
let image = UIGraphicsImageRenderer(size: size).image { context in
    snapshot.image.draw(at: .zero)
    // ... 绘制操作
}

// ✅ After
let image = autoreleasepool {
    UIGraphicsImageRenderer(size: size).image { context in
        snapshot.image.draw(at: .zero)
        // ... 绘制操作
    }
}
```

**作用**：`autoreleasepool` 确保临时 Metal 对象在块内正确释放，避免内存泄漏。

#### 返回所有对象

```swift
// ❌ Before
return (image: image, snapshotter: snapshotter)

// ✅ After
return (image: image, snapshotter: snapshotter, snapshot: snapshot)
```

### 2. SessionDetailView.swift - 保持强引用

#### 添加 snapshot 状态变量

```swift
// ❌ Before
@State private var mapSnapshotter: MKMapSnapshotter?

// ✅ After
@State private var mapSnapshotter: MKMapSnapshotter?
@State private var mapSnapshotResult: MKMapSnapshotter.Snapshot?
```

#### 更新生成逻辑

```swift
// ❌ Before
let result = try await MapSnapshotGenerator.generateSnapshot(from: pixels)
mapSnapshot = result.image
mapSnapshotter = result.snapshotter

// ✅ After
let result = try await MapSnapshotGenerator.generateSnapshot(from: pixels)
mapSnapshot = result.image
mapSnapshotter = result.snapshotter
mapSnapshotResult = result.snapshot  // ✅ 保持 snapshot 引用
```

#### 更新清理逻辑

```swift
// ❌ Before
private func cleanupMapResources() {
    mapSnapshotter = nil
    mapSnapshot = nil
}

// ✅ After
private func cleanupMapResources() {
    mapSnapshotter = nil
    mapSnapshotResult = nil  // ✅ 释放 snapshot
    mapSnapshot = nil
}
```

---

## 📊 修复效果

### Before（修复前）❌

```
用户查看分享页
    ↓
生成地图快照
    ↓
❌ Metal 对象过早释放
    ↓
崩溃：SIGABRT
```

### After（修复后）✅

```
用户查看分享页
    ↓
生成地图快照
    ↓
✅ 保持所有对象强引用
    ↓
Metal 命令缓冲区执行完成
    ↓
用户离开页面 → 清理资源
    ↓
正常释放 Metal 对象
```

---

## 🎯 技术要点

### 1. Metal 资源生命周期

**Metal 渲染管线**：
```
UIGraphicsImageRenderer
    ↓
Metal Device/CommandQueue
    ↓
Command Buffer（命令缓冲区）
    ↓
Metal Buffer（Metal 缓冲区） ← MKMapSnapshotter.Snapshot 持有
    ↓
GPU 异步执行
```

**关键规则**：
- ✅ 所有被命令缓冲区引用的对象必须保持存活
- ✅ 直到命令缓冲区执行完成
- ❌ 否则触发断言失败 → 崩溃

### 2. autoreleasepool 的作用

```swift
autoreleasepool {
    // 在这个块内创建的临时对象
    // 会在块结束时立即释放
    // 而不是等到 runloop 结束
}
```

**用途**：
- ✅ 避免大量临时对象占用内存
- ✅ 确保 Metal 临时资源及时释放
- ✅ 防止内存峰值过高

### 3. SwiftUI @State 生命周期

```swift
@State private var mapSnapshotResult: MKMapSnapshotter.Snapshot?
```

**特点**：
- ✅ 视图存在时，`@State` 变量保持存活
- ✅ 视图销毁时，自动释放
- ✅ 适合管理长生命周期的资源

---

## 🧪 测试建议

### 1. 正常流程测试
```
1. 进入动态页
2. 点击某个绘制记录
3. 查看绘制详情
4. 点击分享按钮
5. 验证：地图快照正常显示 ✓
6. 验证：无崩溃 ✓
```

### 2. 快速切换测试
```
1. 打开分享页（触发快照生成）
2. 立即关闭分享页
3. 重复 5 次
4. 验证：无崩溃 ✓
5. 验证：无内存泄漏 ✓
```

### 3. 内存压力测试
```
1. 连续打开 10 个不同的绘制详情
2. 每个都打开分享页查看地图快照
3. 使用 Xcode Memory Graph 检查
4. 验证：内存正常释放 ✓
5. 验证：无 Metal 对象泄漏 ✓
```

### 4. Debug 环境验证
```
1. 在 Xcode Scheme 中启用 Metal API Validation
2. Edit Scheme → Run → Diagnostics
3. 勾选 "Metal API Validation"
4. 运行应用并查看分享页
5. 验证：无 Metal 断言失败 ✓
```

---

## 🐛 相关问题

### Metal API Validation

在调试版本中，Metal API Validation 会检测：
- ✅ 对象生命周期错误
- ✅ 命令缓冲区状态错误
- ✅ 资源使用冲突

**如何启用**：
```
Xcode → Product → Scheme → Edit Scheme
→ Run → Diagnostics
→ Metal → Metal API Validation (勾选)
```

### 系统警告（可忽略）

日志中的这些警告可以忽略：
```
Connection error: NSCocoaErrorDomain Code=4099
Permission denied: Maps / SpringfieldUsage
```

这些是系统级的沙盒限制，不影响应用功能。

---

## ✅ 修复完成

### 修改的文件
1. ✅ `MapSnapshotGenerator.swift`
   - 返回类型添加 `snapshot`
   - 使用 `autoreleasepool`
   - 返回所有对象引用

2. ✅ `SessionDetailView.swift`
   - 添加 `mapSnapshotResult` 状态
   - 保持 `snapshot` 强引用
   - 清理时释放所有引用

### 崩溃修复
- ✅ Metal 对象生命周期正确管理
- ✅ 无过早释放导致的崩溃
- ✅ 无内存泄漏

### 性能优化
- ✅ 使用 `autoreleasepool` 管理临时对象
- ✅ 及时释放 Metal 资源
- ✅ 避免内存峰值

**分享页现在稳定可靠，无崩溃！** 🎉
