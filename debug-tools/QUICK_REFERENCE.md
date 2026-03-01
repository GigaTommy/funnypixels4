# iOS 模拟器地图交互 - 快速参考

## 🎯 快速开始

### 1. 缩放地图
- **Option ⌥ + 双指拖动**：捏合缩放
- **⌘ + +/-**：键盘缩放
- **鼠标滚轮**：滚动缩放

### 2. 平移地图
- **鼠标左键拖动**：直接移动地图
- **触控板双指滑动**：平移

### 3. 旋转地图
- **Option ⌥ + Shift + 拖动**：旋转地图

### 4. 模拟 GPS
```
Xcode 菜单：Features → Location → Custom Location…
```

示例坐标：
- 北京：39.9042, 116.4074
- 上海：31.2304, 121.4737
- 深圳：22.5431, 114.0554

---

## 📍 常用坐标速查表

| 地标 | 纬度 | 经度 |
|------|------|------|
| 北京-天安门 | 39.9042 | 116.4074 |
| 北京-故宫 | 39.9163 | 116.3971 |
| 上海-东方明珠 | 31.2397 | 121.4990 |
| 上海-外滩 | 31.2385 | 121.4855 |
| 深圳-市民中心 | 22.5431 | 114.0554 |
| 深圳-莲花山 | 22.5478 | 114.0560 |
| 广州-广州塔 | 23.1291 | 113.2644 |
| 杭州-西湖 | 30.2549 | 120.1552 |
| 成都-天府广场 | 30.6586 | 104.0648 |
| 西安-钟楼 | 34.2658 | 108.9543 |

---

## 🚀 使用 GPX 路线文件

### 方法 1：Xcode 菜单
```
Features → Location → Import GPX…
选择: debug-tools/gpx-routes/beijing-city-tour.gpx
```

### 方法 2：拖放
1. 将 `.gpx` 文件拖到 Xcode Project Navigator
2. Features → Location → 选择该文件

### 可用路线：
- **beijing-city-tour.gpx**：北京地铁1号线（15分钟）
- **shanghai-bund.gpx**：上海外滩游览（15分钟）
- **chinese-landmarks.gpx**：34个中国地标（静态测试）

---

## ⌨️ 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘ Command + + | 放大 |
| ⌘ Command + - | 缩小 |
| ⌘ Command + 0 | 重置缩放 |
| ⌘ Command + D | 打开调试菜单 |
| Option ⌥ | 显示双指触摸点 |
| Option ⌥ + Shift | 旋转模式 |

---

## 🐛 调试技巧

### 查看地图日志
```swift
// 在 Coordinator 中添加
func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
    print("📍 中心: \(mapView.centerCoordinate)")
    print("🔍 缩放: \(mapView.zoomLevel)")
}
```

### 检查位置权限
```
模拟器：设置 → 隐私与安全 → 定位服务 → FunnyPixelsApp
```

### 重置模拟器位置
```
Features → Location → None
等待 5 秒
Features → Location → Custom Location…
```

---

## ❗ 常见问题

### 地图无法缩放
✅ 检查 `isZoomEnabled = true`

### GPS 不更新
✅ 检查位置权限
✅ 重启模拟器：`xcrun simctl shutdown all`

### 地图空白
✅ 检查网络连接
✅ 确认瓦片 URL 可访问：`tiles.openfreemap.org`

### 性能卡顿
✅ 降低缩放级别
✅ 使用更低配置的模拟器

---

## 📱 测试检查清单

运行应用后测试以下功能：

- [ ] 可以平移地图
- [ ] 可以放大/缩小
- [ ] 可以旋转地图
- [ ] 可以倾斜地图
- [ ] 点击地图有响应
- [ ] GPX 路线正常播放
- [ ] GPS 位置实时更新
- [ ] 地图瓦片正常加载
- [ ] 没有卡顿或崩溃
- [ ] 内存占用正常

---

## 📚 详细文档

完整指南请查看：
- 📖 **IOS_SIMULATOR_INTERACTION_GUIDE.md**
- 🛠️ **debug-tools/README.md**

---

**提示：** 将此文件添加到书签，方便快速查阅！
