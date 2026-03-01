const Joi = require('joi');
const { email, password, verificationCode, phone, username, displayName } = require('./commonValidator');

/**
 * 认证相关验证规则
 */

// 注册验证
const registerSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  verificationCode: verificationCode.required(),
  username: username.optional(),
  displayName: displayName.optional(),
  referralCode: Joi.string().optional() // 推荐码（可选）
});

// 登录验证（邮箱登录）
const loginSchema = Joi.object({
  email: email.required(),
  password: password.required()
});

// 账户登录验证（支持用户名或邮箱）
const accountLoginSchema = Joi.object({
  account: Joi.string()
    .required()
    .messages({
      'string.empty': 'Account is required',
      'any.required': 'Account is required'
    }),
  password: password.required()
});

// 邮箱验证码登录
const emailCodeLoginSchema = Joi.object({
  email: email.required(),
  verificationCode: verificationCode.required()
});

// 手机验证码登录
const phoneCodeLoginSchema = Joi.object({
  phone: phone.required(),
  verificationCode: verificationCode.required()
});

// 发送验证码验证
const sendCodeSchema = Joi.object({
  email: email.optional(),
  phone: phone.optional(),
  type: Joi.string()
    .valid('register', 'login', 'resetPassword', 'bindEmail', 'bindPhone')
    .required()
    .messages({
      'any.only': 'Verification type must be: register, login, resetPassword, bindEmail, or bindPhone',
      'any.required': 'Verification type is required'
    })
}).xor('email', 'phone') // email 和 phone 必须提供其中一个
  .messages({
    'object.xor': 'Must provide either email or phone (only one)'
  });

// 刷新令牌验证
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
});

// 重置密码验证
const resetPasswordSchema = Joi.object({
  email: email.required(),
  verificationCode: verificationCode.required(),
  newPassword: password.required()
});

// 修改密码验证
const changePasswordSchema = Joi.object({
  oldPassword: password.required(),
  newPassword: password.required()
}).custom((value, helpers) => {
  // 确保新旧密码不同
  if (value.oldPassword === value.newPassword) {
    return helpers.error('password.same');
  }
  return value;
}, 'Password comparison validation')
  .messages({
    'password.same': 'New password cannot be the same as old password'
  });

// 绑定邮箱验证
const bindEmailSchema = Joi.object({
  email: email.required(),
  verificationCode: verificationCode.required()
});

// 绑定手机号验证
const bindPhoneSchema = Joi.object({
  phone: phone.required(),
  verificationCode: verificationCode.required()
});

module.exports = {
  registerSchema,
  loginSchema,
  accountLoginSchema,
  emailCodeLoginSchema,
  phoneCodeLoginSchema,
  sendCodeSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  changePasswordSchema,
  bindEmailSchema,
  bindPhoneSchema
};
