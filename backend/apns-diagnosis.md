# APNs 推送通知诊断报告

## ✅ 已验证的配置

### 1. iOS App 配置
- **Bundle ID**: `com.funnypixels.FunnyPixelsApp` ✅
- **Entitlements**: `aps-environment = development` ✅
- **设备令牌长度**: 64 字符 ✅
- **设备令牌**: `5a64039ee47a8cf1efde2470d762ce194d769029a42999d3f2b384ff6f65e820`

### 2. 后端配置
- **Team ID**: `VL3HPHK35K` ✅
- **Key ID**: `K7327MXW6B` ✅
- **Bundle ID**: `com.funnypixels.FunnyPixelsApp` ✅
- **APNs Key 文件**: 存在，257 字节 ✅
- **环境**: `development` ✅

### 3. 测试结果
- **Development 环境**: ❌ `BadEnvironmentKeyInToken`
- **Production 环境**: ❌ `BadDeviceToken`

---

## ⚠️ 可能的问题

### 最可能的原因：Apple Developer Portal 配置缺失

#### 📝 需要在 Apple Developer Portal 中检查：

1. **访问**: https://developer.apple.com/account/resources/identifiers/list

2. **找到您的 App ID**: `com.funnypixels.FunnyPixelsApp`

3. **检查 Push Notifications 能力**:
   - 点击 App ID 进入详情页
   - 在 **Capabilities** 列表中查找 **Push Notifications**
   - ✅ 应该显示: **Enabled** (已启用)
   - ❌ 如果显示: **Configurable** 或未勾选

4. **如果未启用，执行以下操作**:
   ```
   1. 勾选 "Push Notifications"
   2. 点击 "Save"
   3. 点击 "Confirm"
   4. 在 Xcode 中重新下载 Provisioning Profile:
      - Xcode → Settings → Accounts
      - 选择您的 Apple ID
      - Download Manual Profiles
   5. 重新运行 App
   ```

---

## 🔧 其他可能的问题

### 问题 1: APNs Key 未关联到 App ID

**检查方法**:
1. 访问: https://developer.apple.com/account/resources/authkeys/list
2. 找到 Key ID `K7327MXW6B`
3. 查看 **Enabled Services**: 应该显示 **Apple Push Notifications service (APNs)**

### 问题 2: Provisioning Profile 过期或无效

**解决方法**:
1. 在 Xcode 中: **Product → Clean Build Folder**
2. **Xcode → Settings → Accounts → Download Manual Profiles**
3. 重新运行 App

### 问题 3: 设备令牌环境不匹配

**验证方法**:
- Xcode 控制台应该显示: `✅ [NEW CODE] Device token (64 chars): ...`
- 如果没有 `[NEW CODE]` 标记，说明代码未更新

---

## 🎯 下一步操作建议

### 立即检查（最重要）:
1. ✅ 访问 Apple Developer Portal
2. ✅ 确认 `com.funnypixels.FunnyPixelsApp` 的 Push Notifications 能力已启用
3. ✅ 如果刚刚启用，需要在 Xcode 中重新下载 Provisioning Profile
4. ✅ 重新运行 App 并测试推送

### 如果仍然失败:
1. 创建一个新的 APNs Key（在 Apple Developer Portal）
2. 下载新的 `.p8` 文件
3. 更新后端 `.env` 配置
4. 重新测试

---

## 📞 测试命令

在完成上述配置后，运行以下命令测试推送：

\`\`\`bash
cd /Users/ginochow/code/funnypixels3/backend

# 使用最新设备令牌测试
node test-push.js 5a64039ee47a8cf1efde2470d762ce194d769029a42999d3f2b384ff6f65e820
\`\`\`

预期成功输出：
\`\`\`
✅ Push notification sent successfully!
Result: {
  "success": true,
  "sent": [...]
}
\`\`\`

---

## 🔍 故障排查时间线

| 时间 | 问题 | 解决方案 |
|------|------|--------|
| 初始 | 设备令牌 160 字符 | 修复代码格式化字符串 `%02x` |
| 中期 | 模拟器令牌异常 | 切换到真机测试 |
| 当前 | `BadEnvironmentKeyInToken` | 需要在 Apple Developer Portal 启用 Push Notifications |

---

生成时间: 2026-03-10
