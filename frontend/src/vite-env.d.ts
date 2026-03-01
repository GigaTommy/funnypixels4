/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly BASE_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_AMAP_KEY: string
  readonly VITE_WEBSOCKET_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// TypeScript 类字段辅助函数类型声明
declare global {
  interface Window {
    // MapLibre GL CDN 版本的全局变量
    maplibregl: any;
    // 辅助函数（CDN 版本已内置）
    __defProp?: typeof Object.defineProperty;
    __defNormalProp?: (obj: any, key: string | symbol, value: any) => any;
    __publicField?: (obj: any, key: string | symbol, value: any) => any;
  }

  // 全局变量声明
  var __defProp: typeof Object.defineProperty;
  var __defNormalProp: (obj: any, key: string | symbol, value: any) => any;
  var __publicField: (obj: any, key: string | symbol, value: any) => any;
  var maplibregl: any;
}