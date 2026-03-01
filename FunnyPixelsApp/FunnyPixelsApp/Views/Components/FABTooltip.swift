import Combine
import SwiftUI

/// Pulsing tooltip that points to the FAB button after onboarding
struct FABTooltip: View {
    @Binding var isVisible: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "hand.tap.fill")
                    .font(.system(size: 16))
                Text(NSLocalizedString("tooltip.fab.start_drawing", comment: "Tap to start drawing!"))
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue)
                    .shadow(color: .blue.opacity(0.4), radius: 8, y: 4)
            )

            // Arrow pointing down-right toward FAB
            Triangle()
                .fill(Color.blue)
                .frame(width: 14, height: 8)
                .rotationEffect(.degrees(180))
                .offset(x: 40)
        }
        .transition(.scale.combined(with: .opacity))
        .onTapGesture {
            withAnimation(.spring(response: 0.3)) {
                isVisible = false
            }
        }
        .onAppear {
            // Auto-dismiss after 6 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
                withAnimation(.spring(response: 0.3)) {
                    isVisible = false
                }
            }
        }
    }
}

/// Orange tooltip for guiding long-press to switch flag
struct FABFlagSwitchTooltip: View {
    @Binding var isVisible: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "hand.tap.fill")
                    .font(.system(size: 16))
                Text(NSLocalizedString("tooltip.fab.flag_switch", comment: "Long press to switch flag"))
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.orange)
                    .shadow(color: .orange.opacity(0.4), radius: 8, y: 4)
            )

            Triangle()
                .fill(Color.orange)
                .frame(width: 14, height: 8)
                .rotationEffect(.degrees(180))
                .offset(x: 40)
        }
        .transition(.scale.combined(with: .opacity))
        .onTapGesture {
            withAnimation(.spring(response: 0.3)) {
                isVisible = false
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                withAnimation(.spring(response: 0.3)) {
                    isVisible = false
                }
            }
        }
    }
}

fileprivate struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
