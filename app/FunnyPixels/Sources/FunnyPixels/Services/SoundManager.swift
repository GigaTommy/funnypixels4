import SwiftUI
import AudioToolbox
import AVFoundation

class SoundManager {
    static let shared = SoundManager()

    @AppStorage("sound_effects") private var soundEnabled = true

    private init() {
        // ✅ 配置音频会话，使音效受系统音量控制
        configureAudioSession()
    }

    // MARK: - Audio Session Configuration

    /// 配置音频会话
    /// 使用 .ambient category，音效将：
    /// - ✅ 受系统铃声/提示音音量控制（而非媒体音量）
    /// - ✅ 不会中断其他应用的音乐播放
    /// - ✅ 可与其他音频共存
    private func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()

            // 设置为环境音频类别
            // .ambient: 音效受铃声音量控制，不打断其他应用音频
            try audioSession.setCategory(.ambient, mode: .default, options: [])

            // 激活音频会话
            try audioSession.setActive(true, options: [])

            #if DEBUG
            print("✅ SoundManager: Audio session configured (.ambient)")
            #endif
        } catch {
            print("❌ SoundManager: Failed to configure audio session - \(error.localizedDescription)")
        }
    }

    // MARK: - Sound Playback

    func playCheckinSuccess() {
        guard soundEnabled else { return }

        // 使用系统音效 1025 (Tock.caf)
        // 注意：系统音效会自动遵循 AVAudioSession category 设置
        AudioServicesPlaySystemSound(1025)
    }
}
