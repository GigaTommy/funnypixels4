import Foundation

/// 音效类型枚举
enum SoundEffect: String, CaseIterable {
    // MARK: - UI 交互音效
    case pixelDraw = "pixel_draw"           // 像素绘制
    case tabSwitch = "tab_switch"           // Tab 切换
    case sheetPresent = "sheet_present"     // Sheet 弹出
    case sheetDismiss = "sheet_dismiss"     // Sheet 关闭
    case buttonClick = "button_click"       // 按钮点击
    case likeSend = "like_send"             // 点赞

    // MARK: - 成就音效
    case success = "success"                // 成功（通用）
    case levelUp = "level_up"               // 升级
    case rankUp = "rank_up"                 // 排名上升
    case rankDown = "rank_down"             // 排名下降

    // MARK: - 社交音效
    case allianceJoin = "alliance_join"     // 加入联盟
    case territoryCaptured = "territory_captured"  // 占领领土
    case territoryLost = "territory_lost"   // 领土失守

    // MARK: - 特殊场景音效
    case bottleEncounter = "bottle_encounter"  // 遭遇漂流瓶
    case bottleOpen = "bottle_open"         // 打开漂流瓶
    case eventStart = "event_start"         // 赛事开始
    case eventCountdown = "event_countdown" // 赛事倒计时

    // MARK: - 错误音效
    case errorGentle = "error_gentle"       // 温和错误

    /// 音效文件扩展名
    var fileExtension: String {
        // 所有音效使用 m4a 格式（AAC编码，体积更小）
        return "m4a"
    }

    /// 音效分类
    var category: SoundCategory {
        switch self {
        case .pixelDraw, .tabSwitch, .sheetPresent, .sheetDismiss, .buttonClick, .likeSend:
            return .ui
        case .success, .levelUp, .rankUp, .rankDown:
            return .achievement
        case .allianceJoin, .territoryCaptured, .territoryLost:
            return .social
        case .bottleEncounter, .bottleOpen, .eventStart, .eventCountdown:
            return .special
        case .errorGentle:
            return .alert
        }
    }

    /// 音效描述（用于调试和日志）
    var description: String {
        switch self {
        case .pixelDraw: return "像素绘制"
        case .tabSwitch: return "Tab切换"
        case .sheetPresent: return "Sheet弹出"
        case .sheetDismiss: return "Sheet关闭"
        case .buttonClick: return "按钮点击"
        case .likeSend: return "点赞"
        case .success: return "成功"
        case .levelUp: return "升级"
        case .rankUp: return "排名上升"
        case .rankDown: return "排名下降"
        case .allianceJoin: return "加入联盟"
        case .territoryCaptured: return "占领领土"
        case .territoryLost: return "领土失守"
        case .bottleEncounter: return "遭遇漂流瓶"
        case .bottleOpen: return "打开漂流瓶"
        case .eventStart: return "赛事开始"
        case .eventCountdown: return "赛事倒计时"
        case .errorGentle: return "温和错误"
        }
    }
}

/// 音效分类
enum SoundCategory: String, CaseIterable {
    case ui          // UI 交互
    case achievement // 成就
    case social      // 社交
    case special     // 特殊场景
    case alert       // 警示

    var displayName: String {
        switch self {
        case .ui: return "界面音效"
        case .achievement: return "成就音效"
        case .social: return "社交音效"
        case .special: return "特殊场景"
        case .alert: return "提示音效"
        }
    }
}
