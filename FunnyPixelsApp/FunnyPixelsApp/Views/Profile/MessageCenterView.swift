import SwiftUI
import Combine
import CoreLocation

/// 消息分类枚举
enum MessageCategory: String, CaseIterable {
    case all = "all"
    case interaction = "interaction"
    case system = "system"

    var displayName: String {
        switch self {
        case .all: return NSLocalizedString("message.category.all", comment: "全部")
        case .interaction: return NSLocalizedString("message.category.interaction", comment: "互动")
        case .system: return NSLocalizedString("message.category.system", comment: "系统")
        }
    }

    /// 对应的后端type参数（nil表示不筛选）
    var apiTypes: [String]? {
        switch self {
        case .all: return nil
        case .interaction: return ["like", "comment", "follow"]
        case .system: return ["achievement", "reward", "territory_battle", "system"]
        }
    }
}

/// 消息中心视图
struct MessageCenterView: View {
    @StateObject private var viewModel = MessageCenterViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // 分类选择器
            CategoryPicker(selectedCategory: $viewModel.selectedCategory)
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(uiColor: .systemGroupedBackground))

            // 消息列表
            List {
                if viewModel.isLoading && viewModel.messages.isEmpty {
                HStack {
                    Spacer()
                    ProgressView("加载中...")
                    Spacer()
                }
                .listRowBackground(Color.clear)
            } else if viewModel.messages.isEmpty {
                VStack(spacing: 20) {
                    Image(systemName: "envelope.open")
                        .font(.system(size: 50))
                        .foregroundColor(.secondary)
                    Text(NSLocalizedString("message.no_messages", comment: ""))
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 200)
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.messages) { message in
                    MessageRow(
                        message: message,
                        isEditMode: viewModel.isEditMode,
                        isSelected: viewModel.selectedMessageIds.contains(message.id)
                    )
                    .onTapGesture {
                        if viewModel.isEditMode {
                            viewModel.toggleSelection(message.id)
                        } else {
                            viewModel.selectMessage(message)
                        }
                    }
                }
            }
            }
            .listStyle(.plain)
        }
        .navigationTitle("消息中心")
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(viewModel.isEditMode ? "完成" : "编辑") {
                    viewModel.toggleEditMode()
                }
                .font(.subheadline)
                .disabled(viewModel.messages.isEmpty)
            }
        }
        .safeAreaInset(edge: .bottom) {
            if viewModel.isEditMode {
                BatchActionsToolbar(viewModel: viewModel)
            }
        }
        .task {
            await viewModel.fetchMessages()
            // ✅ 进入消息中心时刷新未读数，确保与列表同步
            await viewModel.refreshUnreadCount()
        }
        .refreshable {
            await viewModel.fetchMessages()
            await viewModel.refreshUnreadCount()
        }
        .onDisappear {
            // ✅ 离开消息中心时刷新未读数
            Task {
                await viewModel.refreshUnreadCount()
            }
        }
        .sheet(item: $viewModel.selectedMessage) { message in
            MessageDetailView(message: message, viewModel: viewModel)
        }
    }
}

/// 批量操作工具栏
struct BatchActionsToolbar: View {
    @ObservedObject var viewModel: MessageCenterViewModel

    var body: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 20) {
                // 全选/取消全选
                Button(action: {
                    viewModel.toggleSelectAll()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: viewModel.isAllSelected ? "checkmark.square.fill" : "square")
                        Text(viewModel.isAllSelected ? "取消全选" : "全选")
                    }
                    .font(.system(size: 15))
                }

                Spacer()

                // 标记已读
                Button(action: {
                    Task {
                        await viewModel.batchMarkAsRead()
                    }
                }) {
                    Label("标记已读", systemImage: "envelope.open")
                        .font(.system(size: 15))
                }
                .disabled(viewModel.selectedMessageIds.isEmpty)

                Spacer()

                // 删除
                Button(role: .destructive, action: {
                    viewModel.showDeleteConfirmation = true
                }) {
                    Label("删除", systemImage: "trash")
                        .font(.system(size: 15))
                }
                .disabled(viewModel.selectedMessageIds.isEmpty)
            }
            .padding()
            .background(Color(uiColor: .systemBackground))
        }
        .confirmationDialog(
            "确认删除",
            isPresented: $viewModel.showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除 \(viewModel.selectedMessageIds.count) 条消息", role: .destructive) {
                Task {
                    await viewModel.batchDelete()
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("删除后无法恢复")
        }
    }
}

/// 分类选择器
struct CategoryPicker: View {
    @Binding var selectedCategory: MessageCategory

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MessageCategory.allCases, id: \.self) { category in
                Button(action: {
                    selectedCategory = category
                }) {
                    VStack(spacing: 4) {
                        Text(category.displayName)
                            .font(.system(size: 15, weight: selectedCategory == category ? .semibold : .regular))
                            .foregroundColor(selectedCategory == category ? .blue : .secondary)

                        // 下划线指示器
                        Rectangle()
                            .fill(selectedCategory == category ? Color.blue : Color.clear)
                            .frame(height: 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 44)
    }
}

/// 消息行视图
struct MessageRow: View {
    let message: NotificationService.SystemMessage
    var isEditMode: Bool = false
    var isSelected: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // 编辑模式：显示选择框
            if isEditMode {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .gray)
                    .font(.system(size: 22))
            }

            // 类型图标
            ZStack {
                Circle()
                    .fill(typeColor.opacity(0.1))
                    .frame(width: 40, height: 40)
                
                Image(systemName: typeIcon)
                    .foregroundColor(typeColor)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(message.title)
                        .font(.headline)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    if !message.is_read {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                    }
                }
                
                Text(message.content)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                Text(formatDate(message.created_at))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }
    
    var typeIcon: String {
        switch message.type {
        case "reward": return "gift.fill"
        case "activity": return "flag.checkered"
        case "territory_battle": return "shield.slash.fill"
        default: return "bell.fill"
        }
    }

    var typeColor: Color {
        switch message.type {
        case "reward": return .orange
        case "activity": return .blue
        case "territory_battle": return .red
        default: return .gray
        }
    }
    
    func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "MM-dd HH:mm"
            return displayFormatter.string(from: date)
        }
        return dateString
    }
}

/// 消息详情视图
struct MessageDetailView: View {
    let message: NotificationService.SystemMessage
    @ObservedObject var viewModel: MessageCenterViewModel
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(message.title)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(message.content)
                        .font(.body)
                        .lineSpacing(6)

                    // ✅ 成就解锁：显示成就图标和信息
                    if message.type == "achievement", let attachments = message.attachments {
                        AchievementAttachmentView(attachments: attachments)
                    }
                    else if message.type == "territory_battle", let attachments = message.attachments {
                        // 领土动态：显示前往查看按钮
                        let sampleLat = attachments["sample_lat"]?.doubleValue
                        let sampleLng = attachments["sample_lng"]?.doubleValue

                        if let lat = sampleLat, let lng = sampleLng {
                            Button(action: {
                                dismiss()
                                NotificationCenter.default.post(name: .switchToMapTab, object: nil)
                                Task { @MainActor in
                                    let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                                    await MapController.shared.flyToCoordinate(coordinate, name: "前往查看")
                                }
                            }) {
                                HStack {
                                    Image(systemName: "map.fill")
                                    Text(NSLocalizedString("message.go_to_view", comment: ""))
                                        .fontWeight(.bold)
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color.red)
                                .cornerRadius(12)
                            }
                            .padding(.top, 10)
                        }
                    } else if let attachments = message.attachments, !attachments.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(NSLocalizedString("message.attachment_reward", comment: ""))
                                .font(.headline)

                            ForEach(Array(attachments.keys), id: \.self) { key in
                                RewardRow(key: key, value: attachments[key] ?? .string(""))
                            }

                            Button(action: {
                                // Claim reward logic
                                dismiss()
                            }) {
                                Text(NSLocalizedString("message.claim_reward", comment: ""))
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 50)
                                    .background(Color.blue)
                                    .cornerRadius(12)
                            }
                            .padding(.top, 10)
                        }
                        .padding()
                        .background(Color.blue.opacity(0.05))
                        .cornerRadius(12)
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("关闭") { dismiss() }
                }
            }
            .onAppear {
                if !message.is_read {
                    Task { await viewModel.markAsRead(message) }
                }
            }
        }
    }
}

struct RewardRow: View {
    let key: String
    let value: JSONValue
    
    var body: some View {
        HStack {
            Image(systemName: key == "coins" ? "star.circle.fill" : "bag.fill")
                .foregroundColor(key == "coins" ? .orange : .blue)
            
            Text(translateKey(key))
                .font(.subheadline)
            
            Spacer()
            
            Text("x\(formatValue(value))")
                .font(.headline)
                .foregroundColor(.blue)
        }
        .padding(.vertical, 4)
    }
    
    func translateKey(_ key: String) -> String {
        switch key {
        case "coins": return "积分"
        case "items": return "道具"
        default: return key
        }
    }
    
    func formatValue(_ value: JSONValue) -> String {
        switch value {
        case .int(let v): return "\(v)"
        case .string(let v): return v
        default: return "1"
        }
    }
}

/// 成就附件视图 - 显示成就图标和奖励信息
struct AchievementAttachmentView: View {
    let attachments: [String: JSONValue]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 16) {
                // 成就图标
                if let iconUrl = attachments["icon_url"]?.stringValue,
                   !iconUrl.isEmpty {
                    AsyncImage(url: URL(string: iconUrl.hasPrefix("http") ? iconUrl : "\(APIEndpoint.baseURL)\(iconUrl)")) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                                .frame(width: 64, height: 64)
                        case .failure(_), .empty:
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 40))
                                .foregroundColor(.orange)
                                .frame(width: 64, height: 64)
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.orange)
                        .frame(width: 64, height: 64)
                }

                VStack(alignment: .leading, spacing: 4) {
                    // 成就名称
                    if let achievementName = attachments["achievement_name"]?.stringValue {
                        Text(achievementName)
                            .font(.headline)
                            .foregroundColor(.primary)
                    }

                    // 奖励积分
                    if let points = attachments["points"]?.intValue, points > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .foregroundColor(.orange)
                                .font(.caption)
                            Text("+\(points) " + NSLocalizedString("profile.points", comment: "积分"))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()
            }
            .padding()
            .background(Color.orange.opacity(0.05))
            .cornerRadius(12)
        }
    }
}

// ✅ JSONValue 扩展 - 便捷访问字符串和整数值
extension JSONValue {
    var stringValue: String? {
        switch self {
        case .string(let v): return v
        case .int(let v): return "\(v)"
        case .double(let v): return "\(v)"
        default: return nil
        }
    }

    var intValue: Int? {
        switch self {
        case .int(let v): return v
        case .double(let v): return Int(v)
        case .string(let v): return Int(v)
        default: return nil
        }
    }
}

/// 消息中心视图模型
@MainActor
class MessageCenterViewModel: ObservableObject {
    @Published var messages: [NotificationService.SystemMessage] = []
    @Published var isLoading = false
    @Published var selectedMessage: NotificationService.SystemMessage?
    @Published var selectedCategory: MessageCategory = .all {
        didSet {
            // 切换分类时重新加载
            if oldValue != selectedCategory {
                Task {
                    await fetchMessages()
                }
            }
        }
    }

    // 批量操作状态
    @Published var isEditMode = false
    @Published var selectedMessageIds: Set<String> = []
    @Published var showDeleteConfirmation = false

    /// 是否全选
    var isAllSelected: Bool {
        !messages.isEmpty && selectedMessageIds.count == messages.count
    }

    private var cancellables = Set<AnyCancellable>()

    init() {
        // ✨ 订阅实时通知
        Task {
            let publisher = await SocketIOManager.shared.newNotificationPublisher
            publisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] newNotification in
                    guard let self = self else { return }
                    Logger.info("🔔 收到实时通知，刷新列表")

                    // 检查新通知是否符合当前分类
                    let shouldAdd: Bool
                    if let apiTypes = self.selectedCategory.apiTypes {
                        shouldAdd = apiTypes.contains(newNotification.type)
                    } else {
                        shouldAdd = true // "全部"分类
                    }

                    // 将新通知插入到列表顶部（如果符合当前分类）
                    if shouldAdd {
                        self.messages.insert(newNotification, at: 0)
                    }

                    // 刷新未读数
                    Task {
                        await self.refreshUnreadCount()
                    }
                }
                .store(in: &cancellables)
        }
    }

    func fetchMessages() async {
        isLoading = true
        defer { isLoading = false }
        do {
            // 获取所有消息
            let allMessages = try await NotificationService.shared.getMessages()

            // 根据选中的分类筛选
            if let apiTypes = selectedCategory.apiTypes {
                messages = allMessages.filter { message in
                    apiTypes.contains(message.type)
                }
            } else {
                messages = allMessages
            }
        } catch {
            Logger.error("Failed to fetch messages: \(error)")
        }
    }
    
    func selectMessage(_ message: NotificationService.SystemMessage) {
        selectedMessage = message
    }
    
    func markAsRead(_ message: NotificationService.SystemMessage) async {
        do {
            try await NotificationService.shared.markAsRead(id: message.id)
            if let index = messages.firstIndex(where: { $0.id == message.id }) {
                messages[index].is_read = true
            }
            // ✅ 标记已读后刷新未读数
            await refreshUnreadCount()
        } catch {
            Logger.error("Failed to mark message as read: \(error)")
        }
    }

    func markAllAsRead() async {
        // Implement bulk mark read on backend if needed, or loop here
        for message in messages where !message.is_read {
            await markAsRead(message)
        }
        // ✅ 全部标记已读后刷新未读数
        await refreshUnreadCount()
    }

    /// 刷新全局未读数（通知 Badge 更新）
    func refreshUnreadCount() async {
        do {
            let count = try await NotificationService.shared.getUnreadCount()
            await MainActor.run {
                // 通知 BadgeViewModel 更新
                NotificationCenter.default.post(
                    name: .init("RefreshUnreadCount"),
                    object: count
                )
            }
        } catch {
            Logger.error("Failed to refresh unread count: \(error)")
        }
    }

    // MARK: - 批量操作方法

    /// 切换编辑模式
    func toggleEditMode() {
        isEditMode.toggle()
        if !isEditMode {
            // 退出编辑模式时清空选择
            selectedMessageIds.removeAll()
        }
    }

    /// 切换单个消息的选中状态
    func toggleSelection(_ messageId: String) {
        if selectedMessageIds.contains(messageId) {
            selectedMessageIds.remove(messageId)
        } else {
            selectedMessageIds.insert(messageId)
        }
    }

    /// 全选/取消全选
    func toggleSelectAll() {
        if isAllSelected {
            selectedMessageIds.removeAll()
        } else {
            selectedMessageIds = Set(messages.map { $0.id })
        }
    }

    /// 批量标记为已读
    func batchMarkAsRead() async {
        guard !selectedMessageIds.isEmpty else { return }

        do {
            try await NotificationService.shared.batchMarkAsRead(ids: Array(selectedMessageIds))

            // 更新本地状态
            for id in selectedMessageIds {
                if let index = messages.firstIndex(where: { $0.id == id }) {
                    messages[index].is_read = true
                }
            }

            // 清空选择
            selectedMessageIds.removeAll()

            // 刷新未读数
            await refreshUnreadCount()

            Logger.info("✅ 批量标记已读成功")
        } catch {
            Logger.error("Failed to batch mark as read: \(error)")
        }
    }

    /// 批量删除
    func batchDelete() async {
        guard !selectedMessageIds.isEmpty else { return }

        do {
            try await NotificationService.shared.batchDelete(ids: Array(selectedMessageIds))

            // 从本地列表中移除
            messages.removeAll { selectedMessageIds.contains($0.id) }

            // 清空选择
            selectedMessageIds.removeAll()

            // 退出编辑模式
            isEditMode = false

            // 刷新未读数
            await refreshUnreadCount()

            Logger.info("✅ 批量删除成功")
        } catch {
            Logger.error("Failed to batch delete: \(error)")
        }
    }
}
