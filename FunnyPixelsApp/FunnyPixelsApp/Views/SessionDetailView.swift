import SwiftUI
import MapKit
import Photos

/// 会话详情界面
struct SessionDetailView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let sessionId: String
    
    @StateObject private var viewModel = SessionDetailViewModel()
    @State private var showShareSheet = false
    @State private var showReplay = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let session = viewModel.session {
                    // 地图显示轨迹
                    if !viewModel.pixels.isEmpty {
                        sessionMapView
                            .frame(height: 300)
                            .cornerRadius(12)
                    }
                    
                    // 统计信息卡片
                    statisticsCard(session: session)

                    // ✅ 优化：移除像素详情流水模块
                    // 地图显示和统计信息已经足够，无需冗余的像素详情列表
                    // if !viewModel.pixels.isEmpty {
                    //     pixelListSection
                    // }

                    // 操作按钮
                    actionButtons
                }
            }
            .padding()
            .padding(.bottom, 80) // 额外底部间距，避免被 TabBar 遮挡
        }
        .navigationTitle(NSLocalizedString("drawing_detail.title", comment: "Drawing Detail"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: { showShareSheet = true }) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
        .task {
            await viewModel.loadSessionDetail(id: sessionId)
        }
        .sheet(isPresented: $showShareSheet) {
            if let session = viewModel.session {
                SessionDetailShareView(
                    session: session,
                    pixels: viewModel.pixels
                )
            }
        }
        .fullScreenCover(isPresented: $showReplay) {
            SessionReplayView(pixels: viewModel.pixels)
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
    }
    
    // MARK: - Map View
    
    private var sessionMapView: some View {
        Map(position: .constant(viewModel.mapPosition)) {
            // 绘制轨迹线
            if viewModel.pixels.count > 1 {
                MapPolyline(coordinates: viewModel.pixelCoordinates)
                    .stroke(.blue, lineWidth: 3)
            }
            
            // 显示像素点（使用联盟旗帜）
            ForEach(viewModel.pixels) { pixel in
                Annotation("", coordinate: CLLocationCoordinate2D(
                    latitude: pixel.latitude,
                    longitude: pixel.longitude
                )) {
                    if let patternId = pixel.patternId ?? primaryPatternId, !patternId.isEmpty {
                        AllianceBadge(patternId: patternId, size: 16)
                    } else {
                        Circle()
                            .fill(.red)
                            .frame(width: 8, height: 8)
                            .overlay(
                                Circle()
                                    .stroke(.white, lineWidth: 2)
                            )
                    }
                }
            }
            
            // 起点标记
            if let first = viewModel.pixels.first {
                Annotation(NSLocalizedString("drawing_detail.start_point", comment: ""), coordinate: CLLocationCoordinate2D(
                    latitude: first.latitude,
                    longitude: first.longitude
                )) {
                    ZStack {
                        Circle()
                            .fill(.green)
                            .frame(width: 20, height: 20)
                        Image(systemName: "flag.fill")
                            .font(.caption)
                            .foregroundColor(.white)
                    }
                }
            }
            
            // 终点标记
            if let last = viewModel.pixels.last, viewModel.pixels.count > 1 {
                Annotation(NSLocalizedString("drawing_detail.end_point", comment: ""), coordinate: CLLocationCoordinate2D(
                    latitude: last.latitude,
                    longitude: last.longitude
                )) {
                    ZStack {
                        Circle()
                            .fill(.red)
                            .frame(width: 20, height: 20)
                        Image(systemName: "flag.checkered")
                            .font(.caption)
                            .foregroundColor(.white)
                    }
                }
            }
        }
        .overlay(alignment: .topLeading) {
            if let session = viewModel.session {
                Text(formatFullDate(session.startTime))
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.black)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.8))
                    .cornerRadius(4)
                    .padding(12)
            }
        }
    }
    
    // MARK: - Statistics Card
    
    private func statisticsCard(session: DrawingSession) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(NSLocalizedString("drawing_detail.statistics", comment: ""))
                .font(.headline)

            if let stats = session.statistics {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    StatBox(
                        icon: "paintbrush.fill",
                        value: "\(stats.uniqueGrids)",
                        label: NSLocalizedString("drawing_detail.stat.pixels", comment: "")
                    )

                    StatBox(
                        icon: "clock.fill",
                        value: session.formattedDuration,
                        label: NSLocalizedString("drawing_detail.stat.duration", comment: "")
                    )

                    if let distance = stats.distance, distance > 0 {
                        StatBox(
                            icon: "figure.walk",
                            value: session.formattedDistance,
                            label: NSLocalizedString("drawing_detail.stat.distance", comment: "")
                        )
                    }

                    if let avgSpeed = stats.avgSpeed, avgSpeed > 0 {
                        StatBox(
                            icon: "speedometer",
                            value: String(format: "%.1f m/s", avgSpeed),
                            label: NSLocalizedString("drawing_detail.stat.avg_speed", comment: "")
                        )
                    }

                    if let efficiency = stats.efficiency, efficiency > 0 {
                        StatBox(
                            icon: "chart.line.uptrend.xyaxis",
                            value: String(format: "%.1f", efficiency),
                            label: NSLocalizedString("drawing_detail.stat.efficiency", comment: "")
                        )
                    }

                    StatBox(
                        icon: "square.grid.3x3.fill",
                        value: "\(stats.uniqueGrids)",
                        label: NSLocalizedString("drawing_detail.stat.unique_grids", comment: "")
                    )
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: Color.black.opacity(0.05), radius: 5)
        )
    }
    
    // MARK: - Pixel List (已移除)
    // ✅ 优化 2026-02-22: 移除像素详情流水模块
    // 原因：地图显示和统计信息已经足够，像素详情列表对用户来说是冗余信息
    // 如需恢复，取消注释下方代码

    /*
    private var pixelListSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("drawing_detail.pixel_details", comment: ""))
                .font(.headline)
                .padding(.horizontal)

            ForEach(Array(viewModel.pixels.prefix(10).enumerated()), id: \.element.id) { index, pixel in
                HStack {
                    Text("#\(index + 1)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(width: 30)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(String(format: "%.6f°N, %.6f°E", pixel.latitude, pixel.longitude))
                            .font(.caption)
                            .foregroundColor(.primary)

                        Text(pixel.createdAt, style: .time)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    pixelColorIndicator(pixel: pixel)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
            .padding(.horizontal)

            if viewModel.pixels.count > 10 {
                Text(String(format: NSLocalizedString("drawing_detail.showing_pixels", comment: ""), viewModel.pixels.count))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
            }
        }
    }

    // MARK: - Pixel Color Indicator

    @ViewBuilder
    private func pixelColorIndicator(pixel: SessionPixel) -> some View {
        let indicatorSize: CGFloat = 24
        if pixel.color == "custom_pattern", let patternId = pixel.patternId, !patternId.isEmpty {
            // Complex alliance flag pattern → load from sprite endpoint
            let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            CachedAsyncImagePhase(url: URL(string: "\(baseUrl)/sprites/icon/2/complex/\(patternId).png")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: indicatorSize, height: indicatorSize)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                default:
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: indicatorSize, height: indicatorSize)
                }
            }
        } else if let hex = pixel.color, let uiColor = UIColor(hex: hex) {
            // Valid hex color → show color swatch
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(uiColor))
                .frame(width: indicatorSize, height: indicatorSize)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 0.5)
                )
        } else if let text = pixel.color, !text.isEmpty {
            // Emoji or other text
            Text(text)
                .font(.title3)
        }
    }
    */

    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button(action: {
                showReplay = true
            }) {
                Label(NSLocalizedString("drawing_detail.replay_button", comment: "Replay Drawing"), systemImage: "play.circle.fill")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
    }

    
    // MARK: - Computed Properties
    
    private var primaryPatternId: String? {
        let pixels = viewModel.pixels
        guard !pixels.isEmpty else {
            Logger.debug("🎌 primaryPatternId: No pixels")
            return nil
        }

        // 统计每个 patternId 的出现次数
        var patternCounts: [String: Int] = [:]
        for pixel in pixels {
            if let patternId = pixel.patternId, !patternId.isEmpty {
                patternCounts[patternId, default: 0] += 1
            }
        }

        Logger.info("🎌 primaryPatternId: Pattern counts: \(patternCounts)")

        // 返回出现次数最多的 patternId
        let result = patternCounts.max(by: { $0.value < $1.value })?.key
        Logger.info("🎌 primaryPatternId: Returning \(result ?? "nil")")
        return result
    }
    
    private func formatFullDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .long
        return formatter.string(from: date)
    }
}

// MARK: - Stat Box

struct StatBox: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.teal)

            Text(value)
                .font(.headline)

            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }
}

// MARK: - Session Detail Share View

struct SessionDetailShareView: View {
    let session: DrawingSession
    let pixels: [SessionPixel]

    @Environment(\.dismiss) var dismiss
    @State private var mapSnapshot: UIImage?
    @State private var isGeneratingSnapshot = false
    @State private var showShareSheet = false
    @State private var shareImage: UIImage?

    // Keep strong references to prevent Metal object deallocation
    @State private var mapSnapshotter: MKMapSnapshotter?
    @State private var mapSnapshotResult: MKMapSnapshotter.Snapshot?

    // Cache user avatar to prevent repeated creation
    @State private var cachedUserAvatarView: AnyView?

    private var currentUser: User? {
        AuthManager.shared.currentUser
    }
    
    var body: some View {
        ZStack {
            // Background blur
            Rectangle()
                .fill(.ultraThinMaterial)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    if showShareSheet {
                        withAnimation { showShareSheet = false }
                    } else {
                        dismiss()
                    }
                }
            
            VStack(spacing: DesignTokens.Spacing.xxl) {
                Spacer()
                
                // Card Preview
                GeometryReader { geometry in
                    let availableWidth = geometry.size.width
                    let availableHeight = geometry.size.height
                    // Target card size (base)
                    let cardWidth: CGFloat = 375.0
                    // Estimate card height or use a reasonable max
                    let cardHeight: CGFloat = 650.0 
                    
                    // Calculate scale to fit within available space with padding
                    let scale = min(
                        (availableWidth * 0.9) / cardWidth,
                        (availableHeight * 0.95) / cardHeight,
                        1.0 // Don't scale up beyond 1.0
                    )
                    
                    shareCard
                        .scaleEffect(scale)
                        .position(x: availableWidth / 2, y: availableHeight / 2)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity) // Take up remaining space
                
                // Action Buttons
                HStack(spacing: DesignTokens.Spacing.l) {
                    FPButton(title: NSLocalizedString("summary.button.close", comment: ""), icon: "xmark", variant: .secondary) {
                        dismiss()
                    }
                    .frame(maxWidth: 140)
                    
                    FPButton(title: NSLocalizedString("session_detail.share.button", comment: ""), icon: "square.and.arrow.up", variant: .primary) {
                        // ✅ FIX: Only proceed if map snapshot is ready
                        // This prevents rendering race conditions with Metal
                        guard !isGeneratingSnapshot, mapSnapshot != nil else {
                            Logger.warning("⚠️ Map snapshot not ready, skipping share")
                            return
                        }

                        let renderer = ImageRenderer(content: shareCard)
                        renderer.scale = 3.0
                        self.shareImage = renderer.uiImage

                        withAnimation(.spring()) {
                            showShareSheet = true
                        }
                    }
                    .frame(maxWidth: 140)
                    .disabled(isGeneratingSnapshot || mapSnapshot == nil) // Disable button while loading
                }
                .padding(.bottom, DesignTokens.Spacing.xxl)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .opacity(showShareSheet ? 0 : 1)
            }
            
            // Share Sheet Overlay
            if showShareSheet {
                shareSheetOverlay
            }
        }
        .task {
            // ✅ Initialize avatar cache first to avoid cache miss warnings
            initializeCachedAvatarView()
            // Then generate map snapshot
            await generateMapSnapshot()
        }
        .onDisappear {
            // ✅ FIX: Clean up Metal resources when view disappears
            cleanupMapResources()
        }
    }
    
    // MARK: - Share Card
    
    private var shareCard: some View {
        VStack(spacing: 0) {
            // 1️⃣ Header
            VStack(spacing: 8) {
                Text(NSLocalizedString("session_detail.share.title", comment: ""))
                    .font(DesignTokens.Typography.title2.weight(.bold))
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                
                Text(NSLocalizedString("session_detail.share.subtitle", comment: ""))
                    .font(DesignTokens.Typography.subheadline)
                    .foregroundColor(DesignTokens.Colors.textSecondary)
            }
            .padding(.top, DesignTokens.Spacing.xl)
            .padding(.horizontal, DesignTokens.Spacing.xl)
            
            // 2️⃣ Map Artwork Area
            ZStack(alignment: .topLeading) {
                if let snapshot = mapSnapshot {
                    Image(uiImage: snapshot)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 335, height: 335)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.medium))
                } else {
                    ZStack {
                        DesignTokens.Colors.secondaryBackground
                        VStack(spacing: DesignTokens.Spacing.s) {
                            ProgressView()
                            DesignTokens.Typography.caption(NSLocalizedString("session_detail.generating_map", comment: ""))
                                .foregroundColor(DesignTokens.Colors.textSecondary)
                        }
                    }
                    .frame(width: 335, height: 335)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.medium))
                }
                
                // Artwork Tag
                Text(NSLocalizedString("summary.artwork_tag", comment: ""))
                    .font(DesignTokens.Typography.caption.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.6))
                    .clipShape(Capsule())
                    .padding(12)
                
                // Watermark
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Text(NSLocalizedString("summary.watermark", comment: ""))
                            .font(DesignTokens.Typography.caption2.weight(.semibold))
                            .foregroundColor(.white.opacity(0.5))
                            .padding(12)
                    }
                }
                .frame(width: 335, height: 335)
                
                
                // Date Stamp (Bottom-Right)
                Text(formatFullDate(session.startTime))
                    .font(DesignTokens.Typography.caption2.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.gray.opacity(0.5))
                    .cornerRadius(4)
                    .padding(12)
                    .frame(width: 335, height: 335, alignment: .bottomTrailing)
            }
            .padding(.top, DesignTokens.Spacing.l)
            
            // 3️⃣ Activity Description
            if let stats = session.statistics {
                Text(String(format: NSLocalizedString("summary.activity_description", comment: ""), formatTime(session.startTime)))
                    .font(DesignTokens.Typography.subheadline)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .padding(.top, DesignTokens.Spacing.l)
                
                // 4️⃣ Stats Summary
                VStack(spacing: 8) {
                    HStack(alignment: .center, spacing: 4) {
                        Image(systemName: "paintbrush.fill")
                            .font(DesignTokens.Typography.footnote)
                            .foregroundColor(DesignTokens.Colors.accent)
                        Text(String(format: NSLocalizedString("summary.stats.pixels_label", comment: ""), stats.uniqueGrids))
                            .font(DesignTokens.Typography.subheadline)
                            .foregroundColor(DesignTokens.Colors.textPrimary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    HStack(alignment: .center, spacing: 4) {
                        Image(systemName: "clock.fill")
                            .font(DesignTokens.Typography.footnote)
                            .foregroundColor(DesignTokens.Colors.accent)
                        Text(String(format: NSLocalizedString("summary.stats.duration_label", comment: ""), "\(stats.duration ?? 0)"))
                            .font(DesignTokens.Typography.subheadline)
                            .foregroundColor(DesignTokens.Colors.textPrimary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if let distance = stats.distance, distance > 0 {
                        HStack(alignment: .center, spacing: 4) {
                            Image(systemName: "figure.walk")
                                .font(DesignTokens.Typography.footnote)
                                .foregroundColor(DesignTokens.Colors.accent)
                            Text(String(format: NSLocalizedString("session_detail.share.distance", comment: ""), session.formattedDistance))
                                .font(DesignTokens.Typography.subheadline)
                                .foregroundColor(DesignTokens.Colors.textPrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.m)
            }
            
            // 5️⃣ Creator Info
            HStack(spacing: DesignTokens.Spacing.m) {
                userAvatar
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(currentUser?.displayOrUsername ?? "Pixel Artist")
                        .font(DesignTokens.Typography.subheadline.weight(.semibold))
                        .foregroundColor(DesignTokens.Colors.textPrimary)
                        .lineLimit(1)
                    Text(NSLocalizedString("summary.created_by", comment: ""))
                        .font(DesignTokens.Typography.footnote)
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                }
                
                Spacer()
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.l)
            
            // 6️⃣ Growth CTA
            HStack(spacing: DesignTokens.Spacing.m) {
                if let qr = generateQRCode(from: ConfigService.shared.shareDownloadUrl) {
                    Image(uiImage: qr)
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .frame(width: 60, height: 60)
                        .cornerRadius(6)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("session_detail.share.cta", comment: ""))
                        .font(DesignTokens.Typography.subheadline.weight(.semibold))
                        .foregroundColor(DesignTokens.Colors.accent)
                        .multilineTextAlignment(.leading)
                }
                
                Spacer()
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.l)
            .padding(.bottom, DesignTokens.Spacing.xl)
        }
        .frame(width: 375)
        .background(DesignTokens.Colors.cardBackground)
        .cornerRadius(DesignTokens.Radius.large)
        .fpShadow(DesignTokens.Shadows.card)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.large)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private var userAvatar: some View {
        // ✅ FIX: Use cached avatar view to prevent repeated Metal rendering
        if let cached = cachedUserAvatarView {
            return cached
        } else {
            // Fallback - should not happen if initialized properly
            Logger.warning("⚠️ Using fallback avatar view (cache miss)")
            // 🔧 FIX: Use session's alliance flag in fallback as well
            let flagPatternId = session.allianceFlagPatternId ?? currentUser?.alliance?.flagPatternId
            return AnyView(
                AvatarView(
                    avatarUrl: currentUser?.avatarUrl,  // ✅ CDN/file path only
                    avatar: nil,                        // ❌ Don't use pixel data
                    displayName: currentUser?.displayOrUsername ?? "Pixel Artist",
                    flagPatternId: flagPatternId,
                    size: 40
                )
            )
        }
    }
    
    // MARK: - Share Sheet Overlay
    
    private var shareSheetOverlay: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.2)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    withAnimation { showShareSheet = false }
                }

            VStack(spacing: 0) {
                VStack(spacing: DesignTokens.Spacing.l) {
                    DesignTokens.Typography.title(NSLocalizedString("summary.share.title", comment: ""))
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                        .padding(.top, DesignTokens.Spacing.l)

                    // Icons Grid - 2 rows of 3
                    let platforms = SocialPlatform.allCases
                    let topRow = Array(platforms.prefix(3))
                    let bottomRow = Array(platforms.dropFirst(3))

                    VStack(spacing: DesignTokens.Spacing.l) {
                        HStack(spacing: 30) {
                            ForEach(topRow, id: \.self) { platform in
                                sharePlatformButton(platform)
                            }
                        }
                        HStack(spacing: 30) {
                            ForEach(bottomRow, id: \.self) { platform in
                                sharePlatformButton(platform)
                            }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                    Divider()
                        .padding(.vertical, DesignTokens.Spacing.s)

                    Button(action: {
                        withAnimation { showShareSheet = false }
                    }) {
                        Text(NSLocalizedString("common.cancel", comment: ""))
                            .font(DesignTokens.Typography.title3)
                            .foregroundColor(DesignTokens.Colors.textPrimary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                    }
                }
                .background(DesignTokens.Colors.cardBackground)
                .cornerRadius(DesignTokens.Radius.large, corners: [.topLeft, .topRight])
            }
            .transition(.move(edge: .bottom))
        }
        .zIndex(100)
    }

    private func sharePlatformButton(_ platform: SocialPlatform) -> some View {
        Button(action: {
            handleShare(platform)
        }) {
            VStack(spacing: DesignTokens.Spacing.s) {
                ZStack {
                    Circle()
                        .fill(Color(platform.color))
                        .frame(width: 50, height: 50)

                    Image(systemName: platform.iconName)
                        .font(DesignTokens.Typography.title2)
                        .foregroundColor(.white)
                }

                Text(platform.title)
                    .font(DesignTokens.Typography.caption)
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                    .lineLimit(1)
            }
            .frame(width: 70)
        }
    }
    
    // MARK: - Helpers
    
    private func generateMapSnapshot() async {
        guard !pixels.isEmpty else { return }

        isGeneratingSnapshot = true
        Logger.info("🗺️ SessionDetailShareView: Starting map snapshot generation")

        do {
            // ✅ FIX: Capture image, snapshotter AND snapshot references
            let result = try await MapSnapshotGenerator.generateSnapshot(from: pixels)

            // Assign to properties on main thread
            await MainActor.run {
                mapSnapshot = result.image
                mapSnapshotter = result.snapshotter // Keep strong reference
                mapSnapshotResult = result.snapshot // ✅ FIX: Keep snapshot alive to prevent Metal deallocation
            }

            Logger.info("✅ SessionDetailShareView: Map snapshot generated successfully, size: \(result.image.size)")
        } catch {
            Logger.error("❌ Failed to generate map snapshot: \(error)")
            // Clean up on error
            await MainActor.run {
                cleanupMapResources()
            }
        }

        isGeneratingSnapshot = false
    }

    private func initializeCachedAvatarView() {
        guard cachedUserAvatarView == nil else { return }

        // 🔧 FIX: Use session's alliance flag instead of current user's alliance flag
        // This ensures the flag matches the alliance at the time of drawing
        let flagPatternId = session.allianceFlagPatternId ?? currentUser?.alliance?.flagPatternId
        Logger.info("📸 SessionDetailShareView: Initializing cached avatar for user=\(currentUser?.displayOrUsername ?? "nil"), avatarUrl=\(currentUser?.avatarUrl ?? "nil"), flagPatternId=\(flagPatternId ?? "nil")")

        cachedUserAvatarView = AnyView(
            AvatarView(
                avatarUrl: currentUser?.avatarUrl,  // ✅ CDN/file path only (no pixel data)
                avatar: nil,                        // ❌ Don't use pixel data
                displayName: currentUser?.displayOrUsername ?? "Pixel Artist",
                flagPatternId: flagPatternId,
                size: 40
            )
        )
    }

    private func cleanupMapResources() {
        Logger.info("🧹 SessionDetailShareView: Cleaning up map resources")
        // Release all map references to free Metal resources
        mapSnapshotter = nil
        mapSnapshotResult = nil
        mapSnapshot = nil
    }
    
    private func handleShare(_ platform: SocialPlatform) {
        guard let image = self.shareImage else { return }
        let shareUrl = "\(AppEnvironment.current.apiBaseURL)/share/page/session/\(session.id)"
        let text = NSLocalizedString("summary.share_text", comment: "")

        switch platform {
        case .copyLink:
            SocialShareManager.shared.copyLink(shareUrl)
        case .saveImage:
            saveImageToPhotos(image)
        default:
            if let scheme = platform.urlScheme {
                SocialShareManager.shared.shareToApp(scheme: scheme, image: image, text: text, url: shareUrl)
            }
        }

        withAnimation { showShareSheet = false }
    }

    private func saveImageToPhotos(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization { status in
            guard status == .authorized else { return }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                if let error = error {
                    Logger.error("❌ Save image error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            formatter.dateFormat = Locale.current.language.languageCode?.identifier == "zh" ? "今天 HH:mm" : "'Today' HH:mm"
        } else if calendar.isDateInYesterday(date) {
            formatter.dateFormat = Locale.current.language.languageCode?.identifier == "zh" ? "昨晚 HH:mm" : "'Yesterday' HH:mm"
        } else {
            formatter.dateFormat = Locale.current.language.languageCode?.identifier == "zh" ? "MM月dd日 HH:mm" : "MMM dd HH:mm"
        }
        
        return formatter.string(from: date)
    }
    
    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let data = string.data(using: String.Encoding.ascii)
        
        if let filter = CIFilter(name: "CIQRCodeGenerator") {
            filter.setValue(data, forKey: "inputMessage")
            filter.setValue("M", forKey: "inputCorrectionLevel")
            
            if let output = filter.outputImage {
                let transform = CGAffineTransform(scaleX: 10, y: 10)
                let scaledOutput = output.transformed(by: transform)
                
                if let cgImage = context.createCGImage(scaledOutput, from: scaledOutput.extent) {
                    return UIImage(cgImage: cgImage)
                }
            }
        }
        return nil
    }

    private func formatFullDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .long
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        SessionDetailView(sessionId: "test-session-id")
    }
}
