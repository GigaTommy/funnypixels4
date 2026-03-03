# 联盟Tab显示问题诊断

## 问题描述
用户报告："整个联盟模块变成了排行榜，原来的链接丢失"

## 代码检查结果 ✅
ContentView.swift中的Tab定义是正确的：

```swift
// Tab index 0: 地图
MapTabContent().tag(0)

// Tab index 1: 动态
FeedTabView().tag(1)

// Tab index 2: 联盟 ✅
AllianceTabView().tag(2)

// Tab index 3: 个人（包含排行榜子Tab）
ProfileTabView().tag(3)
```

## 可能的原因

### 1. Xcode缓存问题
**症状：** 旧的build仍在运行，没有加载最新代码
**解决：**
```bash
# 在Xcode中
1. Product > Clean Build Folder (Shift+Cmd+K)
2. 删除DerivedData: ~/Library/Developer/Xcode/DerivedData
3. 重新编译
```

### 2. AppState状态问题
**症状：** `appState.selectedTab`值被错误设置
**检查：**
在AllianceTabView.swift的`body`开始处添加调试：
```swift
var body: some View {
    let _ = print("DEBUG: AllianceTabView loaded, selectedTab = \(appState.selectedTab)")
    NavigationStack {
        ...
    }
}
```

### 3. LazyView延迟加载问题
**症状：** LazyView未正确创建AllianceTabView实例
**临时修复：** 移除LazyView包装
```swift
// 在ContentView.swift中，将：
LazyView(AllianceTabView()...)

// 改为：
AllianceTabView()
    .environmentObject(authViewModel)
    .environmentObject(appState)
```

### 4. ProfileTabView覆盖了Alliance Tab
**症状：** ProfileTabView的默认SubTab被设置为leaderboard
**检查：** AppState.swift中的profileSubTab默认值
```swift
@Published var profileSubTab: ProfileSubTab = .personal  // 应该是.personal
```

## 快速诊断步骤

1. **验证Tab索引：**
   在ContentView.swift的onChange中添加日志：
   ```swift
   .onChange(of: appState.selectedTab) { oldValue, newValue in
       print("🔍 Tab changed: \(oldValue) → \(newValue)")
       print("   Map=0, Feed=1, Alliance=2, Profile=3")
   }
   ```

2. **验证AllianceTabView加载：**
   在AllianceTabView.swift的init或onAppear中添加：
   ```swift
   .onAppear {
       print("✅ AllianceTabView appeared!")
   }
   ```

3. **验证ProfileTabView未被意外加载：**
   同样在ProfileTabView中添加日志

## 如果问题仍然存在

请提供以下信息：
1. Xcode控制台的调试输出
2. 点击联盟Tab时实际显示的UI截图
3. appState.selectedTab的值（添加上述日志后）
4. 最近是否有人修改过ContentView.swift或AppState.swift？

## 数据库相关问题（已修复）
✅ bcd用户的联盟成员关系已恢复
⚠️  bcd用户的头像仍需手动恢复
