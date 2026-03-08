import React from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone, Zap, Shield, Globe } from 'lucide-react';

const DownloadCTA: React.FC = () => {
  const handleDownload = (platform: 'ios' | 'android') => {
    if (platform === 'ios') {
      window.open('https://apps.apple.com/app/funnypixels', '_blank');
    } else {
      window.open('https://play.google.com/store/apps/details?id=com.funnypixels', '_blank');
    }
  };

  const features = [
    { icon: Zap, text: '完全免费，无广告' },
    { icon: Shield, text: '安全可靠，隐私保护' },
    { icon: Globe, text: 'iOS & Android 双平台' },
  ];

  return (
    <section className="relative py-20 overflow-hidden">
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600"></div>

      {/* 动态网格背景 */}
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

      {/* 浮动像素点 */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.1, 0.5, 0.1],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          {/* 标题 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              准备好开始你的
              <br />
              <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                像素冒险了吗？
              </span>
            </h2>

            <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
              现在下载，加入全球10万+玩家的行列
            </p>
          </motion.div>

          {/* 下载按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            {/* iOS */}
            <motion.button
              onClick={() => handleDownload('ios')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative bg-white text-purple-600 px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 flex items-center gap-3 min-w-[260px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>

              <div className="relative z-10 flex items-center gap-4 w-full">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-xs text-gray-500 font-normal">下载App</div>
                  <div className="text-lg font-bold">App Store</div>
                </div>
                <Download className="w-5 h-5" />
              </div>
            </motion.button>

            {/* Android */}
            <motion.button
              onClick={() => handleDownload('android')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative bg-white text-purple-600 px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 flex items-center gap-3 min-w-[260px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-100 to-blue-100 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>

              <div className="relative z-10 flex items-center gap-4 w-full">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-xs text-gray-500 font-normal">下载App</div>
                  <div className="text-lg font-bold">Google Play</div>
                </div>
                <Download className="w-5 h-5" />
              </div>
            </motion.button>
          </motion.div>

          {/* 特性标签 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 text-white/90"
                >
                  <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{feature.text}</span>
                </div>
              );
            })}
          </motion.div>

          {/* 二维码区域（可选） */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 inline-flex items-center gap-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8"
          >
            <div className="text-center">
              <div className="w-32 h-32 bg-white rounded-2xl mb-3 flex items-center justify-center">
                <div className="text-4xl">📱</div>
              </div>
              <div className="text-white font-semibold">扫码下载 iOS</div>
            </div>

            <div className="w-px h-32 bg-white/20"></div>

            <div className="text-center">
              <div className="w-32 h-32 bg-white rounded-2xl mb-3 flex items-center justify-center">
                <div className="text-4xl">📲</div>
              </div>
              <div className="text-white font-semibold">扫码下载 Android</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 底部波浪装饰 */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg className="w-full h-auto" viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white" fillOpacity="0.1"/>
        </svg>
      </div>
    </section>
  );
};

export default DownloadCTA;
