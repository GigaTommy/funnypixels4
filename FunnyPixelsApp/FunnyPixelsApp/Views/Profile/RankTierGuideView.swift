import SwiftUI
import Combine

/// 段位系统指南
/// 展示所有段位、晋升要求、专属福利
struct RankTierGuideView: View {
    @StateObject private var viewModel = RankTierGuideViewModel()
    @State private var selectedTier: RankTierDetail?
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: AppSpacing.l) {
                // Header - 当前段位卡片
                if let myTier = viewModel.myTier {
                    currentTierHeader(myTier)
                }

                // 段位说明
                guideSection

                // 段位列表
                if viewModel.isLoading {
                    loadingView
                } else {
                    tierList
                }
            }
            .padding(.horizontal, AppSpacing.l)
            .padding(.top, AppSpacing.l)
            .padding(.bottom, 40)
        }
        .background(AppColors.background)
        .navigationTitle(NSLocalizedString("rank.guide.title", comment: "Rank Guide"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .task {
            await viewModel.loadData()
        }
        .refreshable {
            await viewModel.loadData()
        }
        .sheet(item: $selectedTier) { tier in
            TierDetailSheet(tier: tier)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Current Tier Header

    private func currentTierHeader(_ myTier: RankTierWithBenefits) -> some View {
        StandardCard(padding: AppSpacing.l) {
            VStack(spacing: AppSpacing.m) {
                HStack {
                    Image(systemName: myTier.icon)
                        .responsiveFont(.largeTitle)
                        .foregroundColor(myTier.swiftUIColor)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(NSLocalizedString("rank.guide.current_rank", comment: "Current Rank"))
                            .responsiveFont(.caption2)
                            .foregroundColor(AppColors.textTertiary)

                        Text(myTier.name)
                            .responsiveFont(.title2, weight: .bold)
                            .foregroundColor(AppColors.textPrimary)
                    }

                    Spacer()
                }

                // Progress
                if !myTier.isMaxTier {
                    VStack(spacing: 6) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color(.systemGray5))
                                    .frame(height: 10)

                                RoundedRectangle(cornerRadius: 6)
                                    .fill(
                                        LinearGradient(
                                            colors: [myTier.swiftUIColor.opacity(0.7), myTier.swiftUIColor],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: geo.size.width * myTier.progress, height: 10)
                            }
                        }
                        .frame(height: 10)

                        HStack {
                            Text("\(myTier.currentPixels)")
                                .responsiveFont(.caption2)
                                .foregroundColor(AppColors.textSecondary)
                            Spacer()
                            Text(String(format: NSLocalizedString("rank.pixels_remaining", comment: "%d pixels to next rank"), myTier.gapToNext))
                                .responsiveFont(.caption2)
                                .foregroundColor(myTier.swiftUIColor)
                        }
                    }
                } else {
                    Text(NSLocalizedString("rank.max_tier_achieved", comment: "Maximum rank achieved!"))
                        .responsiveFont(.caption, weight: .semibold)
                        .foregroundColor(myTier.swiftUIColor)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(myTier.swiftUIColor.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }

    // MARK: - Guide Section

    private var guideSection: some View {
        StandardCard(padding: AppSpacing.l) {
            VStack(alignment: .leading, spacing: AppSpacing.s) {
                HStack {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(AppColors.primary)
                    Text(NSLocalizedString("rank.guide.how_it_works", comment: "How It Works"))
                        .responsiveFont(.subheadline, weight: .semibold)
                        .foregroundColor(AppColors.textPrimary)
                }

                Text(NSLocalizedString("rank.guide.description", comment: "Rank system description"))
                    .responsiveFont(.caption)
                    .foregroundColor(AppColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Tier List

    private var tierList: some View {
        VStack(spacing: AppSpacing.m) {
            ForEach(viewModel.tiers) { tier in
                tierCard(tier)
                    .onTapGesture {
                        selectedTier = tier
                    }
            }
        }
    }

    private func tierCard(_ tier: RankTierDetail) -> some View {
        StandardCard(padding: AppSpacing.l) {
            VStack(alignment: .leading, spacing: AppSpacing.m) {
                // Header
                HStack {
                    Image(systemName: tier.icon)
                        .responsiveFont(.title3)
                        .foregroundColor(tier.swiftUIColor)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(tier.name)
                            .responsiveFont(.callout)
                            .foregroundColor(AppColors.textPrimary)

                        Text(String(format: NSLocalizedString("rank.min_pixels", comment: "%d pixels"), tier.minPixels))
                            .responsiveFont(.caption2)
                            .foregroundColor(AppColors.textTertiary)
                    }

                    Spacer()

                    // Badges
                    if !tier.benefits.badges.isEmpty {
                        HStack(spacing: 2) {
                            ForEach(tier.benefits.badges.prefix(3), id: \.self) { badge in
                                Text(badge)
                                    .responsiveFont(.headline)
                            }
                        }
                    }

                    Image(systemName: "chevron.right")
                        .responsiveFont(.caption2)
                        .foregroundColor(AppColors.textTertiary)
                }

                // Features preview
                if !tier.benefits.features.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(tier.benefits.features.prefix(3)) { feature in
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .responsiveFont(.caption2)
                                    .foregroundColor(tier.swiftUIColor)

                                Text(feature.localizedName)
                                    .responsiveFont(.caption2)
                                    .foregroundColor(AppColors.textSecondary)
                            }
                        }

                        if tier.benefits.features.count > 3 {
                            Text(String(format: NSLocalizedString("rank.more_benefits", comment: "+%d more"), tier.benefits.features.count - 3))
                                .responsiveFont(.caption2)
                                .foregroundColor(tier.swiftUIColor)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(NSLocalizedString("common.loading", comment: "Loading"))
                .responsiveFont(.caption)
                .foregroundColor(AppColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - ViewModel

@MainActor
class RankTierGuideViewModel: ObservableObject {
    @Published var tiers: [RankTierDetail] = []
    @Published var myTier: RankTierWithBenefits?
    @Published var isLoading = false

    private let service = RankTierService.shared

    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        async let tiersTask = try? service.getAllTiers()
        async let myTierTask = try? service.getMyTier()

        let (fetchedTiers, fetchedMyTier) = await (tiersTask, myTierTask)

        if let fetchedTiers = fetchedTiers {
            tiers = fetchedTiers
        }

        if let fetchedMyTier = fetchedMyTier {
            myTier = fetchedMyTier
        }
    }
}

// MARK: - Tier Detail Sheet

struct TierDetailSheet: View {
    let tier: RankTierDetail
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.l) {
                    // Header
                    HStack {
                        Image(systemName: tier.icon)
                            .responsiveFont(.largeTitle)
                            .foregroundColor(tier.swiftUIColor)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(tier.name)
                                .responsiveFont(.title2, weight: .bold)
                                .foregroundColor(AppColors.textPrimary)

                            Text(String(format: NSLocalizedString("rank.min_pixels", comment: ""), tier.minPixels))
                                .responsiveFont(.subheadline)
                                .foregroundColor(AppColors.textTertiary)
                        }

                        Spacer()
                    }
                    .padding()
                    .background(tier.swiftUIColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Badges
                    if !tier.benefits.badges.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(NSLocalizedString("rank.exclusive_badges", comment: "Exclusive Badges"))
                                .responsiveFont(.subheadline, weight: .semibold)
                                .foregroundColor(AppColors.textPrimary)

                            HStack(spacing: 8) {
                                ForEach(tier.benefits.badges, id: \.self) { badge in
                                    Text(badge)
                                        .responsiveFont(.title2)
                                        .padding(8)
                                        .background(AppColors.surface)
                                        .clipShape(Circle())
                                }
                            }
                        }
                    }

                    // Features
                    VStack(alignment: .leading, spacing: 8) {
                        Text(NSLocalizedString("rank.unlocked_features", comment: "Unlocked Features"))
                            .responsiveFont(.subheadline, weight: .semibold)
                            .foregroundColor(AppColors.textPrimary)

                        ForEach(tier.benefits.features) { feature in
                            HStack(spacing: 10) {
                                Image(systemName: "checkmark.circle.fill")
                                    .responsiveFont(.headline)
                                    .foregroundColor(tier.swiftUIColor)

                                Text(feature.localizedName)
                                    .responsiveFont(.subheadline)
                                    .foregroundColor(AppColors.textPrimary)
                            }
                            .padding(.vertical, 4)
                        }
                    }

                    // Limits
                    VStack(alignment: .leading, spacing: 8) {
                        Text(NSLocalizedString("rank.limits", comment: "Limits"))
                            .responsiveFont(.subheadline, weight: .semibold)
                            .foregroundColor(AppColors.textPrimary)

                        limitRow(
                            icon: "paintbrush.fill",
                            title: NSLocalizedString("rank.daily_pixel_quota", comment: "Daily Pixel Quota"),
                            value: tier.benefits.limits.dailyPixelQuota == 999999
                                ? NSLocalizedString("common.unlimited", comment: "Unlimited")
                                : "\(tier.benefits.limits.dailyPixelQuota)"
                        )

                        limitRow(
                            icon: "clock.fill",
                            title: NSLocalizedString("rank.max_session_time", comment: "Max Session Time"),
                            value: tier.benefits.limits.maxDrawingSessionTime == 9999
                                ? NSLocalizedString("common.unlimited", comment: "Unlimited")
                                : "\(tier.benefits.limits.maxDrawingSessionTime) min"
                        )
                    }
                }
                .padding(AppSpacing.l)
            }
            .navigationTitle(tier.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.close", comment: "Close")) {
                        dismiss()
                    }
                }
            }
        }
    }

    private func limitRow(icon: String, title: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .responsiveFont(.subheadline)
                .foregroundColor(tier.swiftUIColor)
                .frame(width: 20)

            Text(title)
                .responsiveFont(.subheadline)
                .foregroundColor(AppColors.textSecondary)

            Spacer()

            Text(value)
                .responsiveFont(.subheadline, weight: .semibold)
                .foregroundColor(AppColors.textPrimary)
        }
        .padding(.vertical, 4)
    }
}
