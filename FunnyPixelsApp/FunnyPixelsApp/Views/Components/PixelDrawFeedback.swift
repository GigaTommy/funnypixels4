import SwiftUI
import Combine

/// Enhanced Pixel Draw Feedback with ripple effect, combo counter, and contextual text
/// Shows instant visual feedback when user draws pixels
struct PixelDrawFeedback: View {
    @ObservedObject private var fontManager = FontSizeManager.shared

    let count: Int
    let pixelColor: Color
    let comboCount: Int
    let areaPercentChange: Double?

    @State private var offset: CGFloat = 0
    @State private var opacity: Double = 1.0
    @State private var scale: CGFloat = 0.8
    @State private var ripple1Scale: CGFloat = 0.3
    @State private var ripple1Opacity: Double = 0.6
    @State private var ripple2Scale: CGFloat = 0.3
    @State private var ripple2Opacity: Double = 0.6
    @State private var ripple3Scale: CGFloat = 0.3
    @State private var ripple3Opacity: Double = 0.6
    @State private var comboScale: CGFloat = 0.5
    @State private var comboOpacity: Double = 0.0

    init(count: Int, pixelColor: Color = .green, comboCount: Int = 0, areaPercentChange: Double? = nil) {
        self.count = count
        self.pixelColor = pixelColor
        self.comboCount = comboCount
        self.areaPercentChange = areaPercentChange
    }

    // MARK: - Combo Thresholds

    private var isComboMilestone: Bool {
        comboCount == 3 || comboCount == 5 || comboCount >= 10
    }

    private var comboText: String? {
        if comboCount >= 10 {
            return String(format: NSLocalizedString("drawing.feedback.combo_milestone", comment: "Combo milestone"), comboCount)
        } else if comboCount >= 5 {
            return String(format: NSLocalizedString("drawing.feedback.combo_milestone", comment: "Combo milestone"), comboCount)
        } else if comboCount >= 3 {
            return String(format: NSLocalizedString("drawing.feedback.combo_milestone", comment: "Combo milestone"), comboCount)
        }
        return nil
    }

    private var comboIntensity: CGFloat {
        if comboCount >= 10 { return 1.0 }
        if comboCount >= 5 { return 0.7 }
        if comboCount >= 3 { return 0.4 }
        return 0.0
    }

    private var rippleColor: Color {
        pixelColor
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Ripple circles
            rippleCircles

            // Main content
            VStack(spacing: 4) {
                // Points text
                pointsText

                // Contextual subtitle
                subtitleText
            }
            .scaleEffect(scale)
            .offset(y: offset)
            .opacity(opacity)

            // Combo milestone overlay
            if let combo = comboText {
                comboMilestoneView(combo)
            }
        }
        .onAppear {
            startAnimations()
            triggerHaptics()
        }
    }

    // MARK: - Ripple Circles

    private var rippleCircles: some View {
        ZStack {
            // First ripple (fastest)
            Circle()
                .stroke(rippleColor.opacity(ripple1Opacity), lineWidth: 2)
                .frame(width: 60, height: 60)
                .scaleEffect(ripple1Scale)

            // Second ripple (medium)
            Circle()
                .stroke(rippleColor.opacity(ripple2Opacity), lineWidth: 1.5)
                .frame(width: 60, height: 60)
                .scaleEffect(ripple2Scale)

            // Third ripple (slowest, only for combos)
            if comboCount >= 3 {
                Circle()
                    .stroke(rippleColor.opacity(ripple3Opacity), lineWidth: 1)
                    .frame(width: 60, height: 60)
                    .scaleEffect(ripple3Scale)
            }
        }
        .offset(y: offset * 0.3) // Ripples drift upward slightly
    }

    // MARK: - Points Text

    private var pointsText: some View {
        Text("+\(count)")
            .font(.system(size: pointsFontSize, weight: .bold, design: .rounded))
            .foregroundStyle(pointsGradient)
            .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
    }

    private var pointsFontSize: CGFloat {
        let base: CGFloat = 28
        if comboCount >= 10 { return base + 8 }
        if comboCount >= 5 { return base + 4 }
        if comboCount >= 3 { return base + 2 }
        return base
    }

    private var pointsGradient: LinearGradient {
        if comboCount >= 10 {
            return LinearGradient(
                colors: [.red, .orange, .yellow],
                startPoint: .leading,
                endPoint: .trailing
            )
        } else if comboCount >= 5 {
            return LinearGradient(
                colors: [.orange, .yellow],
                startPoint: .leading,
                endPoint: .trailing
            )
        } else {
            return LinearGradient(
                colors: [.green, .yellow],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }

    // MARK: - Subtitle Text

    @ViewBuilder
    private var subtitleText: some View {
        if let areaChange = areaPercentChange, areaChange > 0 {
            Text(String(format: NSLocalizedString("drawing.feedback.area_change", comment: "Area percentage change"), areaChange))
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.9))
                .shadow(color: .black.opacity(0.4), radius: 1, x: 0, y: 1)
        } else if comboCount >= 2 {
            Text(String(format: NSLocalizedString("drawing.feedback.consecutive_draw", comment: "Consecutive draw count"), comboCount))
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.9))
                .shadow(color: .black.opacity(0.4), radius: 1, x: 0, y: 1)
        }
    }

    // MARK: - Combo Milestone View

    private func comboMilestoneView(_ text: String) -> some View {
        Text(text)
            .font(.system(size: comboFontSize, weight: .heavy, design: .rounded))
            .foregroundStyle(comboGradient)
            .shadow(color: comboShadowColor, radius: 4, x: 0, y: 2)
            .scaleEffect(comboScale)
            .opacity(comboOpacity)
            .offset(y: -50)
    }

    private var comboFontSize: CGFloat {
        if comboCount >= 10 { return 28 }
        if comboCount >= 5 { return 24 }
        return 20
    }

    private var comboGradient: LinearGradient {
        if comboCount >= 10 {
            return LinearGradient(
                colors: [.red, .orange, .yellow, .orange, .red],
                startPoint: .leading,
                endPoint: .trailing
            )
        } else if comboCount >= 5 {
            return LinearGradient(
                colors: [.orange, .yellow, .orange],
                startPoint: .leading,
                endPoint: .trailing
            )
        } else {
            return LinearGradient(
                colors: [.yellow, .green],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }

    private var comboShadowColor: Color {
        if comboCount >= 10 { return .red.opacity(0.5) }
        if comboCount >= 5 { return .orange.opacity(0.4) }
        return .yellow.opacity(0.3)
    }

    // MARK: - Animations

    private func startAnimations() {
        // Main text: float up and fade
        withAnimation(.easeOut(duration: 1.2)) {
            offset = -80
            opacity = 0
        }

        // Scale bounce in
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            scale = 1.2
        }

        // Ripple 1 - immediate
        withAnimation(.easeOut(duration: 0.8)) {
            ripple1Scale = 2.0
            ripple1Opacity = 0
        }

        // Ripple 2 - delayed
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.easeOut(duration: 0.8)) {
                ripple2Scale = 2.5
                ripple2Opacity = 0
            }
        }

        // Ripple 3 - more delayed (combos only)
        if comboCount >= 3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.easeOut(duration: 0.9)) {
                    ripple3Scale = 3.0
                    ripple3Opacity = 0
                }
            }
        }

        // Combo milestone animation
        if isComboMilestone {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.5, blendDuration: 0)) {
                comboScale = 1.0 + comboIntensity * 0.3
                comboOpacity = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation(.easeOut(duration: 0.6)) {
                    comboOpacity = 0
                    comboScale = 0.8
                }
            }
        }
    }

    // MARK: - Haptics

    private func triggerHaptics() {
        #if !targetEnvironment(simulator)
        if comboCount >= 10 {
            HapticManager.shared.notification(type: .success)
        } else if comboCount >= 5 {
            HapticManager.shared.impact(style: .heavy)
        } else if comboCount >= 3 {
            HapticManager.shared.impact(style: .medium)
        } else {
            HapticManager.shared.impact(style: .light)
        }
        #endif
    }
}

// MARK: - Combo Tracker

/// Tracks consecutive pixel placements within a time window for combo detection
@MainActor
class PixelComboTracker: ObservableObject {
    static let shared = PixelComboTracker()

    @Published private(set) var currentCombo: Int = 0
    @Published private(set) var lastPlacementTime: Date?

    private let comboWindow: TimeInterval = 2.0

    private init() {}

    /// Record a pixel placement and return the updated combo count
    @discardableResult
    func recordPlacement() -> Int {
        let now = Date()

        if let lastTime = lastPlacementTime,
           now.timeIntervalSince(lastTime) <= comboWindow {
            currentCombo += 1
        } else {
            currentCombo = 1
        }

        lastPlacementTime = now
        return currentCombo
    }

    /// Reset the combo counter
    func reset() {
        currentCombo = 0
        lastPlacementTime = nil
    }
}

// MARK: - Overlay Modifier

extension View {
    /// Show enhanced floating feedback at a specific position with combo and ripple effects
    /// - Parameters:
    ///   - count: Points earned from this placement
    ///   - position: Screen position for the feedback
    ///   - isVisible: Whether the feedback is currently visible
    ///   - pixelColor: Color of the placed pixel (used for ripple effect)
    ///   - comboCount: Current combo streak count
    ///   - areaPercentChange: Optional area ownership percentage change
    func pixelDrawFeedback(
        _ count: Int,
        at position: CGPoint,
        isVisible: Bool,
        pixelColor: Color = .green,
        comboCount: Int = 0,
        areaPercentChange: Double? = nil
    ) -> some View {
        self.overlay(alignment: .center) {
            if isVisible {
                PixelDrawFeedback(
                    count: count,
                    pixelColor: pixelColor,
                    comboCount: comboCount,
                    areaPercentChange: areaPercentChange
                )
                .position(position)
                .allowsHitTesting(false)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.opacity(0.8)
            .ignoresSafeArea()

        VStack(spacing: 60) {
            PixelDrawFeedback(count: 1, pixelColor: .blue, comboCount: 1)
            PixelDrawFeedback(count: 1, pixelColor: .red, comboCount: 3)
            PixelDrawFeedback(count: 1, pixelColor: .orange, comboCount: 5)
            PixelDrawFeedback(count: 1, pixelColor: .purple, comboCount: 10)
        }
    }
}
