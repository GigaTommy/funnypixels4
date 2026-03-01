const Joi = require('joi');

// 通用验证规则
const validationRules = {
  // 用户相关验证
  user: {
    username: Joi.string()
      .min(2)
      .max(20)
      .pattern(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
      .required()
      .messages({
        'string.pattern.base': '用户名只能包含字母、数字、下划线和中文',
        'string.min': '用户名至少2个字符',
        'string.max': '用户名最多20个字符'
      }),
    
    email: Joi.string()
      .email()
      .max(255)
      .required()
      .messages({
        'string.email': '邮箱格式不正确',
        'string.max': '邮箱长度不能超过255个字符'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': '密码必须包含大小写字母、数字和特殊字符',
        'string.min': '密码至少8个字符',
        'string.max': '密码最多128个字符'
      })
  },

  // 像素相关验证
  pixel: {
    lat: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.min': '纬度必须在-90到90之间',
        'number.max': '纬度必须在-90到90之间'
      }),
    
    lng: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.min': '经度必须在-180到180之间',
        'number.max': '经度必须在-180到180之间'
      }),
    
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .required()
      .messages({
        'string.pattern.base': '颜色格式不正确，应为#RRGGBB格式'
      }),
    
    gridId: Joi.string()
      .pattern(/^grid_\d+_\d+$/)
      .required()
      .messages({
        'string.pattern.base': '网格ID格式不正确'
      })
  },

  // 聊天消息验证
  chat: {
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.min': '消息内容不能为空',
        'string.max': '消息内容最多1000个字符'
      }),
    
    channelType: Joi.string()
      .valid('global', 'alliance', 'private')
      .required()
      .messages({
        'any.only': '频道类型必须是global、alliance或private'
      }),
    
    channelId: Joi.string()
      .when('channelType', {
        is: Joi.string().valid('alliance', 'private'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.required': '联盟频道和私聊需要指定频道ID'
      })
  },

  // 联盟相关验证
  alliance: {
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z0-9_\u4e00-\u9fa5\s]+$/)
      .required()
      .messages({
        'string.pattern.base': '联盟名称只能包含字母、数字、下划线、中文和空格',
        'string.min': '联盟名称至少2个字符',
        'string.max': '联盟名称最多50个字符'
      }),
    
    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': '联盟描述最多500个字符'
      }),
    
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({
        'string.pattern.base': '颜色格式不正确，应为#RRGGBB格式'
      })
  },

  // 商店相关验证
  store: {
    itemId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': '商品ID格式不正确'
      }),
    
    quantity: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .required()
      .messages({
        'number.integer': '数量必须是整数',
        'number.min': '数量至少为1',
        'number.max': '数量最多为100'
      })
  },

  // 分页验证
  pagination: {
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.integer': '页码必须是整数',
        'number.min': '页码至少为1'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.integer': '每页数量必须是整数',
        'number.min': '每页数量至少为1',
        'number.max': '每页数量最多为100'
      })
  }
};

// 创建验证中间件
const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '输入验证失败',
        details: errorMessages
      });
    }

    // 用验证后的数据替换原始数据
    req.body = value;
    next();
  };
};

// 查询参数验证中间件
const createQueryValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '查询参数验证失败',
        details: errorMessages
      });
    }

    req.query = value;
    next();
  };
};

// 路径参数验证中间件
const createParamValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '路径参数验证失败',
        details: errorMessages
      });
    }

    req.params = value;
    next();
  };
};

// 预定义的验证中间件
const validators = {
  // 用户注册
  register: createValidationMiddleware(
    Joi.object({
      username: validationRules.user.username,
      email: validationRules.user.email,
      password: validationRules.user.password
    })
  ),

  // 用户登录
  login: createValidationMiddleware(
    Joi.object({
      username: Joi.string().optional(),
      email: Joi.string().email().optional(),
      password: validationRules.user.password
    }).or('username', 'email')
  ),

  // 像素创建
  createPixel: createValidationMiddleware(
    Joi.object({
      lat: validationRules.pixel.lat,
      lng: validationRules.pixel.lng,
      color: validationRules.pixel.color,
      gridId: validationRules.pixel.gridId
    })
  ),

  // 批量像素查询
  batchPixels: createValidationMiddleware(
    Joi.object({
      gridIds: Joi.array()
        .items(validationRules.pixel.gridId.optional())
        .min(0)
        .max(1000)
        .required()
        .messages({
          'array.min': '网格ID数组不能为负数',
          'array.max': '最多查询1000个网格ID'
        })
    })
  ),

  // 发送聊天消息
  sendMessage: createValidationMiddleware(
    Joi.object({
      content: validationRules.chat.content,
      channelType: validationRules.chat.channelType,
      channelId: validationRules.chat.channelId,
      metadata: Joi.object().optional()
    })
  ),

  // 创建联盟
  createAlliance: createValidationMiddleware(
    Joi.object({
      name: validationRules.alliance.name,
      description: validationRules.alliance.description,
      color: validationRules.alliance.color
    })
  ),

  // 购买商品
  purchaseItem: createValidationMiddleware(
    Joi.object({
      itemId: validationRules.store.itemId,
      quantity: validationRules.store.quantity
    })
  ),

  // 分页查询
  pagination: createQueryValidationMiddleware(
    Joi.object({
      page: validationRules.pagination.page,
      limit: validationRules.pagination.limit
    })
  ),

  // UUID参数验证
  uuidParam: createParamValidationMiddleware(
    Joi.object({
      id: Joi.string().uuid().required()
    })
  ),

  // 用户ID参数验证
  userIdParam: createParamValidationMiddleware(
    Joi.object({
      userId: Joi.string().uuid().required()
    })
  )
};

// 自定义验证函数
const customValidators = {
  // 验证颜色是否为有效的十六进制颜色
  isValidHexColor: (value) => {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  },

  // 验证坐标是否在有效范围内
  isValidCoordinate: (lat, lng) => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  // 验证网格ID格式
  isValidGridId: (gridId) => {
    return /^grid_\d+_\d+$/.test(gridId);
  },

  // 验证用户名是否包含敏感词
  containsSensitiveWords: (username) => {
    const sensitiveWords = ['admin', 'root', 'system', 'test', 'guest'];
    return !sensitiveWords.some(word => 
      username.toLowerCase().includes(word)
    );
  }
};

/**
 * 🆕 通用验证中间件 - 支持多种数据源
 * @param {Object} schema - Joi schema
 * @param {string} source - 数据源：'body', 'query', 'params'
 * @returns {Function} Express中间件
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // 返回所有错误
      stripUnknown: true, // 移除未知字段
      convert: true // 自动类型转换
    });

    if (error) {
      const { getTranslator } = require('../utils/i18n');
      const t = getTranslator(req);

      // 翻译 Joi 错误消息
      const translateJoiMessage = (message) => {
        // 错误消息映射表（英文 Joi 消息 -> 翻译键）
        const messageMap = {
          'Email is required': t('validation:messages.emailRequired'),
          'Invalid email format': t('validation:messages.emailInvalid'),
          'Email cannot exceed 255 characters': t('validation:messages.emailTooLong'),
          'Password is required': t('validation:messages.passwordRequired'),
          'Password must be at least 6 characters': t('validation:messages.passwordTooShort'),
          'Password cannot exceed 128 characters': t('validation:messages.passwordTooLong'),
          'Account is required': t('validation:messages.accountRequired'),
          'Verification code is required': t('validation:messages.verificationCodeRequired'),
          'Verification code must be 6 digits': t('validation:messages.verificationCodeLength'),
          'Invalid verification code format': t('validation:messages.verificationCodeInvalid'),
          'Phone number is required': t('validation:messages.phoneRequired'),
          'Invalid phone number format': t('validation:messages.phoneInvalid'),
          'Latitude must be between -90 and 90': t('validation:messages.latitudeOutOfRange'),
          'Longitude must be between -180 and 180': t('validation:messages.longitudeOutOfRange'),
          'Color must be a valid hex color code (e.g., #FFFFFF)': t('validation:messages.colorInvalid'),
          'Page must be greater than 0': t('validation:messages.pageInvalid'),
          'Limit must be greater than 0': t('validation:messages.limitInvalid'),
          'Limit cannot exceed 100': t('validation:messages.limitInvalid'),
          'Username is required': t('validation:messages.usernameRequired'),
          'Username must be at least 3 characters': t('validation:messages.usernameTooShort'),
          'Username cannot exceed 30 characters': t('validation:messages.usernameTooLong'),
          'Username can only contain letters and numbers': t('validation:messages.usernameInvalid'),
          'Display name is required': t('validation:messages.displayNameRequired'),
          'Display name cannot exceed 50 characters': t('validation:messages.displayNameTooLong'),
          'Refresh token is required': t('validation:messages.refreshTokenRequired'),
          'Verification type is required': t('validation:messages.verificationTypeRequired'),
          'Verification type must be: register, login, resetPassword, bindEmail, or bindPhone': t('validation:messages.verificationTypeInvalid'),
          'Must provide either email or phone (only one)': t('validation:messages.mustProvideEmailOrPhone'),
          'New password cannot be the same as old password': t('validation:messages.passwordMismatch')
        };

        return messageMap[message] || message;
      };

      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: translateJoiMessage(detail.message)
      }));

      // ✅ 使用友好的具体错误消息
      // 如果只有一个错误，直接使用该错误；多个错误时使用第一个错误
      const userMessage = errorMessages.length > 0 ? errorMessages[0].message : t('validation:messages.validationFailed');

      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: userMessage,
        details: errorMessages
      });
    }

    // 验证成功，替换为清理后的数据
    req[source] = value;
    next();
  };
};

/**
 * 🆕 批量验证多个数据源
 * @param {Object} schemas - { body: schema1, query: schema2, params: schema3 }
 * @returns {Function} Express中间件
 */
const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const dataToValidate = req[source];
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const sourceErrors = error.details.map(detail => ({
          source,
          field: detail.path.join('.'),
          message: detail.message
        }));
        errors.push(...sourceErrors);
      } else {
        req[source] = value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        details: errors
      });
    }

    next();
  };
};

module.exports = {
  validationRules,
  validators,
  customValidators,
  createValidationMiddleware,
  createQueryValidationMiddleware,
  createParamValidationMiddleware,
  validate,
  validateMultiple
};
