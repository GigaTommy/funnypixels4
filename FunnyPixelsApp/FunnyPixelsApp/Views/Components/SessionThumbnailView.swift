import SwiftUI
import Combine

/// 会话缩略图 - 用于动态流中显示绘制路径预览
struct SessionThumbnailView: View {
    let sessionId: String
    @StateObject private var loader: SessionThumbnailLoader

    init(sessionId: String) {
        self.sessionId = sessionId
        _loader = StateObject(wrappedValue: SessionThumbnailLoader(sessionId: sessionId))
    }

    var body: some View {
        ZStack {
            // 背景渐变
            LinearGradient(
                colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            if loader.isLoading {
                // 加载中
                ProgressView()
                    .tint(.white.opacity(0.7))
            } else if let pixels = loader.pixels, !pixels.isEmpty {
                // 显示路径
                PathArtworkView(
                    pixels: pixels,
                    sessionTime: Date(), // 使用当前时间作为fallback
                    drawingType: "gps",
                    showPixelDots: false
                )
            } else {
                // 空状态
                Image(systemName: "map")
                    .font(.system(size: 24))
                    .foregroundColor(.gray.opacity(0.5))
            }
        }
        .task {
            await loader.loadPixels()
        }
    }
}

/// 会话缩略图加载器
@MainActor
class SessionThumbnailLoader: ObservableObject {
    let sessionId: String
    @Published var pixels: [SessionPixel]?
    @Published var isLoading = false

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func loadPixels() async {
        guard !isLoading else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            Logger.info("📸 [Thumbnail] Loading pixels for session: \(sessionId)")
            let pixels = try await DrawingHistoryService.shared.getSessionPixels(id: sessionId)
            Logger.info("📸 [Thumbnail] Loaded \(pixels.count) pixels")
            self.pixels = pixels
        } catch {
            if let apiError = error as? APIError {
                Logger.error("❌ [Thumbnail] API Error: \(apiError)")
            } else if let decodingError = error as? DecodingError {
                Logger.error("❌ [Thumbnail] Decoding Error: \(decodingError)")
            } else {
                Logger.error("❌ [Thumbnail] Unknown Error: \(error)")
            }
            self.pixels = nil
        }
    }
}
