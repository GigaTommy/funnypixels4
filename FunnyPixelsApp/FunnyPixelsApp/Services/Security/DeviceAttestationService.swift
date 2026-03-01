import Foundation
import Combine
import DeviceCheck
import CryptoKit

/// 设备完整性验证服务
/// 使用 Apple App Attest API 验证设备真实性
class DeviceAttestationService {
    
    static let shared = DeviceAttestationService()
    
    private let service = DCAppAttestService.shared
    private let keyIdStorageKey = "com.funnypixels.attestation_key_id"
    
    private init() {}
    
    /// 检查设备是否支持认证
    var isSupported: Bool {
        return service.isSupported
    }
    
    /// 获取或生成 Attestation Key ID
    func getOrGenerateKeyId() async throws -> String {
        if let keyId = UserDefaults.standard.string(forKey: keyIdStorageKey) {
            return keyId
        }
        
        let keyId = try await service.generateKey()
        UserDefaults.standard.set(keyId, forKey: keyIdStorageKey)
        return keyId
    }
    
    /// 执行设备认证
    /// 1. 获取服务器挑战值 (Challenge)
    /// 2. 生成 Attestation Object
    /// 3. 发送回服务器验证
    func performAttestation() async throws {
        guard isSupported else {
            throw AttestationError.notSupported
        }
        
        let keyId = try await getOrGenerateKeyId()
        
        // 1. 获取 Challenge
        let challenge = try await fetchServerChallenge()
        let challengeData = Data(SHA256.hash(data: challenge.data(using: .utf8)!))
        
        // 2. 生成 Attestation
        let attestation = try await service.attestKey(keyId, clientDataHash: challengeData)
        
        // 3. 验证并注册
        try await verifyAndRegister(keyId: keyId, attestation: attestation, challenge: challenge)
    }
    
    /// 获取服务器 Challenge
    private func fetchServerChallenge() async throws -> String {
        // TODO: Replace with actual API call
        let url = URL(string: "\(AppConfig.apiBaseURL)/security/challenge")!
        let (data, _) = try await URLSession.shared.data(from: url)
        
        guard let response = try? JSONDecoder().decode(ChallengeResponse.self, from: data) else {
            throw AttestationError.networkError
        }
        return response.challenge
    }
    
    /// 发送 Attestation 到服务器验证
    private func verifyAndRegister(keyId: String, attestation: Data, challenge: String) async throws {
        let url = URL(string: "\(AppConfig.apiBaseURL)/security/attest")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: String] = [
            "keyId": keyId,
            "attestation": attestation.base64EncodedString(),
            "challenge": challenge
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AttestationError.verificationFailed
        }
    }
}

enum AttestationError: Error {
    case notSupported
    case networkError
    case verificationFailed
}

struct ChallengeResponse: Codable {
    let challenge: String
}
