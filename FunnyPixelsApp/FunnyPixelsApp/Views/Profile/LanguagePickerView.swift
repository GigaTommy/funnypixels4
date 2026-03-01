import SwiftUI

struct LanguagePickerView: View {
    @ObservedObject private var localizationManager = LocalizationManager.shared
    @State private var selectedLanguage: String?
    @State private var showRestartHint = false

    private let systemOption = "system"

    var body: some View {
        List {
            Section {
                languageRow(
                    code: systemOption,
                    name: NSLocalizedString("settings.language.system", comment: ""),
                    nativeName: NSLocalizedString("settings.language.system", comment: "")
                )
            }

            Section {
                ForEach(LocalizationManager.supportedLanguages, id: \.code) { lang in
                    languageRow(code: lang.code, name: lang.name, nativeName: lang.nativeName)
                }
            }

            if showRestartHint {
                Section {
                    Text(NSLocalizedString("settings.language.restart_hint", comment: ""))
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .navigationTitle(NSLocalizedString("settings.language", comment: ""))
        .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
        .onAppear {
            let stored = localizationManager.storedLanguagePreference
            selectedLanguage = (stored == nil || stored == "system") ? systemOption : stored
        }
    }

    @ViewBuilder
    private func languageRow(code: String, name: String, nativeName: String) -> some View {
        Button {
            let previous = selectedLanguage
            selectedLanguage = code
            localizationManager.setLanguage(code == systemOption ? nil : code)
            if previous != code {
                showRestartHint = true
            }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(nativeName)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textPrimary)
                    if code != systemOption && name != nativeName {
                        Text(name)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
                Spacer()
                if selectedLanguage == code {
                    Image(systemName: "checkmark")
                        .foregroundColor(AppColors.primary)
                        .font(.body.weight(.semibold))
                }
            }
        }
    }
}
