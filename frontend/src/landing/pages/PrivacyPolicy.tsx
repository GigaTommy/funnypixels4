import React, { useEffect } from 'react';

/**
 * 隐私政策页面 - 重定向到后端统一管理的法律文档
 *
 * 架构说明：
 * - Admin Frontend 管理法律文档内容
 * - Backend 提供多语言、版本化的法律文档 API
 * - Web Frontend、iOS App 统一使用后端 API
 * - 单一数据源，避免内容不一致
 */
const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    // 获取用户的语言偏好
    const preferredLang = localStorage.getItem('preferredLanguage') || 'en-US';

    // 映射前端语言代码到后端 API 支持的语言代码
    const langMap: { [key: string]: string } = {
      'zh-CN': 'zh-Hans',
      'en-US': 'en',
      'es': 'es',
      'ja': 'ja',
      'ko': 'ko',
      'pt-BR': 'pt-BR'
    };

    const apiLang = langMap[preferredLang] || 'en';

    // 重定向到后端 API
    window.location.href = `/api/system-config/public/privacy-policy?lang=${apiLang}`;
  }, []);

  // 显示加载提示（重定向过程中）
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        fontSize: '48px',
        marginBottom: '16px'
      }}>📄</div>
      <div style={{
        fontSize: '18px',
        color: '#666'
      }}>Loading Privacy Policy...</div>
      <div style={{
        fontSize: '14px',
        color: '#999',
        marginTop: '8px'
      }}>正在加载隐私政策...</div>
    </div>
  );
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              使用本应用即表示您同意本隐私政策的条款。如果您不同意本政策，请勿使用本应用。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 我们收集的信息</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.1 位置信息</h3>
            <p className="text-gray-700 leading-relaxed">
              为了实现GPS绘制功能，我们会收集您的地理位置信息（经纬度坐标）。此信息仅在您主动开启GPS绘制功能时收集。
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>实时位置：用于绘制您的运动轨迹</li>
              <li>历史位置：用于显示您的绘制历史</li>
              <li>位置精度：取决于您的设备GPS精度</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 账号信息</h3>
            <p className="text-gray-700 leading-relaxed">
              当您注册账号时，我们会收集：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>用户名</li>
              <li>电子邮箱地址（可选）</li>
              <li>头像（可选）</li>
              <li>第三方登录信息（如使用Google/Apple登录）</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 设备信息</h3>
            <p className="text-gray-700 leading-relaxed">
              为了提供更好的服务和诊断问题，我们会收集：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>设备型号和操作系统版本</li>
              <li>应用版本号</li>
              <li>网络类型（WiFi/4G/5G）</li>
              <li>唯一设备标识符（用于防作弊）</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.4 使用数据</h3>
            <p className="text-gray-700 leading-relaxed">
              我们会收集您的使用行为数据，用于改进服务：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>绘制的像素数量和位置</li>
              <li>运动距离和时长</li>
              <li>联盟活动参与情况</li>
              <li>社交互动（点赞、关注等）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 信息使用方式</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              我们使用收集的信息用于：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>提供核心功能：</strong>GPS绘制、地图显示、联盟战争等</li>
              <li><strong>改善用户体验：</strong>优化性能、修复bug、开发新功能</li>
              <li><strong>防止作弊：</strong>检测异常行为，维护游戏公平性</li>
              <li><strong>统计分析：</strong>了解用户习惯，优化产品设计</li>
              <li><strong>客户支持：</strong>响应您的问题和反馈</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 信息分享和披露</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              我们承诺：<strong>不会将您的个人信息出售给第三方。</strong>
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              在以下情况下，我们可能会分享您的信息：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>您的同意：</strong>在获得您明确同意的情况下</li>
              <li><strong>法律要求：</strong>遵守法律法规、法院命令或政府要求</li>
              <li><strong>服务提供商：</strong>云服务、地图服务等第三方合作伙伴（仅限必要范围）</li>
              <li><strong>公开信息：</strong>您选择公开的绘制作品、排行榜数据等</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 数据安全</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              我们采取以下措施保护您的数据安全：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>使用 HTTPS 加密传输数据</li>
              <li>数据库加密存储敏感信息</li>
              <li>定期进行安全审计和漏洞扫描</li>
              <li>限制员工访问权限，仅授权人员可访问</li>
              <li>定期备份数据，防止数据丢失</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 您的权利</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              根据适用法律，您享有以下权利：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>访问权：</strong>查看我们持有的关于您的个人信息</li>
              <li><strong>更正权：</strong>更正不准确或不完整的信息</li>
              <li><strong>删除权：</strong>要求删除您的账号和个人数据</li>
              <li><strong>导出权：</strong>以结构化格式导出您的数据</li>
              <li><strong>反对权：</strong>反对我们处理您的个人信息</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              如需行使这些权利，请发送邮件至：
              <a href="mailto:privacy@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                privacy@funnypixelsapp.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. 儿童隐私</h2>
            <p className="text-gray-700 leading-relaxed">
              本应用面向13岁以上用户。我们不会故意收集13岁以下儿童的个人信息。
              如果您发现我们收集了儿童的个人信息，请联系我们，我们将立即删除相关数据。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookie 和追踪技术</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              我们使用 Cookie 和类似技术来：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>记住您的登录状态</li>
              <li>保存您的偏好设置</li>
              <li>分析应用使用情况</li>
              <li>提供个性化内容</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              您可以在浏览器设置中管理 Cookie，但这可能影响某些功能的正常使用。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. 数据保留</h2>
            <p className="text-gray-700 leading-relaxed">
              我们会保留您的个人信息，直至：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>您删除账号</li>
              <li>数据不再需要用于原始目的</li>
              <li>法律要求的保留期限结束</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              账号删除后，我们会在30天内删除您的个人数据（法律要求保留的除外）。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. 政策更新</h2>
            <p className="text-gray-700 leading-relaxed">
              我们可能会不时更新本隐私政策。更新后的政策将在应用内公布，并通过邮件或通知告知您重大变更。
              继续使用应用即表示您接受更新后的隐私政策。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. 联系我们</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
            </p>
            <ul className="list-none text-gray-700 space-y-2">
              <li>
                <strong>电子邮箱：</strong>
                <a href="mailto:privacy@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                  privacy@funnypixelsapp.com
                </a>
              </li>
              <li>
                <strong>客服支持：</strong>
                <a href="mailto:support@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                  support@funnypixelsapp.com
                </a>
              </li>
              <li>
                <strong>Discord社区：</strong>
                <a href="https://discord.gg/funnypixels" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  discord.gg/funnypixels
                </a>
              </li>
            </ul>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              本隐私政策符合 GDPR、CCPA 及中国《个人信息保护法》等相关法律法规要求。
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
