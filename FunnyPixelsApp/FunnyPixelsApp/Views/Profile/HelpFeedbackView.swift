import SwiftUI

struct HelpFeedbackView: View {
    @State private var selectedTab = 0
    @ObservedObject private var fontManager = FontSizeManager.shared
    
    var body: some View {
        VStack(spacing: 0) {
            Picker(NSLocalizedString("help.segment.title", comment: "Help segmented control title"), selection: $selectedTab) {
                Text(NSLocalizedString("help.segment.manual", comment: "Manual")).tag(0)
                Text(NSLocalizedString("help.segment.feedback", comment: "Feedback")).tag(1)
            }
            .pickerStyle(.segmented)
            .padding()
            
            if selectedTab == 0 {
                HelpManualView()
            } else {
                FeedbackSubmissionView()
            }
        }
        .navigationTitle(NSLocalizedString("help.title", comment: "Help & Feedback"))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
    }
}

struct HelpManualView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Welcome header
                VStack(alignment: .leading, spacing: 8) {
                    Text(NSLocalizedString("help.manual.welcome_title", comment: ""))
                        .font(.title2.bold())
                    Text(NSLocalizedString("help.manual.welcome_desc", comment: ""))
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.bottom, 4)

                Divider()

                manualSection(icon: "figure.walk", color: .blue, titleKey: "help.manual.getting_started_title", contentKey: "help.manual.getting_started_desc")
                manualSection(icon: "location.north.fill", color: .green, titleKey: "help.manual.gps_drawing_title", contentKey: "help.manual.gps_drawing_desc")
                manualSection(icon: "paintbrush.pointed.fill", color: .orange, titleKey: "help.manual.manual_drawing_title", contentKey: "help.manual.manual_drawing_desc")
                manualSection(icon: "map.fill", color: .teal, titleKey: "help.manual.map_explore_title", contentKey: "help.manual.map_explore_desc")
                manualSection(icon: "photo.on.rectangle.angled", color: .purple, titleKey: "help.manual.history_title", contentKey: "help.manual.history_desc")
                manualSection(icon: "cart.fill", color: .pink, titleKey: "help.manual.shop_title", contentKey: "help.manual.shop_desc")
                manualSection(icon: "flag.fill", color: .red, titleKey: "help.manual.alliance_title", contentKey: "help.manual.alliance_desc")
                manualSection(icon: "trophy.fill", color: .yellow, titleKey: "help.manual.achievements_title", contentKey: "help.manual.achievements_desc")
                manualSection(icon: "flame.fill", color: .orange, titleKey: "help.manual.events_title", contentKey: "help.manual.events_desc")
                manualSection(icon: "paperplane.fill", color: .cyan, titleKey: "help.manual.drift_bottle_title", contentKey: "help.manual.drift_bottle_desc")
                manualSection(icon: "checklist", color: .teal, titleKey: "help.manual.daily_tasks_title", contentKey: "help.manual.daily_tasks_desc")
                manualSection(icon: "person.2.fill", color: .mint, titleKey: "help.manual.social_title", contentKey: "help.manual.social_desc")
                manualSection(icon: "chart.bar.fill", color: .indigo, titleKey: "help.manual.leaderboard_title", contentKey: "help.manual.leaderboard_desc")
                manualSection(icon: "person.crop.circle.badge.plus", color: .mint, titleKey: "help.manual.invite_title", contentKey: "help.manual.invite_desc")
                manualSection(icon: "gearshape.fill", color: .gray, titleKey: "help.manual.settings_title", contentKey: "help.manual.settings_desc")
            }
            .padding()
            .padding(.bottom, 80)
        }
    }

    private func manualSection(icon: String, color: Color, titleKey: String, contentKey: String) -> some View {
        DisclosureGroup {
            Text(NSLocalizedString(contentKey, comment: ""))
                .font(.body)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .frame(width: 24)
                Text(NSLocalizedString(titleKey, comment: ""))
                    .font(.headline)
            }
        }
    }
}

struct FeedbackSubmissionView: View {
    @State private var content: String = ""
    @State private var contact: String = ""
    @State private var isSubmitting = false
    @State private var showSuccess = false
    
    var body: some View {
        Form {
            Section(header: Text(NSLocalizedString("help.feedback.section", comment: "Your feedback"))) {
                TextEditor(text: $content)
                    .frame(height: 150)
                    .overlay(
                        Text(NSLocalizedString("help.feedback.placeholder", comment: "Feedback placeholder"))
                            .foregroundColor(.gray.opacity(0.5))
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .opacity(content.isEmpty ? 1 : 0)
                        , alignment: .topLeading
                    )
            }
            
            Section(header: Text(NSLocalizedString("help.feedback.contact_title", comment: "Contact info"))) {
                TextField(NSLocalizedString("help.feedback.contact_placeholder", comment: "Contact placeholder"), text: $contact)
            }
            
            Section {
                Button(action: submitFeedback) {
                    if isSubmitting {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else {
                        Text(NSLocalizedString("help.feedback.submit", comment: "Submit feedback"))
                            .frame(maxWidth: .infinity)
                            .foregroundColor(.blue)
                    }
                }
                .disabled(content.isEmpty || isSubmitting)
            }
        }
        .alert(NSLocalizedString("help.feedback.success_title", comment: "Success title"), isPresented: $showSuccess) {
            Button(NSLocalizedString("common.confirm", comment: "Confirm")) {
                content = ""
                contact = ""
            }
        } message: {
            Text(NSLocalizedString("help.feedback.success_message", comment: "Success message"))
        }
    }
    
    private func submitFeedback() {
        isSubmitting = true
        Task {
            // Simulate network
            try? await Task.sleep(nanoseconds: 1 * 1_000_000_000)

            await MainActor.run {
                isSubmitting = false
                showSuccess = true

                // ✨ Success feedback
                SoundManager.shared.playSuccess()
                HapticManager.shared.notification(type: .success)
            }
        }
    }
}

#Preview {
    NavigationView {
        HelpFeedbackView()
    }
}
