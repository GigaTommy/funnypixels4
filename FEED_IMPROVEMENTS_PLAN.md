# 动态Tab改进方案

## 🐛 当前问题

### 问题1: 无法查看会话足迹详情 ❌

**用户反馈**: 点击动态记录无法查看被关注对象的该次会话的足迹

**当前状态**:
- ✅ `SessionDetailView` 存在
- ✅ FeedItem包含 `drawing_session_id` 字段
- ❌ `FeedItemCard` 没有实现点击跳转到会话详情的功能
- ❌ 无法查看绘制路径、完整统计数据

**影响范围**:
- `drawing_complete` 类型动态（完成绘制）
- `showcase` 类型动态（作品展示）

### 问题2: 隐私设置未应用到动态流 ❌

**用户需求**: 如果被关注用户设置了昵称、联盟等隐私，动态tab应该同步控制

**当前状态**:
- ✅ `privacy_settings` 表存在
- ✅ 像素查询已实现隐私控制（`productionPixelTileQuery.js`）
- ❌ `feedController.js` **未应用隐私设置**
- ❌ 直接返回 `display_name`、`avatar`、`联盟信息`

**隐私字段**:
- `hide_nickname` - 隐藏昵称
- `hide_alliance` - 隐藏联盟
- `hide_alliance_flag` - 隐藏联盟旗帜

**风险**:
- 🚨 隐私泄露：用户设置的隐私在动态流中无效
- 🚨 不一致：地图上隐藏了昵称，但动态流显示

## ✅ 修复方案

### 方案1: 添加会话详情跳转

#### 后端修改（可选，如果需要更多信息）

无需修改，`drawing_session_id` 已经返回。

#### iOS修改

**文件**: `FeedItemCard.swift`

**修改1: 为绘制类型动态添加NavigationLink**

```swift
// 位置：drawingContent 和 showcaseContent

private var drawingContent: some View {
    NavigationLink(destination: SessionDetailView(sessionId: item.content.drawing_session_id ?? "")) {
        VStack(alignment: .leading, spacing: FeedDesign.Spacing.xs) {
            Text(String(format: NSLocalizedString("feed.drawing.description", comment: ""), item.content.pixel_count ?? 0))
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.text)

            // 元数据：像素数 · 位置 · 时长
            HStack(spacing: 4) {
                // ... 现有代码
            }

            // ✨ 新增：查看详情提示
            HStack {
                Spacer()
                Text(NSLocalizedString("feed.view_details", comment: "View Details"))
                    .font(FeedDesign.Typography.caption)
                    .foregroundColor(FeedDesign.Colors.primary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(FeedDesign.Colors.primary)
            }
            .padding(.top, 4)
        }
    }
    .buttonStyle(PlainButtonStyle())
}
```

**修改2: FeedItem.Content需要包含drawing_session_id**

检查 `FeedService.swift` 中的 `FeedItem.Content` 结构：

```swift
struct Content: Codable {
    let text: String?
    let images: [String]?
    let pixel_count: Int?
    let city: String?
    let duration_seconds: Int?
    let achievement_name: String?
    let alliance_name: String?
    let drawing_session_id: String?  // ✅ 确保包含此字段
}
```

### 方案2: 应用隐私设置到动态流

#### 后端修改

**文件**: `backend/src/controllers/feedController.js`

**修改1: JOIN privacy_settings表**

```javascript
// 位置：getFeed方法，~line 17

let query = db('feed_items')
  .leftJoin('users', 'feed_items.user_id', 'users.id')
  .leftJoin('privacy_settings as ps', 'feed_items.user_id', 'ps.user_id')  // ✅ 添加
  .leftJoin('alliance_members as am', 'feed_items.user_id', 'am.user_id')  // ✅ 添加（用于联盟信息）
  .leftJoin('alliances as al', 'am.alliance_id', 'al.id')  // ✅ 添加
  .leftJoin('feed_likes as my_like', function() {
    this.on('my_like.feed_item_id', 'feed_items.id')
        .andOnVal('my_like.user_id', currentUserId);
  })
  // ... 其他JOIN
```

**修改2: 应用隐私规则到SELECT字段**

```javascript
.select(
  'feed_items.*',
  'users.username',
  // ✅ 隐私控制：昵称
  db.raw(`
    CASE
      WHEN ps.hide_nickname = true THEN NULL
      ELSE users.display_name
    END as display_name
  `),
  // ✅ 隐私控制：头像
  db.raw(`
    CASE
      WHEN ps.hide_nickname = true THEN NULL
      ELSE users.avatar_url
    END as avatar_url
  `),
  db.raw(`
    CASE
      WHEN ps.hide_nickname = true THEN NULL
      ELSE users.avatar
    END as avatar
  `),
  // ✅ 隐私控制：联盟名称
  db.raw(`
    CASE
      WHEN ps.hide_alliance = true THEN NULL
      ELSE al.name
    END as alliance_name
  `),
  // ✅ 隐私控制：联盟旗帜
  db.raw(`
    CASE
      WHEN ps.hide_alliance_flag = true THEN NULL
      ELSE al.flag_pattern_id
    END as alliance_flag_pattern_id
  `),
  db.raw('CASE WHEN my_like.id IS NOT NULL THEN true ELSE false END as is_liked'),
  db.raw('CASE WHEN my_bookmark.id IS NOT NULL THEN true ELSE false END as is_bookmarked'),
  'my_vote.option_index as my_vote_option_index'
)
```

**修改3: 更新mappedItems返回数据**

```javascript
const mappedItems = items.map(item => ({
  id: item.id,
  type: item.type,
  content: item.content,
  drawing_session_id: item.drawing_session_id,
  like_count: item.like_count,
  comment_count: item.comment_count,
  is_liked: !!item.is_liked,
  is_bookmarked: !!item.is_bookmarked,
  poll_data: item.poll_data,
  my_vote_option_index: item.my_vote_option_index !== null ? item.my_vote_option_index : null,
  created_at: item.created_at,
  user: {
    id: item.user_id,
    username: item.username,
    display_name: item.display_name || item.username,  // ✅ fallback to username
    avatar_url: item.avatar_url,  // ✅ 可能为null（隐私）
    avatar: item.avatar,          // ✅ 可能为null（隐私）
    alliance_name: item.alliance_name,  // ✅ 新增
    alliance_flag_pattern_id: item.alliance_flag_pattern_id  // ✅ 新增
  }
}));
```

#### iOS修改

**文件**: `FeedService.swift`

**修改: 更新FeedItem.User结构**

```swift
struct User: Codable {
    let id: String
    let username: String
    let display_name: String?  // ✅ 可能为nil（隐私）
    let avatar_url: String?    // ✅ 可能为nil（隐私）
    let avatar: String?        // ✅ 可能为nil（隐私）
    let alliance_name: String?          // ✅ 新增
    let alliance_flag_pattern_id: String?  // ✅ 新增

    var displayName: String {
        display_name ?? username  // ✅ fallback
    }
}
```

**文件**: `FeedItemCard.swift`

**修改: 处理隐私情况**

```swift
// 头部用户信息
NavigationLink(destination: UserProfileView(userId: item.user.id)) {
    HStack(spacing: FeedDesign.Spacing.s) {
        // ✅ 头像：如果隐私隐藏，显示默认头像
        AvatarView(
            avatarUrl: item.user.avatar_url,  // 可能为nil
            avatar: item.user.avatar,          // 可能为nil
            displayName: item.user.displayName,
            size: 40
        )

        VStack(alignment: .leading, spacing: 2) {
            // ✅ 昵称：使用displayName（已包含fallback逻辑）
            Text(item.user.displayName)
                .font(FeedDesign.Typography.body)
                .foregroundColor(FeedDesign.Colors.text)
                .lineLimit(1)

            // ✅ 联盟标识（如果未隐藏）
            if let allianceName = item.user.alliance_name {
                HStack(spacing: 4) {
                    if let flagId = item.user.alliance_flag_pattern_id {
                        AllianceBadge(patternId: flagId, size: 12)
                    }
                    Text(allianceName)
                        .font(FeedDesign.Typography.caption)
                        .foregroundColor(FeedDesign.Colors.textSecondary)
                }
            }

            Text(item.timeAgo)
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.textSecondary)
        }

        Spacer()
    }
}
```

## 📊 修复前后对比

### 问题1: 会话详情跳转

**修复前** ❌:
```
用户点击动态卡片
  ↓
无反应，无法查看会话详情
  ↓
用户困惑：这次绘制的路径是什么样的？
```

**修复后** ✅:
```
用户点击动态卡片
  ↓
跳转到 SessionDetailView
  ↓
显示完整会话信息：
  - 绘制路径可视化
  - 详细统计数据
  - 地图位置
  - 时间线
```

### 问题2: 隐私控制

**修复前** ❌:
```
用户A设置：hide_nickname = true, hide_alliance = true
  ↓
用户B查看动态流
  ↓
仍然显示用户A的昵称和联盟 ❌
  ↓
隐私泄露！
```

**修复后** ✅:
```
用户A设置：hide_nickname = true, hide_alliance = true
  ↓
后端查询时应用隐私规则
  ↓
用户B查看动态流
  ↓
显示：用户名（非昵称）+ 无联盟信息 ✅
  ↓
隐私保护生效！
```

## 🧪 测试清单

### 功能测试

#### 会话详情跳转
- [ ] 点击`drawing_complete`类型动态 → 跳转到SessionDetailView
- [ ] 点击`showcase`类型动态 → 跳转到SessionDetailView
- [ ] SessionDetailView正确显示会话信息
- [ ] 路径可视化正常显示

#### 隐私控制
- [ ] 设置`hide_nickname=true` → 动态流显示用户名而非昵称
- [ ] 设置`hide_alliance=true` → 动态流不显示联盟信息
- [ ] 设置`hide_alliance_flag=true` → 动态流不显示联盟旗帜
- [ ] 未设置隐私 → 正常显示所有信息
- [ ] 隐私设置与地图一致（地图和动态流都应用相同规则）

### 边界测试

#### 会话详情
- [ ] `drawing_session_id` 为空时不崩溃
- [ ] 会话已删除时显示友好提示
- [ ] 其他类型动态（非绘制）不显示"查看详情"链接

#### 隐私
- [ ] 用户未创建`privacy_settings`记录 → 使用默认值（显示所有）
- [ ] `display_name`为null → fallback到`username`
- [ ] `avatar`为null → 显示默认头像
- [ ] 联盟信息为null → 不显示联盟标识

## 📝 实施步骤

### 阶段1: 会话详情跳转（高优先级）

1. **iOS修改**:
   - [ ] 修改`FeedItemCard.swift` - 添加NavigationLink
   - [ ] 验证`FeedService.swift` - 确保`drawing_session_id`字段存在
   - [ ] 添加"查看详情"提示UI

2. **测试**:
   - [ ] 真机测试点击跳转
   - [ ] 验证SessionDetailView显示正确

**预计时间**: 30分钟

### 阶段2: 隐私控制（高优先级）

1. **后端修改**:
   - [ ] 修改`feedController.js` - JOIN privacy_settings
   - [ ] 应用隐私规则到SELECT
   - [ ] 更新返回数据结构

2. **iOS修改**:
   - [ ] 更新`FeedService.swift` - User结构
   - [ ] 更新`FeedItemCard.swift` - 处理隐私情况
   - [ ] 添加联盟信息显示

3. **测试**:
   - [ ] 后端测试：不同隐私设置的返回数据
   - [ ] iOS测试：显示效果
   - [ ] 一致性测试：与地图隐私对比

**预计时间**: 1-1.5小时

## 🔍 相关文件

### iOS
- `FunnyPixelsApp/Views/Feed/FeedItemCard.swift` - 动态卡片UI
- `FunnyPixelsApp/Services/FeedService.swift` - 动态数据模型
- `FunnyPixelsApp/Views/SessionDetailView.swift` - 会话详情页

### 后端
- `backend/src/controllers/feedController.js` - 动态流控制器
- `backend/src/models/PrivacySettings.js` - 隐私设置模型
- `backend/src/models/productionPixelTileQuery.js` - 地图隐私参考

## 💡 未来优化建议

1. **更丰富的会话展示**:
   - 在动态卡片中显示会话路径缩略图
   - 使用PathArtworkView预览

2. **隐私设置UI**:
   - 在iOS设置页面添加隐私控制
   - 实时预览隐私效果

3. **性能优化**:
   - 缓存SessionDetail数据
   - 预加载会话缩略图

---

## ✅ 立即开始实施

请确认是否开始修复？我将按照以下顺序实施：

1. ✅ 阶段1: 添加会话详情跳转（更快见效）
2. ✅ 阶段2: 应用隐私控制（更重要）

或者您想先实施哪个？
