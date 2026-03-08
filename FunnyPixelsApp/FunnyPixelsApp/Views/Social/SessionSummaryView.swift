import SwiftUI
import MapLibre
import Photos

struct SessionSummaryView: View {
    let stats: SessionStats
    let mapImage: UIImage?
    @Environment(\.dismiss) var dismiss
    @State private var isSharing = false
    @ObservedObject private var fontManager = FontSizeManager.shared
    
    // User profile for the share card
    private var currentUser: User? {
        AuthManager.shared.currentUser
    }
    
    // MARK: - Premium Share Card Design (Vertical layout per spec)
    var shareCard: some View {
        VStack(spacing: 0) {
            // 1️⃣ Header (Title + Subtitle)
            VStack(spacing: 8) {
                Text(NSLocalizedString("summary.title", comment: ""))
                    .font(DesignTokens.Typography.title2.weight(.bold))
                    .foregroundColor(DesignTokens.Colors.textPrimary)
                
                Text(NSLocalizedString("summary.subtitle", comment: ""))
                    .font(DesignTokens.Typography.subheadline)
                    .foregroundColor(DesignTokens.Colors.textSecondary)
            }
            .padding(.top, DesignTokens.Spacing.xl)
            .padding(.horizontal, DesignTokens.Spacing.xl)
            
            // 2️⃣ Map Artwork Area (~45% height, visual focal point)
            ZStack(alignment: .topLeading) {
                // Map Image
                if let image = mapImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 335, height: 335) // Square map area
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.medium))
                } else {
                    ZStack {
                        DesignTokens.Colors.secondaryBackground
                        VStack(spacing: DesignTokens.Spacing.s) {
                            Image(systemName: "map.fill")
                                .font(DesignTokens.Typography.largeTitle)
                                .foregroundColor(.gray.opacity(0.5))
                            DesignTokens.Typography.caption(NSLocalizedString("summary.map.generating", comment: ""))
                                .foregroundColor(DesignTokens.Colors.textSecondary)
                        }
                    }
                    .frame(width: 335, height: 335)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.medium))
                }
                
                // Artwork Tag Overlay (top-left)
                Text(NSLocalizedString("summary.artwork_tag", comment: ""))
                    .font(DesignTokens.Typography.caption.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.6))
                    .clipShape(Capsule())
                    .padding(12)
                
                // Watermark Overlay (bottom-right)
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
                Text(formatFullDate(stats.date))
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
            .onAppear {
                Logger.info("[TRACKER] 7. Share Page Data: SessionID=\(stats.sessionId ?? "nil"), PixelCount=\(stats.pixelCount), Distance=\(stats.distance ?? 0)")
            }
            
            // 3️⃣ Activity Description
            Text(String(format: NSLocalizedString("summary.activity_description", comment: ""), formatTime(stats.date)))
                .font(DesignTokens.Typography.subheadline)
                .foregroundColor(DesignTokens.Colors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.l)
            
            // 4️⃣ Stats Summary (2-3 items with icons)
            VStack(spacing: 8) {
                HStack(alignment: .center, spacing: 4) {
                    Image(systemName: "paintbrush.fill")
                        .font(DesignTokens.Typography.footnote)
                        .foregroundColor(DesignTokens.Colors.accent)
                    Text(String(format: NSLocalizedString("summary.stats.pixels_label", comment: ""), stats.pixelCount))
                        .font(DesignTokens.Typography.subheadline)
                        .foregroundColor(DesignTokens.Colors.textPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                HStack(alignment: .center, spacing: 4) {
                    Image(systemName: "clock.fill")
                        .font(DesignTokens.Typography.footnote)
                        .foregroundColor(DesignTokens.Colors.accent)
                    Text(String(format: NSLocalizedString("summary.stats.duration_label", comment: ""), formatDurationInSeconds(stats.duration)))
                        .font(DesignTokens.Typography.subheadline)
                        .foregroundColor(DesignTokens.Colors.textPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                // Action Tag (conditional)
                if stats.duration < 300 { // Fast completion (< 5 minutes)
                    Text(NSLocalizedString("summary.stats.action_fast", comment: ""))
                        .font(DesignTokens.Typography.subheadline)
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text(NSLocalizedString("summary.stats.action_area", comment: ""))
                        .font(DesignTokens.Typography.subheadline)
                        .foregroundColor(DesignTokens.Colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.m)
            
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
            
            // 6️⃣ Growth CTA (QR Code + CTA Text)
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
                    Text(NSLocalizedString("summary.cta", comment: ""))
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
        .frame(width: 375) // Fixed width for consistent generation
        .background(DesignTokens.Colors.cardBackground)
        .cornerRadius(DesignTokens.Radius.large)
        .fpShadow(DesignTokens.Shadows.card)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.large)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private var userAvatar: some View {
        let flagPatternId = currentUser?.alliance?.flagPatternId
        Logger.info("📸 SessionSummaryView.userAvatar: Creating AvatarView for user=\(currentUser?.displayOrUsername ?? "nil"), flagPatternId=\(flagPatternId ?? "nil"), allianceName=\(currentUser?.alliance?.name ?? "nil")")

        return DecoratedAvatarView(
            avatar: currentUser?.avatar,
            displayName: currentUser?.displayOrUsername ?? "Pixel Artist",
            flagPatternId: flagPatternId,
            size: 40,
            equippedCosmetics: currentUser?.equippedCosmetics
        )
    }
    
    @State private var showShareSheet = false
    @State private var shareImage: UIImage?
    @State private var showToast = false
    @State private var toastMessage = ""

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
                
                // Card Preview (Scaled down to fit screen)
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
                .onTapGesture {
                    if showShareSheet { withAnimation { showShareSheet = false } }
                }
                
                // 7️⃣ Bottom Action Buttons
                HStack(spacing: DesignTokens.Spacing.m) {
                    // 关闭按钮
                    FPButton(
                        title: NSLocalizedString("summary.button.close", comment: ""),
                        icon: "xmark",
                        variant: .secondary
                    ) {
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)

                    // 分享我的像素按钮
                    FPButton(
                        title: NSLocalizedString("summary.button.share", comment: ""),
                        icon: "square.and.arrow.up",
                        variant: .primary
                    ) {
                        // 生成分享图片
                        let renderer = ImageRenderer(content: shareCard)
                        renderer.scale = 3.0
                        self.shareImage = renderer.uiImage

                        withAnimation(.spring()) {
                            showShareSheet = true
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.bottom, DesignTokens.Spacing.xxl)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .opacity(showShareSheet ? 0 : 1)
            }
            
            // Custom Share Sheet Overlay
            if showShareSheet {
                shareSheetOverlay
            }
        }
    }
    
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
    
    private func handleShare(_ platform: SocialPlatform) {
        guard let image = self.shareImage else { return }
        let shareUrl = "\(AppEnvironment.current.apiBaseURL)/share/page/session/\(stats.sessionId ?? "")"
        let text = NSLocalizedString("summary.share_text", comment: "")
        
        switch platform {
        case .copyLink:
            SocialShareManager.shared.copyLink(shareUrl)
            showToastMessage(NSLocalizedString("share.link_copied", comment: ""))
        case .saveImage:
            saveImageToPhotos(image)
        default:
            if let scheme = platform.urlScheme {
                SocialShareManager.shared.shareToApp(scheme: scheme, image: image, text: text, url: shareUrl)
                showToastMessage("\(platform.title)\(NSLocalizedString("share.opened", comment: ""))")
            }
        }
        
        withAnimation { showShareSheet = false }
    }
    
    private func saveImageToPhotos(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization { status in
            guard status == .authorized else {
                DispatchQueue.main.async {
                    self.showToastMessage(NSLocalizedString("share.save_failed", comment: ""))
                }
                return
            }
            
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        self.showToastMessage(NSLocalizedString("share.save_success", comment: ""))
                    } else {
                        self.showToastMessage(NSLocalizedString("share.save_failed", comment: ""))
                        if let error = error {
                            Logger.error("❌ Save image error: \(error.localizedDescription)")
                        }
                    }
                }
            }
        }
    }
    
    private func showToastMessage(_ message: String) {
        toastMessage = message
        withAnimation {
            showToast = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation {
                showToast = false
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "昨晚 HH:mm" // Default Chinese format
        
        // Check if it's today, yesterday, or other
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
    
    private func formatDurationInSeconds(_ duration: TimeInterval) -> String {
        let totalSeconds = Int(duration)
        return "\(totalSeconds)"
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




