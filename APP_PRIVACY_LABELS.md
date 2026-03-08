# FunnyPixels - App Privacy Nutrition Labels
**用于 App Store Connect 提交**

---

## 📋 数据收集总览

### 我们收集以下类型的数据：

| 数据类型 | 用途 | 是否关联到用户 | 是否用于追踪 |
|---------|------|-------------|------------|
| 精确位置 | App 功能、分析 | ✅ 是 | ❌ 否 |
| 用户 ID | App 功能 | ✅ 是 | ❌ 否 |
| 用户内容 | App 功能 | ✅ 是 | ❌ 否 |
| 联系信息 | App 功能 | ✅ 是 | ❌ 否 |
| 使用数据 | 分析 | ✅ 是 | ❌ 否 |

---

## 1. Location（位置）

### Precise Location（精确位置）
**数据用途**:
- ✅ App Functionality（应用功能）
  - GPS 绘制像素地图
  - 记录移动轨迹
  - 显示地图位置
- ✅ Analytics（分析）
  - 了解用户活跃区域
  - 优化地图性能

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

---

## 2. Contact Info（联系信息）

### Email Address（邮箱地址）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 账户注册和登录
  - 密码重置
  - 重要通知
- ❌ Third-Party Advertising（第三方广告）: 否
- ❌ Developer's Advertising（开发者广告）: 否

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

### Name（姓名）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 显示用户昵称
  - 社交互动

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

---

## 3. User Content（用户内容）

### Photos or Videos（照片或视频）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 用户头像上传
  - 联盟旗帜自定义

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

### Gameplay Content（游戏内容）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 像素艺术作品
  - 绘制会话记录
  - 联盟活动

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

### Other User Content（其他用户内容）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 私信消息
  - 用户评论

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

---

## 4. Identifiers（标识符）

### User ID（用户 ID）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 账户识别
  - 数据关联

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

### Device ID（设备 ID）
**收集状态**: ⚠️ 待确认
**如果收集**:
- ✅ App Functionality（应用功能）
  - 设备授权
  - 安全验证

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

---

## 5. Usage Data（使用数据）

### Product Interaction（产品交互）
**数据用途**:
- ✅ Analytics（分析）
  - 了解功能使用情况
  - 改进用户体验
- ✅ App Functionality（应用功能）
  - 推荐内容
  - 个性化体验

**关联到用户**: ✅ 是
**用于追踪**: ❌ 否

**收集的交互数据**:
- 绘制像素数量
- 移动距离
- 会话时长
- 功能点击
- 页面浏览

---

## 6. Diagnostics（诊断数据）

### Crash Data（崩溃数据）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 修复 Bug
  - 提高稳定性

**关联到用户**: ❌ 否
**用于追踪**: ❌ 否

### Performance Data（性能数据）
**数据用途**:
- ✅ App Functionality（应用功能）
  - 优化性能
  - 监控服务质量

**关联到用户**: ❌ 否
**用于追踪**: ❌ 否

---

## 🚫 我们不收集的数据

以下数据类型我们**不会**收集：

- ❌ Health & Fitness（健康与健身数据）*
- ❌ Financial Info（财务信息）
- ❌ Contacts（通讯录）
- ❌ Browsing History（浏览历史）
- ❌ Search History（搜索历史）
- ❌ Sensitive Info（敏感信息）
- ❌ Coarse Location（粗略位置）- 我们只使用精确位置
- ❌ IDFA（广告标识符）

**注**: 虽然记录步数和距离，但不收集 HealthKit 数据，仅基于 GPS 计算

---

## 🔒 数据安全措施

### 传输安全
- ✅ TLS 1.3 加密
- ✅ Certificate Pinning（可选）

### 存储安全
- ✅ AES-256 数据库加密
- ✅ iOS Keychain 存储敏感信息
- ✅ 密码使用 bcrypt hash

### 访问控制
- ✅ 基于角色的权限管理
- ✅ API 认证令牌
- ✅ 会话超时机制

---

## 👤 用户控制与权利

### 隐私控制
- ✅ 隐藏昵称选项
- ✅ 隐藏联盟信息选项
- ✅ 消息权限控制
- ⚠️ 位置分享控制（待实现）

### 用户权利（GDPR/CCPA）
- ⚠️ 数据访问权（待实现）
- ⚠️ 数据删除权（待实现）
- ⚠️ 数据可携带权（待实现）
- ✅ 隐私设置修改

---

## 📊 第三方数据共享

### Sign in with Apple
**用途**: 第三方登录（主要推荐方式）
**共享数据**:
- Apple User ID（加密标识符）
- 邮箱地址（可选，用户可选择隐藏）
- 姓名（可选，仅首次提供）
**隐私政策**: https://www.apple.com/legal/privacy/
**隐私保护**:
- ✅ 支持"隐藏我的邮箱"功能
- ✅ 用户可完全控制分享的信息
- ✅ Apple不会追踪用户行为

### Google Sign-In
**用途**: 第三方登录（备选方式）
**共享数据**:
- 邮箱地址
- 基本资料信息
**隐私政策**: https://policies.google.com/privacy

### ⚠️ 其他第三方服务（待确认）
请确认项目是否使用：
- [ ] Google Analytics
- [ ] Firebase
- [ ] Sentry（错误追踪）
- [ ] Mixpanel（分析）
- [ ] 推送通知服务

---

## 🔄 数据保留期限

| 数据类型 | 保留期限 | 删除方式 |
|---------|---------|---------|
| 账户信息 | 账户存续期 | 账户删除后立即删除 |
| 位置数据 | 90 天* | 自动清理 |
| 像素艺术 | 账户存续期 | 账户删除后删除 |
| 消息记录 | 账户存续期 | 账户删除后删除 |
| 日志数据 | 30 天 | 自动清理 |

**注**: 位置保留期建议，需要在隐私政策中明确

---

## ✅ App Store Connect 提交清单

在提交到 App Store Connect 时，您需要：

1. **进入 App Privacy 部分**
2. **逐项回答数据收集问题**
   - Does your app collect data? **YES**
3. **按照上述分类选择数据类型**
4. **对每种数据类型**:
   - 选择用途（App Functionality/Analytics 等）
   - 是否关联到用户
   - 是否用于追踪
5. **提供隐私政策 URL**
   - https://www.funnypixelsapp.com/privacy-policy

---

## 📝 重要提示

### 必须在提交前完成：
1. ✅ 确认所有数据收集都有明确用途
2. ✅ 隐私政策更新到最新版本
3. ⚠️ 实现 Sign in with Apple（如使用第三方登录）
4. ⚠️ 确认不使用 IDFA
5. ⚠️ 测试所有权限请求流程

### 常见审核被拒原因：
- ❌ 权限说明不清晰
- ❌ 收集数据但未声明
- ❌ 提供第三方登录但无 Sign in with Apple
- ❌ 隐私政策链接失效
- ❌ 隐私标签与实际不符

---

## 📞 需要帮助？

如果在填写 App Privacy Labels 时有疑问，请参考：
- [Apple Privacy Details Guide](https://developer.apple.com/app-store/app-privacy-details/)
- [App Store Review Guidelines - Privacy](https://developer.apple.com/app-store/review/guidelines/#privacy)

---

**最后更新**: 2026-03-08
**下次审核**: App Store 提交前
