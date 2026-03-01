#!/bin/bash

# FunnyPixels 病毒式营销功能设置脚本
# Date: 2026-02-16

set -e  # 遇到错误立即退出

echo "🎨 FunnyPixels 病毒式营销和商业化功能设置"
echo "================================================"
echo ""

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 backend 目录下运行此脚本"
    echo "   cd /Users/ginochow/code/funnypixels3/backend"
    exit 1
fi

echo "✅ 当前目录正确"
echo ""

# 1. 运行数据库迁移
echo "📊 步骤 1/4: 运行数据库迁移..."
if command -v npx &> /dev/null; then
    npx knex migrate:latest
    echo "✅ 数据库迁移完成"
else
    echo "⚠️  警告: npx 未找到，请手动运行: npx knex migrate:latest"
fi
echo ""

# 2. 验证配置文件
echo "⚙️  步骤 2/4: 验证配置文件..."
if [ -f "../config/pricing.js" ]; then
    echo "✅ pricing.js 配置文件存在"
else
    echo "❌ 缺少 config/pricing.js"
fi

if [ -f "../config/vip.js" ]; then
    echo "✅ vip.js 配置文件存在"
else
    echo "❌ 缺少 config/vip.js"
fi
echo ""

# 3. 设置 ZeroClaw 守护进程
echo "🤖 步骤 3/4: 设置 ZeroClaw 守护进程..."
PLIST_PATH="$HOME/Library/LaunchAgents/com.zeroclaw.funnypixels.plist"
if [ -f "$PLIST_PATH" ]; then
    echo "✅ launchd plist 文件存在"

    # 检查是否已加载
    if launchctl list | grep -q "com.zeroclaw.funnypixels"; then
        echo "⚠️  守护进程已加载，重新加载..."
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
    fi

    # 加载守护进程
    launchctl load "$PLIST_PATH"
    echo "✅ ZeroClaw 守护进程已启动"
else
    echo "❌ 缺少 launchd plist 文件: $PLIST_PATH"
fi
echo ""

# 4. 验证安装
echo "🔍 步骤 4/4: 验证安装..."

# 检查守护进程是否运行
if launchctl list | grep -q "com.zeroclaw.funnypixels"; then
    echo "✅ ZeroClaw 守护进程正在运行"
else
    echo "❌ ZeroClaw 守护进程未运行"
fi

# 检查数据库表
echo ""
echo "📋 数据库表检查:"
psql -U funnypixels_user -d funnypixels_db -c "\dt share_tracking" 2>/dev/null && echo "✅ share_tracking 表存在" || echo "❌ share_tracking 表缺失"
psql -U funnypixels_user -d funnypixels_db -c "\dt vip_subscriptions" 2>/dev/null && echo "✅ vip_subscriptions 表存在" || echo "❌ vip_subscriptions 表缺失"
psql -U funnypixels_user -d funnypixels_db -c "\dt ab_tests" 2>/dev/null && echo "✅ ab_tests 表存在" || echo "❌ ab_tests 表缺失"

echo ""
echo "================================================"
echo "✅ 设置完成！"
echo ""
echo "📚 下一步:"
echo "1. 查看实施文档: cat /Users/ginochow/code/funnypixels3/VIRAL_MARKETING_IMPLEMENTATION.md"
echo "2. 查看守护进程日志: tail -f /Users/ginochow/code/funnypixels3/.zeroclaw/daemon.log"
echo "3. 测试分享 API: curl -X POST http://localhost:3000/api/share/record-action -H 'Authorization: Bearer TOKEN' -d '{\"shareType\":\"session\",\"shareTarget\":\"wechat\"}'"
echo ""
echo "🚀 开始开发 iOS 前端集成！"
