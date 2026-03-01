/**
 * Toast助手工具
 * 提供便捷的方法来替换项目中的alert调用
 */

import { toast } from '../services/toast';

/**
 * 替换alert调用的便捷方法
 */
export const replaceAlert = {
  // 成功提示
  success: (message: string) => {
    toast.showUserFriendlyMessage('success', message);
  },

  // 错误提示
  error: (message: string) => {
    toast.showUserFriendlyMessage('error', message);
  },

  // 警告提示
  warning: (message: string) => {
    toast.showUserFriendlyMessage('warning', message);
  },

  // 信息提示
  info: (message: string) => {
    toast.showUserFriendlyMessage('info', message);
  },

  // 通用提示（自动判断类型）
  message: (message: string, isError: boolean = false) => {
    const type = isError ? 'error' : 'success';
    toast.showUserFriendlyMessage(type, message);
  }
};

/**
 * 常用的用户友好提示消息
 */
export const friendlyMessages = {
  // 定位相关
  location: {
    success: '位置获取成功',
    timeout: '定位需要更多时间，请稍等片刻',
    failed: '暂时无法获取位置，请检查网络连接',
    permissionDenied: '需要位置权限才能使用此功能',
    networkError: '网络连接不稳定，请稍后重试'
  },

  // 操作相关
  operation: {
    success: '操作完成',
    failed: '操作未成功，请重试',
    creating: '创建中...',
    updating: '更新中...',
    deleting: '删除中...',
    saving: '保存中...',
    loading: '加载中...'
  },

  // 权限相关
  permission: {
    loginRequired: '请先登录后再使用此功能',
    insufficient: '需要相应权限才能执行此操作',
    loginFailed: '登录未成功，请检查账号密码'
  },

  // 文件相关
  file: {
    tooLarge: '文件大小超出限制',
    invalidFormat: '请选择支持的文件格式',
    uploadFailed: '文件上传未成功，请重试',
    uploadSuccess: '文件上传成功'
  },

  // 网络相关
  network: {
    error: '网络连接异常，请检查网络',
    timeout: '请求时间过长，请稍后重试',
    serverError: '服务暂时不可用，请稍后重试'
  }
};

/**
 * 批量替换alert的示例代码
 * 
 * 使用前：
 * alert('操作失败');
 * alert('创建成功');
 * 
 * 使用后：
 * replaceAlert.error('操作失败');
 * replaceAlert.success('创建成功');
 * 
 * 或者使用友好消息：
 * replaceAlert.error(friendlyMessages.operation.failed);
 * replaceAlert.success(friendlyMessages.operation.success);
 */
