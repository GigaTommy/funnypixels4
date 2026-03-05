import SwiftUI

/// 领土动态 - 顶部横幅通知
/// 当用户像素被覆盖时，以紧凑型 pill 显示在顶部
struct TerritoryBattleBanner: View {
    @ObservedObject private var manager = TerritoryBannerManager.shared
    @State private var dragOffset: CGFloat = 0
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        if manager.currentBanner != nil {
            bannerContent
                .background(
                    RoundedRectangle(cornerRadius: 28)
                        .fill(.ultraThinMaterial)
                        .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
                )
                .clipShape(RoundedRectangle(cornerRadius: 28))
                .padding(.horizontal, 40)
                .offset(y: dragOffset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if value.translation.height < 0 {
                                dragOffset = value.translation.height
                            }
                        }
                        .onEnded { value in
                            if value.translation.height < -50 {
                                withAnimation(.spring(response: 0.3)) {
                                    manager.dismiss()
                                    dragOffset = 0
                                }
                            } else {
                                withAnimation(.spring(response: 0.3)) {
                                    dragOffset = 0
                                }
                            }
                        }
                )
                .onTapGesture {
                    manager.showBattleFeed = true
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.spring(response: 0.4, dampingFraction: 0.8), value: manager.currentBanner?.id)
        }
    }

    private var bannerContent: some View {
        HStack(spacing: 10) {
            Image(systemName: "shield.slash.fill")
                .responsiveFont(.subheadline, weight: .semibold)
                .foregroundColor(.red)

            Text(NSLocalizedString("territory.someone_invaded", comment: ""))
                .responsiveFont(.caption, weight: .semibold)
                .lineLimit(1)

            Spacer()

            if manager.pendingBattleCount > 0 {
                Text("+\(manager.pendingBattleCount)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.red))
            }

            Image(systemName: "chevron.right")
                .responsiveFont(.caption2, weight: .semibold)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
