# 3D 像素城市产品需求任务清单

**更新时间**: 2026-03-10
**基于**: 14点核心产品+技术需求

---

## 核心产品理念

> **"如果用户进入 3D 城市第一秒不会说 '哇'，那这个系统就是失败的。"**

### 三个核心问题

1. ✅ 用户看到自己的贡献 → **Find my pixel**
2. ✅ 用户看到城市在成长 → **视觉震撼**
3. ✅ 用户愿意再次参与建设 → **建造动画**

---

## 任务分组策略

### 🎯 Phase 0: 架构基础（必须先做）
修正当前架构偏差，建立正确的产品结构

### ⭐ Phase 1: 核心产品体验（最高优先级）
实现"震撼"和"成就"两大情绪点

### 🎨 Phase 2: 视觉完善
提升第一印象，确保"哇"的效果

### 🚀 Phase 3: 性能与扩展
支撑大规模城市运行

---

## Phase 0: 架构基础 🎯

### 任务 #60: Map/City 独立模式架构重构
**需求来源**: 二、产品结构
**优先级**: 🔴 P0-Critical
**预估**: 3-4天
**当前问题**: TowerSceneView是地图透明覆盖层，用户会迷失

**目标**:
```
当前: MapboxMapView + TowerSceneView (透明叠加)
目标: Map Mode (2D绘制) ⟷ City Mode (3D城市)
```

**实现要点**:
1. 创建 `ViewMode` 枚举: `.map` / `.city`
2. 设计模式切换按钮 UI
   - 位置: 屏幕右下角
   - 图标: 2D/3D 切换icon
   - 动画: 淡入淡出 + 缩放
3. 重构 ContentView 导航结构
   ```swift
   enum ViewMode {
       case map    // 2D绘制模式（当前主地图）
       case city   // 3D城市模式（独立全屏）
   }

   @State private var viewMode: ViewMode = .map

   switch viewMode {
   case .map:
       MapTabContent()  // 2D绘制
   case .city:
       CityView()       // 3D城市（全新组件）
   }
   ```
4. 实现 CityView（独立组件）
   - 不依赖 MapboxMapView
   - 纯 SceneKit 全屏渲染
   - 独立的相机控制
5. 状态同步机制
   - 保存用户地图中心点
   - 切换到City时，相机定位到对应位置
   - 支持双向同步

**验收标准**:
- [ ] 用户可以清晰区分"绘制"和"观看"两种模式
- [ ] 切换动画流畅（<0.5s）
- [ ] City模式下无地图UI干扰
- [ ] 切换后位置保持一致

---

### 任务 #61: 对数高度压缩算法
**需求来源**: 五、城市视觉规则
**优先级**: 🔴 P0-Critical
**预估**: 0.5天
**当前问题**: 直接使用 `tower.height` 可能导致视觉失衡（10000层太高）

**目标**:
```
10 pixel   → 10m
100 pixel  → 25m
1000 pixel → 60m
10000 pixel → 80m（不是10000m！）
```

**实现算法**:
```swift
// TowerViewModel.swift 或 TowerInstancedRenderer.swift

/// 计算建筑显示高度（对数压缩）
/// - Parameter pixelCount: 实际像素数量
/// - Returns: 3D场景中的显示高度（米）
func calculateDisplayHeight(pixelCount: Int) -> Float {
    guard pixelCount > 0 else { return 1.0 }

    // 对数压缩公式: height = base * log10(pixelCount) + offset
    let base: Float = 20.0      // 对数系数（控制增长速度）
    let offset: Float = 5.0     // 基础高度（最低建筑高度）

    let logHeight = log10(Float(pixelCount))
    let displayHeight = base * logHeight + offset

    // 限制最大/最小高度
    let minHeight: Float = 5.0
    let maxHeight: Float = 150.0

    return min(max(displayHeight, minHeight), maxHeight)
}

// 使用示例
let displayHeight = calculateDisplayHeight(pixelCount: tower.pixelCount)
```

**修改点**:
1. `TowerViewModel.createTowerNode()`:
   ```swift
   // 旧代码
   // geometryNode.position = SCNVector3(0, Float(tower.height) / 2, 0)

   // 新代码
   let displayHeight = calculateDisplayHeight(pixelCount: tower.pixelCount)
   geometryNode.position = SCNVector3(0, displayHeight / 2, 0)
   ```

2. `TowerInstancedRenderer.getOrCreateGeometry()`:
   ```swift
   // 参数改为 pixelCount 而不是 height
   private func getOrCreateGeometry(pixelCount: Int) -> SCNBox {
       let displayHeight = calculateDisplayHeight(pixelCount: pixelCount)
       // ... 创建几何体
   }
   ```

3. 更新 grouping 策略:
   ```swift
   // 不再按height分组，改为按pixelCount区间分组
   // 区间: 1-10, 11-50, 51-100, 101-500, 501-1000, 1000+
   func getPixelCountBucket(_ count: Int) -> String {
       switch count {
       case 0...10: return "tiny"
       case 11...50: return "small"
       case 51...100: return "medium"
       case 101...500: return "large"
       case 501...1000: return "huge"
       default: return "mega"
       }
   }
   ```

**验收标准**:
- [ ] 10 pixel 建筑高度约 10m
- [ ] 1000 pixel 建筑高度约 60m
- [ ] 10000 pixel 建筑高度约 80m（不超过150m）
- [ ] 城市天际线有明显层次感
- [ ] 不出现超高异常建筑

---

### 任务 #62: 城市数据模型整理
**需求来源**: 四、城市数据模型
**优先级**: 🟡 P1-High
**预估**: 1天
**当前状态**: TowerSummary 基本满足，但缺少部分字段

**目标**: 确保数据结构支持所有产品功能

**检查点**:
1. `TowerSummary` 是否包含:
   ```swift
   struct TowerSummary: Codable {
       let tileId: String          // ✅ 有
       let lat: Double             // ✅ 有
       let lng: Double             // ✅ 有
       let pixelCount: Int         // ✅ 有
       let height: Int             // ✅ 有（但需改为computed property）

       // ❓ 需确认
       let latestPixelTime: Date?   // 最后一次绘制时间
       let firstPixelTime: Date?    // 第一次绘制时间

       // 计算属性
       var displayHeight: Float {
           calculateDisplayHeight(pixelCount: pixelCount)
       }
   }
   ```

2. `FloorData` 是否支持用户标记:
   ```swift
   struct FloorData: Codable {
       let floorIndex: Int         // ✅ 有
       let patternId: String       // ✅ 有
       let userId: String?         // ✅ 有
       let username: String?       // ✅ 有
       let timestamp: String       // ✅ 有

       // 新增：判断是否当前用户
       var isCurrentUser: Bool {
           userId == AuthManager.shared.currentUser?.id
       }
   }
   ```

**验收标准**:
- [ ] 数据结构支持所有14点需求的功能
- [ ] 服务器API返回包含必要字段
- [ ] 缺失字段有合理默认值

---

## Phase 1: 核心产品体验 ⭐

### 任务 #63: 【最重要】"Find My Pixel" 功能
**需求来源**: 六-2、三（核心产品体验）
**优先级**: 🔴 P0-Critical（产品核心）
**预估**: 2-3天
**产品价值**: ⭐⭐⭐⭐⭐ (最高)

> **"这是最重要的体验点。"** - 原需求第六点

**用户流程**:
```
用户点击 "Find My Pixel"
↓
系统查询用户所有像素
↓
定位到最高层/最近绘制的像素
↓
镜头飞行动画（3秒）
↓
目标cube发光高亮（金色光环）
↓
显示气泡: "你在第 2412 层！"
```

**实现要点**:

#### 1. UI按钮（CityView）
```swift
// 位置: 屏幕右下角，悬浮按钮
Button(action: { viewModel.findMyPixels() }) {
    VStack(spacing: 4) {
        Image(systemName: "star.circle.fill")
            .font(.system(size: 28))
        Text("Find Me")
            .font(.caption2)
    }
    .foregroundColor(.white)
    .padding(12)
    .background(
        LinearGradient(
            colors: [Color.yellow, Color.orange],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
    .cornerRadius(16)
    .shadow(radius: 8)
}
```

#### 2. API查询（TowerViewModel）
```swift
/// 查询当前用户的所有像素位置
func findMyPixels() async {
    guard let userId = AuthManager.shared.currentUser?.id else {
        error = "Please login first"
        return
    }

    do {
        // API: GET /users/{userId}/pixels/locations
        let response: UserPixelsResponse = try await APIManager.shared.get(
            "/users/\(userId)/pixels/locations",
            parameters: [
                "limit": 100,
                "sort": "latest"  // 最新绘制的优先
            ]
        )

        guard let firstPixel = response.data.pixels.first else {
            error = "You haven't drawn any pixels yet"
            return
        }

        await flyToPixel(
            tileId: firstPixel.tileId,
            floorIndex: firstPixel.floorIndex
        )

    } catch {
        self.error = "Failed to find your pixels: \(error)"
    }
}
```

#### 3. 镜头飞行动画
```swift
/// 飞行到指定像素位置
private func flyToPixel(tileId: String, floorIndex: Int) async {
    guard let towerNode = towerNodes[tileId] else { return }

    await MainActor.run {
        // 1. 计算目标位置（建筑顶部上方）
        let towerPosition = towerNode.position
        let targetPosition = SCNVector3(
            towerPosition.x,
            towerPosition.y + 50,  // 建筑上方50米
            towerPosition.z + 30   // 稍远一点的观察角度
        )

        // 2. 相机飞行动画（3秒）
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 3.0
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(
            name: .easeInEaseOut
        )

        cameraNode.position = targetPosition
        cameraNode.look(at: towerPosition)

        SCNTransaction.commit()

        // 3. 等待飞行完成后高亮
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await highlightUserPixel(tileId: tileId, floorIndex: floorIndex)
        }
    }
}
```

#### 4. Cube发光高亮
```swift
/// 高亮用户的像素（金色光环）
private func highlightUserPixel(tileId: String, floorIndex: Int) async {
    guard let towerNode = towerNodes[tileId] else { return }

    await MainActor.run {
        // 移除旧的高亮
        scene.rootNode.childNode(withName: "user_highlight", recursively: true)?
            .removeFromParentNode()

        // 创建高亮cube（金色发光）
        let highlightBox = SCNBox(width: 1.2, height: 0.2, length: 1.2, chamferRadius: 0.1)
        let material = SCNMaterial()
        material.diffuse.contents = UIColor.yellow
        material.emission.contents = UIColor.yellow  // 强烈自发光
        material.metalness.contents = 0.9
        highlightBox.materials = [material]

        let highlightNode = SCNNode(geometry: highlightBox)
        highlightNode.name = "user_highlight"
        highlightNode.position = SCNVector3(
            towerNode.position.x,
            Float(floorIndex) * 0.15,  // 每层0.15米
            towerNode.position.z
        )

        scene.rootNode.addChildNode(highlightNode)

        // 脉冲动画（持续闪烁）
        let pulseAction = SCNAction.sequence([
            SCNAction.fadeOpacity(to: 0.5, duration: 0.8),
            SCNAction.fadeOpacity(to: 1.0, duration: 0.8)
        ])
        highlightNode.runAction(SCNAction.repeatForever(pulseAction))

        // 显示提示气泡
        showPixelToast(floorIndex: floorIndex)
    }
}
```

#### 5. 提示气泡
```swift
// CityView 中添加
@State private var pixelToast: String?

// UI中
if let toast = pixelToast {
    Text(toast)
        .font(.headline)
        .foregroundColor(.white)
        .padding()
        .background(Color.black.opacity(0.8))
        .cornerRadius(12)
        .transition(.scale.combined(with: .opacity))
        .animation(.spring(), value: pixelToast)
}

// ViewModel回调
func showPixelToast(floorIndex: Int) {
    pixelToast = "You are on floor \(floorIndex)! 🎉"

    Task {
        try? await Task.sleep(nanoseconds: 3_000_000_000)
        pixelToast = nil
    }
}
```

**验收标准**:
- [ ] 按钮位置醒目、样式吸引人
- [ ] 镜头飞行动画流畅（3秒，ease-in-out）
- [ ] Cube高亮清晰可见（金色、脉冲闪烁）
- [ ] 提示信息准确（楼层数）
- [ ] 未登录用户显示引导提示
- [ ] 无像素用户显示友好提示

---

### 任务 #64: 建筑点击体验优化
**需求来源**: 六-1（探索建筑）
**优先级**: 🟡 P1-High
**预估**: 1-2天
**当前状态**: ✅ 基础功能已有（handleTap），需优化体验

**优化内容**:

#### 1. 镜头飞行聚焦
```swift
// 当前: 直接显示详情面板
// 优化: 先飞行聚焦，再显示详情

func handleTap(at point: CGPoint, in sceneView: SCNView) {
    // ... 现有检测代码

    // 新增: 飞行动画
    await flyToBuilding(towerNode: towerNode)

    // 等待飞行完成后显示详情
    Task {
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        await loadTowerDetails(tileId: tileId)
    }
}

private func flyToBuilding(towerNode: SCNNode) async {
    await MainActor.run {
        let targetPos = SCNVector3(
            towerNode.position.x,
            towerNode.position.y + 30,
            towerNode.position.z + 20
        )

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.5
        cameraNode.position = targetPos
        cameraNode.look(at: towerNode.position)
        SCNTransaction.commit()
    }
}
```

#### 2. 建筑详情面板优化
```swift
// TowerDetailsView 增强

VStack(spacing: 16) {
    // 顶部标题（更醒目）
    HStack {
        Image(systemName: "building.2.fill")
            .font(.title)
            .foregroundColor(.blue)

        VStack(alignment: .leading) {
            Text("Building")
                .font(.caption)
                .foregroundColor(.secondary)
            Text(towerData.tileId)
                .font(.headline)
        }

        Spacer()
    }

    Divider()

    // 统计数据（网格布局）
    LazyVGrid(columns: [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ], spacing: 16) {
        StatCard(
            icon: "arrow.up",
            label: "Height",
            value: "\(towerData.totalFloors)"
        )

        StatCard(
            icon: "person.3.fill",
            label: "Builders",
            value: "\(towerData.contributorCount)"
        )

        StatCard(
            icon: "clock.fill",
            label: "Age",
            value: towerData.buildingAge
        )
    }

    // ... 现有楼层列表
}

struct StatCard: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
            Text(value)
                .font(.title3.bold())
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}
```

**验收标准**:
- [ ] 点击建筑后有明显的聚焦动画
- [ ] 详情面板信息丰富、排版美观
- [ ] 统计数据清晰易读（高度、建造人数、时间）
- [ ] 过渡动画流畅

---

### 任务 #65: 城市UI极简化
**需求来源**: 七、城市UI原则
**优先级**: 🟡 P1-High
**预估**: 1天

> **"城市UI必须极简。屏幕只保留：搜索、排行榜、我的建筑。其余全部隐藏。城市本身就是UI。"**

**UI设计**:

```swift
// CityView 完整UI结构

struct CityView: View {
    @StateObject private var viewModel = TowerViewModel()

    var body: some View {
        ZStack {
            // 1. 3D场景（全屏）
            TowerSceneView(viewModel: viewModel)
                .edgesIgnoringSafeArea(.all)

            // 2. 极简UI覆盖层
            VStack {
                // 顶部工具栏
                HStack {
                    // 返回Map按钮
                    Button(action: { /* 返回2D地图 */ }) {
                        Image(systemName: "map.fill")
                            .font(.title3)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                    }

                    Spacer()

                    // 搜索按钮
                    Button(action: { showSearch = true }) {
                        Image(systemName: "magnifyingglass")
                            .font(.title3)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                    }

                    // 排行榜按钮
                    Button(action: { showLeaderboard = true }) {
                        Image(systemName: "trophy.fill")
                            .font(.title3)
                            .foregroundColor(.yellow)
                            .padding(12)
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                    }
                }
                .padding()

                Spacer()

                // 底部操作栏
                HStack {
                    // 我的建筑按钮
                    Button(action: { viewModel.showMyBuildings() }) {
                        VStack(spacing: 4) {
                            Image(systemName: "building.2.fill")
                                .font(.title3)
                            Text("My Buildings")
                                .font(.caption2)
                        }
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.blue.opacity(0.8))
                        .cornerRadius(12)
                    }

                    Spacer()

                    // Find My Pixel（最醒目）
                    Button(action: { Task { await viewModel.findMyPixels() } }) {
                        VStack(spacing: 4) {
                            Image(systemName: "star.circle.fill")
                                .font(.system(size: 28))
                            Text("Find Me")
                                .font(.caption.bold())
                        }
                        .foregroundColor(.white)
                        .padding(12)
                        .background(
                            LinearGradient(
                                colors: [.yellow, .orange],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(16)
                        .shadow(radius: 8)
                    }
                }
                .padding()
            }

            // 3. 弹出层（按需显示）
            if showSearch {
                SearchOverlay()
            }

            if showLeaderboard {
                LeaderboardOverlay()
            }
        }
    }
}
```

**功能组件**:

#### 搜索覆盖层
```swift
struct SearchOverlay: View {
    @State private var searchText = ""

    var body: some View {
        VStack(spacing: 0) {
            // 搜索框
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)

                TextField("Search by location or user", text: $searchText)
                    .textFieldStyle(.plain)

                Button("Cancel") {
                    // 关闭
                }
            }
            .padding()
            .background(Color(.systemBackground))

            // 搜索结果列表
            ScrollView {
                // ... 搜索结果
            }
        }
        .background(Color.black.opacity(0.5))
        .transition(.move(edge: .top))
    }
}
```

#### 排行榜覆盖层
```swift
struct LeaderboardOverlay: View {
    var body: some View {
        VStack {
            Text("Top Buildings")
                .font(.title2.bold())
                .padding()

            List {
                // 按高度排序
                // 按建造人数排序
                // 按时间排序
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(20, corners: [.topLeft, .topRight])
        .transition(.move(edge: .bottom))
    }
}
```

**验收标准**:
- [ ] 屏幕90%以上是3D场景
- [ ] UI元素半透明、不遮挡视野
- [ ] "Find My Pixel"按钮最醒目（金色渐变）
- [ ] 所有次要功能可收起（搜索、排行榜）
- [ ] 符合"城市本身就是UI"的理念

---

## Phase 2: 视觉震撼 🎨

### 任务 #66: 城市进入动画（第一印象）
**需求来源**: 十一、动画原则（城市进入 - 灯光亮起）
**优先级**: 🔴 P0-Critical（第一印象）
**预估**: 2天

> **"如果用户进入 3D 城市第一秒不会说 '哇'，那这个系统就是失败的。"**

**动画流程**:
```
用户点击 "City Mode"
↓
屏幕淡出（0.3s）
↓
切换到3D场景（黑屏）
↓
🌆 太阳升起动画（2s）
↓
🏙️ 建筑灯光依次亮起（3s，波浪效果）
↓
📷 相机缓慢拉远（俯瞰全城，2s）
↓
完成（进入交互状态）
```

**实现要点**:

#### 1. 初始场景设置（黑暗）
```swift
// CityView.onAppear
func setupEntranceAnimation() {
    // 1. 初始状态：黑暗
    directionalLight.light?.intensity = 0
    ambientLight.light?.intensity = 0

    // 2. 建筑初始透明
    for (_, node) in towerNodes {
        node.opacity = 0
    }

    // 3. 相机初始位置（近景）
    cameraNode.position = SCNVector3(0, 20, 30)
    cameraNode.look(at: SCNVector3Zero)
}
```

#### 2. 太阳升起
```swift
func playSunriseAnimation() {
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 2.0

    // 环境光从0到0.4
    ambientLight.light?.intensity = 400

    // 定向光从0到800
    directionalLight.light?.intensity = 800

    // 定向光旋转（模拟太阳升起）
    directionalLight.eulerAngles.x = -Float.pi / 3  // 从地平线到45度

    SCNTransaction.commit()
}
```

#### 3. 建筑灯光波浪亮起
```swift
func playBuildingsLightUpAnimation() {
    let sortedTowers = towerNodes.sorted { tower1, tower2 in
        // 按距离中心的距离排序（从中心向外扩散）
        let dist1 = SCNVector3.distance(tower1.value.position, to: SCNVector3Zero)
        let dist2 = SCNVector3.distance(tower2.value.position, to: SCNVector3Zero)
        return dist1 < dist2
    }

    // 分批亮起（每批50个建筑，间隔0.05s）
    for (index, tower) in sortedTowers.enumerated() {
        let delay = Double(index) * 0.05  // 波浪延迟

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            SCNTransaction.begin()
            SCNTransaction.animationDuration = 0.3

            // 建筑淡入
            tower.value.opacity = 1.0

            // 增强自发光（灯光亮起效果）
            if let material = tower.value.childNodes.first?.geometry?.materials.first {
                let currentEmission = material.emission.contents as? UIColor ?? .clear
                material.emission.contents = currentEmission.withAlphaComponent(0.3)
            }

            SCNTransaction.commit()
        }
    }
}
```

#### 4. 相机拉远
```swift
func playCameraZoomOutAnimation() {
    // 延迟3秒后执行（等待灯光动画完成）
    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 2.0
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)

        // 相机拉远到俯瞰位置
        cameraNode.position = SCNVector3(0, 150, 300)
        cameraNode.look(at: SCNVector3Zero)

        SCNTransaction.commit()
    }
}
```

#### 5. 完整入场序列
```swift
// CityView.onAppear
func playEntranceSequence() {
    // 1. 设置初始状态（黑暗）
    setupEntranceAnimation()

    // 2. 延迟0.5s开始动画（避免卡顿）
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        // 太阳升起（2s）
        playSunriseAnimation()

        // 延迟1s后建筑亮起（让太阳先升起一半）
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            playBuildingsLightUpAnimation()  // 3s
        }

        // 延迟3s后相机拉远
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            playCameraZoomOutAnimation()  // 2s
        }
    }
}
```

**验收标准**:
- [ ] 用户第一次进入City会说"哇"
- [ ] 动画总时长约7秒（不会太长）
- [ ] 太阳升起效果自然（光照渐变）
- [ ] 建筑亮起有波浪扩散效果
- [ ] 相机运动流畅（ease-out）
- [ ] 动画结束后可立即交互
- [ ] 再次进入时可跳过动画（用户偏好）

---

### 任务 #67: Bloom后处理效果
**需求来源**: 十、iOS技术选型（支持bloom）
**优先级**: 🟡 P1-High
**预估**: 1天

**目标**: 增强视觉冲击力，让灯光有光晕感

**实现**:
```swift
// TowerViewModel.setupScene()

func setupBloom() {
    // SceneKit内置bloom支持
    if let view = sceneView {
        view.technique = createBloomTechnique()
    }
}

func createBloomTechnique() -> SCNTechnique? {
    // 使用Metal shader实现bloom
    guard let techniqueURL = Bundle.main.url(
        forResource: "BloomTechnique",
        withExtension: "plist"
    ) else {
        return nil
    }

    guard let technique = SCNTechnique(contentsOf: techniqueURL) else {
        return nil
    }

    // 配置bloom参数
    technique.setValue(0.5, forKey: "bloomIntensity")
    technique.setValue(5.0, forKey: "bloomRadius")

    return technique
}
```

**Bloom配置文件** (`BloomTechnique.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>passes</key>
    <dict>
        <key>bloom</key>
        <dict>
            <key>draw</key>
            <string>DRAW_SCENE</string>
            <key>inputs</key>
            <dict>
                <key>colorSampler</key>
                <string>COLOR</string>
            </dict>
            <key>outputs</key>
            <dict>
                <key>color</key>
                <string>bloomOutput</string>
            </dict>
            <key>program</key>
            <string>bloom_program</string>
        </dict>
    </dict>
    <key>symbols</key>
    <dict>
        <key>bloomIntensity</key>
        <dict>
            <key>type</key>
            <string>float</string>
        </dict>
        <key>bloomRadius</key>
        <dict>
            <key>type</key>
            <string>float</string>
        </dict>
    </dict>
</dict>
</plist>
```

**验收标准**:
- [ ] 建筑自发光有明显光晕
- [ ] 性能影响<5 FPS
- [ ] 可通过设置开关bloom

---

### 任务 #68: 像素建造动画
**需求来源**: 六-3、十一（像素建造 - cube上升）
**优先级**: 🟡 P1-High
**预估**: 2天

**用户流程**:
```
用户在Map Mode绘制像素
↓
像素保存成功（API返回）
↓
切换到City Mode（或已在City）
↓
🎬 Cube从地面飞向楼顶（2s）
↓
楼高度增长（0.15m）
↓
提示: "You built floor 2413! 🏗️"
```

**实现**:

#### 1. 监听像素绘制事件
```swift
// DrawingViewModel 或 MapTabContent

func onPixelDrawn(pixel: PixelData) {
    // 发送通知
    NotificationCenter.default.post(
        name: .pixelDrawn,
        object: nil,
        userInfo: [
            "tileId": pixel.tileId,
            "floorIndex": pixel.floorIndex,
            "color": pixel.color
        ]
    )
}

// Notification名称定义
extension Notification.Name {
    static let pixelDrawn = Notification.Name("pixelDrawn")
}
```

#### 2. CityView监听并触发动画
```swift
// CityView.onAppear

.onReceive(NotificationCenter.default.publisher(for: .pixelDrawn)) { notification in
    guard let userInfo = notification.userInfo,
          let tileId = userInfo["tileId"] as? String,
          let floorIndex = userInfo["floorIndex"] as? Int,
          let color = userInfo["color"] as? String else {
        return
    }

    Task {
        await viewModel.playBuildingAnimation(
            tileId: tileId,
            floorIndex: floorIndex,
            color: color
        )
    }
}
```

#### 3. 建造动画实现
```swift
// TowerViewModel

func playBuildingAnimation(tileId: String, floorIndex: Int, color: String) async {
    guard let towerNode = towerNodes[tileId] else { return }

    await MainActor.run {
        // 1. 创建飞行cube
        let cube = SCNBox(width: 0.9, height: 0.15, length: 0.9, chamferRadius: 0.02)
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(hex: color) ?? .blue
        material.emission.contents = UIColor(hex: color)?.withAlphaComponent(0.5)
        cube.materials = [material]

        let cubeNode = SCNNode(geometry: cube)

        // 2. 起始位置（地面）
        cubeNode.position = SCNVector3(
            towerNode.position.x,
            0,
            towerNode.position.z
        )

        scene.rootNode.addChildNode(cubeNode)

        // 3. 飞行到楼顶
        let targetY = Float(floorIndex) * 0.15

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 2.0
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(
            controlPoints: 0.34, 1.56, 0.64, 1  // Elastic ease-out
        )

        cubeNode.position.y = targetY

        SCNTransaction.completionBlock = {
            // 4. 合并到建筑
            cubeNode.removeFromParentNode()

            // 5. 增加建筑高度（更新几何体）
            self.updateTowerHeight(tileId: tileId, newFloorCount: floorIndex + 1)

            // 6. 显示提示
            self.showBuildingToast(floorIndex: floorIndex)

            // 7. 触觉反馈
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        }

        SCNTransaction.commit()
    }
}

private func showBuildingToast(floorIndex: Int) {
    buildingToast = "You built floor \(floorIndex)! 🏗️"

    Task {
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        buildingToast = nil
    }
}
```

**验收标准**:
- [ ] Cube飞行动画流畅（elastic ease-out）
- [ ] 建筑高度实时增长
- [ ] 提示信息及时显示
- [ ] 有触觉反馈（成就感）
- [ ] 多个cube同时建造不卡顿

---

## Phase 3: 性能与扩展 🚀

### 任务 #69: LOD近景 - Pixel Cube显示
**需求来源**: 八、LOD（近景建筑=pixel cube）、九-3（可见楼层限制200）
**优先级**: 🟡 P1-High
**预估**: 3-4天

**目标**: 近距离观看建筑时，显示真实的像素cube堆叠

**LOD策略调整**:
```
远景（>200m）: 简单长方体（当前实现）
中景（50-200m）: 分段模型（当前实现）
近景（<50m）: Pixel Cube堆叠（NEW）
   - 限制显示200层（性能优化）
   - 其余压缩为简化段
```

**实现**:

#### 1. 修改LOD判断
```swift
enum TowerLOD {
    case high       // < 50m: Pixel cube显示
    case medium     // 50-200m: 简化柱体
    case low        // 200-1500m: 极简柱体
    case hidden     // > 1500m: 隐藏
}
```

#### 2. 近景显示Pixel Cubes
```swift
case .high:
    // 加载详细楼层数据
    if node.childNodes.isEmpty || !hasPixelCubes(node) {
        await loadAndDisplayPixelCubes(tileId: tileId, node: node)
    }
    node.isHidden = false
    node.opacity = 1.0

private func loadAndDisplayPixelCubes(tileId: String, node: SCNNode) async {
    // 1. 加载楼层数据
    guard let towerDetails = try? await fetchTowerDetails(tileId: tileId) else {
        return
    }

    // 2. 限制可见楼层（最多200层）
    let visibleFloors = towerDetails.floors.prefix(200)

    await MainActor.run {
        // 3. 移除旧的简化几何体
        node.childNodes.forEach { $0.removeFromParentNode() }

        // 4. 创建每一层的cube
        for floor in visibleFloors {
            let cube = createFloorCube(floor: floor)
            cube.position = SCNVector3(
                0,
                Float(floor.floorIndex) * 0.15,
                0
            )
            node.addChildNode(cube)
        }

        // 5. 如果总层数>200，顶部添加压缩段
        if towerDetails.totalFloors > 200 {
            let compressedTop = createCompressedSegment(
                fromFloor: 200,
                toFloor: towerDetails.totalFloors
            )
            node.addChildNode(compressedTop)
        }
    }
}

private func createFloorCube(floor: FloorData) -> SCNNode {
    let cube = SCNBox(width: 0.9, height: 0.15, length: 0.9, chamferRadius: 0.02)
    let material = SCNMaterial()

    let color = PatternColorExtractor.color(from: floor.patternId)
    material.diffuse.contents = color
    material.lightingModel = .physicallyBased

    cube.materials = [material]

    let cubeNode = SCNNode(geometry: cube)
    cubeNode.setValue(floor.floorIndex, forKey: "floorIndex")
    cubeNode.setValue(floor.userId, forKey: "userId")

    return cubeNode
}

private func createCompressedSegment(fromFloor: Int, toFloor: Int) -> SCNNode {
    let segmentHeight = Float(toFloor - fromFloor) * 0.15
    let box = SCNBox(width: 0.9, height: CGFloat(segmentHeight), length: 0.9, chamferRadius: 0.05)

    let material = SCNMaterial()
    material.diffuse.contents = UIColor.gray.withAlphaComponent(0.6)
    box.materials = [material]

    let node = SCNNode(geometry: box)
    node.position = SCNVector3(
        0,
        Float(fromFloor) * 0.15 + segmentHeight / 2,
        0
    )

    return node
}
```

**验收标准**:
- [ ] 近距离(<50m)显示真实cube堆叠
- [ ] 每层颜色正确（从pattern_id提取）
- [ ] 最多显示200层（性能保护）
- [ ] >200层部分用灰色压缩段表示
- [ ] 远离时自动切换回简化模型
- [ ] FPS保持>30（即使显示200 cubes）

---

### 任务 #70: Chunk Loading (500m×500m)
**需求来源**: 九-2（chunk loading）
**优先级**: 🟢 P2-Medium
**预估**: 2-3天

**目标**: 类似Minecraft，按空间块加载城市

**实现**:
```swift
// ChunkManager.swift

class ChunkManager {
    struct ChunkCoordinate: Hashable {
        let x: Int
        let z: Int
    }

    private let chunkSize: Float = 500.0  // 500m × 500m
    private var loadedChunks: Set<ChunkCoordinate> = []
    private var chunkTowers: [ChunkCoordinate: [String]] = [:]

    /// 计算位置所在chunk
    func getChunkCoordinate(position: SCNVector3) -> ChunkCoordinate {
        let chunkX = Int(floor(position.x / chunkSize))
        let chunkZ = Int(floor(position.z / chunkSize))
        return ChunkCoordinate(x: chunkX, z: chunkZ)
    }

    /// 获取需要加载的chunks（当前+周围8个）
    func getRequiredChunks(cameraPosition: SCNVector3) -> Set<ChunkCoordinate> {
        let center = getChunkCoordinate(position: cameraPosition)

        var required = Set<ChunkCoordinate>()
        for dx in -1...1 {
            for dz in -1...1 {
                required.insert(ChunkCoordinate(
                    x: center.x + dx,
                    z: center.z + dz
                ))
            }
        }
        return required
    }

    /// 更新chunks（加载新的，卸载旧的）
    func updateChunks(cameraPosition: SCNVector3, viewModel: TowerViewModel) async {
        let required = getRequiredChunks(cameraPosition: cameraPosition)

        // 卸载不需要的chunks
        let toUnload = loadedChunks.subtracting(required)
        for chunk in toUnload {
            await unloadChunk(chunk, viewModel: viewModel)
        }

        // 加载新chunks
        let toLoad = required.subtracting(loadedChunks)
        for chunk in toLoad {
            await loadChunk(chunk, viewModel: viewModel)
        }
    }
}
```

**验收标准**:
- [ ] 同时最多加载9个chunks
- [ ] 移动时自动加载/卸载chunks
- [ ] 卸载时建筑平滑消失
- [ ] 内存占用稳定（不随移动距离增长）

---

### 任务 #71: 性能监控与优化
**需求来源**: 综合性能要求
**优先级**: 🟢 P2-Medium
**预估**: 2天

**监控指标**:
```swift
struct CityPerformanceMetrics {
    var fps: Int
    var drawCalls: Int
    var visibleTowers: Int
    var visibleCubes: Int
    var memoryUsageMB: Double
    var chunkCount: Int
}
```

**性能目标**:
- FPS: ≥30 (iPhone 12+)
- Draw Calls: <200
- Memory: <800MB
- 可见Cubes: <5000

---

## 任务优先级总结

### 🔥 Must Have（Phase 0 + Phase 1核心）

1. **任务#60**: Map/City独立模式 (3-4天) - 架构基础
2. **任务#61**: 对数高度压缩 (0.5天) - 视觉基础
3. **任务#63**: Find My Pixel (2-3天) - 最重要产品功能
4. **任务#66**: 城市进入动画 (2天) - 第一印象
5. **任务#65**: 城市UI极简化 (1天) - 产品体验

**Phase 0+1 总计**: 约9-11天

---

### ⭐ Should Have（Phase 2）

6. **任务#64**: 建筑点击优化 (1-2天)
7. **任务#67**: Bloom效果 (1天)
8. **任务#68**: 建造动画 (2天)
9. **任务#62**: 数据模型整理 (1天)

**Phase 2 总计**: 约5-6天

---

### 💡 Nice to Have（Phase 3）

10. **任务#69**: Pixel Cube显示 (3-4天)
11. **任务#70**: Chunk Loading (2-3天)
12. **任务#71**: 性能监控 (2天)

**Phase 3 总计**: 约7-9天

---

## 开发路线图

### Week 1: 架构+核心体验
- Day 1-4: 任务#60 (Map/City分离)
- Day 4.5: 任务#61 (对数压缩)
- Day 5-7: 任务#63 (Find My Pixel)

### Week 2: 视觉震撼
- Day 1-2: 任务#66 (进入动画)
- Day 3: 任务#65 (极简UI)
- Day 4-5: 任务#64 (点击优化)

### Week 3: 视觉完善
- Day 1: 任务#67 (Bloom)
- Day 2-3: 任务#68 (建造动画)
- Day 4: 任务#62 (数据模型)
- Day 5: 集成测试

### Week 4: 性能与扩展
- Day 1-4: 任务#69 (Pixel Cube)
- Day 5: 任务#71 (性能监控)

---

## 验收标准（产品层面）

### ✅ Phase 0+1完成标准

用户测试场景：

1. **第一次进入City**
   - [ ] 用户说"哇！"
   - [ ] 灯光亮起动画震撼
   - [ ] 城市规模感强烈

2. **找到自己的像素**
   - [ ] "Find My Pixel"按钮醒目
   - [ ] 点击后3秒飞行到目标
   - [ ] Cube金色高亮清晰
   - [ ] 用户有成就感

3. **探索城市**
   - [ ] UI不遮挡视野（极简）
   - [ ] 点击建筑有聚焦动画
   - [ ] 统计信息清晰易读

4. **模式切换**
   - [ ] 用户清楚知道在"看"还是在"画"
   - [ ] 切换流畅无卡顿

### ✅ 最终成功标准

> **"用户会开始说：我在广州塔第2412层"**

当用户自发产生这种内容时，产品即成功。

---

**总预估工作量**: 21-26天（约4-5周）

**关键成功因素**:
1. 先做架构（Phase 0）再做功能
2. "Find My Pixel"必须完美
3. 第一印象动画必须震撼
4. 性能保证（FPS≥30）

---

*本文档基于14点核心需求编制，每个任务都可直接执行。*
