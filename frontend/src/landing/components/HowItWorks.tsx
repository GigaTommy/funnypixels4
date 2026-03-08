import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, MapPin, Flag, Trophy } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: Smartphone,
      title: '下载并注册',
      description: 'iOS和Android双平台支持，使用邮箱或第三方账号快速注册',
      color: 'from-blue-500 to-cyan-500',
      image: '📱',
    },
    {
      icon: MapPin,
      title: '开启GPS绘制',
      description: '散步、跑步、骑行，自动记录轨迹并转化为彩色像素地图',
      color: 'from-purple-500 to-pink-500',
      image: '🗺️',
    },
    {
      icon: Flag,
      title: '加入联盟',
      description: '创建或加入联盟，自定义旗帜，与全球玩家协同作战',
      color: 'from-orange-500 to-red-500',
      image: '🚩',
    },
    {
      icon: Trophy,
      title: '争夺领地',
      description: '占领城市，登上排行榜，成为领地之王',
      color: 'from-yellow-500 to-orange-500',
      image: '🏆',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-200 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold">
              简单4步开始冒险
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
            如何开始玩？
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            只需几分钟，即可开启你的像素绘制之旅
          </p>
        </motion.div>

        {/* 步骤时间轴 */}
        <div className="relative">
          {/* 连接线 */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 transform -translate-y-1/2 opacity-20"></div>

          {/* 步骤卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative"
                >
                  {/* 卡片 */}
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 h-full border border-gray-100"
                  >
                    {/* 步骤编号 */}
                    <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg">
                      {index + 1}
                    </div>

                    {/* 图标 */}
                    <div className="mb-6">
                      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                    </div>

                    {/* emoji图标 */}
                    <div className="text-6xl mb-4 text-center">{step.image}</div>

                    {/* 标题 */}
                    <h3 className="text-2xl font-black text-gray-900 mb-3">
                      {step.title}
                    </h3>

                    {/* 描述 */}
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>

                    {/* 装饰性元素 */}
                    <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br ${step.color} rounded-full opacity-5`}></div>
                  </motion.div>

                  {/* 箭头（桌面端） */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-purple-400"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 额外提示 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-4 rounded-2xl border border-purple-200">
            <span className="text-3xl">🎮</span>
            <div className="text-left">
              <div className="font-bold text-gray-900">新手教程</div>
              <div className="text-sm text-gray-600">首次登录会有详细的引导教程</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
