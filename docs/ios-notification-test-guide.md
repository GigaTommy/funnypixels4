# iOS 消息中心集成测试指南

**测试日期：** 2026-02-24
**测试内容：** 验证消息中心功能是否正确集成到 iOS App

---

## ✅ 已完成的集成

### 代码修改

**文件：** `app/FunnyPixels/Sources/FunnyPixels/Views/MapLibreMapView.swift`

#### 1. 添加了 NotificationViewModel
```swift
@StateObject private var notificationViewModel = NotificationViewModel()  // ✅ 新增
@State private var showNotificationSheet = false  // ✅ 新增
```

#### 2. 添加了消息中心 Sheet
```swift
.sheet(isPresented: $showNotificationSheet) {
    NotificationListView()
        .environmentObject(notificationViewModel)
        .presentationDetents([.large])
}
```

#### 3. 底部工具栏添加了"消息"按钮
```swift
// 消息按钮（带未读数量 Badge）
ZStack(alignment: .topTrailing) {
    ToolBarButton(icon: "bell.fill", title: "消息") {
        showNotificationSheet = true
    }

    // 未读数量 Badge
    if notificationViewModel.unreadCount > 0 {
        Text("\(notificationViewModel.unreadCount)")
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.red)
            .clipShape(Capsule())
            .offset(x: 8, y: -4)
    }
}
```

#### 4. 添加了未读数量自动刷新
```swift
.onAppear {
    if authViewModel.isAuthenticated {
        Task { await notificationViewModel.fetchUnreadCount() }
    }
}
.task {
    guard authViewModel.isAuthenticated else { return }
    while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 30_000_000_000) // 每30秒刷新
        await notificationViewModel.fetchUnreadCount()
    }
}
```

**文件：** `app/FunnyPixels/Sources/FunnyPixels/Views/NotificationListView.swift`

#### 5. 改为使用 EnvironmentObject
```swift
public struct NotificationListView: View {
    @EnvironmentObject var viewModel: NotificationViewModel  // ✅ 使用外部 ViewModel
    @Environment(\.dismiss) private var dismiss

    public init() {}
}
```

---

## 🧪 测试步骤

### 准备工作

#### 1. 确保后端服务运行
```bash
cd /Users/ginochow/code/funnypixels3/backend
npm start
```

#### 2. 确保有测试通知数据
```bash
# 创建测试通知（已执行）
node test-achievement-notification.js

# 结果：
# ✅ 通知创建成功！
#    ID: 4
#    标题: 🏆 成就解锁
#    内容: 恭喜！你解锁了成就「像素新手」
#    类型: achievement
#    已读: 否
#    用户: abcabc
```

#### 3. 运行数据库迁移（如果还没运行）
```bash
cd /Users/ginochow/code/funnypixels3/backend
npx knex migrate:latest

# 应该显示：
# ✅ Batch 1 run: 1 migrations
# ✅ 20260224000001_add_notification_fields.js
```

---

### iOS App 测试

#### 步骤 1: 在 Xcode 中打开项目

```bash
cd /Users/ginochow/code/funnypixels3/app/FunnyPixels
open XcodeProject/FunnyPixels.xcodeproj
```

或者

```bash
cd /Users/ginochow/code/funnypixels3/FunnyPixelsApp
open FunnyPixels.xcworkspace  # 如果使用 CocoaPods
```

#### 步骤 2: 构建项目

1. 在 Xcode 中选择目标设备（iPhone 15 Pro 或实际设备）
2. 点击 `Product` > `Build` (⌘B)
3. 检查是否有编译错误

**预期结果：** ✅ 构建成功，无错误

#### 步骤 3: 运行应用

1. 点击 `Run` 按钮 (⌘R) 或 `Product` > `Run`
2. 等待应用启动

**预期结果：** ✅ 应用正常启动，显示地图界面

#### 步骤 4: 登录应用

1. 如果未登录，点击顶部"登录"按钮
2. 使用测试账号登录：
   - 用户名: `abcabc`
   - 密码: (您的测试密码)

**预期结果：** ✅ 登录成功，显示用户头像

#### 步骤 5: 验证底部工具栏

**检查项：**
- ✅ 底部工具栏显示 4 个按钮：地图、排行榜、**消息**、我的
- ✅ "消息"按钮使用铃铛图标 (bell.fill)
- ✅ 如果有未读消息，"消息"按钮右上角显示红色数字 badge

**预期结果：**
```
[地图] [排行榜] [消息①] [我的]
                  ↑
            红色 badge 显示 "1"
```

#### 步骤 6: 打开消息中心

1. 点击底部"消息"按钮
2. 观察动画效果

**预期结果：**
- ✅ 从底部弹出消息列表 sheet
- ✅ 导航栏标题显示"消息中心"
- ✅ 左上角显示关闭按钮 (×)
- ✅ 右上角显示"全部已读"按钮（如果有未读消息）

#### 步骤 7: 验证消息列表

**检查项：**
- ✅ 显示测试通知："🏆 成就解锁"
- ✅ 内容显示："恭喜！你解锁了成就「像素新手」"
- ✅ 未读消息有蓝色背景或蓝点标记
- ✅ 显示相对时间（如"刚刚"、"1分钟前"）
- ✅ 成就通知显示橙色图标

#### 步骤 8: 测试下拉刷新

1. 在消息列表顶部向下拉
2. 释放触发刷新

**预期结果：**
- ✅ 显示刷新动画
- ✅ 列表重新加载
- ✅ 刷新完成后动画消失

#### 步骤 9: 测试标记已读

**方法 1: 点击通知**
1. 点击一条未读通知

**预期结果：**
- ✅ 通知背景变为白色（已读状态）
- ✅ 蓝点标记消失
- ✅ 底部工具栏的 badge 数字减 1

**方法 2: 全部已读**
1. 点击右上角"全部已读"按钮

**预期结果：**
- ✅ 所有通知标记为已读
- ✅ 底部工具栏 badge 消失
- ✅ "全部已读"按钮消失

#### 步骤 10: 测试删除通知

1. 在一条通知上向左滑动
2. 点击"删除"按钮

**预期结果：**
- ✅ 显示删除按钮（红色）
- ✅ 点击后通知从列表移除
- ✅ 删除动画流畅

#### 步骤 11: 测试空状态

1. 删除所有通知
2. 观察空状态显示

**预期结果：**
- ✅ 显示空状态插图
- ✅ 显示文字"暂无消息"或类似提示

#### 步骤 12: 测试未读数量自动刷新

1. 关闭消息列表（点击 × 或向下滑动）
2. 在后端创建新通知：
   ```bash
   cd backend
   node test-achievement-notification.js
   ```
3. 等待最多 30 秒

**预期结果：**
- ✅ 底部工具栏的 badge 自动更新
- ✅ 数字增加（显示新的未读数量）

---

## 🎯 测试检查清单

### UI 显示
- [ ] 底部工具栏显示"消息"按钮
- [ ] "消息"按钮使用铃铛图标
- [ ] 未读数量 badge 正确显示
- [ ] Badge 样式正确（红色背景、白色文字）

### 功能测试
- [ ] 点击"消息"按钮弹出消息列表
- [ ] 消息列表正确显示所有通知
- [ ] 通知类型图标和颜色正确
- [ ] 时间显示格式正确（相对时间）
- [ ] 未读/已读状态区分明显

### 交互测试
- [ ] 下拉刷新功能正常
- [ ] 点击通知标记已读
- [ ] "全部已读"功能正常
- [ ] 滑动删除通知功能正常
- [ ] 关闭消息列表（点击×或下滑）

### 实时更新
- [ ] 打开消息列表时自动刷新
- [ ] 未读数量自动更新（30秒间隔）
- [ ] 标记已读后 badge 立即更新
- [ ] 删除通知后 badge 立即更新

### 空状态
- [ ] 无消息时显示空状态
- [ ] 空状态文案友好
- [ ] 空状态样式美观

---

## 🐛 常见问题排查

### 问题 1: 编译错误 "Cannot find 'NotificationViewModel' in scope"

**原因：** NotificationViewModel 文件未被 Xcode 识别

**解决：**
1. 在 Xcode 项目导航器中找到 `NotificationViewModel.swift`
2. 右键 > `Add Files to "FunnyPixels"...`
3. 或检查 Target Membership 是否勾选

### 问题 2: 底部工具栏没有显示"消息"按钮

**原因：** 代码未正确保存或未重新构建

**解决：**
1. 检查 `MapLibreMapView.swift` 是否已保存修改
2. Clean Build Folder: `Product` > `Clean Build Folder` (⌘⇧K)
3. 重新构建: `Product` > `Build` (⌘B)

### 问题 3: Badge 数字不显示

**原因：** 未读数量为 0，或 API 请求失败

**解决：**
1. 检查后端是否运行: `curl http://localhost:3000/api/health`
2. 检查是否有未读通知: `node backend/test-achievement-notification.js`
3. 在 Xcode Console 查看 API 请求日志

### 问题 4: 点击"消息"按钮没反应

**原因：** showNotificationSheet 状态未绑定

**解决：**
1. 检查 `ToolBarButton` 的 action 是否正确设置
2. 检查 `.sheet(isPresented: $showNotificationSheet)` 是否添加
3. 在 action 中添加 print 调试: `print("消息按钮被点击")`

### 问题 5: 消息列表为空

**原因：** API 认证失败或用户无通知

**解决：**
1. 检查 `authViewModel.currentUser` 是否有值
2. 检查 `APIManager.shared.authToken` 是否正确
3. 在后端为当前用户创建测试通知
4. 查看 Network 日志: `GET /api/notifications`

### 问题 6: 未读数量不更新

**原因：** 定时任务未启动或 API 失败

**解决：**
1. 检查 `.task {}` 代码块是否添加
2. 检查 Console 日志是否有错误
3. 手动触发刷新: 关闭并重新打开消息列表

---

## 📊 测试结果记录

### 测试环境
- **Xcode 版本：** _______
- **iOS 版本：** _______
- **设备：** _______
- **测试日期：** _______
- **测试人员：** _______

### 测试结果

| 测试项 | 预期结果 | 实际结果 | 通过/失败 | 备注 |
|--------|---------|---------|----------|------|
| 底部工具栏显示 | 显示"消息"按钮 | | ☐ 通过 ☐ 失败 | |
| Badge 显示 | 显示未读数量 | | ☐ 通过 ☐ 失败 | |
| 弹出消息列表 | Sheet 正常弹出 | | ☐ 通过 ☐ 失败 | |
| 消息列表内容 | 正确显示通知 | | ☐ 通过 ☐ 失败 | |
| 下拉刷新 | 刷新正常 | | ☐ 通过 ☐ 失败 | |
| 标记已读 | 状态正确更新 | | ☐ 通过 ☐ 失败 | |
| 删除通知 | 删除功能正常 | | ☐ 通过 ☐ 失败 | |
| 空状态显示 | 空状态正常 | | ☐ 通过 ☐ 失败 | |
| 自动刷新 | 未读数量自动更新 | | ☐ 通过 ☐ 失败 | |

### 总体评价
- **通过率：** _____ / 9
- **整体质量：** ☐ 优秀 ☐ 良好 ☐ 一般 ☐ 需改进
- **是否可以发布：** ☐ 是 ☐ 否

---

## 🎉 测试通过标准

- ✅ 所有 UI 显示测试通过（4/4）
- ✅ 所有功能测试通过（5/5）
- ✅ 所有交互测试通过（5/5）
- ✅ 所有实时更新测试通过（4/4）
- ✅ 空状态测试通过（3/3）

**通过率要求：** ≥ 90%

---

## 📝 后续优化建议

1. **通知点击跳转**
   - 点击活动通知跳转到活动详情
   - 点击成就通知跳转到成就页面

2. **推送通知集成**
   - 集成 APNs
   - 实现远程推送

3. **通知设置**
   - 添加通知偏好设置页面
   - 允许用户关闭特定类型的通知

4. **UI 优化**
   - 添加加载骨架屏
   - 优化空状态插图
   - 添加通知分类筛选

---

**测试完成后请填写上方的测试结果记录表！** ✍️
