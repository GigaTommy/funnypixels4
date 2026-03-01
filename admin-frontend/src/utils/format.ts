/**
 * 格式化日期时间
 * @param time 时间字符串或时间戳
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (time: string | number | Date): string => {
  return new Date(time).toLocaleString('zh-CN')
}

/**
 * 格式化日期
 * @param time 时间字符串或时间戳
 * @returns 格式化后的日期字符串
 */
export const formatDate = (time: string | number | Date): string => {
  return new Date(time).toLocaleDateString('zh-CN')
}

/**
 * 格式化时间
 * @param time 时间字符串或时间戳
 * @returns 格式化后的时间字符串
 */
export const formatTime = (time: string | number | Date): string => {
  return new Date(time).toLocaleTimeString('zh-CN')
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}