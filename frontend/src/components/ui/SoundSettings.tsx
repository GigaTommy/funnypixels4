/**
 * 音效设置组件
 * 提供音效开关和音量调节界面
 */

import React, { useState, useEffect } from 'react';
import { soundService } from '../../services/soundService';

interface SoundSettingsProps {
  /**
   * 是否显示为紧凑模式
   */
  compact?: boolean;

  /**
   * 自定义样式类名
   */
  className?: string;
}

/**
 * 音效设置组件
 *
 * @example
 * ```tsx
 * // 完整模式（显示在设置页面）
 * <SoundSettings />
 *
 * // 紧凑模式（显示在菜单栏）
 * <SoundSettings compact />
 * ```
 */
export const SoundSettings: React.FC<SoundSettingsProps> = ({
  compact = false,
  className = ''
}) => {
  const [enabled, setEnabled] = useState(soundService.isEnabled());
  const [volume, setVolume] = useState(soundService.getVolume());

  // 监听外部变化
  useEffect(() => {
    const interval = setInterval(() => {
      setEnabled(soundService.isEnabled());
      setVolume(soundService.getVolume());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const newState = soundService.toggle();
    setEnabled(newState);

    // 播放测试音效
    if (newState) {
      soundService.play('click');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    soundService.setVolume(newVolume);
    setVolume(newVolume);

    // 播放测试音效
    soundService.play('click', newVolume);
  };

  if (compact) {
    return (
      <div className={`sound-settings-compact ${className}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)'
      }}>
        {/* 音效开关 */}
        <button
          onClick={handleToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px',
            lineHeight: 1,
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title={enabled ? '关闭音效' : '开启音效'}
        >
          {enabled ? '🔊' : '🔇'}
        </button>

        {/* 音量滑块（仅在启用时显示） */}
        {enabled && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: '80px',
              cursor: 'pointer'
            }}
            title={`音量: ${(volume * 100).toFixed(0)}%`}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`sound-settings ${className}`} style={{
      padding: '20px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '16px',
        color: '#fff'
      }}>
        🎵 音效设置
      </h3>

      {/* 音效开关 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <label style={{
          fontSize: '14px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>
            {enabled ? '🔊' : '🔇'}
          </span>
          <span>音效开关</span>
        </label>

        <button
          onClick={handleToggle}
          style={{
            position: 'relative',
            width: '50px',
            height: '28px',
            borderRadius: '14px',
            border: 'none',
            cursor: 'pointer',
            background: enabled ? '#4CAF50' : '#ccc',
            transition: 'background 0.3s',
            padding: 0
          }}
        >
          <div style={{
            position: 'absolute',
            top: '4px',
            left: enabled ? '24px' : '4px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </button>
      </div>

      {/* 音量控制 */}
      {enabled && (
        <div style={{
          marginTop: '16px'
        }}>
          <label style={{
            fontSize: '14px',
            color: '#fff',
            marginBottom: '8px',
            display: 'block'
          }}>
            音量: {(volume * 100).toFixed(0)}%
          </label>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer',
              background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${volume * 100}%, #ddd ${volume * 100}%, #ddd 100%)`
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)'
          }}>
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* 测试按钮 */}
      {enabled && (
        <button
          onClick={() => soundService.play('click')}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px',
            background: 'rgba(76, 175, 80, 0.2)',
            border: '1px solid #4CAF50',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(76, 175, 80, 0.3)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(76, 175, 80, 0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🔊 测试音效
        </button>
      )}
    </div>
  );
};

export default SoundSettings;
