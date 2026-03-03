#!/bin/bash
# 清除iOS离线缓存的脚本
# 用于修复缓存数据损坏导致的崩溃问题

echo "🧹 清除iOS离线缓存..."

# 清除UserDefaults中的离线缓存
defaults delete com.funnypixels.app offline_sessions_cache 2>/dev/null || true
defaults delete com.funnypixels.app offline_sessions_cache_timestamp 2>/dev/null || true

echo "✅ 离线缓存已清除"
echo "💡 提示：重新启动App后，缓存将从服务器重新加载"
