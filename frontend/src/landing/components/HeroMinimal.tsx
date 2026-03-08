import React, { useState, useEffect } from 'react';

/**
 * 检测浏览器语言
 */
function detectLanguage(): 'zh-CN' | 'en-US' {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (browserLang.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

const HeroMinimal: React.FC = () => {
  const [lang, setLang] = useState<'zh-CN' | 'en-US'>('zh-CN');

  useEffect(() => {
    setLang(detectLanguage());
  }, []);

  const handleDownload = () => {
    window.open('https://apps.apple.com/app/funnypixels', '_blank');
  };

  const t = lang === 'zh-CN' ? {
    title1: '边走边画',
    title2: '用脚步绘制世界',
    subtitle: '一款结合GPS定位的运动像素游戏。散步、跑步、骑行，每一步都成为你的艺术作品。',
    download: '在 App Store 下载',
    stats: { players: '全球玩家', pixels: '已绘像素', cities: '覆盖城市' },
    featuresTitle: '核心功能',
    featuresSubtitle: '简单上手，趣味无穷',
    feature1: { title: 'GPS 自动绘制', desc: '打开GPS，边走边画。散步、跑步、骑行，自动记录轨迹并转化为彩色像素地图。' },
    feature2: { title: '联盟战争', desc: '创建或加入联盟，自定义旗帜，与全球玩家协同作战，占领城市。' },
    feature3: { title: '运动健康', desc: '追踪步数和距离，计算卡路里消耗，用运动解锁更多像素。' },
    ctaTitle: '准备好开始你的像素冒险了吗？',
    ctaSubtitle: '现在下载，加入全球10万+玩家的行列',
    ctaNote: '完全免费 · 无广告 · iOS 14.0+',
    footer: { slogan: '边走边画，用脚步绘制世界', quickLinks: '快速链接', tryNow: '立即试玩', support: '帮助中心', legal: '法律信息', privacy: '隐私政策', terms: '服务条款' },
  } : {
    title1: 'Walk and Draw',
    title2: 'Paint the World with Your Steps',
    subtitle: 'A motion pixel game with GPS tracking. Walk, run, cycle - every step becomes your artwork.',
    download: 'Download on App Store',
    stats: { players: 'Players', pixels: 'Pixels', cities: 'Cities' },
    featuresTitle: 'Core Features',
    featuresSubtitle: 'Simple to start, endless fun',
    feature1: { title: 'GPS Auto-Drawing', desc: 'Turn on GPS and draw while you move. Walking, running, cycling - automatically record your path as colorful pixels.' },
    feature2: { title: 'Alliance Wars', desc: 'Create or join alliances, customize flags, cooperate with global players to conquer cities.' },
    feature3: { title: 'Health & Fitness', desc: 'Track steps and distance, calculate calories, unlock more pixels through exercise.' },
    ctaTitle: 'Ready for Your Pixel Adventure?',
    ctaSubtitle: 'Download now and join 100K+ players worldwide',
    ctaNote: 'Free · No Ads · iOS 14.0+',
    footer: { slogan: 'Walk and draw, paint the world with your steps', quickLinks: 'Quick Links', tryNow: 'Try Now', support: 'Support', legal: 'Legal', privacy: 'Privacy Policy', terms: 'Terms of Service' },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 简洁导航栏 */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">FP</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">FunnyPixels</span>
          </div>
        </div>
      </nav>

      {/* 英雄区 */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 左侧：文案 */}
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                {t.title1}
                <br />
                {t.title2}
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {t.subtitle}
              </p>

              {/* iOS 下载按钮 */}
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span>{t.download}</span>
              </button>

              {/* 统计数据 */}
              <div className="mt-12 grid grid-cols-3 gap-8">
                <div>
                  <div className="text-3xl font-bold text-gray-900">10万+</div>
                  <div className="text-sm text-gray-600 mt-1">全球玩家</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">5000万+</div>
                  <div className="text-sm text-gray-600 mt-1">已绘像素</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">1000+</div>
                  <div className="text-sm text-gray-600 mt-1">覆盖城市</div>
                </div>
              </div>
            </div>

            {/* 右侧：手机截图 */}
            <div className="relative">
              <div className="relative mx-auto" style={{ maxWidth: '320px' }}>
                {/* iPhone 框架 */}
                <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-black rounded-[2.5rem] overflow-hidden aspect-[9/19.5]">
                    {/* 刘海 */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-gray-900 rounded-b-2xl z-10"></div>

                    {/* 截图占位符 */}
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <div className="text-center text-white p-8">
                        <div className="text-6xl mb-4">🗺️</div>
                        <div className="text-lg font-semibold">GPS 实时绘制</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能介绍 */}
      <div className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">核心功能</h2>
            <p className="text-xl text-gray-600">简单上手，趣味无穷</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: '🗺️',
                title: 'GPS 自动绘制',
                description: '打开GPS，边走边画。散步、跑步、骑行，自动记录轨迹并转化为彩色像素地图。'
              },
              {
                emoji: '🚩',
                title: '联盟战争',
                description: '创建或加入联盟，自定义旗帜，与全球玩家协同作战，占领城市。'
              },
              {
                emoji: '💪',
                title: '运动健康',
                description: '追踪步数和距离，计算卡路里消耗，用运动解锁更多像素。'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-5xl mb-4">{feature.emoji}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下载 CTA */}
      <div className="py-20 px-6 bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            准备好开始你的像素冒险了吗？
          </h2>
          <p className="text-xl text-white/90 mb-8">
            现在下载，加入全球10万+玩家的行列
          </p>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-3 bg-white text-purple-600 px-10 py-5 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
          >
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="text-left">
              <div className="text-xs text-gray-500 font-normal">下载App</div>
              <div>App Store</div>
            </div>
          </button>

          <p className="mt-6 text-white/70 text-sm">完全免费 · 无广告 · iOS 14.0+</p>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="py-12 px-6 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">FP</span>
                </div>
                <span className="font-semibold text-lg">FunnyPixels</span>
              </div>
              <p className="text-gray-400 text-sm">
                边走边画，用脚步绘制世界
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">快速链接</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/app" className="hover:text-white">立即试玩</a></li>
                <li><a href="/support" className="hover:text-white">帮助中心</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">法律信息</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/privacy-policy" className="hover:text-white">隐私政策</a></li>
                <li><a href="/terms" className="hover:text-white">服务条款</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            © 2026 FunnyPixels. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HeroMinimal;
