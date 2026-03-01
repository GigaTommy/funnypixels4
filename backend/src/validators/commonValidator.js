const Joi = require('joi');

/**
 * 通用验证规则
 * 定义可重用的验证模式
 */

// 邮箱验证
const email = Joi.string()
  .email({ tlds: { allow: false } }) // 允许所有顶级域名
  .max(255)
  .trim()
  .lowercase()
  .messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
    'string.max': 'Email cannot exceed 255 characters'
  });

// 密码验证
const password = Joi.string()
  .min(6)
  .max(128)
  .messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters',
    'string.max': 'Password cannot exceed 128 characters'
  });

// 用户ID验证
const userId = Joi.number()
  .integer()
  .positive()
  .messages({
    'number.base': 'User ID must be a number',
    'number.integer': 'User ID must be an integer',
    'number.positive': 'User ID must be positive'
  });

// 验证码验证（6位数字）
const verificationCode = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .messages({
    'string.empty': 'Verification code is required',
    'string.length': 'Verification code must be 6 digits',
    'string.pattern.base': 'Invalid verification code format'
  });

// 手机号验证（支持国际格式）
const phone = Joi.string()
  .pattern(/^\+?[1-9]\d{1,14}$/)
  .messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Invalid phone number format'
  });

// 经纬度验证
const latitude = Joi.number()
  .min(-90)
  .max(90)
  .messages({
    'number.base': 'Latitude must be a number',
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90'
  });

const longitude = Joi.number()
  .min(-180)
  .max(180)
  .messages({
    'number.base': 'Longitude must be a number',
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180'
  });

// 颜色代码验证（十六进制）
const hexColor = Joi.string()
  .pattern(/^#[0-9A-Fa-f]{6}$/)
  .messages({
    'string.empty': 'Color is required',
    'string.pattern.base': 'Color must be a valid hex color code (e.g., #FFFFFF)'
  });

// 分页参数验证
const page = Joi.number()
  .integer()
  .min(1)
  .default(1)
  .messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be greater than 0'
  });

const limit = Joi.number()
  .integer()
  .min(1)
  .max(100)
  .default(20)
  .messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be greater than 0',
    'number.max': 'Limit cannot exceed 100'
  });

// UUID验证
const uuid = Joi.string()
  .guid({ version: ['uuidv4'] })
  .messages({
    'string.guid': 'Invalid UUID format'
  });

// 用户名验证（仅限字母、数字、下划线）
const username = Joi.string()
  .alphanum()
  .min(3)
  .max(30)
  .messages({
    'string.empty': 'Username is required',
    'string.alphanum': 'Username can only contain letters and numbers',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters'
  });

// 显示名称验证（允许Unicode字符）
const displayName = Joi.string()
  .min(1)
  .max(50)
  .trim()
  .messages({
    'string.empty': 'Display name is required',
    'string.min': 'Display name must be at least 1 character',
    'string.max': 'Display name cannot exceed 50 characters'
  });

// ISO日期时间验证
const isoDateTime = Joi.date()
  .iso()
  .messages({
    'date.base': 'Invalid date format',
    'date.format': 'Date must be in ISO 8601 format'
  });

module.exports = {
  email,
  password,
  userId,
  verificationCode,
  phone,
  latitude,
  longitude,
  hexColor,
  page,
  limit,
  uuid,
  username,
  displayName,
  isoDateTime
};
