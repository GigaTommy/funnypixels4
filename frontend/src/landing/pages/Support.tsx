import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, HelpCircle, Book, AlertCircle } from 'lucide-react';
import Footer from '../components/Footer';

const Support: React.FC = () => {
  const faqs = [
    {
      question: '如何开始游戏？',
      answer: '下载应用后，使用邮箱或第三方账号注册。进入地图页面，点击"GPS自动"按钮开启绘制模式，然后开始散步、跑步或骑行，应用会自动记录您的轨迹并绘制像素。'
    },
    {
      question: 'GPS定位不准确怎么办？',
      answer: '请确保：(1) 已授予应用定位权限；(2) 开启手机GPS功能；(3) 在户外空旷区域使用，避免高楼遮挡；(4) 更新到最新版本应用。如果问题持续，请联系客服。'
    },
    {
      question: '如何加入联盟？',
      answer: '点击底部导航栏的"联盟"图标，可以浏览现有联盟并申请加入，或创建自己的联盟。加入联盟后，您的绘制区域会显示联盟旗帜。'
    },
    {
      question: '如何删除账号？',
      answer: '进入"个人资料"页面，点击右上角设置图标，选择"账号管理" > "删除账号"。删除后30天内可恢复，之后数据将永久删除。'
    },
    {
      question: '运动数据是否准确？',
      answer: '我们使用手机GPS计算距离和速度，精度取决于您的设备GPS性能。建议在空旷区域使用，确保GPS信号良好。'
    },
    {
      question: '应用是否收费？',
      answer: 'FunnyPixels 完全免费，无广告，无内购陷阱。我们致力于为所有玩家提供公平的游戏环境。'
    },
    {
      question: '如何举报作弊行为？',
      answer: '如发现其他玩家使用外挂或GPS欺骗，请通过应用内"举报"功能提交证据，或发送邮件至 abuse@funnypixelsapp.com。我们会认真调查并处理。'
    },
    {
      question: '支持哪些设备？',
      answer: 'iOS 14.0及以上版本，Android 8.0及以上版本。推荐在iPhone 8或更新设备，或2019年后的Android设备上使用。'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-semibold">
            ← 返回首页
          </Link>
        </div>
      </nav>

      {/* 头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">帮助中心</h1>
          <p className="text-xl opacity-90">
            我们随时准备帮助您解决问题
          </p>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* 联系方式卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <a
            href="mailto:support@funnypixelsapp.com"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">电子邮件</h3>
            <p className="text-gray-600 text-sm mb-3">
              发送邮件给我们的支持团队
            </p>
            <p className="text-blue-600 text-sm font-medium">
              support@funnypixelsapp.com
            </p>
          </a>

          <a
            href="https://discord.gg/funnypixels"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
              <MessageCircle className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Discord 社区</h3>
            <p className="text-gray-600 text-sm mb-3">
              加入我们的玩家社区
            </p>
            <p className="text-indigo-600 text-sm font-medium">
              discord.gg/funnypixels
            </p>
          </a>

          <a
            href="mailto:abuse@funnypixelsapp.com"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">举报滥用</h3>
            <p className="text-gray-600 text-sm mb-3">
              举报作弊或不当行为
            </p>
            <p className="text-red-600 text-sm font-medium">
              abuse@funnypixelsapp.com
            </p>
          </a>
        </div>

        {/* FAQ 区域 */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center gap-3 mb-8">
            <HelpCircle className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold text-gray-900">常见问题</h2>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-6 last:border-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <span>{faq.question}</span>
                </h3>
                <p className="text-gray-700 leading-relaxed ml-8">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 额外资源 */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Book className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">更多资源</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/privacy-policy"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow duration-300"
            >
              <h3 className="font-semibold text-gray-900 mb-2">隐私政策</h3>
              <p className="text-sm text-gray-600">
                了解我们如何保护您的个人信息
              </p>
            </Link>

            <Link
              to="/terms"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow duration-300"
            >
              <h3 className="font-semibold text-gray-900 mb-2">服务条款</h3>
              <p className="text-sm text-gray-600">
                查看使用应用的规则和条款
              </p>
            </Link>

            <a
              href="https://github.com/funnypixels/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow duration-300"
            >
              <h3 className="font-semibold text-gray-900 mb-2">开发者文档</h3>
              <p className="text-sm text-gray-600">
                API文档和技术资源
              </p>
            </a>

            <a
              href="https://twitter.com/funnypixels"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow duration-300"
            >
              <h3 className="font-semibold text-gray-900 mb-2">Twitter/X</h3>
              <p className="text-sm text-gray-600">
                关注我们获取最新消息
              </p>
            </a>
          </div>
        </div>

        {/* 响应时间说明 */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            我们的客服团队通常会在 <strong>24小时内</strong> 回复您的邮件。
            <br />
            紧急问题请加入 Discord 社区获取即时帮助。
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Support;
