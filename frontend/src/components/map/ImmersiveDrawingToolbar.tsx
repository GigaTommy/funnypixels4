import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';

interface ImmersiveDrawingToolbarProps {
  isActive: boolean;
  stats: {
    distance: number;
    pixels: number;
    duration: number;
    speed?: number;
  };
  discoveries: {
    driftBottles: number;
    nearbyTreasures: number;
  };
  onScanQR: () => void;
  onOpenBackpack: () => void;
  onStopDrawing: () => void;
  onSettings: () => void;
}

const ImmersiveDrawingToolbar: React.FC<ImmersiveDrawingToolbarProps> = ({
  isActive,
  stats,
  discoveries,
  onScanQR,
  onOpenBackpack,
  onStopDrawing,
  onSettings
}) => {
  const [pulseDiscovery, setPulseDiscovery] = useState(false);

  // 发现物品时的脉冲动画
  useEffect(() => {
    if (discoveries.driftBottles > 0 || discoveries.nearbyTreasures > 0) {
      setPulseDiscovery(true);
      const timer = setTimeout(() => setPulseDiscovery(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [discoveries]);

  if (!isActive) return null;

  return (
    <>
      <style>{`
        @keyframes float-pulse {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-10px); }
        }

        @keyframes discovery-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 20px rgba(6, 182, 212, 0.4);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(6, 182, 212, 0.6);
          }
        }

        @keyframes stats-glow {
          0%, 100% { background: linear-gradient(135deg, #1f2937, #374151); }
          50% { background: linear-gradient(135deg, #1e40af, #3b82f6); }
        }

        .toolbar-button {
          transition: all 0.2s ease;
        }

        .toolbar-button:hover {
          transform: scale(1.1);
        }

        .toolbar-button:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* 沉浸式底部工具栏 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'linear-gradient(to top, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.95))',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 300, // 🔥 优化：使用标准z-index规范，绘制工具栏
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px'
      }}>

        {/* 左侧：实时统计 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flex: 1,
          minWidth: 0
        }}>
          {/* 距离显示 */}
          <div style={{
            background: pulseDiscovery ?
              'linear-gradient(135deg, #06b6d4, #3b82f6)' :
              'linear-gradient(135deg, #1f2937, #374151)',
            borderRadius: '8px',
            padding: '6px 12px',
            animation: pulseDiscovery ? 'discovery-pulse 1s ease-in-out 2' : 'none'
          }}>
            <div style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📍</span>
              <span>{(stats.distance / 1000).toFixed(1)}km</span>
            </div>
          </div>

          {/* 格子数显示 */}
          <div style={{
            background: 'linear-gradient(135deg, #1f2937, #374151)',
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <div style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🎨</span>
              <span>{stats.pixels.toLocaleString()}格</span>
            </div>
          </div>

          {/* 时间显示 */}
          <div style={{
            background: 'linear-gradient(135deg, #1f2937, #374151)',
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <div style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⏱️</span>
              <span>{Math.floor(stats.duration / 60)}min</span>
            </div>
          </div>
        </div>

        {/* 中间：发现提示（仅在发现物品时显示） */}
        {(discoveries.driftBottles > 0 || discoveries.nearbyTreasures > 0) && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: '70px',
              animation: 'float-pulse 2s ease-in-out infinite',
              zIndex: 301 // 🔥 优化：使用标准z-index规范，发现提示动画
            }}
          >
            <div style={{
              background: discoveries.driftBottles > 0 ?
                'linear-gradient(135deg, #06b6d4, #3b82f6)' :
                'linear-gradient(135deg, #f59e0b, #ef4444)',
              borderRadius: '20px',
              padding: '8px 16px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: discoveries.driftBottles > 0 ?
                '0 4px 20px rgba(6, 182, 212, 0.4)' :
                '0 4px 20px rgba(245, 158, 11, 0.4)'
            }}>
              {discoveries.driftBottles > 0 ?
                `🍾 发现 ${discoveries.driftBottles} 个漂流瓶！` :
                `📦 附近有宝藏 (${discoveries.nearbyTreasures}个)`
              }
            </div>
          </div>
        )}

        {/* 右侧：功能按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* 扫码按钮 */}
          <button
            onClick={onScanQR}
            className="toolbar-button"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
              border: 'none',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
            title="扫码寻宝"
          >
            📱
          </button>

          {/* 背包按钮 */}
          <button
            onClick={onOpenBackpack}
            className="toolbar-button"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              position: 'relative'
            }}
            title="百宝箱"
          >
            🎒
            {/* 背包徽章 */}
            {(discoveries.driftBottles > 0 || discoveries.nearbyTreasures > 0) && (
              <div style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '18px',
                height: '18px',
                background: '#ef4444',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold'
              }}>
                {discoveries.driftBottles + discoveries.nearbyTreasures}
              </div>
            )}
          </button>

          {/* 设置按钮 */}
          <button
            onClick={onSettings}
            className="toolbar-button"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6b7280, #4b5563)',
              border: 'none',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)'
            }}
            title="设置"
          >
            ⚙️
          </button>

          {/* 停止绘制按钮 */}
          <button
            onClick={onStopDrawing}
            className="toolbar-button"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              marginLeft: '4px'
            }}
            title="停止绘制"
          >
            🛑
          </button>
        </div>
      </div>
    </>
  );
};

export default ImmersiveDrawingToolbar;