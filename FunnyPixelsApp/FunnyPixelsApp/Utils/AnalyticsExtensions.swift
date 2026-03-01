import Foundation
import CoreLocation

/// 便捷的埋点扩展
public extension AnalyticsManager {

    /// 追踪应用启动
    static func trackAppLaunch() {
        shared.track("app_launch", properties: [
            "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        ])
    }

    /// 追踪页面浏览
    static func trackPageView(_ pageName: String) {
        shared.track("page_view", properties: ["page": pageName])
    }

    /// 追踪联盟相关操作
    func trackAllianceJoin(_ allianceId: String) {
        track("alliance_join", properties: ["alliance_id": allianceId])
    }

    func trackAllianceLeave(_ allianceId: String) {
        track("alliance_leave", properties: ["alliance_id": allianceId])
    }

    /// 追踪商店相关操作
    func trackStoreItemView(_ itemId: String, itemName: String) {
        track("store_item_view", properties: [
            "item_id": itemId,
            "item_name": itemName
        ])
    }

    func trackStorePurchase(_ itemId: String, amount: Double) {
        track("store_purchase", properties: [
            "item_id": itemId,
            "amount": amount
        ])
    }

    /// 追踪性能指标
    func trackPerformance(_ metric: String, value: Double, unit: String = "ms") {
        track("performance", properties: [
            "metric": metric,
            "value": value,
            "unit": unit
        ])
    }
}
