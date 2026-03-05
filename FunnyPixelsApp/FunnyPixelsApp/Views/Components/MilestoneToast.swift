import Combine
import SwiftUI

/// P1-3: Milestone Achievement Toast Notification
/// Displays when user reaches pixel milestones (10, 50, 100, 500, 1000, 5000)
struct MilestoneToast: View {
    // ✅ 响应式设计：监听字体设置变化
    @ObservedObject private var fontManager = FontSizeManager.shared

    let milestone: Int
    @Binding var isPresented: Bool
    @State private var offset: CGFloat = -100
    @State private var scale: CGFloat = 0.8
    @State private var rotation: Double = -15

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Animated star icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [.yellow.opacity(0.3), .orange.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: ResponsiveSize.iconXLarge(scale: fontManager.scale), height: ResponsiveSize.iconXLarge(scale: fontManager.scale))

                    Image(systemName: "star.fill")
                        .responsiveFont(.title3)
                        .foregroundColor(.yellow)
                        .rotationEffect(.degrees(rotation))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("milestone.achieved", comment: "Milestone Achieved!"))
                        .responsiveFont(.callout, weight: .bold)
                        .foregroundColor(.white)

                    Text(String(format: NSLocalizedString("milestone.pixels_contributed", comment: "You've contributed %d pixels!"), milestone))
                        .responsiveFont(.subheadline, weight: .medium)
                        .foregroundColor(.white.opacity(0.9))
                }

                Spacer()

                // Close button
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        isPresented = false
                    }
                }) {
                    Image(systemName: "xmark")
                        .responsiveFont(.caption, weight: .semibold)
                        .foregroundColor(.white.opacity(0.6))
                        .frame(width: 24, height: 24)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Circle())
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [
                                isMajorMilestone ? .purple : .green,
                                isMajorMilestone ? .blue : .teal
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: .black.opacity(0.3), radius: 12, x: 0, y: 6)
            )
        }
        .padding(.horizontal, 20)
        .offset(y: offset)
        .scaleEffect(scale)
        .onAppear {
            // Entrance animation
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                offset = 0
                scale = 1.0
                rotation = 0
            }

            // Star rotation animation
            withAnimation(.easeInOut(duration: 0.5).repeatCount(2, autoreverses: true).delay(0.2)) {
                rotation = 360
            }

            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.spring(response: 0.3)) {
                    isPresented = false
                }
            }
        }
    }

    /// Major milestones (1000+) get special purple/blue gradient
    private var isMajorMilestone: Bool {
        milestone >= 1000
    }
}

// MARK: - Toast Manager (Notification-based)

extension Notification.Name {
    static let showMilestoneToast = Notification.Name("showMilestoneToast")
}

struct MilestoneToastData {
    let milestone: Int
}

// MARK: - View Modifier for Global Toast Display

struct MilestoneToastModifier: ViewModifier {
    @State private var currentMilestone: Int?
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented, let milestone = currentMilestone {
                    MilestoneToast(milestone: milestone, isPresented: $isPresented)
                        .padding(.top, 60)  // Below notch/status bar
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .zIndex(999)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .showMilestoneToast)) { notification in
                if let data = notification.object as? MilestoneToastData {
                    currentMilestone = data.milestone
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                        isPresented = true
                    }
                }
            }
    }
}

extension View {
    /// Enable milestone toast notifications in this view
    func milestoneToast() -> some View {
        self.modifier(MilestoneToastModifier())
    }
}

// MARK: - Helper to Post Milestone Notification

func showMilestoneToast(milestone: Int) {
    NotificationCenter.default.post(
        name: .showMilestoneToast,
        object: MilestoneToastData(milestone: milestone)
    )
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        VStack(spacing: 200) {
            Text("Milestone Toast Demo")
                .font(.title)

            Button("Show 100 Milestone") {
                showMilestoneToast(milestone: 100)
            }

            Button("Show 1000 Milestone") {
                showMilestoneToast(milestone: 1000)
            }
        }
    }
    .milestoneToast()
}
