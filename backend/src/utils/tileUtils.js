/**
 * 瓦片工具函数
 * 提供瓦片坐标转换、边界计算等工具方法
 */

class TileUtils {
  /**
   * 地理坐标转瓦片坐标
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {number} zoom - 缩放级别
   * @returns {Object} 瓦片坐标 {x, y}
   */
  static latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    
    return { x, y };
  }
  
  /**
   * 瓦片坐标转地理坐标
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {Object} 地理坐标 {lat, lng}
   */
  static tileToLatLng(x, y, zoom) {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360.0 - 180.0;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180.0 / Math.PI;
    
    return { lat, lng };
  }
  
  /**
   * 瓦片坐标转地理边界
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {Object} 地理边界 {north, south, east, west}
   */
  static tileToBounds(x, y, zoom) {
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
   * @param {Object} bounds - 地理边界 {north, south, east, west}
   * @param {number} zoom - 缩放级别
   * @returns {Object} 瓦片边界 {minX, maxX, minY, maxY}
   */
  static boundsToTileBounds(bounds, zoom) {
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
   * 获取瓦片ID
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {string} 瓦片ID
   */
  static getTileId(x, y, zoom) {
    return `${zoom}/${x}/${y}`;
  }

  /**
   * 地理坐标转瓦片ID（便捷方法）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {number} zoom - 缩放级别
   * @returns {string} 瓦片ID (格式: "z/x/y")
   */
  static latLngToTileId(lat, lng, zoom) {
    const tile = this.latLngToTile(lat, lng, zoom);
    return this.getTileId(tile.x, tile.y, zoom);
  }
  
  /**
   * 解析瓦片ID
   * @param {string} tileId - 瓦片ID (格式: "z/x/y")
   * @returns {Object} 瓦片坐标 {x, y, zoom}
   */
  static parseTileId(tileId) {
    const parts = tileId.split('/');
    if (parts.length !== 3) {
      throw new Error('无效的瓦片ID格式');
    }
    
    return {
      zoom: parseInt(parts[0]),
      x: parseInt(parts[1]),
      y: parseInt(parts[2])
    };
  }
  
  /**
   * 验证瓦片坐标
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {boolean} 是否有效
   */
  static isValidTile(x, y, zoom) {
    if (zoom < 8 || zoom > 20) {
      return false;
    }
    
    const maxTiles = Math.pow(2, zoom);
    return x >= 0 && x < maxTiles && y >= 0 && y < maxTiles;
  }
  
  /**
   * 验证瓦片坐标（别名方法，用于兼容性）
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {boolean} 是否有效
   */
  static isValidTileCoord(x, y, zoom) {
    return this.isValidTile(x, y, zoom);
  }
  
  /**
   * 获取瓦片中心点
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {Object} 中心点坐标 {lat, lng}
   */
  static getTileCenter(x, y, zoom) {
    const n = Math.pow(2, zoom);
    const lng = ((x + 0.5) / n) * 360.0 - 180.0;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180.0 / Math.PI;
    
    return { lat, lng };
  }
  
  /**
   * 计算瓦片距离
   * @param {Object} tile1 - 瓦片1 {x, y, zoom}
   * @param {Object} tile2 - 瓦片2 {x, y, zoom}
   * @returns {number} 距离（瓦片单位）
   */
  static getTileDistance(tile1, tile2) {
    if (tile1.zoom !== tile2.zoom) {
      throw new Error('瓦片缩放级别必须相同');
    }
    
    const dx = tile1.x - tile2.x;
    const dy = tile1.y - tile2.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * 获取瓦片邻居
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {Array} 邻居瓦片数组
   */
  static getTileNeighbors(x, y, zoom) {
    const neighbors = [];
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
          zoom,
          tileId: this.getTileId(wrappedX, wrappedY, zoom)
        });
      }
    }
    
    return neighbors;
  }
  
  /**
   * 获取瓦片覆盖的地理范围
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} zoom - 缩放级别
   * @returns {Object} 地理范围信息
   */
  static getTileCoverage(x, y, zoom) {
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
   * @param {number} zoom - 缩放级别
   * @returns {number} 瓦片大小（像素）
   */
  static getTileSize(zoom) {
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
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {number} pixelSize - 像素大小（米）
   * @returns {number} 建议的缩放级别
   */
  static getRecommendedZoom(lat, lng, pixelSize) {
    // 地球周长（米）
    const earthCircumference = 40075000;
    
    // 计算每度对应的米数
    const metersPerDegree = earthCircumference / 360;
    
    // 计算建议的缩放级别
    const zoom = Math.log2(earthCircumference / (pixelSize * 256));
    
    return Math.max(8, Math.min(20, Math.floor(zoom)));
  }
}

module.exports = TileUtils;
