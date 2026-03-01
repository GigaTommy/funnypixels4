// esbuild 辅助函数 - 用于类字段转换
// 这个文件会被 esbuild inject 到所有需要的模块中

export var __defProp = Object.defineProperty;

export var __defNormalProp = (obj, key, value) =>
  key in obj ? __defProp(obj, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value
  }) : obj[key] = value;

export var __publicField = (obj, key, value) =>
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// 同时设置为全局变量以兼容非模块代码
if (typeof globalThis !== 'undefined') {
  globalThis.__defProp = __defProp;
  globalThis.__defNormalProp = __defNormalProp;
  globalThis.__publicField = __publicField;
}
