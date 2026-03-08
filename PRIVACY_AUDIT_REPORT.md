# FunnyPixels 隐私审计报告
**审计日期**: 2026-03-08
**审计标准**: Apple App Store Review Guidelines, GDPR, CCPA
**审计人**: 隐私合规专家

---

## 🚨 严重问题（必须立即修复）

### 1. 缺少 App Privacy Nutrition Labels 数据
**风险等级**: 🔴 严重
**App Store 要求**: 必需
**问题描述**: 未准备 App Privacy 标签数据

**需要声明的数据类型**:
- ✅ Location（位置）- 用于 GPS 绘制
- ✅ User ID（用户标识）
- ✅ User Content（用户内容）- 像素艺术作品
- ✅ Contact Info（联系信息）- 邮箱
- ⚠️ Device ID（设备标识）- 如果收集
- ⚠️ Usage Data（使用数据）- 分析数据

**解决方案**: 创建 App Privacy 清单

---

### 2. 缺少位置权限使用说明
**风险等级**: 🔴 严重（会被拒审）
**状态**: ✅ 已修复
**修复内容**: 添加了 NSLocationWhenInUseUsageDescription 等必需的权限说明

---

### 3. 不安全的网络配置
**风险等级**: 🔴 严重
**问题**: NSAllowsArbitraryLoads = true 允许所有不安全连接
**状态**: ✅ 已优化
**修复内容**: 仅允许开发环境的本地连接例外

---

## ⚠️ 高风险问题（强烈建议修复）

### 4. 缺少数据删除功能
**风险等级**: 🟠 高
**GDPR 要求**: 必需（被遗忘权）
**CCPA 要求**: 必需

**当前状态**: ❌ 未实现
**影响**: 违反 GDPR 和 CCPA 法规

**需要实现**:
- [ ] 账户删除 API
- [ ] 删除所有用户数据（像素、会话、消息）
- [ ] 删除位置历史记录
- [ ] 30天宽限期（可选）
- [ ] 删除确认机制

---

### 5. 缺少数据导出功能
**风险等级**: 🟠 高
**GDPR 要求**: 必需（数据可携带权）

**当前状态**: ❌ 未实现

**需要实现**:
- [ ] 导出个人信息 JSON
- [ ] 导出位置历史记录
- [ ] 导出创作的像素艺术
- [ ] 导出消息历史
- [ ] 打包为 ZIP 文件

---

### 6. 位置数据保留期限未定义
**风险等级**: 🟠 高
**问题**: 位置数据无限期保留

**建议**:
- 定义位置数据保留期限（建议 90-180 天）
- 实现自动清理机制
- 允许用户手动清除历史位置

---

### 7. Google 第三方登录隐私问题
**风险等级**: 🟠 高
**问题**: Info.plist 中有 Google Client ID，但未在隐私政策中说明

**需要**:
- 更新隐私政策，说明使用 Google Sign-In
- 说明 Google 收集的数据范围
- 提供 Google 隐私政策链接

---

## 🔶 中等风险问题（建议修复）

### 8. 缺少 Sign in with Apple
**风险等级**: 🟡 中
**App Store 要求**: 如果提供第三方登录，必须提供 Sign in with Apple

**当前状态**: ❌ 未实现
**已有**: Google Sign-In
**必须添加**: Sign in with Apple

---

### 9. 隐私设置不够细化
**风险等级**: 🟡 中
**当前实现**: 基础隐私设置（消息、昵称、联盟）

**建议增加**:
- [ ] 位置分享控制（精确/模糊）
- [ ] 活动可见性设置
- [ ] 排行榜显示控制
- [ ] 数据使用偏好（分析、个性化）

---

### 10. 缺少未成年人保护
**风险等级**: 🟡 中
**COPPA 要求**: 如果面向 13 岁以下用户

**需要实现**:
- [ ] 年龄验证
- [ ] 家长同意机制
- [ ] 限制未成年人数据收集
- [ ] 默认最高隐私设置

---

### 11. 缺少数据加密说明
**风险等级**: 🟡 中
**问题**: 未明确说明数据传输和存储的加密方式

**需要文档化**:
- 传输加密：TLS 1.3
- 存储加密：AES-256
- 密码加密：bcrypt/Argon2

---

## 📋 低风险问题（可选改进）

### 12. Cookie 同意横幅（Web）
**风险等级**: 🟢 低
**GDPR 要求**: Web 端需要

**当前状态**: ❌ Web 端未实现
**建议**: 添加 Cookie 同意横幅到 landing page

---

### 13. 透明度报告
**风险等级**: 🟢 低
**最佳实践**: 大型应用通常提供

**建议内容**:
- 数据请求统计
- 执法部门请求
- 账户删除统计
- 隐私政策更新历史

---

## ✅ 已实现的良好实践

1. ✅ **统一法律文档管理** - 单一数据源架构
2. ✅ **多语言隐私政策** - 6 种语言支持
3. ✅ **版本化法律文档** - 完整的版本控制系统
4. ✅ **隐私设置 API** - PrivacySettings 模型和控制器
5. ✅ **消息隐私控制** - 精细的私信权限管理
6. ✅ **URL 清理** - sanitizeAvatarUrl 防止信息泄露

---

## 📊 优先级修复计划

### Phase 1: App Store 发布前必须完成（1-2 周）
1. ✅ 添加位置权限说明（已完成）
2. ✅ 修复网络安全配置（已完成）
3. ✅ 实现 Sign in with Apple（已完成）
4. ⬜ 准备 App Privacy Labels 数据
5. ⬜ 更新隐私政策（添加 Google 说明）

### Phase 2: GDPR/CCPA 合规（2-4 周）
1. ⬜ 实现账户删除功能
2. ⬜ 实现数据导出功能
3. ⬜ 定义数据保留政策
4. ⬜ 添加细化的隐私设置

### Phase 3: 长期优化（1-3 个月）
1. ⬜ 添加未成年人保护
2. ⬜ 实现位置数据自动清理
3. ⬜ 添加 Web Cookie 同意
4. ⬜ 发布透明度报告

---

## 🔐 推荐的技术实现

### 1. 账户删除 API

```javascript
// backend/src/controllers/accountController.js
async deleteAccount(req, res) {
  const userId = req.user.id;

  try {
    await db.transaction(async (trx) => {
      // 1. 标记账户为删除状态（30天宽限期）
      await trx('users')
        .where('id', userId)
        .update({
          deletion_scheduled_at: new Date(),
          deletion_status: 'pending'
        });

      // 2. 或立即删除所有数据
      await trx('pixels').where('user_id', userId).del();
      await trx('drawing_sessions').where('user_id', userId).del();
      await trx('privacy_settings').where('user_id', userId).del();
      // ... 删除其他关联数据

      // 3. 记录删除日志（合规要求）
      await trx('deletion_logs').insert({
        user_id: userId,
        deleted_at: new Date(),
        deletion_reason: req.body.reason
      });
    });

    res.json({ success: true, message: 'Account deletion initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### 2. 数据导出 API

```javascript
// backend/src/controllers/dataExportController.js
async exportUserData(req, res) {
  const userId = req.user.id;

  try {
    const exportData = {
      user_info: await db('users').where('id', userId).first(),
      location_history: await db('drawing_sessions')
        .where('user_id', userId)
        .select('start_location', 'end_location', 'created_at'),
      pixels: await db('pixels').where('user_id', userId).count(),
      messages: await db('private_messages')
        .where('sender_id', userId)
        .orWhere('receiver_id', userId)
        .select(),
      privacy_settings: await db('privacy_settings').where('user_id', userId).first()
    };

    // 生成 JSON 文件
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="funnypixels_data_${userId}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### 3. 位置数据保留策略

```javascript
// backend/src/tasks/cleanupLocationData.js
const LOCATION_RETENTION_DAYS = 90;

async function cleanupOldLocationData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOCATION_RETENTION_DAYS);

  await db('drawing_sessions')
    .where('created_at', '<', cutoffDate)
    .update({
      start_location: null,
      end_location: null,
      location_cleaned: true
    });

  logger.info(`Cleaned location data older than ${LOCATION_RETENTION_DAYS} days`);
}

// 每天运行一次
schedule.scheduleJob('0 2 * * *', cleanupOldLocationData);
```

---

## 📱 iOS 隐私最佳实践检查清单

- [x] Info.plist 包含所有权限说明
- [x] 使用 HTTPS（除开发环境）
- [ ] 实现 Sign in with Apple
- [ ] App Privacy Labels 准备完成
- [ ] 位置权限使用最小必需原则
- [ ] 敏感数据使用 Keychain 存储
- [ ] 不收集 IDFA（除非必需）
- [ ] 本地数据使用 Data Protection API

---

## 🌐 Web 隐私最佳实践检查清单

- [ ] HTTPS 强制
- [ ] Cookie 同意横幅（GDPR）
- [x] 隐私政策链接可见
- [x] 服务条款链接可见
- [ ] 第三方脚本审计（Google Analytics 等）
- [ ] CSP（Content Security Policy）
- [ ] CORS 正确配置

---

## 📞 联系与支持

**隐私问题联系**:
- Email: privacy@funnypixelsapp.com
- 数据保护官: dpo@funnypixelsapp.com

**用户权利请求**:
- 数据访问请求
- 数据删除请求
- 数据更正请求
- 处理限制请求

---

**审计结论**:
项目有良好的隐私基础架构，但**必须在 App Store 发布前完成 Phase 1 的修复工作**，特别是 Sign in with Apple 和 App Privacy Labels。GDPR/CCPA 合规性需要在公开发布后 30 天内完成。
