import SwiftUI

/// 带音效的 Sheet Modifier
/// 自动为 Sheet 添加弹出和关闭音效
struct SoundSheetModifier<SheetContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let content: () -> SheetContent

    init(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> SheetContent
    ) {
        self._isPresented = isPresented
        self.onDismiss = onDismiss
        self.content = content
    }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented) {
                // Sheet 关闭时播放音效
                SoundManager.shared.play(.sheetDismiss)
                onDismiss?()
            } content: {
                self.content()
                    .onAppear {
                        // Sheet 弹出时播放音效 + 触觉反馈
                        SoundManager.shared.play(.sheetPresent)
                        HapticManager.shared.impact(style: .light)
                    }
            }
    }
}

extension View {
    /// 带音效的 Sheet
    /// 用法: .soundSheet(isPresented: $show) { SheetContent() }
    /// - Parameters:
    ///   - isPresented: 控制 Sheet 显示的绑定值
    ///   - onDismiss: Sheet 关闭时的回调（可选）
    ///   - content: Sheet 的内容视图
    /// - Returns: 修改后的视图
    func soundSheet<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        modifier(SoundSheetModifier(
            isPresented: isPresented,
            onDismiss: onDismiss,
            content: content
        ))
    }
}
