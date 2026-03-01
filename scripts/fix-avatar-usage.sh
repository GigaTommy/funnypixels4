#!/bin/bash

# 批量移除AvatarView调用中的avatar参数
# 只保留avatarUrl参数

echo "🔧 开始修复avatar字段使用..."

# 定义需要修改的文件列表
FILES=(
    "FunnyPixelsApp/Views/Social/SessionSummaryView.swift"
    "FunnyPixelsApp/Views/LeaderboardTabView.swift"
    "FunnyPixelsApp/Views/Social/FollowListView.swift"
    "FunnyPixelsApp/Views/Feed/FeedCommentSheet.swift"
    "FunnyPixelsApp/Views/ProfileTabView.swift"
    "FunnyPixelsApp/Views/Components/AchievementShareView.swift"
    "FunnyPixelsApp/Views/Leaderboard/Top3PodiumView.swift"
    "FunnyPixelsApp/Views/Feed/FeedItemCard.swift"
    "FunnyPixelsApp/Views/Leaderboard/PlayerDetailSheet.swift"
    "FunnyPixelsApp/Views/Map/NearbyPlayerCard.swift"
)

# 备份
BACKUP_DIR="avatar_fix_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📋 备份: $file"
        cp "$file" "$BACKUP_DIR/"
    fi
done

echo "✅ 备份完成: $BACKUP_DIR"
echo ""
echo "⚠️  请手动修改以下文件，移除 'avatar: xxx,' 参数："
echo ""

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        count=$(grep -c "avatar: " "$file" 2>/dev/null || echo "0")
        if [ "$count" -gt 0 ]; then
            echo "  - $file (找到 $count 处)"
        fi
    fi
done

echo ""
echo "📝 修改步骤:"
echo "1. 打开每个文件"
echo "2. 搜索 'avatar: '"
echo "3. 移除包含'avatar:'的整行（如果是AvatarView参数）"
echo "4. 确保保留avatarUrl参数"
echo ""
echo "💡 示例:"
echo "  修改前: AvatarView(avatarUrl: url, avatar: data, displayName: name)"
echo "  修改后: AvatarView(avatarUrl: url, displayName: name)"

