import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Flag, Heart, Users } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const Features: React.FC = () => {
  const features: Feature[] = [
    {
      icon: <MapPin className="w-12 h-12" />,
      title: 'GPS自动绘制',
      description: '打开GPS，边走边画。散步、跑步、骑行，每一步都成为你的艺术作品。实时追踪你的运动轨迹，自动转化为彩色像素地图。',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <Flag className="w-12 h-12" />,
      title: '联盟战争',
      description: '创建或加入联盟，与全球玩家争夺领地。自定义联盟旗帜，协同作战，占领城市，成为领地之王。',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <Heart className="w-12 h-12" />,
      title: '运动健康',
      description: '每公里消耗卡路里，用运动解锁更多像素。追踪你的步数、距离、速度，让运动更有动力，让健康更有趣。',
      color: 'from-red-500 to-orange-500',
    },
    {
      icon: <Users className="w-12 h-12" />,
      title: '社交互动',
      description: '关注好友，点赞作品，分享你的创作。查看全球排行榜，参与每周挑战，与世界各地的玩家互动。',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            为什么选择 FunnyPixels？
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            不仅仅是一款游戏，更是你的运动伙伴和创作平台
          </p>
        </motion.div>

        {/* 功能卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              {/* 背景渐变 */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              ></div>

              {/* 图标 */}
              <div
                className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} text-white mb-6 shadow-lg`}
              >
                {feature.icon}
              </div>

              {/* 标题 */}
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {feature.title}
              </h3>

              {/* 描述 */}
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              {/* 装饰性元素 */}
              <div
                className={`absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br ${feature.color} rounded-full opacity-5 group-hover:opacity-10 transition-opacity duration-300`}
              ></div>
            </motion.div>
          ))}
        </div>

        {/* 额外说明 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg">
            <span>✨</span>
            <span>完全免费，无广告，无内购陷阱</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
