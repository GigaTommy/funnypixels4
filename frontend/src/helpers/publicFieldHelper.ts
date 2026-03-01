// __publicField 辅助函数 - 修复 TypeScript 类字段编译问题
// 这些函数是 TypeScript 编译器生成的辅助函数，用于处理类字段

// 扩展 Window 接口以包含这些辅助函数
declare global {
  interface Window {
    __defProp?: typeof Object.defineProperty;
    __defNormalProp?: (obj: any, key: string | symbol, value: any) => any;
    __publicField?: (obj: any, key: string | symbol, value: any) => any;
  }
}

if (typeof window !== 'undefined') {
  if (!window.__defProp) {
    window.__defProp = Object.defineProperty;
  }

  if (!window.__defNormalProp) {
    window.__defNormalProp = (obj: any, key: string | symbol, value: any) => {
      if (key in obj && window.__defProp) {
        return window.__defProp(obj, key, { enumerable: true, configurable: true, writable: true, value });
      }
      return obj[key] = value;
    };
  }

  if (!window.__publicField) {
    window.__publicField = (obj: any, key: string | symbol, value: any) => {
      if (window.__defNormalProp) {
        return window.__defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
      }
      return obj[key] = value;
    };
  }

  // 同时设置到全局作用域
  if (typeof globalThis !== 'undefined') {
    globalThis.__defProp = window.__defProp;
    globalThis.__defNormalProp = window.__defNormalProp;
    globalThis.__publicField = window.__publicField;
  }
}

// 导出以便在需要时使用
export const __defProp = typeof window !== 'undefined' ? window.__defProp : Object.defineProperty;
export const __defNormalProp = typeof window !== 'undefined' 
  ? window.__defNormalProp 
  : (obj: any, key: string | symbol, value: any) => {
      if (key in obj) {
        return Object.defineProperty(obj, key, { enumerable: true, configurable: true, writable: true, value });
      }
      return obj[key] = value;
    };
export const __publicField = typeof window !== 'undefined'
  ? window.__publicField
  : (obj: any, key: string | symbol, value: any) => {
      const __defNormalProp = (obj: any, key: string | symbol, value: any) => {
        if (key in obj) {
          return Object.defineProperty(obj, key, { enumerable: true, configurable: true, writable: true, value });
        }
        return obj[key] = value;
      };
      return __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    };

