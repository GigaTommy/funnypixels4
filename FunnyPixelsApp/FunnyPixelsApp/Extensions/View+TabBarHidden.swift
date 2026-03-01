import SwiftUI

extension View {
    /// 隐藏TabBar（用于二级及以下页面）
    func hideTabBar() -> some View {
        self.toolbar(.hidden, for: .tabBar)
    }
}
