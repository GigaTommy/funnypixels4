# iOS API Stress Test Tool

Swift 命令行工具，用于模拟多个 iOS 客户端并发访问后端 API，验证服务端在真实 iOS 请求下的性能表现。

## 功能特性

- ✅ 模拟多个 iOS 用户并发登录和操作
- ✅ 支持完整的 iOS API 调用链（登录、绘制像素、加载地图、排行榜、用户信息）
- ✅ 实时统计成功率、延迟（P50/P95/P99）、RPS
- ✅ 支持多种压测场景（smoke/medium/full/custom）
- ✅ 使用 Alamofire 复刻真实 iOS 网络层行为

## 快速开始

### 1. 安装依赖

```bash
cd ios-stress-test
swift package resolve
```

### 2. 准备测试数据

运行后端压测准备工具生成测试用户：

```bash
cd ../ops/loadtest
# 确保 test-users.json 已生成
ls data/test-users.json
```

### 3. 运行压测

**Smoke 测试**（5 用户，30 秒）：
```bash
swift run iOSStressTest
```

**Medium 测试**（50 用户，5 分钟）：
```bash
swift run iOSStressTest --scenario medium
```

**Full 测试**（100 用户，10 分钟）：
```bash
swift run iOSStressTest --scenario full
```

**自定义测试**：
```bash
# 20 用户，运行 2 分钟
swift run iOSStressTest --users 20 --duration 120
```

**测试远程服务器**：
```bash
swift run iOSStressTest --url https://api.funnypixels.com --scenario medium
```

## 压测场景

### 混合场景（默认）

每个虚拟用户随机执行以下操作：

- **30%** - 绘制像素 (POST /api/pixels/draw)
- **40%** - 加载 MVT 地图瓦片 (GET /api/tiles/mvt/:z/:x/:y.mvt)
- **20%** - 获取排行榜 (GET /api/leaderboard/personal)
- **10%** - 获取用户信息 (GET /api/auth/me)

操作间隔：0.5-2 秒随机延迟

## 输出示例

```
========================================
  iOS API Stress Test - Starting
========================================
Base URL:    http://localhost:3001
Users:       50
Duration:    300s
Scenario:    StressTestConfig.Scenario.medium

✅ Loaded 1100 test users

Logging in 50 users...

================================================================
  iOS STRESS TEST - RESULTS
================================================================

--- DURATION ---
  Test Duration: 301.2s

--- WRITE METRICS (Draw Pixel) ---
  Total:        4523
  Success:      4521
  Conflict:     0
  Frozen:       2
  No Points:    0
  Failure:      0
  Success Rate: 99.96%
  Latency Avg:  18.3ms
  Latency P50:  8.0ms
  Latency P95:  45.0ms
  Latency P99:  198.0ms
  RPS:          15.0

--- READ METRICS ---
  Total Reads:  15234

  MVT Tile:
    Success:    6012
    Failure:    0
    Avg:        9.2ms
    P95:        19.0ms

  Leaderboard:
    Success:    3014
    Failure:    0
    Avg:        15.3ms
    P95:        31.0ms

  Auth/me:
    Success:    1508
    Failure:    0
    Avg:        4.1ms
    P95:        11.0ms

--- GLOBAL ---
  Total Requests: 19757
  Total RPS:      65.6

================================================================
```

## 架构说明

### 文件结构

```
ios-stress-test/
├── Package.swift              # SPM 依赖配置
├── README.md                  # 本文档
└── Sources/
    └── iOSStressTest/
        ├── main.swift         # 入口 + CLI 参数解析
        ├── Config.swift       # 配置模型
        ├── APIClient.swift    # 网络层（复刻 iOS APIManager）
        └── StressTestRunner.swift  # 压测引擎 + 指标收集
```

### 与 iOS App 的对应关系

| iOS App 组件 | 压测工具对应 |
|--------------|--------------|
| `APIManager.swift` | `APIClient.swift` |
| `Alamofire` 依赖 | 相同 |
| `APIEndpoint` 枚举 | 硬编码 URL |
| `PixelDrawService` | `drawPixel()` 方法 |
| `LeaderboardService` | `getPersonalLeaderboard()` 方法 |

## 与 k6 压测的对比

| 特性 | k6 压测 | iOS 压测工具 |
|------|---------|--------------|
| **语言** | JavaScript | Swift |
| **网络库** | k6 http | Alamofire（与 iOS 一致）|
| **并发模型** | VU 协程 | Swift Concurrency (async/await) |
| **适用场景** | 通用 HTTP 压测 | 验证 iOS 客户端行为 |
| **规模** | 支持 1000+ VUs | 适合 100-200 并发 |
| **真实性** | 模拟 HTTP 请求 | 复刻真实 iOS 网络层 |

## 技术栈

- **Swift 5.9+**
- **Swift Package Manager**
- **Alamofire 5.8+** - iOS 标准网络库
- **Swift Concurrency** - async/await 并发模型

## 常见问题

**Q: 为什么不直接用 k6？**

A: k6 是通用 HTTP 压测工具，但无法完全模拟 iOS 的网络层行为（如 Alamofire 的重试逻辑、请求编码、错误处理等）。这个工具复刻了 iOS app 的真实网络代码，能更准确地验证后端在 iOS 客户端下的表现。

**Q: 最大支持多少并发？**

A: 建议不超过 200 并发用户。超过此数量应使用 k6 进行大规模压测。

**Q: 测试用户从哪里来？**

A: 复用 k6 压测的测试用户数据（`ops/loadtest/data/test-users.json`）。运行 `/stress-test-prepare` 会自动生成。

## 后续扩展

可以添加更多场景：

- 联盟操作（创建、加入、退出）
- 漂流瓶发送/捡取
- 商城购买
- 签到打卡
- GPS 绘制

只需在 `StressTestRunner` 中添加对应的测试方法即可。
