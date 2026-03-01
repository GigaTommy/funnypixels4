import SwiftUI

enum LocalizedAsset {
    /// Returns a localized image name.
    /// Tries `{baseName}_{lang}`, falls back to `{baseName}_{baseLanguage}`, then `{baseName}`.
    static func imageName(_ baseName: String) -> String {
        let lang = LocalizationManager.shared.currentLanguage
        let localizedName = "\(baseName)_\(lang)"

        if UIImage(named: localizedName) != nil {
            return localizedName
        }

        let fallbackName = "\(baseName)_en"
        if UIImage(named: fallbackName) != nil {
            return fallbackName
        }

        return baseName
    }

    /// Returns a localized Image view for the given base name.
    static func image(_ baseName: String) -> Image {
        Image(imageName(baseName))
    }
}
