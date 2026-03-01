import SwiftUI
import MapKit

struct InteractivePixelBottomSheet: View {
    let pixel: Pixel
    let onClose: () -> Void
    
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var isLiked = false
    @State private var isFollowing = false
    @State private var showShareSheet = false
    @State private var showReportSheet = false
    @State private var showReportAlert = false
    
    // Services
    private let socialService = SocialService.shared
    private let pixelService = PixelService.shared
    
    // Detents
    @State private var selectedDetent: PresentationDetent = .height(160)
    
    var body: some View {
        VStack(spacing: 0) {
            // Drag Indicator
            Capsule()
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 36, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 16)
            
            // Content
            ScrollView {
                VStack(spacing: 20) {
                    // Header Area (Visible in Collapsed)
                    headerView
                    
                    Divider()
                    
                    // Action Buttons
                    actionButtons
                    
                    Divider()
                    
                    // Detailed Info (Visible in Medium/Large)
                    detailedInfo
                    
                    Spacer(minLength: 50)
                }
                .padding(.horizontal)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .presentationDetents([.height(160), .medium, .large], selection: $selectedDetent)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .presentationDragIndicator(.hidden) // We made our own custom one
        .presentationCornerRadius(24)
        .onAppear {
            checkStatus()
        }
        .sheet(isPresented: $showShareSheet) {
            let text = "快来看看这个有趣的像素！坐标：\(pixel.latitude), \(pixel.longitude)"
            ShareSheet(activityItems: [text])
        }
        .alert("举报成功", isPresented: $showReportAlert) {
            Button("确定", role: .cancel) { }
        } message: {
            Text(NSLocalizedString("pixel.feedback_thanks", comment: ""))
        }
        .confirmationDialog("举报像素", isPresented: $showReportSheet, titleVisibility: .visible) {
             Button("不当内容", role: .destructive) {
                 reportPixel(reason: "inappropriate_content")
             }
             Button("垃圾广告", role: .destructive) {
                 reportPixel(reason: "spam")
             }
             Button("其他", role: .destructive) {
                 reportPixel(reason: "other")
             }
             Button("取消", role: .cancel) { }
        }
    }
    
    // MARK: - Subviews
    
    private var headerView: some View {
        HStack(alignment: .top, spacing: 16) {
            // Avatar
            avatarView
            
            VStack(alignment: .leading, spacing: 4) {
                // Author Name
                Text("@\(pixel.authorName ?? "匿名用户")")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                
                // Alliance & City
                HStack(spacing: 6) {
                    if let allianceName = pixel.allianceName {
                        HStack(spacing: 2) {
                            if let flag = pixel.allianceFlag, !flag.isEmpty {
                                if flag.allSatisfy({ $0.isASCII }) {
                                    // ASCII = pattern ID (e.g. "custom_flag_123")
                                    AllianceBadge(patternId: flag, size: 18)
                                } else {
                                    // Non-ASCII = emoji (e.g. "🇨🇳")
                                    Text(flag)
                                }
                            } else {
                                Image(systemName: "flag.fill")
                            }
                            Text(allianceName)
                        }
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.blue)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .clipShape(Capsule())
                    }
                    
                    if let city = pixel.city {
                        Text(city)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // Close Button (only visible if not dragging? Or just keep it)
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary.opacity(0.6))
            }
        }
    }
    
    private var avatarView: some View {
        Group {
            if let avatarUrl = pixel.authorAvatarUrl, let url = URL(string: avatarUrl) {
                CachedAsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Image(systemName: "person.circle.fill")
                        .resizable()
                        .foregroundStyle(.gray.opacity(0.3))
                }
            } else {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .foregroundStyle(.gray.opacity(0.3))
            }
        }
        .frame(width: 50, height: 50)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.gray.opacity(0.2), lineWidth: 1))
    }
    
    private var actionButtons: some View {
        HStack(spacing: 20) {
            ActionButton(
                icon: isFollowing ? "person.badge.minus" : "person.badge.plus",
                label: isFollowing ? "已关注" : "关注",
                isActive: isFollowing,
                action: toggleFollow
            )
            
            ActionButton(
                icon: isLiked ? "heart.fill" : "heart",
                label: isLiked ? "已喜欢" : "喜欢",
                isActive: isLiked,
                activeColor: .red,
                action: toggleLike
            )
            
            ActionButton(
                icon: "square.and.arrow.up",
                label: "分享",
                action: { showShareSheet = true }
            )
            
            ActionButton(
                icon: "exclamationmark.bubble",
                label: "举报",
                activeColor: .orange,
                action: { showReportSheet = true }
            )
        }
    }
    
    private var detailedInfo: some View {
        VStack(alignment: .leading, spacing: 16) {
            InfoRow(icon: "location.fill", title: "坐标", value: String(format: "%.4f, %.4f", pixel.latitude, pixel.longitude))
            
            if let country = pixel.country {
                InfoRow(icon: "globe", title: "国家/地区", value: country) // Can add flag conversion if needed
            }
            
            InfoRow(icon: "clock", title: "创建时间", value: pixel.createdAt.formatted(date: .numeric, time: .shortened))
            
            // Placeholder for Ad or History
            if selectedDetent == .large {
                VStack(alignment: .leading, spacing: 8) {
                    Text(NSLocalizedString("pixel.history", comment: ""))
                        .font(.headline)
                        .padding(.top, 8)
                    
                    Text(NSLocalizedString("pixel.no_more_history", comment: ""))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 20)
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(12)
                }
            }
        }
    }
    
    // MARK: - Actions
    
    private func checkStatus() {
        Task {
            // Check Like
            if let status = try? await pixelService.checkLikeStatus(pixelId: pixel.id) {
                isLiked = status.liked
            }
            
            // Check Follow
            if let authorId = Optional(pixel.authorId), !authorId.isEmpty,
               let currentUserId = authViewModel.currentUser?.id,
               authorId != currentUserId {
                if let status = try? await socialService.checkFollowStatus(userId: authorId) {
                    isFollowing = status.isFollowing
                }
            }
        }
    }
    
    private func toggleLike() {
        Task {
            if isLiked {
                _ = try? await pixelService.unlikePixel(pixelId: pixel.id)
                isLiked = false
            } else {
                _ = try? await pixelService.likePixel(pixelId: pixel.id)
                isLiked = true
                
                // Haptic
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            }
        }
    }
    
    private func toggleFollow() {
        Task {
            guard let authorId = Optional(pixel.authorId), !authorId.isEmpty else { return }
            if isFollowing {
                _ = try? await socialService.unfollowUser(userId: authorId)
                isFollowing = false
            } else {
                _ = try? await socialService.followUser(userId: authorId)
                isFollowing = true
                
                // Haptic
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
            }
        }
    }
    
    private func reportPixel(reason: String) {
        Task {
            _ = try? await pixelService.reportPixel(pixelId: pixel.id, reason: reason)
            await MainActor.run {
                showReportAlert = true
            }
        }
    }
}

// MARK: - Components

struct ActionButton: View {
    let icon: String
    let label: String
    var isActive: Bool = false
    var activeColor: Color = .blue
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(isActive ? activeColor : .primary)
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(isActive ? activeColor : .primary)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct InfoRow: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 24)
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .font(.subheadline)
    }
}
