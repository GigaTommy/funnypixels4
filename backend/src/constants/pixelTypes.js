/**
 * 像素类型常量定义
 * 统一管理所有像素类型，确保类型一致性
 */

const PIXEL_TYPES = {
  BASIC: 'basic',        // 用户手动绘制的像素
  BOMB: 'bomb',          // 像素炸弹产生的像素
  AD: 'ad',             // 广告像素
  ALLIANCE: 'alliance',  // 联盟像素
  EVENT: 'event'        // 活动像素
};

/**
 * 像素类型描述
 */
const PIXEL_TYPE_DESCRIPTIONS = {
  [PIXEL_TYPES.BASIC]: '基础像素',
  [PIXEL_TYPES.BOMB]: '炸弹像素',
  [PIXEL_TYPES.AD]: '广告像素',
  [PIXEL_TYPES.ALLIANCE]: '联盟像素',
  [PIXEL_TYPES.EVENT]: '活动像素'
};

/**
 * 验证像素类型是否有效
 * @param {string} pixelType - 像素类型
 * @returns {boolean} 是否有效
 */
function isValidPixelType(pixelType) {
  return Object.values(PIXEL_TYPES).includes(pixelType);
}

/**
 * 获取像素类型描述
 * @param {string} pixelType - 像素类型
 * @returns {string} 类型描述
 */
function getPixelTypeDescription(pixelType) {
  return PIXEL_TYPE_DESCRIPTIONS[pixelType] || '未知类型';
}

/**
 * 获取所有像素类型
 * @returns {Array<string>} 所有像素类型数组
 */
function getAllPixelTypes() {
  return Object.values(PIXEL_TYPES);
}

module.exports = {
  PIXEL_TYPES,
  PIXEL_TYPE_DESCRIPTIONS,
  isValidPixelType,
  getPixelTypeDescription,
  getAllPixelTypes
};
