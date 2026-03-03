import Foundation
import AVFoundation
import Combine
import AudioToolbox

/// Sound Manager for UI Feedback
/// Manages sound effects for the application
class SoundManager: ObservableObject {
    static let shared = SoundManager()

    private static let mutedKey = "soundEffectsMuted"
    private static let hasUserSetPreferenceKey = "soundEffectsHasUserSetPreference"

    @Published var isMuted: Bool {
        didSet {
            UserDefaults.standard.set(isMuted, forKey: Self.mutedKey)
            UserDefaults.standard.set(true, forKey: Self.hasUserSetPreferenceKey)
        }
    }

    var players: [String: AVAudioPlayer] = [:]  // internal access for extensions

    // ⚡ 节流控制：防止音效重叠
    private var lastPlayTime: [String: Date] = [:]
    private let throttleInterval: TimeInterval = 0.05  // 50ms 节流间隔

    private init() {
        // ✅ 默认静音，除非用户主动开启过
        let hasUserSetPreference = UserDefaults.standard.bool(forKey: Self.hasUserSetPreferenceKey)
        if hasUserSetPreference {
            // 用户已设置过偏好，使用保存的值
            self.isMuted = UserDefaults.standard.bool(forKey: Self.mutedKey)
        } else {
            // 首次使用，默认静音
            self.isMuted = true
        }
        configureAudioSession()  // ✅ 启动时配置音频会话
        preloadCommonSounds()     // ✅ 预加载常用音效
    }

    deinit {
        // 清理音频资源
        players.values.forEach { $0.stop() }
        players.removeAll()
    }

    // MARK: - 高性能音效预加载

    /// 预加载常用音效（启动时调用一次）
    /// ✅ 使用 AVAudioPlayer 预加载，确保受系统音量控制
    private func preloadCommonSounds() {
        let commonSounds = [
            "pixel_draw",      // 像素绘制（高频）
            "button_click",    // 按钮点击
            "success",         // 成功音效
            "error_gentle"     // 错误提示
        ]

        for soundName in commonSounds {
            guard let url = Bundle.main.url(forResource: soundName, withExtension: "m4a") else {
                Logger.warning("⚠️ 音效文件未找到: \(soundName).m4a")
                continue
            }

            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()  // 预加载到内存
                players[soundName] = player
                Logger.info("✅ 预加载音效: \(soundName)")
            } catch {
                Logger.error("❌ 预加载失败 \(soundName): \(error)")
            }
        }
    }

    // MARK: - 高性能播放方法

    /// 播放音效（高性能版本，使用AVAudioPlayer）
    /// - Parameters:
    ///   - soundName: 音效名称
    ///   - withThrottle: 是否启用节流（防止连续播放重叠）
    private func playSystemSoundFast(_ soundName: String, withThrottle: Bool = true) {
        guard !isMuted else { return }

        // 节流检查
        if withThrottle {
            let now = Date()
            if let lastTime = lastPlayTime[soundName],
               now.timeIntervalSince(lastTime) < throttleInterval {
                return  // 跳过，避免音效重叠
            }
            lastPlayTime[soundName] = now
        }

        // ✅ 使用 AVAudioPlayer 代替 AudioServicesPlaySystemSound
        // 优点：受系统音量控制，支持音量调节
        if let player = players[soundName] {
            // 使用预加载的 player
            player.currentTime = 0  // 重置播放位置
            player.play()
        } else {
            // 尝试加载并播放
            guard let url = Bundle.main.url(forResource: soundName, withExtension: "m4a") else {
                return  // 文件不存在，静默失败
            }

            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()
                player.play()
                players[soundName] = player  // 缓存以便复用
            } catch {
                Logger.error("Failed to play sound \(soundName): \(error)")
            }
        }
    }

    /// Play a system sound (simple beep/vibration)
    /// ⚠️ 已废弃：建议使用 play() 方法播放自定义音效
    @available(*, deprecated, message: "Use play() method with SoundEffect enum instead")
    func playSystemSound(id: SystemSoundID) {
        guard !isMuted else { return }
        // 仅保留触觉反馈功能
        if id >= 1519 && id <= 1521 {
            // 1519: Peek, 1520: Pop, 1521: Nope (触觉反馈)
            AudioServicesPlaySystemSound(id)
        }
    }

    /// Play a custom sound effect
    /// - Parameter name: Name of the sound file (without extension)
    /// - Parameter type: File extension (default: "m4a")
    func playSound(name: String, type: String = "m4a") {
        guard !isMuted else { return }

        guard let url = Bundle.main.url(forResource: name, withExtension: type) else {
            AudioServicesPlaySystemSound(1103) // Tink sound
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            player.play()
        } catch {
            Logger.error("Failed to play sound \(name): \(error)")
        }
    }

    /// Play success sound
    func playSuccess() {
        guard !isMuted else { return }
        // 使用 M4A 音效文件（AAC编码，体积更小）
        playSound(name: "success", type: "m4a")
    }

    /// Play failure sound
    func playFailure() {
        guard !isMuted else { return }
        // 使用温和错误音效（M4A格式）
        playSound(name: "error_gentle", type: "m4a")
    }

    /// Play pop sound (for drawing)
    /// ⚠️ 已废弃：使用 playPixelDraw() 代替（更高性能）
    @available(*, deprecated, message: "Use playPixelDraw() for better performance")
    func playPop() {
        playPixelDraw()
    }

    // MARK: - 专用音效方法

    /// 播放像素绘制音效（超高性能版本）
    /// ⚡ 特性：
    /// - 使用预加载的 SystemSoundID，延迟 <1ms
    /// - 自动节流，防止快速绘制时音效重叠
    /// - 功耗极低，CPU占用几乎为0
    func playPixelDraw() {
        playSystemSoundFast("pixel_draw", withThrottle: true)
    }

    /// 播放像素绘制音效（强制播放，无节流）
    /// 用于重要操作（如完成绘制、解锁成就）
    func playPixelDrawForce() {
        playSystemSoundFast("pixel_draw", withThrottle: false)
    }

    /// 播放GPS绘制开始音效
    /// 使用积极的音效表示开始绘制旅程
    func playGPSDrawingStart() {
        playSystemSoundFast("success", withThrottle: false)
    }

    /// 播放GPS绘制停止音效
    /// 使用中性的音效表示完成绘制
    func playGPSDrawingStop() {
        playSystemSoundFast("button_click", withThrottle: false)
    }
}
