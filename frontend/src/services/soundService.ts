/**
 * 音效管理服务
 * 统一管理应用的音效播放、音量控制和开关
 */

import { logger } from '../utils/logger';

export type SoundType =
  | 'click'          // 通用按钮点击
  | 'confirm'        // 确认操作
  | 'cancel'         // 取消操作
  | 'hover'          // 鼠标悬停
  | 'success'        // 操作成功
  | 'error'          // 操作失败
  | 'notification'   // 通知提示
  | 'gamestart';     // 游戏开始/引导动画

interface SoundConfig {
  volume: number;      // 音量 0-1
  enabled: boolean;    // 是否启用音效
  preload: boolean;    // 是否预加载
}

class SoundService {
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map();
  private config: SoundConfig = {
    volume: 0.5,
    enabled: true,
    preload: true
  };

  private readonly SOUND_PATH = '/sounds/';
  private readonly SOUND_FORMAT = '.mp3';
  private readonly STORAGE_KEY_ENABLED = 'sound_enabled';
  private readonly STORAGE_KEY_VOLUME = 'sound_volume';

  constructor() {
    this.loadConfig();
    if (this.config.preload) {
      this.preloadSounds();
    }
  }

  /**
   * 从 localStorage 加载配置
   */
  private loadConfig(): void {
    try {
      const enabled = localStorage.getItem(this.STORAGE_KEY_ENABLED);
      const volume = localStorage.getItem(this.STORAGE_KEY_VOLUME);

      if (enabled !== null) {
        this.config.enabled = enabled === 'true';
      }

      if (volume !== null) {
        this.config.volume = parseFloat(volume);
      }

      logger.info('🔊 音效配置加载:', this.config);
    } catch (error) {
      logger.warn('音效配置加载失败:', error);
    }
  }

  /**
   * 保存配置到 localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_ENABLED, String(this.config.enabled));
      localStorage.setItem(this.STORAGE_KEY_VOLUME, String(this.config.volume));
    } catch (error) {
      logger.warn('音效配置保存失败:', error);
    }
  }

  /**
   * 预加载所有音效
   */
  private async preloadSounds(): Promise<void> {
    const soundTypes: SoundType[] = [
      'click',
      'confirm',
      'cancel',
      'hover',
      'success',
      'error',
      'notification',
      'gamestart'
    ];

    logger.info('🎵 开始预加载音效...');

    for (const type of soundTypes) {
      try {
        const audio = this.createAudioElement(type);
        this.audioCache.set(type, audio);
        logger.info(`✅ 音效预加载成功: ${type}`);
      } catch (error) {
        logger.warn(`⚠️ 音效预加载失败: ${type}`, error);
      }
    }

    logger.info(`✅ 音效预加载完成，共 ${this.audioCache.size} 个音效`);
  }

  /**
   * 创建音频元素
   */
  private createAudioElement(type: SoundType): HTMLAudioElement {
    const audio = new Audio();
    audio.src = `${this.SOUND_PATH}${type}${this.SOUND_FORMAT}`;
    audio.volume = this.config.volume;
    audio.preload = 'auto';

    // 静默加载失败
    audio.addEventListener('error', () => {
      logger.warn(`音效文件不存在或加载失败: ${type}`);
    });

    return audio;
  }

  /**
   * 获取或创建音频元素
   */
  private getAudio(type: SoundType): HTMLAudioElement {
    let audio = this.audioCache.get(type);

    if (!audio) {
      audio = this.createAudioElement(type);
      this.audioCache.set(type, audio);
    }

    return audio;
  }

  /**
   * 播放音效
   * @param type 音效类型
   * @param volumeOverride 可选的音量覆盖（0-1）
   */
  public play(type: SoundType, volumeOverride?: number): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const audio = this.getAudio(type);

      // 重置播放位置
      audio.currentTime = 0;

      // 设置音量
      audio.volume = volumeOverride !== undefined
        ? Math.max(0, Math.min(1, volumeOverride))
        : this.config.volume;

      // 播放音效
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // 静默处理播放失败（通常是用户未交互导致）
          logger.debug(`音效播放失败: ${type}`, error);
        });
      }
    } catch (error) {
      logger.debug(`音效播放异常: ${type}`, error);
    }
  }

  /**
   * 停止所有音效
   */
  public stopAll(): void {
    this.audioCache.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * 设置音量
   * @param volume 音量 0-1
   */
  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    // 更新所有已缓存音频的音量
    this.audioCache.forEach(audio => {
      audio.volume = this.config.volume;
    });

    this.saveConfig();
    logger.info(`🔊 音量已设置为: ${(this.config.volume * 100).toFixed(0)}%`);
  }

  /**
   * 获取当前音量
   */
  public getVolume(): number {
    return this.config.volume;
  }

  /**
   * 启用音效
   */
  public enable(): void {
    this.config.enabled = true;
    this.saveConfig();
    logger.info('🔊 音效已启用');
  }

  /**
   * 禁用音效
   */
  public disable(): void {
    this.config.enabled = false;
    this.stopAll();
    this.saveConfig();
    logger.info('🔇 音效已禁用');
  }

  /**
   * 切换音效开关
   */
  public toggle(): boolean {
    if (this.config.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.config.enabled;
  }

  /**
   * 检查音效是否启用
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 清空音效缓存（用于释放内存）
   */
  public clearCache(): void {
    this.stopAll();
    this.audioCache.clear();
    logger.info('音效缓存已清空');
  }

  /**
   * 重新加载音效缓存
   */
  public async reloadCache(): Promise<void> {
    this.clearCache();
    await this.preloadSounds();
  }
}

// 导出单例
export const soundService = new SoundService();

// 便捷的播放函数
export const playSound = (type: SoundType, volume?: number) => {
  soundService.play(type, volume);
};
