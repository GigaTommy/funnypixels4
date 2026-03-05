import SwiftUI

/// World State Event Card - 人性化设计，根据事件类型调整布局
struct WorldStateEventCard: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let event: WorldStateEvent
    let onAction: (EventActionButton) -> Void
    
    var body: some View {
        // 根据事件类型使用不同布局
        Group {
            switch event.eventType {
            case .milestoneReached:
                milestoneLayout
            case .territoryChanged:
                territoryLayout
            case .artworkCompleted:
                artworkLayout
            case .officialAnnouncement:
                announcementLayout
            case .eventProgress:
                eventLayout
            }
        }
        .background(Color.white)
    }
    
    // MARK: - 里程碑事件（居中、醒目）
    
    private var milestoneLayout: some View {
        VStack(spacing: 12) {
            HStack {
                // 左侧：用户信息
                if let userName = event.metadata.userName {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color.orange.opacity(0.1))
                            .frame(width: 32, height: 32)
                            .overlay(
                                Text(String(userName.prefix(1)))
                                    .responsiveFont(.subheadline, weight: .semibold)
                                    .foregroundColor(.orange)
                            )
                        
                        Text(userName)
                            .responsiveFont(.subheadline, weight: .medium)
                            .foregroundColor(Color(hex: "#1A1A1A"))
                    }
                }
                
                Spacer()
                
                Text(relativeTime)
                    .responsiveFont(.caption2)
                    .foregroundColor(Color(hex: "#999999"))
            }
            
            // 成就内容
            Text(event.description)
                .responsiveFont(.subheadline)
                .foregroundColor(Color(hex: "#666666"))
                .frame(maxWidth: .infinity, alignment: .leading)
            
            // 操作按钮
            if let button = event.actionButtons.first {
                Button(action: { onAction(button) }) {
                    Text(button.label)
                        .responsiveFont(.caption)
                        .foregroundColor(.orange)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.orange.opacity(0.1))
                        .cornerRadius(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
    }
    
    // MARK: - 领地变化（强调空间感）
    
    private var territoryLayout: some View {
        VStack(spacing: 0) {
            // 顶部色条（领地感）
            Rectangle()
                .fill(Color(hex: "#34C759") ?? .green)
                .frame(height: 3)
            
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        // 领地名称（大标题）
                        if let territoryName = event.metadata.territoryName {
                            Text(territoryName)
                                .responsiveFont(.body, weight: .semibold)
                                .foregroundColor(Color(hex: "#1A1A1A"))
                        }
                        
                        // 联盟信息
                        if let allianceName = event.metadata.allianceName {
                            HStack(spacing: 6) {
                                Text(NSLocalizedString("world_state.territory.captured_by_prefix", comment: ""))
                                    .foregroundColor(Color(hex: "#999999"))
                                Text(allianceName)
                                    .foregroundColor(Color(hex: "#34C759"))
                                    .fontWeight(.medium)
                                Text(NSLocalizedString("world_state.territory.captured_by_suffix", comment: ""))
                                    .foregroundColor(Color(hex: "#999999"))
                            }
                            .responsiveFont(.subheadline)
                        }
                    }
                    
                    Spacer()
                    
                    Text(relativeTime)
                        .responsiveFont(.caption2)
                        .foregroundColor(Color(hex: "#999999"))
                }
                
                // 操作按钮组
                if !event.actionButtons.isEmpty {
                    HStack(spacing: 12) {
                        ForEach(event.actionButtons.prefix(2), id: \.label) { button in
                            Button(action: { onAction(button) }) {
                                HStack(spacing: 4) {
                                    Image(systemName: buttonIcon(for: button.actionType))
                                        .responsiveFont(.caption2)
                                    Text(button.label)
                                        .responsiveFont(.caption)
                                }
                                .foregroundColor(Color(hex: "#007AFF"))
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }
    
    // MARK: - 作品完成（视觉优先）
    
    private var artworkLayout: some View {
        HStack(alignment: .top, spacing: 12) {
            // 左侧内容
            VStack(alignment: .leading, spacing: 8) {
                // 用户 + 动作
                if let userName = event.metadata.userName {
                    HStack(spacing: 4) {
                        Text(userName)
                            .responsiveFont(.subheadline, weight: .medium)
                            .foregroundColor(Color(hex: "#1A1A1A"))
                        Text(NSLocalizedString("world_state.artwork.completed", comment: ""))
                            .responsiveFont(.subheadline)
                            .foregroundColor(Color(hex: "#666666"))
                    }
                }
                
                // 像素数 + 位置
                HStack(spacing: 12) {
                    if let pixelCount = event.metadata.pixelCount {
                        HStack(spacing: 4) {
                            Text("\(pixelCount)")
                                .responsiveFont(.caption, weight: .medium)
                            Text(NSLocalizedString("world_state.artwork.pixels", comment: ""))
                                .responsiveFont(.caption)
                        }
                        .foregroundColor(Color(hex: "#666666"))
                    }
                    
                    if let location = event.metadata.location {
                        HStack(spacing: 2) {
                            Image(systemName: "location.fill")
                                .responsiveFont(.caption2)
                            Text(location.name)
                                .responsiveFont(.caption2)
                        }
                        .foregroundColor(Color(hex: "#999999"))
                    }
                }
                
                Text(relativeTime)
                    .responsiveFont(.caption2)
                    .foregroundColor(Color(hex: "#999999"))
                
                // 查看作品按钮
                if let button = event.actionButtons.first {
                    Button(action: { onAction(button) }) {
                        Text(button.label)
                            .responsiveFont(.caption)
                            .foregroundColor(Color(hex: "#007AFF"))
                    }
                }
            }
            
            Spacer(minLength: 8)
            
            // 右侧占位图（实际应该显示作品缩略图）
            Rectangle()
                .fill(Color(hex: "#F5F5F5") ?? .gray.opacity(0.1))
                .frame(width: 80, height: 80)
                .cornerRadius(4)
                .overlay(
                    Image(systemName: "photo")
                        .font(.system(size: 24))
                        .foregroundColor(Color(hex: "#CCCCCC"))
                )
        }
        .padding(16)
    }
    
    // MARK: - 官方公告（正式、简洁）
    
    private var announcementLayout: some View {
        VStack(spacing: 0) {
            // 顶部红色标识条
            Rectangle()
                .fill(Color(hex: "#FF3B30") ?? .red)
                .frame(height: 2)
            
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    // 官方标识
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.seal.fill")
                            .responsiveFont(.caption2)
                            .foregroundColor(Color(hex: "#FF3B30"))
                        Text(NSLocalizedString("world_state.announcement.official", comment: ""))
                            .responsiveFont(.caption2, weight: .medium)
                            .foregroundColor(Color(hex: "#FF3B30"))
                    }
                    
                    Spacer()
                    
                    Text(relativeTime)
                        .responsiveFont(.caption2)
                        .foregroundColor(Color(hex: "#999999"))
                }
                
                // 标题
                Text(event.title)
                    .responsiveFont(.headline, weight: .semibold)
                    .foregroundColor(Color(hex: "#1A1A1A"))
                    .lineLimit(2)
                
                // 内容
                Text(event.description)
                    .responsiveFont(.subheadline)
                    .foregroundColor(Color(hex: "#666666"))
                    .lineLimit(3)
                
                // 查看详情
                if let button = event.actionButtons.first {
                    Button(action: { onAction(button) }) {
                        HStack(spacing: 4) {
                            Text(button.label)
                            Image(systemName: "chevron.right")
                                .responsiveFont(.caption2)
                        }
                        .responsiveFont(.caption)
                        .foregroundColor(Color(hex: "#007AFF"))
                    }
                }
            }
            .padding(16)
        }
    }
    
    // MARK: - 活动进度（动态感）
    
    private var eventLayout: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    // 活动标题
                    Text(event.title)
                        .responsiveFont(.headline, weight: .semibold)
                        .foregroundColor(Color(hex: "#1A1A1A"))
                    
                    // 描述
                    Text(event.description)
                        .responsiveFont(.subheadline)
                        .foregroundColor(Color(hex: "#666666"))
                        .lineLimit(2)
                }
                
                Spacer()
                
                Text(relativeTime)
                    .responsiveFont(.caption2)
                    .foregroundColor(Color(hex: "#999999"))
            }
            
            // 参与按钮
            if let button = event.actionButtons.first {
                Button(action: { onAction(button) }) {
                    HStack {
                        Text(button.label)
                            .responsiveFont(.subheadline, weight: .medium)
                            .foregroundColor(.white)
                        Image(systemName: "arrow.right")
                            .responsiveFont(.caption2, weight: .semibold)
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color(hex: "#007AFF"))
                    .cornerRadius(6)
                }
            }
        }
        .padding(16)
    }
    
    // MARK: - Helper Methods

    private func buttonIcon(for actionType: EventActionType) -> String {
        switch actionType {
        case .navigateMap: return "map"
        case .viewAlliance: return "flag"
        case .viewProfile: return "person"
        case .viewSession: return "photo"
        case .viewEvent: return "calendar"
        case .viewAnnouncement: return "doc.text"
        }
    }

    // 性能优化：全局静态Formatter缓存
    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    private static let isoFormatter = ISO8601DateFormatter()

    private var relativeTime: String {
        if let date = Self.isoFormatter.date(from: event.createdAt) {
            return Self.relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        return ""
    }
}
