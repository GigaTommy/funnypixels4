import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Screenshots: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const screenshots = [
    {
      title: '地图绘制',
      description: 'GPS自动追踪轨迹，实时绘制彩色像素地图',
      color: 'from-blue-500 to-cyan-500',
      emoji: '🗺️',
    },
    {
      title: '联盟管理',
      description: '创建联盟，自定义旗帜，招募成员',
      color: 'from-purple-500 to-pink-500',
      emoji: '🚩',
    },
    {
      title: '全球排行榜',
      description: '查看个人和联盟排名，争夺荣耀',
      color: 'from-yellow-500 to-orange-500',
      emoji: '🏆',
    },
    {
      title: '社交互动',
      description: '关注好友，点赞作品，分享创作',
      color: 'from-green-500 to-emerald-500',
      emoji: '💬',
    },
    {
      title: '个人资料',
      description: '查看统计数据，管理成就徽章',
      color: 'from-pink-500 to-rose-500',
      emoji: '👤',
    },
  ];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % screenshots.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  return (
    <section id="screenshots" className="py-20 bg-gray-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-600 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-pink-600 rounded-full opacity-10 blur-3xl"></div>
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
              精美界面
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            游戏截图
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            直观的界面设计，流畅的操作体验
          </p>
        </motion.div>

        {/* 截图轮播 */}
        <div className="relative max-w-4xl mx-auto">
          {/* 主截图区域 */}
          <div className="relative aspect-[9/19.5] max-w-sm mx-auto">
            {/* 手机框架 */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[3rem] shadow-2xl p-3">
              <div className="relative w-full h-full bg-black rounded-[2.5rem] overflow-hidden">
                {/* 刘海 */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-6 bg-gray-900 rounded-b-2xl z-10"></div>

                {/* 截图内容 */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                    className={`absolute inset-0 bg-gradient-to-br ${screenshots[currentIndex].color} flex items-center justify-center`}
                  >
                    {/* 占位符内容 */}
                    <div className="text-center text-white p-8">
                      <div className="text-8xl mb-6">{screenshots[currentIndex].emoji}</div>
                      <h3 className="text-2xl font-bold mb-3">{screenshots[currentIndex].title}</h3>
                      <p className="text-white/80">{screenshots[currentIndex].description}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* 导航按钮 */}
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full ml-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-3 rounded-full transition-all duration-300"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-full mr-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-3 rounded-full transition-all duration-300"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* 指示器 */}
          <div className="flex items-center justify-center gap-3 mt-12">
            {screenshots.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === currentIndex
                    ? 'w-12 h-3 bg-gradient-to-r from-purple-600 to-pink-600'
                    : 'w-3 h-3 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* 截图标题 */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-8"
          >
            <h3 className="text-2xl font-bold text-white mb-2">
              {screenshots[currentIndex].title}
            </h3>
            <p className="text-gray-400">
              {screenshots[currentIndex].description}
            </p>
          </motion.div>
        </div>

        {/* 提示文字 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 text-sm">
            * 以上为游戏界面示意图，实际效果可能略有不同
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Screenshots;
