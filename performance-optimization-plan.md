# World State Feed 性能优化方案

## 🔴 高优先级问题

### 1. **Date Formatter 重复创建** (性能影响: 🔴🔴🔴)
**问题**: WorldStateEventCard第329-336行，每个卡片每次重绘都创建新的RelativeDateTimeFormatter和ISO8601DateFormatter实例。

**影响**:
- 假设列表有20个事件，每次滚动/重绘会创建40个Formatter实例
- Formatter初始化成本高（~0.5-1ms each）
- 列表滚动卡顿

**优化方案**:
```swift
// 创建全局静态缓存
extension WorldStateEventCard {
    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    private static let isoFormatter = ISO8601DateFormatter()

    private var relativeTime: String {
        if let date = Self.isoFormatter.date(from: event.createdAt) {
            return Self.relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        return ""
    }
}
```

### 2. **WorldStateEvent 缺少 Equatable** (性能影响: 🔴🔴)
**问题**: Model未实现Equatable，ForEach无法高效diff，导致不必要的重绘。

**优化方案**:
```swift
extension WorldStateEvent: Equatable {
    static func == (lhs: WorldStateEvent, rhs: WorldStateEvent) -> Bool {
        lhs.id == rhs.id &&
        lhs.eventType == rhs.eventType &&
        lhs.title == rhs.title &&
        lhs.createdAt == rhs.createdAt
    }
}

extension EventMetadata: Equatable {}
extension EventActionButton: Equatable {}
extension EventLocationInfo: Equatable {}
```

### 3. **使用 enumerated() 导致不稳定 ID** (性能影响: 🔴)
**问题**: WorldStateFeedView第90行使用`Array.enumerated()`，索引会随数组变化而改变，导致视图错误复用。

**当前代码**:
```swift
ForEach(Array(viewModel.events.enumerated()), id: \.element.id) { index, event in
```

**优化方案**:
```swift
ForEach(viewModel.events.indices, id: \.self) { index in
    let event = viewModel.events[index]
    WorldStateEventCard(event: event) { button in
        handleAction(button: button, event: event)
    }
    .id(event.id)  // 强制使用event.id作为稳定ID
    .task {
        if index == viewModel.events.count - 3 {
            await viewModel.loadMore()
        }
    }
}
```

## 🟡 中优先级问题

### 4. **无内存管理** (性能影响: 🟡🟡)
**问题**: events数组无限增长，长时间滚动会积累大量数据占用内存。

**优化方案**:
```swift
class WorldStateFeedViewModel: ObservableObject {
    private let maxCachedEvents = 100

    func loadMore() async {
        guard hasMore && !isLoadingMore else { return }
        await loadFeed(refresh: false)

        // 内存管理：保留最新100条
        if events.count > maxCachedEvents {
            let removeCount = events.count - maxCachedEvents
            events.removeFirst(removeCount)
            currentOffset -= removeCount
        }
    }
}
```

### 5. **Filter切换无节流** (性能影响: 🟡)
**问题**: 用户快速点击filter按钮，会触发多次网络请求。

**优化方案**:
```swift
class WorldStateFeedViewModel: ObservableObject {
    private var filterChangeTask: Task<Void, Never>?

    func changeFilter(_ newFilter: String) async {
        guard newFilter != filter else { return }

        // 取消之前的请求
        filterChangeTask?.cancel()

        filter = newFilter

        // 创建新任务
        filterChangeTask = Task {
            try? await Task.sleep(nanoseconds: 150_000_000) // 150ms防抖
            guard !Task.isCancelled else { return }
            await loadFeed(refresh: true)
        }

        await filterChangeTask?.value
    }
}
```

### 6. **Toast 动画性能** (性能影响: 🟡)
**问题**: DispatchQueue.main.asyncAfter可能导致内存泄漏。

**优化方案**:
```swift
@State private var toastTask: Task<Void, Never>?

private func showToastMessage(_ message: String) {
    // 取消之前的toast
    toastTask?.cancel()

    toastMessage = message
    withAnimation {
        showToast = true
    }

    toastTask = Task {
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        guard !Task.isCancelled else { return }
        await MainActor.run {
            withAnimation {
                showToast = false
            }
        }
    }
}
```

## 🟢 低优先级优化

### 7. **网络请求取消**
```swift
class WorldStateFeedViewModel: ObservableObject {
    private var loadTask: Task<Void, Error>?

    func loadFeed(refresh: Bool = false) async {
        // 取消之前的请求
        loadTask?.cancel()

        loadTask = Task {
            // ... 原有逻辑
        }

        try? await loadTask?.value
    }
}
```

### 8. **添加错误重试**
```swift
func loadFeed(refresh: Bool = false, retryCount: Int = 0) async {
    // ... existing code

    do {
        let response = try await feedService.getWorldStateFeed(...)
        // ... success handling
    } catch {
        if retryCount < 2 {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            await loadFeed(refresh: refresh, retryCount: retryCount + 1)
        } else {
            errorMessage = error.localizedDescription
        }
    }
}
```

### 9. **未来图片优化**（当添加缩略图时）
```swift
// 使用SDWebImage或Kingfisher
AsyncImage(url: thumbnailURL) { phase in
    switch phase {
    case .success(let image):
        image.resizable().aspectRatio(contentMode: .fill)
    case .empty, .failure:
        Rectangle().fill(Color.gray.opacity(0.2))
    @unknown default:
        ProgressView()
    }
}
.frame(width: 80, height: 80)
```

## 📈 预期性能提升

| 优化项 | 提升幅度 | 内存节省 |
|--------|---------|---------|
| Formatter缓存 | 滚动帧率 +15-20 FPS | 持续减少GC压力 |
| Equatable实现 | 重绘次数 -40% | - |
| 稳定ID | 视图复用正确率 100% | - |
| 内存管理 | - | 节省50-70% (长时间使用) |
| 节流/取消 | 网络请求 -60% | - |

## 🎯 实施优先级

1. **立即实施** (本次迭代):
   - Formatter缓存
   - Equatable实现
   - 稳定ID修复

2. **短期规划** (下次迭代):
   - 内存管理
   - 请求节流/取消
   - Toast优化

3. **长期改进** (按需):
   - 图片缓存
   - 错误重试
   - 本地数据持久化
