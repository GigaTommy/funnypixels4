import SwiftUI

/// P1-5: Rank Change Toast Notification
/// Displays when user's rank changes in an event (up or down)
struct RankChangeToast: View {
    let oldRank: Int
    let newRank: Int
    @Binding var isPresented: Bool
    @State private var offset: CGFloat = -100
    @State private var scale: CGFloat = 0.8

    var rankChange: Int {
        oldRank - newRank  // Positive = rank up, negative = rank down
    }

    var isRankUp: Bool {
        rankChange > 0
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Rank change icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: isRankUp
                                    ? [Color.green.opacity(0.3), Color.green.opacity(0.1)]
                                    : [Color.red.opacity(0.3), Color.red.opacity(0.1)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)

                    Image(systemName: isRankUp ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(isRankUp ? .green : .red)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(isRankUp
                        ? NSLocalizedString("rank.change.up", comment: "Rank Up!")
                        : NSLocalizedString("rank.change.down", comment: "Rank Down"))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)

                    Text(String(format: NSLocalizedString("rank.change.from_to", comment: "#%d → #%d"), oldRank, newRank))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white.opacity(0.9))

                    // Change magnitude
                    if abs(rankChange) > 1 {
                        Text("\(isRankUp ? "+" : "")\(rankChange) " +
                             NSLocalizedString("rank.change.positions", comment: "positions"))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }

                Spacer()

                // Close button
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        isPresented = false
                    }
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
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
                            colors: isRankUp
                                ? [Color.green, Color.teal]
                                : [Color.red, Color.orange],
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
            }

            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.spring(response: 0.3)) {
                    isPresented = false
                }
            }
        }
    }
}

// MARK: - Toast Manager (Notification-based)

extension Notification.Name {
    static let showRankChangeToast = Notification.Name("showRankChangeToast")
}

struct RankChangeToastData {
    let oldRank: Int
    let newRank: Int
}

// MARK: - View Modifier for Global Toast Display

struct RankChangeToastModifier: ViewModifier {
    @State private var oldRank: Int?
    @State private var newRank: Int?
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented, let old = oldRank, let new = newRank {
                    RankChangeToast(oldRank: old, newRank: new, isPresented: $isPresented)
                        .padding(.top, 60)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .zIndex(998)  // Below milestone toast (999)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .showRankChangeToast)) { notification in
                if let data = notification.object as? RankChangeToastData {
                    oldRank = data.oldRank
                    newRank = data.newRank
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                        isPresented = true
                    }
                }
            }
    }
}

extension View {
    /// Enable rank change toast notifications in this view
    func rankChangeToast() -> some View {
        self.modifier(RankChangeToastModifier())
    }
}

// MARK: - Helper to Post Rank Change Notification

func showRankChangeToast(oldRank: Int, newRank: Int) {
    NotificationCenter.default.post(
        name: .showRankChangeToast,
        object: RankChangeToastData(oldRank: oldRank, newRank: newRank)
    )
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        VStack(spacing: 200) {
            Text("Rank Change Toast Demo")
                .font(.title)

            Button("Rank Up (5 → 3)") {
                showRankChangeToast(oldRank: 5, newRank: 3)
            }

            Button("Rank Down (3 → 8)") {
                showRankChangeToast(oldRank: 3, newRank: 8)
            }
        }
    }
    .rankChangeToast()
}
