/**
 * 系统配置种子 - 用户协议、隐私政策、关于我们、联系方式
 *
 * 修复记录:
 * - 2026-02-17: 改为幂等 upsert 逻辑（不再 del() 全部删除）
 * - 2026-02-17: 移除 system_config_history 写入（updated_by 是 UUID 类型，种子无法提供有效值）
 */
exports.seed = async function (knex) {
  const defaultConfigs = [
    {
      config_key: 'user_agreement',
      config_value: `# 用户服务协议

**生效日期：** 2025年10月30日

## 1. 协议的接受

欢迎使用FunnyPixels像素艺术平台！当您使用我们的服务时，即表示您同意遵守本用户服务协议（以下简称"本协议"）。

## 2. 服务描述

FunnyPixels是一个在线像素艺术创作和分享平台，用户可以在平台上创建、编辑、分享像素艺术作品，并与其他用户进行互动。

## 3. 用户行为规范

### 3.1 禁止内容
用户不得在平台上发布以下内容：
- 违反法律法规的内容
- 涉及暴力、色情、恐怖主义的内容
- 侵犯他人知识产权的内容
- 恶意攻击或骚扰他人的内容
- 垃圾信息或恶意软件

### 3.2 知识产权
用户保留其创作作品的知识产权，但授予平台在服务范围内展示和推广的权利。
用户不得侵犯他人的知识产权。

## 4. 隐私保护

我们重视您的隐私，具体请参考我们的隐私政策。

## 5. 免责声明

- 平台不对用户上传的内容承担法律责任
- 平台有权删除违规内容
- 用户使用平台服务所产生的风险由用户自行承担

## 6. 服务变更

我们保留随时修改或终止服务的权利，重大变更将提前通知用户。

## 7. 联系我们

如有任何问题，请通过以下方式联系我们：
- 邮箱：support@funnypixels.com

---

**最后更新时间：** 2025年10月30日`,
      config_type: 'html',
      description: '用户服务协议内容'
    },
    {
      config_key: 'privacy_policy',
      config_value: `# 隐私政策

**生效日期：** 2025年10月30日

## 1. 信息收集

### 1.1 我们收集的信息
- **账户信息：** 用户名、邮箱地址、手机号码
- **创作内容：** 您在平台上创建的像素艺术作品
- **使用数据：** 登录时间、操作记录、设备信息
- **位置信息：** 基于地理位置的创作位置（需用户授权）

### 1.2 信息收集方式
- 用户主动提供的信息
- 自动收集的使用数据
- Cookie和类似技术

## 2. 信息使用

我们使用收集的信息用于：
- 提供和改进服务
- 个性化用户体验
- 安全监控和欺诈防护
- 法律合规要求

## 3. 信息共享

我们不会向第三方出售您的个人信息。仅在以下情况下共享信息：
- 获得您的明确同意
- 法律法规要求
- 保护用户或公众安全

## 4. 数据安全

我们采用业界标准的安全措施保护您的信息：
- 数据加密传输和存储
- 访问控制和权限管理
- 定期安全审计

## 5. 用户权利

您有权：
- 查看和修改个人信息
- 删除账户和相关数据
- 撤销授权同意
- 数据可携权

## 6. Cookie政策

我们使用Cookie来：
- 记住您的登录状态
- 个性化内容推荐
- 分析网站使用情况

您可以通过浏览器设置管理Cookie。

## 7. 儿童隐私

我们的服务不面向13岁以下的儿童。如果我们发现收集了儿童信息，将立即删除。

## 8. 政策更新

我们可能不时更新本隐私政策。重大变更将通过平台公告或邮件通知用户。

## 9. 联系我们

如有隐私相关问题，请联系：
- 邮箱：privacy@funnypixels.com
- 数据保护官：dpo@funnypixels.com

---

**最后更新时间：** 2025年10月30日`,
      config_type: 'html',
      description: '隐私保护政策内容'
    },
    {
      config_key: 'about_us',
      config_value: `# 关于我们

## FunnyPixels - 创意无限的像素艺术平台

### 我们的使命

FunnyPixels致力于为全球像素艺术爱好者提供一个创作、分享和交流的专业平台。我们相信每个人都有创意的潜力，像素艺术是最直观的表达方式之一。

### 平台特色

- **简单易用：** 直观的创作工具，适合各种技能水平的用户
- **社区驱动：** 活跃的用户社区，定期举办创作活动
- **技术领先：** 基于最新的Web技术，提供流畅的创作体验
- **安全可靠：** 完善的内容审核机制，保护用户权益

---

© 2025 FunnyPixels. 保留所有权利。`,
      config_type: 'html',
      description: '关于我们页面内容'
    },
    {
      config_key: 'contact_info',
      config_value: `# 联系我们

## 获取帮助

### 客户服务
- **邮箱：** support@funnypixels.com
- **工作时间：** 周一至周五 9:00-18:00 (北京时间)
- **响应时间：** 24小时内回复

### 技术支持
- **邮箱：** tech@funnypixels.com

### 商务合作
- **邮箱：** business@funnypixels.com

## 反馈建议

我们重视每一位用户的反馈：
- **产品建议：** feedback@funnypixels.com
- **bug报告：** bugs@funnypixels.com

---

我们承诺在24小时内回复您的邮件，紧急问题会优先处理。感谢您的支持！`,
      config_type: 'html',
      description: '联系方式页面内容'
    }
  ];

  // 幂等 upsert: 已存在则更新，不存在则插入
  for (const config of defaultConfigs) {
    const existing = await knex('system_configs')
      .where('config_key', config.config_key)
      .first();

    if (existing) {
      // 已存在 - 只有当值为空或非常短（占位符）时才更新
      if (!existing.config_value || existing.config_value.length < 50) {
        await knex('system_configs')
          .where('config_key', config.config_key)
          .update({
            config_value: config.config_value,
            config_type: config.config_type,
            description: config.description,
            updated_at: knex.fn.now()
          });
      }
      // 否则保留已有数据（可能是管理员手动编辑过的）
    } else {
      await knex('system_configs').insert({
        ...config,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
  }

  console.log('✅ 默认系统配置初始化完成');
};
