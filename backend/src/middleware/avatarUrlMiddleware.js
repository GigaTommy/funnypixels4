/**
 * 头像URL中间件
 * 自动将响应中的avatar_url相对路径转换为完整URL
 */

const { processAvatarUrls } = require('../utils/avatarUrlHelper');
const logger = require('../utils/logger');

/**
 * 拦截res.json，自动处理avatar_url
 */
function avatarUrlMiddleware(req, res, next) {
  // 保存原始的res.json方法
  const originalJson = res.json.bind(res);

  // 重写res.json方法
  res.json = function(data) {
    try {
      // 处理响应数据中的avatar_url
      const processedData = processAvatarUrls(data);

      // 使用原始方法发送处理后的数据
      return originalJson(processedData);
    } catch (error) {
      logger.error('Avatar URL处理失败:', error);
      // 出错时返回原始数据
      return originalJson(data);
    }
  };

  next();
}

module.exports = avatarUrlMiddleware;
