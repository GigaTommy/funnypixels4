import type { Rule } from 'antd/es/form'

/**
 * 统一的表单验证规则
 * 提供常用的表单字段验证规则，确保验证规则的一致性
 */

// ==================== 通用规则 ====================

/**
 * 必填项规则
 */
export const required = (message?: string): Rule => ({
  required: true,
  message: message || '此项为必填项'
})

/**
 * 可选项规则
 */
export const optional = (): Rule => ({
  required: false
})

// ==================== 字符串规则 ====================

/**
 * 用户名规则
 * - 必填
 * - 4-20个字符
 * - 只能包含字母、数字、下划线
 */
export const username: Rule[] = [
  required('请输入用户名'),
  {
    min: 4,
    max: 20,
    message: '用户名长度为4-20个字符'
  },
  {
    pattern: /^[a-zA-Z0-9_]+$/,
    message: '用户名只能包含字母、数字、下划线'
  }
]

/**
 * 密码规则
 * - 必填
 * - 6-20个字符
 */
export const password: Rule[] = [
  required('请输入密码'),
  {
    min: 6,
    max: 20,
    message: '密码长度为6-20个字符'
  }
]

/**
 * 昵称规则
 * - 必填
 * - 2-20个字符
 */
export const nickname: Rule[] = [
  required('请输入昵称'),
  {
    min: 2,
    max: 20,
    message: '昵称长度为2-20个字符'
  }
]

/**
 * 标题规则
 * - 必填
 * - 2-100个字符
 */
export const title = (message?: string): Rule[] => [
  required(message || '请输入标题'),
  {
    min: 2,
    max: 100,
    message: '标题长度为2-100个字符'
  }
]

/**
 * 描述规则
 * - 必填
 * - 10-500个字符
 */
export const description = (message?: string, minLength = 10, maxLength = 500): Rule[] => [
  required(message || '请输入描述'),
  {
    min: minLength,
    max: maxLength,
    message: `描述长度为${minLength}-${maxLength}个字符`
  }
]

/**
 * 商品名称规则
 */
export const productName: Rule[] = [
  required('请输入商品名称'),
  {
    min: 2,
    max: 50,
    message: '商品名称长度为2-50个字符'
  }
]

// ==================== 联系方式规则 ====================

/**
 * 手机号规则
 */
export const phone: Rule[] = [
  required('请输入手机号'),
  {
    pattern: /^1[3-9]\d{9}$/,
    message: '请输入正确的手机号'
  }
]

/**
 * 邮箱规则
 */
export const email: Rule[] = [
  required('请输入邮箱'),
  {
    type: 'email',
    message: '请输入正确的邮箱地址'
  }
]

/**
 * URL规则
 */
export const url: Rule[] = [
  required('请输入URL'),
  {
    type: 'url',
    message: '请输入正确的URL地址'
  }
]

/**
 * 可选URL规则
 */
export const optionalUrl: Rule[] = [
  {
    type: 'url',
    message: '请输入正确的URL地址'
  }
]

// ==================== 数字规则 ====================

/**
 * 价格规则
 */
export const price = (message?: string): Rule[] => [
  required(message || '请输入价格'),
  {
    type: 'number',
    min: 0,
    message: '价格不能小于0'
  }
]

/**
 * 积分规则
 */
export const points = (message?: string): Rule[] => [
  required(message || '请输入积分'),
  {
    type: 'number',
    min: 0,
    message: '积分不能小于0'
  }
]

/**
 * 库存规则
 */
export const stock: Rule[] = [
  required('请输入库存数量'),
  {
    type: 'number',
    min: 0,
    message: '库存不能小于0'
  }
]

/**
 * 数量规则
 */
export const quantity = (min = 1, max?: number): Rule[] => {
  const rules: Rule[] = [
    required('请输入数量'),
    {
      type: 'number',
      min,
      message: `数量不能小于${min}`
    }
  ]

  if (max !== undefined) {
    rules.push({
      type: 'number',
      max,
      message: `数量不能大于${max}`
    })
  }

  return rules
}

/**
 * 正整数规则
 */
export const positiveInteger = (message?: string): Rule[] => [
  required(message || '请输入数值'),
  {
    type: 'number',
    min: 1,
    message: '请输入大于0的整数'
  }
]

/**
 * 非负整数规则
 */
export const nonNegativeInteger = (message?: string): Rule[] => [
  required(message || '请输入数值'),
  {
    type: 'number',
    min: 0,
    message: '请输入大于等于0的整数'
  }
]

// ==================== 日期规则 ====================

/**
 * 日期规则
 */
export const date = (message?: string): Rule[] => [
  required(message || '请选择日期')
]

/**
 * 日期范围规则
 */
export const dateRange = (message?: string): Rule[] => [
  required(message || '请选择日期范围')
]

// ==================== 选择规则 ====================

/**
 * 单选规则
 */
export const select = (message?: string): Rule[] => [
  required(message || '请选择')
]

/**
 * 多选规则
 */
export const multiSelect = (message?: string, min?: number, max?: number): Rule[] => {
  const rules: Rule[] = [
    required(message || '请至少选择一项')
  ]

  if (min !== undefined) {
    rules.push({
      type: 'array',
      min,
      message: `至少选择${min}项`
    })
  }

  if (max !== undefined) {
    rules.push({
      type: 'array',
      max,
      message: `最多选择${max}项`
    })
  }

  return rules
}

// ==================== 自定义验证 ====================

/**
 * 自定义异步验证
 */
export const customAsync = (
  validator: (rule: Rule, value: any) => Promise<void>,
  message?: string
): Rule => ({
  validator,
  message
})

/**
 * 确认密码验证
 */
export const confirmPassword = (getPasswordValue: () => string): Rule => ({
  validator: (_, value) => {
    if (!value || getPasswordValue() === value) {
      return Promise.resolve()
    }
    return Promise.reject(new Error('两次输入的密码不一致'))
  }
})

/**
 * JSON格式验证
 */
export const json = (message?: string): Rule => ({
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve()
    }
    try {
      JSON.parse(value)
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(new Error(message || '请输入正确的JSON格式'))
    }
  }
})

// ==================== 组合规则 ====================

/**
 * 创建组合规则
 */
export const combine = (...rules: (Rule | Rule[])[]): Rule[] => {
  return rules.flat()
}

/**
 * 添加必填到现有规则
 */
export const withRequired = (rules: Rule[], message?: string): Rule[] => {
  return [required(message), ...rules]
}

export default {
  required,
  optional,
  username,
  password,
  nickname,
  title,
  description,
  productName,
  phone,
  email,
  url,
  optionalUrl,
  price,
  points,
  stock,
  quantity,
  positiveInteger,
  nonNegativeInteger,
  date,
  dateRange,
  select,
  multiSelect,
  customAsync,
  confirmPassword,
  json,
  combine,
  withRequired
}
