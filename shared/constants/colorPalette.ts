/**
 * 统一的16色调色板定义
 * 用于前后端颜色量化，确保一致性
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export const PALETTE_16_COLORS: ColorRGB[] = [
  { r: 0, g: 0, b: 0, hex: '#000000' },      // 黑色
  { r: 255, g: 255, b: 255, hex: '#FFFFFF' }, // 白色
  { r: 128, g: 128, b: 128, hex: '#808080' }, // 灰色
  { r: 255, g: 0, b: 0, hex: '#FF0000' },     // 红色
  { r: 0, g: 255, b: 0, hex: '#00FF00' },     // 绿色
  { r: 0, g: 0, b: 255, hex: '#0000FF' },     // 蓝色
  { r: 255, g: 255, b: 0, hex: '#FFFF00' },   // 黄色
  { r: 255, g: 0, b: 255, hex: '#FF00FF' },   // 洋红
  { r: 0, g: 255, b: 255, hex: '#00FFFF' },   // 青色
  { r: 128, g: 0, b: 0, hex: '#800000' },     // 深红
  { r: 0, g: 128, b: 0, hex: '#008000' },     // 深绿
  { r: 0, g: 0, b: 128, hex: '#000080' },     // 深蓝
  { r: 128, g: 128, b: 0, hex: '#808000' },   // 橄榄色
  { r: 128, g: 0, b: 128, hex: '#800080' },   // 紫色
  { r: 0, g: 128, b: 128, hex: '#008080' },   // 青绿色
  { r: 192, g: 192, b: 192, hex: '#C0C0C0' }  // 银灰色
];

// ✅ 颜色缓存
const colorCache = new Map<string, ColorRGB>();

/**
 * 将RGB颜色量化到最接近的调色板颜色
 * ✅ 现在统一使用256色调色板
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns 量化后的颜色
 */
export function quantizeColor(r: number, g: number, b: number): ColorRGB {
  // ✅ 统一使用256色调色板
  return quantizeColorTo256(r, g, b);
}

/**
 * 将十六进制颜色转换为RGB
 * @param hex 十六进制颜色字符串
 * @returns RGB对象
 */
export function hexToRgb(hex: string): ColorRGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    hex: hex
  } : { r: 0, g: 0, b: 0, hex: '#000000' };
}

/**
 * 将RGB颜色转换为十六进制
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns 十六进制颜色字符串
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * ===== 256色调色板（用于广告图片） =====
 * 包含：216个Web安全色 + 40个灰度级
 * 用于提升广告图片的还原度
 */

/**
 * 生成256色调色板
 * - 216个Web安全色（6×6×6 RGB立方体）
 * - 40个灰度级（从黑到白）
 */
export function generate256ColorPalette(): ColorRGB[] {
  const palette: ColorRGB[] = [];

  // 1. 生成 216 个 Web 安全色
  const rgbLevels = [0, 51, 102, 153, 204, 255];  // 6级

  for (const r of rgbLevels) {
    for (const g of rgbLevels) {
      for (const b of rgbLevels) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        palette.push({ r, g, b, hex });
      }
    }
  }

  // 2. 添加 40 个灰度级
  for (let i = 0; i < 40; i++) {
    const gray = Math.floor((i / 39) * 255);
    const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
    palette.push({ r: gray, g: gray, b: gray, hex });
  }

  return palette;
}

// 预生成256色调色板
export const PALETTE_256_COLORS = generate256ColorPalette();

// ✅ 256色缓存（独立于16色缓存）
const color256Cache = new Map<string, ColorRGB>();

/**
 * 将RGB颜色量化到256色调色板
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns 量化后的颜色
 */
export function quantizeColorTo256(r: number, g: number, b: number): ColorRGB {
  // ✅ 检查缓存
  const key = `${r},${g},${b}`;
  if (color256Cache.has(key)) {
    return color256Cache.get(key)!;
  }

  let minDistance = Infinity;
  let closestColor = PALETTE_256_COLORS[0];

  for (const color of PALETTE_256_COLORS) {
    // 使用加权欧几里得距离
    const distance =
      Math.pow(r - color.r, 2) * 0.30 +
      Math.pow(g - color.g, 2) * 0.59 +
      Math.pow(b - color.b, 2) * 0.11;

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  // ✅ 缓存结果
  color256Cache.set(key, closestColor);
  return closestColor;
}
