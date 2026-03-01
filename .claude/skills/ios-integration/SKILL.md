---
name: ios-integration
description: Integrate viral marketing features into iOS app. Use when implementing share rewards, invitation system, or VIP subscription features in Swift.
context: fork
agent: general-purpose
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(xcodebuild *), Bash(swift *)
argument-hint: [feature-name]
---

# iOS 病毒式营销功能集成

自动化集成病毒式营销功能到 FunnyPixels iOS 应用。

## 功能选择
集成功能: $ARGUMENTS (如未指定，则显示功能列表让用户选择)

## 可用功能模块

1. **share-reward** - 分享奖励系统
2. **invite-tiers** - 分层邀请系统
3. **vip-subscription** - VIP 会员订阅
4. **shop-discount** - 商城折扣显示
5. **milestone-progress** - 里程碑进度展示

## 集成流程

### 阶段 1: 分析和规划 (5分钟)

1. **定位目标文件**
   - 使用 Glob 查找相关 Swift 文件
   - 读取现有代码结构
   - 识别需要修改的类和方法

2. **API 端点验证**
   - 检查后端 API 端点是否存在
   - 验证请求/响应格式
   - 确认认证方式

3. **依赖检查**
   - 检查是否需要新的 Swift 包
   - 验证现有网络层是否支持
   - 确认 UI 组件库可用性

### 阶段 2: 实现核心功能 (20-30分钟)

#### 对于 share-reward 功能：

1. **创建管理器类**
   ```swift
   // FunnyPixelsApp/Services/ShareRewardManager.swift
   class ShareRewardManager {
       static let shared = ShareRewardManager()
       func recordShare(shareType: String, shareTarget: String, sessionId: String?)
       func getShareStats() async throws -> ShareStats
   }
   ```

2. **修改 SessionSummaryView**
   - 定位分享按钮点击事件
   - 添加 API 调用
   - 实现奖励动画
   - 更新积分显示

3. **错误处理**
   - 网络错误重试
   - 离线缓存
   - 用户友好的错误提示

#### 对于 invite-tiers 功能：

1. **创建数据模型**
   ```swift
   struct ReferralStats: Codable {
       let currentTier: TierInfo
       let nextTier: TierInfo?
       let nextMilestone: MilestoneInfo?
   }
   ```

2. **修改 InviteFriendsView**
   - 添加等级展示卡片
   - 实现进度条
   - 显示里程碑奖励
   - 二级邀请统计

3. **UI 组件**
   - TierBadgeView
   - MilestoneProgressView
   - InviteStatsCard

#### 对于 vip-subscription 功能：

1. **创建 VIPSubscriptionView**
   - VIP 等级对比卡片
   - 权益列表展示
   - 订阅购买按钮

2. **集成 StoreKit**
   - 配置产品 ID
   - 实现购买流程
   - 处理恢复购买
   - 订阅状态同步

3. **VIP 状态管理**
   - 本地缓存 VIP 状态
   - 定期同步服务器
   - 权益过期处理

### 阶段 3: 测试验证 (10-15分钟)

1. **单元测试**
   - 为新创建的类编写测试
   - 测试覆盖率 > 80%

2. **UI 测试**
   - 验证页面渲染
   - 测试交互流程
   - 检查边界情况

3. **集成测试**
   - 模拟 API 响应
   - 测试错误场景
   - 验证数据流

4. **手动测试清单**
   ```
   [ ] 分享按钮可点击
   [ ] 分享成功后显示奖励
   [ ] 积分正确更新
   [ ] 错误提示友好
   [ ] 离线行为正确
   ```

### 阶段 4: 文档和交付 (5分钟)

1. **代码注释**
   - 为新方法添加文档注释
   - 解释复杂逻辑

2. **更新文档**
   - 更新 README 中的集成状态
   - 添加使用示例

3. **创建 PR**
   - 生成详细的变更说明
   - 列出测试结果
   - 提供截图（如适用）

## 实现检查清单

### 功能完整性
- [ ] API 调用正确实现
- [ ] 数据模型匹配后端响应
- [ ] UI 展示符合设计要求
- [ ] 所有交互流程可用

### 代码质量
- [ ] 遵循 Swift 代码规范
- [ ] 无内存泄漏（weak/unowned 正确使用）
- [ ] 线程安全（UI 更新在主线程）
- [ ] 错误处理完善

### 测试覆盖
- [ ] 单元测试覆盖率 > 80%
- [ ] 关键路径有集成测试
- [ ] UI 测试覆盖主要流程

### 用户体验
- [ ] 加载状态显示
- [ ] 错误提示清晰
- [ ] 动画流畅
- [ ] 适配不同屏幕尺寸

## 输出文件

生成以下文件：

1. **实施报告**: `iOS_INTEGRATION_REPORT_${feature-name}.md`
   - 修改的文件列表
   - 新增的类和方法
   - 测试结果
   - 已知问题和限制

2. **测试报告**: `TEST_RESULTS_${feature-name}.md`
   - 单元测试结果
   - 集成测试结果
   - 覆盖率统计

3. **用户指南**: `USER_GUIDE_${feature-name}.md`
   - 功能使用说明
   - 截图和示例
   - 常见问题

## 成功标准

✅ 所有功能正常工作
✅ 测试覆盖率 > 80%
✅ 无编译警告
✅ 通过 Xcode 静态分析
✅ UI 响应流畅 (<100ms)
✅ 内存占用合理
✅ 文档完整

## 常见问题处理

### 网络错误
- 实现指数退避重试
- 提供离线模式
- 缓存关键数据

### UI 卡顿
- 使用异步加载
- 图片懒加载
- 分页加载数据

### 内存泄漏
- 使用 Instruments 检测
- 正确使用 weak/unowned
- 及时释放资源

---

**执行此 skill**: `/ios-integration share-reward`
**查看可用功能**: `/ios-integration`
