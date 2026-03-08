import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Play, MapPin, Users, TrendingUp, Smartphone, Zap, Globe } from 'lucide-react';

interface Stats {
  players: number;
  pixels: number;
  cities: number;
  countries: number;
}

const HeroEnhanced: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    players: 0,
    pixels: 0,
    cities: 0,
    countries: 0,
  });

  // 数字滚动动画
  useEffect(() => {
    const targetStats = {
      players: 100000,
      pixels: 50000000,
      cities: 1000,
      countries: 50,
    };

    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);

      setStats({
        players: Math.floor(targetStats.players * easeOutCubic),
        pixels: Math.floor(targetStats.pixels * easeOutCubic),
        cities: Math.floor(targetStats.cities * easeOutCubic),
        countries: Math.floor(targetStats.countries * easeOutCubic),
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600"></div>

      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        ></div>
      </div>

      {/* 动态像素点 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 bg-white rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.1, 0.6, 0.1],
              scale: [0.5, 1.2, 0.5],
              x: [0, Math.random() * 50 - 25, 0],
              y: [0, Math.random() * 50 - 25, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* 主内容 */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Logo区域 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center">
              <div className="relative">
                <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl border border-white/20">
                  <span className="text-white font-bold text-5xl">FP</span>
                </div>
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-3xl opacity-20 blur-xl animate-pulse"></div>
              </div>
            </div>
          </motion.div>

          {/* 标题区 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
              边走边画
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                  用脚步绘制世界
                </span>
                <motion.div
                  className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-pink-500 opacity-30 blur-xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                ></motion.div>
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-white/90 mb-4 max-w-3xl mx-auto leading-relaxed">
              结合GPS定位的运动像素游戏
            </p>
            <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
              散步 · 跑步 · 骑行，每一步都成为你的艺术作品
            </p>
          </motion.div>

          {/* CTA按钮组 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            {/* iOS下载 */}
            <motion.button
              onClick={() => handleDownload('ios')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative bg-white text-purple-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 flex items-center gap-3 min-w-[220px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Smartphone className="w-6 h-6 relative z-10" />
              <div className="relative z-10 text-left">
                <div className="text-xs text-gray-500">下载App</div>
                <div>App Store</div>
              </div>
            </motion.button>

            {/* Android下载 */}
            <motion.button
              onClick={() => handleDownload('android')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative bg-white text-purple-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 flex items-center gap-3 min-w-[220px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-100 to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Smartphone className="w-6 h-6 relative z-10" />
              <div className="relative z-10 text-left">
                <div className="text-xs text-gray-500">下载App</div>
                <div>Google Play</div>
              </div>
            </motion.button>

            {/* Web版试玩 */}
            <motion.button
              onClick={handleTryWeb}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative bg-white/10 backdrop-blur-md text-white border-2 border-white/30 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all duration-300 flex items-center gap-3 min-w-[220px]"
            >
              <Play className="w-6 h-6" />
              <span>浏览器试玩</span>
            </motion.button>
          </motion.div>

          {/* 数据统计卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
          >
            {[
              { icon: Users, label: '全球玩家', value: stats.players, color: 'from-yellow-400 to-orange-400' },
              { icon: TrendingUp, label: '已绘像素', value: stats.pixels, color: 'from-green-400 to-emerald-400' },
              { icon: MapPin, label: '覆盖城市', value: stats.cities, color: 'from-blue-400 to-cyan-400' },
              { icon: Globe, label: '覆盖国家', value: stats.countries, color: 'from-pink-400 to-purple-400' },
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  whileHover={{ y: -5 }}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all duration-300"
                >
                  <div className="flex items-center justify-center mb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white mb-1">
                    {formatNumber(stat.value)}+
                  </div>
                  <div className="text-white/70 text-sm font-medium">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* 特色标签 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-4"
          >
            {[
              { icon: Zap, text: '完全免费' },
              { icon: Smartphone, text: 'iOS & Android' },
              { icon: Globe, text: '全球同服' },
            ].map((badge, index) => {
              const Icon = badge.icon;
              return (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-white text-sm font-semibold"
                >
                  <Icon className="w-4 h-4" />
                  <span>{badge.text}</span>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* 向下滚动提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-white/60 text-sm flex flex-col items-center gap-3"
          >
            <span className="font-medium">向下探索更多</span>
            <div className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center p-1">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 bg-white rounded-full"
              ></motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroEnhanced;
