# FunnyPixels 病毒式营销功能 - 快速开始指南

## 🚀 快速设置（5分钟）

### 1. 运行设置脚本

```bash
cd /Users/ginochow/code/funnypixels3/backend
../setup_viral_marketing.sh
```

这个脚本会自动：
- ✅ 运行数据库迁移
- ✅ 验证配置文件
- ✅ 启动 ZeroClaw 守护进程
- ✅ 验证安装

### 2. 测试后端 API

#### 测试分享奖励
```bash
curl -X POST http://localhost:3000/api/share/record-action \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shareType": "session",
    "shareTarget": "wechat",
    "sessionId": "your-session-id"
  }'
```

**预期响应：**
```json
{
  "success": true,
  "reward": 5,
  "trackingUrl": "https://funnypixels.app/share/session/xxx?ref=ABC12345",
  "shareId": "uuid"
}
```

#### 测试邀请统计
```bash
curl http://localhost:3000/api/referral/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应：**
```json
{
  "referralCode": "ABC12345",
  "totalInvites": 12,
  "totalSecondLevelInvites": 5,
  "currentTier": {
    "level": 2,
    "inviterReward": 80,
    "inviteeReward": 30
  },
  "nextTier": {
    "threshold": 15,
    "remaining": 3,
    "inviterReward": 120,
    "inviteeReward": 50
  },
  "nextMilestone": {
    "threshold": 20,
    "remaining": 8,
    "points": 2000,
    "badge": "推广大使",
    "vipDays": 7
  }
}
```

---

## 📱 iOS 集成示例

### 1. 分享后记录并奖励

在 `SessionSummaryView.swift` 中：

```swift
import Foundation

class ShareRewardManager {
    static let shared = ShareRewardManager()

    func recordShare(shareType: String, shareTarget: String, sessionId: String?) {
        let endpoint = APIConfig.baseURL + "/api/share/record-action"

        var body: [String: Any] = [
            "shareType": shareType,
            "shareTarget": shareTarget
        ]

        if let sessionId = sessionId {
            body["sessionId"] = sessionId
        }

        APIClient.shared.post(endpoint, body: body) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let data):
                    if let reward = data["reward"] as? Int {
                        // 显示奖励提示
                        NotificationBanner.show(
                            title: "分享成功！",
                            message: "获得 \(reward) 积分奖励 🎉",
                            style: .success
                        )

                        // 更新用户积分
                        UserManager.shared.refreshPoints()
                    }
                case .failure(let error):
                    print("记录分享失败: \(error)")
                }
            }
        }
    }
}

// 使用示例
func shareToWeChat() {
    // ... 执行微信分享 ...

    // 分享成功后记录
    ShareRewardManager.shared.recordShare(
        shareType: "session",
        shareTarget: "wechat",
        sessionId: currentSession.id
    )
}
```

### 2. 显示邀请进度

在 `InviteFriendsView.swift` 中：

```swift
struct InviteProgressView: View {
    @State private var stats: ReferralStats?

    var body: some View {
        VStack(spacing: 20) {
            // 当前等级
            if let currentTier = stats?.currentTier {
                TierBadgeView(tier: currentTier)
            }

            // 进度到下一等级
            if let nextTier = stats?.nextTier {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("距离下一等级还需")
                            .font(.subheadline)
                        Spacer()
                        Text("\(nextTier.remaining) 人")
                            .font(.headline)
                            .foregroundColor(.blue)
                    }

                    ProgressView(
                        value: Double(stats!.totalInvites),
                        total: Double(nextTier.threshold)
                    )
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
            }

            // 下一个里程碑
            if let milestone = stats?.nextMilestone {
                MilestoneCardView(milestone: milestone)
            }

            // 二级邀请统计
            if let secondLevel = stats?.totalSecondLevelInvites, secondLevel > 0 {
                HStack {
                    Image(systemName: "link")
                    Text("二级邀请: \(secondLevel) 人")
                    Spacer()
                    Text("+\(secondLevel * 10) 积分")
                        .foregroundColor(.green)
                }
                .font(.caption)
            }
        }
        .onAppear {
            loadReferralStats()
        }
    }

    func loadReferralStats() {
        APIClient.shared.get("/api/referral/stats") { result in
            if case .success(let data) = result {
                self.stats = ReferralStats(from: data)
            }
        }
    }
}
```

### 3. VIP 订阅界面

创建 `VIPSubscriptionView.swift`：

```swift
struct VIPSubscriptionView: View {
    let vipTiers = ["normal", "premium", "elite"]

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // 标题
                Text("升级 VIP 会员")
                    .font(.largeTitle)
                    .bold()

                // VIP 等级对比
                HStack(spacing: 15) {
                    ForEach(vipTiers, id: \.self) { tier in
                        VIPTierCard(tier: tier)
                    }
                }

                // 购买按钮
                Button(action: purchaseVIP) {
                    Text("立即订阅")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                }
            }
            .padding()
        }
    }

    func purchaseVIP() {
        // 集成 iOS In-App Purchase
        StoreKitManager.shared.purchase(productID: "com.funnypixels.vip.premium.monthly")
    }
}

struct VIPTierCard: View {
    let tier: String

    var body: some View {
        VStack(spacing: 12) {
            // 图标
            tierIcon

            // 名称
            Text(tierName)
                .font(.headline)

            // 价格
            Text(tierPrice)
                .font(.title2)
                .bold()

            // 权益列表
            VStack(alignment: .leading, spacing: 8) {
                ForEach(tierBenefits, id: \.self) { benefit in
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                        Text(benefit)
                            .font(.caption)
                    }
                }
            }
        }
        .padding()
        .background(tierColor.opacity(0.1))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(tierColor, lineWidth: 2)
        )
    }

    var tierIcon: some View {
        switch tier {
        case "normal": return Text("⭐").font(.system(size: 40))
        case "premium": return Text("💎").font(.system(size: 40))
        case "elite": return Text("👑").font(.system(size: 40))
        default: return Text("⭐").font(.system(size: 40))
        }
    }

    var tierName: String {
        switch tier {
        case "normal": return "VIP 会员"
        case "premium": return "VIP+ 高级会员"
        case "elite": return "VIP Elite 尊享会员"
        default: return ""
        }
    }

    var tierPrice: String {
        switch tier {
        case "normal": return "¥9.88/月"
        case "premium": return "¥29.88/月"
        case "elite": return "¥68.88/月"
        default: return ""
        }
    }

    var tierBenefits: [String] {
        switch tier {
        case "normal":
            return ["商城9折", "每日50积分", "VIP徽章", "无广告"]
        case "premium":
            return ["商城8折", "每日150积分", "免费炸弹", "专属图案库"]
        case "elite":
            return ["商城7折", "每日500积分", "广告分成10%", "优先客服"]
        default:
            return []
        }
    }

    var tierColor: Color {
        switch tier {
        case "normal": return .blue
        case "premium": return .purple
        case "elite": return .orange
        default: return .gray
        }
    }
}
```

---

## 📊 数据模型

### ReferralStats

```swift
struct ReferralStats: Codable {
    let referralCode: String
    let totalInvites: Int
    let totalSecondLevelInvites: Int
    let totalRewardsEarned: Int
    let currentTier: TierInfo
    let nextTier: TierInfo?
    let nextMilestone: MilestoneInfo?
    let earnedMilestones: [MilestoneInfo]
    let secondLevelRewardPerInvite: Int

    struct TierInfo: Codable {
        let level: Int
        let inviterReward: Int
        let inviteeReward: Int
        let threshold: Int?
        let remaining: Int?
    }

    struct MilestoneInfo: Codable {
        let threshold: Int
        let remaining: Int?
        let points: Int
        let badge: String
        let achievement: String?
        let vipDays: Int?
        let vipTier: String?
    }
}
```

---

## 🎯 关键指标跟踪

### 1. 分享率

```swift
// 记录会话完成
SessionAnalytics.trackEvent("session_completed", properties: [
    "sessionId": sessionId,
    "pixels": pixelCount,
    "duration": duration
])

// 记录分享
SessionAnalytics.trackEvent("session_shared", properties: [
    "sessionId": sessionId,
    "shareTarget": "wechat"
])

// 计算分享率 = session_shared / session_completed
```

### 2. 邀请转化率

```swift
// 追踪邀请链接点击
func trackInviteLinkClick(referralCode: String) {
    Analytics.trackEvent("invite_link_clicked", properties: [
        "referralCode": referralCode,
        "source": "clipboard"
    ])
}

// 追踪邀请成功
func trackInviteSuccess(referralCode: String) {
    Analytics.trackEvent("invite_successful", properties: [
        "referralCode": referralCode,
        "reward": 50
    ])
}

// 转化率 = invite_successful / invite_link_clicked
```

### 3. VIP 转化率

```swift
// 追踪 VIP 页面访问
func trackVIPPageView() {
    Analytics.trackEvent("vip_page_viewed")
}

// 追踪 VIP 购买
func trackVIPPurchase(tier: String, price: Double) {
    Analytics.trackEvent("vip_purchased", properties: [
        "tier": tier,
        "price": price,
        "billingCycle": "monthly"
    ])
}

// 转化率 = vip_purchased / vip_page_viewed
```

---

## 🔧 常见问题

### Q: 分享奖励没有到账？
**A:** 检查：
1. 用户是否已登录（需要有效 token）
2. 后端 API 是否返回成功
3. 数据库 share_tracking 表是否有记录
4. wallet_ledger 表是否有积分变动记录

### Q: 邀请码无效？
**A:** 检查：
1. 邀请码格式是否正确（8位大写字母数字）
2. 用户是否已使用过其他邀请码
3. 邀请者和被邀请者是否是同一用户

### Q: VIP 权益未生效？
**A:** 检查：
1. vip_subscriptions 表中订阅是否 is_active = true
2. end_date 是否大于当前时间
3. 前端是否正确调用 VIP 权益检查 API

---

## 📚 更多资源

- **完整实施文档**: `VIRAL_MARKETING_IMPLEMENTATION.md`
- **后端配置**: `backend/config/pricing.js`, `backend/config/vip.js`
- **数据库迁移**: `backend/src/migrations/20260216_viral_marketing_and_vip_system.js`
- **API 路由**: `backend/src/routes/shareRoutes.js`

---

**祝你开发顺利！🎉**
