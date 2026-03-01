# Web 端功能参考模块

此模块用于参考 Web 端实现，确保 iOS 端功能一致性。

## 功能对比映射

### 1. 用户认证
| Web 端 | iOS 端 | 状态 |
|--------|--------|------|
| /login | AuthView | ✅ |
| /register | AuthView | ✅ |
| /logout | AuthViewModel.logout() | ✅ |

### 2. 地图绘制
| Web 端 | iOS 端 | 差异说明 |
|--------|--------|----------|
| MapView + WebGL | MapView + MapKit | 使用原生地图 |
| 像素网格系统 | 相同 | 已实现 |
| 实时绘制 | 相同 | 已实现 |

### 3. 联盟系统
| Web 端 | iOS 端 | 状态 |
|--------|--------|------|
| /alliance | AllianceView | ✅ |
| 创建联盟 | ModernAllianceView | ✅ |
| 联盟列表 | ModernAllianceView | ✅ |

### 4. 排行榜
| Web 端 | iOS 端 | 状态 |
|--------|--------|------|
| /leaderboard | LeaderboardView | ✅ |
| 个人排行 | PersonalLeaderboardView | ✅ |
| 联盟排行 | AllianceLeaderboardView | ✅ |

### 5. 商店
| Web 端 | iOS 端 | 状态 |
|--------|--------|------|
| /store | ModernStoreView | ✅ |
| 颜色商店 | ColorStoreTab | ✅ |
| 道具商店 | ItemStoreTab | ✅ |

### 6. 个人中心
| Web 端 | iOS 端 | 状态 |
|--------|--------|------|
| /profile | ModernProfileView | ✅ |
| 绘制历史 | HistoryView | ✅ |
| 设置 | SettingsView | ✅ |

## API 端点对应

### 认证相关
```typescript
// Web 端
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/me

// iOS 端 (APIManager.swift)
func login(username: String, password: String)
func register(username: String, email: String, password: String)
func logout()
func getCurrentUser()
```

### 像素相关
```typescript
// Web 端
GET  /api/pixels
POST /api/pixels
PUT  /api/pixels/:id
DELETE /api/pixels/:id

// iOS 端
func loadPixels()
func createPixel(at: CLLocationCoordinate2D, color: String)
func updatePixel(_ pixel: Pixel)
func deletePixel(_ pixel: Pixel)
```

### 联盟相关
```typescript
// Web 端
GET  /api/alliances
POST /api/alliances
POST /api/alliances/:id/join
POST /api/alliances/:id/leave

// iOS 端
func loadAlliances()
func createAlliance()
func joinAlliance(_ alliance: Alliance)
func leaveAlliance()
```

## 数据模型对应

### Pixel 模型
```typescript
// Web 端
interface Pixel {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  authorId: string;
  createdAt: Date;
}

// iOS 端 (完全一致)
public struct Pixel: Codable, Identifiable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let color: String
    public let authorId: String
    public let createdAt: Date
}
```

### Alliance 模型
```typescript
// Web 端
interface Alliance {
  id: string;
  name: string;
  description: string;
  flagColor: string;
  isPublic: boolean;
  memberCount: number;
  createdAt: Date;
}

// iOS 端 (注意: 使用 memberCount 而非 pixelCount)
public struct Alliance: Codable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let flagColor: String
    public let isPublic: Bool
    public let memberCount: Int  // ✅ 正确
    public let createdAt: Date
}
```

## UI/UX 对应指南

### 1. 颜色系统
```swift
// Web 端 (Tailwind CSS)
bg-blue-500 → #3B82F6
text-gray-600 → #4B5563

// iOS 端 (使用相同十六进制值)
Color(hex: "#3B82F6")
Color(hex: "#4B5563")
```

### 2. 圆角和阴影
```swift
// Web 端
rounded-lg (8px) → .cornerRadius(8)
shadow-md → .shadow(color: .black.opacity(0.1), radius: 4)

// iOS 端
.cornerRadius(8)
.shadow(color: .black.opacity(0.1), radius: 4)
```

### 3. 间距系统
```swift
// Web 端 (Tailwind 4px 单位)
p-4 (16px) → .padding(16)
gap-2 (8px) → spacing: 8

// iOS 端
.padding(16)
VStack(spacing: 8)
```

## 功能完整性检查清单

### 核心功能
- [x] 用户登录/注册
- [x] 地图浏览和缩放
- [x] GPS 绘制像素
- [x] 像素详情查看
- [x] 创建/编辑/删除像素
- [x] 联盟创建和加入
- [x] 排行榜查看
- [x] 商店购买
- [x] 个人资料
- [x] 绘制历史

### iOS 特有优化
- [x] 原生地图 (MapKit)
- [x] GPS 后台跟踪
- [x] 触觉反馈
- [x] 推送通知
- [x] 生物识别
- [x] 深色模式
- [x] 动态字体

### 待实现功能
- [ ] 实时协作通知
- [ ] 像素时间旅行回放
- [ ] AR 模式查看
- [ ] iCloud 同步
- [ ] Widget 支持

## 常见问题处理

### 问题 1: API 响应格式不一致
```typescript
// Web 端期望
{ success: true, data: {...} }

// iOS 端处理
struct Response<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let message: String?
}
```

### 问题 2: 分页参数不同
```typescript
// Web 端
?page=1&limit=20

// iOS 端
struct PaginationParams {
    let page: Int
    let limit: Int
}
```

### 问题 3: 日期格式
```typescript
// Web 端 (ISO 8601)
"2024-01-01T00:00:00.000Z"

// iOS 端处理
let isoFormatter = ISO8601DateFormatter()
let date = isoFormatter.date(from: string)
```

## 测试对照

### 端到端测试场景
1. 用户登录 → 创建像素 → 加入联盟 → 查看排行
2. GPS 绘制 → 实时同步 → 查看历史
3. 商店浏览 → 购买道具 → 使用道具
4. 个人资料 → 编辑信息 → 保存

### 数据一致性验证
```bash
# 对比 API 响应
curl https://api.funnypixels.com/pixels | jq .

# iOS 端打印响应
print(JSONEncoder().encode(pixels))
```
