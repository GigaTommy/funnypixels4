import Foundation
import AVFoundation

/// SoundManager 增强扩展
extension SoundManager {

    // MARK: - Enhanced Playback

    /// 播放指定音效
    /// - Parameter effect: 音效类型
    func play(_ effect: SoundEffect) {
        guard !isMuted else { return }

        let filename = effect.rawValue
        let fileExtension = effect.fileExtension

        guard let url = Bundle.main.url(forResource: filename, withExtension: fileExtension) else {
            Logger.warning("音效文件未找到: \(filename).\(fileExtension)")
            // 降级到系统音效
            playFallbackSound(for: effect)
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            player.volume = getVolume(for: effect.category)
            player.play()

            // 缓存 player（避免重复创建）
            players[filename] = player

            #if DEBUG
            Logger.debug("播放音效: \(effect.description)")
            #endif
        } catch {
            Logger.error("音效播放失败 \(filename): \(error)")
            playFallbackSound(for: effect)
        }
    }

    /// 降级到系统音效
    /// ✅ 改为播放触觉反馈，不再使用音频（因为音频文件缺失）
    private func playFallbackSound(for effect: SoundEffect) {
        guard !isMuted else { return }

        // 根据音效类型提供触觉反馈
        let hapticID: SystemSoundID
        switch effect.category {
        case .achievement, .social, .special:
            hapticID = 1519  // Peek (轻微震动)
        case .alert:
            hapticID = 1521  // Nope (警告震动)
        case .ui:
            hapticID = 1519  // Peek (轻微震动)
        }

        // 仅播放触觉反馈，不播放音效
        AudioServicesPlaySystemSound(hapticID)

        Logger.warning("⚠️ 音效文件缺失，使用触觉反馈代替: \(effect.rawValue)")
    }

    // MARK: - Volume Control

    /// 获取分类音量（支持分组控制）
    private func getVolume(for category: SoundCategory) -> Float {
        let key = "soundVolume_\(category.rawValue)"
        let volume = UserDefaults.standard.object(forKey: key) as? Double ?? 1.0
        return Float(volume)
    }

    // MARK: - Preloading

    /// 预加载音效（用于性能优化）
    func preloadSounds(_ effects: [SoundEffect]) {
        for effect in effects {
            let filename = effect.rawValue
            let fileExtension = effect.fileExtension

            guard let url = Bundle.main.url(forResource: filename, withExtension: fileExtension) else {
                continue
            }

            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()
                players[filename] = player
            } catch {
                Logger.error("预加载音效失败 \(filename): \(error)")
            }
        }
    }

    /// 停止所有音效
    func stopAll() {
        players.values.forEach { $0.stop() }
        players.removeAll()
    }

    // MARK: - Audio Session Configuration

    /// 配置音频会话
    func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            // ✅ 使用 .playback 类别 + .mixWithOthers 选项
            // 这样音效：
            // 1. 受系统音量键控制 ✅
            // 2. 不会打断其他应用的音乐 ✅
            // 3. 尊重静音开关 ✅
            try audioSession.setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try audioSession.setActive(true)

            Logger.info("✅ 音频会话已配置: .playback + .mixWithOthers")
        } catch {
            Logger.error("❌ 音频会话配置失败: \(error)")
        }
    }
}
