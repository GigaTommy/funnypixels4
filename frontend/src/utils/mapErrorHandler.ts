/**
 * 高德地图错误封装工具
 * 将高德地图JS API的技术错误转换为用户友好的提示信息
 * 避免暴露"高德地图网络连接异常"等技术细节
 */

import { logger } from './logger';

// 错误类型枚举
export enum MapErrorType {
  NETWORK = 'network',
  API_KEY = 'api_key',
  PERMISSION = 'permission',
  SCRIPT_LOAD = 'script_load',
  INIT_ERROR = 'init_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// 错误处理器接口
export interface MapErrorHandler {
  handleNetworkError: (error: any) => string;
  handleApiError: (error: any) => string;
  handleScriptError: () => string;
  handleInitError: (error: any) => string;
  handleError: (error: any, defaultType?: MapErrorType) => string;
}

// 创建地图错误处理器
export const createMapErrorHandler = (): MapErrorHandler => {
  return {
    // 网络连接错误处理
    handleNetworkError: (error: any): string => {
      logger.warn('高德地图网络错误被封装:', error);

      const errorMessage = error?.message || error?.toString() || '';

      if (errorMessage.includes('network') ||
          errorMessage.includes('Network') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('load') ||
          errorMessage.includes('timeout')) {
        return '网络连接不稳定，地图功能可能受限，请检查网络连接后重试';
      }

      if (errorMessage.includes('403') ||
          errorMessage.includes('401') ||
          errorMessage.includes('unauthorized')) {
        return '地图服务授权异常，请联系技术支持';
      }

      if (errorMessage.includes('404') ||
          errorMessage.includes('not found')) {
        return '地图服务暂时不可用，请稍后重试';
      }

      // 默认网络错误提示
      return '地图服务连接异常，正在重新连接...';
    },

    // API错误处理
    handleApiError: (error: any): string => {
      logger.warn('高德地图API错误被封装:', error);

      const errorMessage = error?.message || error?.toString() || '';

      if (errorMessage.includes('key') ||
          errorMessage.includes('KEY') ||
          errorMessage.includes('invalid_key')) {
        return '地图服务配置异常，请联系技术支持';
      }

      if (errorMessage.includes('permission') ||
          errorMessage.includes('domain') ||
          errorMessage.includes('referer')) {
        return '域名访问权限异常，请联系技术支持';
      }

      // 默认API错误提示
      return '地图服务暂时不可用，请稍后重试';
    },

    // 脚本加载错误处理
    handleScriptError: (): string => {
      logger.warn('高德地图脚本加载失败，提供用户友好提示');
      return '地图服务暂时无法访问，请检查网络连接或稍后重试';
    },

    // 地图初始化错误处理
    handleInitError: (error: any): string => {
      logger.warn('地图初始化错误被封装:', error);
      return '地图初始化失败，正在重新尝试...';
    },

    // 通用错误处理 - 自动识别错误类型
    handleError: (error: any, defaultType: MapErrorType = MapErrorType.UNKNOWN): string => {
      if (!error) {
        return '地图服务遇到未知问题，请稍后重试';
      }

      const errorMessage = error?.message || error?.toString() || '';

      // 自动识别错误类型
      if (errorMessage.includes('network') ||
          errorMessage.includes('Network') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('load') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('The request timed out')) {
        return createMapErrorHandler().handleNetworkError(error);
      }

      if (errorMessage.includes('key') ||
          errorMessage.includes('KEY') ||
          errorMessage.includes('permission') ||
          errorMessage.includes('domain')) {
        return createMapErrorHandler().handleApiError(error);
      }

      if (errorMessage.includes('script') ||
          errorMessage.includes('Script') ||
          errorMessage.includes('Failed to load')) {
        return createMapErrorHandler().handleScriptError();
      }

      // 根据默认类型处理
      switch (defaultType) {
        case MapErrorType.NETWORK:
          return createMapErrorHandler().handleNetworkError(error);
        case MapErrorType.API_KEY:
          return createMapErrorHandler().handleApiError(error);
        case MapErrorType.SCRIPT_LOAD:
          return createMapErrorHandler().handleScriptError();
        case MapErrorType.INIT_ERROR:
          return createMapErrorHandler().handleInitError(error);
        default:
          return '地图服务暂时不可用，请稍后重试';
      }
    }
  };
};

// 单例实例，全局共享
let globalErrorHandler: MapErrorHandler | null = null;

// 获取全局错误处理器实例
export const getMapErrorHandler = (): MapErrorHandler => {
  if (!globalErrorHandler) {
    globalErrorHandler = createMapErrorHandler();
  }
  return globalErrorHandler;
};

// 便捷的错误处理函数
export const handleMapError = (error: any, defaultType?: MapErrorType): string => {
  return getMapErrorHandler().handleError(error, defaultType);
};

// 检查是否为网络相关错误
export const isNetworkError = (error: any): boolean => {
  const errorMessage = error?.message || error?.toString() || '';
  return errorMessage.includes('network') ||
         errorMessage.includes('Network') ||
         errorMessage.includes('fetch') ||
         errorMessage.includes('load') ||
         errorMessage.includes('timeout') ||
         errorMessage.includes('The request timed out');
};

// 检查是否为API密钥相关错误
export const isApiKeyError = (error: any): boolean => {
  const errorMessage = error?.message || error?.toString() || '';
  return errorMessage.includes('key') ||
         errorMessage.includes('KEY') ||
         errorMessage.includes('invalid_key');
};

// 检查是否为权限相关错误
export const isPermissionError = (error: any): boolean => {
  const errorMessage = error?.message || error?.toString() || '';
  return errorMessage.includes('permission') ||
         errorMessage.includes('domain') ||
         errorMessage.includes('referer');
};