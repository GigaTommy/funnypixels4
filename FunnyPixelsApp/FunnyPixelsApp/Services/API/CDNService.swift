import Foundation

/// CDN / 文件上传服务
/// 负责处理直接上传到 S3/OSS 的逻辑
class CDNService {
    static let shared = CDNService()
    
    private init() {}
    
    // MARK: - API Response Models
    
    struct PresignedUrlResponse: Codable {
        let success: Bool?
        let ok: Bool? // Some endpoints use ok
        let data: PresignedUrlData?
        let error: String?
        
        var isSuccess: Bool {
            return ok == true || success == true
        }
        
        struct PresignedUrlData: Codable {
            let uploadUrl: String
            let publicUrl: String
            let key: String
            let validUntil: String?
        }
    }
    
    // MARK: - Public Methods
    
    /// 上传图片并获取可访问的 URL
    /// - Parameter data: 图片数据
    /// - Parameter contentType: 内容类型 (默认 image/jpeg)
    /// - Returns: 可访问的公共 URL
    func uploadImageAndGetUrl(data: Data, contentType: String = "image/jpeg") async throws -> String {
        // 1. 获取上传 URL
        let presignedData = try await getPresignedUploadUrl(contentType: contentType)
        
        // 2. 直接上传到 S3/OSS
        try await uploadToPresignedUrl(url: presignedData.uploadUrl, data: data, contentType: contentType)
        
        // 3. 返回公共访问 URL
        return presignedData.publicUrl
    }
    
    // MARK: - Internal Methods
    
    /// 获取预签名上传 URL
    private func getPresignedUploadUrl(contentType: String) async throws -> PresignedUrlResponse.PresignedUrlData {
        let path = "/images/upload-url"
        let parameters: [String: Any] = ["contentType": contentType]
        
        let response: PresignedUrlResponse = try await APIManager.shared.post(path, parameters: parameters)
        
        guard response.isSuccess, let data = response.data else {
             throw NetworkError.serverMessage(response.error ?? "获取上传地址失败")
        }
        
        return data
    }
    
    /// 上传数据到预签名 URL
    private func uploadToPresignedUrl(url: String, data: Data, contentType: String) async throws {
        guard let uploadUrl = URL(string: url) else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: uploadUrl)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        // 设置 Content-Length 通常由 URLSession 自动处理，但有些云存储可能需要
        request.setValue("\(data.count)", forHTTPHeaderField: "Content-Length")
        
        return try await withCheckedThrowingContinuation { continuation in
            let task = URLSession.shared.uploadTask(with: request, from: data) { _, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse {
                    if (200...299).contains(httpResponse.statusCode) {
                        continuation.resume(returning: ())
                    } else {
                        continuation.resume(throwing: NetworkError.serverMessage("上传失败: HTTP \(httpResponse.statusCode)"))
                    }
                } else {
                    continuation.resume(throwing: NetworkError.serverMessage("Invalid response"))
                }
            }
            task.resume()
        }
    }
}
