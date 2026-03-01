/**
 * EmojiFontLoader
 * - 依据后端约定：pattern_assets.encoding='emoji'
 * - 使用 pattern_assets.description 作为字体版本号
 * - 字体URL策略：从 envConfig 或约定的 API/静态路径拼接 version 作为 cache-buster
 */

import { config as envConfig } from '../config/env';

type Resolver = () => void;

class EmojiFontLoader {
  private currentVersion: string | null = null;
  private loading: Promise<void> | null = null;
  private fontFamily = 'AllianceFlagEmojiFont';

  /**
   * 确保加载指定版本字体（version = pattern_assets.description）
   */
  ensure(version: string | undefined | null): Promise<void> {
    const v = (version || '').trim();
    if (!v) {
      // 无版本也允许运行：跳过加载，直接resolve
      return Promise.resolve();
    }
    if (this.currentVersion === v && this.loading) {
      return this.loading;
    }

    const fontUrl = this.buildFontUrl(v);
    this.currentVersion = v;
    this.loading = this.injectFontFaceAndLoad(fontUrl);
    return this.loading;
  }

  /**
   * 返回字体家族名称，供 ctx.font 使用
   */
  getFontFamily(): string {
    return this.fontFamily;
  }

  /**
   * 构造字体URL：优先 envConfig.EMOJI_FONT_URL，否则走后端约定接口
   */
  private buildFontUrl(version: string): string {
    if ((envConfig as any).EMOJI_FONT_URL) {
      return `${(envConfig as any).EMOJI_FONT_URL}?v=${encodeURIComponent(version)}`;
    }
    // 约定：后端提供静态/代理路径
    // 可根据你的后端实现调整，例如 /api/emoji-font 或 /assets/emoji-font.woff2
    const base = (envConfig.API_BASE_URL || '').replace(/\/$/, '');
    return `${base}/assets/emoji-font.woff2?v=${encodeURIComponent(version)}`;
  }

  private injectFontFaceAndLoad(url: string): Promise<void> {
    // 动态注入 @font-face
    const family = this.fontFamily;
    const css = `@font-face { font-family: '${family}'; src: url('${url}') format('woff2'); font-display: swap; }`;
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // 等待字体可用
    try {
      // 触发一次加载
      const test = `${16}px '${family}'`;
      const p = (document as any).fonts && (document as any).fonts.load
        ? (document as any).fonts.load(test)
        : Promise.resolve([]);
      return p.then(() => undefined);
    } catch {
      return Promise.resolve();
    }
  }
}

export const emojiFontLoader = new EmojiFontLoader();


