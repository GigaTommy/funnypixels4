import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Play, Users, MapPin, TrendingUp } from 'lucide-react';

interface Stats {
  players: number;
  pixels: number;
  cities: number;
}

const Hero: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    players: 0,
    pixels: 0,
    cities: 0,
  });

  // 数字滚动动画
  useEffect(() => {
    const targetStats = {
      players: 100000,
      pixels: 50000000,
      cities: 1000,
    };

    const duration = 2000; // 2秒动画
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setStats({
        players: Math.floor(targetStats.players * progress),
        pixels: Math.floor(targetStats.pixels * progress),
        cities: Math.floor(targetStats.cities * progress),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setStats(targetStats);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
  };

  const handleDownload = (platform: 'ios' | 'android') => {
    // TODO: 替换为实际的App Store/Google Play链接
    if (platform === 'ios') {
      window.open('https://apps.apple.com/app/funnypixels', '_blank');
    } else {
      window.open('https://play.google.com/store/apps/details?id=com.funnypixels', '_blank');
    }
  };

  const handleTryWeb = () => {
    window.location.href = '/app';
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      {/* 动态背景 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        {/* 动态像素点 */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-white rounded-sm"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0.1,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: [0.1, 0.5, 0.1],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* 主内容 */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* 标题区 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            边走边画
            <br />
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              用脚步绘制世界
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-white/90 mb-12 max-w-3xl mx-auto">
            一款结合GPS定位的运动像素游戏
            <br />
            散步、跑步、骑行，每一步都成为你的艺术作品
          </p>
        </motion.div>

        {/* CTA按钮组 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
        >
          {/* iOS下载 */}
          <button
            onClick={() => handleDownload('ios')}
            className="group relative bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 flex items-center gap-3 min-w-[200px]"
          >
            <Download className="w-6 h-6" />
            <span>App Store</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          {/* Android下载 */}
          <button
            onClick={() => handleDownload('android')}
            className="group relative bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 flex items-center gap-3 min-w-[200px]"
          >
            <Download className="w-6 h-6" />
            <span>Google Play</span>
            <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-blue-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          {/* Web版试玩 */}
          <button
            onClick={handleTryWeb}
            className="group relative bg-white/10 backdrop-blur-md text-white border-2 border-white/30 px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/20 transition-all duration-300 hover:scale-105 flex items-center gap-3 min-w-[200px]"
          >
            <Play className="w-6 h-6" />
            <span>立即试玩</span>
          </button>
        </motion.div>

        {/* 数据统计 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
        >
          {/* 全球玩家 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {formatNumber(stats.players)}+
            </div>
            <div className="text-white/70 text-sm">全球玩家</div>
          </div>

          {/* 已绘制像素 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center mb-3">
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {formatNumber(stats.pixels)}+
            </div>
            <div className="text-white/70 text-sm">已绘制像素</div>
          </div>

          {/* 覆盖城市 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-center mb-3">
              <MapPin className="w-8 h-8 text-pink-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {formatNumber(stats.cities)}+
            </div>
            <div className="text-white/70 text-sm">覆盖城市</div>
          </div>
        </motion.div>

        {/* 向下滚动提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-white/60 text-sm flex flex-col items-center gap-2"
          >
            <span>向下滚动探索更多</span>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
