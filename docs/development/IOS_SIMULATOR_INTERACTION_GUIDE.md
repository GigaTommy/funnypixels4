# iOS 模拟器地图交互操作指南

## 📍 目录

1. [基本手势操作](#基本手势操作)
2. [模拟 GPS 定位](#模拟-gps-定位)
3. [调试工具与技巧](#调试工具与技巧)
4. [常见问题排查](#常见问题排查)

---

## 基本手势操作

### 在 Mac 上使用 iOS 模拟器时，可以通过以下方式操作地图：

#### 1️⃣ **缩放地图 (Zoom)**

**方法 1：双指捏合/展开手势**
- 按住 **Option ⌥** 键，显示双指触摸点
- 按住鼠标左键并拖动，模拟双指捏合/展开
- 向外拖动 = 放大 🔍+
- 向内拖动 = 缩小 🔍-

**方法 2：键盘快捷键**
- ⌘ Command + **加号 +**：放大
- ⌘ Command + **减号 -**：缩小
- ⌘ Command + **0**：重置缩放

**方法 3：鼠标滚轮**
- 向上滚动：放大
- 向下滚动：缩小

#### 2️⃣ **平移地图 (Pan)**

**操作方法：**
- 直接用鼠标左键拖动地图
- 或使用触控板双指滑动

#### 3️⃣ **旋转地图 (Rotate)**

**操作方法：**
1. 按住 **Option ⌥** 键
2. 看到两个触摸点后，按住 **Shift** 键
3. 两个触摸点会变成旋转状态（显示连接线）
4. 用鼠标拖动任意一个触摸点旋转地图

#### 4️⃣ **倾斜地图 (Pitch/3D)**

**操作方法：**
1. 按住 **Option ⌥** 键
2. 使用双指上下拖动
3. 地图会呈现 3D 倾斜效果

#### 5️⃣ **点击地图 (Tap)**

**操作方法：**
- 直接点击地图任意位置
- 可查看像素详情（如果有点击的像素）

---

## 模拟 GPS 定位

### 方法 1：使用 Xcode 的 Location Simulation（推荐）

#### ✅ **优点：**
- Xcode 内置功能，无需额外工具
- 支持预设位置和自定义 GPX 路线
- 实时更新模拟器位置

#### 📝 **操作步骤：**

1. **启动模拟器运行应用**

2. **在 Xcode 菜单栏选择：**
   ```
   Features → Location → Custom Location…
   ```

3. **输入自定义坐标：**

   示例坐标（中国热门地点）：
   ```
   北京天安门：39.9042° N, 116.4074° E
   上海外滩：   31.2304° N, 121.4737° E
   深圳市民中心：22.5431° N, 114.0554° E
   杭州西湖：   30.2549° N, 120.1552° E
   成都天府广场：30.6586° N, 104.0648° E
   ```

4. **使用预设位置：**

   Xcode 提供了以下预设位置：
   - **Apple Stores** （全球各地 Apple Store）
   - **City Bicycle Ride** （城市骑行路线）
   - **City Run** （城市跑步路线）
   - **Freeway Drive** （高速公路驾驶）
   - **Apple Park** （Apple 总部）

5. **使用 GPX 文件模拟路线移动：**

   创建自定义 GPX 文件：

   ```xml
   <?xml version="1.0"?>
   <gpx version="1.1" creator="Xcode">
       <wpt lat="39.9042" lon="116.4074">
           <name>北京天安门</name>
       </wpt>
       <wpt lat="31.2304" lon="121.4737">
           <name>上海外滩</name>
       </wpt>
   </gpx>
   ```

   在 Xcode 中导入：
   ```
   Features → Location → Import GPX…
   ```

### 方法 2：使用模拟器调试菜单

#### 📱 **操作步骤：**

1. **在模拟器中打开 Debug 菜单：**
   - 快捷键：**⌘ Command + D**
   - 或菜单栏：**Debug → Open System Log…**

2. **选择 Location 选项：**
   ```
   Device → Set Location →
   ```

3. **选择预设位置或自定义：**
   - None：禁用定位
   - Custom Location…：自定义坐标
   - Apple Store：各地 Apple Store

### 方法 3：代码中模拟位置（调试用）

在开发中，可以在代码中设置测试位置：

```swift
// MapLibreMapView.swift 中的 makeUIView

func makeUIView(context: Context) -> MLNMapView {
    let mapView = MLNMapView()

    // 测试位置：北京天安门
    let testCenter = CLLocationCoordinate2D(
        latitude: 39.9042,
        longitude: 116.4074
    )
    mapView.setCenter(testCenter, zoomLevel: 15, animated: true)

    return mapView
}
```

### 方法 4：创建定位调试工具

在右侧工具栏添加"定位"按钮（`location.fill`）功能：

```swift
// 在 MapLibreMapView.swift 的 rightToolbar 中

CircleToolButton(icon: "location.fill") {
    // 定位到当前位置（或测试位置）
    if let mapView = /* 获取 MLNMapView 实例 */ {
        let beijing = CLLocationCoordinate2D(
            latitude: 39.9042,
            longitude: 116.4074
        )
        mapView.setCenter(beijing, zoomLevel: 15, animated: true)
    }
}
```

---

## 调试工具与技巧

### 🛠️ **1. 启用 Xcode 地图调试覆盖层**

在 Xcode 中运行应用时，查看控制台输出：

```swift
// 在 Coordinator 中添加日志
func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
    let center = mapView.centerCoordinate
    print("📍 地图中心: \(center.latitude), \(center.longitude)")
    print("🔍 缩放级别: \(mapView.zoomLevel)")
}
```

### 🛠️ **2. 实时查看坐标信息**

在地图上显示当前中心点坐标：

```swift
VStack {
    Text("Lat: \(mapView.centerCoordinate.latitude)")
    Text("Lon: \(mapView.centerCoordinate.longitude)")
    Text("Zoom: \(mapView.zoomLevel)")
}
.font(.caption)
.padding(8)
.background(.black.opacity(0.7))
.foregroundColor(.white)
.cornerRadius(8)
```

### 🛠️ **3. 使用 macOS 触控板手势**

如果你的 Mac 有触控板：

| 操作 | 手势 |
|------|------|
| 平移 | 双指滑动 |
| 缩放 | 双指捏合/展开 |
| 旋转 | 双指旋转 |
| 倾斜 | 双指上下滑动 |

---

## 常见问题排查

### ❌ **问题 1：地图无法缩放**

**可能原因：**
- `isZoomEnabled` 未启用

**解决方案：**
```swift
// 确保在 makeUIView 中启用
mapView.isZoomEnabled = true
```

---

### ❌ **问题 2：模拟 GPS 不生效**

**可能原因：**
- 应用未获得位置权限
- 模拟器位置服务未启用

**解决方案：**

1. **检查位置权限：**
   - 模拟器中：**设置 → 隐私与安全 → 定位服务**
   - 确保你的应用开关已打开

2. **重置模拟器：**
   ```
   Simulator → Device → Erase All Content and Settings…
   ```

3. **重启模拟器：**
   ```bash
   xcrun simctl shutdown all
   ```

---

### ❌ **问题 3：地图卡顿或崩溃**

**可能原因：**
- 网络连接问题（加载瓦片）
- 模拟器性能不足

**解决方案：**

1. **检查网络连接：**
   - 确保模拟器可以访问 `tiles.openfreemap.org`

2. **降低地图复杂度：**
   ```swift
   // 降低帧率或减少瓦片数量
   mapView.preferredFramesPerSecond = 30
   ```

3. **使用更低配置的模拟器：**
   - 选择 iPhone 14 而非 iPhone 15 Pro Max

---

### ❌ **问题 4：无法测试真实 GPS 移动**

**解决方案：**

使用 GPX 文件模拟路线移动：

```xml
<?xml version="1.0"?>
<gpx version="1.1" creator="FunnyPixels">
    <name>北京骑行路线</name>

    <!-- 起点：天安门 -->
    <wpt lat="39.9042" lon="116.4074">
        <time>2024-01-08T08:00:00Z</time>
        <name>天安门</name>
    </wpt>

    <!-- 途经：故宫 -->
    <wpt lat="39.9163" lon="116.3971">
        <time>2024-01-08T08:10:00Z</time>
        <name>故宫</name>
    </wpt>

    <!-- 终点：景山公园 -->
    <wpt lat="39.9251" lon="116.3966">
        <time>2024-01-08T08:20:00Z</time>
        <name>景山公园</name>
    </wpt>
</gpx>
```

在 Xcode 中：
```
Features → Location → City Bicycle Ride
或
Features → Location → Import GPX… → 选择你的 GPX 文件
```

---

## 📊 **性能测试建议**

### 测试场景：

1. **快速缩放测试**
   - 连续放大/缩小 20 次
   - 观察内存占用和帧率

2. **长时间运行测试**
   - 保持地图显示 1 小时
   - 检查内存泄漏

3. **网络压力测试**
   - 在慢速网络下测试瓦片加载
   - 在断网后恢复网络测试

---

## 🎯 **快速检查清单**

在提交测试前，确保以下功能正常：

- ✅ 可以平移地图
- ✅ 可以缩放地图
- ✅ 可以旋转地图
- ✅ 可以倾斜地图
- ✅ 点击地图有响应
- ✅ GPS 模拟定位功能正常
- ✅ 工具栏按钮可点击
- ✅ 没有卡顿或崩溃

---

## 📚 **相关资源**

- [MapLibre Native iOS 文档](https://maplibre.org/maplibre-native/latest/ios/)
- [Xcode Location Simulation 官方文档](https://developer.apple.com/documentation/xcode-running-your-app-in-the-simulator-or-on-a-device)
- [GPX 文件规范](http://www.topografix.com/GPX/1/1/)

---

## 💡 **最佳实践**

1. **开发阶段**：使用 Xcode Location Simulation
2. **测试阶段**：创建多个 GPX 文件覆盖不同场景
3. **演示阶段**：使用预设城市位置（北京、上海等）
4. **性能优化**：使用 Instruments 监控地图性能

---

**最后更新：** 2026-01-08
**维护者：** FunnyPixels Team
