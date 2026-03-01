import SwiftUI
import Combine
import CoreLocation

/// 领土动态 - 半屏 Feed 列表
struct BattleFeedView: View {
    @StateObject private var viewModel = BattleFeedViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.battles.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        ProgressView("加载中...")
                        Spacer()
                    }
                } else if viewModel.battles.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 50))
                            .foregroundColor(.secondary)
                        Text(NSLocalizedString("battle.no_attacks_yet", comment: ""))
                            .font(.headline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(viewModel.battles) { battle in
                            BattleCardView(battle: battle) {
                                handleReclaim(battle)
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .listRowSeparator(.hidden)
                            .onAppear {
                                if battle.id == viewModel.battles.last?.id {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("领土动态")
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("关闭") { dismiss() }
                        .font(.subheadline)
                }
            }
            .task {
                await viewModel.fetchBattles()
            }
            .refreshable {
                await viewModel.fetchBattles()
            }
        }
    }

    private func handleReclaim(_ battle: BattleFeedItem) {
        dismiss()
        // 切换到地图 tab
        NotificationCenter.default.post(name: .switchToMapTab, object: nil)
        // 飞往目标位置
        Task { @MainActor in
            await MapController.shared.flyToCoordinate(battle.coordinate, name: "夺回地盘")
        }
    }
}

// MARK: - Battle Card View

struct BattleCardView: View {
    let battle: BattleFeedItem
    let onReclaim: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // 攻击者信息 + 时间
            HStack(spacing: 10) {
                // 头像
                Circle()
                    .fill(Color(hex: battle.new_color ?? "#999999") ?? .gray)
                    .frame(width: 36, height: 36)
                    .overlay(
                        Text(String((battle.attacker_name ?? "?").prefix(1)))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(battle.attacker_name ?? "未知用户")
                        .font(.system(size: 14, weight: .semibold))

                    Text(battle.timeAgo)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }

                Spacer()

                // 颜色变化指示
                HStack(spacing: 4) {
                    colorSwatch(battle.old_color)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    colorSwatch(battle.new_color)
                }
            }

            // 位置信息
            if let region = battle.region_name, !region.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "mappin")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    Text(region)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            // 操作按钮
            HStack(spacing: 12) {
                Spacer()

                Button(action: onReclaim) {
                    HStack(spacing: 4) {
                        Image(systemName: "flag.fill")
                            .font(.system(size: 11))
                        Text(NSLocalizedString("battle.reclaim", comment: ""))
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.red))
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
        )
    }

    @ViewBuilder
    private func colorSwatch(_ colorHex: String?) -> some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color(hex: colorHex ?? "#CCCCCC") ?? .gray)
            .frame(width: 18, height: 18)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(Color.secondary.opacity(0.3), lineWidth: 0.5)
            )
    }
}

// MARK: - View Model

@MainActor
class BattleFeedViewModel: ObservableObject {
    @Published var battles: [BattleFeedItem] = []
    @Published var isLoading = false

    private var currentPage = 1
    private var hasMore = true

    func fetchBattles() async {
        isLoading = true
        currentPage = 1
        defer { isLoading = false }
        do {
            let data = try await BattleService.shared.getBattleFeed(page: 1, limit: 20)
            battles = data.battles
            hasMore = data.pagination.page < data.pagination.total_pages
        } catch {
            Logger.error("Failed to fetch battle feed: \(error)")
        }
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let nextPage = currentPage + 1
            let data = try await BattleService.shared.getBattleFeed(page: nextPage, limit: 20)
            battles.append(contentsOf: data.battles)
            currentPage = nextPage
            hasMore = data.pagination.page < data.pagination.total_pages
        } catch {
            Logger.error("Failed to load more battles: \(error)")
        }
    }
}

// MARK: - Notification Name

extension Notification.Name {
    static let switchToMapTab = Notification.Name("switchToMapTab")
}
