import Foundation
import SwiftUI

/// 段位详细信息（包含福利）
struct RankTierDetail: Codable, Identifiable {
    let id: String
    let name: String
    let nameEn: String
    let icon: String
    let color: String
    let minPixels: Int
    let pixelsRequired: Int
    let isMaxTier: Bool
    let order: Int
    let benefits: TierBenefits

    struct TierBenefits: Codable {
        let badges: [String]
        let features: [TierFeature]
        let limits: TierLimits
    }

    struct TierFeature: Codable, Identifiable {
        let id: String
        let nameZh: String
        let nameEn: String

        var localizedName: String {
            Locale.current.language.languageCode?.identifier == "zh" ? nameZh : nameEn
        }
    }

    struct TierLimits: Codable {
        let dailyPixelQuota: Int
        let maxDrawingSessionTime: Int
        let profileCustomization: String
    }

    /// SwiftUI 颜色
    var swiftUIColor: Color {
        Color(hex: color) ?? .gray
    }

    /// 福利数量
    var totalBenefitsCount: Int {
        benefits.badges.count + benefits.features.count
    }
}

/// 段位列表响应
struct RankTiersResponse: Codable {
    let success: Bool
    let data: RankTiersData

    struct RankTiersData: Codable {
        let tiers: [RankTierDetail]
        let totalCount: Int
    }
}
