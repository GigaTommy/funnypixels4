/**
 * 带音效的按钮组件
 * 自动在点击和悬停时播放音效
 */

import React, { ButtonHTMLAttributes } from 'react';
import { soundService, SoundType } from '../../services/soundService';

interface SoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 点击时播放的音效类型
   * @default 'click'
   */
  clickSound?: SoundType | false;

  /**
   * 鼠标悬停时播放的音效类型
   * @default false
   */
  hoverSound?: SoundType | false;

  /**
   * 音效音量（0-1）
   * 不设置则使用全局音量
   */
  soundVolume?: number;

  /**
   * 子元素
   */
  children?: React.ReactNode;
}

/**
 * 带音效的按钮组件
 *
 * @example
 * ```tsx
 * // 默认点击音效
 * <SoundButton onClick={handleClick}>点击我</SoundButton>
 *
 * // 自定义音效
 * <SoundButton clickSound="confirm" hoverSound="hover">
 *   确认
 * </SoundButton>
 *
 * // 禁用音效
 * <SoundButton clickSound={false}>静音按钮</SoundButton>
 * ```
 */
export const SoundButton: React.FC<SoundButtonProps> = ({
  clickSound = 'click',
  hoverSound = false,
  soundVolume,
  onClick,
  onMouseEnter,
  children,
  disabled,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 播放点击音效
    if (clickSound && !disabled) {
      soundService.play(clickSound, soundVolume);
    }

    // 调用原始点击处理函数
    onClick?.(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 播放悬停音效
    if (hoverSound && !disabled) {
      soundService.play(hoverSound, soundVolume);
    }

    // 调用原始悬停处理函数
    onMouseEnter?.(e);
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default SoundButton;
