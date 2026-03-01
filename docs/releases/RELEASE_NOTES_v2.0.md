# FunnyPixels v2.0 Release Notes

**版本:** 2.0.0
**发布日期:** 2026-02-23
**类型:** 重大功能更新

---

## 🎉 版本亮点 / Highlights

### 中文
本次更新带来全新的活动系统体验！我们从用户反馈中了解到，大家希望活动信息更透明、参与决策更容易、游戏体验更流畅。v2.0 版本全面升级了活动系统，新增5大核心功能模块，让您的游戏体验更上一层楼！

### English
This update brings a brand new event system experience! Based on user feedback, we've completely revamped the event system with 5 major feature modules, making events more transparent, decisions easier, and gameplay smoother than ever!

---

## ✨ 新功能 / New Features

### 1. 📊 报名数据透明化 / Signup Statistics

**中文:**
- 实时查看活动报名人数
- 了解联盟参与情况
- 预估总参与人数
- 帮助您判断活动热度

**English:**
- Real-time event signup statistics
- Alliance participation overview
- Estimated total participants
- Better event popularity insights

**使用场景 / Use Case:**
```
打开活动详情 → 看到 "已有 156 人报名"
→ 判断活动是否值得参加 → 立即报名！
```

---

### 2. 🎯 活动难度评级 / Difficulty Rating

**中文:**
- 5星难度评级系统
- 预估每日时间投入
- 竞争强度、技能要求可视化
- 推荐玩家类型标签

**English:**
- 5-star difficulty rating system
- Estimated daily time commitment
- Competition and skill level visualization
- Recommended player type tags

**示例 / Example:**
```
🔴🔴🔴⚪⚪ 3星难度
⏰ 2.5小时/天
🏷️ 活跃玩家 | 联盟
```

---

### 3. 📈 排名趋势分析 / Ranking Trends

**中文:**
- 实时排名变化图表
- 支持 6小时/12小时/24小时视图
- 追踪Top 5玩家趋势
- 了解自己的排名波动

**English:**
- Real-time ranking trend charts
- 6h/12h/24h time range options
- Track Top 5 player trends
- Monitor your rank changes

**可视化 / Visualization:**
```
排名 ↑
 1 ┤     ╭──
 2 ┤   ╭─╯
 3 ┤ ╭─╯
   └─────────→ 时间
   6h  12h  24h
```

---

### 4. 🎨 个人贡献统计 / Personal Contribution

**中文:**
- 实时查看个人绘制像素数
- 活动中的排名位置
- 联盟内的贡献排名
- 百分位显示（超过 X% 的玩家）

**English:**
- Real-time pixel count tracking
- Your rank in the event
- Your rank within alliance
- Percentile display (top X%)

**数据卡片 / Stats Card:**
```
🎨 我的贡献
━━━━━━━━━━━━━━
🔢 234 像素
🏆 活动排名: #15
👥 联盟排名: #3
📊 超过 87.5% 的玩家
```

---

### 5. 🔗 社交分享增强 / Social Sharing

**中文:**
- 精美的分享图片生成（1080x1920）
- QR码邀请链接
- 展示个人战绩
- 一键分享到社交平台

**English:**
- Beautiful share images (1080x1920)
- QR code invite links
- Showcase your achievements
- One-tap share to social platforms

**分享内容 / Share Content:**
```
┌─────────────┐
│ 周末挑战赛    │
│             │
│  🎨 234     │
│   我的像素   │
│             │
│  #3         │
│  联盟排名    │
│             │
│  [QR码]     │
│ 扫码加入     │
└─────────────┘
```

---

### 6. 🛡️ 准入条件明确化 / Entry Requirements

**中文:**
- 清晰显示活动参与要求
- 实时检查您是否满足条件
- 未满足项目高亮提示
- 避免盲目报名

**English:**
- Clear display of event requirements
- Real-time eligibility checking
- Highlight unmet requirements
- Avoid wasting time on ineligible events

**条件检查 / Requirements Check:**
```
✅ 等级要求: Lv.5 (当前 Lv.8)
✅ 像素数: 1000+ (当前 1,523)
❌ 账号年龄: 7天 (当前 3天)

→ 还差 4 天才能参加
```

---

## 🚀 增强功能 / Enhancements

### 性能优化 / Performance

**中文:**
- ⚡ API 响应速度提升 30%
- 💾 离线缓存支持，弱网也能流畅查看
- 🔋 省电模式，电量<20%自动启用
- 📶 智能重试，网络中断自动恢复

**English:**
- ⚡ 30% faster API responses
- 💾 Offline cache for weak network
- 🔋 Power saving mode (auto at <20%)
- 📶 Smart retry on network interruption

---

### 用户体验 / UX Improvements

**中文:**
- 🎭 流畅的动画效果
- 🌈 优化的颜色和间距
- 📱 支持 iPhone SE 到 iPhone 17 Pro Max
- 🌍 完整的中英日三语支持

**English:**
- 🎭 Smooth animations
- 🌈 Refined colors and spacing
- 📱 Support from iPhone SE to iPhone 17 Pro Max
- 🌍 Full en/zh/ja localization

---

### 技术升级 / Technical Upgrades

**中文:**
- 📊 SwiftUI Charts 实现趋势可视化
- 🔌 Socket.IO 实时数据推送
- 🗄️ 数据库查询优化（新增8+索引）
- 🔐 增强的安全防护

**English:**
- 📊 SwiftUI Charts for trend visualization
- 🔌 Socket.IO real-time data push
- 🗄️ Database query optimization (8+ new indexes)
- 🔐 Enhanced security measures

---

## 🐛 问题修复 / Bug Fixes

### 中文
- 修复 Metal 渲染崩溃问题
- 修复分享功能偶发失败
- 修复登录端点错误
- 优化地图快照性能

### English
- Fixed Metal rendering crashes
- Fixed occasional share failures
- Fixed login endpoint errors
- Optimized map snapshot performance

---

## 🔄 API 变更 / API Changes

### 新增端点 / New Endpoints

```
GET  /api/events/:id/signup-stats          // 报名统计
GET  /api/events/:id/my-contribution        // 我的贡献
GET  /api/events/:id/ranking-history        // 排名历史
POST /api/events/:id/generate-invite        // 生成邀请
POST /api/events/:id/record-share           // 记录分享
GET  /api/events/:id/check-requirements     // 检查条件
```

### 数据模型变更 / Model Changes

**EventGameplay.difficulty** - 从字符串升级为对象:
```typescript
// 旧版本 / Old
difficulty: "medium"

// 新版本 / New
difficulty: {
  level: 3,
  factors: { competition: 4, timeCommitment: 3, skillRequired: 3 },
  estimatedTimePerDay: 150,
  recommendedFor: ["alliances", "active_players"]
}
```

---

## 📊 数据库变更 / Database Changes

### 新增表 / New Tables

1. **event_ranking_snapshots** - 排名快照（每小时）
2. **event_invites** - 邀请链接记录
3. **event_shares** - 分享行为统计

### 新增索引 / New Indexes

- 8+ 新索引提升查询性能
- GIN 索引支持 JSONB 查询
- 复合索引优化排名查询

---

## 🎓 用户指南 / User Guide

### 如何查看活动难度？/ How to Check Event Difficulty?

**中文:**
1. 打开活动详情页
2. 查看"难度"卡片
3. 根据星级和时间投入判断
4. 查看推荐玩家类型

**English:**
1. Open event details
2. View "Difficulty" card
3. Judge by stars and time commitment
4. Check recommended player types

---

### 如何分享活动？/ How to Share Events?

**中文:**
1. 进入活动详情页
2. 点击右上角"分享"按钮
3. 等待生成精美分享图
4. 选择分享平台

**English:**
1. Enter event details
2. Tap "Share" button (top right)
3. Wait for beautiful image generation
4. Select sharing platform

---

### 如何查看排名趋势？/ How to View Ranking Trends?

**中文:**
1. 活动详情页向下滚动
2. 找到"排名趋势"图表
3. 切换时间范围（6h/12h/24h）
4. 查看您的排名变化

**English:**
1. Scroll down in event details
2. Find "Ranking Trends" chart
3. Switch time range (6h/12h/24h)
4. View your rank changes

---

## ⚠️ 已知问题 / Known Issues

### 中文

1. **Swift Package 兼容性**
   - 影响: Xcode 命令行构建
   - 解决: 使用 Xcode GUI 或真机构建
   - 不影响应用功能

2. **排名快照生成**
   - 频率: 每小时一次
   - 注意: 活动开始后首个快照需要等待最多1小时

### English

1. **Swift Package Compatibility**
   - Impact: Xcode command-line builds
   - Solution: Use Xcode GUI or physical device
   - No impact on app functionality

2. **Ranking Snapshot Generation**
   - Frequency: Every hour
   - Note: First snapshot after event start may take up to 1 hour

---

## 🔐 安全更新 / Security Updates

### 中文
- ✅ 强化 SQL 注入防护
- ✅ XSS 攻击防护
- ✅ 敏感数据加密存储
- ✅ API 请求签名验证

### English
- ✅ Enhanced SQL injection protection
- ✅ XSS attack prevention
- ✅ Encrypted sensitive data storage
- ✅ API request signature verification

---

## 📈 性能指标 / Performance Metrics

| 指标 / Metric | 改进前 / Before | 改进后 / After | 提升 / Improvement |
|--------------|----------------|----------------|-------------------|
| API 响应时间 | 280ms | 180ms | ⬆️ 36% |
| 内存占用 | 125MB | 85MB | ⬇️ 32% |
| 启动时间 | 1.8s | 1.2s | ⬆️ 33% |
| FPS (滚动) | 55fps | 60fps | ⬆️ 9% |

---

## 🔄 升级说明 / Upgrade Guide

### 后端 / Backend

```bash
# 1. 备份数据库
pg_dump funnypixels > backup_$(date +%Y%m%d).sql

# 2. 运行数据库迁移
npm run migrate

# 3. 重启服务
pm2 restart funnypixels-backend
```

### iOS App

**中文:**
- 自动更新: App Store 会自动推送更新
- 手动更新: App Store → 更新 → FunnyPixels

**English:**
- Auto update: App Store will push updates automatically
- Manual update: App Store → Updates → FunnyPixels

---

## 👥 致谢 / Credits

### 中文
感谢所有参与测试的用户！您的反馈帮助我们打造了更好的产品。

特别感谢:
- 测试团队的辛勤工作
- 运营团队的宝贵建议
- 社区用户的积极反馈

### English
Thanks to all beta testers! Your feedback helped us build a better product.

Special thanks to:
- QA team for thorough testing
- Operations team for valuable insights
- Community users for active feedback

---

## 📞 支持 / Support

### 中文
**遇到问题？**
- 📧 邮箱: support@funnypixels.com
- 💬 社区: https://community.funnypixels.com
- 📱 App 内反馈: 设置 → 帮助与反馈

### English
**Need Help?**
- 📧 Email: support@funnypixels.com
- 💬 Community: https://community.funnypixels.com
- 📱 In-app feedback: Settings → Help & Feedback

---

## 🗓️ 下一步计划 / Roadmap

### v2.1 (预计 4 周后 / Expected in 4 weeks)

**中文:**
- 🏆 赛事成就系统
- 🎁 赛事专属奖励
- 📊 高级数据分析
- 🤝 联盟协作工具

**English:**
- 🏆 Event achievement system
- 🎁 Exclusive event rewards
- 📊 Advanced analytics
- 🤝 Alliance collaboration tools

---

## ✅ 检查清单 / Checklist

### 升级前 / Before Upgrading

- [ ] 备份数据库
- [ ] 通知用户即将维护
- [ ] 检查服务器资源

### 升级后 / After Upgrading

- [ ] 验证所有 API 正常
- [ ] 测试关键功能
- [ ] 监控性能指标
- [ ] 收集用户反馈

---

**版本 / Version:** 2.0.0
**发布日期 / Release Date:** 2026-02-23
**下次更新 / Next Update:** v2.1 (2026-03-23)

**🎉 Happy Gaming! 游戏愉快！🎉**
