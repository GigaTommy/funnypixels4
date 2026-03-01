// @ts-check

/**
 * i18n 工具函数模块
 * 提供便捷的国际化翻译和响应生成方法
 * @module utils/i18n
 */

const { i18next } = require('../config/i18n');

/**
 * @typedef {import('../types/common').ApiErrorResponse} ApiErrorResponse
 * @typedef {import('../types/common').ApiSuccessResponse} ApiSuccessResponse
 * @typedef {import('../types/common').ValidationError} ValidationError
 * @typedef {import('express').Request} Request
 */

/**
 * 翻译函数类型
 * @typedef {(key: string, options?: Object) => string} TranslatorFunction
 */

/**
 * 语言代码映射表
 * 将简短语言代码映射到完整语言代码
 */
const LANGUAGE_CODE_MAP = {
  'zh': 'zh-Hans',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'zh-HK': 'zh-Hant',
  'pt': 'pt-BR',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'es': 'es'
};

/**
 * 规范化语言代码
 * @param {string} langCode - 原始语言代码
 * @returns {string} 规范化后的语言代码
 */
function normalizeLangCode(langCode) {
  if (!langCode) return 'zh-Hans';

  // 提取主语言代码（如 'zh-CN' -> 'zh', 'en-US' -> 'en'）
  const mainCode = langCode.split('-')[0].toLowerCase();
  const fullCode = langCode.toLowerCase();

  // 尝试完全匹配
  if (LANGUAGE_CODE_MAP[fullCode]) {
    return LANGUAGE_CODE_MAP[fullCode];
  }

  // 尝试主语言代码匹配
  if (LANGUAGE_CODE_MAP[mainCode]) {
    return LANGUAGE_CODE_MAP[mainCode];
  }

  // 默认返回简体中文
  return 'zh-Hans';
}

/**
 * 翻译错误消息
 * @param {string} key - 翻译键（如 'errors:auth.invalidCredentials'）
 * @param {string} [lng='zh-Hans'] - 语言代码
 * @param {Object} [options={}] - 插值选项
 * @returns {string} 翻译后的文本
 * @example
 * t('errors:auth.invalidCredentials', 'zh')
 * t('errors:rateLimit.tooManyRequests', 'en', { retryAfter: 60 })
 */
function t(key, lng = 'zh-Hans', options = {}) {
  const normalizedLng = normalizeLangCode(lng);
  return i18next.t(key, { lng: normalizedLng, ...options });
}

/**
 * 从请求对象获取翻译函数
 * @param {Request} req - Express 请求对象
 * @returns {TranslatorFunction} 翻译函数
 * @example
 * const t = getTranslator(req);
 * const message = t('errors:auth.invalidCredentials');
 */
function getTranslator(req) {
  const rawLng = req.language || req.headers['accept-language']?.split(',')[0] || 'zh-Hans';
  const lng = normalizeLangCode(rawLng);

  return (key, options = {}) => {
    return i18next.t(key, { lng, ...options });
  };
}

/**
 * 生成国际化错误响应
 * @param {Request} req - Express 请求对象
 * @param {string} errorKey - 错误键（如 'auth.invalidCredentials'）
 * @param {number} [statusCode=400] - HTTP 状态码
 * @param {Object} [options={}] - 插值选项
 * @returns {ApiErrorResponse & {statusCode: number}} 错误响应对象
 * @example
 * createErrorResponse(req, 'auth.invalidCredentials', 401)
 * createErrorResponse(req, 'rateLimit.tooManyRequests', 429, { retryAfter: 60 })
 */
function createErrorResponse(req, errorKey, statusCode = 400, options = {}) {
  const t = getTranslator(req);

  return {
    success: false,
    error: errorKey.toUpperCase().replace(/\./g, '_'),
    message: t(`errors:${errorKey}`, options),
    statusCode
  };
}

/**
 * 生成国际化成功响应
 * @template T
 * @param {Request} req - Express 请求对象
 * @param {string} successKey - 成功键（如 'auth.loginSuccess'）
 * @param {T} [data=null] - 响应数据
 * @param {Object} [options={}] - 插值选项
 * @returns {ApiSuccessResponse<T>} 成功响应对象
 * @example
 * createSuccessResponse(req, 'auth.loginSuccess', { user, token })
 * createSuccessResponse(req, 'pixel.batchCreated', pixels, { count: pixels.length })
 */
function createSuccessResponse(req, successKey, data = null, options = {}) {
  const t = getTranslator(req);

  const response = {
    success: true,
    message: t(`success:${successKey}`, options)
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
}

/**
 * 翻译验证错误
 * @param {Request} req - Express 请求对象
 * @param {ValidationError[]} validationErrors - Joi 验证错误数组
 * @returns {ValidationError[]} 翻译后的错误数组
 * @example
 * translateValidationErrors(req, [
 *   { field: 'email', message: 'Invalid email' }
 * ])
 */
function translateValidationErrors(req, validationErrors) {
  const t = getTranslator(req);

  return validationErrors.map(error => ({
    field: error.field,
    message: error.message // Joi 已经有自定义消息，保持不变
    // 如果需要翻译 Joi 错误，可以在这里添加逻辑
  }));
}

/**
 * 快捷错误响应方法
 * @namespace errors
 */
const errors = {
  /**
   * 内部服务器错误
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  internalServerError: (req) => createErrorResponse(req, 'common.internalServerError', 500),

  /**
   * 资源未找到
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  notFound: (req) => createErrorResponse(req, 'common.notFound', 404),

  /**
   * 未授权访问
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  unauthorized: (req) => createErrorResponse(req, 'common.unauthorized', 401),

  /**
   * 禁止访问
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  forbidden: (req) => createErrorResponse(req, 'common.forbidden', 403),

  /**
   * 错误的请求
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  badRequest: (req) => createErrorResponse(req, 'common.badRequest', 400),

  /**
   * 无效凭据
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  invalidCredentials: (req) => createErrorResponse(req, 'auth.invalidCredentials', 401),

  /**
   * 邮箱不存在
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  emailNotFound: (req) => createErrorResponse(req, 'auth.emailNotFound', 404),

  /**
   * 邮箱已存在
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  emailAlreadyExists: (req) => createErrorResponse(req, 'auth.emailAlreadyExists', 409),

  /**
   * 无效令牌
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  invalidToken: (req) => createErrorResponse(req, 'auth.invalidToken', 401),

  /**
   * 令牌过期
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  tokenExpired: (req) => createErrorResponse(req, 'auth.tokenExpired', 401),

  /**
   * 验证码无效
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  verificationCodeInvalid: (req) => createErrorResponse(req, 'auth.verificationCodeInvalid', 400),

  /**
   * 验证码过期
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  verificationCodeExpired: (req) => createErrorResponse(req, 'auth.verificationCodeExpired', 400),

  /**
   * 像素未找到
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  pixelNotFound: (req) => createErrorResponse(req, 'pixel.notFound', 404),

  /**
   * 余额不足
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  insufficientBalance: (req) => createErrorResponse(req, 'pixel.insufficientBalance', 400),

  /**
   * 用户未找到
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  userNotFound: (req) => createErrorResponse(req, 'user.notFound', 404),

  /**
   * 非资源拥有者
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  notOwner: (req) => createErrorResponse(req, 'user.notOwner', 403),

  /**
   * 请求过于频繁
   * @param {Request} req
   * @param {number} [retryAfter=60] - 重试等待秒数
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  tooManyRequests: (req, retryAfter = 60) => createErrorResponse(
    req,
    'rateLimit.tooManyRequests',
    429,
    { retryAfter }
  ),

  /**
   * 图案未找到
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  patternNotFound: (req) => createErrorResponse(req, 'pattern.notFound', 404),

  /**
   * 图案加载失败
   * @param {Request} req
   * @returns {ApiErrorResponse & {statusCode: number}}
   */
  patternLoadFailed: (req) => createErrorResponse(req, 'pattern.loadFailed', 500)
};

/**
 * 快捷成功响应方法
 * @namespace success
 */
const success = {
  /**
   * 注册成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  registerSuccess: (req, data) => createSuccessResponse(req, 'auth.registerSuccess', data),

  /**
   * 登录成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  loginSuccess: (req, data) => createSuccessResponse(req, 'auth.loginSuccess', data),

  /**
   * 登出成功
   * @param {Request} req
   * @returns {ApiSuccessResponse<null>}
   */
  logoutSuccess: (req) => createSuccessResponse(req, 'auth.logoutSuccess'),

  /**
   * 密码修改成功
   * @param {Request} req
   * @returns {ApiSuccessResponse<null>}
   */
  passwordChanged: (req) => createSuccessResponse(req, 'auth.passwordChanged'),

  /**
   * 像素创建成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  pixelCreated: (req, data) => createSuccessResponse(req, 'pixel.created', data),

  /**
   * 像素更新成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  pixelUpdated: (req, data) => createSuccessResponse(req, 'pixel.updated', data),

  /**
   * 像素删除成功
   * @param {Request} req
   * @returns {ApiSuccessResponse<null>}
   */
  pixelDeleted: (req) => createSuccessResponse(req, 'pixel.deleted'),

  /**
   * 操作成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  operationSuccess: (req, data) => createSuccessResponse(req, 'general.operationSuccess', data),

  /**
   * 保存成功
   * @template T
   * @param {Request} req
   * @param {T} data
   * @returns {ApiSuccessResponse<T>}
   */
  saveSuccess: (req, data) => createSuccessResponse(req, 'general.saveSuccess', data)
};

module.exports = {
  t,
  getTranslator,
  createErrorResponse,
  createSuccessResponse,
  translateValidationErrors,
  errors,
  success
};
