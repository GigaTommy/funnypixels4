import Foundation

/// API Error type alias for NetworkError
public typealias APIError = NetworkError

/// Network error types for FunnyPixels API
public enum NetworkError: LocalizedError {
    case invalidURL
    case noData
    case decodingFailed(any Error)
    case encodingFailed(any Error)
    case serverError(Int, String?)
    case serverMessage(String)
    case unauthorized
    case forbidden
    case notFound
    case networkError(String)
    case validationError(String)
    case networkUnavailable
    case timeout
    case unknown(any Error)
    case unknownError

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received from server"
        case .decodingFailed(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .encodingFailed(let error):
            return "Failed to encode request: \(error.localizedDescription)"
        case .serverError(let code, let message):
            if let message = message {
                return "Server error (\(code)): \(message)"
            }
            return "Server error: HTTP \(code)"
        case .serverMessage(let message):
            return message
        case .unauthorized:
            return "Unauthorized access. Please login again."
        case .forbidden:
            return "Access forbidden - insufficient permissions"
        case .notFound:
            return "Resource not found"
        case .networkError(let message):
            return message
        case .validationError(let message):
            return message
        case .networkUnavailable:
            return "Network is unavailable. Please check your internet connection."
        case .timeout:
            return "Request timed out. Please try again."
        case .unknown(let error):
            return "Unknown error: \(error.localizedDescription)"
        case .unknownError:
            return "Unknown error"
        }
    }

    public var recoverySuggestion: String? {
        switch self {
        case .unauthorized:
            return "Please login again to continue."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .notFound:
            return "The requested resource was not found."
        case .networkError:
            return "Check your internet connection and try again."
        case .validationError:
            return "Please check your input and try again."
        case .networkUnavailable:
            return "Check your internet connection and try again."
        case .timeout:
            return "The server took too long to respond. Please try again later."
        case .serverError(let code, _) where code >= 500:
            return "The server is experiencing issues. Please try again later."
        case .decodingFailed:
            return "The server response format is unexpected. Please contact support if the issue persists."
        default:
            return nil
        }
    }
}

// MARK: - Convenience Factory Methods

extension NetworkError {
    /// Create a server error with message
    public static func serverError(_ message: String) -> NetworkError {
        return .serverMessage(message)
    }
}
