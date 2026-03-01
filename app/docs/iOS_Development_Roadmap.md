# FunnyPixels iOS App 开发路线图

## 项目目标

基于现有Web架构，开发原生iOS App前端，复用后端核心逻辑，充分发挥iOS原生能力（性能、定位、体验），满足App Store审核与长期演进需求。

---

## 开发阶段划分

### 🔧 阶段 0: 项目基础设施 (1-2天)

**目标**: 确保构建系统正常，开发环境就绪

#### 任务清单
- [ ] 配置Xcode工程基础设置
  - Bundle ID 确认（不可更改）
  - Scheme 设置为 Shared
  - Debug/Release 配置区分
  - Environment 配置(Dev/Prod)

- [ ] 验证xcodebuild命令行构建能力
  - `xcodebuild -list` 校验Scheme
  - Simulator构建命令可跑通
  - 真机构建命令可跑通
  - Archive构建脚本预留

#### 验收标准
- ✅ `swift build` 无源代码错误
- ✅ `xcodebuild` 可成功构建到模拟器
- ✅ 真机可成功运行App

---

### 🗺️ 阶段 1: 核心地图功能 (5-7天)

**目标**: 实现地图展示与像素基础渲染，建立技术架构

#### 1.1 技术选型与架构设计

- [ ] **确认地图容器技术选型**
  - 选项A: MapKit (系统原生，稳定，但定制性受限)
  - 选项B: 自定义渲染 (灵活，但开发成本高)
  - **推荐**: 先用MapKit验证，后期可迁移

- [ ] **设计像素数据结构**
  ```swift
  // Chunk/Tile数据结构示例
  struct PixelChunk {
      let bounds: MapRect
      let zoomLevel: Int
      let pixels: [Pixel]
      let cacheKey: String
  }

  struct PixelTileManager {
      func fetchTile(for bounds: MapRect, zoom: Int) async -> PixelChunk
      func cacheTile(_ chunk: PixelChunk)
      func invalidateTile(at bounds: MapRect)
  }
  ```

#### 1.2 渲染能力实现

- [ ] **基础像素渲染(低密度场景)**
  - 单个像素作为MapKit Annotation
  - 自定义AnnotationView样式
  - 颜色支持(hex -> Color转换)

- [ ] **LOD(Level of Detail)缩放策略**
  ```swift
  // 缩放级别对应策略
  // Zoom 1-10:  显示区域聚合点
  // Zoom 11-15: 显示像素簇(clusters)
  // Zoom 16-20: 显示单个像素
  ```

- [ ] **地图平移/缩放与像素同步刷新**
  - 监听地图区域变化(MKMapViewDelegate)
  - 计算可见区域(visibleMapRect)
  - 触发像素数据加载

- [ ] **渲染缓存机制**
  - 内存缓存(LRU策略)
  - 磁盘缓存(可选)
  - 缓存失效策略

#### 验收标准
- ✅ 地图可正常加载与交互
- ✅ 像素能根据缩放级别正确显示
- ✅ 滑动地图时像素同步刷新
- ✅ 缓存命中率 > 70%

---

### 🎨 阶段 2: 像素绘制功能 (3-4天)

**目标**: 实现用户绘制像素能力，建立前后端同步机制

#### 2.1 基础绘制能力

- [ ] **单点像素绘制(Tap交互)**
  ```swift
  // 点击地图绘制
  func handleMapTap(at coordinate: CLLocationCoordinate2D) {
      // 1. 创建本地像素预览
      // 2. 发送API请求
      // 3. 成功：确认；失败：回滚
  }
  ```

- [ ] **绘制频率限制(防审核风险)**
  - 客户端限流: 最多1次/秒
  - 本地队列管理
  - 超频提示用户

- [ ] **本地绘制预览(Optimistic UI)**
  - 立即显示用户绘制的像素
  - 标记为"pending"状态
  - 显示加载动画

- [ ] **绘制失败回滚机制**
  - 网络失败：移除pending像素
  - 冲突检测：显示错误提示
  - 重试机制(可选)

#### 2.2 路径绘制(v1)

- [ ] **前台GPS路径绘制**
  - 请求定位权限(仅使用期间)
  - 轨迹采样(每N米/秒)
  - 批量提交像素

#### 验收标准
- ✅ 点击地图可绘制像素
- ✅ 绘制频率符合限制
- ✅ 失败场景正确回滚
- ✅ GPS轨迹绘制可用

---

### 🔄 阶段 3: 实时更新系统 (4-5天)

**目标**: 建立WebSocket实时通信，支持多人协作

#### 3.1 WebSocket基础设施

- [ ] **实现iOS专用WebSocket Manager**
  ```swift
  class WebSocketManager {
      private var task: URLSessionWebSocketTask?

      func connect(url: URL)
      func disconnect()
      func subscribe(region: MapRect)
      func unsubscribe(region: MapRect)
      func onMessage(_ handler: @escaping (PixelEvent) -> Void)
  }
  ```

- [ ] **区域订阅机制(基于地图视口)**
  - 视口变化时更新订阅区域
  - 离开视口取消订阅(节省带宽)
  - 订阅状态管理

- [ ] **增量更新协议(Delta)**
  ```json
  {
    "type": "pixel_update",
    "data": {
      "action": "add|update|remove",
      "pixels": [...]
    }
  }
  ```

- [ ] **WS仅做事件通知，HTTP拉取数据**
  - WS收到事件 → 触发HTTP API获取详细数据
  - 避免WS传输大量数据
  - 降低消息丢失风险

#### 3.2 网络健壮性

- [ ] **断线重连处理**
  - 指数退避重连策略
  - 重连后重新订阅区域
  - 全量数据同步(首次连接/长时间断线)

- [ ] **网络抖动处理**
  - 消息去重(by message_id)
  - 乱序消息排序(by timestamp)
  - 超时检测与降级

#### 验收标准
- ✅ WebSocket连接稳定
- ✅ 能收到其他用户的像素更新
- ✅ 断线重连后数据一致
- ✅ 弱网环境可用

---

### 👤 阶段 4: 用户体系完善 (2-3天)

**目标**: 完善用户登录、状态管理、安全存储

#### 4.1 安全存储

- [ ] **Token存储(Keychain)**
  ```swift
  class KeychainManager {
      func saveToken(_ token: String) throws
      func getToken() throws -> String?
      func deleteToken() throws
  }
  ```

- [ ] **登录状态恢复**
  - App启动时检查Keychain
  - Token有效性验证(API调用)
  - 自动登录或跳转登录页

#### 4.2 用户模式

- [ ] **游客模式支持**
  - 允许未登录用户浏览地图
  - 绘制像素时提示登录
  - 游客 → 正式用户流程

- [ ] **基础用户行为埋点**
  - 关键操作记录(登录、绘制、分享)
  - 本地缓存 + 批量上报
  - 隐私合规(获取用户同意)

#### 验收标准
- ✅ Token安全存储在Keychain
- ✅ 杀死App重启后保持登录
- ✅ 游客模式可正常浏览
- ✅ 埋点数据可查看

---

### 🧪 阶段 5: 测试与质量保障 (3-4天)

**目标**: 建立测试体系，确保代码质量

#### 5.1 单元测试(必须)

- [ ] **Model Codable测试**
  ```swift
  func testPixelCodable() {
      let json = """
      {"id":"123","latitude":39.9,"longitude":116.4,...}
      """
      let pixel = try? JSONDecoder().decode(Pixel.self, from: json.data(using: .utf8)!)
      XCTAssertNotNil(pixel)
  }
  ```

- [ ] **API数据解析测试**
  - 正常响应解析
  - 错误响应处理
  - 边界值测试

- [ ] **关键业务规则测试(像素冲突)**
  - 同一坐标重复绘制检测
  - 绘制权限验证
  - 颜色合法性校验

#### 5.2 网络与异常测试

- [ ] **弱网场景测试**
  - Network Link Conditioner模拟
  - 3G/Edge网络下体验
  - 超时处理验证

- [ ] **WS断连重连测试**
  - 主动断开网络
  - 切换前后台
  - 长时间后台恢复

- [ ] **API超时/失败UI表现**
  - 加载状态显示
  - 错误提示友好
  - 重试按钮可用

#### 验收标准
- ✅ 单元测试覆盖率 > 60%
- ✅ 所有测试通过
- ✅ 弱网场景无崩溃
- ✅ 错误提示清晰准确

---

### 📱 阶段 6: 真机测试与优化 (5-7天)

**目标**: 在真实设备上验证性能与稳定性

#### 6.1 真机测试准备

- [ ] **Apple Developer账号配置**
  - 注册开发者账号
  - 添加测试设备UDID
  - 创建Provisioning Profile
  - 配置App ID与Capabilities

- [ ] **真机Run成功**
  - 连接iPhone真机
  - Xcode选择真机设备
  - Build & Run成功

#### 6.2 性能验证(FunnyPixels特有)

- [ ] **GPS精度与耗电**
  - 定位精度测试(误差<10米)
  - 后台定位耗电量
  - 电量消耗趋势(Instruments)

- [ ] **地图滑动帧率**
  - 目标: 60fps
  - 使用Instruments - Core Animation
  - 优化掉帧场景

- [ ] **像素渲染性能**
  - 1000像素渲染时间 < 500ms
  - 10000像素分批渲染
  - GPU使用率监控

- [ ] **长时间运行稳定性**
  - 连续运行2小时无崩溃
  - 内存增长 < 50MB
  - 切换前后台正常恢复

#### 6.3 Instruments分析(进阶)

- [ ] **CPU使用率** (目标: 平均 < 30%)
- [ ] **GPU帧率** (目标: 稳定60fps)
- [ ] **内存增长** (目标: 无泄漏)
- [ ] **电量消耗** (目标: 使用1小时 < 10%电量)

#### 验收标准
- ✅ 真机运行流畅
- ✅ GPS定位准确
- ✅ 渲染性能达标
- ✅ 无明显内存泄漏
- ✅ 电量消耗合理

---

## 技术能力边界（给Claude的指导）

### ✅ 必须具备的能力

- Swift / SwiftUI开发
- MVVM架构设计
- MapKit或自定义地图渲染
- WebSocket(URLSessionWebSocketTask)
- Codable / 网络层抽象
- Keychain安全存储
- xcodebuild基本使用
- 单元测试编写

### ⚠️ 谨慎处理的能力

- **后台定位**: App Store审核高风险，需明确使用场景说明
- **高频网络请求**: 需客户端限流 + 服务端保护
- **大规模GPU绘制**: 需分批渲染 + LOD策略
- **实时数据同步**: 需处理冲突 + 断线重连

### ❌ 不要求自动完成的部分

- Metal渲染核心优化（需专家介入）
- GPU性能极限调优（需profiling分析）
- App Store审核博弈策略（需人工决策）
- 高级安全防护（需安全团队review）

---

## 里程碑与交付物

### Milestone 1: 可构建可运行 (Week 1)
- ✅ Xcode工程配置完成
- ✅ 模拟器/真机可运行
- ✅ 基础地图显示

### Milestone 2: 核心功能可用 (Week 2-3)
- ✅ 像素渲染可用
- ✅ 点击绘制像素
- ✅ WebSocket实时更新

### Milestone 3: 完整功能闭环 (Week 4)
- ✅ 用户登录/状态管理
- ✅ GPS路径绘制
- ✅ 单元测试覆盖

### Milestone 4: 生产就绪 (Week 5-6)
- ✅ 真机性能达标
- ✅ 稳定性测试通过
- ✅ 代码质量审查完成

---

## 架构原则

1. **复用优先**: 最大化复用现有后端API，不重复造轮子
2. **原生体验**: iOS不是Web的复制品，充分利用原生能力
3. **渐进增强**: 先保证核心功能稳定，再扩展高级特性
4. **测试驱动**: 关键逻辑必须有单元测试覆盖
5. **性能优先**: 响应式UI + 异步加载 + 缓存策略
6. **安全第一**: 敏感数据加密存储，网络传输安全

---

## 风险管理

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| App Store审核被拒 | 高 | 提前研究审核指南，避免高风险功能 |
| 大规模像素渲染性能 | 高 | LOD策略 + 分批渲染 + GPU优化 |
| WebSocket稳定性 | 中 | 重连机制 + 降级策略 + 心跳检测 |
| 后台定位耗电 | 中 | 合理使用定位级别，提供开关控制 |
| 数据同步冲突 | 中 | 乐观锁 + 冲突检测 + 用户提示 |

---

## 下一步行动

1. **立即开始**: 阶段0 - 验证构建系统
2. **技术选型会议**: 确认MapKit vs 自定义渲染
3. **后端API对接**: 确认像素数据接口规范
4. **设计评审**: UI/UX设计与Web对齐讨论

---

**项目成功标准**: 构建一个原生性能可控、与Web后端解耦、可长期维护、可逐步扩展到Android的FunnyPixels iOS App客户端

**当前版本目标**: iOS v1 - 可用、稳定、可过审，不追求Web全功能对齐
