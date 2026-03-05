import SwiftUI

/// 地图底部极简遭遇横幅 (44pt 高度)
struct DriftBottleEncounterBanner: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let bottle: DriftBottle
    let onOpen: () -> Void
    let onDismiss: () -> Void

    @State private var isAppearing = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "sailboat.fill")
                .font(.system(size: 18))
                .foregroundColor(.cyan)

            VStack(alignment: .leading, spacing: 1) {
                Text(String(format: NSLocalizedString("drift_bottle.encounter.from", comment: ""), bottle.originCity ?? NSLocalizedString("drift_bottle.far_away", comment: "")))
                    .responsiveFont(.caption, weight: .medium)
                    .foregroundColor(.white)

                Text(String(format: NSLocalizedString("drift_bottle.encounter.stats", comment: ""), String(format: "%.1f", bottle.distanceKm), bottle.openCount + 1, bottle.maxOpeners))
                    .responsiveFont(.caption2)
                    .foregroundColor(.white.opacity(0.7))
            }

            Spacer()

            Button(action: onOpen) {
                Text(NSLocalizedString("drift_bottle.encounter.open", comment: ""))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.blue)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color.white))
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.75))
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 4)
        )
        .padding(.horizontal, 20)
        .offset(y: isAppearing ? 0 : 60)
        .opacity(isAppearing ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                isAppearing = true
            }
        }
    }
}
