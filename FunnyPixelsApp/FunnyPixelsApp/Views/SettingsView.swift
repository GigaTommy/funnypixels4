import SwiftUI

// MARK: - Settings View

struct SettingsView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    @ObservedObject private var soundManager = SoundManager.shared

    var body: some View {
        Form {
            Section(NSLocalizedString("settings.display", comment: "")) {
                Picker(NSLocalizedString("settings.font_size", comment: ""), selection: $fontManager.currentSize) {
                    ForEach(AppFontSize.allCases) { size in
                        Text(size.displayName).tag(size)
                    }
                }
                .pickerStyle(.menu)

                // Show a preview of the text size
                VStack(alignment: .leading, spacing: 8) {
                    Text(NSLocalizedString("settings.preview", comment: ""))
                        .font(fontManager.scaledFont(.headline))
                    Text(NSLocalizedString("settings.font_desc", comment: ""))
                        .font(fontManager.scaledFont(.subheadline))
                        .foregroundColor(AppColors.textSecondary)
                }
                .padding(.vertical, 8)
            }

            Section(NSLocalizedString("settings.sound", comment: "")) {
                Toggle(isOn: Binding(
                    get: { !soundManager.isMuted },
                    set: { soundManager.isMuted = !$0 }
                )) {
                    Label(NSLocalizedString("settings.sound_effects", comment: ""), systemImage: soundManager.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        .font(fontManager.scaledFont(.body))
                }
            }
            
            Section(NSLocalizedString("settings.language", comment: "")) {
                NavigationLink(destination: LanguagePickerView()) {
                    HStack {
                        Label(NSLocalizedString("settings.language", comment: ""), systemImage: "globe")
                            .font(AppTypography.body())
                        Spacer()
                        Text(LocalizationManager.shared.currentLanguageDisplayName)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
            }

            Section(NSLocalizedString("settings.privacy", comment: "")) {
                NavigationLink(destination: PrivacySettingsView()) {
                    Label(NSLocalizedString("settings.pixel_privacy", comment: ""), systemImage: "hand.raised.fill")
                        .font(AppTypography.body())
                }
            }
            
            Section(NSLocalizedString("settings.about", comment: "")) {
                NavigationLink(destination: HelpFeedbackView()) {
                    Label(NSLocalizedString("settings.help", comment: ""), systemImage: "questionmark.circle.fill")
                        .font(AppTypography.body())
                }
                
                HStack {
                    Text(NSLocalizedString("settings.version", comment: ""))
                        .font(AppTypography.body())
                    Spacer()
                    Text("1.0.0 (Build 1)")
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .navigationTitle(NSLocalizedString("profile.settings", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
    }
}

// MARK: - Privacy Settings View

struct PrivacySettingsView: View {
    @State private var settings = PixelPrivacySettings()
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        Form {
            Section {
                Toggle(NSLocalizedString("privacy.hide_nickname", comment: ""), isOn: $settings.hide_nickname)
                Toggle(NSLocalizedString("privacy.hide_alliance", comment: ""), isOn: $settings.hide_alliance)
                Toggle(NSLocalizedString("privacy.hide_flag", comment: ""), isOn: $settings.hide_alliance_flag)
            } header: {
                Text(NSLocalizedString("privacy.shield_title", comment: ""))
            } footer: {
                Text(NSLocalizedString("privacy.shield_desc", comment: ""))
            }
            
            if let error = errorMessage {
                Section {
                    Text(error)
                        .foregroundColor(AppColors.error)
                }
            }
        }
        .navigationTitle(NSLocalizedString("privacy.title", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .overlay {
            if isLoading {
                ProgressView()
            }
        }
        .task {
            await loadSettings()
        }
        .onChange(of: settings) { oldValue, newValue in
            Task {
                await updateSettings(newValue)
            }
        }
    }
    
    private func loadSettings() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await SocialService.shared.getMyPrivacySettings()
            self.settings = response.settings
        } catch {
            self.errorMessage = NSLocalizedString("error.load_failed", comment: "") + ": \(error.localizedDescription)"
        }
    }
    
    private func updateSettings(_ newSettings: PixelPrivacySettings) async {
        do {
            _ = try await SocialService.shared.updatePrivacySettings(settings: newSettings)

            // ✨ Success feedback
            await MainActor.run {
                HapticManager.shared.notification(type: .success)
            }
        } catch {
            self.errorMessage = NSLocalizedString("error.update_failed", comment: "") + ": \(error.localizedDescription)"

            // ✨ Failure feedback
            await MainActor.run {
                SoundManager.shared.playFailure()
                HapticManager.shared.notification(type: .error)
            }
        }
    }
}
