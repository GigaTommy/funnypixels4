import React, { useState } from 'react';
import { PixelInfoCard } from './map/PixelInfoCard';
import { PixelInfo } from '../types/pixel';

const PixelCardDemo: React.FC = () => {
  const [showCard, setShowCard] = useState(true);
  
  // 模拟像素数据
  const mockPixel: PixelInfo = {
    grid_id: 'test-grid-123',
    lat: 34.0522,
    lng: -118.2437,
    color: '#ff0000',
    user_id: 'user123',
    username: 'PIXEL_MASTER',
    avatar: 'https://images.unsplash.com/photo-1704726135027-9c6f034cfa41?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx8fDE3NTcxOTY0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    alliance_name: 'PIXEL GUILD',
    alliance_flag: 'color_blue', // 使用pattern_assets的key
    country_code: 'US',
    country_name: 'United States',
    likes_count: 42,
    is_liked: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const handleClose = () => {
    setShowCard(false);
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center p-4"
      style={{ 
        backgroundImage: "url('https://picsum.photos/seed/pixelartbg/1920/1080')",
        fontFamily: "'Press Start 2P', cursive"
      }}
    >
      <div className="relative">
        {/* 演示网格背景，模拟像素地图 */}
        <div className="relative bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border-2 border-white/30 p-8 mb-8">
          <div className="grid grid-cols-20 gap-px bg-gray-100/50 p-4 rounded-lg">
            {Array.from({ length: 400 }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 ${
                  i === 234 
                    ? 'bg-red-500' 
                    : Math.random() > 0.7 
                    ? 'bg-blue-400' 
                    : 'bg-gray-200'
                }`}
                style={{ imageRendering: 'pixelated' }}
              />
            ))}
          </div>
          
          {/* 像素信息卡片浮层 */}
          {showCard && (
            <div className="absolute top-16 right-16">
              <PixelInfoCard
                pixel={mockPixel}
                isVisible={showCard}
                onClose={handleClose}
                position={{ x: 0, y: 0 }}
              />
            </div>
          )}
        </div>

        {/* 功能说明 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-gray-400/50">
            <h3 className="mb-3 text-lg font-bold">像素艺术设计特色</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Press Start 2P 经典8-bit字体</li>
              <li>• 像素化SVG图标，无抗锯齿</li>
              <li>• 复古游戏风格配色方案</li>
              <li>• 毛玻璃背景融合现代设计</li>
              <li>• 像素艺术头像和按钮</li>
            </ul>
          </div>
          
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-gray-400/50">
            <h3 className="mb-3 text-lg font-bold">技术实现</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• shape-rendering: crispEdges</li>
              <li>• image-rendering: pixelated</li>
              <li>• 内联样式避免样式冲突</li>
              <li>• 响应式布局设计</li>
              <li>• 流畅的动画过渡</li>
            </ul>
          </div>
        </div>

        {/* 重新显示卡片按钮 */}
        {!showCard && (
          <div className="text-center mt-8">
            <button
              onClick={() => setShowCard(true)}
              className="pixel-button pixel-button-primary text-sm px-6 py-3 rounded-md"
            >
              重新显示像素卡片
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PixelCardDemo;
