import React from 'react';
import { toast } from 'react-hot-toast';
import { Clock, AlertCircle, CheckCircle, Zap, Palette, Crown } from 'lucide-react';

export interface ItemUsageResult {
  success: boolean;
  message?: string;
  effects?: any;
  error?: string;
  cooldownInfo?: {
    remainingMinutes: number;
    isOnCooldown: boolean;
  };
}

export class ItemUsageToast {
  /**
   * 显示道具使用成功提示
   */
  static showSuccess(itemName: string, effects?: any) {
    let message = `${itemName}使用成功！`;
    let icon = '✅';
    
    if (effects) {
      if (effects.bombType === 'color_bomb') {
        message = `颜色炸弹使用成功！已将 ${effects.areaSize}x${effects.areaSize} 区域染成随机颜色`;
        icon = '💣';
      } else if (effects.bombType === 'emoji_bomb') {
        message = `表情炸弹使用成功！已将 ${effects.areaSize}x${effects.areaSize} 区域染成随机表情`;
        icon = '😀';
      } else if (effects.pixelPointsRestored) {
        message = `成功恢复 ${effects.pixelPointsRestored} 个像素点数`;
        icon = '⚡';
      } else if (effects.message) {
        message = effects.message;
      }
    }
    
    toast.success(message, {
      duration: 4000,
      icon: icon,
      style: {
        background: '#f0f9ff',
        color: '#0369a1',
        border: '1px solid #bae6fd'
      }
    });
  }

  /**
   * 显示道具使用失败提示
   */
  static showError(error: string, itemName?: string) {
    let message = error;
    let icon = '❌';
    let duration = 4000;
    
    // 检查是否是冷却时间错误
    const cooldownMatch = error.match(/还需等待(\d+)分钟/);
    if (cooldownMatch) {
      const remainingMinutes = parseInt(cooldownMatch[1]);
      message = `${itemName || '道具'}冷却中，还需等待 ${remainingMinutes} 分钟`;
      icon = '⏰';
      duration = 5000;
    } else if (error.includes('数量不足')) {
      message = `${itemName || '道具'}数量不足，请先购买`;
      icon = '📦';
    } else if (error.includes('不存在')) {
      message = `${itemName || '道具'}不存在或已下架`;
      icon = '🚫';
    } else if (error.includes('道具ID为必填项')) {
      message = '请选择要使用的道具';
      icon = '⚠️';
    } else if (error.includes('道具冷却中')) {
      // 更详细的冷却时间提示
      const cooldownMatch2 = error.match(/道具冷却中，还需等待(\d+)分钟/);
      if (cooldownMatch2) {
        const remainingMinutes = parseInt(cooldownMatch2[1]);
        message = `${itemName || '道具'}冷却中，还需等待 ${remainingMinutes} 分钟`;
        icon = '⏰';
        duration = 5000;
      } else {
        message = `${itemName || '道具'}冷却中，请稍后再试`;
        icon = '⏰';
        duration = 4000;
      }
    } else if (error.includes('道具数量不足')) {
      message = `${itemName || '道具'}数量不足，请先购买`;
      icon = '📦';
    } else if (error.includes('道具不存在')) {
      message = `${itemName || '道具'}不存在或已下架`;
      icon = '🚫';
    } else if (error.includes('没有可用的颜色图案')) {
      message = '系统暂时无法提供颜色图案，请稍后重试';
      icon = '🎨';
    } else if (error.includes('没有可用的Emoji图案')) {
      message = '系统暂时无法提供表情图案，请稍后重试';
      icon = '😀';
    } else if (error.includes('您还没有加入联盟')) {
      message = '请先加入联盟才能使用联盟炸弹';
      icon = '👥';
    } else if (error.includes('联盟没有设置旗帜图案')) {
      message = '联盟还没有设置旗帜图案';
      icon = '🏴';
    } else if (error.includes('使用失败') || error.includes('ye')) {
      message = `${itemName || '道具'}使用失败，请稍后重试`;
      icon = '❌';
    }
    
    toast.error(message, {
      duration,
      icon,
      style: {
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca'
      }
    });
  }

  /**
   * 显示冷却时间提示
   */
  static showCooldown(itemName: string, remainingMinutes: number) {
    let message = '';
    let duration = 5000;
    
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      if (minutes > 0) {
        message = `${itemName}冷却中，还需等待 ${hours} 小时 ${minutes} 分钟`;
      } else {
        message = `${itemName}冷却中，还需等待 ${hours} 小时`;
      }
      duration = 6000; // 更长的显示时间
    } else if (remainingMinutes > 0) {
      message = `${itemName}冷却中，还需等待 ${remainingMinutes} 分钟`;
      duration = 5000;
    } else {
      message = `${itemName}冷却中，请稍后再试`;
      duration = 4000;
    }
    
    // 使用更简洁的样式，避免与模态框中的提示重复
    toast(message, {
      duration,
      icon: '⏰',
      style: {
        background: '#fff7ed',
        color: '#ea580c',
        border: '1px solid #fed7aa'
      }
    });
  }

  /**
   * 显示道具信息提示
   */
  static showInfo(itemName: string, info: string) {
    toast(info, {
      duration: 3000,
      icon: 'ℹ️',
      style: {
        background: '#f0f9ff',
        color: '#0369a1',
        border: '1px solid #bae6fd'
      }
    });
  }

  /**
   * 根据道具类型获取图标
   */
  static getItemIcon(itemType: string, bombType?: string) {
    switch (itemType) {
      case 'special':
        if (bombType === 'color_bomb') return '💣';
        if (bombType === 'emoji_bomb') return '😀';
        if (bombType === 'clear_bomb') return '🧹';
        return '💥';
      case 'consumable':
        return '⚡';
      case 'cosmetic':
        return '👑';
      case 'pattern':
        return '🎨';
      default:
        return '📦';
    }
  }

  /**
   * 根据道具类型获取颜色主题
   */
  static getItemTheme(itemType: string, bombType?: string) {
    switch (itemType) {
      case 'special':
        if (bombType === 'color_bomb') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
        if (bombType === 'emoji_bomb') return { bg: '#fef3c7', color: '#d97706', border: '#fed7aa' };
        if (bombType === 'clear_bomb') return { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
      case 'consumable':
        return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
      case 'cosmetic':
        return { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' };
      case 'pattern':
        return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' };
      default:
        return { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' };
    }
  }
}

export default ItemUsageToast;
