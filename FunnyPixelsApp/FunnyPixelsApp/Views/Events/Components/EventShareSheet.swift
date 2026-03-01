import SwiftUI
import UIKit

/// P2-1: Event Share Sheet - Complete version with image generation and invite links
struct EventShareSheet: View {
    let event: EventService.Event
    let contribution: EventContribution?

    @State private var isGenerating = false
    @State private var shareImage: UIImage?
    @State private var inviteLink: String?
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var fontManager = FontSizeManager.shared

    var body: some View {
        NavigationView {
            VStack(spacing: AppSpacing.l) {
                if isGenerating {
                    // Loading state
                    VStack(spacing: AppSpacing.m) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text(NSLocalizedString("share.generating", comment: "Generating share image..."))
                            .font(fontManager.scaledFont(.subheadline))
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    // Error state
                    VStack(spacing: AppSpacing.m) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 48))
                            .foregroundColor(.red)
                        Text(error)
                            .font(fontManager.scaledFont(.body))
                            .foregroundColor(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                        Button(NSLocalizedString("common.retry", comment: "Retry")) {
                            Task { await generateShareContent() }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else if let shareImage = shareImage {
                    // Success state - show preview and share options
                    ScrollView {
                        VStack(spacing: AppSpacing.l) {
                            // Image preview
                            Image(uiImage: shareImage)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxWidth: .infinity)
                                .cornerRadius(AppRadius.l)
                                .shadow(radius: 8)
                                .padding(.horizontal)

                            // Invite link (optional)
                            if let link = inviteLink {
                                VStack(spacing: AppSpacing.s) {
                                    Text(NSLocalizedString("share.invite_link", comment: "Invite Link"))
                                        .font(fontManager.scaledFont(.caption).weight(.medium))
                                        .foregroundColor(AppColors.textSecondary)

                                    HStack {
                                        Text(link)
                                            .font(fontManager.scaledFont(.caption2))
                                            .foregroundColor(AppColors.textPrimary)
                                            .lineLimit(1)
                                            .truncationMode(.middle)

                                        Button(action: {
                                            UIPasteboard.general.string = link
                                            HapticManager.shared.notification(type: .success)
                                        }) {
                                            Image(systemName: "doc.on.doc")
                                                .font(fontManager.scaledFont(.caption))
                                        }
                                    }
                                    .padding()
                                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                                    .cornerRadius(AppRadius.m)
                                }
                                .padding(.horizontal)
                            }

                            // Share button
                            Button(action: {
                                shareContent()
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "square.and.arrow.up")
                                        .font(fontManager.scaledFont(.headline))
                                    Text(NSLocalizedString("share.button", comment: "Share"))
                                        .font(fontManager.scaledFont(.headline).weight(.semibold))
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(
                                    LinearGradient(
                                        colors: [AppColors.primary, AppColors.primary.opacity(0.8)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(AppRadius.l)
                            }
                            .padding(.horizontal)
                            .padding(.bottom)
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("share.title", comment: "Share Event"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(NSLocalizedString("common.close", comment: "Close")) {
                        dismiss()
                    }
                }
            }
            .task {
                await generateShareContent()
            }
        }
    }

    // MARK: - Share Logic

    private func generateShareContent() async {
        isGenerating = true
        errorMessage = nil

        do {
            // 1. Generate invite link
            let link = try await EventService.shared.generateInviteLink(eventId: event.id)

            // 2. Generate share image
            let image = await EventShareGenerator.shared.generateShareImage(
                event: event,
                contribution: contribution,
                inviteLink: link
            )

            await MainActor.run {
                self.inviteLink = link
                self.shareImage = image
                self.isGenerating = false
            }

            Logger.info("✅ Generated share content for event: \(event.title)")
        } catch {
            await MainActor.run {
                self.errorMessage = NSLocalizedString("share.generation_failed", comment: "Failed to generate share content")
                self.isGenerating = false
            }
            Logger.error("❌ Failed to generate share content: \(error)")
        }
    }

    private func shareContent() {
        guard let shareImage = shareImage else { return }

        var items: [Any] = [shareImage]

        // Add invite link as text
        if let link = inviteLink {
            let shareText = String(format: NSLocalizedString("share.message", comment: "Join me in %@!"), event.title) + "\n" + link
            items.append(shareText)
        }

        let activityVC = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )

        // Record share action
        Task {
            try? await EventService.shared.recordShare(eventId: event.id, platform: "ios_share")
        }

        // Present share sheet
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            var topVC = rootVC
            while let presented = topVC.presentedViewController {
                topVC = presented
            }

            // iPad support
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = topVC.view
                popover.sourceRect = CGRect(x: topVC.view.bounds.midX, y: topVC.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }

            // Completion handler
            activityVC.completionWithItemsHandler = { activityType, completed, _, error in
                if completed {
                    SoundManager.shared.play(.success)
                    HapticManager.shared.notification(type: .success)
                    Logger.info("✅ Event shared successfully via \(activityType?.rawValue ?? "unknown")")

                    // Show reward toast (if configured)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        // TODO: Show share reward notification if backend configured
                    }
                }
            }

            topVC.present(activityVC, animated: true)
        }
    }
}

// MARK: - Preview

#Preview {
    EventShareSheet(
        event: EventService.Event(
            id: "test",
            title: "Weekend Challenge",
            type: "flash_war",
            status: "active",
            startTime: Date().ISO8601Format(),
            endTime: Date().addingTimeInterval(3600).ISO8601Format()
        ),
        contribution: nil
    )
}
