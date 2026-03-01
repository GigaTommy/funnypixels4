import SwiftUI

/// 地图上的漂流瓶标记视图
struct BottleMapMarkerView: View {
    let marker: BottleMapMarker
    @State private var isPulsing = false
    @State private var showDetail = false

    var body: some View {
        VStack(spacing: 4) {
            // 漂流瓶图标
            Image("drift_bottle_icon")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: marker.isInPickupRange ? 40 : 32, height: marker.isInPickupRange ? 40 : 32)
                .shadow(color: marker.isInPickupRange ? Color.green.opacity(0.5) : Color.cyan.opacity(0.3), radius: marker.isInPickupRange ? 8 : 4)
                .scaleEffect(isPulsing ? 1.15 : 1.0)
                .animation(
                    marker.isInPickupRange
                        ? .easeInOut(duration: 1.0).repeatForever(autoreverses: true)
                        : .default,
                    value: isPulsing
                )

            // 距离标签
            Text(marker.distanceText)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(marker.isInPickupRange ? Color.green : Color.cyan)
                        .shadow(color: .black.opacity(0.2), radius: 1, x: 0, y: 1)
                )
        }
        .onAppear {
            if marker.isInPickupRange {
                isPulsing = true
            }
        }
        .onTapGesture {
            handleTap()
        }
    }

    private func handleTap() {
        // 播放音效
        SoundManager.shared.play(.buttonClick)
        HapticManager.shared.impact(style: .light)

        // 显示详情或触发遭遇
        showDetail = true

        // 通知DriftBottleManager
        Task {
            await DriftBottleManager.shared.handleMarkerTap(bottleId: marker.id)
        }
    }
}

// MARK: - 预览

struct BottleMapMarkerView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 40) {
            // 范围外
            BottleMapMarkerView(
                marker: BottleMapMarker(
                    bottleId: "test1",
                    lat: 23.1415,
                    lng: 113.2898,
                    distance: 250
                )
            )

            // 范围内
            BottleMapMarkerView(
                marker: BottleMapMarker(
                    bottleId: "test2",
                    lat: 23.1420,
                    lng: 113.2905,
                    distance: 50
                )
            )
        }
        .padding()
        .background(Color.gray.opacity(0.1))
    }
}
