import SwiftUI
import Combine
import CoreLocation

/// 消息中心视图
struct MessageCenterView: View {
    @StateObject private var viewModel = MessageCenterViewModel()
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
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
                    MessageRow(message: message)
                        .onTapGesture {
                            viewModel.selectMessage(message)
                        }
                }
            }
        }
        .navigationTitle("消息中心")
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("全部忽略") {
                    Task { await viewModel.markAllAsRead() }
                }
                .font(.subheadline)
                .disabled(viewModel.messages.isEmpty)
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

/// 消息行视图
struct MessageRow: View {
    let message: NotificationService.SystemMessage
    
    var body: some View {
        HStack(spacing: 12) {
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
                    
                    if message.type == "territory_battle", let attachments = message.attachments {
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

/// 消息中心视图模型
@MainActor
class MessageCenterViewModel: ObservableObject {
    @Published var messages: [NotificationService.SystemMessage] = []
    @Published var isLoading = false
    @Published var selectedMessage: NotificationService.SystemMessage?
    
    func fetchMessages() async {
        isLoading = true
        defer { isLoading = false }
        do {
            messages = try await NotificationService.shared.getMessages()
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
}
