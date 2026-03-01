import Foundation

// MARK: - Standard API Response Structure

/// 标准API响应结构
/// 所有API响应都应该使用这个统一的结构
public struct StandardResponse<T: Codable>: Codable {
    public let success: Bool
    public let message: String?
    public let data: T?
    public let errors: [String]?

    /// 计算属性：检查响应是否成功
    public var isSuccess: Bool {
        return success && errors?.isEmpty != false
    }

    /// 计算属性：获取错误信息
    var errorMessage: String? {
        if let errors = errors, !errors.isEmpty {
            return errors.joined(separator: ", ")
        }
        return message
    }
}

/// 分页响应结构
struct PaginatedResponse<T: Codable>: Codable {
    let success: Bool
    let message: String?
    let data: [T]
    let pagination: PaginationInfo
    let errors: [String]?

    /// 计算属性：检查响应是否成功
    var isSuccess: Bool {
        return success && errors?.isEmpty != false
    }

    /// 计算属性：获取错误信息
    var errorMessage: String? {
        if let errors = errors, !errors.isEmpty {
            return errors.joined(separator: ", ")
        }
        return message
    }
}

/// 分页信息
public struct PaginationInfo: Codable {
    public let page: Int
    public let limit: Int
    public let total: Int
    public let totalPages: Int
    public let hasNext: Bool
    public let hasPrev: Bool

    public enum CodingKeys: String, CodingKey {
        case page, limit, total
        case totalPages = "total_pages"
        case hasNext = "has_next"
        case hasPrev = "has_prev"
    }
}

// MARK: - Error Response Models

/// API错误响应
struct APIErrorResponse: Codable {
    let success: Bool
    let message: String
    let errors: [String]?
    let code: String?
    let timestamp: String?

    /// 计算属性：获取完整错误信息
    var fullErrorMessage: String {
        if let errors = errors, !errors.isEmpty {
            return "\(message): \(errors.joined(separator: ", "))"
        }
        return message
    }
}

/// 验证错误详情
struct ValidationError: Codable {
    let field: String
    let message: String
    let code: String?
}

/// 详细验证错误响应
struct ValidationErrorResponse: Codable {
    let success: Bool
    let message: String
    let errors: [ValidationError]
    let timestamp: String?
}

// MARK: - Success Response Models

/// 简单成功响应
struct SuccessResponse: Codable {
    let success: Bool
    let message: String

    init(message: String) {
        self.success = true
        self.message = message
    }
}

/// 带数据的成功响应
struct DataResponse<T: Codable>: Codable {
    let success: Bool
    let message: String?
    let data: T

    init(data: T, message: String? = nil) {
        self.success = true
        self.message = message
        self.data = data
    }
}

/// 操作结果响应
struct OperationResult: Codable {
    let success: Bool
    let message: String
    let affectedCount: Int?

    enum CodingKeys: String, CodingKey {
        case success, message
        case affectedCount = "affected_count"
    }
}

// MARK: - Authentication Response Models

/// 登录响应
struct LoginResponse: Codable {
    let success: Bool
    let message: String?
    let data: AuthData?
    let errors: [String]?
}

/// 认证数据
struct AuthData: Codable {
    let user: AuthUser
    let token: String
    let refreshToken: String
    let expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case user, token
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

/// Token刷新响应
struct TokenRefreshResponse: Codable {
    let success: Bool
    let message: String?
    let data: TokenData?
    let errors: [String]?
}

/// Token数据
struct TokenData: Codable {
    let token: String
    let refreshToken: String
    let expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case token
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

// MARK: - File Upload Response Models

/// 文件上传响应
struct FileUploadResponse: Codable {
    let success: Bool
    let message: String?
    let data: FileData?
    let errors: [String]?
}

/// 文件数据
struct FileData: Codable {
    let url: String
    let filename: String
    let size: Int
    let mimeType: String

    enum CodingKeys: String, CodingKey {
        case url, filename, size
        case mimeType = "mime_type"
    }
}

// MARK: - Batch Operation Response Models

/// 批量操作响应
struct BatchOperationResponse<T: Codable>: Codable {
    let success: Bool
    let message: String?
    let data: BatchData<T>?
    let errors: [String]?
}

/// 批量操作数据
struct BatchData<T: Codable>: Codable {
    let successful: [T]
    let failed: [FailedOperation]
    let totalCount: Int
    let successCount: Int
    let failureCount: Int

    enum CodingKeys: String, CodingKey {
        case successful, failed, totalCount
        case successCount = "success_count"
        case failureCount = "failure_count"
    }
}

/// 失败的操作
struct FailedOperation: Codable {
    let itemId: String?
    let error: String
    let code: String?

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id"
        case error, code
    }
}

// MARK: - Response Handler Protocol

/// API响应处理器协议
protocol ResponseHandler {
    associatedtype ResponseType: Codable

    func handleResponse(_ response: StandardResponse<ResponseType>) throws -> ResponseType
    func handleError(_ response: StandardResponse<ResponseType>) throws
}

/// 默认响应处理器
struct DefaultResponseHandler<T: Codable>: ResponseHandler {
    func handleResponse(_ response: StandardResponse<T>) throws -> T {
        guard response.isSuccess else {
            throw APIError.serverError(response.errorMessage ?? "Unknown error")
        }

        guard let data = response.data else {
            throw APIError.noData
        }

        return data
    }

    func handleError(_ response: StandardResponse<T>) throws {
        if let errorMessage = response.errorMessage {
            throw APIError.serverError(errorMessage)
        } else {
            throw APIError.unknownError
        }
    }
}

// MARK: - Response Utilities

/// 响应工具类
struct ResponseUtils {
    /// 验证标准响应
    static func validateResponse<T: Codable>(_ response: StandardResponse<T>) throws -> T {
        guard response.success else {
            let errorMessage = response.errorMessage ?? "请求失败"
            throw APIError.serverError(errorMessage)
        }

        guard let data = response.data else {
            throw APIError.noData
        }

        return data
    }

    /// 验证分页响应
    static func validatePaginatedResponse<T: Codable>(_ response: PaginatedResponse<T>) throws -> (data: [T], pagination: PaginationInfo) {
        guard response.isSuccess else {
            let errorMessage = response.errorMessage ?? "请求失败"
            throw APIError.serverError(errorMessage)
        }

        return (response.data, response.pagination)
    }

    /// 创建成功响应
    static func createSuccessResponse<T: Codable>(data: T, message: String? = nil) -> StandardResponse<T> {
        return StandardResponse(
            success: true,
            message: message,
            data: data,
            errors: nil
        )
    }

    /// 创建错误响应
    static func createErrorResponse<T: Codable>(message: String, errors: [String]? = nil) -> StandardResponse<T> {
        return StandardResponse(
            success: false,
            message: message,
            data: nil,
            errors: errors
        )
    }
}