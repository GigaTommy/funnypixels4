import Combine
import SwiftUI

/// Toast notification for entering/leaving event zones
struct EventZoneToast: View {
    enum ToastType {
        case entered(eventTitle: String)
        case exited(eventTitle: String)
        case ending(eventTitle: String, minutesLeft: Int)
        case ended(eventTitle: String)
    }

    let type: ToastType
    @Binding var isPresented: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.title2)
                .foregroundColor(iconColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.regularMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
        .padding(.horizontal, 20)
        .transition(.move(edge: .top).combined(with: .opacity))
        .onAppear {
            // Auto dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.easeOut(duration: 0.3)) {
                    isPresented = false
                }
            }
        }
    }

    private var iconName: String {
        switch type {
        case .entered: return "location.fill"
        case .exited: return "location.slash"
        case .ending: return "clock.badge.exclamationmark"
        case .ended: return "flag.checkered"
        }
    }

    private var iconColor: Color {
        switch type {
        case .entered: return .green
        case .exited: return .orange
        case .ending: return .red
        case .ended: return .gray
        }
    }

    private var title: String {
        switch type {
        case .entered:
            return NSLocalizedString("event.zone.entered.title", comment: "Entered Event Zone")
        case .exited:
            return NSLocalizedString("event.zone.exited.title", comment: "Left Event Zone")
        case .ending:
            return NSLocalizedString("event.zone.ending.title", comment: "Event Ending Soon")
        case .ended:
            return NSLocalizedString("event.zone.ended.title", comment: "Event Ended")
        }
    }

    private var subtitle: String {
        switch type {
        case .entered(let eventTitle):
            return String(format: NSLocalizedString("event.zone.entered.subtitle", comment: ""), eventTitle)
        case .exited(let eventTitle):
            return String(format: NSLocalizedString("event.zone.exited.subtitle", comment: ""), eventTitle)
        case .ending(let eventTitle, let minutes):
            return String(format: NSLocalizedString("event.zone.ending.subtitle", comment: ""), eventTitle, minutes)
        case .ended(let eventTitle):
            return String(format: NSLocalizedString("event.zone.ended.subtitle", comment: ""), eventTitle)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        EventZoneToast(type: .entered(eventTitle: "Territory War"), isPresented: .constant(true))
        EventZoneToast(type: .exited(eventTitle: "Territory War"), isPresented: .constant(true))
        EventZoneToast(type: .ending(eventTitle: "Territory War", minutesLeft: 5), isPresented: .constant(true))
        EventZoneToast(type: .ended(eventTitle: "Territory War"), isPresented: .constant(true))
    }
    .padding()
    .background(Color.gray.opacity(0.2))
}
