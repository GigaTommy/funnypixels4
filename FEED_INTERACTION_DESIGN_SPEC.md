# 动态Tab-广场 功能交互设计规范

## 📅 文档版本
- **版本**: v1.0
- **日期**: 2026-03-04
- **设计师**: Claude (AI Product Designer)
- **状态**: 待评审

---

## 目录
1. [设计理念](#1-设计理念)
2. [用户流程](#2-用户流程)
3. [页面架构](#3-页面架构)
4. [核心功能交互](#4-核心功能交互)
5. [组件设计规范](#5-组件设计规范)
6. [动画与过渡](#6-动画与过渡)
7. [状态与反馈](#7-状态与反馈)
8. [边界情况](#8-边界情况)
9. [可访问性](#9-可访问性)
10. [技术实现](#10-技术实现)

---

## 1. 设计理念

### 1.1 核心原则

#### 视觉驱动 (Visual-First)
- **图片是第一要素**，占据60-70%的视觉空间
- 文字信息为辅助，精简到最少必要信息
- 颜色使用克制，突出内容本身

#### 交互轻量 (Lightweight Interaction)
- **双击即点赞**，减少操作步骤
- **操作可见**，实时反馈操作结果
- **手势优先**，充分利用移动设备特性

#### 信息透明 (Information Transparency)
- **数字化展示**，明确告知点赞数、评论数
- **状态清晰**，已操作项高亮显示
- **进度可见**，加载、提交等过程可视化

#### 社交友好 (Social Friendly)
- **降低参与门槛**，鼓励互动
- **即时反馈**，操作后立即看到效果
- **情感连接**，通过动画和视觉传递温度

### 1.2 设计目标

| 目标 | 指标 | 当前 | 目标 |
|------|------|------|------|
| 用户停留时长 | 平均停留时间 | 2分钟 | 5分钟 |
| 互动率 | 点赞率 | 5% | 15% |
| 内容消费 | 每次访问浏览数 | 3条 | 10条 |
| 内容创作 | 发布转化率 | 1% | 3% |

---

## 2. 用户流程

### 2.1 主要用户场景

#### 场景1：浏览动态流
```
进入广场 → 查看Feed流 → 双击点赞/滑动浏览 → 点击评论 → 发表评论 → 返回Feed
```

#### 场景2：查看作品详情
```
Feed列表 → 点击卡片/缩略图 → 作品详情页 → 查看地图/像素详情 → 点赞/评论/收藏 → 返回
```

#### 场景3：发现相关内容
```
浏览Feed → 点击话题标签 → 话题页 → 浏览同话题内容 → 关注话题 → 返回
```

#### 场景4：社交互动
```
Feed列表 → 点击用户头像 → 用户主页 → 关注/查看作品 → 返回
```

### 2.2 用户旅程地图

```
                    浏览前          浏览中           互动中           离开前
                      ↓              ↓               ↓               ↓
【情绪曲线】      期待 → 兴奋 → 沉浸 → 满足 → 留恋

【触点】         打开App → 看到新内容 → 发现好作品 → 点赞评论 → 收藏/分享 → 期待下次

【需求】         消磨时间   发现灵感   表达认可   社交互动   内容收藏

【痛点】         加载慢    内容单一   操作复杂   反馈不明   找不到了

【机会点】       骨架屏    多样化    双击点赞   实时反馈   收藏夹
```

---

## 3. 页面架构

### 3.1 Feed流页面结构

```
┌─────────────────────────────────┐
│ 📱 动态 (Tab标题)                 │ ← NavigationBar
├─────────────────────────────────┤
│ [广场] [足迹] [数据]              │ ← SubTab选择器
├─────────────────────────────────┤
│ [全部▼] 关注 附近  [⋮筛选]        │ ← 筛选器 + 更多菜单
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │    [大图 280px高]            │ │ ← Feed卡片1
│ │                             │ │
│ ├─────────────────────────────┤ │
│ │ 标题文字 (1-2行)             │ │
│ │ [头像] 用户名 · 2小时前       │ │
│ │ #像素艺术 📍北京              │ │
│ │ ❤️ 123  💬 45  ⭐ 67        │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │    [大图 280px高]            │ │ ← Feed卡片2
│ │         ...                 │ │
│ └─────────────────────────────┘ │
│                                 │
│        [加载更多...]             │ ← 加载指示器
└─────────────────────────────────┘
```

### 3.2 信息层级

```
Level 1 (主视觉)：
  └─ 作品封面图 (280px高, 占60-70%视觉空间)

Level 2 (核心信息)：
  ├─ 标题 (16px bold)
  └─ 操作数据 (❤️123 💬45 ⭐67)

Level 3 (辅助信息)：
  ├─ 作者信息 (头像 + 名字)
  ├─ 发布时间 (相对时间)
  └─ 标签 (#话题 📍位置)

Level 4 (次要信息)：
  └─ 更多操作 (⋮菜单)
```

---

## 4. 核心功能交互

### 4.1 双击点赞 (核心交互)

#### 交互流程
```
用户行为             系统响应                   视觉反馈
   ↓                    ↓                        ↓
双击图片  →  检测双击事件  →  触发点赞动画
   ↓                    ↓                        ↓
          →  调用点赞API    →  心形放大+淡出
   ↓                    ↓                        ↓
          →  更新点赞状态   →  数字+1, 图标变红
   ↓                    ↓                        ↓
          →  触觉反馈      →  轻微震动
```

#### 详细规范

**触发条件**:
- 在图片区域内，300ms内点击两次
- 两次点击的位置距离 < 50px
- 忽略单击事件（单击用于查看详情）

**动画效果**:
```swift
// 阶段1: 心形出现 (0-200ms)
- 心形从0.3倍放大到1.0倍
- 透明度从0到1
- 使用spring动画 (dampingFraction: 0.6)

// 阶段2: 心形强调 (200-400ms)
- 心形从1.0倍放大到1.2倍
- 保持完全不透明

// 阶段3: 心形消失 (400-700ms)
- 心形从1.2倍放大到1.8倍
- 透明度从1降到0
- 使用easeOut动画

// 同时: 底部点赞按钮
- 图标变红
- 数字+1 (带bounce动画)
```

**代码实现**:
```swift
struct DoubleTapLikeModifier: ViewModifier {
    @Binding var isLiked: Bool
    @State private var showHeart = false
    @State private var heartScale: CGFloat = 0.3
    @State private var heartOpacity: Double = 0

    let onLike: () -> Void

    func body(content: Content) -> some View {
        content
            .overlay(
                ZStack {
                    if showHeart {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 100, weight: .bold))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.red, .pink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .scaleEffect(heartScale)
                            .opacity(heartOpacity)
                    }
                }
            )
            .onTapGesture(count: 2) {
                handleDoubleTap()
            }
    }

    private func handleDoubleTap() {
        // 触觉反馈
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()

        // 显示心形动画
        showHeart = true

        // 阶段1: 出现
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            heartScale = 1.0
            heartOpacity = 1.0
        }

        // 阶段2: 强调
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                heartScale = 1.2
            }
        }

        // 阶段3: 消失
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.easeOut(duration: 0.3)) {
                heartScale = 1.8
                heartOpacity = 0
            }
        }

        // 清理
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            showHeart = false
            heartScale = 0.3
            heartOpacity = 0
        }

        // 执行点赞
        if !isLiked {
            isLiked = true
            onLike()
        }
    }
}
```

**容错处理**:
- 如果已经点赞，双击不会取消（避免误操作）
- 如果网络失败，显示错误提示但保留动画效果
- 动画过程中再次双击，不会重复触发

### 4.2 操作栏交互

#### 布局规范

```
┌─────────────────────────────────┐
│                                 │
│  [❤️ 123]  [💬 45]  [⭐ 67]  [↗️] │
│   18px     18px     18px    18px│
│   图标     图标     图标     图标 │
│   ↓        ↓        ↓        ↓  │
│   14px     14px     14px     -- │
│   数字     数字     数字     分享 │
│                                 │
│ ←16px→ ←24px间距→               │
└─────────────────────────────────┘

间距: 左右各16px, 按钮之间24px
高度: 44px (最小触摸区域)
对齐: 垂直居中
```

#### 点赞按钮

**状态**:
```
未点赞:
- 图标: heart (空心)
- 颜色: #999999 (灰色)
- 数字: #666666 (深灰)

已点赞:
- 图标: heart.fill (实心)
- 颜色: #FF3B30 (红色)
- 数字: #FF3B30 (红色)

点击中 (Loading):
- 图标: 旋转的加载器
- 颜色: #FF3B30 (红色)
```

**交互行为**:
```swift
Button {
    // 触觉反馈
    HapticManager.shared.impact(style: .light)

    // 乐观更新 (先更新UI)
    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
        item.isLiked.toggle()
        item.likeCount += item.isLiked ? 1 : -1
    }

    // 数字跳动动画
    withAnimation(.interpolatingSpring(stiffness: 300, damping: 10)) {
        numberBounce = true
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        numberBounce = false
    }

    // 异步调用API
    Task {
        do {
            let result = try await FeedService.shared.toggleLike(itemId: item.id)
            // 如果失败，回滚UI
            if !result.success {
                withAnimation {
                    item.isLiked.toggle()
                    item.likeCount += item.isLiked ? 1 : -1
                }
                showError("点赞失败，请重试")
            }
        } catch {
            // 回滚UI
            withAnimation {
                item.isLiked.toggle()
                item.likeCount += item.isLiked ? 1 : -1
            }
            showError(error.localizedDescription)
        }
    }
} label: {
    HStack(spacing: 4) {
        Image(systemName: item.isLiked ? "heart.fill" : "heart")
            .font(.system(size: 18, weight: .medium))
            .foregroundColor(item.isLiked ? .red : Color(hex: "#999999"))
            .scaleEffect(numberBounce ? 1.2 : 1.0)

        if item.likeCount > 0 {
            Text(formatCount(item.likeCount))
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(item.isLiked ? .red : Color(hex: "#666666"))
                .scaleEffect(numberBounce ? 1.2 : 1.0)
        }
    }
}
.buttonStyle(.plain)
```

#### 评论按钮

**交互行为**:
```swift
NavigationLink(destination: FeedCommentView(feedItem: item)) {
    HStack(spacing: 4) {
        Image(systemName: "bubble.right")
            .font(.system(size: 18, weight: .medium))
            .foregroundColor(Color(hex: "#999999"))

        if item.commentCount > 0 {
            Text(formatCount(item.commentCount))
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color(hex: "#666666"))
        }
    }
}
.buttonStyle(.plain)
```

**跳转动画**:
- 使用默认的 NavigationLink push 动画
- 从右侧滑入

#### 收藏按钮

**状态**:
```
未收藏:
- 图标: star (空心)
- 颜色: #999999 (灰色)

已收藏:
- 图标: star.fill (实心)
- 颜色: #FFB800 (金色)
```

**交互行为**:
```swift
Button {
    HapticManager.shared.impact(style: .light)

    // 星星填充动画
    withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
        item.isBookmarked.toggle()
        if item.isBookmarked {
            item.bookmarkCount += 1
            starScale = 1.3
        } else {
            item.bookmarkCount -= 1
        }
    }

    // 恢复缩放
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
        withAnimation(.easeOut(duration: 0.2)) {
            starScale = 1.0
        }
    }

    Task {
        await viewModel.toggleBookmark(item)
    }
} label: {
    HStack(spacing: 4) {
        Image(systemName: item.isBookmarked ? "star.fill" : "star")
            .font(.system(size: 18, weight: .medium))
            .foregroundColor(item.isBookmarked ? Color(hex: "#FFB800") : Color(hex: "#999999"))
            .scaleEffect(starScale)

        if item.bookmarkCount > 0 {
            Text(formatCount(item.bookmarkCount))
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color(hex: "#666666"))
        }
    }
}
```

#### 分享按钮

**交互行为**:
```swift
Button {
    // 显示分享面板
    showShareSheet = true
} label: {
    Image(systemName: "square.and.arrow.up")
        .font(.system(size: 18, weight: .medium))
        .foregroundColor(Color(hex: "#999999"))
}
.sheet(isPresented: $showShareSheet) {
    ShareSheet(
        activityItems: [
            generateShareText(item),
            generateShareImage(item)
        ]
    )
}
```

### 4.3 评论功能

#### 评论列表页面

**页面结构**:
```
┌─────────────────────────────────┐
│ ← 评论 45                    [⋮] │ ← NavigationBar
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [原帖预览 - 紧凑模式]         │ │ ← 可点击跳转详情
│ │ [小图] 标题 · 用户名          │ │
│ └─────────────────────────────┘ │
│                                 │
│ ──────────────────────────────  │ ← 分隔线
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [头像] 张三  · 1小时前        │ │ ← 评论1
│ │                             │ │
│ │ 这个作品太棒了！             │ │
│ │                             │ │
│ │ [回复] [❤️ 5]                │ │
│ │                             │ │
│ │   └─ [头像] 李四 回复 张三    │ │ ← 回复
│ │      谢谢！                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [头像] 王五  · 30分钟前       │ │ ← 评论2
│ │ ...                         │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
│ [💬 写评论...]           [发送] │ ← 输入框 (固定底部)
└─────────────────────────────────┘
```

#### 评论输入

**交互流程**:
```
点击输入框 → 键盘弹起 → 输入文字 → 点击发送 → 发送中 → 成功/失败
    ↓           ↓          ↓         ↓         ↓          ↓
 获得焦点    输入框上移   实时计数   禁用按钮   Loading  Toast反馈
```

**输入框规范**:
```swift
struct CommentInputBar: View {
    @State private var commentText = ""
    @State private var isSending = false
    @FocusState private var isFocused: Bool

    let maxLength = 500

    var body: some View {
        HStack(spacing: 12) {
            // 输入框
            TextField("写评论...", text: $commentText, axis: .vertical)
                .focused($isFocused)
                .lineLimit(1...5)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(.systemGray6))
                .cornerRadius(20)
                .overlay(alignment: .bottomTrailing) {
                    if !commentText.isEmpty {
                        Text("\(commentText.count)/\(maxLength)")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                            .padding(.trailing, 12)
                            .padding(.bottom, 8)
                    }
                }

            // 发送按钮
            Button {
                sendComment()
            } label: {
                if isSending {
                    ProgressView()
                        .frame(width: 24, height: 24)
                } else {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 20))
                        .foregroundColor(commentText.isEmpty ? .gray : .blue)
                }
            }
            .disabled(commentText.isEmpty || isSending)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }

    private func sendComment() {
        guard !commentText.isEmpty else { return }

        isSending = true
        Task {
            do {
                try await viewModel.postComment(text: commentText)
                // 成功
                commentText = ""
                isFocused = false
                HapticManager.shared.notification(type: .success)
                // 滚动到新评论
                withAnimation {
                    scrollToBottom()
                }
            } catch {
                // 失败
                showError(error.localizedDescription)
                HapticManager.shared.notification(type: .error)
            }
            isSending = false
        }
    }
}
```

**字数限制**:
- 最多500字
- 实时显示剩余字数（超过400字时显示）
- 超过限制时，发送按钮禁用

**表情支持**:
- 支持系统emoji
- 可选：自定义表情包（后续功能）

#### 评论交互

**评论卡片**:
```swift
struct CommentRow: View {
    let comment: Comment
    @State private var showReplyInput = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                // 头像
                AvatarView(
                    avatarUrl: comment.user.avatarUrl,
                    displayName: comment.user.displayName,
                    size: 36
                )
                .onTapGesture {
                    // 跳转用户主页
                    navigateToProfile(comment.user.id)
                }

                VStack(alignment: .leading, spacing: 6) {
                    // 用户名 + 时间
                    HStack(spacing: 6) {
                        Text(comment.user.displayName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.black)

                        Text(comment.timeAgo)
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }

                    // 评论内容
                    Text(comment.content)
                        .font(.system(size: 15))
                        .foregroundColor(Color(hex: "#333333"))
                        .fixedSize(horizontal: false, vertical: true)

                    // 操作按钮
                    HStack(spacing: 16) {
                        Button("回复") {
                            showReplyInput = true
                        }
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                        if comment.replyCount > 0 {
                            Text("\(comment.replyCount)条回复 >")
                                .font(.system(size: 13))
                                .foregroundColor(.blue)
                                .onTapGesture {
                                    // 展开回复列表
                                }
                        }
                    }
                }

                Spacer()

                // 点赞
                VStack(spacing: 4) {
                    Button {
                        withAnimation(.spring()) {
                            viewModel.toggleCommentLike(comment)
                        }
                    } label: {
                        Image(systemName: comment.isLiked ? "heart.fill" : "heart")
                            .font(.system(size: 16))
                            .foregroundColor(comment.isLiked ? .red : .gray)
                    }

                    if comment.likeCount > 0 {
                        Text("\(comment.likeCount)")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                }
            }

            // 回复列表（缩进显示）
            if !comment.replies.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(comment.replies) { reply in
                        ReplyRow(reply: reply)
                            .padding(.leading, 48)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
```

**长按菜单**:
```swift
.contextMenu {
    // 复制
    Button {
        UIPasteboard.general.string = comment.content
    } label: {
        Label("复制", systemImage: "doc.on.doc")
    }

    // 举报（非自己的评论）
    if comment.user.id != currentUserId {
        Button(role: .destructive) {
            showReportSheet = true
        } label: {
            Label("举报", systemImage: "exclamationmark.triangle")
        }
    }

    // 删除（自己的评论）
    if comment.user.id == currentUserId {
        Button(role: .destructive) {
            showDeleteConfirm = true
        } label: {
            Label("删除", systemImage: "trash")
        }
    }
}
```

### 4.4 标签系统

#### 话题标签

**显示样式**:
```swift
struct HashtagTag: View {
    let tag: String

    var body: some View {
        Button {
            // 跳转话题页
            navigateToHashtag(tag)
        } label: {
            Text("#\(tag)")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.blue)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.blue.opacity(0.08))
                .cornerRadius(12)
        }
    }
}
```

**话题页面**:
```
┌─────────────────────────────────┐
│ ← #像素艺术                      │ ← NavigationBar
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📊 话题统计                   │ │ ← 头部卡片
│ │ 123 篇内容 · 4.5K 浏览        │ │
│ │ [+ 关注话题]                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ [最新] [最热]                    │ ← 排序切换
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Feed卡片1                     │ │ ← 话题下的内容
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Feed卡片2                     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### 位置标签

**显示样式**:
```swift
struct LocationTag: View {
    let location: String

    var body: some View {
        Button {
            // 跳转位置页
            navigateToLocation(location)
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "location.fill")
                    .font(.system(size: 11))
                Text(location)
                    .font(.system(size: 13))
            }
            .foregroundColor(.blue)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.blue.opacity(0.08))
            .cornerRadius(10)
        }
    }
}
```

**位置页面**:
```
┌─────────────────────────────────┐
│ ← 📍 北京                        │
├─────────────────────────────────┤
│ [地图预览 - 120px高]             │ ← 可点击查看大地图
├─────────────────────────────────┤
│ 该位置的作品 (89)                │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Feed卡片1                     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 4.5 筛选器交互

#### 筛选栏

**布局**:
```
┌─────────────────────────────────┐
│ [全部▼] 关注 附近      [⋮更多]   │
│  蓝色   灰色  灰色        图标    │
└─────────────────────────────────┘
```

**筛选菜单**:
```swift
Menu {
    Button {
        viewModel.filter = "all"
    } label: {
        Label("全部", systemImage: viewModel.filter == "all" ? "checkmark" : "")
    }

    Button {
        viewModel.filter = "following"
    } label: {
        Label("关注", systemImage: viewModel.filter == "following" ? "checkmark" : "")
    }

    Button {
        viewModel.filter = "nearby"
    } label: {
        Label("附近", systemImage: viewModel.filter == "nearby" ? "checkmark" : "")
    }

    Divider()

    Button {
        viewModel.filter = "trending"
    } label: {
        Label("热门", systemImage: viewModel.filter == "trending" ? "checkmark" : "")
    }

    Button {
        viewModel.filter = "alliance"
    } label: {
        Label("联盟", systemImage: viewModel.filter == "alliance" ? "checkmark" : "")
    }
} label: {
    HStack(spacing: 4) {
        Text(filterTitle(viewModel.filter))
            .font(.system(size: 15, weight: .semibold))
        Image(systemName: "chevron.down")
            .font(.system(size: 12))
    }
    .foregroundColor(.blue)
}
```

**更多筛选**:
```
┌─────────────────────────────────┐
│ 筛选                      [完成] │ ← Sheet标题
├─────────────────────────────────┤
│ 内容类型                         │
│ ☑️ 绘画作品                       │
│ ☑️ 作品展示                       │
│ ☐ 成就                          │
│ ☐ 动态                          │
│                                 │
│ 时间范围                         │
│ ○ 全部                          │
│ ● 今天                          │
│ ○ 本周                          │
│ ○ 本月                          │
│                                 │
│ 排序方式                         │
│ ● 最新                          │
│ ○ 最热                          │
│ ○ 最多点赞                       │
└─────────────────────────────────┘
```

---

## 5. 组件设计规范

### 5.1 FeedItemCard（大图版）

**组件结构**:
```swift
struct FeedItemCard: View {
    let item: FeedService.FeedItem
    @State private var showHeartAnimation = false

    var body: some View {
        VStack(spacing: 0) {
            // 1. 图片区域
            imageSection

            // 2. 内容区域
            VStack(alignment: .leading, spacing: 12) {
                // 标题
                if let title = item.title {
                    titleSection
                }

                // 作者信息
                authorSection

                // 标签
                tagsSection

                // 操作栏
                actionBar
            }
            .padding(16)
        }
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
        .onTapGesture {
            // 单击查看详情
            navigateToDetail()
        }
    }

    private var imageSection: some View {
        ZStack {
            // 图片
            AsyncImage(url: URL(string: item.thumbnailUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    placeholderImage
                case .empty:
                    loadingImage
                @unknown default:
                    EmptyView()
                }
            }
            .frame(height: 280)
            .clipped()
            .background(Color.gray.opacity(0.1))

            // 双击点赞动画
            if showHeartAnimation {
                HeartAnimationView()
            }
        }
        .onTapGesture(count: 2) {
            handleDoubleTap()
        }
    }
}
```

**尺寸规范**:
- 卡片宽度: 屏幕宽度 - 32px（左右各16px）
- 图片高度: 280px（固定）
- 内容区padding: 16px
- 卡片间距: 16px
- 圆角: 12px

### 5.2 图片加载组件

**AsyncImage 包装**:
```swift
struct FeedImageView: View {
    let url: String?
    let height: CGFloat
    @State private var isLoading = true

    var body: some View {
        GeometryReader { geometry in
            AsyncImage(url: URL(string: url ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: geometry.size.width, height: height)
                        .clipped()
                        .onAppear { isLoading = false }

                case .failure:
                    // 加载失败
                    VStack(spacing: 8) {
                        Image(systemName: "photo")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                        Text("加载失败")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .frame(width: geometry.size.width, height: height)
                    .background(Color(.systemGray6))

                case .empty:
                    // 加载中
                    SkeletonView()
                        .frame(width: geometry.size.width, height: height)

                @unknown default:
                    EmptyView()
                }
            }
        }
        .frame(height: height)
    }
}
```

### 5.3 骨架屏组件

**卡片骨架**:
```swift
struct FeedCardSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            // 图片骨架
            Rectangle()
                .fill(Color.gray.opacity(0.2))
                .frame(height: 280)
                .shimmer()

            VStack(alignment: .leading, spacing: 12) {
                // 标题骨架
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cornerRadius(4)
                    .shimmer()

                // 作者骨架
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 32, height: 32)
                        .shimmer()

                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 120, height: 14)
                        .cornerRadius(4)
                        .shimmer()
                }

                // 标签骨架
                HStack(spacing: 8) {
                    ForEach(0..<2, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 80, height: 24)
                            .cornerRadius(12)
                            .shimmer()
                    }
                }

                // 操作栏骨架
                HStack(spacing: 24) {
                    ForEach(0..<3, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 60, height: 24)
                            .cornerRadius(4)
                            .shimmer()
                    }
                }
            }
            .padding(16)
        }
        .background(Color.white)
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }
}

// Shimmer 动画
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    gradient: Gradient(stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .white.opacity(0.3), location: 0.5),
                        .init(color: .clear, location: 1)
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .mask(content)
            )
            .onAppear {
                withAnimation(
                    .linear(duration: 1.5)
                    .repeatForever(autoreverses: false)
                ) {
                    phase = 400
                }
            }
    }
}
```

### 5.4 空状态组件

**空列表**:
```swift
struct FeedEmptyView: View {
    let filter: String

    var body: some View {
        VStack(spacing: 24) {
            // 图标
            Image(systemName: emptyIcon)
                .font(.system(size: 60))
                .foregroundColor(.gray.opacity(0.5))

            VStack(spacing: 8) {
                // 标题
                Text(emptyTitle)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.black)

                // 副标题
                Text(emptyMessage)
                    .font(.system(size: 14))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // 操作按钮（可选）
            if let action = emptyAction {
                Button {
                    action.handler()
                } label: {
                    Text(action.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(20)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyIcon: String {
        switch filter {
        case "following": return "person.2"
        case "nearby": return "location"
        default: return "square.stack.3d.up.slash"
        }
    }

    private var emptyTitle: String {
        switch filter {
        case "following": return "还没有关注的人"
        case "nearby": return "附近暂无内容"
        default: return "暂无内容"
        }
    }

    private var emptyMessage: String {
        switch filter {
        case "following": return "关注一些有趣的创作者，看看他们的作品吧"
        case "nearby": return "这里还没有人创作，快来成为第一个吧"
        default: return "暂时还没有内容，稍后再来看看"
        }
    }
}
```

---

## 6. 动画与过渡

### 6.1 动画时长标准

| 动画类型 | 时长 | 缓动函数 | 用途 |
|---------|------|---------|------|
| 微交互 | 150ms | easeOut | 按钮点击、状态切换 |
| 标准 | 300ms | easeInOut | 页面过渡、卡片展开 |
| 强调 | 500ms | spring | 点赞动画、成功反馈 |
| 长动画 | 800ms+ | custom | 复杂动画、引导 |

### 6.2 核心动画

#### 点赞动画
```swift
// 持续时长: 700ms
// 阶段1 (0-200ms): 出现
.spring(response: 0.3, dampingFraction: 0.6)

// 阶段2 (200-400ms): 强调
.spring(response: 0.2, dampingFraction: 0.8)

// 阶段3 (400-700ms): 消失
.easeOut(duration: 0.3)
```

#### 列表滚动
```swift
// 滚动到底部加载更多
ScrollView {
    LazyVStack {
        ForEach(items) { item in
            FeedItemCard(item: item)
                .onAppear {
                    if isLastItem(item) {
                        loadMore()
                    }
                }
        }

        if isLoadingMore {
            ProgressView()
                .padding()
                .transition(.opacity)
        }
    }
}
.animation(.easeInOut(duration: 0.3), value: items.count)
```

#### 下拉刷新
```swift
.refreshable {
    await viewModel.refresh()
}
// 使用系统默认的下拉刷新动画
```

#### 卡片入场
```swift
// 从底部淡入
.transition(
    .asymmetric(
        insertion: .opacity.combined(with: .offset(y: 20)),
        removal: .opacity
    )
)
.animation(.easeOut(duration: 0.3), value: viewModel.items.count)
```

### 6.3 页面转场

#### Push (NavigationLink)
```swift
// 使用默认的 push 动画
NavigationLink(destination: DetailView()) {
    CardView()
}
// 从右侧滑入，支持右滑返回
```

#### Present (Sheet)
```swift
.sheet(isPresented: $showSheet) {
    CommentView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}
// 从底部弹出，支持下滑关闭
```

#### Full Screen
```swift
.fullScreenCover(isPresented: $showFullScreen) {
    ImageViewer()
}
// 全屏覆盖
```

---

## 7. 状态与反馈

### 7.1 加载状态

#### 初始加载
```swift
if viewModel.isLoading && viewModel.items.isEmpty {
    VStack(spacing: 16) {
        ForEach(0..<3, id: \.self) { _ in
            FeedCardSkeleton()
        }
    }
}
```

#### 加载更多
```swift
if isLoadingMore {
    HStack {
        ProgressView()
        Text("加载中...")
            .font(.system(size: 14))
            .foregroundColor(.gray)
    }
    .padding()
}
```

#### 下拉刷新
```swift
// 使用系统 .refreshable 修饰符
// 顶部自动显示刷新指示器
```

### 7.2 错误状态

#### 网络错误
```swift
if let error = viewModel.error {
    VStack(spacing: 16) {
        Image(systemName: "wifi.slash")
            .font(.system(size: 50))
            .foregroundColor(.gray)

        Text("网络连接失败")
            .font(.system(size: 17, weight: .semibold))

        Text(error.localizedDescription)
            .font(.system(size: 14))
            .foregroundColor(.gray)
            .multilineTextAlignment(.center)

        Button("重试") {
            Task {
                await viewModel.refresh()
            }
        }
        .buttonStyle(.borderedProminent)
    }
    .padding()
}
```

#### Toast 提示
```swift
struct ToastView: View {
    let message: String
    let type: ToastType

    enum ToastType {
        case success
        case error
        case info
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.system(size: 18))

            Text(message)
                .font(.system(size: 14))
        }
        .foregroundColor(.white)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(backgroundColor)
        .cornerRadius(24)
        .shadow(radius: 8)
    }

    private var iconName: String {
        switch type {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .info: return "info.circle.fill"
        }
    }

    private var backgroundColor: Color {
        switch type {
        case .success: return Color.green
        case .error: return Color.red
        case .info: return Color.blue
        }
    }
}

// 使用
.overlay(alignment: .top) {
    if let toast = viewModel.toast {
        ToastView(message: toast.message, type: toast.type)
            .padding(.top, 50)
            .transition(.move(edge: .top).combined(with: .opacity))
    }
}
```

### 7.3 触觉反馈

```swift
enum HapticManager {
    static func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }

    static func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }

    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// 使用场景
// 点赞: .impact(style: .light)
// 双击点赞: .impact(style: .medium)
// 删除: .notification(type: .warning)
// 成功: .notification(type: .success)
// 失败: .notification(type: .error)
// 切换筛选: .selection()
```

---

## 8. 边界情况

### 8.1 数据边界

#### 空数据
- 首次加载无数据 → 显示空状态引导
- 筛选后无数据 → 显示"暂无符合条件的内容"
- 关注无人后查看关注feed → 引导去关注

#### 大数据量
- 单次加载20条
- 超过100条后，清除顶部旧数据（保持性能）
- 图片懒加载，离屏卸载

#### 数字显示
```swift
func formatCount(_ count: Int) -> String {
    switch count {
    case 0:
        return "" // 不显示0
    case 1..<1000:
        return "\(count)"
    case 1000..<10000:
        return String(format: "%.1fk", Double(count) / 1000)
    case 10000..<100000:
        return String(format: "%.1fw", Double(count) / 10000)
    default:
        return "10w+"
    }
}

// 示例
// 0 → ""
// 5 → "5"
// 1234 → "1.2k"
// 12345 → "1.2w"
// 100000 → "10w+"
```

### 8.2 网络边界

#### 离线模式
```swift
if networkMonitor.isDisconnected {
    // 显示缓存内容 + 离线提示
    VStack {
        HStack {
            Image(systemName: "wifi.slash")
            Text("离线模式，显示缓存内容")
        }
        .font(.caption)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.1))

        // 缓存的Feed列表
        cachedFeedList
    }
}
```

#### 加载失败重试
```swift
if let error = viewModel.loadError {
    VStack(spacing: 16) {
        Text("加载失败")
        Button("重试") {
            Task { await viewModel.retry() }
        }
    }
}
```

#### 超时处理
- API调用超时: 15秒
- 图片加载超时: 10秒
- 超时后显示错误状态

### 8.3 内容边界

#### 长文本
```swift
// 标题最多2行，超出显示省略号
Text(title)
    .lineLimit(2)
    .truncationMode(.tail)

// 评论可以展开
@State private var isExpanded = false

Text(comment.content)
    .lineLimit(isExpanded ? nil : 3)
    .onTapGesture {
        withAnimation {
            isExpanded.toggle()
        }
    }

if !isExpanded && comment.content.count > 100 {
    Text("展开")
        .foregroundColor(.blue)
        .font(.caption)
}
```

#### 图片异常
- 加载失败 → 显示占位图 + "加载失败"
- URL无效 → 显示默认占位图
- 尺寸异常 → 裁剪填充

#### 标签过多
```swift
// 最多显示3个标签
let displayTags = Array(tags.prefix(3))

HStack(spacing: 8) {
    ForEach(displayTags, id: \.self) { tag in
        TagView(tag: tag)
    }

    if tags.count > 3 {
        Text("+\(tags.count - 3)")
            .font(.caption)
            .foregroundColor(.gray)
    }
}
```

### 8.4 用户行为边界

#### 快速连续点击
```swift
// 防抖动
@State private var lastTapTime: Date = .distantPast
let debounceInterval: TimeInterval = 0.5

func handleTap() {
    let now = Date()
    guard now.timeIntervalSince(lastTapTime) > debounceInterval else {
        return // 忽略快速连续点击
    }
    lastTapTime = now

    // 执行操作
    performAction()
}
```

#### 重复提交
```swift
// 提交中禁用按钮
Button {
    submitComment()
} label: {
    if isSubmitting {
        ProgressView()
    } else {
        Text("发送")
    }
}
.disabled(isSubmitting || commentText.isEmpty)
```

---

## 9. 可访问性

### 9.1 VoiceOver 支持

```swift
FeedItemCard(item: item)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("""
        \(item.user.displayName) 的作品。
        标题：\(item.title ?? "无标题")。
        \(item.likeCount) 个赞，\(item.commentCount) 条评论。
        发布于 \(item.timeAgo)
    """)
    .accessibilityHint("双击查看详情")
    .accessibilityAddTraits(.isButton)
```

### 9.2 动态字体

```swift
// 支持系统动态字体
Text(title)
    .font(.system(size: 16, weight: .bold))
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
```

### 9.3 高对比度

```swift
@Environment(\.colorSchemeContrast) var contrast

var textColor: Color {
    contrast == .increased ? .black : Color(hex: "#333333")
}
```

---

## 10. 技术实现

### 10.1 数据模型

```swift
// FeedItem 扩展
struct FeedItem: Codable, Identifiable {
    var id: String
    var type: FeedType
    var user: FeedUser
    var createdAt: Date
    var content: FeedContent

    // 新增字段
    var title: String?              // 标题
    var thumbnailUrl: String?       // 缩略图URL
    var images: [String]?           // 多图URLs
    var hashtags: [String]?         // 话题标签 ["像素艺术", "打卡"]

    // 互动数据
    var likeCount: Int = 0
    var commentCount: Int = 0
    var bookmarkCount: Int = 0
    var shareCount: Int = 0

    // 用户状态
    var isLiked: Bool = false
    var isBookmarked: Bool = false

    // 计算属性
    var timeAgo: String {
        // 实现相对时间显示
        // 1分钟内 → "刚刚"
        // 1-60分钟 → "X分钟前"
        // 1-24小时 → "X小时前"
        // 1-7天 → "X天前"
        // >7天 → "MM-DD"
    }
}

enum FeedType: String, Codable {
    case drawingComplete = "drawing_complete"
    case showcase = "showcase"
    case achievement = "achievement"
    case moment = "moment"
    case poll = "poll"
}

struct FeedUser: Codable {
    var id: String
    var displayName: String
    var avatarUrl: String?
    var avatar: String?  // 像素头像数据
    var badgeType: String?  // 认证标识
}

struct FeedContent: Codable {
    // 通用字段
    var text: String?
    var city: String?
    var location: Location?

    // 绘画相关
    var pixelCount: Int?
    var durationSeconds: Int?
    var drawingSessionId: String?

    // 成就相关
    var achievementName: String?
    var achievementIcon: String?

    struct Location: Codable {
        var latitude: Double
        var longitude: Double
        var address: String?
    }
}
```

### 10.2 ViewModel

```swift
@MainActor
class FeedViewModel: ObservableObject {
    @Published var items: [FeedService.FeedItem] = []
    @Published var filter: String = "all"
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: Error?
    @Published var toast: Toast?

    private var currentPage = 1
    private var hasMore = true

    // 加载Feed
    func loadFeed(refresh: Bool = false) async {
        if refresh {
            currentPage = 1
            hasMore = true
            isLoading = true
        }

        do {
            let newItems = try await FeedService.shared.getFeed(
                filter: filter,
                page: currentPage,
                limit: 20
            )

            if refresh {
                items = newItems
            } else {
                items.append(contentsOf: newItems)
            }

            hasMore = newItems.count >= 20
            currentPage += 1
            error = nil
        } catch {
            self.error = error
            showToast("加载失败", type: .error)
        }

        isLoading = false
    }

    // 加载更多
    func loadMore() async {
        guard !isLoadingMore && hasMore else { return }
        isLoadingMore = true
        await loadFeed(refresh: false)
        isLoadingMore = false
    }

    // 点赞
    func toggleLike(item: FeedService.FeedItem) async {
        // 乐观更新
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].isLiked.toggle()
            items[index].likeCount += items[index].isLiked ? 1 : -1

            do {
                let result = try await FeedService.shared.toggleLike(itemId: item.id)
                // 同步服务器返回的真实数据
                items[index].likeCount = result.likeCount
            } catch {
                // 回滚
                items[index].isLiked.toggle()
                items[index].likeCount += items[index].isLiked ? 1 : -1
                showToast("操作失败", type: .error)
            }
        }
    }

    // 收藏
    func toggleBookmark(item: FeedService.FeedItem) async {
        // 类似点赞实现...
    }

    // 显示Toast
    private func showToast(_ message: String, type: ToastType) {
        toast = Toast(message: message, type: type)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.toast = nil
        }
    }
}
```

### 10.3 Service层

```swift
class FeedService {
    static let shared = FeedService()

    // 获取Feed列表
    func getFeed(
        filter: String,
        page: Int,
        limit: Int
    ) async throws -> [FeedItem] {
        let endpoint = "/api/feed"
        let params = [
            "filter": filter,
            "page": "\(page)",
            "limit": "\(limit)"
        ]

        let response: FeedResponse = try await APIManager.shared.request(
            endpoint: endpoint,
            method: .get,
            parameters: params
        )

        return response.items
    }

    // 点赞
    func toggleLike(itemId: String) async throws -> LikeResult {
        let endpoint = "/api/feed/\(itemId)/like"
        return try await APIManager.shared.request(
            endpoint: endpoint,
            method: .post
        )
    }

    // 发表评论
    func postComment(
        itemId: String,
        text: String,
        replyTo: String?
    ) async throws -> Comment {
        let endpoint = "/api/feed/\(itemId)/comments"
        let body = [
            "text": text,
            "reply_to": replyTo
        ]

        return try await APIManager.shared.request(
            endpoint: endpoint,
            method: .post,
            body: body
        )
    }
}

struct FeedResponse: Codable {
    var items: [FeedItem]
    var hasMore: Bool
    var nextPage: Int?
}

struct LikeResult: Codable {
    var success: Bool
    var likeCount: Int
    var isLiked: Bool
}
```

---

## 附录

### A. 设计检查清单

在实施每个功能前，请检查：

- [ ] 是否符合小红书的视觉风格？
- [ ] 是否有足够的视觉反馈？
- [ ] 是否处理了加载/错误/空状态？
- [ ] 是否支持可访问性？
- [ ] 是否有触觉反馈？
- [ ] 动画时长是否合理（150-500ms）？
- [ ] 是否有防抖/节流？
- [ ] 是否处理了离线情况？
- [ ] 图片是否懒加载？
- [ ] 是否有骨架屏？

### B. 测试场景

**功能测试**:
- [ ] 双击点赞
- [ ] 单击查看详情
- [ ] 点赞/收藏/评论
- [ ] 筛选切换
- [ ] 下拉刷新
- [ ] 上滑加载更多
- [ ] 话题/位置跳转

**边界测试**:
- [ ] 空数据
- [ ] 网络断开
- [ ] 加载失败
- [ ] 快速连续点击
- [ ] 大量数据滚动

**性能测试**:
- [ ] 滚动流畅度（60fps）
- [ ] 图片加载速度
- [ ] 内存占用
- [ ] 电量消耗

### C. 设计规范速查

| 元素 | 规范 |
|------|------|
| 卡片圆角 | 12px |
| 卡片间距 | 16px |
| 内容padding | 16px |
| 图片高度 | 280px |
| 标题字号 | 16px bold |
| 正文字号 | 15px regular |
| 辅助字号 | 14px/13px/12px |
| 图标大小 | 18px (操作栏), 16px (评论) |
| 头像大小 | 36px (卡片), 32px (评论) |
| 按钮高度 | 44px (最小触摸区域) |
| 动画时长 | 150ms/300ms/500ms |

---

## 结语

本设计规范基于小红书的成功经验，针对FunnyPixels的像素创作场景进行了适配。核心理念是：

1. **视觉驱动** - 让作品说话
2. **交互轻量** - 降低参与门槛
3. **反馈及时** - 增强成就感
4. **细节用心** - 提升品质感

实施时请严格遵循本规范，同时保持灵活性，根据实际用户反馈进行迭代优化。
