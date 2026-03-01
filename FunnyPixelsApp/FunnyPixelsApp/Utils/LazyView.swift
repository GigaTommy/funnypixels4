import SwiftUI

/// 懒加载视图包装器
/// 用于TabView中延迟创建子视图，避免TabView预加载所有Tab导致的性能问题
///
/// **使用场景**:
/// - TabView中的非默认Tab
/// - 大型复杂视图的延迟初始化
/// - 优化App启动性能
///
/// **性能优势**:
/// - 视图仅在首次显示时创建
/// - 减少登录后的初始化时间
/// - 降低内存占用
///
/// **使用示例**:
/// ```swift
/// TabView {
///     DefaultTab()  // 默认Tab，立即创建
///         .tag(0)
///
///     LazyView(HeavyTab())  // 懒加载Tab，首次点击时创建
///         .tag(1)
/// }
/// ```
struct LazyView<Content: View>: View {
    private let build: () -> Content

    /// 创建懒加载视图
    /// - Parameter build: 视图构建闭包，仅在首次渲染时执行
    init(_ build: @autoclosure @escaping () -> Content) {
        self.build = build
    }

    var body: Content {
        build()
    }
}
