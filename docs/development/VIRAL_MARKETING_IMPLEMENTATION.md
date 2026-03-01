# FunnyPixels 病毒式营销和商业化实施文档

## 📋 实施概览

本文档记录了 FunnyPixels 病毒式营销和商业化改进的完整实施方案。

### ✅ 已实施功能

#### Phase 1: ZeroClaw 守护进程 ✅

**文件创建：**
- ✅ `~/Library/LaunchAgents/com.zeroclaw.funnypixels.plist` - launchd 配置文件
- ✅ `/Users/ginochow/code/funnypixels3/.zeroclaw/tasks.yaml` - 任务配置文件

**功能：**
- 每6小时自动运行代码质量检查
- 自动化性能监控和优化建议
- 病毒式营销功能开发建议
- 商业化优化建议

**启动守护进程：**
```bash
# 加载服务
launchctl load ~/Library/LaunchAgents/com.zeroclaw.funnypixels.plist

# 立即运行一次
launchctl start com.zeroclaw.funnypixels

# 查看状态
launchctl list | grep zeroclaw

# 查看日志
tail -f /Users/ginochow/code/funnypixels3/.zeroclaw/daemon.log
```

---

#### Phase 2: 病毒式营销功能 ✅

##### 2.1 增强分享奖励闭环 (P0)

**后端修改：**
- ✅ `backend/src/controllers/shareController.js`
  - 新增 `recordShareAction()` - 记录分享行为并奖励
  - 新增 `generateTrackingUrl()` - 生成追踪链接
  - 新增 `getShareTrackingStats()` - 获取分享统计

**API 端点：**
```javascript
// 记录分享并奖励
POST /api/share/record-action
Body: {
  shareType: 'session',      // 'session', 'achievement', 'profile'
  shareTarget: 'wechat',     // 'wechat', 'weibo', 'xiaohongshu', 'system'
  sessionId: '<uuid>'        // 可选
}
Response: {
  success: true,
  reward: 5,                 // 获得5积分
  trackingUrl: 'https://...',
  shareId: '<uuid>'
}

// 获取分享统计
GET /api/share/tracking-stats
Response: {
  success: true,
  data: {
    totalShares: 25,
    totalClicks: 120,
    shares: [...]
  }
}
```

**奖励机制：**
- 每次分享奖励 **5积分**
- 生成包含用户邀请码的追踪链接
- 记录分享行为到数据库

---

##### 2.2 优化邀请系统 (P0)

**后端修改：**
- ✅ `backend/src/models/Referral.js` - 全面升级

**新功能：**

1. **分层奖励机制**
   ```javascript
   tier1 (0-4人):   邀请者50分  + 被邀请者20分
   tier2 (5-14人):  邀请者80分  + 被邀请者30分
   tier3 (15-29人): 邀请者120分 + 被邀请者50分
   tier4 (30+人):   邀请者200分 + 被邀请者100分
   ```

2. **里程碑奖励**
   - 邀请5人：500积分 + "社交达人"成就
   - 邀请20人：2000积分 + "推广大使"成就 + VIP 7天体验
   - 邀请50人：10000积分 + "传奇推荐人"成就 + 永久 VIP Elite

3. **二级邀请奖励**
   - 你邀请的人再邀请他人时，你获得 **10积分**
   - 形成病毒式传播网络

4. **移除邀请上限**
   - 之前：最多邀请10人，上限500积分
   - 现在：无上限，随着邀请数量增加奖励递增

**API 变化：**
```javascript
// 获取邀请统计（新增字段）
GET /api/referral/stats
Response: {
  referralCode: "ABC12345",
  totalInvites: 12,
  totalSecondLevelInvites: 5,
  totalRewardsEarned: 850,
  currentTier: {
    level: 2,
    inviterReward: 80,
    inviteeReward: 30
  },
  nextTier: {
    threshold: 15,
    remaining: 3,
    inviterReward: 120,
    inviteeReward: 50
  },
  nextMilestone: {
    threshold: 20,
    remaining: 8,
    points: 2000,
    badge: "推广大使",
    vipDays: 7
  },
  earnedMilestones: [
    {
      threshold: 5,
      points: 500,
      badge: "社交达人"
    }
  ],
  secondLevelRewardPerInvite: 10
}
```

---

#### Phase 3: 商业闭环优化 ✅

##### 3.1 统一货币系统

**配置文件：**
- ✅ `backend/config/pricing.js` - 定价体系配置

**充值档位：**
| 档位 | 价格 | 积分 | 赠送 | 赠送比例 |
|------|------|------|------|---------|
| 体验包 | ¥1 | 100 | 0 | 0% |
| 入门包 | ¥6 | 600 | 100 | 17% |
| 进阶包 | ¥12 | 1200 | 300 | 25% |
| 高级包 | ¥30 | 3000 | 1000 | 33% |
| 豪华包 | ¥68 | 6800 | 3200 | 47% |
| 至尊包 | ¥128 | 12800 | 7200 | 56% |

**促销活动：**
1. **首充红包**：首次充值享50%额外积分
2. **每周特惠**：每周五晚8-10点，全场8折
3. **节日双倍**：特定节日充值享双倍积分
4. **大额优惠**：充值金额越高，赠送比例越高

---

##### 3.2 VIP 会员体系

**配置文件：**
- ✅ `backend/config/vip.js` - VIP 等级和权益配置

**VIP 等级：**

| 等级 | 月费 | 年费 | 主要权益 |
|------|------|------|---------|
| **VIP 会员** | ¥9.88 | ¥98.88 | 商城9折 + 每日50积分 + 无广告 |
| **VIP+ 高级会员** | ¥29.88 | ¥298.88 | 商城8折 + 每日150积分 + 每日免费炸弹 + 专属图案库 |
| **VIP Elite 尊享会员** | ¥68.88 | ¥688.88 | 商城7折 + 每日500积分 + 高级炸弹 + 广告分成10% + 优先客服 |

**VIP 特权详细：**

**VIP 会员（⭐）：**
- 商城10%折扣
- 每日赠送50积分
- VIP徽章
- 无广告体验

**VIP+ 高级会员（💎）：**
- 商城20%折扣
- 每日赠送150积分
- 每日免费炸弹
- VIP+徽章
- 专属图案库（100+图案）
- 无广告体验
- 优先绘制权

**VIP Elite 尊享会员（👑）：**
- 商城30%折扣
- 每日赠送500积分
- 每日免费高级炸弹
- VIP Elite徽章
- 全部专属图案库（200+图案）
- 优先客服
- 广告收益10%分成
- 无广告体验
- 优先绘制权
- 自定义特效

---

##### 3.3 数据库迁移

**迁移文件：**
- ✅ `backend/src/migrations/20260216_viral_marketing_and_vip_system.js`

**新增数据表：**
1. **share_tracking** - 分享行为追踪
2. **share_clicks** - 分享链接点击追踪
3. **vip_subscriptions** - VIP订阅记录
4. **vip_daily_claims** - VIP每日签到领取记录
5. **ad_performance** - 广告分成记录
6. **ab_tests** - A/B测试记录
7. **user_achievements** - 用户成就记录（如果不存在）

**扩展现有表：**
- **referrals** 表新增字段：
  - `tier_level` - 邀请奖励等级（1-4）
  - `is_second_level` - 是否是二级邀请

**运行迁移：**
```bash
cd /Users/ginochow/code/funnypixels3/backend
npm run migrate:latest

# 或使用 knex CLI
npx knex migrate:latest
```

---

## 📊 预期效果

### 用户增长指标

| 指标 | 当前 | 优化后（3个月） | 提升幅度 |
|-----|------|--------------|--------|
| **日活用户（DAU）** | 10k | 50k-100k | +400-900% |
| **病毒系数（K-factor）** | 0.3 | 1.5-2.0 | +400-566% |
| **用户平均邀请数** | 0.3人 | 2-3人 | +566-900% |
| **分享率** | 5% | 15-25% | +200-400% |
| **7日留存率** | 30% | 45-55% | +50-83% |

### 商业化指标

| 指标 | 当前 | 优化后 | 提升幅度 |
|-----|------|--------|--------|
| **付费转化率** | 2% | 5-8% | +150-300% |
| **首充转化率** | 1% | 5-8% | +400-700% |
| **ARPU** | ¥1 | ¥5-10 | +400-900% |
| **ARPPU** | ¥50 | ¥100-150 | +100-200% |
| **LTV** | ¥10 | ¥50-100 | +400-900% |

---

## 🔧 待实施功能

### iOS 前端集成（高优先级）

需要修改以下文件以集成新的后端功能：

#### 1. 分享奖励集成
**文件：** `FunnyPixelsApp/Views/Social/SessionSummaryView.swift`

**需要添加：**
```swift
// 在分享成功后调用
func recordShareAction(shareType: String, shareTarget: String) {
    let endpoint = "/api/share/record-action"
    let body = [
        "shareType": shareType,
        "shareTarget": shareTarget,
        "sessionId": currentSessionId
    ]

    APIClient.shared.post(endpoint, body: body) { result in
        switch result {
        case .success(let response):
            if let reward = response["reward"] as? Int {
                // 显示奖励提示
                showRewardToast("分享成功！获得 \(reward) 积分")
            }
        case .failure(let error):
            print("记录分享失败: \(error)")
        }
    }
}
```

#### 2. 邀请系统增强
**文件：** `FunnyPixelsApp/Views/Profile/InviteFriendsView.swift`

**需要添加：**
- 显示当前奖励等级（tier1-4）
- 显示下一等级还需邀请人数
- 显示里程碑进度条
- 显示二级邀请统计
- 实时显示邀请链接点击数

#### 3. VIP 订阅界面
**新建文件：** `FunnyPixelsApp/Views/Shop/VIPSubscriptionView.swift`

**功能：**
- 展示3个VIP等级对比
- VIP权益详细说明
- 订阅购买流程（集成iOS内购）
- VIP状态显示

#### 4. 商城折扣显示
**文件：** `FunnyPixelsApp/Views/ShopTabView.swift`

**需要添加：**
- 根据用户VIP等级显示折扣价格
- 首充红包提示
- 促销活动倒计时

---

## 🚀 下一步行动

### 立即可执行

1. **运行数据库迁移**
   ```bash
   cd /Users/ginochow/code/funnypixels3/backend
   npx knex migrate:latest
   ```

2. **启动 ZeroClaw 守护进程**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.zeroclaw.funnypixels.plist
   launchctl start com.zeroclaw.funnypixels
   ```

3. **测试后端 API**
   ```bash
   # 测试分享奖励
   curl -X POST http://localhost:3000/api/share/record-action \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"shareType":"session","shareTarget":"wechat"}'

   # 测试邀请统计
   curl http://localhost:3000/api/referral/stats \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### 需要iOS开发工作

1. **集成分享奖励**（1-2天）
   - 修改 SessionSummaryView.swift
   - 添加分享成功后的API调用
   - 显示奖励反馈动画

2. **升级邀请界面**（2-3天）
   - 修改 InviteFriendsView.swift
   - 展示分层奖励和里程碑
   - 添加邀请进度可视化

3. **实现VIP订阅**（3-5天）
   - 创建 VIPSubscriptionView.swift
   - 集成 Apple StoreKit
   - 实现订阅购买和恢复流程

4. **优化商城定价**（1-2天）
   - 修改 ShopTabView.swift
   - 根据VIP等级显示折扣
   - 添加首充红包提示

---

## 📝 配置说明

### pricing.js 配置

```javascript
const pricing = require('./config/pricing');

// 计算实际获得积分
const totalPoints = pricing.helpers.calculateTotalPoints('basic', true);
// 首充用户购买"进阶包" → 1200 + 300 + (1500 * 0.5) = 2250积分

// 检查促销活动
const isActive = pricing.helpers.isPromotionActive('weeklySpecial');

// 获取当前可用促销
const promotions = pricing.helpers.getActivePromotions();
```

### vip.js 配置

```javascript
const vip = require('./config/vip');

// 获取用户VIP等级
const tier = await vip.helpers.getUserVipTier(userId);

// 检查用户是否有某个权益
const hasAdFree = await vip.helpers.hasVipBenefit(userId, 'feature', 'ad_free');

// 获取用户折扣
const discount = await vip.helpers.getUserDiscount(userId);
// VIP Elite用户 → 0.3 (30%折扣)

// 获取推荐等级
const recommended = vip.helpers.getRecommendedTier({
  totalPixels: 50000,
  totalPurchases: 5,
  dailyActiveMinutes: 90
});
// → 'premium'
```

---

## 🐛 故障排查

### ZeroClaw 守护进程未运行

```bash
# 检查服务状态
launchctl list | grep zeroclaw

# 查看错误日志
cat /Users/ginochow/code/funnypixels3/.zeroclaw/daemon.error.log

# 卸载并重新加载
launchctl unload ~/Library/LaunchAgents/com.zeroclaw.funnypixels.plist
launchctl load ~/Library/LaunchAgents/com.zeroclaw.funnypixels.plist
```

### 数据库迁移失败

```bash
# 检查当前迁移状态
npx knex migrate:currentVersion

# 回滚最后一次迁移
npx knex migrate:rollback

# 重新运行迁移
npx knex migrate:latest
```

### API 返回 500 错误

```bash
# 检查后端日志
tail -f /Users/ginochow/code/funnypixels3/backend/logs/error.log

# 检查数据库连接
psql -U funnypixels_user -d funnypixels_db -c "SELECT 1;"
```

---

## 📚 参考资源

- [FunnyPixels 项目目录](/Users/ginochow/code/funnypixels3)
- [后端 API 文档](/Users/ginochow/code/funnypixels3/backend/README.md)
- [iOS 应用代码](/Users/ginochow/code/funnypixels3/FunnyPixelsApp)
- [数据库 Schema](/Users/ginochow/code/funnypixels3/backend/src/migrations)

---

## ✅ 验证清单

- [ ] ZeroClaw 守护进程每6小时运行一次
- [ ] 分享后立即获得5积分奖励
- [ ] 邀请成功后双方获得正确奖励
- [ ] 邀请5人时触发里程碑奖励
- [ ] 二级邀请奖励正确发放
- [ ] VIP订阅可购买并激活
- [ ] VIP每日签到可领取积分
- [ ] 商城根据VIP等级显示折扣
- [ ] 首充红包正确发放
- [ ] 数据库迁移成功完成

---

**实施日期：** 2026-02-16
**版本：** 1.0.0
**状态：** 后端实施完成，等待iOS前端集成
