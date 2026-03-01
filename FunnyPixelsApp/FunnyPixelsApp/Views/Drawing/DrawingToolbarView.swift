import SwiftUI

/// 颜色选择器
struct ColorPickerView: View {
    @ObservedObject var drawingState: DrawingStateManager
    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 5)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 当前选择的颜色
                    VStack(spacing: 12) {
                        Text(NSLocalizedString("drawing.color.current", comment: "Current color"))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Circle()
                            .fill(Color(hex: drawingState.selectedColor) ?? .blue)
                            .frame(width: 80, height: 80)
                            .overlay {
                                Circle()
                                    .strokeBorder(.quaternary, lineWidth: 1)
                            }
                            .shadow(color: Color(hex: drawingState.selectedColor)?.opacity(0.3) ?? .clear, radius: 10)

                        Text(drawingState.selectedColor.uppercased())
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    .padding()

                    Divider()

                    // 预设颜色
                    VStack(alignment: .leading, spacing: 12) {
                        Text(NSLocalizedString("drawing.color.presets", comment: "Preset colors"))
                            .font(.headline)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(PresetColors.colors, id: \.self) { color in
                                ColorButton(
                                    color: color,
                                    isSelected: color == drawingState.selectedColor
                                ) {
                                    drawingState.selectedColor = color
                                    dismiss()
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(NSLocalizedString("drawing.color.select_title", comment: "Select color"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.done", comment: "Done")) {
                        dismiss()
                    }
                }
            }
        }
    }
}

/// 颜色按钮
struct ColorButton: View {
    let color: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(Color(hex: color) ?? .blue)
                .frame(width: 44, height: 44)
                .overlay {
                    if isSelected {
                        Circle()
                            .strokeBorder(.white, lineWidth: 3)
                            .frame(width: 44, height: 44)
                        }
                }
                .shadow(color: .black.opacity(0.1), radius: 2)
        }
    }
}

/// Emoji选择器
struct EmojiPickerView: View {
    @ObservedObject var drawingState: DrawingStateManager
    @Environment(\.dismiss) private var dismiss

    private let categories = [
        ("表情", ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂"]),
        ("爱心", ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍"]),
        ("动物", ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"]),
        ("食物", ["🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒"]),
        ("运动", ["⚽️", "🏀", "🏈", "⚾️", "🎾", "🏐", "🏉", "🎱"]),
        ("符号", ["⭐️", "🌟", "✨", "💫", "🔥", "💧", "🌈", "☀️"])
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // 当前选择
                    VStack(spacing: 12) {
                        Text(NSLocalizedString("drawing.emoji.current", comment: "Current emoji"))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(drawingState.selectedEmoji)
                            .font(.system(size: 60))

                        Text(NSLocalizedString("drawing.emoji.tap_to_select", comment: "Tap to select emoji"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()

                    Divider()

                    // 分类表情
                    ForEach(categories, id: \.0) { category, emojis in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(category)
                                .font(.headline)
                                .padding(.horizontal)

                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 16) {
                                ForEach(emojis, id: \.self) { emoji in
                                    EmojiButton(
                                        emoji: emoji,
                                        isSelected: emoji == drawingState.selectedEmoji
                                    ) {
                                        drawingState.selectedEmoji = emoji
                                        dismiss()
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(NSLocalizedString("drawing.emoji.select_title", comment: "Select emoji"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.done", comment: "Done")) {
                        dismiss()
                    }
                }
            }
        }
    }
}

/// Emoji按钮
struct EmojiButton: View {
    let emoji: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(emoji)
                .font(.system(size: 36))
                .frame(width: 60, height: 60)
                .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(isSelected ? .blue : .clear, lineWidth: 2)
                )
        }
    }
}

/// 绘制模式选择器
struct DrawingModePicker: View {
    @ObservedObject var drawingState: DrawingStateManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(DrawingMode.allCases.filter { $0 != .none }, id: \.self) { mode in
                    Button(action: {
                        drawingState.openDrawingPanel()  // 只打开面板，不开始绘制
                        dismiss()
                    }) {
                        HStack(spacing: 16) {
                            Image(systemName: mode.icon)
                                .font(.title2)
                                .foregroundColor(.blue)
                                .frame(width: 44, height: 44)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(10)

                            Text(mode.displayName)
                                .font(.body)

                            Spacer()

                            if drawingState.currentMode == mode {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.blue)
                            }
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("drawing.mode.title", comment: "Drawing mode"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.done", comment: "Done")) {
                        dismiss()
                    }
                }
            }
        }
    }
}

/// 绘制控制面板
struct DrawingControlPanel: View {
    @ObservedObject var drawingState: DrawingStateManager

    var body: some View {
        VStack(spacing: 16) {
            // 当前模式指示器
            HStack {
                Button(action: {
                    Task {
                        await drawingState.stopDrawing()
                    }
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(NSLocalizedString("drawing.gps.title", comment: "GPS drawing title"))
                    .font(.headline)
            }

            Divider()

            // GPS 绘制控制
            gpsControls

            Divider()

            // 会话信息
            gpsSessionInfo
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
    }

    private var gpsSessionInfo: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(NSLocalizedString("drawing.gps.session_title", comment: "GPS session title"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(String(format: NSLocalizedString("drawing.gps.session_pixels", comment: "GPS session pixels"), drawingState.gpsDrawingPixelCount))
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Circle()
                    .fill(drawingState.isGPSDrawingActive ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(drawingState.isGPSDrawingActive
                     ? NSLocalizedString("drawing.gps.active", comment: "GPS active")
                     : NSLocalizedString("drawing.gps.idle", comment: "GPS idle"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var gpsControls: some View {
        HStack(spacing: 12) {
            Button(action: {
                Task {
                    await toggleGPSDrawing()
                }
            }) {
                HStack(spacing: 8) {
                    Image(systemName: drawingState.isGPSDrawingActive ? "location.fill" : "location")
                        .font(.title2)

                    Text(drawingState.isGPSDrawingActive
                         ? NSLocalizedString("drawing.gps.stop", comment: "Stop GPS drawing")
                         : NSLocalizedString("drawing.gps.start", comment: "Start GPS drawing"))
                        .font(.subheadline)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(drawingState.isGPSDrawingActive ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                .cornerRadius(10)
            }
        }
    }

    private func toggleGPSDrawing() async {
        if drawingState.isGPSDrawingActive {
            // 停止GPS绘制
            await GPSDrawingService.shared.stopGPSDrawing()
            await drawingState.stopDrawing()
        } else {
            // 开始GPS绘制
            await drawingState.requestStartGPSDrawing()
        }
    }

    private var emptyView: some View {
        Text(NSLocalizedString("drawing.gps.not_active", comment: "GPS not active"))
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
    }
}

/// 绘制工具栏底部面板
struct DrawingToolbarSheet: View {
    @ObservedObject var drawingState: DrawingStateManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // 拖动指示器
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 36, height: 4)
                .padding(.top, 8)

            // 绘制控制面板
            DrawingControlPanel(drawingState: drawingState)
                .padding()
        }
        .background(.regularMaterial)
        .presentationDetents([.height(280), .large])
        .presentationDragIndicator(.visible)
    }
}
