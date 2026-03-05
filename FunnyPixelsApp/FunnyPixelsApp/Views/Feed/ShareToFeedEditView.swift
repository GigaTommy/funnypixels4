import SwiftUI

struct ShareToFeedEditView: View {
    let stats: SessionStats
    let onPublish: (String, [String]) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var story: String = ""
    @State private var isPublishing = false
    @FocusState private var isStoryFocused: Bool

    private let maxStoryLength = 500

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // 作品预览
                    artworkPreviewSection

                    // 故事输入
                    storyInputSection

                    // 统计信息
                    statsSection
                }
                .padding()
            }
            .navigationTitle(NSLocalizedString("share.edit.navigation_title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(NSLocalizedString("common.cancel", comment: "")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    publishButton
                }
            }
        }
    }

    private var artworkPreviewSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(NSLocalizedString("share.edit.artwork_preview", comment: ""))
                .font(.headline)

            if let sessionId = stats.sessionId {
                SessionThumbnailView(sessionId: sessionId)
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .cornerRadius(12)
            }
        }
    }

    private var storyInputSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(NSLocalizedString("share.edit.story_label", comment: ""))
                    .font(.headline)

                Spacer()

                Text("\(story.count)/\(maxStoryLength)")
                    .font(.caption)
                    .foregroundColor(story.count > maxStoryLength ? .red : .secondary)
            }

            TextEditor(text: $story)
                .frame(height: 120)
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(8)
                .focused($isStoryFocused)
                .overlay(
                    Group {
                        if story.isEmpty {
                            Text(NSLocalizedString("share.edit.story_placeholder", comment: ""))
                                .foregroundColor(.secondary)
                                .padding(.leading, 12)
                                .padding(.top, 16)
                                .allowsHitTesting(false)
                        }
                    },
                    alignment: .topLeading
                )
        }
    }

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(NSLocalizedString("share.edit.stats_label", comment: ""))
                .font(.headline)

            HStack(spacing: 20) {
                ShareStatItem(
                    icon: "paintbrush.fill",
                    value: "\(stats.pixelCount)",
                    label: NSLocalizedString("share.edit.pixels", comment: "")
                )

                ShareStatItem(
                    icon: "clock.fill",
                    value: formatDuration(stats.duration),
                    label: NSLocalizedString("share.edit.duration", comment: "")
                )
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var publishButton: some View {
        Button(action: {
            Task {
                await publishToFeed()
            }
        }) {
            if isPublishing {
                ProgressView()
            } else {
                Text(NSLocalizedString("share.edit.publish_button", comment: ""))
                    .fontWeight(.semibold)
            }
        }
        .disabled(isPublishing || story.count > maxStoryLength)
    }

    private func publishToFeed() async {
        isPublishing = true
        await onPublish(story.trimmingCharacters(in: .whitespacesAndNewlines), [])
        isPublishing = false
        dismiss()
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

private struct ShareStatItem: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
            Text(value)
                .font(.headline)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
