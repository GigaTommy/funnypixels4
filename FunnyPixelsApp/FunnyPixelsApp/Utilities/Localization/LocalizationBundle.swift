import Foundation

struct LocalizationBundleResponse: Codable {
    let lang: String
    let version: Int
    let fallback: String?
    let notModified: Bool?
    let updatedAt: String?
    let strings: [String: String]?

    enum CodingKeys: String, CodingKey {
        case lang
        case version
        case fallback
        case notModified = "not_modified"
        case updatedAt = "updated_at"
        case strings
    }
}

struct LocalizationCache: Codable {
    let lang: String
    let version: Int
    let updatedAt: String?
    let strings: [String: String]
}
