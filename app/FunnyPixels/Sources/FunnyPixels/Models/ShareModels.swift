import Foundation
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Share Models

/// 分享类型
enum ShareType: String, Codable, CaseIterable {
    case pixel = "pixel"              // 像素分享
    case session = "session"          // 会话分享
    case userProfile = "user_profile" // 用户资料分享
    case alliance = "alliance"        // 联盟分享
    case app = "app"                  // 应用分享

    var displayName: String {
        switch self {
        case .pixel: return "像素"
        case .session: return "会话"
        case .userProfile: return "用户资料"
        case .alliance: return "联盟"
        case .app: return "应用"
        }
    }
}

/// 分享内容
struct ShareContent: Codable {
    let type: ShareType
    let id: String
    let title: String
    let description: String
    let url: URL?
    let imageUrl: URL?
    let thumbnailData: Data?
    let metadata: [String: String]

    init(type: ShareType, id: String, title: String, description: String,
         url: URL?, imageUrl: URL? = nil, thumbnailData: Data? = nil,
         metadata: [String: String] = [:]) {
        self.type = type
        self.id = id
        self.title = title
        self.description = description
        self.url = url
        self.imageUrl = imageUrl
        self.thumbnailData = thumbnailData
        self.metadata = metadata
    }
}

/// 像素分享内容
struct PixelShareContent {
    let pixel: Pixel
    let shareUrl: URL?

    var shareText: String {
        """
        我在 FunnyPixels 发现了一个有趣的像素！

        颜色：\(pixel.color.uppercased())
        坐标：\(String(format: "%.4f, %.4f", pixel.latitude, pixel.longitude))

        来一起创作吧！#FunnyPixels
        """
    }
}

/// 会话分享内容
struct SessionShareContent {
    let sessionId: String
    let stats: SessionStats
    let shareUrl: URL?
    let includeStats: Bool
    let includeRoute: Bool

    var shareText: String {
        let statsText = includeStats ?
            """

            统计信息：
            - 像素数：\(stats.pixelCount)
            - 时长：\(stats.durationFormatted)
            """ : ""

        return """
        我的绘制会话分享

        \(statsText)

        来 FunnyPixels 一起创作吧！
        """
    }
}

/// 会话统计信息
struct SessionStats {
    let pixelCount: Int
    let duration: TimeInterval
    let distance: Double?
    let efficiency: Double?

    var durationFormatted: String {
        let minutes = Int(duration) / 60
        if minutes >= 60 {
            let hours = minutes / 60
            return "\(hours)h\(minutes % 60)m"
        }
        return "\(minutes)m"
    }
}

/// 用户资料分享内容
struct UserProfileShareContent {
    let profile: UserProfile
    let shareUrl: URL?

    var shareText: String {
        """
        查看 \(profile.displayOrUsername) 在 FunnyPixels 的创作作品！

        总像素数：\(profile.statistics.totalPixels)
        绘制时长：\(Int(profile.statistics.totalDrawingHours))小时

        来一起创作吧！#FunnyPixels
        """
    }
}

/// 二维码配置
struct QRCodeConfig {
    let content: String
    let size: CGSize
    let correctionLevel: CorrectionLevel
    #if canImport(UIKit)
    let foregroundColor: UIColor
    let backgroundColor: UIColor
    let logo: UIImage?
    let logoSize: CGSize?
    #endif

    enum CorrectionLevel: String {
        case low = "L"
        case medium = "M"
        case high = "Q"
        case highest = "H"
    }

    #if canImport(UIKit)
    static let `default` = QRCodeConfig(
        content: "",
        size: CGSize(width: 200, height: 200),
        correctionLevel: .medium,
        foregroundColor: .black,
        backgroundColor: .white,
        logo: nil,
        logoSize: nil
    )
    #else
    static let `default` = QRCodeConfig(
        content: "",
        size: CGSize(width: 200, height: 200),
        correctionLevel: .medium
    )
    #endif
}

/// 分享统计
struct ShareAnalytics: Codable {
    let shareId: String
    let type: ShareType
    let platform: SharePlatform
    let timestamp: Date
    let userId: String?
    let targetId: String

    enum SharePlatform: String, Codable {
        case wechat = "wechat"
        case weibo = "weibo"
        case qq = "qq"
        case twitter = "twitter"
        case facebook = "facebook"
        case copyLink = "copy_link"
        case more = "more"
        case unknown = "unknown"
    }
}

/// 分享API响应
struct ShareResponse: Codable {
    let success: Bool
    let data: ShareData?
    let message: String?

    struct ShareData: Codable {
        let shareId: String
        let shareUrl: String
        let qrCodeUrl: String?
        let expiresAt: String?

        enum CodingKeys: String, CodingKey {
            case shareId = "share_id"
            case shareUrl = "share_url"
            case qrCodeUrl = "qr_code_url"
            case expiresAt = "expires_at"
        }
    }
}

/// 分享选项
enum ShareOption: CaseIterable {
    case wechat
    case weibo
    case qq
    case twitter
    case facebook
    case copyLink
    case qrCode
    case saveImage

    var displayName: String {
        switch self {
        case .wechat: return "微信"
        case .weibo: return "微博"
        case .qq: return "QQ"
        case .twitter: return "Twitter"
        case .facebook: return "Facebook"
        case .copyLink: return "复制链接"
        case .qrCode: return "二维码"
        case .saveImage: return "保存图片"
        }
    }

    var iconName: String {
        switch self {
        case .wechat: return "bubble.left.fill"
        case .weibo: return "at"
        case .qq: return "message.fill"
        case .twitter: return "t.bird.fill"
        case .facebook: return "f.circle.fill"
        case .copyLink: return "link"
        case .qrCode: return "qrcode"
        case .saveImage: return "square.and.arrow.down"
        }
    }
}

// MARK: - Supporting Types

/// 分享错误
enum ShareError: LocalizedError {
    case imageGenerationFailed
    case invalidShareURL
    case shareCancelled
    case unknown(any Error)

    var errorDescription: String? {
        switch self {
        case .imageGenerationFailed:
            return "生成分享图片失败"
        case .invalidShareURL:
            return "无效的分享链接"
        case .shareCancelled:
            return "分享已取消"
        case .unknown(let error):
            return error.localizedDescription
        }
    }
}

// DrawingSession is defined in MapViewModel.swift as ObservableObject class
