/**
 * 全局Toast服务
 * 提供友好的用户提示功能，替代浏览器alert
 */

import { logger } from '../utils/logger';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  duration?: number;
  type?: ToastType;
}

class ToastService {
  private static instance: ToastService;
  private toastQueue: Array<{ message: string; type: ToastType; duration?: number }> = [];

  private constructor() {}

  public static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  private showToast(message: string, type: ToastType, duration?: number) {
    // 检查全局toast是否可用
    if ((window as any).toast && (window as any).toast[type]) {
      (window as any).toast[type](message, duration);
    } else {
      // 如果toast系统未初始化，将消息加入队列
      this.toastQueue.push({ message, type, duration });
      logger.warn(`Toast系统未初始化，消息已加入队列: ${message}`);
    }
  }

  // 处理队列中的消息
  public processQueue() {
    if ((window as any).toast) {
      while (this.toastQueue.length > 0) {
        const toast = this.toastQueue.shift();
        if (toast) {
          (window as any).toast[toast.type](toast.message, toast.duration);
        }
      }
    }
  }

  // 成功提示
  public success(message: string, duration?: number) {
    this.showToast(message, 'success', duration);
  }

  // 错误提示
  public error(message: string, duration?: number) {
    this.showToast(message, 'error', duration);
  }

  // 警告提示
  public warning(message: string, duration?: number) {
    this.showToast(message, 'warning', duration);
  }

  // 信息提示
  public info(message: string, duration?: number) {
    this.showToast(message, 'info', duration);
  }

  // 用户友好的提示方法
  public showUserFriendlyMessage(type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) {
    // 将技术性错误消息转换为用户友好的消息
    const friendlyMessage = this.makeUserFriendly(message);
    this.showToast(friendlyMessage, type, duration);
  }

  // 将技术性消息转换为用户友好的消息
  private makeUserFriendly(message: string): string {
    const friendlyMappings: Record<string, string> = {
      // 定位相关
      '定位超时': '定位需要更多时间，请稍等片刻',
      '定位失败': '暂时无法获取位置，请检查网络连接',
      '定位权限被拒绝': '需要位置权限才能使用此功能',
      '网络定位失败': '网络连接不稳定，请稍后重试',
      
      // 操作相关
      '操作失败': '操作未成功，请重试',
      '操作成功': '操作完成',
      '创建失败': '创建未成功，请重试',
      '更新失败': '更新未成功，请重试',
      '删除失败': '删除未成功，请重试',
      '发送失败': '发送未成功，请重试',
      '保存失败': '保存未成功，请重试',
      '加载失败': '加载未成功，请重试',
      
      // 权限相关
      '权限不足': '需要相应权限才能执行此操作',
      '未登录': '请先登录后再使用此功能',
      '登录失败': '登录未成功，请检查账号密码',
      
      // 网络相关
      '网络错误': '网络连接异常，请检查网络',
      '请求超时': '请求时间过长，请稍后重试',
      '服务器错误': '服务暂时不可用，请稍后重试',
      
      // 文件相关
      '文件过大': '文件大小超出限制',
      '文件格式不支持': '请选择支持的文件格式',
      '上传失败': '文件上传未成功，请重试',
      
      // 通用友好化
      '失败': '未成功',
      '错误': '出现问题',
      '警告': '注意',
      '提醒': '提示',
      '异常': '出现问题',
    };

    let friendlyMessage = message;
    
    // 替换技术性词汇
    Object.entries(friendlyMappings).forEach(([technical, friendly]) => {
      friendlyMessage = friendlyMessage.replace(new RegExp(technical, 'g'), friendly);
    });

    // 移除"警告"、"提醒"等字眼
    friendlyMessage = friendlyMessage.replace(/警告|提醒|注意/g, '');
    
    // 确保消息以句号结尾
    if (!friendlyMessage.endsWith('。') && !friendlyMessage.endsWith('!') && !friendlyMessage.endsWith('？')) {
      friendlyMessage += '。';
    }

    return friendlyMessage.trim();
  }
}

// 导出单例实例
export const toast = ToastService.getInstance();

// 便捷的全局方法
export const showToast = {
  success: (message: string, duration?: number) => toast.success(message, duration),
  error: (message: string, duration?: number) => toast.error(message, duration),
  warning: (message: string, duration?: number) => toast.warning(message, duration),
  info: (message: string, duration?: number) => toast.info(message, duration),
  userFriendly: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => 
    toast.showUserFriendlyMessage(type, message, duration),
};

// 将toast服务暴露到全局，方便在组件中使用
if (typeof window !== 'undefined') {
  (window as any).toastService = toast;
}
