import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Flag, Heart, Users, Zap, Trophy, Share2, Target } from 'lucide-react';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  details: string[];
}

const FeaturesEnhanced: React.FC = () => {
  const features: Feature[] = [
    {
      icon: MapPin,
      title: 'GPS自动绘制',
      description: '打开GPS，边走边画，每一步都成为你的艺术作品',
      color: 'from-blue-500 to-cyan-500',
      details: [
        '实时追踪运动轨迹',
        '自动转化为彩色像素',
        '支持多种运动模式',
        '离线也能绘制',
      ],
    },
    {
      icon: Flag,
      title: '联盟战争',
      description: '创建或加入联盟，与全球玩家争夺领地',
      color: 'from-purple-500 to-pink-500',
      details: [
        '自定义联盟旗帜',
        '协同占领城市',
        '联盟聊天系统',
        '排行榜竞技',
      ],
    },
    {
      icon: Heart,
      title: '运动健康',
      description: '每公里消耗卡路里，用运动解锁更多像素',
      color: 'from-red-500 to-orange-500',
      details: [
        '追踪步数和距离',
        '计算卡路里消耗',
        '设置运动目标',
        '健康数据统计',
      ],
    },
    {
      icon: Users,
      title: '社交互动',
      description: '关注好友，点赞作品，分享你的创作',
      color: 'from-green-500 to-emerald-500',
      details: [
        '好友关注系统',
        '作品点赞评论',
        '分享到社交媒体',
        '全球排行榜',
      ],
    },
  ];

  const extraFeatures = [
    {
      icon: Zap,
      title: '实时同步',
      description: '多设备数据实时同步，随时随地继续游戏',
    },
    {
      icon: Trophy,
      title: '成就系统',
      description: '解锁数百个成就，收集专属徽章',
    },
    {
      icon: Share2,
      title: '作品分享',
      description: '一键生成精美海报，分享你的像素艺术',
    },
    {
      icon: Target,
      title: '每日任务',
      description: '完成每日挑战，获取丰厚奖励',
    },
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-pink-200 rounded-full opacity-20 blur-3xl"></div>
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
              核心功能
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
            为什么选择 FunnyPixels？
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            不仅仅是一款游戏，更是你的运动伙伴和创作平台
          </p>
        </motion.div>

        {/* 主要功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
              >
                {/* 背景渐变 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

                {/* 图标 */}
                <div className="relative z-10 mb-6">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* 标题和描述 */}
                <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">
                  {feature.title}
                </h3>

                <p className="text-gray-600 leading-relaxed mb-6 relative z-10">
                  {feature.description}
                </p>

                {/* 详细特性列表 */}
                <ul className="space-y-2 relative z-10">
                  {feature.details.map((detail, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.color}`}></div>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>

                {/* 装饰性元素 */}
                <div className={`absolute -bottom-16 -right-16 w-48 h-48 bg-gradient-to-br ${feature.color} rounded-full opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
              </motion.div>
            );
          })}
        </div>

        {/* 额外功能网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {extraFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200 hover:border-purple-300 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* 底部CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl text-sm font-bold shadow-lg">
            <Zap className="w-5 h-5" />
            <span>完全免费 · 无广告 · 无内购陷阱</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesEnhanced;
