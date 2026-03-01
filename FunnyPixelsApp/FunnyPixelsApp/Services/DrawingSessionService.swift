import Foundation
import CoreLocation

/// 绘制会话服务 - 管理后端会话API
class DrawingSessionService {
    static let shared = DrawingSessionService()

    private init() {}

    /// 开始新的绘制会话
    func startSession(
        sessionName: String,
        drawingType: String,
        startLocation: CLLocationCoordinate2D?,
        allianceId: Int?
    ) async throws -> SessionStartResponse {
        var parameters: [String: Any] = [
            "session_name": sessionName,
            "drawing_type": drawingType
        ]

        if let location = startLocation {
            parameters["start_location"] = [
                "latitude": location.latitude,
                "longitude": location.longitude
            ]
        }

        if let allianceId = allianceId {
            parameters["alliance_id"] = allianceId
        }

        let response: DataResponse<SessionStartResponse> = try await APIManager.shared.post(
            "/drawing-sessions/start",
            parameters: parameters
        )
        return response.data
    }

    /// 结束绘制会话
    func endSession(
        sessionId: String,
        endLocation: CLLocationCoordinate2D?
    ) async throws -> SessionEndResponse {
        var parameters: [String: Any] = [:]

        if let location = endLocation {
            parameters["end_location"] = [
                "latitude": location.latitude,
                "longitude": location.longitude
            ]
        }

        let response: DataResponse<SessionEndResponse> = try await APIManager.shared.post(
            "/drawing-sessions/\(sessionId)/end",
            parameters: parameters
        )
        return response.data
    }

    /// 更新会话心跳
    func updateHeartbeat(sessionId: String) async throws {
        let parameters: [String: Any] = [
            "session_id": sessionId
        ]

        let _: HeartbeatResponse = try await APIManager.shared.post(
            "/drawing-sessions/\(sessionId)/heartbeat",
            parameters: parameters
        )
    }

    /// 获取当前活跃会话
    func getActiveSession() async throws -> SessionStartResponse? {
        do {
            let response: StandardResponse<SessionStartResponse> = try await APIManager.shared.get(
                "/drawing-sessions/active"
            )
            return response.data
        } catch {
            return nil
        }
    }
}

// MARK: - Private Response Types

private struct HeartbeatResponse: Codable {
    let success: Bool
}

// MARK: - Response Models

struct SessionStartResponse: Codable {
    let id: String
    let userId: String
    let sessionName: String
    let drawingType: String
    let status: String
    let startTime: String

    var sessionId: String { id }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case sessionName = "session_name"
        case drawingType = "drawing_type"
        case status
        case startTime = "start_time"
    }
}

struct SessionEndResponse: Codable {
    let id: String
    let status: String
    let endTime: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case endTime = "end_time"
    }
}
