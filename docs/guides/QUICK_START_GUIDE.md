# 音效系统快速实施指南

## 🚀 5 分钟快速开始

### 步骤 1: 添加代码文件 (2 分钟)

1. 打开 Xcode 项目
2. 右键 `Services/Audio` → "Add Files..."
3. 添加:
   - `SoundEffect.swift`
   - `SoundManager+Enhanced.swift`
4. 确保勾选 "Copy items" 和目标 Target

### 步骤 2: 临时音效方案 (1 分钟)

快速测试用 - 复用现有音效:

```bash
cd FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds
cp pixel_place.wav tab_switch.wav
cp success.wav like_send.wav
cp success.wav rank_up.wav
```

或者跳过此步，直接下载专业音效（见 SOUND_DOWNLOAD_GUIDE.md）

### 步骤 3: 添加一个音效测试 (2 分钟)

找到任意一个 View（如 `ContentView.swift`），添加:

```swift
.onAppear {
    // 测试新的音效系统
    SoundManager.shared.play(.success)
}
```

### 步骤 4: 运行测试

1. 编译运行
2. 打开 App → 应听到成功音效
3. 进入设置 → 关闭音效
4. 重启 App → 应无音效
5. 打开音效 → 应恢复音效

## 🎯 完整实施 (3-4 小时)

### 阶段 1: 下载音效 (1 小时)

参考 `SOUND_DOWNLOAD_GUIDE.md`

### 阶段 2: 集成代码 (2 小时)

参考 `CODE_INTEGRATION_CHECKLIST.md`

### 阶段 3: 测试验证 (1 小时)

运行所有测试场景

## 💡 常见问题

### Q: 音效文件找不到？

确保在 Xcode 中:
1. 文件已添加到项目
2. Build Phases → Copy Bundle Resources 中有音效文件

### Q: 编译错误: Cannot find 'SoundEffect' in scope?

确保 `SoundEffect.swift` 已添加到项目并选择了正确的 Target

### Q: 音效无法静音？

检查所有音效调用是否使用新的 `play()` 方法，而不是直接调用 AVAudioPlayer

## 📞 需要帮助?

查看详细文档:
- `SOUND_SYSTEM_IMPLEMENTATION_PLAN.md` - 完整实施方案
- `SOUND_INTEGRATION_EXAMPLES.md` - 代码集成示例
- `FREE_SOUND_EFFECTS_RESOURCES.md` - 音效资源清单
