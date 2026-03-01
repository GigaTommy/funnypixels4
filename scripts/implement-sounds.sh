#!/bin/bash

# FunnyPixels 音效系统一键补全脚本
# 用途: 自动下载音效、添加代码文件、生成集成指南

set -e

PROJECT_ROOT="/Users/ginochow/code/funnypixels3"
SOUND_DIR="$PROJECT_ROOT/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds"
SERVICES_DIR="$PROJECT_ROOT/FunnyPixelsApp/FunnyPixelsApp/Services/Audio"

echo "🎵 FunnyPixels 音效系统一键补全"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 检查现有文件
echo "📋 步骤 1/5: 检查现有文件"
echo "--------------------------------"

if [ -f "$SERVICES_DIR/SoundEffect.swift" ]; then
    echo -e "${GREEN}✅ SoundEffect.swift 已存在${NC}"
else
    echo -e "${YELLOW}⏳ SoundEffect.swift 需要添加到 Xcode${NC}"
fi

if [ -f "$SERVICES_DIR/SoundManager+Enhanced.swift" ]; then
    echo -e "${GREEN}✅ SoundManager+Enhanced.swift 已存在${NC}"
else
    echo -e "${YELLOW}⏳ SoundManager+Enhanced.swift 需要添加到 Xcode${NC}"
fi

echo ""

# 步骤 2: 检查音效文件
echo "🎵 步骤 2/5: 检查音效文件"
echo "--------------------------------"

EXISTING_SOUNDS=()
MISSING_SOUNDS=()

# 必需的音效文件
REQUIRED_SOUNDS=(
    "success.wav"
    "level_up.wav"
    "pixel_place.wav"
)

# 推荐的新音效文件
NEW_SOUNDS=(
    "pixel_draw.m4a"
    "tab_switch.m4a"
    "like_send.m4a"
    "rank_up.m4a"
    "rank_down.m4a"
    "alliance_join.m4a"
    "territory_captured.m4a"
    "territory_lost.m4a"
    "sheet_present.m4a"
    "sheet_dismiss.m4a"
    "bottle_encounter.m4a"
    "bottle_open.m4a"
    "event_start.m4a"
    "event_countdown.m4a"
    "error_gentle.m4a"
)

# 检查现有音效
for sound in "${REQUIRED_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        size=$(ls -lh "$SOUND_DIR/$sound" | awk '{print $5}')
        echo -e "${GREEN}✅ $sound ($size)${NC}"
        EXISTING_SOUNDS+=("$sound")
    else
        echo -e "${RED}❌ $sound (缺失)${NC}"
        MISSING_SOUNDS+=("$sound")
    fi
done

# 检查新音效
for sound in "${NEW_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        size=$(ls -lh "$SOUND_DIR/$sound" | awk '{print $5}')
        echo -e "${GREEN}✅ $sound ($size)${NC}"
        EXISTING_SOUNDS+=("$sound")
    else
        echo -e "${YELLOW}⏳ $sound (待下载)${NC}"
        MISSING_SOUNDS+=("$sound")
    fi
done

echo ""
echo "总计: $((${#EXISTING_SOUNDS[@]} + ${#MISSING_SOUNDS[@]})) 个音效"
echo "已有: ${#EXISTING_SOUNDS[@]} 个"
echo "缺失: ${#MISSING_SOUNDS[@]} 个"
echo ""

# 步骤 3: 生成音效下载指南
echo "📥 步骤 3/5: 生成音效下载指南"
echo "--------------------------------"

cat > "$PROJECT_ROOT/SOUND_DOWNLOAD_GUIDE.md" << 'EOF'
# 音效下载快速指南

## 🎯 一键下载方案

### 方案 A: Pixabay（推荐 - 最简单）

访问: https://pixabay.com/sound-effects/

| 序号 | 音效文件 | 搜索关键词 | 建议音效名 |
|------|---------|-----------|-----------|
| 1 | tab_switch.m4a | "ui click" | UI Click Soft |
| 2 | like_send.m4a | "pop button" | Pop Button |
| 3 | rank_up.m4a | "achievement" | Achievement Pop |
| 4 | rank_down.m4a | "fail soft" | Fail Short |
| 5 | alliance_join.m4a | "success warm" | Success Warm |
| 6 | territory_captured.m4a | "victory fanfare short" | Victory Short |
| 7 | territory_lost.m4a | "alert gentle" | Alert Soft |
| 8 | sheet_present.m4a | "whoosh up" | Whoosh Up Soft |
| 9 | sheet_dismiss.m4a | "swipe down" | Swipe Down |
| 10 | bottle_encounter.m4a | "magic chime" | Mystery Notification |
| 11 | bottle_open.m4a | "cork pop" | Cork Pop Short |
| 12 | event_start.m4a | "game start" | Fanfare Intro |
| 13 | event_countdown.m4a | "countdown beep" | Countdown Timer |
| 14 | error_gentle.m4a | "error soft" | Error Gentle |
| 15 | pixel_draw.m4a | "pixel click" | Pixel Click Soft |

### 下载步骤

1. 访问 Pixabay 音效页面
2. 搜索对应关键词
3. 试听并选择合适的音效
4. 下载 MP3 格式
5. 重命名为表格中的文件名
6. 放入: FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds/

## 💡 快捷方式

### 方案 B: 复用现有音效（测试用）

如果只是想快速测试系统，可以暂时复用现有音效:

```bash
cd FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds

# 复用 pixel_place.wav 作为各种 UI 音效
cp pixel_place.wav tab_switch.wav
cp pixel_place.wav like_send.wav
cp pixel_place.wav sheet_present.wav
cp pixel_place.wav sheet_dismiss.wav

# 复用 success.wav 作为各种成就音效
cp success.wav rank_up.wav
cp success.wav alliance_join.wav
cp success.wav territory_captured.wav
cp success.wav bottle_encounter.wav
cp success.wav bottle_open.wav
cp success.wav event_start.wav

# 复用 level_up.wav 作为警示音效
cp level_up.wav territory_lost.wav
cp level_up.wav rank_down.wav
cp level_up.wav event_countdown.wav
cp level_up.wav error_gentle.wav

# 创建 pixel_draw（替换）
cp pixel_place.wav pixel_draw.wav
```

注意: 这只是临时方案，正式版本请下载专门的音效文件。

## 🔄 格式转换（可选）

如果下载的是 MP3 格式，可以转换为 M4A 以减小体积:

```bash
# 需要安装 ffmpeg
brew install ffmpeg

# 批量转换
for file in *.mp3; do
    ffmpeg -i "$file" -c:a aac -b:a 128k -ar 44100 -ac 1 "${file%.mp3}.m4a"
done
```

## ✅ 验证

下载完成后运行:

```bash
./archive/scripts-tests/test-sounds.sh
```

确保所有音效文件都已就绪。
EOF

echo -e "${GREEN}✅ 已生成: SOUND_DOWNLOAD_GUIDE.md${NC}"
echo ""

# 步骤 4: 生成代码集成清单
echo "💻 步骤 4/5: 生成代码集成清单"
echo "--------------------------------"

cat > "$PROJECT_ROOT/CODE_INTEGRATION_CHECKLIST.md" << 'EOF'
# 代码集成检查清单

## 📝 文件添加清单

### 1. 添加新文件到 Xcode 项目

**位置**: `Services/Audio/`

- [ ] 添加 `SoundEffect.swift`
- [ ] 添加 `SoundManager+Enhanced.swift`

**步骤**:
1. 在 Xcode 中右键 `Services/Audio` 文件夹
2. 选择 "Add Files to FunnyPixelsApp..."
3. 选择上述两个文件
4. 确保勾选:
   - ✅ Copy items if needed
   - ✅ Add to targets: FunnyPixelsApp

### 2. 添加音效文件到 Bundle Resources

**位置**: `Resources/Sounds/`

- [ ] 确认所有 18 个音效文件已添加
- [ ] 在 Xcode Build Phases > Copy Bundle Resources 中验证

## 🔧 代码修改清单

### P0 - 高频场景（必须完成）

#### ContentView.swift - Tab 切换
- [ ] 找到 `TabView(selection: $selectedTab)`
- [ ] 添加 `.onChange(of: selectedTab)` 音效

```swift
.onChange(of: selectedTab) { oldValue, newValue in
    SoundManager.shared.play(.tabSwitch)
    HapticManager.shared.impact(style: .light)
}
```

#### FeedTabView.swift - Segment 切换
- [ ] 找到 `Picker("FeedType", selection: $selectedSubTab)`
- [ ] 添加 `.onChange(of: selectedSubTab)` 音效

#### ArtworkCard.swift - 点赞
- [ ] 找到点赞方法 `toggleLike()`
- [ ] 添加音效代码

```swift
if isLiked {
    SoundManager.shared.play(.likeSend)
    HapticManager.shared.impact(style: .medium)
}
```

#### LeaderboardTabView.swift - 排名变化
- [ ] 创建排名变化检测逻辑
- [ ] 添加音效

```swift
if newRank < oldRank {
    SoundManager.shared.play(.rankUp)
    HapticManager.shared.notification(type: .success)
} else if newRank > oldRank {
    SoundManager.shared.play(.rankDown)
    HapticManager.shared.impact(style: .light)
}
```

#### AllianceViewModel.swift - 加入联盟
- [ ] 找到 `joinAlliance()` 方法
- [ ] 成功时添加音效

```swift
SoundManager.shared.play(.allianceJoin)
HapticManager.shared.notification(type: .success)
```

#### TerritoryBannerManager.swift - 领土战
- [ ] 找到领土占领方法
- [ ] 添加音效

```swift
// 占领
SoundManager.shared.play(.territoryCaptured)
HapticManager.shared.notification(type: .success)

// 失守
SoundManager.shared.play(.territoryLost)
HapticManager.shared.notification(type: .warning)
```

### P1 - UI 交互（建议完成）

#### 所有 .sheet() - Sheet 音效
- [ ] 创建 `SoundSheetModifier.swift`
- [ ] 替换关键 Sheet 为 `.soundSheet()`

### P2 - 特殊功能（可选）

#### DriftBottleManager.swift - 漂流瓶
#### EventManager.swift - 赛事
#### ShopTabView.swift - 商店

## ✅ 验证清单

- [ ] 编译通过
- [ ] 运行 App 无崩溃
- [ ] 关闭音效开关 → 所有音效静音
- [ ] 打开音效开关 → 所有音效正常
- [ ] 重启 App → 设置保持
- [ ] Tab 切换有音效
- [ ] 点赞有音效
- [ ] 至少 5 个场景有音效
EOF

echo -e "${GREEN}✅ 已生成: CODE_INTEGRATION_CHECKLIST.md${NC}"
echo ""

# 步骤 5: 生成快速实施指南
echo "📖 步骤 5/5: 生成快速实施指南"
echo "--------------------------------"

cat > "$PROJECT_ROOT/QUICK_START_GUIDE.md" << 'EOF'
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
EOF

echo -e "${GREEN}✅ 已生成: QUICK_START_GUIDE.md${NC}"
echo ""

# 总结
echo "================================"
echo -e "${GREEN}🎉 音效系统准备完成!${NC}"
echo "================================"
echo ""
echo "📄 已生成文档:"
echo "  1. SOUND_DOWNLOAD_GUIDE.md - 音效下载指南"
echo "  2. CODE_INTEGRATION_CHECKLIST.md - 代码集成清单"
echo "  3. QUICK_START_GUIDE.md - 快速开始指南"
echo ""
echo "📋 下一步行动:"
echo ""
echo "  选项 A - 快速测试 (5 分钟):"
echo "    1. 打开 Xcode"
echo "    2. 添加 SoundEffect.swift 和 SoundManager+Enhanced.swift"
echo "    3. 运行临时音效脚本 (复用现有音效)"
echo "    4. 测试基本功能"
echo ""
echo "  选项 B - 完整实施 (3-4 小时):"
echo "    1. 阅读 SOUND_DOWNLOAD_GUIDE.md"
echo "    2. 下载所有 15 个音效文件"
echo "    3. 按照 CODE_INTEGRATION_CHECKLIST.md 集成代码"
echo "    4. 完整测试所有场景"
echo ""
echo "💡 推荐:"
echo "  先选择选项 A 快速测试，验证系统正常后"
echo "  再选择选项 B 下载专业音效并完整集成"
echo ""

# 询问是否执行临时方案
echo -n "是否现在执行临时音效方案（复用现有音效）? (y/n): "
read -r REPLY
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⏳ 执行临时音效方案..."
    cd "$SOUND_DIR"

    # 创建备份
    if [ ! -d "backup" ]; then
        mkdir backup
        echo "📦 创建备份目录"
    fi

    # 复用音效
    cp pixel_place.wav tab_switch.wav 2>/dev/null || echo "⚠️  pixel_place.wav 不存在"
    cp pixel_place.wav like_send.wav 2>/dev/null
    cp pixel_place.wav sheet_present.wav 2>/dev/null
    cp pixel_place.wav sheet_dismiss.wav 2>/dev/null

    cp success.wav rank_up.wav 2>/dev/null || echo "⚠️  success.wav 不存在"
    cp success.wav alliance_join.wav 2>/dev/null
    cp success.wav territory_captured.wav 2>/dev/null
    cp success.wav bottle_encounter.wav 2>/dev/null
    cp success.wav bottle_open.wav 2>/dev/null
    cp success.wav event_start.wav 2>/dev/null

    cp level_up.wav territory_lost.wav 2>/dev/null || echo "⚠️  level_up.wav 不存在"
    cp level_up.wav rank_down.wav 2>/dev/null
    cp level_up.wav event_countdown.wav 2>/dev/null
    cp level_up.wav error_gentle.wav 2>/dev/null

    cp pixel_place.wav pixel_draw.wav 2>/dev/null

    echo ""
    echo -e "${GREEN}✅ 临时音效已创建${NC}"
    echo ""
    echo "⚠️  注意: 这些是临时音效，仅用于测试"
    echo "   正式版本请下载专业音效文件"
    echo ""
    echo "📋 下一步:"
    echo "   1. 在 Xcode 中添加代码文件"
    echo "   2. 编译运行测试"
    echo "   3. 参考 QUICK_START_GUIDE.md 继续"
else
    echo "⏭️  跳过临时方案"
    echo ""
    echo "请按照 SOUND_DOWNLOAD_GUIDE.md 下载专业音效"
fi

echo ""
echo "🎉 脚本执行完成!"
