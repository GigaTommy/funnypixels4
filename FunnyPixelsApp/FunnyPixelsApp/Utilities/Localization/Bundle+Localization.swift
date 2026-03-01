import Foundation
import ObjectiveC

private var localizationBundleKey: UInt8 = 0

final class LocalizedBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let language = objc_getAssociatedObject(self, &localizationBundleKey) as? String {
            if let bundle = Bundle.bundleForLanguage(language) {
                return bundle.localizedString(forKey: key, value: value, table: tableName)
            }
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

extension Bundle {
    static func setLanguage(_ language: String?) {
        objc_setAssociatedObject(Bundle.main, &localizationBundleKey, language, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        object_setClass(Bundle.main, LocalizedBundle.self)
    }

    nonisolated static func bundleForLanguage(_ language: String) -> Bundle? {
        if let path = Bundle.main.path(forResource: language, ofType: "lproj"),
           let bundle = Bundle(path: path) {
            return bundle
        }

        if let baseLanguage = language.split(separator: "-").first {
            let fallback = String(baseLanguage)
            if let path = Bundle.main.path(forResource: fallback, ofType: "lproj"),
               let bundle = Bundle(path: path) {
                return bundle
            }
        }

        return nil
    }
}
