const Joi = require('joi');
const { latitude, longitude, hexColor, userId, page, limit } = require('./commonValidator');

/**
 * 像素相关验证规则
 */

// 创建像素验证
const createPixelSchema = Joi.object({
  latitude: latitude.required(),
  longitude: longitude.required(),
  color: hexColor.required(),
  patternId: Joi.number().integer().positive().optional().allow(null),
  anchorX: Joi.number().integer().default(0),
  anchorY: Joi.number().integer().default(0),
  rotation: Joi.number().integer().min(0).max(3).default(0),
  mirror: Joi.boolean().default(false),
  pixelType: Joi.string()
    .valid('basic', 'pattern', 'prop')
    .default('basic'),
  relatedId: Joi.number().integer().positive().optional().allow(null),
  sessionId: Joi.string().uuid().optional().allow(null),
  allianceId: Joi.number().integer().positive().optional().allow(null)
});

// 批量创建像素验证
const batchCreatePixelSchema = Joi.object({
  pixels: Joi.array()
    .items(createPixelSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': '至少需要提供1个像素',
      'array.max': '单次最多只能创建1000个像素',
      'any.required': '像素数组不能为空'
    })
});

// 获取像素列表验证（查询参数）
const getPixelsSchema = Joi.object({
  page: page,
  limit: limit,
  userId: userId.optional(),
  sessionId: Joi.string().uuid().optional(),
  allianceId: Joi.number().integer().positive().optional(),
  pixelType: Joi.string().valid('basic', 'pattern', 'prop').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
    .messages({
      'date.min': '结束日期必须大于等于开始日期'
    })
});

// 获取区域像素验证
const getRegionPixelsSchema = Joi.object({
  minLat: latitude.required(),
  maxLat: latitude.required().greater(Joi.ref('minLat'))
    .messages({
      'number.greater': '最大纬度必须大于最小纬度'
    }),
  minLng: longitude.required(),
  maxLng: longitude.required().greater(Joi.ref('minLng'))
    .messages({
      'number.greater': '最大经度必须大于最小经度'
    }),
  zoom: Joi.number().integer().min(0).max(20).default(12)
});

// 获取单个像素验证（路径参数）
const getPixelByIdSchema = Joi.object({
  id: Joi.alternatives()
    .try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    )
    .required()
    .messages({
      'alternatives.match': '像素ID必须是正整数',
      'any.required': '像素ID不能为空'
    })
});

// 更新像素验证
const updatePixelSchema = Joi.object({
  color: hexColor.optional(),
  patternId: Joi.number().integer().positive().optional().allow(null),
  anchorX: Joi.number().integer().optional(),
  anchorY: Joi.number().integer().optional(),
  rotation: Joi.number().integer().min(0).max(3).optional(),
  mirror: Joi.boolean().optional()
}).min(1) // 至少需要提供一个字段
  .messages({
    'object.min': '至少需要提供一个字段进行更新'
  });

// 删除像素验证（路径参数）
const deletePixelSchema = Joi.object({
  id: Joi.alternatives()
    .try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    )
    .required()
});

module.exports = {
  createPixelSchema,
  batchCreatePixelSchema,
  getPixelsSchema,
  getRegionPixelsSchema,
  getPixelByIdSchema,
  updatePixelSchema,
  deletePixelSchema
};
