/**
 * 颜色验证工具
 * 确保所有颜色处理都严格限制在16色基础调色板内
 */

// 16色基础调色板 - 与前端保持一致
const BASE_16_COLORS = [
  '#000000', // 黑色
  '#FFFFFF', // 白色
  '#808080', // 灰色
  '#FF0000', // 红色
  '#00FF00', // 绿色
  '#0000FF', // 蓝色
  '#FFFF00', // 黄色
  '#FF00FF', // 洋红
  '#00FFFF', // 青色
  '#800000', // 深红
  '#008000', // 深绿
  '#000080', // 深蓝
  '#808000', // 橄榄色
  '#800080', // 紫色
  '#008080', // 青绿色
  '#C0C0C0'  // 银灰色
];

/**
 * 验证颜色是否在16色基础调色板内
 * @param {string} color - 十六进制颜色值
 * @returns {boolean} 是否在基础调色板内
 */
function isValidBaseColor(color) {
  return BASE_16_COLORS.includes(color.toUpperCase());
}

/**
 * 将任意颜色量化到最接近的16色基础调色板颜色
 * @param {string} color - 十六进制颜色值
 * @returns {string} 量化后的颜色
 */
function quantizeToBaseColor(color) {
  // 移除#号并转换为大写
  const hex = color.replace('#', '').toUpperCase();

  // 如果是3位十六进制，转换为6位
  const fullHex = hex.length === 3
    ? hex.split('').map(c => c + c).join('')
    : hex;

  // 转换为RGB
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  // 转换输入颜色为Lab色彩空间
  const inputLab = rgbToLab(r, g, b);

  // 计算与每个基础颜色的感知距离
  let minDistance = Infinity;
  let closestColor = BASE_16_COLORS[0];

  for (const baseColor of BASE_16_COLORS) {
    const baseHex = baseColor.replace('#', '');
    const baseR = parseInt(baseHex.substring(0, 2), 16);
    const baseG = parseInt(baseHex.substring(2, 4), 16);
    const baseB = parseInt(baseHex.substring(4, 6), 16);

    // 转换基础颜色为Lab色彩空间
    const baseLab = rgbToLab(baseR, baseG, baseB);

    // 使用Delta E CIE76颜色差异算法（感知色彩空间距离）
    const deltaE = Math.sqrt(
      Math.pow(inputLab.L - baseLab.L, 2) +
      Math.pow(inputLab.a - baseLab.a, 2) +
      Math.pow(inputLab.b - baseLab.b, 2)
    );

    if (deltaE < minDistance) {
      minDistance = deltaE;
      closestColor = baseColor;
    }
  }

  return closestColor;
}

/**
 * 严格验证并量化颜色
 * @param {string} color - 输入颜色
 * @returns {string} 验证后的基础调色板颜色
 * @throws {Error} 如果颜色格式无效
 */
function validateAndQuantizeColor(color) {
  if (!color || typeof color !== 'string') {
    throw new Error('颜色值不能为空');
  }
  
  // 标准化颜色格式
  const normalizedColor = color.startsWith('#') ? color : `#${color}`;
  
  // 验证颜色格式
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalizedColor) && !/^#[0-9A-Fa-f]{3}$/.test(normalizedColor)) {
    throw new Error(`无效的颜色格式: ${color}`);
  }
  
  // 量化到基础调色板
  const quantizedColor = quantizeToBaseColor(normalizedColor);
  
  console.log(`🎨 颜色量化: ${normalizedColor} -> ${quantizedColor}`);
  
  return quantizedColor;
}

/**
 * RGB转Lab色彩空间（CIE Lab）
 * 提供感知均匀的颜色距离计算
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {Object} Lab色彩空间值 {L, a, b}
 */
function rgbToLab(r, g, b) {
  // 1. RGB转XYZ
  let x = r / 255;
  let y = g / 255;
  let z = b / 255;

  // 伽马校正
  x = x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
  y = y > 0.04045 ? Math.pow((y + 0.055) / 1.055, 2.4) : y / 12.92;
  z = z > 0.04045 ? Math.pow((z + 0.055) / 1.055, 2.4) : z / 12.92;

  // 使用sRGB色彩空间的矩阵转换
  x = x * 0.4124564 + y * 0.3575761 + z * 0.1804375;
  y = x * 0.2126729 + y * 0.7151522 + z * 0.0721750;
  z = x * 0.0193339 + y * 0.1191920 + z * 0.9503041;

  // 2. XYZ转Lab
  // 使用D65标准光源
  const Xn = 0.95047;
  const Yn = 1.00000;
  const Zn = 1.08883;

  x = x / Xn;
  y = y / Yn;
  z = z / Zn;

  // Lab转换函数
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const labB = 200 * (fy - fz);

  return { L, a, b: labB };
}

/**
 * 获取所有16色基础调色板颜色
 * @returns {string[]} 基础调色板颜色数组
 */
function getBaseColors() {
  return [...BASE_16_COLORS];
}

/**
 * 检查数据库中是否存在所有基础颜色图案
 * @param {Object} db - 数据库连接
 * @returns {Promise<boolean>} 是否所有基础颜色都存在
 */
async function validateBaseColorsInDatabase(db) {
  try {
    const existingColors = await db('pattern_assets')
      .where('render_type', 'color')
      .whereIn('payload', BASE_16_COLORS)
      .select('payload');
    
    const existingColorSet = new Set(existingColors.map(c => c.payload));
    const missingColors = BASE_16_COLORS.filter(color => !existingColorSet.has(color));
    
    if (missingColors.length > 0) {
      console.error(`❌ 数据库中缺少基础颜色: ${missingColors.join(', ')}`);
      return false;
    }
    
    console.log(`✅ 数据库中包含所有16色基础调色板`);
    return true;
  } catch (error) {
    console.error('❌ 验证基础颜色失败:', error);
    return false;
  }
}

module.exports = {
  isValidBaseColor,
  quantizeToBaseColor,
  validateAndQuantizeColor,
  getBaseColors,
  validateBaseColorsInDatabase,
  rgbToLab,
  BASE_16_COLORS
};
