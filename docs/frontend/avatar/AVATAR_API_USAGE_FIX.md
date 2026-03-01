# Avatar字段使用规范修复

**日期**: 2026-02-23
**原则**: 所有显示场景使用`avatar_url`，`avatar`字段仅后端内部使用

---

## 📋 修复清单

### ✅ 已修复

1. **AuthManager.swift** (第269行)
   - ❌ 修改前: `avatar: response.avatar`
   - ✅ 修改后: `avatar: nil`  // 前端不使用

2. **AchievementTabView.swift** (第142-143行)
   - ❌ 修改前: `avatarUrl: user.avatar, avatar: user.avatar`
   - ✅ 修改后: `avatarUrl: user.avatarUrl, avatar: nil`

3. **ProfileViewModel.swift** (第266行)
   - ❌ 修改前: `avatarUrl: user.avatar`
   - ✅ 修改后: `avatarUrl: user.avatarUrl`

4. **MapTabContent.swift** (第53行)
   - ❌ 修改前: `let hasAvatar = AuthManager.shared.currentUser?.avatar?.contains(",") == true`
   - ✅ 修改后: 检查`avatarUrl`是否存在

5. **MapTabContent.swift** (第108-114行) - FlagSelectionSheet参数
   - ❌ 修改前: 检查`avatar`字段
   - ✅ 修改后: 检查`avatarUrl`字段

6. **FlagSelectionSheet.swift** (第25行)
   - ❌ 修改前: `PixelAvatarView(pixelData: avatar, size: 32)`
   - ✅ 修改后: `AvatarView(avatarUrl: avatarUrl, ...)`

---

### 🔧 需要修复的AvatarView调用

根据grep结果，以下文件的AvatarView调用需要移除`avatar`参数：

#### 1. SessionSummaryView.swift (第199-204行)
```swift
// 修改前
AvatarView(
    avatarUrl: nil,
    avatar: currentUser?.avatar,
    displayName: currentUser?.displayOrUsername ?? "Pixel Artist",
    flagPatternId: flagPatternId,
    size: 40
)

// 修改后
AvatarView(
    avatarUrl: currentUser?.avatarUrl,  // ✅ 使用avatar_url
    displayName: currentUser?.displayOrUsername ?? "Pixel Artist",
    flagPatternId: flagPatternId,
    size: 40
)
```

#### 2. LeaderboardTabView.swift (第301-306行 和 433-438行)
```swift
// 修改前
AvatarView(
    avatarUrl: entry.avatar_url,
    avatar: entry.avatar,  // ❌ 移除
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)

// 修改后
AvatarView(
    avatarUrl: entry.avatar_url,  // ✅ 只使用avatar_url
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)
```

#### 3. FollowListView.swift (第112-117行)
```swift
// 修改前
AvatarView(
    avatarUrl: user.avatarUrl,
    avatar: user.avatar,  // ❌ 移除
    displayName: user.displayOrUsername,
    flagPatternId: nil,
    size: 40
)

// 修改后
AvatarView(
    avatarUrl: user.avatarUrl,  // ✅ 只使用avatar_url
    displayName: user.displayOrUsername,
    size: 40
)
```

#### 4. FeedCommentSheet.swift (第131-136行)
```swift
// 修改前
AvatarView(
    avatarUrl: comment.user.avatar_url,
    avatar: comment.user.avatar,  // ❌ 移除
    displayName: comment.user.displayName,
    size: 32
)

// 修改后
AvatarView(
    avatarUrl: comment.user.avatar_url,  // ✅ 只使用avatar_url
    displayName: comment.user.displayName,
    size: 32
)
```

#### 5. ProfileTabView.swift (第115-120行)
```swift
// 修改前
AvatarView(
    avatarUrl: profile.avatarUrl,
    avatar: profile.avatar,  // ❌ 移除
    displayName: profile.displayOrUsername,
    flagPatternId: profile.flagPatternId,
    size: 60 * fontManager.scale
)

// 修改后
AvatarView(
    avatarUrl: profile.avatarUrl,  // ✅ 只使用avatar_url
    displayName: profile.displayOrUsername,
    flagPatternId: profile.flagPatternId,
    size: 60 * fontManager.scale
)
```

#### 6. AchievementShareView.swift (第103-108行)
```swift
// 修改前
AvatarView(
    avatarUrl: userProfile?.avatarUrl,
    avatar: userProfile?.avatar,  // ❌ 移除
    displayName: userProfile?.displayOrUsername ?? "PixelArtist",
    flagPatternId: userProfile?.flagPatternId,
    size: 44
)

// 修改后
AvatarView(
    avatarUrl: userProfile?.avatarUrl,  // ✅ 只使用avatar_url
    displayName: userProfile?.displayOrUsername ?? "PixelArtist",
    flagPatternId: userProfile?.flagPatternId,
    size: 44
)
```

#### 7. Top3PodiumView.swift (第40-45行)
```swift
// 修改前
AvatarView(
    avatarUrl: entry.avatar_url,
    avatar: entry.avatar,  // ❌ 移除
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)

// 修改后
AvatarView(
    avatarUrl: entry.avatar_url,  // ✅ 只使用avatar_url
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)
```

#### 8. FeedItemCard.swift (第14-19行)
```swift
// 修改前
AvatarView(
    avatarUrl: item.user.avatar_url,
    avatar: item.user.avatar,  // ❌ 移除
    displayName: item.user.displayName,
    size: 40
)

// 修改后
AvatarView(
    avatarUrl: item.user.avatar_url,  // ✅ 只使用avatar_url
    displayName: item.user.displayName,
    size: 40
)
```

#### 9. PlayerDetailSheet.swift (第21-26行)
```swift
// 修改前
AvatarView(
    avatarUrl: entry.avatar_url,
    avatar: entry.avatar,  // ❌ 移除
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)

// 修改后
AvatarView(
    avatarUrl: entry.avatar_url,  // ✅ 只使用avatar_url
    avatarColor: entry.avatarColor,
    displayName: entry.displayName,
    flagPatternId: entry.flag_pattern_id ?? entry.flag_pattern,
    ...
)
```

#### 10. NearbyPlayerCard.swift (第16-21行 和 194-199行)
```swift
// 修改前
AvatarView(
    avatarUrl: player.avatarUrl,
    avatar: player.avatar,  // ❌ 移除
    displayName: player.displayName,
    size: 44
)

// 修改后
AvatarView(
    avatarUrl: player.avatarUrl,  // ✅ 只使用avatar_url
    displayName: player.displayName,
    size: 44
)
```

---

### ⚠️ 特殊情况 - 头像编辑器

#### ProfileEditView.swift (第15-18行)
**保持不变** - 这里应该使用PixelAvatarView显示像素数据：

```swift
if let avatarData = viewModel.editAvatarData {
    PixelAvatarView(pixelData: avatarData, size: 80)
        .frame(width: 80, height: 80)
        .clipShape(Circle())
}
```

**原因**: 头像编辑器需要显示实时的像素数据预览，这是唯一合法使用avatar字段的地方。

#### AvatarEditor.swift (第42-47行)
**保持不变** - 头像编辑器内部使用PixelAvatarView：

```swift
if let pixelData = displayAvatarData, !pixelData.isEmpty {
    PixelAvatarView(
        pixelData: pixelData,
        size: 200
    )
}
```

---

## 🎯 修复原则

### avatar vs avatar_url 使用场景

| 场景 | avatar (像素数据) | avatar_url (CDN URL) |
|------|------------------|---------------------|
| **前端显示** | ❌ 不使用 | ✅ 使用 |
| **头像编辑器** | ✅ 仅编辑时使用 | ❌ 编辑时不用 |
| **GPS绘制选择** | ❌ 不检查 | ✅ 检查是否存在 |
| **AuthManager保存** | ❌ 不保存 | ✅ 保存 |
| **后端sprite生成** | ✅ 后端从DB读取 | - |
| **ProfileViewModel编辑** | ✅ 临时保存编辑数据 | ✅ 保存CDN路径 |

### 数据流

```
用户上传照片 → 转换为32x32像素艺术
    ↓
前端: ProfileViewModel.editAvatarData = "color1,color2,..."
    ↓
API: POST /api/profile { avatar: "color1,..." }
    ↓
后端: 保存到 users.avatar 字段
后端: 生成 users.avatar_url (CDN文件)
    ↓
API响应: { avatar_url: "uploads/avatars/user_bcd_medium.png", avatar: null }
    ↓
前端: AuthManager.currentUser.avatarUrl = "uploads/..."
前端: AuthManager.currentUser.avatar = nil  ✅ 不保存
    ↓
显示: AvatarView(avatarUrl: user.avatarUrl) → 加载CDN图片
GPS绘制: 检查avatarUrl → 后端从DB读取avatar生成sprite
```

---

## 🔍 AvatarView组件逻辑

**当前实现** (`AvatarView.swift`):

```swift
private var isPixelAvatar: Bool {
    (avatar?.contains(",") == true) || (avatarUrl?.contains(",") == true)
}

private var pixelData: String? {
    if let avatar = avatar, avatar.contains(",") { return avatar }
    if let avatarUrl = avatarUrl, avatarUrl.contains(",") { return avatarUrl }
    return nil
}
```

**问题**: 组件会检查两个字段，如果任一包含逗号就当作像素数据

**期望行为**:
- 前端不再传递avatar字段
- avatarUrl始终是URL或相对路径（不包含逗号）
- 组件通过AsyncImage加载avatar_url指向的CDN图片

---

## 📊 性能对比

### 修改前（使用avatar像素数据）

```
AvatarView(
    avatar: "color1,color2,...,color1024"  // 8KB字符串
)
    ↓
isPixelAvatar = true
    ↓
PixelAvatarView → 解析1024个颜色值
    ↓
Canvas渲染32x32网格 → 高CPU占用
```

**问题**:
- 每次渲染都需要解析1024个颜色值
- Canvas绘制性能差
- 内存占用高（1024个Color对象）

### 修改后（使用avatar_url）

```
AvatarView(
    avatarUrl: "uploads/avatars/user_bcd_medium.png"
)
    ↓
resolvedAvatarUrl = http://.../uploads/...
    ↓
CachedAsyncImagePhase → 加载PNG图片
    ↓
图片缓存 + 硬件加速渲染 → 低CPU占用
```

**优势**:
- 图片缓存复用
- 硬件加速渲染
- 内存占用低（单张PNG图片）
- 支持多种尺寸（medium, large, thumbnail）

---

## 🧪 测试清单

修复后需要验证：

- [ ] **个人资料页** - 显示CDN头像（不是像素艺术）
- [ ] **排行榜** - 所有用户头像正确加载
- [ ] **GPS绘制选择器** - 检测到用户头像，显示预览
- [ ] **GPS绘制地图** - 地图上显示user_avatar sprite
- [ ] **Feed评论** - 用户头像正确显示
- [ ] **附近玩家** - 头像正确显示
- [ ] **头像编辑器** - 打开时显示当前头像（如有），选择后实时预览
- [ ] **成就分享** - 分享图片中头像正确显示

### 日志验证

**正确的日志**:
```
📸 AvatarView: [username] avatarUrl=uploads/avatars/user_bcd_medium.png
📸 AvatarView: [username] resolvedURL=http://192.168.1.23:3001/uploads/...
```

**错误的日志** (不应出现):
```
📸 PixelAvatarView: Parsed 1024 color strings
```

---

## 🚀 批量修复脚本

由于需要修改多个文件，建议使用以下步骤：

1. 备份当前代码
2. 逐个文件修改AvatarView调用
3. 搜索关键词: `avatar: ` (注意冒号和空格)
4. 移除avatar参数，仅保留avatarUrl

**搜索命令**:
```bash
grep -r "avatar: " FunnyPixelsApp/Views/ | grep "AvatarView"
```

---

**最后更新**: 2026-02-23
**状态**: 部分修复完成，需继续修改所有AvatarView调用
**下一步**: 批量移除avatar参数，仅保留avatarUrl
