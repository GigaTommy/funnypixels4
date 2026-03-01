# Module 7: 联盟聊天室 - 技术方案

> **模块代号**: Module 7
> **模块名称**: 联盟聊天室 (Alliance Chat Room)
> **依赖模块**: 无
> **预计工作量**: 2周 (约60小时)
> **优先级**: 中 (社交增强)

---

## 一、产品需求概要

### 核心功能
1. **实时文字聊天**: 联盟成员间实时消息
2. **消息类型**: 文字、表情、位置分享、系统消息
3. **消息持久化**: 存储最近7天聊天记录
4. **未读消息统计**: Badge显示未读数量
5. **快捷指令**: /help、/stats等命令

---

## 二、技术架构

### 2.1 Socket.IO 房间设计

```
房间ID: alliance:{allianceId}
- 用户加入联盟时自动加入房间
- 用户离开联盟时自动离开房间
- 仅联盟成员可加入房间
```

### 2.2 数据库设计

#### alliance_messages 表

```sql
CREATE TABLE alliance_messages (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(20) DEFAULT 'text',  -- 'text', 'emoji', 'location', 'system'
  content TEXT,
  metadata JSONB,                           -- 位置消息: {"lat": 30.27, "lng": 120.15, "city": "杭州"}

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alliance_messages_alliance ON alliance_messages(alliance_id, created_at DESC);

-- 自动清理7天前消息（定时任务）
DELETE FROM alliance_messages WHERE created_at < NOW() - INTERVAL '7 days';
```

---

## 三、Backend Socket.IO 实现

### backend/src/socket/allianceChat.js

```javascript
const { Server } = require('socket.io');
const db = require('../config/database');
const redisUtils = require('../utils/redis');

function initializeAllianceChat(io) {
  const allianceNamespace = io.of('/alliance');

  allianceNamespace.use(async (socket, next) => {
    // 验证用户Token
    const token = socket.handshake.auth.token;
    const user = await verifyToken(token);
    if (!user) return next(new Error('Authentication failed'));
    socket.userId = user.id;
    next();
  });

  allianceNamespace.on('connection', async (socket) => {
    console.log(`User ${socket.userId} connected to alliance chat`);

    // 查询用户联盟
    const membership = await db('alliance_members')
      .where({ user_id: socket.userId })
      .first('alliance_id');

    if (!membership) {
      socket.emit('error', { message: 'Not in any alliance' });
      return socket.disconnect();
    }

    const allianceId = membership.alliance_id;
    const roomId = `alliance:${allianceId}`;

    // 加入房间
    socket.join(roomId);

    // 发送消息
    socket.on('send_message', async (data) => {
      const { content, message_type, metadata } = data;

      // 保存到数据库
      const [message] = await db('alliance_messages').insert({
        alliance_id: allianceId,
        user_id: socket.userId,
        message_type: message_type || 'text',
        content,
        metadata: metadata ? JSON.stringify(metadata) : null
      }).returning('*');

      // 查询用户信息
      const user = await db('users').where({ id: socket.userId }).first('username', 'avatar_url');

      // 广播到房间
      allianceNamespace.to(roomId).emit('new_message', {
        id: message.id,
        user: {
          id: socket.userId,
          username: user.username,
          avatar_url: user.avatar_url
        },
        content: message.content,
        message_type: message.message_type,
        metadata: message.metadata,
        created_at: message.created_at
      });

      // 更新未读计数（Redis）
      await updateUnreadCount(allianceId, socket.userId);
    });

    // 获取历史消息
    socket.on('get_history', async (data) => {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const messages = await db('alliance_messages as m')
        .leftJoin('users as u', 'm.user_id', 'u.id')
        .where('m.alliance_id', allianceId)
        .orderBy('m.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select(
          'm.*',
          'u.username',
          'u.avatar_url'
        );

      socket.emit('history', {
        messages: messages.reverse().map(m => ({
          id: m.id,
          user: m.user_id ? {
            id: m.user_id,
            username: m.username,
            avatar_url: m.avatar_url
          } : null,
          content: m.content,
          message_type: m.message_type,
          metadata: m.metadata,
          created_at: m.created_at
        }))
      });
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from alliance chat`);
    });
  });
}

async function updateUnreadCount(allianceId, senderId) {
  // 为房间内其他用户增加未读计数
  const members = await db('alliance_members')
    .where({ alliance_id: allianceId })
    .whereNot({ user_id: senderId })
    .pluck('user_id');

  for (const userId of members) {
    await redisUtils.hincrby(`unread:alliance:${allianceId}`, userId, 1);
  }
}

module.exports = { initializeAllianceChat };
```

---

## 四、iOS Frontend (Combine + Socket.IO)

### AllianceChatService.swift

```swift
import Foundation
import SocketIO

class AllianceChatService: ObservableObject {
    static let shared = AllianceChatService()

    @Published var messages: [ChatMessage] = []
    @Published var isConnected: Bool = false

    private var manager: SocketManager?
    private var socket: SocketIOClient?

    func connect(allianceId: Int, token: String) {
        manager = SocketManager(socketURL: URL(string: "http://localhost:3001/alliance")!, config: [
            .log(false),
            .compress,
            .connectParams(["token": token])
        ])
        socket = manager?.defaultSocket

        socket?.on(clientEvent: .connect) { [weak self] data, ack in
            print("Socket connected")
            self?.isConnected = true
            self?.getHistory()
        }

        socket?.on("new_message") { [weak self] data, ack in
            guard let messageData = data[0] as? [String: Any],
                  let message = self?.parseMessage(messageData) else { return }
            self?.messages.append(message)
        }

        socket?.on("history") { [weak self] data, ack in
            guard let historyData = data[0] as? [String: Any],
                  let messagesArray = historyData["messages"] as? [[String: Any]] else { return }
            self?.messages = messagesArray.compactMap { self?.parseMessage($0) }
        }

        socket?.connect()
    }

    func sendMessage(content: String, type: String = "text") {
        socket?.emit("send_message", [
            "content": content,
            "message_type": type
        ])
    }

    func getHistory(limit: Int = 50, offset: Int = 0) {
        socket?.emit("get_history", [
            "limit": limit,
            "offset": offset
        ])
    }

    func disconnect() {
        socket?.disconnect()
    }

    private func parseMessage(_ data: [String: Any]) -> ChatMessage? {
        guard let id = data["id"] as? Int,
              let content = data["content"] as? String,
              let createdAtString = data["created_at"] as? String else { return nil }

        let user: ChatUser? = if let userData = data["user"] as? [String: Any],
                                  let userId = userData["id"] as? Int,
                                  let username = userData["username"] as? String {
            ChatUser(id: userId, username: username, avatarUrl: userData["avatar_url"] as? String)
        } else {
            nil
        }

        return ChatMessage(
            id: id,
            user: user,
            content: content,
            messageType: data["message_type"] as? String ?? "text",
            createdAt: ISO8601DateFormatter().date(from: createdAtString) ?? Date()
        )
    }
}

struct ChatMessage: Identifiable {
    let id: Int
    let user: ChatUser?
    let content: String
    let messageType: String
    let createdAt: Date
}

struct ChatUser {
    let id: Int
    let username: String
    let avatarUrl: String?
}
```

### AllianceChatView.swift

```swift
struct AllianceChatView: View {
    @StateObject private var chatService = AllianceChatService.shared
    @State private var inputText: String = ""

    var body: some View {
        VStack(spacing: 0) {
            // 消息列表
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(chatService.messages) { message in
                        ChatMessageRow(message: message)
                    }
                }
                .padding()
            }

            Divider()

            // 输入框
            HStack {
                TextField("输入消息...", text: $inputText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())

                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.blue)
                }
                .disabled(inputText.isEmpty)
            }
            .padding()
        }
        .navigationTitle("联盟聊天")
        .onAppear {
            chatService.connect(allianceId: 123, token: "user_token")
        }
        .onDisappear {
            chatService.disconnect()
        }
    }

    func sendMessage() {
        guard !inputText.isEmpty else { return }
        chatService.sendMessage(content: inputText)
        inputText = ""
    }
}

struct ChatMessageRow: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let user = message.user {
                AsyncImage(url: URL(string: user.avatarUrl ?? "")) { image in
                    image.resizable()
                } placeholder: {
                    Circle().fill(Color.gray)
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(user.username)
                        .font(.caption)
                        .fontWeight(.semibold)

                    Text(message.content)
                        .padding(10)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                }
            } else {
                // 系统消息
                Text(message.content)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
            }

            Spacer()
        }
    }
}
```

---

## 五、实施步骤

| 任务 | 时间 |
|------|------|
| 数据库设计 | 2h |
| Socket.IO服务端实现 | 10h |
| 消息持久化逻辑 | 4h |
| iOS Socket.IO集成 | 8h |
| iOS ChatView UI | 10h |
| 位置分享功能 | 6h |
| 未读消息Badge | 4h |
| 测试 | 8h |

**总计**: 约52小时

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
