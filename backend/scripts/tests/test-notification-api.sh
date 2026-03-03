#!/bin/bash

# 测试通知 API 端点

# 获取测试用户的 token
# 需要先创建一个测试用户或使用现有用户登录

echo "🧪 测试通知 API"
echo ""

# 使用 testuser 登录获取 token
echo "1️⃣ 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ 登录失败或未获取到 token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token 获取成功: ${TOKEN:0:20}..."
echo ""

# 2. 获取通知列表
echo "2️⃣ 获取通知列表..."
NOTIFICATIONS=$(curl -s http://localhost:5000/api/notifications \
  -H "Authorization: Bearer $TOKEN")

echo "$NOTIFICATIONS" | jq '.'
echo ""

# 3. 获取未读数量
echo "3️⃣ 获取未读数量..."
UNREAD_COUNT=$(curl -s http://localhost:5000/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN")

echo "$UNREAD_COUNT" | jq '.'
echo ""

# 4. 获取第一条通知的 ID 并标记已读
NOTIF_ID=$(echo "$NOTIFICATIONS" | jq -r '.data.notifications[0].id // empty')

if [ -n "$NOTIF_ID" ] && [ "$NOTIF_ID" != "null" ]; then
  echo "4️⃣ 标记通知 $NOTIF_ID 为已读..."
  MARK_READ=$(curl -s -X PUT "http://localhost:5000/api/notifications/$NOTIF_ID/read" \
    -H "Authorization: Bearer $TOKEN")

  echo "$MARK_READ" | jq '.'
  echo ""

  # 5. 验证已读状态
  echo "5️⃣ 验证已读状态..."
  UPDATED_NOTIFICATIONS=$(curl -s http://localhost:5000/api/notifications \
    -H "Authorization: Bearer $TOKEN")

  echo "$UPDATED_NOTIFICATIONS" | jq '.data.notifications[0] | {id, title, is_read}'
  echo ""
fi

# 6. 全部标记已读
echo "6️⃣ 全部标记已读..."
MARK_ALL=$(curl -s -X PUT http://localhost:5000/api/notifications/mark-all-read \
  -H "Authorization: Bearer $TOKEN")

echo "$MARK_ALL" | jq '.'
echo ""

# 7. 验证未读数量变为 0
echo "7️⃣ 验证未读数量..."
FINAL_UNREAD=$(curl -s http://localhost:5000/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN")

echo "$FINAL_UNREAD" | jq '.'
echo ""

echo "✅ 通知 API 测试完成！"
