/**
 * 瓦片工具函数
 * 提供瓦片坐标转换、边界计算等工具方法
 */

import { logger } from './logger';

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

export interface TileBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export class TileUtils {
  /**
   * 地理坐标转瓦片坐标
   * @param lat - 纬度
   * @param lng - 经度
   * @param zoom - 缩放级别
   * @returns 瓦片坐标
   */
  static latLngToTile(lat: number, lng: number, zoom: number): TileCoord {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    
    return { x, y, z: zoom };
  }
  
  /**
   * 瓦片坐标转地理坐标
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 地理坐标
   */
  static tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360.0 - 180.0;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180.0 / Math.PI;
    
    return { lat, lng };
  }
  
  /**
   * 瓦片坐标转地理边界
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 地理边界
   */
  static tileToBounds(x: number, y: number, zoom: number): GeoBounds {
    const n = Math.pow(2, zoom);
    
    // 左上角坐标
    const topLeft = this.tileToLatLng(x, y, zoom);
    
    // 右下角坐标
    const bottomRight = this.tileToLatLng(x + 1, y + 1, zoom);
    
    return {
      north: topLeft.lat,
      south: bottomRight.lat,
      east: bottomRight.lng,
      west: topLeft.lng
    };
  }
  
  /**
   * 地理边界转瓦片边界
   * @param bounds - 地理边界
   * @param zoom - 缩放级别
   * @returns 瓦片边界
   */
  static boundsToTileBounds(bounds: GeoBounds, zoom: number): TileBounds {
    const { north, south, east, west } = bounds;
    
    const topLeft = this.latLngToTile(north, west, zoom);
    const bottomRight = this.latLngToTile(south, east, zoom);
    
    return {
      minX: topLeft.x,
      maxX: bottomRight.x,
      minY: topLeft.y,
      maxY: bottomRight.y
    };
  }
  
  /**
   * 高德地图边界转瓦片边界
   * @param bounds - 高德地图边界对象
   * @param zoom - 缩放级别
   * @returns 瓦片边界
   */
  static amapBoundsToTileBounds(bounds: any, zoom: number): TileBounds {
    const west = bounds.getWest();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    
    return this.boundsToTileBounds({ north, south, east, west }, zoom);
  }
  
  /**
   * 获取瓦片ID
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 瓦片ID
   */
  static getTileId(x: number, y: number, zoom: number): string {
    return `${zoom}/${x}/${y}`;
  }
  
  /**
   * 解析瓦片ID
   * @param tileId - 瓦片ID (格式: "z/x/y")
   * @returns 瓦片坐标
   */
  static parseTileId(tileId: string): TileCoord | null {
    const parts = tileId.split('/');
    if (parts.length !== 3) {
      return null;
    }
    
    const x = parseInt(parts[1]);
    const y = parseInt(parts[2]);
    const z = parseInt(parts[0]);
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      return null;
    }
    
    return { x, y, z };
  }
  
  /**
   * 验证瓦片坐标 - 优化支持12-18级缩放
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 是否有效
   */
  static isValidTile(x: number, y: number, zoom: number): boolean {
    // 扩展缩放级别支持范围，特别优化12-18级
    if (zoom < 0 || zoom > 22) {
      return false;
    }

    const maxTiles = Math.pow(2, zoom);
    return x >= 0 && x < maxTiles && y >= 0 && y < maxTiles;
  }
  
  /**
   * 获取瓦片中心点
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 中心点坐标
   */
  static getTileCenter(x: number, y: number, zoom: number): { lat: number; lng: number } {
    const n = Math.pow(2, zoom);
    const lng = ((x + 0.5) / n) * 360.0 - 180.0;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180.0 / Math.PI;
    
    return { lat, lng };
  }
  
  /**
   * 计算瓦片距离
   * @param tile1 - 瓦片1
   * @param tile2 - 瓦片2
   * @returns 距离（瓦片单位）
   */
  static getTileDistance(tile1: TileCoord, tile2: TileCoord): number {
    if (tile1.z !== tile2.z) {
      throw new Error('瓦片缩放级别必须相同');
    }
    
    const dx = tile1.x - tile2.x;
    const dy = tile1.y - tile2.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * 获取瓦片邻居
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 邻居瓦片数组
   */
  static getTileNeighbors(x: number, y: number, zoom: number): TileCoord[] {
    const neighbors: TileCoord[] = [];
    const maxTiles = Math.pow(2, zoom);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        // 处理边界情况（瓦片是环形的）
        const wrappedX = (nx + maxTiles) % maxTiles;
        const wrappedY = Math.max(0, Math.min(ny, maxTiles - 1));
        
        neighbors.push({
          x: wrappedX,
          y: wrappedY,
          z: zoom
        });
      }
    }
    
    return neighbors;
  }
  
  /**
   * 获取瓦片覆盖的地理范围
   * @param x - 瓦片X坐标
   * @param y - 瓦片Y坐标
   * @param zoom - 缩放级别
   * @returns 地理范围信息
   */
  static getTileCoverage(x: number, y: number, zoom: number) {
    const bounds = this.tileToBounds(x, y, zoom);
    const center = this.getTileCenter(x, y, zoom);
    
    // 计算瓦片大小（米）
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;
    
    // 粗略估算（1度约111km）
    const latSize = latRange * 111000; // 米
    const lngSize = lngRange * 111000 * Math.cos(center.lat * Math.PI / 180); // 米
    
    return {
      bounds,
      center,
      size: {
        lat: latSize,
        lng: lngSize
      },
      area: latSize * lngSize // 平方米
    };
  }
  
  /**
   * 根据缩放级别获取合适的瓦片大小
   * @param zoom - 缩放级别
   * @returns 瓦片大小（像素）
   */
  static getTileSize(zoom: number): number {
    // 基础瓦片大小
    const baseSize = 256;
    
    // 根据缩放级别调整
    if (zoom <= 10) return baseSize;
    if (zoom <= 15) return baseSize;
    if (zoom <= 18) return baseSize;
    
    return baseSize;
  }
  
  /**
   * 计算瓦片层级
   * @param lat - 纬度
   * @param lng - 经度
   * @param pixelSize - 像素大小（米）
   * @returns 建议的缩放级别
   */
  static getRecommendedZoom(lat: number, lng: number, pixelSize: number): number {
    // 地球周长（米）
    const earthCircumference = 40075000;
    
    // 计算每度对应的米数
    const metersPerDegree = earthCircumference / 360;
    
    // 计算建议的缩放级别
    const zoom = Math.log2(earthCircumference / (pixelSize * 256));
    
    return Math.max(0, Math.min(18, Math.floor(zoom)));
  }
  
  /**
   * 检查瓦片是否在视窗内
   * @param tile - 瓦片坐标
   * @param bounds - 视窗边界
   * @param zoom - 缩放级别
   * @returns 是否在视窗内
   */
  static isTileInViewport(tile: TileCoord, bounds: GeoBounds, zoom: number): boolean {
    const tileBounds = this.tileToBounds(tile.x, tile.y, zoom);
    
    return !(
      tileBounds.east < bounds.west ||
      tileBounds.west > bounds.east ||
      tileBounds.south > bounds.north ||
      tileBounds.north < bounds.south
    );
  }
  
  /**
   * 获取视窗内的瓦片列表 - 优化12-18级缩放支持
   * @param bounds - 视窗边界
   * @param zoom - 缩放级别
   * @param padding - 边距（瓦片数量）
   * @returns 瓦片坐标数组
   */
  static getTilesInViewport(bounds: GeoBounds, zoom: number, padding: number = 1): TileCoord[] {
    // 优化缩放级别范围，特别支持12-18级
    const safeZoom = Math.max(0, Math.min(22, Math.floor(zoom)));
    if (safeZoom !== zoom) {
      logger.warn(`TileUtils: 缩放级别超出范围，从 ${zoom} 调整到 ${safeZoom}`);
    }

    // 对于12-18级缩放，添加特殊处理
    if (safeZoom >= 12 && safeZoom <= 18) {
      logger.debug(`TileUtils: 检测到12-18级缩放 (zoom=${safeZoom})，启用优化渲染模式`);
    }

    const tileBounds = this.boundsToTileBounds(bounds, safeZoom);
    const tiles: TileCoord[] = [];

    const maxTileCoord = Math.pow(2, safeZoom) - 1;
    const minX = Math.max(0, Math.floor(tileBounds.minX - padding));
    const maxX = Math.min(maxTileCoord, Math.floor(tileBounds.maxX + padding));
    const minY = Math.max(0, Math.floor(tileBounds.minY - padding));
    const maxY = Math.min(maxTileCoord, Math.floor(tileBounds.maxY + padding));

    // 额外检查，确保坐标范围合理
    if (minX > maxTileCoord || minY > maxTileCoord || maxX < 0 || maxY < 0) {
      logger.warn(`TileUtils: 瓦片坐标超出范围，zoom=${safeZoom}, bounds=`, bounds);
      return [];
    }

    logger.debug(`TileUtils: 生成瓦片坐标范围 zoom=${safeZoom}, x=${minX}-${maxX}, y=${minY}-${maxY}`);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z: safeZoom });
      }
    }

    return tiles;
  }
}

export default TileUtils;
