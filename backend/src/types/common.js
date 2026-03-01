/**
 * 通用类型定义
 * @module types/common
 */

/**
 * 用户对象
 * @typedef {Object} User
 * @property {number} id - 用户ID
 * @property {string} email - 邮箱地址
 * @property {string} [username] - 用户名（可选）
 * @property {string} [display_name] - 显示名称（可选）
 * @property {string} password_hash - 密码哈希
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 * @property {boolean} [is_admin] - 是否是管理员
 * @property {string} [avatar_url] - 头像URL
 */

/**
 * 像素对象
 * @typedef {Object} Pixel
 * @property {number} id - 像素ID
 * @property {string} grid_id - 网格ID
 * @property {number} user_id - 用户ID
 * @property {string} color - 十六进制颜色代码（如 #FFFFFF）
 * @property {number} latitude - 纬度（-90 到 90）
 * @property {number} longitude - 经度（-180 到 180）
 * @property {number} [pattern_id] - 图案ID（可选）
 * @property {number} [pattern_anchor_x] - 图案锚点X
 * @property {number} [pattern_anchor_y] - 图案锚点Y
 * @property {number} [pattern_rotation] - 图案旋转（0-3）
 * @property {boolean} [pattern_mirror] - 图案镜像
 * @property {PixelType} pixel_type - 像素类型
 * @property {number} [related_id] - 关联ID
 * @property {string} [session_id] - 会话ID
 * @property {number} [alliance_id] - 联盟ID
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */

/**
 * 像素类型
 * @typedef {'basic'|'pattern'|'prop'} PixelType
 */

/**
 * 分页查询选项
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1] - 页码（从1开始）
 * @property {number} [limit=20] - 每页数量（1-100）
 */

/**
 * 分页查询结果
 * @template T
 * @typedef {Object} PaginatedResult
 * @property {T[]} data - 数据列表
 * @property {number} total - 总数
 * @property {number} page - 当前页码
 * @property {number} limit - 每页数量
 * @property {number} totalPages - 总页数
 */

/**
 * API 成功响应
 * @template T
 * @typedef {Object} ApiSuccessResponse
 * @property {true} success - 成功标志
 * @property {string} [message] - 成功消息
 * @property {T} [data] - 响应数据
 */

/**
 * API 错误响应
 * @typedef {Object} ApiErrorResponse
 * @property {false} success - 成功标志
 * @property {string} error - 错误代码
 * @property {string} message - 错误消息
 * @property {Array<{field: string, message: string}>} [details] - 详细错误信息
 */

/**
 * 验证错误详情
 * @typedef {Object} ValidationError
 * @property {string} field - 字段名
 * @property {string} message - 错误消息
 */

/**
 * 联盟对象
 * @typedef {Object} Alliance
 * @property {number} id - 联盟ID
 * @property {string} name - 联盟名称
 * @property {string} [description] - 联盟描述
 * @property {string} [color] - 联盟颜色
 * @property {number} founder_id - 创建者ID
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */

/**
 * 坐标对象
 * @typedef {Object} Coordinates
 * @property {number} latitude - 纬度
 * @property {number} longitude - 经度
 */

/**
 * 网格ID计算结果
 * @typedef {Object} GridResult
 * @property {string} gridId - 网格ID
 * @property {number} lat - 对齐后的纬度
 * @property {number} lng - 对齐后的经度
 */

/**
 * 批量处理统计
 * @typedef {Object} BatchStats
 * @property {number} totalBatches - 总批次数
 * @property {number} totalPixelsProcessed - 处理的总像素数
 * @property {number} totalHistoryRecords - 总历史记录数
 * @property {number} totalCacheUpdates - 总缓存更新数
 * @property {number} averageBatchSize - 平均批次大小
 * @property {number} averageFlushTime - 平均刷新时间（毫秒）
 * @property {number} failedOperations - 失败操作数
 */

/**
 * 排行榜条目
 * @typedef {Object} LeaderboardEntry
 * @property {number} user_id - 用户ID
 * @property {string} display_name - 显示名称
 * @property {number} pixel_count - 像素数量
 * @property {number} rank - 排名
 * @property {string} [avatar_url] - 头像URL
 */

/**
 * JWT 载荷
 * @typedef {Object} JWTPayload
 * @property {number} id - 用户ID
 * @property {string} email - 邮箱
 * @property {number} iat - 签发时间
 * @property {number} exp - 过期时间
 */

/**
 * Express 请求对象（带认证信息）
 * @typedef {import('express').Request & {user?: JWTPayload, language?: string}} AuthenticatedRequest
 */

/**
 * Socket.io Socket 对象（带用户信息）
 * @typedef {import('socket.io').Socket & {user?: JWTPayload}} AuthenticatedSocket
 */

// 导出空对象以使此文件成为模块
module.exports = {};
