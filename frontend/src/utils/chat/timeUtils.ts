/**
 * 聊天相关的时间处理工具函数
 */

/**
 * 格式化时间戳为聊天显示格式
 * @param timestamp ISO 时间字符串
 * @returns 格式化的时间字符串
 */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));

  // 1分钟内
  if (diffInMinutes < 1) {
    return '刚刚';
  }

  // 1小时内
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  }

  // 今天内
  if (diffInHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 昨天
  if (diffInDays === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  // 一周内
  if (diffInDays < 7) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${weekdays[date.getDay()]} ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  // 今年内
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 其他情况显示完整日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化消息列表的时间分组
 * @param timestamp ISO 时间字符串
 * @returns 分组标题字符串
 */
export function formatMessageGroupTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  // 今天
  if (diffInDays === 0 && date.getDate() === now.getDate()) {
    return '今天';
  }

  // 昨天
  if (diffInDays === 1) {
    return '昨天';
  }

  // 一周内
  if (diffInDays < 7) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  }

  // 今年内
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric'
    });
  }

  // 其他情况
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 格式化在线状态的时间
 * @param timestamp ISO 时间字符串
 * @returns 在线状态描述
 */
export function formatOnlineTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return '刚刚在线';
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前在线`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时前在线`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}天前在线`;
  }

  return '很久未在线';
}

/**
 * 检查两个时间戳是否需要显示时间分隔符
 * @param prevTimestamp 前一条消息的时间戳
 * @param currentTimestamp 当前消息的时间戳
 * @returns 是否需要显示分隔符
 */
export function shouldShowTimeSeparator(prevTimestamp: string, currentTimestamp: string): boolean {
  if (!prevTimestamp) return true;

  const prev = new Date(prevTimestamp);
  const current = new Date(currentTimestamp);
  const diffInMinutes = (current.getTime() - prev.getTime()) / (1000 * 60);

  // 超过5分钟显示时间分隔符
  return diffInMinutes > 5;
}

/**
 * 格式化持续时间
 * @param startTime 开始时间
 * @param endTime 结束时间（可选，默认为当前时间）
 * @returns 持续时间描述
 */
export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diffInSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}秒`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时${diffInMinutes % 60}分钟`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}天${diffInHours % 24}小时`;
}

/**
 * 判断时间戳是否是今天
 * @param timestamp ISO 时间字符串
 * @returns 是否是今天
 */
export function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * 判断时间戳是否是昨天
 * @param timestamp ISO 时间字符串
 * @returns 是否是昨天
 */
export function isYesterday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}