import SwiftUI

struct AdaptiveAlignment: ViewModifier {
    @ObservedObject private var localizationManager = LocalizationManager.shared

    func body(content: Content) -> some View {
        content
            .environment(\.layoutDirection, localizationManager.isRTL ? .rightToLeft : .leftToRight)
    }
}

extension View {
    func adaptiveLayout() -> some View {
        modifier(AdaptiveAlignment())
    }
}
