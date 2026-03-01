
import Foundation

/// Helper for country code mapping and flag generation
class CountryCodeHelper {
    static let shared = CountryCodeHelper()
    
    // Mapping from common Chinese country names and aliases to ISO 3166-1 alpha-2 codes
    private let countryCodeMapping: [String: String] = [
        // 中文国家名
        "中国": "CN",
        "美国": "US",
        "日本": "JP",
        "韩国": "KR",
        "英国": "GB",
        "法国": "FR",
        "德国": "DE",
        "意大利": "IT",
        "西班牙": "ES",
        "俄罗斯": "RU",
        "加拿大": "CA",
        "澳大利亚": "AU",
        "巴西": "BR",
        "印度": "IN",
        "墨西哥": "MX",
        "阿根廷": "AR",
        "南非": "ZA",
        "新西兰": "NZ",
        "新加坡": "SG",
        "马来西亚": "MY",
        "泰国": "TH",
        "越南": "VN",
        "印度尼西亚": "ID",
        "菲律宾": "PH",
        "荷兰": "NL",
        "比利时": "BE",
        "瑞士": "CH",
        "奥地利": "AT",
        "瑞典": "SE",
        "挪威": "NO",
        "丹麦": "DK",
        "芬兰": "FI",
        "波兰": "PL",
        "捷克": "CZ",
        "匈牙利": "HU",
        "罗马尼亚": "RO",
        "保加利亚": "BG",
        "希腊": "GR",
        "葡萄牙": "PT",
        "土耳其": "TR",
        "以色列": "IL",
        "沙特阿拉伯": "SA",
        "阿联酋": "AE",
        "埃及": "EG",
        "尼日利亚": "NG",
        "肯尼亚": "KE",
        
        // 常见英文别名
        "china": "CN",
        "usa": "US",
        "uk": "GB",
        "england": "GB",
        "russia": "RU",
        "south korea": "KR",
        "north korea": "KP",
        "taiwan": "TW",
        "hong kong": "HK",
        "macau": "MO"
    ]
    
    private init() {}
    
    /// Normalize input to a valid ISO 3166-1 alpha-2 code
    func normalizeCountryCode(_ input: String?) -> String {
        guard let input = input, !input.isEmpty else {
            return "CN" // Default to China
        }
        
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let lowercased = trimmedInput.lowercased()
        
        // Check if it's already a 2-letter ISO code
        if trimmedInput.count == 2 && trimmedInput.rangeOfCharacter(from: CharacterSet.letters.inverted) == nil {
            return trimmedInput.uppercased()
        }
        
        // Lookup in mapping
        if let mapped = countryCodeMapping[trimmedInput] {
            return mapped
        }
        if let mapped = countryCodeMapping[lowercased] {
            return mapped
        }
        
        // Default
        return "CN"
    }
    
    /// Get flag emoji for a given input (code or name)
    func getFlagEmoji(for input: String?) -> String {
        let code = normalizeCountryCode(input)
        return code.countryFlag()
    }
}
