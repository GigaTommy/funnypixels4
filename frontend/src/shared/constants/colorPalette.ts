/**
 * 颜色调色板和量化工具
 * 提供256色调色板和颜色量化功能
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Hex颜色转RGB
 */
export function hexToRgb(hex: string): ColorRGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * RGB转Hex颜色
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 颜色量化到256色
 * 使用6x6x6色阶（216色）+ 灰阶（40色）
 */
export function quantizeColorTo256(color: ColorRGB): ColorRGB {
  const { r, g, b } = color;

  // 计算灰度
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const isGray = Math.abs(r - gray) < 10 && Math.abs(g - gray) < 10 && Math.abs(b - gray) < 10;

  if (isGray) {
    // 量化到40级灰阶
    const grayLevel = Math.round(gray / 255 * 39);
    const quantized = Math.round(grayLevel * 255 / 39);
    return { r: quantized, g: quantized, b: quantized };
  } else {
    // 量化到6x6x6色阶
    const quantize = (value: number) => Math.round(value / 255 * 5) * 51; // 51 = 255/5
    return {
      r: quantize(r),
      g: quantize(g),
      b: quantize(b),
    };
  }
}

/**
 * 简单的颜色量化（别名）
 */
export function quantizeColor(color: ColorRGB): ColorRGB {
  return quantizeColorTo256(color);
}

/**
 * 计算两个颜色之间的距离
 */
export function colorDistance(c1: ColorRGB, c2: ColorRGB): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 256色调色板（Web安全色 + 灰阶）
 */
export const COLOR_PALETTE_256: string[] = (() => {
  const colors: string[] = [];

  // 6x6x6 色阶（216色）
  for (let r = 0; r <= 5; r++) {
    for (let g = 0; g <= 5; g++) {
      for (let b = 0; b <= 5; b++) {
        const rv = Math.round(r * 51);
        const gv = Math.round(g * 51);
        const bv = Math.round(b * 51);
        colors.push(rgbToHex(rv, gv, bv));
      }
    }
  }

  // 40级灰阶
  for (let i = 0; i < 40; i++) {
    const gray = Math.round(i * 255 / 39);
    colors.push(rgbToHex(gray, gray, gray));
  }

  return colors;
})();
