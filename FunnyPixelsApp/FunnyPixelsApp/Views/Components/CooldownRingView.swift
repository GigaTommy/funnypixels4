import SwiftUI

/// Circular arc progress ring showing remaining pixel points as percentage of max
/// Color transitions based on resource percentage, with freeze/recovery animation
struct CooldownRingView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @ObservedObject var pixelService: PixelDrawService

    let diameter: CGFloat
    let lineWidth: CGFloat

    @State private var isPulsing = false
    @State private var shatterPhase: Bool = false
    @State private var previouslyFrozen: Bool = false

    init(pixelService: PixelDrawService, diameter: CGFloat = 48, lineWidth: CGFloat = 4) {
        self.pixelService = pixelService
        self.diameter = diameter
        self.lineWidth = lineWidth
    }

    // MARK: - Computed Properties

    private var percentage: Double {
        guard pixelService.maxNaturalPoints > 0 else { return 1.0 }
        return Double(pixelService.totalPoints) / Double(pixelService.maxNaturalPoints)
    }

    private var ringProgress: Double {
        min(max(percentage, 0), 1.0)
    }

    private var ringColor: Color {
        if pixelService.isFrozen {
            return frozenBlue
        } else if percentage > 0.6 {
            return UnifiedColors.success
        } else if percentage > 0.3 {
            return UnifiedColors.warning
        } else {
            return UnifiedColors.error
        }
    }

    private var frozenBlue: Color {
        Color(red: 0.4, green: 0.7, blue: 1.0)
    }

    private var trackColor: Color {
        Color.gray.opacity(0.2)
    }

    private var centerFontSize: CGFloat {
        diameter * 0.28
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background track
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
                .frame(width: diameter, height: diameter)

            // Progress arc
            Circle()
                .trim(from: 0, to: ringProgress)
                .stroke(
                    ringColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .frame(width: diameter, height: diameter)
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: ringProgress)

            // Frozen pulsing overlay
            if pixelService.isFrozen {
                Circle()
                    .stroke(frozenBlue.opacity(isPulsing ? 0.3 : 0.0), lineWidth: lineWidth + 2)
                    .frame(width: diameter, height: diameter)
                    .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: isPulsing)
            }

            // Ice shatter particles
            if shatterPhase {
                iceShatterOverlay
            }

            // Center content
            centerContent
        }
        .frame(width: diameter + lineWidth * 2, height: diameter + lineWidth * 2)
        .onAppear {
            previouslyFrozen = pixelService.isFrozen
            if pixelService.isFrozen {
                isPulsing = true
            }
        }
        .onChange(of: pixelService.isFrozen) { wasFrozen, isFrozen in
            if wasFrozen && !isFrozen {
                // Recovery complete - trigger shatter animation
                triggerShatterAnimation()
            }
            if isFrozen {
                isPulsing = true
            } else {
                isPulsing = false
            }
            previouslyFrozen = isFrozen
        }
    }

    // MARK: - Center Content

    private var centerContent: some View {
        VStack(spacing: 0) {
            if pixelService.isFrozen {
                // Frozen state: show snowflake + countdown
                Image(systemName: "snowflake")
                    .font(.system(size: centerFontSize * 0.6))
                    .foregroundStyle(frozenBlue)
                    .symbolEffect(.pulse.byLayer)

                if pixelService.freezeTimeLeft > 0 {
                    Text("\(pixelService.freezeTimeLeft)")
                        .font(.system(size: centerFontSize * 0.7, weight: .bold, design: .monospaced))
                        .foregroundStyle(frozenBlue)
                } else {
                    Text(NSLocalizedString("cooldown.recovering", comment: "Recovering indicator"))
                        .font(.system(size: centerFontSize * 0.5, weight: .medium))
                        .foregroundStyle(frozenBlue)
                }
            } else {
                // Normal state: show pixel count
                Text("\(pixelService.totalPoints)")
                    .font(.system(size: centerFontSize, weight: .bold, design: .monospaced))
                    .foregroundStyle(ringColor)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
        }
    }

    // MARK: - Ice Shatter Overlay

    private var iceShatterOverlay: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { index in
                IceShardView(
                    index: index,
                    diameter: diameter,
                    color: frozenBlue
                )
            }
        }
    }

    // MARK: - Shatter Animation

    private func triggerShatterAnimation() {
        shatterPhase = true
        #if !targetEnvironment(simulator)
        HapticManager.shared.notification(type: .success)
        #endif

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            shatterPhase = false
        }
    }
}

// MARK: - Ice Shard View

private struct IceShardView: View {
    let index: Int
    let diameter: CGFloat
    let color: Color

    @State private var offset: CGFloat = 0
    @State private var opacity: Double = 1.0
    @State private var rotation: Double = 0

    private var angle: Double {
        Double(index) * (360.0 / 8.0)
    }

    var body: some View {
        Image(systemName: "diamond.fill")
            .font(.system(size: diameter * 0.12))
            .foregroundStyle(color.opacity(opacity))
            .rotationEffect(.degrees(rotation))
            .offset(
                x: cos(angle * .pi / 180) * offset,
                y: sin(angle * .pi / 180) * offset
            )
            .onAppear {
                withAnimation(.easeOut(duration: 0.6)) {
                    offset = diameter * 0.8
                    opacity = 0
                    rotation = Double.random(in: -180...180)
                }
            }
    }
}

// MARK: - Preview

#Preview("Normal - Full") {
    CooldownRingView(pixelService: .shared, diameter: 48)
        .padding()
        .background(Color.black.opacity(0.8))
}

#Preview("Large") {
    CooldownRingView(pixelService: .shared, diameter: 80, lineWidth: 6)
        .padding()
        .background(Color.black.opacity(0.8))
}
