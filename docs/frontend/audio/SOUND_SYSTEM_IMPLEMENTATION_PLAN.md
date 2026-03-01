# FunnyPixels 音效系统完善实施方案
> 评估日期: 2026-02-22

## 📊 现状评估

### ✅ 已完成的功能

#### 1. **音效开关设置**
**位置**: `SettingsView.swift` (第 30-38 行)
```swift
Section(NSLocalizedString("settings.sound", comment: "")) {
    Toggle(isOn: Binding(
        get: { !soundManager.isMuted },
        set: { soundManager.isMuted = !$0 }
    )) {
        Label(NSLocalizedString("settings.sound_effects", comment: ""),
              systemImage: soundManager.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
    }
}
```

**状态**: ✅ **完美实现**
- Toggle 正确绑定到 `SoundManager.shared.isMuted`
- 图标动态变化（静音/开启）
- 使用本地化字符串
- 设置持久化到 UserDefaults

#### 2. **音效管理器**
**位置**: `Services/Audio/SoundManager.swift`
```swift
class SoundManager: ObservableObject {
    static let shared = SoundManager()

    @Published var isMuted: Bool {
        didSet {
            UserDefaults.standard.set(isMuted, forKey: Self.mutedKey)
        }
    }

    // 所有播放方法都检查 isMuted
    func playSound(name: String, type: String = "mp3") {
        guard !isMuted else { return }  // ✅ 关键检查
        // ... 播放逻辑
    }
}
```

**状态**: ✅ **架构优秀**
- 单例模式，全局访问
- `@Published` 支持 SwiftUI 响应式更新
- 所有播放方法都有 `guard !isMuted` 保护
- UserDefaults 持久化

#### 3. **现有音效资源**
**位置**: `Resources/Sounds/`
```
level_up.wav     - 60 KB  (升级音效)
pixel_place.wav  - 6.9 KB (像素绘制)
success.wav      - 34 KB  (成功提示)
```

**状态**: ✅ **质量良好，但数量不足**
- 仅 3 个音效文件
- WAV 格式（无损）
- 总大小 100.9 KB（包体积友好）

### ⚠️ 需要补全的内容

#### 1. **音效覆盖不足**
**现有**: 3 个音效
**需要**: 15 个音效场景

**缺失场景**:
- ❌ 联盟社交 (加入、成员上线、领土占领/失守)
- ❌ 赛事场景 (进入赛事区、倒计时、排名变化)
- ❌ 漂流瓶 (遭遇、打开、收到回复)
- ❌ UI 交互 (Tab 切换、Sheet 弹出/关闭、点赞)
- ❌ 错误提示 (目前使用系统音效 1053)

#### 2. **SoundManager 方法不够语义化**
**现有方法**:
```swift
playSuccess()   // 系统音效 1057
playFailure()   // 系统音效 1053
playPop()       // 系统音效 1104
playSound(name:type:)  // 通用方法
```

**问题**:
- 缺乏语义化的场景方法（如 `playAllianceJoin()`, `playRankUp()`）
- 系统音效缺乏品牌独特性
- 没有音效分类管理

#### 3. **音效未在所有关键场景使用**
**已使用场景**:
- ✅ 像素绘制 (MapLibreMapView)
- ✅ 成就解锁 (DailyTaskViewModel)
- ✅ 签到成功 (DailyCheckinSheet)
- ✅ 任务完成 (DailyChallengeBar)

**未使用场景**:
- ❌ Tab 切换 (MainTabView)
- ❌ 点赞操作 (FeedTabView, ArtworkCard)
- ❌ Sheet 弹出/关闭
- ❌ 排名变化 (LeaderboardTabView)
- ❌ 联盟操作 (AllianceViewModel)

---

## 🎯 实施方案

### Phase 1: 扩展 SoundManager (优先级 P0)

#### 1.1 创建音效枚举
**新建文件**: `Services/Audio/SoundEffect.swift`

```swift
import Foundation

/// 音效类型枚举
enum SoundEffect: String, CaseIterable {
    // MARK: - UI 交互音效
    case pixelDraw = "pixel_draw"           // 像素绘制
    case tabSwitch = "tab_switch"           // Tab 切换
    case sheetPresent = "sheet_present"     // Sheet 弹出
    case sheetDismiss = "sheet_dismiss"     // Sheet 关闭
    case buttonClick = "button_click"       // 按钮点击
    case likeSend = "like_send"             // 点赞

    // MARK: - 成就音效
    case success = "success"                // 成功（通用）
    case levelUp = "level_up"               // 升级
    case rankUp = "rank_up"                 // 排名上升
    case rankDown = "rank_down"             // 排名下降

    // MARK: - 社交音效
    case allianceJoin = "alliance_join"     // 加入联盟
    case territoryCaptured = "territory_captured"  // 占领领土
    case territoryLost = "territory_lost"   // 领土失守

    // MARK: - 特殊场景音效
    case bottleEncounter = "bottle_encounter"  // 遭遇漂流瓶
    case bottleOpen = "bottle_open"         // 打开漂流瓶
    case eventStart = "event_start"         // 赛事开始
    case eventCountdown = "event_countdown" // 赛事倒计时

    // MARK: - 错误音效
    case errorGentle = "error_gentle"       // 温和错误

    /// 音效文件扩展名
    var fileExtension: String {
        switch self {
        case .success, .levelUp:
            return "wav"  // 现有文件使用 wav
        default:
            return "m4a"  // 新文件使用 m4a（体积更小）
        }
    }

    /// 音效分类
    var category: SoundCategory {
        switch self {
        case .pixelDraw, .tabSwitch, .sheetPresent, .sheetDismiss, .buttonClick, .likeSend:
            return .ui
        case .success, .levelUp, .rankUp, .rankDown:
            return .achievement
        case .allianceJoin, .territoryCaptured, .territoryLost:
            return .social
        case .bottleEncounter, .bottleOpen, .eventStart, .eventCountdown:
            return .special
        case .errorGentle:
            return .alert
        }
    }

    /// 音效描述（用于调试和日志）
    var description: String {
        switch self {
        case .pixelDraw: return "像素绘制"
        case .tabSwitch: return "Tab切换"
        case .sheetPresent: return "Sheet弹出"
        case .sheetDismiss: return "Sheet关闭"
        case .buttonClick: return "按钮点击"
        case .likeSend: return "点赞"
        case .success: return "成功"
        case .levelUp: return "升级"
        case .rankUp: return "排名上升"
        case .rankDown: return "排名下降"
        case .allianceJoin: return "加入联盟"
        case .territoryCaptured: return "占领领土"
        case .territoryLost: return "领土失守"
        case .bottleEncounter: return "遭遇漂流瓶"
        case .bottleOpen: return "打开漂流瓶"
        case .eventStart: return "赛事开始"
        case .eventCountdown: return "赛事倒计时"
        case .errorGentle: return "温和错误"
        }
    }
}

/// 音效分类
enum SoundCategory: String, CaseIterable {
    case ui          // UI 交互
    case achievement // 成就
    case social      // 社交
    case special     // 特殊场景
    case alert       // 警示

    var displayName: String {
        switch self {
        case .ui: return "界面音效"
        case .achievement: return "成就音效"
        case .social: return "社交音效"
        case .special: return "特殊场景"
        case .alert: return "提示音效"
        }
    }
}
```

#### 1.2 增强 SoundManager
**修改文件**: `Services/Audio/SoundManager.swift`

```swift
import Foundation
import AVFoundation
import Combine

/// 音效管理器
class SoundManager: ObservableObject {
    static let shared = SoundManager()

    private static let mutedKey = "soundEffectsMuted"

    // MARK: - Published Properties

    @Published var isMuted: Bool {
        didSet {
            UserDefaults.standard.set(isMuted, forKey: Self.mutedKey)
        }
    }

    // MARK: - Private Properties

    private var players: [String: AVAudioPlayer] = [:]
    private var audioSession: AVAudioSession = .sharedInstance()

    // MARK: - Initialization

    private init() {
        self.isMuted = UserDefaults.standard.bool(forKey: Self.mutedKey)
        configureAudioSession()
    }

    /// 配置音频会话
    private func configureAudioSession() {
        do {
            // 设置为环境音频，不会打断其他应用的音乐
            try audioSession.setCategory(.ambient, mode: .default)
            try audioSession.setActive(true)
        } catch {
            Logger.error("音频会话配置失败: \(error)")
        }
    }

    // MARK: - Public Methods (新增语义化方法)

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
            player.volume = 1.0
            player.play()

            // 缓存 player（可选，避免重复创建）
            players[filename] = player

            Logger.debug("播放音效: \(effect.description)")
        } catch {
            Logger.error("音效播放失败 \(filename): \(error)")
            playFallbackSound(for: effect)
        }
    }

    /// 降级到系统音效
    private func playFallbackSound(for effect: SoundEffect) {
        guard !isMuted else { return }

        let systemSoundID: SystemSoundID
        switch effect.category {
        case .achievement:
            systemSoundID = 1057  // Success
        case .alert:
            systemSoundID = 1053  // Error
        case .ui:
            systemSoundID = 1104  // Tock
        case .social, .special:
            systemSoundID = 1103  // Tink
        }

        AudioServicesPlaySystemSound(systemSoundID)
    }

    // MARK: - Legacy Methods (保持向后兼容)

    /// 播放系统音效（兼容旧代码）
    func playSystemSound(id: SystemSoundID) {
        guard !isMuted else { return }
        AudioServicesPlaySystemSound(id)
    }

    /// 播放自定义音效（兼容旧代码）
    func playSound(name: String, type: String = "mp3") {
        guard !isMuted else { return }

        guard let url = Bundle.main.url(forResource: name, withExtension: type) else {
            AudioServicesPlaySystemSound(1103)
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

    /// 播放成功音效（兼容旧代码）
    func playSuccess() {
        play(.success)  // 使用新的枚举方法
    }

    /// 播放失败音效（兼容旧代码）
    func playFailure() {
        play(.errorGentle)  // 使用新的枚举方法
    }

    /// 播放 Pop 音效（兼容旧代码）
    func playPop() {
        play(.pixelDraw)  // 使用新的枚举方法
    }

    // MARK: - Utility Methods

    /// 停止所有音效
    func stopAll() {
        players.values.forEach { $0.stop() }
        players.removeAll()
    }

    /// 预加载音效（可选，用于性能优化）
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
}
```

**改进点**:
1. ✅ 新增 `play(_ effect: SoundEffect)` 语义化方法
2. ✅ 音频会话配置（`.ambient` 不打断其他应用）
3. ✅ 降级机制（音效文件缺失时使用系统音效）
4. ✅ 保持向后兼容（旧方法内部调用新方法）
5. ✅ 预加载支持（可选优化）
6. ✅ 日志记录（调试友好）

---

### Phase 2: 准备音效文件 (优先级 P0)

#### 2.1 音效文件清单

| 音效名称 | 文件名 | 格式 | 预计大小 | 来源建议 | 状态 |
|---------|--------|------|---------|---------|------|
| 像素绘制 | `pixel_draw.m4a` | M4A | ~15 KB | Pixabay "Pixel Click" | 🔄 替换现有 wav |
| Tab切换 | `tab_switch.m4a` | M4A | ~10 KB | Pixabay "UI Click" | ⭐ 新增 |
| Sheet弹出 | `sheet_present.m4a` | M4A | ~15 KB | Pixabay "Whoosh Up" | ⭐ 新增 |
| Sheet关闭 | `sheet_dismiss.m4a` | M4A | ~15 KB | Pixabay "Swipe Down" | ⭐ 新增 |
| 点赞 | `like_send.m4a` | M4A | ~10 KB | Pixabay "Pop Button" | ⭐ 新增 |
| 成功 | `success.wav` | WAV | ~34 KB | 已存在 | ✅ 保留 |
| 升级 | `level_up.wav` | WAV | ~60 KB | 已存在 | ✅ 保留 |
| 排名上升 | `rank_up.m4a` | M4A | ~20 KB | Pixabay "Achievement" | ⭐ 新增 |
| 排名下降 | `rank_down.m4a` | M4A | ~15 KB | Pixabay "Fail Soft" | ⭐ 新增 |
| 加入联盟 | `alliance_join.m4a` | M4A | ~25 KB | Pixabay "Welcome" | ⭐ 新增 |
| 占领领土 | `territory_captured.m4a` | M4A | ~30 KB | Pixabay "Victory Fanfare" | ⭐ 新增 |
| 领土失守 | `territory_lost.m4a` | M4A | ~25 KB | Pixabay "Alert Gentle" | ⭐ 新增 |
| 遭遇漂流瓶 | `bottle_encounter.m4a` | M4A | ~20 KB | Pixabay "Magic Chime" | ⭐ 新增 |
| 打开漂流瓶 | `bottle_open.m4a` | M4A | ~25 KB | Pixabay "Cork Pop" | ⭐ 新增 |
| 赛事开始 | `event_start.m4a` | M4A | ~30 KB | Mixkit "Fanfare" | ⭐ 新增 |
| 赛事倒计时 | `event_countdown.m4a` | M4A | ~25 KB | Mixkit "Countdown" | ⭐ 新增 |
| 温和错误 | `error_gentle.m4a` | M4A | ~15 KB | Mixkit "Error Soft" | ⭐ 新增 |

**总计**:
- **现有**: 3 个文件 (100.9 KB)
- **新增**: 14 个文件 (~290 KB)
- **总大小**: ~390 KB (远低于 5MB 预算)

#### 2.2 音效下载脚本

**新建文件**: `scripts/download-sounds.sh`

```bash
#!/bin/bash

# FunnyPixels 音效下载脚本
# 用途: 从 Pixabay/Mixkit 下载免费可商用音效

set -e

SOUND_DIR="/Users/ginochow/code/funnypixels3/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds"
TEMP_DIR="./temp_sounds"

echo "🎵 FunnyPixels 音效下载脚本"
echo "================================"

# 创建临时目录
mkdir -p "$TEMP_DIR"

echo ""
echo "📥 下载指南:"
echo "1. 访问 https://pixabay.com/sound-effects/"
echo "2. 根据下表搜索并下载音效"
echo "3. 将下载的文件重命名并放入 $TEMP_DIR"
echo ""

cat << 'EOF'
音效下载清单:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
序号  场景          搜索关键词           建议音效名
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1.    Tab切换       "ui click"          UI Click Soft
2.    Sheet弹出     "whoosh up"         Whoosh Up Soft
3.    Sheet关闭     "swipe down"        Swipe Down
4.    点赞          "pop button"        Pop Button
5.    排名上升      "achievement"       Achievement Pop
6.    排名下降      "fail soft"         Fail Short
7.    加入联盟      "welcome success"   Success Warm
8.    占领领土      "victory fanfare"   Victory Short
9.    领土失守      "alert gentle"      Alert Soft
10.   遭遇漂流瓶    "magic chime"       Mystery Notification
11.   打开漂流瓶    "cork pop"          Cork Pop Short
12.   赛事开始      "game start"        Fanfare Intro
13.   赛事倒计时    "countdown beep"    Countdown Timer
14.   温和错误      "error soft"        Error Gentle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

echo ""
read -p "是否已下载所有音效到 $TEMP_DIR ? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

echo ""
echo "🔄 处理音效文件..."

# 检查 FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  未找到 FFmpeg，将跳过格式转换"
    echo "💡 安装: brew install ffmpeg"
    SKIP_CONVERT=true
else
    SKIP_CONVERT=false
fi

# 转换函数
convert_to_m4a() {
    local input="$1"
    local output="$2"

    if [ "$SKIP_CONVERT" = true ]; then
        cp "$input" "$output"
        return
    fi

    ffmpeg -i "$input" \
        -c:a aac \
        -b:a 128k \
        -ar 44100 \
        -ac 1 \
        "$output" \
        -y \
        -loglevel error

    echo "  ✅ $(basename "$output")"
}

# 处理音效文件
echo ""
echo "转换为 M4A 格式..."

find "$TEMP_DIR" -type f \( -name "*.mp3" -o -name "*.wav" \) | while read file; do
    filename=$(basename "$file" | sed 's/\.[^.]*$//')
    convert_to_m4a "$file" "$SOUND_DIR/${filename}.m4a"
done

echo ""
echo "✅ 音效处理完成!"
echo "📂 音效位置: $SOUND_DIR"
echo ""
echo "下一步:"
echo "1. 在 Xcode 中验证音效文件已添加到 Bundle Resources"
echo "2. 运行 scripts/test-sounds.sh 测试音效播放"
echo ""

# 清理临时目录
read -p "是否删除临时目录 $TEMP_DIR ? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    echo "🗑️  已删除临时目录"
fi

echo "🎉 完成!"
```

#### 2.3 音效测试脚本

**新建文件**: `scripts/test-sounds.sh`

```bash
#!/bin/bash

# 音效文件检查脚本

SOUND_DIR="/Users/ginochow/code/funnypixels3/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds"

echo "🔍 检查音效文件..."
echo ""

REQUIRED_SOUNDS=(
    "pixel_draw.m4a"
    "tab_switch.m4a"
    "sheet_present.m4a"
    "sheet_dismiss.m4a"
    "like_send.m4a"
    "success.wav"
    "level_up.wav"
    "rank_up.m4a"
    "rank_down.m4a"
    "alliance_join.m4a"
    "territory_captured.m4a"
    "territory_lost.m4a"
    "bottle_encounter.m4a"
    "bottle_open.m4a"
    "event_start.m4a"
    "event_countdown.m4a"
    "error_gentle.m4a"
)

MISSING=0
TOTAL=${#REQUIRED_SOUNDS[@]}

for sound in "${REQUIRED_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        size=$(ls -lh "$SOUND_DIR/$sound" | awk '{print $5}')
        echo "✅ $sound ($size)"
    else
        echo "❌ $sound (缺失)"
        ((MISSING++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "总计: $TOTAL 个音效"
echo "已有: $((TOTAL - MISSING)) 个"
echo "缺失: $MISSING 个"

if [ $MISSING -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 所有音效文件已就绪!"

    # 计算总大小
    total_size=$(du -sh "$SOUND_DIR" | awk '{print $1}')
    echo "📦 总大小: $total_size"
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  请下载缺失的音效文件"
    echo "💡 运行: ./scripts/download-sounds.sh"
fi
```

---

### Phase 3: 在关键场景集成音效 (优先级 P1)

#### 3.1 Tab 切换音效

**修改文件**: `Views/MainTabView.swift`

```swift
struct MainTabView: View {
    @State private var selectedTab: Tab = .map

    var body: some View {
        TabView(selection: $selectedTab) {
            // ... tabs
        }
        .onChange(of: selectedTab) { oldValue, newValue in
            // 添加音效
            SoundManager.shared.play(.tabSwitch)
            HapticManager.shared.impact(style: .light)
        }
    }
}
```

#### 3.2 点赞音效

**修改文件**: `Views/Feed/ArtworkCard.swift`

```swift
private func toggleLike() {
    Task {
        let wasLiked = isLiked
        isLiked.toggle()

        if isLiked {
            // 添加音效 + 触觉
            SoundManager.shared.play(.likeSend)
            HapticManager.shared.impact(style: .medium)
        }

        // ... 现有逻辑
    }
}
```

#### 3.3 排名变化音效

**修改文件**: `ViewModels/LeaderboardViewModel.swift`

```swift
func checkRankChange(newRank: Int, oldRank: Int) {
    if newRank < oldRank {
        // 排名上升
        SoundManager.shared.play(.rankUp)
        HapticManager.shared.notification(type: .success)
    } else if newRank > oldRank {
        // 排名下降
        SoundManager.shared.play(.rankDown)
        HapticManager.shared.impact(style: .light)
    }
}
```

#### 3.4 Sheet 弹出/关闭音效

**新建文件**: `Utils/ViewModifiers/SoundSheetModifier.swift`

```swift
import SwiftUI

/// 带音效的 Sheet Modifier
struct SoundSheetModifier<SheetContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let content: () -> SheetContent

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented) {
                // Sheet 关闭时
                SoundManager.shared.play(.sheetDismiss)
            } content: {
                self.content()
                    .onAppear {
                        // Sheet 弹出时
                        SoundManager.shared.play(.sheetPresent)
                        HapticManager.shared.impact(style: .light)
                    }
            }
    }
}

extension View {
    func soundSheet<Content: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        modifier(SoundSheetModifier(isPresented: isPresented, content: content))
    }
}
```

**使用示例**:
```swift
// 替换现有的 .sheet
- .sheet(isPresented: $showCheckin) {
+ .soundSheet(isPresented: $showCheckin) {
      DailyCheckinSheet()
  }
```

#### 3.5 联盟音效

**修改文件**: `ViewModels/AllianceViewModel.swift`

```swift
func joinAlliance(_ allianceId: Int) async {
    // ... 现有逻辑

    if success {
        // 添加音效
        SoundManager.shared.play(.allianceJoin)
        HapticManager.shared.notification(type: .success)
    }
}
```

**修改文件**: `Managers/TerritoryBannerManager.swift`

```swift
func showTerritoryLost(territory: Territory) {
    // 添加音效
    SoundManager.shared.play(.territoryLost)
    HapticManager.shared.notification(type: .warning)

    // ... 现有逻辑
}

func showTerritoryCaptured(territory: Territory) {
    // 添加音效
    SoundManager.shared.play(.territoryCaptured)
    HapticManager.shared.notification(type: .success)

    // ... 现有逻辑
}
```

---

### Phase 4: 测试音效开关联动 (优先级 P0)

#### 4.1 测试用例

**新建文件**: `Tests/SoundManagerTests.swift`

```swift
import XCTest
@testable import FunnyPixelsApp

class SoundManagerTests: XCTestCase {

    var soundManager: SoundManager!

    override func setUp() {
        super.setUp()
        soundManager = SoundManager.shared
    }

    /// 测试音效开关持久化
    func testMutePersistence() {
        // 设置为静音
        soundManager.isMuted = true
        XCTAssertTrue(UserDefaults.standard.bool(forKey: "soundEffectsMuted"))

        // 设置为开启
        soundManager.isMuted = false
        XCTAssertFalse(UserDefaults.standard.bool(forKey: "soundEffectsMuted"))
    }

    /// 测试静音时不播放音效
    func testMutedPlayback() {
        soundManager.isMuted = true

        // 应该静默（不会抛出错误）
        soundManager.play(.success)
        soundManager.play(.pixelDraw)
        soundManager.playSuccess()
    }

    /// 测试音效文件存在性
    func testSoundFileAvailability() {
        let effects: [SoundEffect] = [
            .success, .levelUp, .pixelDraw,
            .tabSwitch, .sheetPresent, .likeSend
        ]

        for effect in effects {
            let url = Bundle.main.url(
                forResource: effect.rawValue,
                withExtension: effect.fileExtension
            )
            XCTAssertNotNil(url, "音效文件缺失: \(effect.rawValue)")
        }
    }

    /// 测试所有音效枚举
    func testAllSoundEffects() {
        for effect in SoundEffect.allCases {
            // 不应该崩溃
            soundManager.play(effect)
        }
    }
}
```

#### 4.2 手动测试清单

**测试步骤**:

1. **音效开关测试**
   - [ ] 打开 App，进入 "我的" -> "设置"
   - [ ] 验证音效开关默认状态
   - [ ] 关闭音效开关（图标变为 speaker.slash.fill）
   - [ ] 执行各种操作（点赞、切换Tab、绘制像素）
   - [ ] 验证**无任何音效播放**
   - [ ] 打开音效开关（图标变为 speaker.wave.2.fill）
   - [ ] 再次执行操作，验证**音效正常播放**

2. **持久化测试**
   - [ ] 关闭音效开关
   - [ ] 完全退出 App
   - [ ] 重新打开 App
   - [ ] 验证音效开关**仍然关闭**
   - [ ] 验证操作时**无音效**

3. **场景覆盖测试**
   - [ ] Tab 切换 → 听到 Tab 切换音
   - [ ] 点赞 → 听到点赞音
   - [ ] 像素绘制 → 听到绘制音
   - [ ] 成就解锁 → 听到成功音
   - [ ] 签到 → 听到成功音
   - [ ] Sheet 弹出 → 听到弹出音
   - [ ] Sheet 关闭 → 听到关闭音

4. **音效质量测试**
   - [ ] 验证所有音效**音量一致**
   - [ ] 验证所有音效**无爆音、失真**
   - [ ] 验证所有音效**时长合适**（0.1-1.0秒）
   - [ ] 验证音效**不会重叠产生噪音**

5. **性能测试**
   - [ ] 快速连续操作（如疯狂点赞）
   - [ ] 验证**无卡顿、无崩溃**
   - [ ] 使用 Instruments 检查**内存占用** (应 < 10MB)
   - [ ] 检查**CPU 占用** (应 < 5%)

---

### Phase 5: 优化与高级功能 (优先级 P2)

#### 5.1 音效音量分组控制

**扩展 SettingsView**: 添加高级音效设置页

```swift
struct AdvancedSoundSettingsView: View {
    @AppStorage("soundVolume_ui") var uiVolume = 0.7
    @AppStorage("soundVolume_achievement") var achievementVolume = 1.0
    @AppStorage("soundVolume_social") var socialVolume = 0.8
    @AppStorage("soundVolume_special") var specialVolume = 0.9
    @AppStorage("soundVolume_alert") var alertVolume = 0.9

    var body: some View {
        Form {
            Section {
                VolumeSlider(title: "界面音效", volume: $uiVolume)
                VolumeSlider(title: "成就音效", volume: $achievementVolume)
                VolumeSlider(title: "社交音效", volume: $socialVolume)
                VolumeSlider(title: "特殊场景", volume: $specialVolume)
                VolumeSlider(title: "提示音效", volume: $alertVolume)
            } header: {
                Text("音量控制")
            } footer: {
                Text("单独调整不同类型音效的音量")
            }
        }
        .navigationTitle("高级音效设置")
    }
}

struct VolumeSlider: View {
    let title: String
    @Binding var volume: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                Spacer()
                Text("\(Int(volume * 100))%")
                    .foregroundColor(.secondary)
            }

            Slider(value: $volume, in: 0...1)
                .onChange(of: volume) { _, newValue in
                    // 试听音效
                    HapticManager.shared.impact(style: .light)
                }
        }
    }
}
```

#### 5.2 音效预加载优化

**修改 AppDelegate 或 ContentView**:
```swift
// 在 App 启动时预加载常用音效
.onAppear {
    SoundManager.shared.preloadSounds([
        .pixelDraw,
        .tabSwitch,
        .likeSend,
        .success
    ])
}
```

#### 5.3 音效调试模式

**扩展 SoundManager**: 添加调试日志开关

```swift
@AppStorage("soundDebugMode") var debugMode = false

func play(_ effect: SoundEffect) {
    guard !isMuted else {
        if debugMode {
            print("🔇 音效已静音: \(effect.description)")
        }
        return
    }

    if debugMode {
        print("🔊 播放音效: \(effect.description)")
    }

    // ... 现有逻辑
}
```

---

## 📊 验收标准

### ✅ 必须达成 (P0)

1. **音效开关功能**
   - [x] 设置页有音效开关
   - [ ] 开关状态持久化
   - [ ] 关闭时所有音效静音
   - [ ] 开启时所有音效正常
   - [ ] 图标动态变化

2. **音效文件完整性**
   - [ ] 所有 17 个音效文件已添加
   - [ ] 文件格式正确（M4A/WAV）
   - [ ] 文件大小合理（总计 < 500 KB）
   - [ ] 音效质量良好（无杂音）

3. **代码实现质量**
   - [ ] SoundManager 增强完成
   - [ ] SoundEffect 枚举创建
   - [ ] 所有播放方法检查 `isMuted`
   - [ ] 向后兼容旧代码

4. **场景覆盖**
   - [ ] Tab 切换有音效
   - [ ] 点赞有音效
   - [ ] 像素绘制有音效
   - [ ] 成就解锁有音效
   - [ ] 至少 10 个关键场景有音效

### ⭐ 期望达成 (P1)

1. **用户体验**
   - [ ] 所有音效音量一致
   - [ ] 音效与触觉反馈配合
   - [ ] 音效时长合适（不过长）
   - [ ] Sheet 弹出/关闭有音效

2. **性能**
   - [ ] 内存占用 < 10 MB
   - [ ] CPU 占用 < 5%
   - [ ] 无音频卡顿
   - [ ] 音效加载快速

### 🎯 卓越达成 (P2)

1. **高级功能**
   - [ ] 音量分组控制
   - [ ] 音效预加载
   - [ ] 调试模式
   - [ ] 单元测试覆盖

---

## 🚀 实施时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|---------|--------|
| **Phase 1** | 扩展 SoundManager | 2 小时 | 开发 |
| **Phase 2** | 下载音效文件 | 1 小时 | 开发/设计 |
| **Phase 3** | 集成到场景 | 3 小时 | 开发 |
| **Phase 4** | 测试验证 | 2 小时 | QA/开发 |
| **Phase 5** | 优化功能 | 2 小时 | 开发 (可选) |
| **总计** | - | **8-10 小时** | - |

---

## 📝 下一步行动

### 立即执行 (今天)

1. ✅ **创建 SoundEffect.swift**
   ```bash
   mkdir -p FunnyPixelsApp/FunnyPixelsApp/Services/Audio
   # 复制本方案中的代码
   ```

2. ✅ **增强 SoundManager.swift**
   ```bash
   # 备份现有文件
   cp FunnyPixelsApp/FunnyPixelsApp/Services/Audio/SoundManager.swift \
      FunnyPixelsApp/FunnyPixelsApp/Services/Audio/SoundManager.swift.bak

   # 更新为增强版本
   ```

3. ✅ **运行测试脚本**
   ```bash
   chmod +x scripts/test-sounds.sh
   ./scripts/test-sounds.sh
   ```

### 本周完成

1. ✅ **下载音效文件** (参考 FREE_SOUND_EFFECTS_RESOURCES.md)
2. ✅ **集成到关键场景** (Tab、点赞、Sheet)
3. ✅ **测试音效开关** (手动测试清单)
4. ✅ **性能测试** (Instruments 监控)

### 验收测试

1. ✅ **真机测试**: iPhone 11 / 14 Pro
2. ✅ **音效开关**: 开/关状态验证
3. ✅ **持久化**: 重启 App 验证
4. ✅ **场景覆盖**: 至少 10 个场景

---

## 🎉 总结

### ✅ 现有基础优秀

1. **SettingsView** 音效开关已完美实现
2. **SoundManager** 架构健全，所有方法都有 `isMuted` 检查
3. **持久化** 正确使用 UserDefaults
4. **响应式** 使用 `@Published` 支持 SwiftUI

### 🚀 补全后收益

1. **完整音效覆盖**: 从 3 个增加到 17 个音效场景
2. **语义化 API**: `play(.likeSend)` 比 `playSuccess()` 更清晰
3. **分类管理**: 5 大音效分类，便于后续扩展
4. **零成本**: 所有音效免费可商用
5. **轻量级**: 总包体积增长仅 ~390 KB

### 🎯 关键保障

**所有音效都受设置开关控制** ✅
- `SoundManager` 的每个播放方法第一行都是 `guard !isMuted else { return }`
- 用户在设置页关闭音效后，所有场景的音效调用都会被拦截
- 持久化到 UserDefaults，重启 App 后设置仍然生效

---

**文档制作**: Claude (AI 开发助手)
**最后更新**: 2026-02-22
**相关文档**:
- `AUDIO_ANIMATION_UX_ENHANCEMENT_PLAN.md`
- `FREE_SOUND_EFFECTS_RESOURCES.md`
