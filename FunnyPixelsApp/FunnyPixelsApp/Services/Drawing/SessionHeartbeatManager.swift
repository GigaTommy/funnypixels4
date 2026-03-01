import Foundation
import Combine

/// 会话心跳管理器
/// 负责在绘制期间定期发送心跳到后端
@MainActor
class SessionHeartbeatManager: ObservableObject {
    static let shared = SessionHeartbeatManager()
    
    private var timer: Timer?
    private let interval: TimeInterval = 120 // 2分钟
    private var currentSessionId: String?
    
    private init() {}
    
    /// 开始发送心跳
    func start(sessionId: String) {
        stop()
        
        currentSessionId = sessionId
        Logger.info("💓 Starting heartbeat timer for session: \(sessionId)")
        
        // 立即发送一次
        Task {
            await sendHeartbeat()
        }
        
        // 设置定时器
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.sendHeartbeat()
            }
        }
    }
    
    /// 停止发送心跳
    func stop() {
        timer?.invalidate()
        timer = nil
        currentSessionId = nil
        Logger.info("💓 Heartbeat timer stopped")
    }
    
    private func sendHeartbeat() async {
        guard let sessionId = currentSessionId else { return }
        
        do {
            try await DrawingSessionService.shared.updateHeartbeat(sessionId: sessionId)
            Logger.debug("💓 Heartbeat pulse sent for session: \(sessionId)")
        } catch {
            Logger.error("💓 Failed to send heartbeat: \(error.localizedDescription)")
        }
    }
}
