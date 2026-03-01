import SwiftUI

/// 漂流瓶浮动按钮（左侧居中）
struct DriftBottleFloatingButton: View {
    @ObservedObject var manager = DriftBottleManager.shared
    @State private var pulseIcon = false

    private var quota: BottleQuota? { manager.quota }
    private var availableBottles: Int { quota?.totalAvailable ?? 0 }
    private var isGPSDrawing: Bool { GPSDrawingService.shared.isGPSDrawingMode }

    var body: some View {
        VStack {
            Spacer()

            Button(action: {
                SoundManager.shared.play(.buttonClick)
                HapticManager.shared.impact(style: .medium)
                manager.showBottleSheet = true
            }) {
                ZStack(alignment: .topTrailing) {
                    // 帆船图标
                    Image(systemName: "sailboat.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.cyan)
                        .padding(12)
                        .background(
                            Circle()
                                .fill(.ultraThinMaterial)
                                .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
                        )
                        .opacity(isGPSDrawing ? 0.3 : 1.0)
                        .scaleEffect(pulseIcon ? 1.2 : 1.0)

                    // 配额角标
                    if availableBottles > 0 {
                        Text("\(availableBottles)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 20, height: 20)
                            .background(
                                Circle()
                                    .fill(Color.red)
                                    .shadow(color: .red.opacity(0.4), radius: 4, x: 0, y: 2)
                            )
                            .offset(x: 6, y: -6)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isGPSDrawing)
            .padding(.leading, 8)

            Spacer()
        }
        .onChange(of: manager.showBottleEarnedToast) {
            if manager.showBottleEarnedToast {
                // 动画提示获得新瓶子
                withAnimation(.easeInOut(duration: 0.5).repeatCount(2, autoreverses: true)) {
                    pulseIcon = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    pulseIcon = false
                }
            }
        }
    }
}

// MARK: - Preview

struct DriftBottleFloatingButton_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.gray.opacity(0.2).ignoresSafeArea()

            HStack {
                DriftBottleFloatingButton()
                Spacer()
            }
        }
    }
}
