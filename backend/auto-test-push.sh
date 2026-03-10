#!/bin/bash

echo "🔄 等待新设备令牌注册..."
echo "请在 iPhone 上启动 FunnyPixels App"
echo ""

# 等待新令牌注册（每2秒检查一次，最多等待30秒）
for i in {1..15}; do
  TOKEN=$(node simple-query.js 2>/dev/null)

  if [ -n "$TOKEN" ]; then
    TOKEN_LENGTH=${#TOKEN}
    echo "✅ 检测到新令牌！"
    echo "令牌长度: $TOKEN_LENGTH 字符"
    echo "令牌前缀: ${TOKEN:0:20}..."
    echo ""

    # 检查令牌长度是否正确（应该是64位十六进制 = 64字符）
    if [ "$TOKEN_LENGTH" -eq 64 ]; then
      echo "✅ 令牌长度正确！"
      echo ""
      echo "🚀 发送测试推送通知..."
      echo ""
      node test-push.js "$TOKEN"
      exit 0
    else
      echo "⚠️  令牌长度异常: $TOKEN_LENGTH (应该是 64)"
      echo "   可能是数据问题，请检查 iOS 端代码"
      exit 1
    fi
  fi

  echo "⏳ 等待中... ($i/15)"
  sleep 2
done

echo ""
echo "❌ 超时：30秒内未检测到新令牌"
echo "   请确保 App 已启动并成功注册设备令牌"
