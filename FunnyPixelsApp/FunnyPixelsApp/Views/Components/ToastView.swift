import SwiftUI

// MARK: - Toast Style
enum ToastStyle {
    case success
    case error
    case info
    
    var icon: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .info: return "info.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .success: return UnifiedColors.success
        case .error: return UnifiedColors.error
        case .info: return UnifiedColors.primary
        }
    }
}

// MARK: - Toast View
struct ToastView: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    let message: String
    let style: ToastStyle

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: style.icon)
                .responsiveFont(.callout)
                .foregroundColor(style.color)

            Text(message)
                .responsiveFont(.subheadline)
                .foregroundColor(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.black.opacity(0.85))
        .cornerRadius(24)
        .shadow(color: Color.black.opacity(0.2), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Toast Modifier
struct ToastModifier: ViewModifier {
    @Binding var isPresented: Bool
    let message: String
    let style: ToastStyle
    let duration: TimeInterval
    
    func body(content: Content) -> some View {
        ZStack {
            content
            
            if isPresented {
                VStack {
                    Spacer()
                    
                    ToastView(message: message, style: style)
                        .padding(.bottom, 100) // Avoid TabBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                                withAnimation {
                                    isPresented = false
                                }
                            }
                        }
                }
                .zIndex(1000) // Ensure it's on top
            }
        }
    }
}

// MARK: - View Extension
extension View {
    func toast(isPresented: Binding<Bool>, message: String, style: ToastStyle = .success, duration: TimeInterval = 2.0) -> some View {
        self.modifier(ToastModifier(isPresented: isPresented, message: message, style: style, duration: duration))
    }
}
