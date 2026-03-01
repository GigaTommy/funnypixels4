/**
 * browserEnvironment.ts - 浏览器环境检测和兼容性工具
 *
 * 提供安全的浏览器环境访问，支持SSR和不同平台
 */

// ========== 环境检测 ==========

/**
 * 检查是否在浏览器环境中
 */
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * 检查是否在Node.js环境中
 */
export const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

/**
 * 检查是否在Web Worker环境中
 */
export const isWebWorker = typeof self !== 'undefined' && typeof window === 'undefined';

// ========== 安全的window访问 ==========

/**
 * 安全获取window对象
 */
export function safeGetWindow(): Window | null {
  if (isBrowser) {
    return window;
  }
  return null;
}

/**
 * 安全获取document对象
 */
export function safeGetDocument(): Document | null {
  if (isBrowser) {
    return document;
  }
  return null;
}

/**
 * 安全获取navigator对象
 */
export function safeGetNavigator(): Navigator | null {
  if (isBrowser) {
    return navigator;
  }
  return null;
}

/**
 * 安全获取localStorage
 */
export function safeGetLocalStorage(): Storage | null {
  if (isBrowser && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

/**
 * 安全获取sessionStorage
 */
export function safeGetSessionStorage(): Storage | null {
  if (isBrowser && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  return null;
}

// ========== 浏览器功能检测 ==========

/**
 * 检测地理位置API是否可用
 */
export function isGeolocationAvailable(): boolean {
  const nav = safeGetNavigator();
  return !!(nav && nav.geolocation);
}

/**
 * 检测WebSocket是否可用
 */
export function isWebSocketAvailable(): boolean {
  return isBrowser && typeof WebSocket !== 'undefined';
}

/**
 * 检测Canvas是否可用
 */
export function isCanvasAvailable(): boolean {
  const doc = safeGetDocument();
  return !!(doc && doc.createElement && typeof CanvasRenderingContext2D !== 'undefined');
}

/**
 * 检测设备类型
 */
export function getDeviceInfo() {
  if (!isBrowser) {
    return { isMobile: false, isTablet: false, isDesktop: false };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(userAgent);
  const isTablet = /tablet|ipad/.test(userAgent) && !isMobile;
  const isDesktop = !isMobile && !isTablet;

  return { isMobile, isTablet, isDesktop };
}

// ========== 安全的全局变量访问 ==========

/**
 * 安全获取window上的属性
 */
export function safeGetWindowProperty<T = any>(key: string, defaultValue: T = null as T): T {
  const win = safeGetWindow();
  if (win && key in win) {
    return (win as any)[key];
  }
  return defaultValue;
}

/**
 * 安全设置window上的属性
 */
export function safeSetWindowProperty(key: string, value: any): boolean {
  const win = safeGetWindow();
  if (win) {
    try {
      (win as any)[key] = value;
      return true;
    } catch (error) {
      console.warn(`Failed to set window property ${key}:`, error);
      return false;
    }
  }
  return false;
}

// ========== 延迟初始化辅助函数 ==========

/**
 * 延迟获取window上的模块（用于动态加载）
 */
export function lazyGetWindowModule<T = any>(key: string, loader?: () => T): Promise<T | null> {
  return new Promise((resolve) => {
    // 先检查是否已经存在
    const existing = safeGetWindowProperty<T>(key);
    if (existing) {
      resolve(existing);
      return;
    }

    // 如果提供了loader，尝试加载
    if (loader) {
      try {
        const module = loader();
        if (module) {
          safeSetWindowProperty(key, module);
          resolve(module);
          return;
        }
      } catch (error) {
        console.warn(`Failed to load module ${key}:`, error);
      }
    }

    // 等待一段时间再检查（用于异步加载）
    const checkInterval = setInterval(() => {
      const module = safeGetWindowProperty<T>(key);
      if (module) {
        clearInterval(checkInterval);
        resolve(module);
      }
    }, 100);

    // 5秒超时
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(null);
    }, 5000);
  });
}

// ========== 错误边界 ==========

/**
 * 安全执行可能依赖浏览器的函数
 */
export function safeExecuteBrowserFn<T>(
  fn: () => T,
  fallback: T = null as T,
  onError?: (error: Error) => void
): T {
  if (!isBrowser) {
    return fallback;
  }

  try {
    return fn();
  } catch (error) {
    console.warn('Browser function execution failed:', error);
    if (onError) {
      onError(error as Error);
    }
    return fallback;
  }
}

/**
 * 安全执行异步浏览器函数
 */
export async function safeExecuteBrowserAsyncFn<T>(
  fn: () => Promise<T>,
  fallback: T = null as T,
  onError?: (error: Error) => void
): Promise<T> {
  if (!isBrowser) {
    return fallback;
  }

  try {
    return await fn();
  } catch (error) {
    console.warn('Async browser function execution failed:', error);
    if (onError) {
      onError(error as Error);
    }
    return fallback;
  }
}

// ========== 平台特定兼容性 ==========

/**
 * 获取平台信息
 */
export function getPlatformInfo() {
  if (!isBrowser) {
    return {
      platform: 'unknown',
      userAgent: '',
      language: 'en'
    };
  }

  const nav = safeGetNavigator();
  return {
    platform: nav?.platform || 'unknown',
    userAgent: nav?.userAgent || '',
    language: nav?.language || 'en'
  };
}

/**
 * 检查是否为Linux环境
 */
export function isLinuxPlatform(): boolean {
  const { platform } = getPlatformInfo();
  return platform.toLowerCase().includes('linux');
}

/**
 * 检查是否为移动设备
 */
export function isMobileDevice(): boolean {
  return getDeviceInfo().isMobile;
}

// ========== 事件监听器安全包装 ==========

/**
 * 安全添加事件监听器
 */
export function safeAddEventListener(
  target: EventTarget | string,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): () => void {
  if (!isBrowser) {
    return () => {}; // 返回空函数
  }

  let element: EventTarget | null;

  if (typeof target === 'string') {
    element = document.querySelector(target);
  } else {
    element = target;
  }

  if (!element) {
    console.warn(`Target not found for event listener:`, target);
    return () => {};
  }

  try {
    element.addEventListener(event, handler, options);
    return () => {
      element.removeEventListener(event, handler, options);
    };
  } catch (error) {
    console.warn(`Failed to add event listener for ${event}:`, error);
    return () => {};
  }
}

// ========== 导出配置对象 ==========

export const BrowserEnvironment = {
  isBrowser,
  isNode,
  isWebWorker,
  safeGetWindow,
  safeGetDocument,
  safeGetNavigator,
  safeGetLocalStorage,
  safeGetSessionStorage,
  isGeolocationAvailable,
  isWebSocketAvailable,
  isCanvasAvailable,
  getDeviceInfo,
  safeGetWindowProperty,
  safeSetWindowProperty,
  lazyGetWindowModule,
  safeExecuteBrowserFn,
  safeExecuteBrowserAsyncFn,
  getPlatformInfo,
  isLinuxPlatform,
  isMobileDevice,
  safeAddEventListener
};