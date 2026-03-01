import SwiftUI
import Combine

/// 全局应用状态管理
/// 负责管理Tab选择、Sub-Tab选择、跨Tab导航等全局状态
class AppState: ObservableObject {
    static let shared = AppState()

    // MARK: - Tab Selection
    @Published var selectedTab: Tab = .map

    // MARK: - Sub-Tab Selection
    @Published var feedSubTab: FeedSubTab = .plaza
    @Published var allianceSubTab: AllianceSubTab = .myAlliance
    @Published var profileSubTab: ProfileSubTab = .personal

    // MARK: - Badge Counts
    @Published var badgeCounts: [Tab: Int] = [:]

    // MARK: - Navigation Parameters
    @Published var pendingSessionId: Int?
    @Published var pendingMapCoordinate: (lat: Double, lng: Double)?

    private init() {}

    // MARK: - Tab Navigation

    /// 切换到指定Tab
    func navigate(to tab: Tab) {
        selectedTab = tab
    }

    /// 切换到动态Tab的指定子标签
    func navigateToFeed(subTab: FeedSubTab, sessionId: Int? = nil) {
        selectedTab = .feed
        feedSubTab = subTab
        pendingSessionId = sessionId

        // 通过NotificationCenter传递参数（用于深层导航）
        if let sessionId = sessionId {
            NotificationCenter.default.post(
                name: .navigateToSession,
                object: sessionId
            )
        }
    }

    /// 切换到联盟Tab的指定子标签
    func navigateToAlliance(subTab: AllianceSubTab) {
        selectedTab = .alliance
        allianceSubTab = subTab
    }

    /// 切换到我的Tab的指定子标签
    func navigateToProfile(subTab: ProfileSubTab) {
        selectedTab = .profile
        profileSubTab = subTab
    }

    /// 切换到地图Tab并飞往指定坐标
    func navigateToMap(coordinate: (lat: Double, lng: Double)? = nil) {
        selectedTab = .map
        pendingMapCoordinate = coordinate

        if let coord = coordinate {
            NotificationCenter.default.post(
                name: .navigateToMapLocation,
                object: ["lat": coord.lat, "lng": coord.lng]
            )
        }
    }

    // MARK: - Badge Management

    func updateBadge(for tab: Tab, count: Int) {
        badgeCounts[tab] = count > 0 ? count : nil
    }

    func clearBadge(for tab: Tab) {
        badgeCounts[tab] = nil
    }
}

// MARK: - Tab Enumeration

enum Tab: String, CaseIterable {
    case map
    case feed
    case alliance
    case profile

    var title: String {
        switch self {
        case .map: return NSLocalizedString("tab.map", comment: "Map")
        case .feed: return NSLocalizedString("tab.feed", comment: "Feed")
        case .alliance: return NSLocalizedString("tab.alliance", comment: "Alliance")
        case .profile: return NSLocalizedString("tab.profile", comment: "Me")
        }
    }

    var icon: String {
        switch self {
        case .map: return "TabIconMap"
        case .feed: return "TabIconFeed"
        case .alliance: return "TabIconAlliance"
        case .profile: return "TabIconProfile"
        }
    }

    var index: Int {
        switch self {
        case .map: return 0
        case .feed: return 1
        case .alliance: return 2
        case .profile: return 3
        }
    }
}

// MARK: - Sub-Tab Enumerations

enum FeedSubTab: String, CaseIterable, CustomStringConvertible {
    case plaza
    case tracks
    case data

    var description: String {
        switch self {
        case .plaza: return NSLocalizedString("feed.plaza", comment: "Plaza")
        case .tracks: return NSLocalizedString("feed.tracks", comment: "Tracks")
        case .data: return NSLocalizedString("feed.data", comment: "Data")
        }
    }
}

enum AllianceSubTab: String, CaseIterable, CustomStringConvertible {
    case myAlliance
    case discover

    var description: String {
        switch self {
        case .myAlliance: return NSLocalizedString("alliance.my", comment: "My Alliance")
        case .discover: return NSLocalizedString("alliance.discover", comment: "Discover")
        }
    }
}

enum ProfileSubTab: String, CaseIterable, CustomStringConvertible {
    case personal
    case leaderboard
    case more

    var description: String {
        switch self {
        case .personal: return NSLocalizedString("profile.personal", comment: "Personal")
        case .leaderboard: return NSLocalizedString("profile.leaderboard", comment: "Leaderboard")
        case .more: return NSLocalizedString("profile.more", comment: "More")
        }
    }
}

// MARK: - NotificationCenter Extensions

extension Notification.Name {
    static let navigateToSession = Notification.Name("navigateToSession")
    static let navigateToMapLocation = Notification.Name("navigateToMapLocation")
}
