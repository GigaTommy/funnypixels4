#!/bin/bash

# 音效文件检查脚本

SOUND_DIR="/Users/ginochow/code/funnypixels3/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds"

echo "🔍 检查音效文件..."
echo ""

REQUIRED_SOUNDS=(
    "success.wav"
    "level_up.wav"
    "pixel_place.wav"
)

OPTIONAL_SOUNDS=(
    "pixel_draw.m4a"
    "tab_switch.m4a"
    "sheet_present.m4a"
    "sheet_dismiss.m4a"
    "like_send.m4a"
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

echo "📦 现有音效:"
EXISTING=0
for sound in "${REQUIRED_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        size=$(ls -lh "$SOUND_DIR/$sound" | awk '{print $5}')
        echo "  ✅ $sound ($size)"
        ((EXISTING++))
    else
        echo "  ❌ $sound (缺失)"
    fi
done

echo ""
echo "🎵 待补充音效:"
MISSING=0
for sound in "${OPTIONAL_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        size=$(ls -lh "$SOUND_DIR/$sound" | awk '{print $5}')
        echo "  ✅ $sound ($size)"
        ((EXISTING++))
    else
        echo "  ⏳ $sound (待下载)"
        ((MISSING++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "总计: $((EXISTING + MISSING)) 个音效"
echo "已有: $EXISTING 个"
echo "待补充: $MISSING 个"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$SOUND_DIR" ]; then
    total_size=$(du -sh "$SOUND_DIR" | awk '{print $1}')
    echo "📦 当前大小: $total_size"
fi

if [ $MISSING -eq 0 ]; then
    echo ""
    echo "🎉 所有音效文件已就绪!"
else
    echo ""
    echo "💡 下载音效指南:"
    echo "   参考文档: FREE_SOUND_EFFECTS_RESOURCES.md"
    echo "   推荐平台: https://pixabay.com/sound-effects/"
fi

echo ""
