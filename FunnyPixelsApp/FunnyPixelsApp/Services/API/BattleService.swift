import Foundation
import Combine

/// 领土动态 API 服务
class BattleService {
    static let shared = BattleService()

    private init() {}

    /// 获取领土动态 feed（分页）
    func getBattleFeed(page: Int = 1, limit: Int = 20) async throws -> BattleFeedData {
        let response: BattleFeedResponse = try await APIManager.shared.get("/battles", parameters: [
            "page": String(page),
            "limit": String(limit)
        ])
        return response.data
    }

    /// 获取未读数
    func getUnreadCount() async throws -> Int {
        let response: BattleUnreadResponse = try await APIManager.shared.get("/battles/unread")
        return response.data.unread_count
    }
}
