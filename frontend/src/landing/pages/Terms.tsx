import React, { useEffect } from 'react';

/**
 * 服务条款页面 - 重定向到后端统一管理的法律文档
 *
 * 架构说明：
 * - Admin Frontend 管理法律文档内容
 * - Backend 提供多语言、版本化的法律文档 API
 * - Web Frontend、iOS App 统一使用后端 API
 * - 单一数据源，避免内容不一致
 */
const Terms: React.FC = () => {
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
    window.location.href = `/api/system-config/public/user-agreement?lang=${apiLang}`;
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
      }}>📋</div>
      <div style={{
        fontSize: '18px',
        color: '#666'
      }}>Loading Terms of Service...</div>
      <div style={{
        fontSize: '14px',
        color: '#999',
        marginTop: '8px'
      }}>正在加载服务条款...</div>
    </div>
  );
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 服务说明</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              FunnyPixels 是一款结合GPS定位的运动像素游戏，提供以下功能：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>GPS自动绘制：基于您的运动轨迹在地图上绘制像素</li>
              <li>联盟系统：创建或加入联盟，与其他玩家协作</li>
              <li>社交互动：关注、点赞、分享您的创作</li>
              <li>排行榜：查看全球和本地排名</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 账号注册和安全</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.1 账号注册</h3>
            <p className="text-gray-700 leading-relaxed">
              您必须创建账号才能使用完整功能。注册时，您需要：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>提供准确、完整的信息</li>
              <li>选择唯一的用户名</li>
              <li>年满13岁（未成年人需监护人同意）</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">3.2 账号安全</h3>
            <p className="text-gray-700 leading-relaxed">
              您有责任：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>保护您的账号密码安全</li>
              <li>不与他人分享您的账号</li>
              <li>及时通知我们任何未经授权的使用</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 用户行为规范</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              使用本应用时，您<strong>不得</strong>：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>作弊：</strong>使用外挂、机器人、GPS欺骗或其他不正当手段</li>
              <li><strong>骚扰：</strong>发送垃圾信息、辱骂、威胁或骚扰其他用户</li>
              <li><strong>违规内容：</strong>发布色情、暴力、仇恨言论或其他非法内容</li>
              <li><strong>冒充：</strong>假冒他人身份或伪造联盟关系</li>
              <li><strong>破坏：</strong>干扰服务器、传播病毒或恶意代码</li>
              <li><strong>商业滥用：</strong>未经授权进行商业推广或广告</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 内容和知识产权</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.1 您的内容</h3>
            <p className="text-gray-700 leading-relaxed">
              您对自己创建的内容（如绘制作品、头像、联盟旗帜）保留所有权。
              通过上传内容，您授予我们以下权利：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>在应用内展示和使用您的内容</li>
              <li>为营销目的使用（经您同意）</li>
              <li>根据需要调整格式和尺寸</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.2 我们的内容</h3>
            <p className="text-gray-700 leading-relaxed">
              应用本身（包括代码、设计、Logo、商标）归 FunnyPixels 所有，受版权和商标法保护。
              未经授权，您不得复制、修改或分发我们的内容。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 账号暂停和终止</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              我们有权在以下情况下暂停或终止您的账号：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>违反本服务条款</li>
              <li>使用作弊工具或外挂</li>
              <li>长期不活跃（超过1年）</li>
              <li>涉及违法活动</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              您也可以随时删除自己的账号，操作方法见
              <Link to="/support" className="text-blue-600 hover:underline ml-1">
                帮助中心
              </Link>
              。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. 免责声明</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.1 服务"按现状"提供</h3>
            <p className="text-gray-700 leading-relaxed">
              本应用按"现状"和"可用"基础提供，不提供任何明示或暗示的保证。
              我们不保证服务不会中断、无错误或完全安全。
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.2 第三方内容</h3>
            <p className="text-gray-700 leading-relaxed">
              我们使用第三方地图服务（如 OpenStreetMap）。这些服务可能包含错误或不准确信息，
              我们对此不承担责任。
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">7.3 健康和安全</h3>
            <p className="text-gray-700 leading-relaxed">
              使用本应用进行户外活动时，请注意安全：
            </p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>注意周围环境，避免危险区域</li>
              <li>遵守交通规则</li>
              <li>不要在私人财产或禁止区域游荡</li>
              <li>根据自己的健康状况量力而行</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. 责任限制</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              在法律允许的最大范围内，FunnyPixels 及其关联方不对以下情况承担责任：
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>使用或无法使用服务造成的损失</li>
              <li>数据丢失或损坏</li>
              <li>第三方的行为或内容</li>
              <li>服务中断或错误</li>
              <li>户外活动中的人身伤害或财产损失</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. 争议解决</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              如果您对服务有任何争议，请先联系我们的客服团队尝试友好解决：
              <a href="mailto:support@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                support@funnypixelsapp.com
              </a>
            </p>
            <p className="text-gray-700 leading-relaxed">
              如果无法通过协商解决，争议将提交至
              <strong>中国国际经济贸易仲裁委员会</strong>
              按照其仲裁规则进行仲裁。仲裁裁决是终局的，对双方均有约束力。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. 条款变更</h2>
            <p className="text-gray-700 leading-relaxed">
              我们可能会不时更新本服务条款。重大变更将通过应用内通知或电子邮件告知您。
              继续使用服务即表示您接受更新后的条款。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. 联系方式</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              如有任何问题或建议，请联系我们：
            </p>
            <ul className="list-none text-gray-700 space-y-2">
              <li>
                <strong>电子邮箱：</strong>
                <a href="mailto:legal@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                  legal@funnypixelsapp.com
                </a>
              </li>
              <li>
                <strong>客服支持：</strong>
                <a href="mailto:support@funnypixelsapp.com" className="text-blue-600 hover:underline ml-1">
                  support@funnypixelsapp.com
                </a>
              </li>
              <li>
                <strong>帮助中心：</strong>
                <Link to="/support" className="text-blue-600 hover:underline ml-1">
                  www.funnypixelsapp.com/support
                </Link>
              </li>
            </ul>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              感谢您选择 FunnyPixels！我们致力于为您提供安全、有趣的运动游戏体验。
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Terms;
