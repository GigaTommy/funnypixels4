import SwiftUI

// MARK: - Filter

enum CardFilter: String, CaseIterable {
    case all, created, opened, sunk

    var title: String {
        switch self {
        case .all:     return NSLocalizedString("drift_bottle.filter.all", comment: "")
        case .created: return NSLocalizedString("drift_bottle.filter.created", comment: "")
        case .opened:  return NSLocalizedString("drift_bottle.filter.opened", comment: "")
        case .sunk:    return NSLocalizedString("drift_bottle.filter.sunk", comment: "")
        }
    }
}

/// 个人主页中的旅途卡片集合列表
struct JourneyCardListView: View {
    @State private var cards: [JourneyCard] = []
    @State private var isLoading = true
    @State private var currentPage = 1
    @State private var hasMore = true
    @State private var selectedBottleId: String?
    @State private var filterMode: CardFilter = .all

    private let api = DriftBottleAPIService.shared

    private var filteredCards: [JourneyCard] {
        switch filterMode {
        case .all:     return cards
        case .created: return cards.filter { $0.participantRole == "creator" }
        case .opened:  return cards.filter { $0.participantRole != "creator" }
        case .sunk:    return cards.filter { $0.isSunk == true }
        }
    }

    var body: some View {
        ZStack {
            AppColors.background
                .ignoresSafeArea()

            if isLoading && cards.isEmpty {
                ProgressView()
                    .scaleEffect(1.2)
            } else if cards.isEmpty {
                emptyView
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        Picker("", selection: $filterMode) {
                            ForEach(CardFilter.allCases, id: \.self) { filter in
                                Text(filter.title).tag(filter)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)

                        if filteredCards.isEmpty {
                            filteredEmptyView
                                .padding(.top, 60)
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(filteredCards) { card in
                                    JourneyCardRowView(card: card)
                                        .onTapGesture {
                                            if !card.isRead {
                                                Task {
                                                    try? await api.markCardRead(cardId: card.id)
                                                }
                                            }
                                            selectedBottleId = card.bottleId
                                        }
                                        .onAppear {
                                            if card.id == cards.last?.id && hasMore {
                                                Task { await loadMore() }
                                            }
                                        }
                                }

                                if isLoading {
                                    ProgressView()
                                        .padding()
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 40)
                        }
                    }
                    .padding(.top, 8)
                }
            }
        }
        .navigationTitle(NSLocalizedString("drift_bottle.journey_list.title", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await loadCards()
        }
        .refreshable {
            currentPage = 1
            await loadCards()
        }
        .sheet(item: $selectedBottleId) { bottleId in
            JourneyCardDetailView(bottleId: bottleId)
        }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "map.fill")
                .font(.system(size: 40))
                .foregroundColor(AppColors.textTertiary)

            Text(NSLocalizedString("drift_bottle.journey_list.empty.title", comment: ""))
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(AppColors.textSecondary)

            Text(NSLocalizedString("drift_bottle.journey_list.empty.message", comment: ""))
                .font(.system(size: 13))
                .foregroundColor(AppColors.textTertiary)
                .multilineTextAlignment(.center)
        }
    }

    private var filteredEmptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 36))
                .foregroundColor(AppColors.textTertiary)

            Text(NSLocalizedString("drift_bottle.filter.empty", comment: ""))
                .font(.system(size: 14))
                .foregroundColor(AppColors.textSecondary)
        }
    }

    private func loadCards() async {
        isLoading = true
        do {
            let result = try await api.getJourneyCards(page: 1, limit: 20)
            cards = result.cards
            hasMore = (result.pagination?.totalPages ?? 1) > 1
            currentPage = 1
        } catch {
            Logger.error("Load journey cards failed: \(error.localizedDescription)")
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        currentPage += 1
        do {
            let result = try await api.getJourneyCards(page: currentPage, limit: 20)
            cards.append(contentsOf: result.cards)
            hasMore = currentPage < (result.pagination?.totalPages ?? 1)
        } catch {
            currentPage -= 1
            Logger.error("Load more journey cards failed: \(error.localizedDescription)")
        }
        isLoading = false
    }
}

// 使 String 能作为 sheet item
extension String: @retroactive Identifiable {
    public var id: String { self }
}

/// 旅途卡片行视图
struct JourneyCardRowView: View {
    let card: JourneyCard

    var body: some View {
        HStack(spacing: 12) {
            Image("drift_bottle_icon")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(card.originCity ?? "?") → ...")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    if !card.isRead {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                    }
                }

                HStack(spacing: 6) {
                    Text(card.participantRole == "creator" ? NSLocalizedString("drift_bottle.role.creator", comment: "") : String(format: NSLocalizedString("drift_bottle.station_number", comment: ""), card.stationNumber))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(card.participantRole == "creator" ? .blue : .green)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule().fill(
                                (card.participantRole == "creator" ? Color.blue : Color.green).opacity(0.1)
                            )
                        )

                    if card.isSunk == true {
                        Label(NSLocalizedString("drift_bottle.journey.sunk", comment: ""), systemImage: "water.waves")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule().fill(Color.blue.opacity(0.1))
                            )
                    }

                    Text("\(String(format: "%.1f", card.distanceKm))km")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.textTertiary)

                    if let days = card.totalDays {
                        Text(String(format: NSLocalizedString("drift_bottle.days_count", comment: ""), days))
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }

            Spacer()

            if let totalStations = card.totalStations {
                VStack(spacing: 2) {
                    Text(String(format: NSLocalizedString("drift_bottle.journey.stations", comment: ""), totalStations))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.textSecondary)
                    if let country = card.originCountry, !country.isEmpty {
                        Text(country)
                            .font(.system(size: 11))
                            .foregroundColor(AppColors.textTertiary)
                            .lineLimit(1)
                    }
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(AppColors.textTertiary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 2)
        )
    }
}
