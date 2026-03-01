# iOS 模拟器调试工具

本目录包含用于 iOS 模拟器测试的 GPX 路线文件和调试工具。

## 📁 目录结构

```
debug-tools/
├── gpx-routes/              # GPS 路线文件
│   ├── beijing-city-tour.gpx      # 北京城市游览路线
│   ├── shanghai-bund.gpx          # 上海外滩游览路线
│   └── chinese-landmarks.gpx      # 中国主要地标位置
└── README.md               # 本文件
```

## 🚀 使用方法

### 方法 1：通过 Xcode 菜单

1. 在 Xcode 中运行应用
2. 选择菜单：**Features → Location → Import GPX…**
3. 选择 GPX 文件
4. 模拟器将自动开始模拟 GPS 移动

### 方法 2：拖放导入

1. 在 Xcode 中运行应用
2. 将 GPX 文件拖到 Xcode 的 Project Navigator 中
3. 文件会自动添加到项目中
4. 使用 **Features → Location** 菜单选择该路线

### 方法 3：编辑 Scheme

1. 在 Xcode 菜单选择：**Product → Scheme → Edit Scheme…**
2. 选择 **Run** → **Options** 标签
3. 在 **Default Location** 下拉菜单中选择 **Import GPX…**
4. 选择要使用的 GPX 文件
5. 以后每次运行都会自动使用该路线

## 📍 可用路线

### 1. beijing-city-tour.gpx（北京城市游览）

**类型：** 连续移动路线
**时长：** 约 1 小时 15 分钟（模拟时间）
**地点：** 北京地铁1号线

**路线：**
- 起点：北京西站
- 途经：军事博物馆 → 天安门西 → 天安门东 → 王府井
- 终点：东单

**用途：** 测试连续 GPS 跟踪、路线绘制、像素绘制路径

---

### 2. shanghai-bund.gpx（上海外滩游览）

**类型：** 连续移动路线
**时长：** 约 1 小时 15 分钟（模拟时间）
**地点：** 上海市中心

**路线：**
- 起点：人民广场
- 途经：南京东路 → 外滩 → 东方明珠 → 陆家嘴
- 终点：上海中心大厦

**用途：** 测试 GPS 移动、地图缩放、地标识别

---

### 3. chinese-landmarks.gpx（中国地标）

**类型：** 静态位置集合
**数量：** 34 个地标
**覆盖城市：** 北京、上海、深圳、广州、杭州、成都、西安、南京、厦门、青岛、武汉、重庆、香港、澳门

**包含地标：**

| 城市 | 地标 |
|------|------|
| 北京 | 天安门、故宫、长城、颐和园 |
| 上海 | 东方明珠、外滩、上海中心 |
| 深圳 | 市民中心、莲花山、深圳湾 |
| 广州 | 广州塔、天河体育中心 |
| 杭州 | 西湖、雷峰塔 |
| 成都 | 天府广场、春熙路、宽窄巷子 |
| 西安 | 钟楼、兵马俑 |
| 南京 | 夫子庙、中山陵 |
| 厦门 | 鼓浪屿、厦门大学 |
| 青岛 | 栈桥、崂山 |
| 武汉 | 黄鹤楼、长江大桥 |
| 重庆 | 解放碑、洪崖洞 |
| 香港 | 维多利亚港、迪士尼 |
| 澳门 | 大三巴、威尼斯人 |

**用途：**
- 测试地图定位到不同城市
- 测试地图缩放级别切换
- 测试地标显示
- 演示应用功能

---

## 🛠️ 自定义 GPX 文件

### 创建简单的静态位置

```xml
<?xml version="1.0"?>
<gpx version="1.1" creator="MyApp">
  <wpt lat="39.9042" lon="116.4074">
    <name>我的位置</name>
    <desc>测试位置</desc>
  </wpt>
</gpx>
```

### 创建移动路线

```xml
<?xml version="1.0"?>
<gpx version="1.1" creator="MyApp">
  <trk>
    <name>我的路线</name>
    <trkseg>
      <trkpt lat="39.9042" lon="116.4074">
        <time>2024-01-08T08:00:00Z</time>
      </trkpt>
      <trkpt lat="39.9100" lon="116.4200">
        <time>2024-01-08T08:10:00Z</time>
      </trkpt>
      <trkpt lat="39.9200" lon="116.4300">
        <time>2024-01-08T08:20:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
```

**重要提示：**
- 时间戳必须按顺序递增
- 坐标格式：纬度（-90 到 90），经度（-180 到 180）
- 时间格式：ISO 8601 UTC（`YYYY-MM-DDTHH:MM:SSZ`）

---

## 📊 测试场景建议

### 场景 1：基础定位测试

使用 **chinese-landmarks.gpx**，逐个测试各地标：
- 观察地图是否能正确定位
- 测试缩放级别切换
- 验证地图瓦片加载

### 场景 2：连续移动测试

使用 **beijing-city-tour.gpx** 或 **shanghai-bund.gpx**：
- 观察GPS实时跟踪
- 测试像素绘制路径功能
- 验证移动中的性能表现

### 场景 3：城市切换测试

在 **chinese-landmarks.gpx** 中快速切换不同城市：
- 北京 → 上海 → 深圳 → 广州
- 测试地图瓦片缓存
- 验证网络加载性能

### 场景 4：极限测试

连续运行 **beijing-city-tour.gpx** 10 次：
- 测试内存占用
- 检查是否有内存泄漏
- 验证长时间运行的稳定性

---

## ⚠️ 注意事项

1. **时间格式**
   - 必须使用 UTC 时间（以 `Z` 结尾）
   - 时间必须单调递增
   - 时间间隔影响模拟移动速度

2. **坐标精度**
   - 保留 4-6 位小数
   - 纬度范围：-90° 到 +90°
   - 经度范围：-180° 到 +180°

3. **文件编码**
   - 使用 UTF-8 编码
   - 可以包含中文名称和描述

4. **性能考虑**
   - GPX 文件不应超过 1000 个点
   - 时间间隔建议 ≥ 30 秒
   - 过密的点可能导致性能问题

---

## 🔍 调试技巧

### 查看 Xcode 控制台

运行 GPX 路线时，在控制台查看位置更新：

```swift
// 在你的代码中添加日志
func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    if let location = locations.last {
        print("📍 GPS更新: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        print("⏱️ 时间: \(location.timestamp)")
        print("🎯 精度: \(location.horizontalAccuracy)m")
    }
}
```

### 使用 Console.app

1. 打开 **Console.app**（应用程序 → 实用工具）
2. 选择模拟器设备
3. 搜索 "FunnyPixels" 或 "Location"
4. 实时查看位置更新日志

### 验证位置模拟

在模拟器中打开 **地图** 应用：
- 应该能看到模拟的 GPS 位置
- 蓝点应该按 GPX 路线移动
- 验证位置是否与你的应用一致

---

## 📚 参考资源

- [GPX 文件规范](http://www.topografix.com/GPX/1/1/)
- [Xcode Location Simulation](https://developer.apple.com/documentation/xcode-running-your-app-in-the-simulator-or-on-a-device)
- [CLLocationManager 官方文档](https://developer.apple.com/documentation/corelocation/cllocationmanager)

---

## 🆘 故障排查

### 问题：GPX 文件无法导入

**解决：**
- 检查文件格式是否正确（XML 格式）
- 确认文件编码为 UTF-8
- 尝试重新启动 Xcode

### 问题：位置不更新

**解决：**
- 检查应用是否有位置权限
- 确认 CLLocationManager 已启动
- 重启模拟器

### 问题：移动速度异常

**解决：**
- 调整 GPX 文件中的时间间隔
- 时间间隔越大，移动速度越慢
- 建议每点间隔 1-5 分钟

---

**最后更新：** 2026-01-08
**维护者：** FunnyPixels Team
