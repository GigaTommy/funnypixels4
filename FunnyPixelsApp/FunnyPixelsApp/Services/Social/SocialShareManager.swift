import UIKit
import Combine
import UniformTypeIdentifiers

class SocialShareManager {
    static let shared = SocialShareManager()

    private init() {}

    // Check if app is installed
    func canOpen(_ scheme: String) -> Bool {
        guard let url = URL(string: "\(scheme)://") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    // Share to third-party app via pasteboard + URL scheme
    func shareToApp(scheme: String, image: UIImage?, text: String?, url: String?) {
        let pasteboard = UIPasteboard.general

        // Clear previous
        pasteboard.items = []

        var items: [String: Any] = [:]

        // Image must be serialized as Data for pasteboard, not UIImage
        if let image = image, let imageData = image.pngData() {
            items[UTType.png.identifier] = imageData
        }

        let stringKey = UTType.utf8PlainText.identifier
        if let text = text {
            items[stringKey] = text
        }

        if let urlStr = url {
             if let existingText = items[stringKey] as? String {
                 items[stringKey] = "\(existingText)\n\(urlStr)"
             } else {
                 items[stringKey] = urlStr
             }
        }

        if !items.isEmpty {
            pasteboard.addItems([items])
        }

        // Also set image directly for apps that read pasteboard.image
        if let image = image {
            pasteboard.image = image
        }

        // Open App
        if let appUrl = URL(string: "\(scheme)://") {
             UIApplication.shared.open(appUrl)
        }
    }

    // Copy Link specific
    func copyLink(_ url: String) {
        UIPasteboard.general.string = url
    }
}

enum SocialPlatform: CaseIterable {
    case wechatSession
    case wechatTimeline
    case weibo
    case xxhs
    case saveImage
    case copyLink

    var title: String {
        switch self {
        case .wechatSession: return NSLocalizedString("share.platform.wechat_session", comment: "")
        case .wechatTimeline: return NSLocalizedString("share.platform.wechat_timeline", comment: "")
        case .weibo: return NSLocalizedString("share.platform.weibo", comment: "")
        case .xxhs: return NSLocalizedString("share.platform.xiaohongshu", comment: "")
        case .saveImage: return NSLocalizedString("share.platform.save_image", comment: "")
        case .copyLink: return NSLocalizedString("share.platform.copy_link", comment: "")
        }
    }

    var iconName: String {
        switch self {
        case .wechatSession: return "message.fill"
        case .wechatTimeline: return "camera.aperture"
        case .weibo: return "eye.fill"
        case .xxhs: return "book.fill"
        case .saveImage: return "square.and.arrow.down"
        case .copyLink: return "link"
        }
    }

    var color: UIColor {
        switch self {
        case .wechatSession: return UIColor(red: 0x07/255.0, green: 0xC1/255.0, blue: 0x60/255.0, alpha: 1)
        case .wechatTimeline: return UIColor(red: 0x07/255.0, green: 0xC1/255.0, blue: 0x60/255.0, alpha: 1)
        case .weibo: return UIColor(red: 0xE6/255.0, green: 0x16/255.0, blue: 0x2D/255.0, alpha: 1)
        case .xxhs: return UIColor(red: 0xFF/255.0, green: 0x24/255.0, blue: 0x42/255.0, alpha: 1)
        case .saveImage: return .systemBlue
        case .copyLink: return .systemGray
        }
    }

    var urlScheme: String? {
        switch self {
        case .wechatSession, .wechatTimeline: return "weixin"
        case .weibo: return "sinaweibo"
        case .xxhs: return "xhsdiscover"
        case .saveImage, .copyLink: return nil
        }
    }
}
