import Combine
import SwiftUI

/// 地图工具栏组件 - 采用"悬浮胶囊"设计
/// Map Toolbar Component - Uses "Floating Capsule" design
struct MapToolbarView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @ObservedObject var locationManager = LocationManager.shared
    @ObservedObject private var fontManager = FontSizeManager.shared
    
    // State bindings
    @Binding var isRoaming: Bool
    @Binding var isCentering: Bool
    @Binding var isMapDetached: Bool
    @Binding var isLeaderboardShowing: Bool

    // Debug & Test State
    var isDebugMode: Bool
    var isRandomTesting: Bool
    var testBadgePattern: DrawingPattern?

    // View State
    var isDrawingMode: Bool = false

    // Actions
    var onLeaderboard: (() -> Void)? = nil
    var onRoam: () -> Void
    var onLongPressRoam: (() -> Void)? = nil
    var onCenter: () -> Void
    var onTest: () -> Void
    var onLongPressTest: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 0) {
            // 0. Leaderboard Button (Top) - Always visible when authenticated
            if authViewModel.isAuthenticated && !isDrawingMode, let leaderboardAction = onLeaderboard {
                Button(action: {
                    hapticFeedback()
                    leaderboardAction()
                }) {
                    Image(systemName: isLeaderboardShowing ? "trophy.fill" : "trophy")
                        .font(DesignTokens.Typography.title3)
                        .foregroundColor(.blue)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }

                Divider()
                    .frame(width: 24)
                    .background(Color.secondary.opacity(0.2))
            }

            // 1. Location Button
            Button(action: {
                hapticFeedback()
                onCenter()
            }) {
                Image(systemName: getIconName())
                    .font(DesignTokens.Typography.title3)
                    .foregroundColor(.blue)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }

            // 2. Roaming Button (Middle) - Hide in Drawing Mode
            if authViewModel.isAuthenticated && !isDrawingMode {
                Divider()
                    .frame(width: 24)
                    .background(Color.secondary.opacity(0.2))

                Button(action: {
                    hapticFeedback()
                    onRoam()
                }) {
                    Image(systemName: isRoaming ? "globe.americas.fill" : "globe")
                        .font(DesignTokens.Typography.title3)
                        .foregroundColor(.blue)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .simultaneousGesture(
                    LongPressGesture(minimumDuration: 0.5)
                        .onEnded { _ in
                            hapticFeedback()
                            onLongPressRoam?()
                        }
                )
            }

            // 3. Test Button (Bottom) - Hide in Drawing Mode
            if isDebugMode && authViewModel.isAuthenticated && !isDrawingMode {
                Divider()
                    .frame(width: 24)
                    .background(Color.secondary.opacity(0.2))

                Button(action: {
                    hapticFeedback()
                    onTest()
                }) {
                    ZStack(alignment: .bottomTrailing) {
                        Image(systemName: isRandomTesting ? "dice.fill" : "dice")
                            .font(DesignTokens.Typography.title3)
                            .foregroundColor(.blue)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())

                        // Alliance Badge for Test Mode
                        if let pattern = testBadgePattern {
                            SmallAllianceFlagBadge(pattern: pattern, size: 14, borderSize: 1)
                                .offset(x: -4, y: -4)
                        }
                    }
                }
                .simultaneousGesture(
                    LongPressGesture(minimumDuration: 0.5)
                        .onEnded { _ in
                            hapticFeedback()
                            onLongPressTest?()
                        }
                )
            }
        }
        .background(.regularMaterial)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        .overlay(
            Capsule()
                .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
        )
    }
    
    private func getIconName() -> String {
        if isMapDetached {
            return "location"
        } else {
            return "location.fill"
        }
    }
    
    private func isActive() -> Bool {
        return isCentering || !isMapDetached
    }
    
    private func hapticFeedback() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}

#Preview {
    ZStack {
        Color.gray
        MapToolbarView(
            isRoaming: .constant(false),
            isCentering: .constant(false),
            isMapDetached: .constant(true),
            isLeaderboardShowing: .constant(false),
            isDebugMode: true,
            isRandomTesting: false,
            testBadgePattern: nil,
            onRoam: {},
            onLongPressRoam: {},
            onCenter: {},
            onTest: {}
        )
        .environmentObject(AuthViewModel())
    }
}
