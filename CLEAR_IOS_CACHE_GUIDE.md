# 清除iOS足迹页面缓存指南

## 问题
足迹页面显示为空，但后端数据正常（已验证有1个会话，6个像素）

## 根本原因
iOS的`DrawingHistoryViewModel`使用了UserDefaults进行离线缓存：
- 缓存键: `offline_sessions_cache`
- 缓存时长: 24小时
- 位置: `DrawingHistoryViewModel.swift:40-43`

## 解决方案

### 方案1: 下拉刷新（最简单）✅
```
1. 打开"动态" → "足迹"
2. 向下拉动列表
3. 触发refreshable { await viewModel.refresh() }
```

### 方案2: 重启App
```
1. 双击Home键（或从底部上滑）
2. 滑掉FunnyPixels app
3. 重新打开app
```

### 方案3: 重新安装App（彻底清除）
```
1. 长按app图标 → 删除App
2. 从Xcode重新安装
```

### 方案4: 代码修改（临时调试）

如果需要禁用离线缓存进行调试，修改：

**文件**: `FunnyPixelsApp/FunnyPixelsApp/ViewModels/DrawingHistoryViewModel.swift`

```swift
// 临时注释掉离线缓存加载
func loadSessions(refresh: Bool = false) async {
    // ...

    // 首次加载时尝试从离线缓存恢复
    if sessions.isEmpty {
        // loadFromOfflineCache()  // ❌ 临时禁用
    }

    // ...
}
```

然后重新编译运行。

## 验证Redis缓存已清除

```bash
# 检查是否还有缓存
redis-cli keys "sessions:a79a1fbe-0f97-4303-b922-52b35e6948d5:*"

# 如果有，清除它们
redis-cli --scan --pattern "sessions:a79a1fbe-0f97-4303-b922-52b35e6948d5:*" | xargs redis-cli del
```

## 验证后端API

```bash
# 测试API返回的数据
node backend/scripts/test-session-api.js

# 应该显示:
#   总会话数: 1
#   会话 70344bf7... - pixels: 6
```

## 当前状态

✅ **后端数据正常** - 1个会话，6个像素
✅ **后端API正常** - 查询逻辑正确
✅ **Redis缓存已清除** - 或从未存在
❓ **iOS缓存** - 需要用户手动刷新或重启app

## 预期结果

操作后，"足迹"页面应该显示：
- 1个绘制会话卡片
- 显示6个像素
- 会话时间: 今天 12:12

## 如果仍然不工作

检查iOS app的网络请求：
1. 打开Xcode
2. 运行app并附加调试器
3. 在Console中搜索 "loadSessions" 或 "drawing-sessions"
4. 查看API请求和响应
5. 检查是否有错误日志
