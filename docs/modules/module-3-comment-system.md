# Module 3: 评论系统 - 技术方案

> **模块代号**: Module 3
> **模块名称**: 评论系统 (Comment System)
> **依赖模块**: Module 1 (Feed系统)
> **预计工作量**: 1-2周 (约55小时)
> **优先级**: 高 (社交互动核心)

---

## 一、产品需求

### 1.1 核心功能

#### FR1: 评论发布与展示
- **发布评论**: 用户可对Feed动态发表评论（文字、@提及、表情）
- **嵌套回复**: 支持对评论的回复（最多2层）
- **评论排序**: 按时间（最新/最早）或热度（点赞数）排序
- **评论数量**: Feed卡片显示评论总数

#### FR2: @提及功能
- **@用户**: 输入@时触发用户搜索列表
- **高亮显示**: 评论中的@用户名高亮显示
- **跳转**: 点击@用户名跳转到用户主页
- **通知**: 被@的用户收到通知

#### FR3: 评论管理
- **编辑评论**: 发布后5分钟内可编辑
- **删除评论**: 评论作者可删除自己的评论
- **举报评论**: 用户可举报不当评论
- **权限控制**: 根据Feed可见性控制评论权限

#### FR4: 评论通知
- **被评论通知**: 用户的Feed被评论时收到通知
- **被回复通知**: 用户的评论被回复时收到通知
- **被@通知**: 用户被@时收到通知

---

## 二、数据库设计

### 2.1 评论表

#### feed_comments 表
```sql
CREATE TABLE feed_comments (
  id SERIAL PRIMARY KEY,
  feed_item_id INTEGER REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,  -- 回复评论的ID（NULL表示顶级评论）

  content TEXT NOT NULL,                        -- 评论内容
  mentions JSONB,                               -- @提及的用户列表 [{"user_id": 123, "username": "张三", "start": 0, "length": 3}]

  like_count INTEGER DEFAULT 0,                 -- 点赞数
  reply_count INTEGER DEFAULT 0,                -- 回复数

  is_edited BOOLEAN DEFAULT FALSE,              -- 是否已编辑
  edited_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_feed ON feed_comments(feed_item_id, created_at DESC);
CREATE INDEX idx_comments_user ON feed_comments(user_id);
CREATE INDEX idx_comments_parent ON feed_comments(parent_comment_id);

-- 触发器：自动更新回复数
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    UPDATE feed_comments
    SET reply_count = reply_count + 1
    WHERE id = NEW.parent_comment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reply_count
AFTER INSERT ON feed_comments
FOR EACH ROW
EXECUTE FUNCTION update_reply_count();
```

### 2.2 评论点赞表

#### comment_likes 表
```sql
CREATE TABLE comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);
```

### 2.3 评论举报表

#### comment_reports 表
```sql
CREATE TABLE comment_reports (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100),                          -- 举报原因
  status VARCHAR(20) DEFAULT 'pending',         -- 状态: pending, reviewed, dismissed
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comment_reports_status ON comment_reports(status);
```

---

## 三、Backend API 设计

### 3.1 发布评论

**Endpoint**: `POST /api/feed/:feedId/comments`

**Request Body**:
```json
{
  "content": "太棒了！@张三 一起来试试",
  "parent_comment_id": null,
  "mentions": [
    { "user_id": 123, "username": "张三", "start": 4, "length": 3 }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "comment_id": 456,
    "content": "太棒了！@张三 一起来试试",
    "user": {
      "id": 789,
      "username": "李四",
      "avatar_url": "https://..."
    },
    "created_at": "2026-02-28T15:30:00Z",
    "like_count": 0,
    "reply_count": 0
  }
}
```

### 3.2 获取评论列表

**Endpoint**: `GET /api/feed/:feedId/comments?sort=time&limit=20&offset=0`

**Query Parameters**:
- `sort`: `time` (最新) | `hot` (热度)
- `limit`: 每页数量（默认20）
- `offset`: 偏移量

**Response**:
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": 456,
        "content": "太棒了！@张三 一起来试试",
        "user": {
          "id": 789,
          "username": "李四",
          "avatar_url": "https://..."
        },
        "mentions": [
          { "user_id": 123, "username": "张三", "start": 4, "length": 3 }
        ],
        "like_count": 5,
        "reply_count": 2,
        "is_liked": false,
        "created_at": "2026-02-28T15:30:00Z",
        "replies": [
          {
            "id": 457,
            "content": "好的！",
            "user": { "id": 123, "username": "张三", "avatar_url": "..." },
            "like_count": 1,
            "created_at": "2026-02-28T15:35:00Z"
          }
        ]
      }
    ],
    "total_count": 50,
    "has_more": true
  }
}
```

### 3.3 删除评论

**Endpoint**: `DELETE /api/comments/:commentId`

**Response**:
```json
{
  "success": true,
  "message": "Comment deleted"
}
```

### 3.4 点赞评论

**Endpoint**: `POST /api/comments/:commentId/like`

**Response**:
```json
{
  "success": true,
  "data": {
    "comment_id": 456,
    "like_count": 6,
    "is_liked": true
  }
}
```

---

## 四、Controller 实现

### backend/src/controllers/commentController.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');

/**
 * POST /api/feed/:feedId/comments
 * 发布评论
 */
async function createComment(req, res) {
  const trx = await db.transaction();

  try {
    const userId = req.user.id;
    const feedId = parseInt(req.params.feedId);
    const { content, parent_comment_id, mentions } = req.body;

    // 验证Feed存在
    const feedItem = await trx('feed_items').where({ id: feedId }).first();
    if (!feedItem) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Feed item not found' });
    }

    // 验证权限（简化版）
    // TODO: 检查Feed可见性权限

    // 插入评论
    const [comment] = await trx('feed_comments').insert({
      feed_item_id: feedId,
      user_id: userId,
      parent_comment_id: parent_comment_id || null,
      content,
      mentions: mentions ? JSON.stringify(mentions) : null
    }).returning('*');

    // 查询用户信息
    const user = await trx('users').where({ id: userId }).first('id', 'username', 'avatar_url');

    await trx.commit();

    // 清除评论列表缓存
    await redisUtils.del(`comments:feed:${feedId}:*`);

    // 发送通知（异步）
    sendCommentNotifications(feedItem, comment, mentions).catch(err => console.error(err));

    res.json({
      success: true,
      data: {
        comment_id: comment.id,
        content: comment.content,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url
        },
        created_at: comment.created_at,
        like_count: 0,
        reply_count: 0
      }
    });
  } catch (error) {
    await trx.rollback();
    console.error('createComment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
}

/**
 * GET /api/feed/:feedId/comments
 * 获取评论列表
 */
async function getComments(req, res) {
  try {
    const userId = req.user?.id;
    const feedId = parseInt(req.params.feedId);
    const sort = req.query.sort || 'time';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // 查询顶级评论
    const orderBy = sort === 'hot' ? 'like_count' : 'created_at';
    const orderDir = sort === 'hot' ? 'desc' : 'desc';

    const comments = await db('feed_comments as c')
      .leftJoin('users as u', 'c.user_id', 'u.id')
      .where({ 'c.feed_item_id': feedId, 'c.parent_comment_id': null })
      .orderBy(`c.${orderBy}`, orderDir)
      .limit(limit)
      .offset(offset)
      .select(
        'c.*',
        'u.id as user_id',
        'u.username',
        'u.avatar_url'
      );

    // 查询总数
    const totalCount = await db('feed_comments')
      .where({ feed_item_id: feedId, parent_comment_id: null })
      .count('id as count')
      .first();

    // 查询每个评论的回复（最多2条预览）
    const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
      const replies = await db('feed_comments as c')
        .leftJoin('users as u', 'c.user_id', 'u.id')
        .where({ 'c.parent_comment_id': comment.id })
        .orderBy('c.created_at', 'asc')
        .limit(2)
        .select(
          'c.*',
          'u.id as user_id',
          'u.username',
          'u.avatar_url'
        );

      // 检查当前用户是否点赞
      const isLiked = userId ? await db('comment_likes')
        .where({ comment_id: comment.id, user_id: userId })
        .first() : null;

      return {
        id: comment.id,
        content: comment.content,
        user: {
          id: comment.user_id,
          username: comment.username,
          avatar_url: comment.avatar_url
        },
        mentions: comment.mentions || [],
        like_count: comment.like_count,
        reply_count: comment.reply_count,
        is_liked: !!isLiked,
        created_at: comment.created_at,
        replies: replies.map(r => ({
          id: r.id,
          content: r.content,
          user: {
            id: r.user_id,
            username: r.username,
            avatar_url: r.avatar_url
          },
          like_count: r.like_count,
          created_at: r.created_at
        }))
      };
    }));

    res.json({
      success: true,
      data: {
        comments: commentsWithReplies,
        total_count: parseInt(totalCount.count),
        has_more: offset + limit < parseInt(totalCount.count)
      }
    });
  } catch (error) {
    console.error('getComments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
}

/**
 * DELETE /api/comments/:commentId
 * 删除评论
 */
async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.commentId);

    const comment = await db('feed_comments').where({ id: commentId }).first();
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // 权限检查：仅评论作者可删除
    if (comment.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    await db('feed_comments').where({ id: commentId }).del();

    // 清除缓存
    await redisUtils.del(`comments:feed:${comment.feed_item_id}:*`);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('deleteComment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
}

/**
 * POST /api/comments/:commentId/like
 * 点赞评论
 */
async function likeComment(req, res) {
  const trx = await db.transaction();

  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.commentId);

    // 检查是否已点赞
    const existing = await trx('comment_likes')
      .where({ comment_id: commentId, user_id: userId })
      .first();

    let isLiked, likeCount;

    if (existing) {
      // 取消点赞
      await trx('comment_likes').where({ id: existing.id }).del();
      await trx('feed_comments').where({ id: commentId }).decrement('like_count', 1);
      isLiked = false;
    } else {
      // 点赞
      await trx('comment_likes').insert({ comment_id: commentId, user_id: userId });
      await trx('feed_comments').where({ id: commentId }).increment('like_count', 1);
      isLiked = true;
    }

    const comment = await trx('feed_comments').where({ id: commentId }).first('like_count');
    likeCount = comment.like_count;

    await trx.commit();

    res.json({
      success: true,
      data: {
        comment_id: commentId,
        like_count: likeCount,
        is_liked: isLiked
      }
    });
  } catch (error) {
    await trx.rollback();
    console.error('likeComment error:', error);
    res.status(500).json({ success: false, error: 'Failed to like comment' });
  }
}

async function sendCommentNotifications(feedItem, comment, mentions) {
  // TODO: 实现通知发送逻辑
  // 1. 通知Feed作者（被评论）
  // 2. 通知被@的用户
  // 3. 如果是回复，通知被回复的评论作者
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  likeComment
};
```

---

## 五、iOS Frontend 设计

### FunnyPixelsApp/Services/CommentService.swift

```swift
import Foundation
import Combine

class CommentService {
    static let shared = CommentService()
    private let apiClient = APIClient.shared

    func fetchComments(feedId: Int, sort: String = "time", limit: Int = 20, offset: Int = 0) -> AnyPublisher<CommentListResponse, Error> {
        let endpoint = APIEndpoint.feed.appendingPathComponent("\(feedId)/comments")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "sort", value: sort),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]

        return apiClient.request(url: components.url!, method: "GET", body: nil as String?)
            .decode(type: APIResponse<CommentListResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else { throw APIError.serverError(response.error ?? "Unknown error") }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    func postComment(feedId: Int, content: String, parentCommentId: Int? = nil, mentions: [Mention] = []) -> AnyPublisher<CommentResponse, Error> {
        let endpoint = APIEndpoint.feed.appendingPathComponent("\(feedId)/comments")
        let body = PostCommentRequest(
            content: content,
            parentCommentId: parentCommentId,
            mentions: mentions
        )

        return apiClient.request(url: endpoint, method: "POST", body: body)
            .decode(type: APIResponse<CommentResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else { throw APIError.serverError(response.error ?? "Unknown error") }
                return response.data!
            }
            .eraseToAnyPublisher()
    }

    func likeComment(commentId: Int) -> AnyPublisher<LikeCommentResponse, Error> {
        let endpoint = APIEndpoint.comments.appendingPathComponent("\(commentId)/like")

        return apiClient.request(url: endpoint, method: "POST", body: nil as String?)
            .decode(type: APIResponse<LikeCommentResponse>.self, decoder: JSONDecoder.snakeCase)
            .tryMap { response in
                guard response.success else { throw APIError.serverError(response.error ?? "Unknown error") }
                return response.data!
            }
            .eraseToAnyPublisher()
    }
}

// Models
struct CommentListResponse: Codable {
    let comments: [Comment]
    let totalCount: Int
    let hasMore: Bool
}

struct Comment: Codable, Identifiable {
    let id: Int
    let content: String
    let user: CommentUser
    let mentions: [Mention]
    let likeCount: Int
    let replyCount: Int
    let isLiked: Bool
    let createdAt: Date
    let replies: [Comment]
}

struct CommentUser: Codable {
    let id: Int
    let username: String
    let avatarUrl: String?
}

struct Mention: Codable {
    let userId: Int
    let username: String
    let start: Int
    let length: Int
}

struct PostCommentRequest: Codable {
    let content: String
    let parentCommentId: Int?
    let mentions: [Mention]
}

struct CommentResponse: Codable {
    let commentId: Int
    let content: String
    let user: CommentUser
    let createdAt: Date
    let likeCount: Int
    let replyCount: Int
}

struct LikeCommentResponse: Codable {
    let commentId: Int
    let likeCount: Int
    let isLiked: Bool
}
```

### FunnyPixelsApp/Views/Comments/CommentListView.swift

```swift
import SwiftUI

struct CommentListView: View {
    let feedId: Int
    @StateObject private var viewModel: CommentListViewModel

    init(feedId: Int) {
        self.feedId = feedId
        _viewModel = StateObject(wrappedValue: CommentListViewModel(feedId: feedId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // 评论列表
            ScrollView {
                LazyVStack(spacing: 15) {
                    ForEach(viewModel.comments) { comment in
                        CommentCard(comment: comment) {
                            viewModel.likeComment(commentId: comment.id)
                        }
                        .padding(.horizontal)
                    }

                    if viewModel.hasMore && !viewModel.isLoading {
                        Button("加载更多") {
                            viewModel.loadMore()
                        }
                        .padding()
                    }
                }
                .padding(.vertical)
            }

            Divider()

            // 输入框
            CommentInputView { content in
                viewModel.postComment(content: content)
            }
            .padding()
        }
        .navigationTitle("评论")
        .onAppear {
            viewModel.fetchComments()
        }
    }
}

struct CommentCard: View {
    let comment: Comment
    let onLike: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // 用户信息
            HStack(spacing: 10) {
                AsyncImage(url: URL(string: comment.user.avatarUrl ?? "")) { image in
                    image.resizable()
                } placeholder: {
                    Circle().fill(Color.gray)
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    Text(comment.user.username)
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Text(formatDate(comment.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // 评论内容（高亮@提及）
            Text(highlightMentions(comment.content, mentions: comment.mentions))
                .font(.body)

            // 点赞按钮
            HStack {
                Button(action: onLike) {
                    HStack(spacing: 4) {
                        Image(systemName: comment.isLiked ? "heart.fill" : "heart")
                            .foregroundColor(comment.isLiked ? .red : .gray)
                        Text("\(comment.likeCount)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if comment.replyCount > 0 {
                    Text("\(comment.replyCount) 回复")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // 回复预览
            if !comment.replies.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(comment.replies) { reply in
                        HStack(alignment: .top, spacing: 8) {
                            AsyncImage(url: URL(string: reply.user.avatarUrl ?? "")) { image in
                                image.resizable()
                            } placeholder: {
                                Circle().fill(Color.gray)
                            }
                            .frame(width: 30, height: 30)
                            .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 4) {
                                Text(reply.user.username)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                Text(reply.content)
                                    .font(.caption)
                            }
                        }
                    }
                }
                .padding(10)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 3, x: 0, y: 1)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func highlightMentions(_ content: String, mentions: [Mention]) -> AttributedString {
        var attrString = AttributedString(content)
        for mention in mentions {
            let range = attrString.index(attrString.startIndex, offsetBy: mention.start)..<attrString.index(attrString.startIndex, offsetBy: mention.start + mention.length)
            attrString[range].foregroundColor = .blue
            attrString[range].font = .body.bold()
        }
        return attrString
    }
}

struct CommentInputView: View {
    let onSubmit: (String) -> Void
    @State private var text: String = ""

    var body: some View {
        HStack {
            TextField("写评论...", text: $text)
                .textFieldStyle(RoundedBorderTextFieldStyle())

            Button(action: {
                guard !text.isEmpty else { return }
                onSubmit(text)
                text = ""
            }) {
                Image(systemName: "paperplane.fill")
                    .foregroundColor(.blue)
            }
            .disabled(text.isEmpty)
        }
    }
}

class CommentListViewModel: ObservableObject {
    @Published var comments: [Comment] = []
    @Published var isLoading: Bool = false
    @Published var hasMore: Bool = false

    let feedId: Int
    private var offset: Int = 0
    private let limit: Int = 20
    private var cancellables = Set<AnyCancellable>()
    private let commentService = CommentService.shared

    init(feedId: Int) {
        self.feedId = feedId
    }

    func fetchComments() {
        isLoading = true
        offset = 0

        commentService.fetchComments(feedId: feedId, limit: limit, offset: offset)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                self?.isLoading = false
            } receiveValue: { [weak self] response in
                self?.comments = response.comments
                self?.hasMore = response.hasMore
            }
            .store(in: &cancellables)
    }

    func loadMore() {
        offset += limit
        // ... 加载更多逻辑
    }

    func postComment(content: String) {
        commentService.postComment(feedId: feedId, content: content)
            .receive(on: DispatchQueue.main)
            .sink { completion in
                // 处理错误
            } receiveValue: { [weak self] response in
                // 乐观UI更新
                self?.fetchComments()
            }
            .store(in: &cancellables)
    }

    func likeComment(commentId: Int) {
        // 乐观UI更新
        if let index = comments.firstIndex(where: { $0.id == commentId }) {
            comments[index] = Comment(
                id: comments[index].id,
                content: comments[index].content,
                user: comments[index].user,
                mentions: comments[index].mentions,
                likeCount: comments[index].isLiked ? comments[index].likeCount - 1 : comments[index].likeCount + 1,
                replyCount: comments[index].replyCount,
                isLiked: !comments[index].isLiked,
                createdAt: comments[index].createdAt,
                replies: comments[index].replies
            )
        }

        commentService.likeComment(commentId: commentId)
            .receive(on: DispatchQueue.main)
            .sink { completion in
                if case .failure = completion {
                    // 回滚乐观更新
                }
            } receiveValue: { _ in }
            .store(in: &cancellables)
    }
}
```

---

## 六、实施步骤

| 序号 | 任务 | 预计时间 |
|-----|------|---------|
| 1 | 数据库设计（3张表 + 触发器） | 4h |
| 2 | 实现commentController（4个API） | 8h |
| 3 | @提及解析逻辑 | 3h |
| 4 | 通知系统集成 | 4h |
| 5 | iOS CommentService + ViewModel | 5h |
| 6 | iOS CommentListView + CommentCard | 8h |
| 7 | @提及高亮显示 | 3h |
| 8 | 评论输入框（@搜索） | 6h |
| 9 | 测试与优化 | 6h |

**总计**: 约55小时（7个工作日）

---

## 七、验收标准

- [ ] 用户可对Feed发表评论
- [ ] 评论支持2层嵌套回复
- [ ] @提及功能正常（搜索、高亮、通知）
- [ ] 评论点赞/取消点赞正常
- [ ] 评论作者可删除自己的评论
- [ ] 评论数量在Feed卡片正确显示
- [ ] 被评论/被@时收到通知

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
