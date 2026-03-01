import SwiftUI

/// 通用 5x5 像素格子渲染组件
struct PixelSnapshotView: View {
    let snapshot: PixelSnapshot?
    var size: CGFloat = 60
    var cornerRadius: CGFloat = 8

    private var cellSize: CGFloat {
        size / 5.0
    }

    var body: some View {
        if let grid = snapshot?.grid {
            VStack(spacing: 0) {
                ForEach(0..<min(grid.count, 5), id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<min(grid[row].count, 5), id: \.self) { col in
                            Rectangle()
                                .fill(colorForCell(grid[row][col]))
                                .frame(width: cellSize, height: cellSize)
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        } else {
            // Placeholder
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color.gray.opacity(0.2))
                .frame(width: size, height: size)
                .overlay(
                    Image(systemName: "square.grid.3x3.fill")
                        .foregroundColor(.gray.opacity(0.4))
                )
        }
    }

    private func colorForCell(_ hex: String?) -> Color {
        guard let hex = hex, !hex.isEmpty else {
            return Color.gray.opacity(0.15)
        }
        return Color(hex: hex) ?? Color.gray.opacity(0.15)
    }
}
