import Foundation

/// 绘制历史服务
class DrawingHistoryService {
    static let shared = DrawingHistoryService()

    private init() {}

    /// 共享 JSON 解码器（snake_case 键 + ISO8601 日期）
    private static let snakeCaseDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    /// 获取用户会话列表
    func getSessions(
        page: Int = 1,
        limit: Int = 20,
        status: String = "all",
        startDate: Date? = nil,
        endDate: Date? = nil,
        city: String? = nil
    ) async throws -> SessionsResponse {
        var components = URLComponents()
        components.path = "/drawing-sessions"
        var queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "status", value: status)
        ]

        if let start = startDate {
            let formatter = ISO8601DateFormatter()
            queryItems.append(URLQueryItem(name: "startDate", value: formatter.string(from: start)))
        }

        if let end = endDate {
            let formatter = ISO8601DateFormatter()
            queryItems.append(URLQueryItem(name: "endDate", value: formatter.string(from: end)))
        }

        if let city = city, !city.isEmpty {
            queryItems.append(URLQueryItem(name: "city", value: city))
        }

        components.queryItems = queryItems
        let path = components.string ?? "/drawing-sessions"

        let response: DataResponse<SessionsResponse> = try await APIManager.shared.get(
            path,
            decoder: Self.snakeCaseDecoder
        )
        return response.data
    }

    /// 获取会话详情
    func getSessionDetail(id: String) async throws -> SessionDetail {
        let response: DataResponse<SessionDetail> = try await APIManager.shared.get(
            "/drawing-sessions/\(id)",
            decoder: Self.snakeCaseDecoder
        )
        return response.data
    }

    /// 获取会话像素列表
    func getSessionPixels(id: String) async throws -> [SessionPixel] {
        let response: DataResponse<SessionPixelsData> = try await APIManager.shared.get(
            "/drawing-sessions/\(id)/pixels",
            decoder: Self.snakeCaseDecoder
        )
        return response.data.pixels
    }

    /// 批量获取多个会话的像素数据（优化版：每个会话只返回前10个像素用于预览）
    /// - Parameter sessionIds: 会话ID列表（最多50个）
    /// - Returns: 字典，key为sessionId，value为像素列表
    func getBatchPixels(sessionIds: [String]) async throws -> [String: [SessionPixel]] {
        guard !sessionIds.isEmpty else {
            return [:]
        }

        guard sessionIds.count <= 50 else {
            throw APIError.validationError("最多批量查询50个会话")
        }

        let response: DataResponse<[String: [SessionPixel]]> = try await APIManager.shared.post(
            "/drawing-sessions/batch-pixels",
            parameters: ["sessionIds": sessionIds],
            decoder: Self.snakeCaseDecoder
        )
        Logger.info("📦 批量获取像素: \(sessionIds.count)个会话, \(response.data.count)个有数据")
        return response.data
    }
}

// MARK: - Private Response Types

private struct SessionPixelsData: Codable {
    let pixels: [SessionPixel]
}
