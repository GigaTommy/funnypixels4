import SwiftUI

/// Map mode indicator chip - shows current interaction context
/// Peace (default), War (active event), Drawing (GPS drawing active)
struct MapModeIndicator: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let mode: MapMode
    @State private var isPulsing = false

    enum MapMode {
        case peace
        case war(eventTitle: String)
        case drawing(pixelCount: Int)

        var label: String {
            switch self {
            case .peace: return NSLocalizedString("map.mode.peace", comment: "Explore")
            case .war(let title): return title
            case .drawing(let count): return String(format: NSLocalizedString("map.mode.drawing", comment: "%d pixels"), count)
            }
        }

        var icon: String {
            switch self {
            case .peace: return "eye.fill"
            case .war: return "flame.fill"
            case .drawing: return "paintbrush.fill"
            }
        }

        var color: Color {
            switch self {
            case .peace: return .blue
            case .war: return .red
            case .drawing: return .green
            }
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            // Pulsing dot for active modes
            if case .peace = mode {
                Image(systemName: mode.icon)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(mode.color)
            } else {
                ZStack {
                    Circle()
                        .fill(mode.color.opacity(0.3))
                        .frame(width: 16, height: 16)
                        .scaleEffect(isPulsing ? 1.5 : 1.0)
                        .opacity(isPulsing ? 0 : 0.6)

                    Circle()
                        .fill(mode.color)
                        .frame(width: 8, height: 8)
                }
                .onAppear {
                    withAnimation(.easeOut(duration: 1.2).repeatForever(autoreverses: false)) {
                        isPulsing = true
                    }
                }
            }

            Text(mode.label)
                .responsiveFont(.caption2, weight: .semibold)
                .foregroundColor(.white)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(mode.color.opacity(0.8))
                .shadow(color: mode.color.opacity(0.3), radius: 6, y: 3)
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        MapModeIndicator(mode: .peace)
        MapModeIndicator(mode: .war(eventTitle: "城市争夺战"))
        MapModeIndicator(mode: .drawing(pixelCount: 42))
    }
    .padding()
    .background(Color.gray)
}
