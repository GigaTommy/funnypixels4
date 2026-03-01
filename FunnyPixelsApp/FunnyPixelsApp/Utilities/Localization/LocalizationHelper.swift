import Foundation

/// LocalizationHelper - 提供从API响应中提取本地化消息的辅助方法
/// 支持从后端返回的 messageKey 或直接 message 中获取本地化文本
@MainActor
struct LocalizationHelper {

    // MARK: - Main Localization Methods

    /// 从API响应中提取本地化消息
    /// - Parameters:
    ///   - messageKey: API返回的本地化key (例如: "drift_bottle.error.no_quota")
    ///   - fallbackMessage: 备用消息（当key不存在时使用）
    ///   - params: 参数替换字典（支持整数和字符串）
    /// - Returns: 本地化后的字符串
    static func localize(messageKey: String?, fallbackMessage: String? = nil, params: [String: Any]? = nil) -> String {
        // 优先使用 messageKey
        if let key = messageKey, !key.isEmpty {
            let localizedString = LocalizationManager.shared.localizedString(key)

            // 如果找到了本地化字符串且不等于key本身
            if localizedString != key {
                return applyParams(to: localizedString, params: params)
            }
        }

        // 备用消息
        if let fallback = fallbackMessage, !fallback.isEmpty {
            return applyParams(to: fallback, params: params)
        }

        // 最后返回key本身（如果有的话）
        return messageKey ?? "Unknown error"
    }

    /// 简化版本：直接用key和可变参数
    /// - Parameters:
    ///   - key: 本地化key
    ///   - args: 可变参数列表（按顺序替换%@, %d等）
    /// - Returns: 本地化后的字符串
    static func localize(_ key: String, _ args: CVarArg...) -> String {
        let format = LocalizationManager.shared.localizedString(key)
        if args.isEmpty {
            return format
        }
        return String(format: format, locale: LocalizationManager.shared.locale, arguments: args)
    }

    // MARK: - Parameter Replacement

    /// 将参数替换到字符串中
    /// 支持的占位符：
    /// - {key} 或 %{key} - 字典key替换
    /// - %d - 整数
    /// - %@ - 字符串
    /// - %.1f - 浮点数
    private static func applyParams(to text: String, params: [String: Any]?) -> String {
        guard let params = params, !params.isEmpty else {
            return text
        }

        var result = text

        // 替换 {key} 或 %{key} 风格的占位符
        for (keyName, value) in params {
            let placeholders = ["{\(keyName)}", "%{\(keyName)}"]
            for placeholder in placeholders {
                result = result.replacingOccurrences(of: placeholder, with: String(describing: value))
            }
        }

        return result
    }

    // MARK: - API Response Helpers

    /// 从API响应JSON中提取本地化消息
    /// - Parameters:
    ///   - response: API响应字典
    ///   - defaultKey: 默认使用的key（如果响应中没有messageKey）
    /// - Returns: 本地化后的字符串
    static func extractMessage(from response: [String: Any], defaultKey: String? = nil) -> String {
        let messageKey = response["messageKey"] as? String
        let fallback = response["message"] as? String

        // 提取params（如果有）
        var params: [String: Any]? = nil
        if let data = response["data"] as? [String: Any] {
            params = data
        }

        return localize(messageKey: messageKey ?? defaultKey, fallbackMessage: fallback, params: params)
    }

    // MARK: - Drift Bottle Specific Helpers

    /// 格式化漂流瓶引导消息
    /// - Parameters:
    ///   - guidance: 引导对象（包含messageKey和data）
    /// - Returns: 格式化的本地化字符串
    static func formatGuidanceMessage(_ guidance: GuidanceMessage) -> String {
        return localize(messageKey: guidance.messageKey, params: guidance.data)
    }

    /// 格式化配额提示消息
    /// - Parameter quota: 配额对象
    /// - Returns: 格式化的配额描述
    static func formatQuotaMessage(_ quota: BottleQuota) -> String {
        if quota.totalAvailable == 0 {
            // ✅ 修复：检查 pixelsForNextBottle 是否大于 0
            if quota.pixelsForNextBottle > 0 {
                return localize("drift_bottle.quota.pixels_for_next", quota.pixelsForNextBottle)
            } else {
                return localize("drift_bottle.quota.total_available") + ": 0"
            }
        }

        return localize("drift_bottle.quota.total_available") + ": \(quota.totalAvailable)"
    }

    /// 格式化错误消息（从NetworkError）
    /// - Parameter error: 网络错误
    /// - Returns: 用户友好的错误消息
    static func formatError(_ error: Error) -> String {
        if let networkError = error as? NetworkError {
            switch networkError {
            // ✅ 修复：serverError 有两个参数 (code, message)
            case .serverError(_, let message):
                // 检查是否是messageKey格式
                if let msg = message, msg.starts(with: "drift_bottle.") {
                    return localize(messageKey: msg)
                }
                return message ?? networkError.errorDescription ?? "Server error"
            case .serverMessage(let message):
                // 检查是否是messageKey格式
                if message.starts(with: "drift_bottle.") {
                    return localize(messageKey: message)
                }
                return message
            case .networkUnavailable:  // ✅ 修复：使用正确的 case 名称
                return localize("common.error.no_internet", "No internet connection")
            case .noData:  // ✅ 修复：使用 noData 代替 invalidResponse
                return localize("common.error.invalid_response", "Invalid response")
            case .unauthorized:
                return localize("common.error.unauthorized", "Please login again")
            default:
                return networkError.errorDescription ?? error.localizedDescription
            }
        }

        return error.localizedDescription
    }
}

// MARK: - Supporting Models

/// 引导消息模型（与后端响应对应）
struct GuidanceMessage: Codable {
    let scenarioKey: String
    let messageKey: String
    let priority: Int
    let data: [String: Any]?

    enum CodingKeys: String, CodingKey {
        case scenarioKey, messageKey, priority, data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        scenarioKey = try container.decode(String.self, forKey: .scenarioKey)
        messageKey = try container.decode(String.self, forKey: .messageKey)
        priority = try container.decode(Int.self, forKey: .priority)

        // data可能是嵌套对象，需要特殊处理
        if let dataDict = try? container.decode([String: AnyCodable].self, forKey: .data) {
            data = dataDict.mapValues { $0.value }
        } else {
            data = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(scenarioKey, forKey: .scenarioKey)
        try container.encode(messageKey, forKey: .messageKey)
        try container.encode(priority, forKey: .priority)
        if let data = data {
            let codableData = data.mapValues { AnyCodable($0) }
            try container.encode(codableData, forKey: .data)
        }
    }
}

// MARK: - AnyCodable Helper

/// AnyCodable - 用于编解码任意类型的值
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported type")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Unsupported type"))
        }
    }
}
