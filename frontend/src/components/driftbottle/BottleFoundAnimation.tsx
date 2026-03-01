/**
 * 漂流瓶发现动画组件
 *
 * 功能：
 * - GPS绘制时发现漂流瓶的震撼特效
 * - 支持自动播放和结束
 * - 粒子特效、缩放动画、光晕效果
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriftBottle } from '../../services/driftBottleService';

export interface BottleFoundAnimationProps {
  isVisible: boolean;
  bottle: DriftBottle | null;
  onAnimationEnd?: () => void;
}

export const BottleFoundAnimation: React.FC<BottleFoundAnimationProps> = ({
  isVisible,
  bottle,
  onAnimationEnd
}) => {
  useEffect(() => {
    if (isVisible && onAnimationEnd) {
      // 3秒后自动结束动画
      const timer = setTimeout(() => {
        onAnimationEnd();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationEnd]);

  if (!bottle) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(0,0,0,0.7) 100%)'
          }}
        >
          {/* 主要内容 */}
          <div className="relative">
            {/* 外圈光晕 */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: [0.5, 1.5, 1.2],
                opacity: [0, 0.8, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(59,130,246,0.6) 0%, transparent 70%)',
                filter: 'blur(20px)'
              }}
            />

            {/* 中圈光晕 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.8, 1.3, 1],
                opacity: [0, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.2
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(96,165,250,0.8) 0%, transparent 60%)',
                filter: 'blur(10px)'
              }}
            />

            {/* 主体瓶子 */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: [0, 1.2, 1],
                rotate: [- 180, 10, 0]
              }}
              transition={{
                duration: 0.8,
                ease: [0.34, 1.56, 0.64, 1] // spring效果
              }}
              className="relative z-10"
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-blue-400"
                   style={{
                     boxShadow: '0 0 60px rgba(59,130,246,0.8), 0 20px 40px rgba(0,0,0,0.3)'
                   }}>
                {/* 瓶子图标 */}
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="text-8xl text-center mb-4"
                >
                  🍾
                </motion.div>

                {/* 文字提示 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-center"
                >
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500 mb-2">
                    发现漂流瓶！
                  </h2>
                  <p className="text-gray-600 font-medium">
                    瓶号: {bottle.bottle_id.slice(0, 16)}...
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      <span>{bottle.current_city || '未知'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>📝</span>
                      <span>{bottle.message_count} 条纸条</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* 粒子特效 */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * 360) / 12;
              const distance = 150;
              const x = Math.cos((angle * Math.PI) / 180) * distance;
              const y = Math.sin((angle * Math.PI) / 180) * distance;

              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={{
                    x: x,
                    y: y,
                    scale: [0, 1, 0.5],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeOut'
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: '12px',
                    height: '12px',
                    background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
                    borderRadius: '50%',
                    boxShadow: '0 0 20px rgba(59,130,246,0.8)'
                  }}
                />
              );
            })}

            {/* 闪光效果 */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 2, 1.5],
                opacity: [0, 0.8, 0]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'easeOut'
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: '200px',
                height: '200px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* 底部提示文字 */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center"
          >
            <p className="text-white text-xl font-bold drop-shadow-lg">
              🎉 正在自动拾取...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BottleFoundAnimation;
