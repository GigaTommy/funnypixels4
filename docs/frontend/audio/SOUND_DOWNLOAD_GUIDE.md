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
./scripts/test-sounds.sh
```

确保所有音效文件都已就绪。
