/**
 * OpenFreeMap 样式配置
 * OFM 提供全球服务，支持所有地区
 */

// OFM 提供的多种样式
export const OFM_STYLES = {
  liberty: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    name: 'Liberty',
    description: '明亮清新的地图样式'
  },
  dark: {
    url: 'https://tiles.openfreemap.org/styles/dark',
    name: 'Dark',
    description: '深色主题地图样式'
  },
  outdoors: {
    url: 'https://tiles.openfreemap.org/styles/outdoors',
    name: 'Outdoors',
    description: '适合户外活动的地图样式'
  },
  light: {
    url: 'https://tiles.openfreemap.org/styles/light',
    name: 'Light',
    description: '简洁的浅色地图样式'
  }
};

// 默认使用的样式
export const DEFAULT_OFM_STYLE = OFM_STYLES.liberty;

/**
 * 获取所有可用的OFM样式
 */
export function getOFMStyles() {
  return Object.entries(OFM_STYLES).map(([key, style]) => ({
    key,
    ...style
  }));
}

/**
 * 验证OFM样式是否可访问
 */
export async function validateOFMStyle(styleUrl: string): Promise<boolean> {
  try {
    const response = await fetch(styleUrl, {
      mode: 'cors',
      method: 'HEAD'
    });
    return response.ok;
  } catch (error) {
    console.warn('OFM样式验证失败:', styleUrl, error);
    return false;
  }
}

// 全局暴露
if (typeof window !== 'undefined') {
  window.__OFM_STYLES__ = {
    OFM_STYLES,
    DEFAULT_OFM_STYLE,
    getOFMStyles,
    validateOFMStyle
  };
}

// Type declarations
declare global {
  interface Window {
    __OFM_STYLES__?: {
      OFM_STYLES: typeof OFM_STYLES;
      DEFAULT_OFM_STYLE: typeof DEFAULT_OFM_STYLE;
      getOFMStyles: typeof getOFMStyles;
      validateOFMStyle: typeof validateOFMStyle;
    };
  }
}