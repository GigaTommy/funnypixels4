import Foundation
import SwiftUI
import Combine

#if canImport(RiveRuntime)
import RiveRuntime
#endif

/// 全局Rive动画管理器
/// 负责预加载、缓存和提供Rive动画ViewModel
@MainActor
class RiveAnimationManager: ObservableObject {
    static let shared = RiveAnimationManager()

    // MARK: - Animation File Names

    /// 动画文件名常量
    enum AnimationFile: String {
        case pixelDrop = "pixel_drop"
        case cooldownRing = "cooldown_ring"
        case achievementUnlock = "achievement_unlock"

        var fileName: String { rawValue }
    }

    // MARK: - State

    /// Rive是否可用（检测SDK是否已安装）
    @Published private(set) var isRiveAvailable: Bool = false

    #if canImport(RiveRuntime)
    /// 缓存的ViewModel（避免重复创建）
    private var cachedViewModels: [String: RiveViewModel] = [:]
    #endif

    private init() {
        detectRiveAvailability()
    }

    // MARK: - Public Methods

    /// App启动时预加载常用动画
    func preloadAnimations() {
        guard isRiveAvailable else {
            Logger.info("⚠️ Rive SDK not available, skipping animation preload")
            return
        }

        #if canImport(RiveRuntime)
        Logger.info("🎨 Preloading Rive animations...")

        // 预加载所有动画（非阻塞）
        Task {
            for animation in AnimationFile.allCases {
                _ = await getViewModel(for: animation)
            }
            Logger.info("✅ Rive animations preloaded")
        }
        #endif
    }

    /// 获取指定动画的ViewModel
    /// - Parameter animation: 动画类型
    /// - Returns: RiveViewModel或nil（如果Rive不可用）
    func getViewModel(for animation: AnimationFile) async -> Any? {
        guard isRiveAvailable else {
            Logger.warning("⚠️ Rive not available for animation: \(animation.fileName)")
            return nil
        }

        #if canImport(RiveRuntime)
        // 检查缓存
        if let cached = cachedViewModels[animation.fileName] {
            return cached
        }

        // 创建新的ViewModel
        do {
            let viewModel = try await createViewModel(for: animation)
            cachedViewModels[animation.fileName] = viewModel
            return viewModel
        } catch {
            Logger.error("❌ Failed to create Rive ViewModel for \(animation.fileName): \(error)")
            return nil
        }
        #else
        return nil
        #endif
    }

    /// 清除指定动画的缓存（内存优化）
    func clearCache(for animation: AnimationFile) {
        #if canImport(RiveRuntime)
        cachedViewModels.removeValue(forKey: animation.fileName)
        Logger.info("🗑️ Cleared Rive cache for: \(animation.fileName)")
        #endif
    }

    /// 清除所有缓存
    func clearAllCache() {
        #if canImport(RiveRuntime)
        cachedViewModels.removeAll()
        Logger.info("🗑️ Cleared all Rive animation cache")
        #endif
    }

    // MARK: - Private Methods

    private func detectRiveAvailability() {
        #if canImport(RiveRuntime)
        isRiveAvailable = true
        Logger.info("✅ Rive SDK detected and available")
        #else
        isRiveAvailable = false
        Logger.info("⚠️ Rive SDK not installed - animations will use fallback")
        #endif
    }

    #if canImport(RiveRuntime)
    private func createViewModel(for animation: AnimationFile) async throws -> RiveViewModel {
        // 尝试从Bundle加载.riv文件
        guard let url = Bundle.main.url(forResource: animation.fileName, withExtension: "riv") else {
            throw RiveError.fileNotFound(animation.fileName)
        }

        let data = try Data(contentsOf: url)
        let viewModel = RiveViewModel(riveFile: RiveFile(byteArray: [UInt8](data)))

        Logger.info("✅ Loaded Rive animation: \(animation.fileName)")
        return viewModel
    }
    #endif
}

// MARK: - AnimationFile CaseIterable

extension RiveAnimationManager.AnimationFile: CaseIterable {}

// MARK: - Errors

enum RiveError: LocalizedError {
    case fileNotFound(String)
    case sdkNotAvailable
    case invalidAnimation

    var errorDescription: String? {
        switch self {
        case .fileNotFound(let name):
            return "Rive animation file not found: \(name).riv"
        case .sdkNotAvailable:
            return "Rive SDK is not installed"
        case .invalidAnimation:
            return "Invalid Rive animation format"
        }
    }
}
