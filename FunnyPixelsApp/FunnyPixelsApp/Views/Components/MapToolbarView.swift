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
    @Binding var is3DMode: Bool

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
    var on3DToggle: () -> Void
    var onTest: () -> Void
    var onLongPressTest: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 0) {
            // 0. Leaderboard Button (Top) - Hide in 3D mode and drawing mode
            if authViewModel.isAuthenticated && !isDrawingMode && !is3DMode, let leaderboardAction = onLeaderboard {
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

            // 2. 3D Mode Button - Hide in Drawing Mode
            if !isDrawingMode {
                toolbarDivider

                Button(action: {
                    HapticManager.shared.impact(style: .medium)
                    on3DToggle()
                }) {
                    ZStack {
                        if is3DMode {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.blue.opacity(0.15))
                                .frame(width: 38, height: 38)
                        }

                        Image(systemName: is3DMode ? "cube.fill" : "cube")
                            .font(DesignTokens.Typography.title3)
                            .foregroundColor(is3DMode ? .blue : .blue.opacity(0.8))
                            .frame(width: 44, height: 44)
                    }
                }
                .scaleEffect(is3DMode ? 1.05 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: is3DMode)
            }

            // 3. Roaming Button - Hide in Drawing Mode
            if authViewModel.isAuthenticated && !isDrawingMode {
                toolbarDivider

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

            // 4. Test Button (Bottom) - Hide in Drawing Mode and 3D Mode
            if isDebugMode && authViewModel.isAuthenticated && !isDrawingMode && !is3DMode {
                toolbarDivider

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
    
    private var toolbarDivider: some View {
        Divider()
            .frame(width: 24)
            .background(Color.secondary.opacity(0.2))
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
            is3DMode: .constant(false),
            isDebugMode: true,
            isRandomTesting: false,
            testBadgePattern: nil,
            onRoam: {},
            onLongPressRoam: {},
            onCenter: {},
            on3DToggle: {},
            onTest: {}
        )
        .environmentObject(AuthViewModel())
    }
}
