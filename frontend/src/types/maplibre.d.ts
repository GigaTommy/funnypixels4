// MapLibre GL CDN类型定义
declare global {
  interface Window {
    maplibregl?: {
      Map: new (options: any) => any;
      Popup: new () => any;
      Marker: new (options?: any) => any;
      version?: string;
    };
  }

  // 兼容全局声明
  namespace maplibregl {
    export class Map {
      constructor(options: any);
      // 添加Map的常用方法
      on(type: string, fn: any): void;
      off(type: string, fn: any): void;
      addLayer(layer: any): void;
      getSource(id: string): any;
      getStyle(): any;
      remove(): void;
      flyTo(options: any): void;
      setCenter(center: any): void;
      setZoom(zoom: number): void;
      addSource(id: string, source: any): void;
      getContainer(): HTMLElement;
      getCanvas(): HTMLCanvasElement;
    }

    export class Popup {
      constructor(options?: any);
      setLngLat(lngLat: any): Popup;
      setHTML(html: string): Popup;
      addTo(map: any): Popup;
      remove(): void;
    }

    export class Marker {
      constructor(options?: any);
      setLngLat(lngLat: any): Marker;
      addTo(map: any): Marker;
      remove(): void;
    }

    export class LngLatBounds {
      constructor(sw: any, ne: any);
    }

    export interface MapMouseEvent {
      lngLat: any;
      point: any;
      features?: any[];
    }

    export interface MapTouchEvent extends MapMouseEvent {
      points: any[];
    }
  }
}

// 提供类型别名方便使用
export type MapLibreMap = maplibregl.Map;
export type MapLibrePopup = maplibregl.Popup;
export type MapLibreMarker = maplibregl.Marker;

export {};