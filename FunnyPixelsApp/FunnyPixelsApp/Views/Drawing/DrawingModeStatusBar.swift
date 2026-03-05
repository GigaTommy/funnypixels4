import SwiftUI

/// A compact status bar shown near drawing controls on the main map
/// Displays: CooldownRingView + current color/emoji preview + combo counter
/// Only visible when user is in drawing mode
struct DrawingModeStatusBar: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @ObservedObject var drawingState: DrawingStateManager
    @ObservedObject var pixelService: PixelDrawService
    @ObservedObject var comboTracker: PixelComboTracker

    @State private var comboScale: CGFloat = 1.0
    @State private var isAppearing = false

    init(
        drawingState: DrawingStateManager = .shared,
        pixelService: PixelDrawService = .shared,
        comboTracker: PixelComboTracker = .shared
    ) {
        self.drawingState = drawingState
        self.pixelService = pixelService
        self.comboTracker = comboTracker
    }

    // MARK: - Computed Properties

    private var shouldShow: Bool {
        drawingState.isDrawingMode && drawingState.currentMode != .none
    }

    private var currentModeIcon: String {
        drawingState.currentMode.icon
    }

    private var currentModeLabel: String {
        drawingState.currentMode.displayName
    }

    // MARK: - Body

    var body: some View {
        if shouldShow {
            HStack(spacing: 10) {
                // Cooldown Ring
                CooldownRingView(
                    pixelService: pixelService,
                    diameter: 36,
                    lineWidth: 3
                )

                // Divider
                Capsule()
                    .fill(Color.white.opacity(0.2))
                    .frame(width: 1, height: 24)

                // Current drawing mode preview
                drawingPreview

                // Combo counter (if active)
                if comboTracker.currentCombo >= 2 {
                    Capsule()
                        .fill(Color.white.opacity(0.2))
                        .frame(width: 1, height: 24)

                    comboCounterView
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(.ultraThinMaterial)
                    .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
            )
            .overlay(
                Capsule()
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 0.5)
            )
            .scaleEffect(isAppearing ? 1.0 : 0.8)
            .opacity(isAppearing ? 1.0 : 0.0)
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    isAppearing = true
                }
            }
            .onDisappear {
                isAppearing = false
            }
            .onChange(of: comboTracker.currentCombo) { oldValue, newValue in
                if newValue > oldValue && newValue >= 2 {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.5)) {
                        comboScale = 1.3
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                            comboScale = 1.0
                        }
                    }
                }
            }
        }
    }

    // MARK: - Drawing Preview

    @ViewBuilder
    private var drawingPreview: some View {
        HStack(spacing: 6) {
            // Mode icon
            Image(systemName: currentModeIcon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.secondary)

            // Color/Emoji preview
            switch drawingState.currentMode {
            case .color:
                Circle()
                    .fill(Color(hex: drawingState.selectedColor) ?? .blue)
                    .frame(width: 20, height: 20)
                    .overlay(
                        Circle()
                            .strokeBorder(Color.white.opacity(0.3), lineWidth: 1)
                    )

            case .emoji:
                Text(drawingState.selectedEmoji)
                    .font(.system(size: 18))

            case .complex:
                Image(systemName: "square.grid.3x3.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(UnifiedColors.primary)

            case .gps:
                Image(systemName: "location.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(.green)

            case .none:
                EmptyView()
            }

            // Mode label
            Text(currentModeLabel)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Combo Counter View

    private var comboCounterView: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .font(.system(size: 12))
                .foregroundStyle(comboColor)

            Text(String(format: NSLocalizedString("drawing.status.combo_count", comment: "Combo count display"), comboTracker.currentCombo))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(comboColor)
                .monospacedDigit()
        }
        .scaleEffect(comboScale)
    }

    private var comboColor: Color {
        if comboTracker.currentCombo >= 10 {
            return .red
        } else if comboTracker.currentCombo >= 5 {
            return .orange
        } else {
            return .yellow
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.opacity(0.8)
            .ignoresSafeArea()

        VStack {
            Spacer()

            DrawingModeStatusBar()
                .padding(.bottom, 100)
        }
    }
}
