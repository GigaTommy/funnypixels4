import Foundation
import Combine
import SwiftUI

@MainActor
final class LocalizationManager: ObservableObject {
    static let shared = LocalizationManager()

    static let languageChangedNotification = Notification.Name("LocalizationLanguageChanged")

    static let supportedLanguages: [(code: String, name: String, nativeName: String)] = [
        ("en", "English", "English"),
        ("zh-Hans", "Chinese (Simplified)", "简体中文"),
        ("ja", "Japanese", "日本語"),
        ("ko", "Korean", "한국어"),
        ("es", "Spanish", "Español"),
        ("pt-BR", "Portuguese (Brazil)", "Português (Brasil)")
    ]

    @Published private(set) var currentLanguage: String
    @Published private(set) var locale: Locale

    /// The raw stored preference (nil or "system" means follow-system).
    var storedLanguagePreference: String? {
        userDefaults.string(forKey: languageKey)
    }

    var currentLanguageDisplayName: String {
        Self.supportedLanguages.first(where: { $0.code == currentLanguage })?.nativeName ?? currentLanguage
    }

    var isRTL: Bool {
        Locale.Language(identifier: currentLanguage).characterDirection == .rightToLeft
    }

    /// Thread-safe accessor for the current language, suitable for use from non-MainActor contexts
    /// (e.g., network request headers). Reads from UserDefaults which is itself thread-safe.
    nonisolated static var currentLanguageForHeaders: String {
        resolveLanguage(UserDefaults.standard.string(forKey: "app_language"))
    }

    private let apiService = LocalizationAPIService.shared
    private let userDefaults = UserDefaults.standard
    private let cacheDirectoryName = "localization"
    private let languageKey = "app_language"
    private let versionKeyPrefix = "localization_version_"

    private var cachedStrings: [String: String] = [:]

    private init() {
        let resolved = LocalizationManager.resolveLanguage(userDefaults.string(forKey: languageKey))
        currentLanguage = resolved
        locale = Locale(identifier: resolved)
        Bundle.setLanguage(resolved)
        loadCachedStrings(for: resolved)

        Task {
            await refreshRemoteBundleIfNeeded()
        }
    }

    nonisolated static func resolveLanguage(_ stored: String?) -> String {
        if let stored = stored, !stored.isEmpty, stored != "system" {
            return stored
        }

        let preferred = Locale.preferredLanguages.first ?? "en"
        if Bundle.bundleForLanguage(preferred) != nil {
            return preferred
        }

        if let base = preferred.split(separator: "-").first,
           Bundle.bundleForLanguage(String(base)) != nil {
            return String(base)
        }

        return "en"
    }

    func setLanguage(_ language: String?) {
        let value = language ?? "system"
        userDefaults.setValue(value, forKey: languageKey)

        let resolved = LocalizationManager.resolveLanguage(language)
        guard resolved != currentLanguage else { return }

        currentLanguage = resolved
        locale = Locale(identifier: resolved)
        Bundle.setLanguage(resolved)
        loadCachedStrings(for: resolved)

        NotificationCenter.default.post(name: Self.languageChangedNotification, object: nil)

        Task {
            await refreshRemoteBundleIfNeeded()
        }
    }

    func localizedString(_ key: String, _ args: [CVarArg] = []) -> String {
        let value = cachedStrings[key] ?? Bundle.main.localizedString(forKey: key, value: nil, table: nil)
        if args.isEmpty {
            return value
        }
        return String(format: value, locale: locale, arguments: args)
    }

    func localizedPlural(_ key: String, count: Int) -> String {
        // .stringsdict is handled natively by Bundle, so try Bundle first for proper plural rules
        let bundleFormat = Bundle.main.localizedString(forKey: key, value: "\u{0}", table: nil)
        if bundleFormat != "\u{0}" {
            return String.localizedStringWithFormat(bundleFormat, count)
        }
        // Fall back to remote cached strings
        if let cached = cachedStrings[key] {
            return String(format: cached, locale: locale, count)
        }
        return String(format: key, count)
    }

    func refreshRemoteBundleIfNeeded() async {
        let language = currentLanguage
        let currentVersion = userDefaults.integer(forKey: versionKeyPrefix + language)

        do {
            let response = try await apiService.fetchBundle(lang: language, version: currentVersion > 0 ? currentVersion : nil)
            if response.notModified == true {
                return
            }
            guard let strings = response.strings else {
                return
            }
            let cache = LocalizationCache(lang: response.lang, version: response.version, updatedAt: response.updatedAt, strings: strings)
            saveCache(cache)
            // Only apply if the language hasn't changed while we were fetching
            guard language == currentLanguage else { return }
            cachedStrings = strings
            userDefaults.setValue(response.version, forKey: versionKeyPrefix + language)
        } catch {
            // Best-effort; keep existing cache
        }
    }

    private func cacheDirectoryURL() -> URL? {
        let fileManager = FileManager.default
        guard let base = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        return base.appendingPathComponent(cacheDirectoryName, isDirectory: true)
    }

    private func cacheFileURL(for language: String) -> URL? {
        return cacheDirectoryURL()?.appendingPathComponent("localization_\(language).json")
    }

    private func loadCachedStrings(for language: String) {
        guard let url = cacheFileURL(for: language) else {
            cachedStrings = [:]
            return
        }
        do {
            let data = try Data(contentsOf: url)
            let cache = try JSONDecoder().decode(LocalizationCache.self, from: data)
            cachedStrings = cache.strings
        } catch {
            cachedStrings = [:]
        }
    }

    private func saveCache(_ cache: LocalizationCache) {
        guard let directory = cacheDirectoryURL(), let url = cacheFileURL(for: cache.lang) else {
            return
        }

        let fileManager = FileManager.default
        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
            let data = try JSONEncoder().encode(cache)
            try data.write(to: url, options: [.atomic])
        } catch {
            // Best-effort
        }
    }
}
