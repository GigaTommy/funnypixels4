/**
 * GPS测试路线生成器
 * 用于开发环境生成模拟GPS轨迹，测试GPS绘制功能
 */

import { GPSPosition } from './gpsSimulator';
import { logger } from './logger';

export class RouteGenerator {
  /**
   * 计算两点之间的距离（单位：米）
   */
  private static haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 生成两点之间的直线路径（用于自定义路线）
   * @param start 起点坐标
   * @param end 终点坐标
   * @param samples 采样点数量（可选，默认自动计算）
   * @param accuracyPattern 精度模式
   */
  static generateStraightRoute(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    samples?: number,
    accuracyPattern: 'good' | 'medium' | 'poor' | 'mixed' = 'good'
  ): GPSPosition[] {
    const totalDistance = this.haversineDistance(start.lat, start.lng, end.lat, end.lng);

    // 如果未指定samples，则自动计算：确保每11米一个点（覆盖每个像素格子）
    const PIXEL_SIZE_METERS = 11;
    const calculatedSamples = Math.ceil(totalDistance / PIXEL_SIZE_METERS);
    const actualSamples = samples || calculatedSamples;

    logger.info(`🗺️ 生成自定义路线: 起点 → 终点`, {
      start: `(${start.lat.toFixed(6)}, ${start.lng.toFixed(6)})`,
      end: `(${end.lat.toFixed(6)}, ${end.lng.toFixed(6)})`,
      totalDistance: `${(totalDistance / 1000).toFixed(2)}km`,
      pixelGrids: calculatedSamples.toLocaleString(),
      samples: actualSamples.toLocaleString(),
      accuracyPattern,
      metersPerSample: (totalDistance / actualSamples).toFixed(2)
    });

    const positions: GPSPosition[] = [];

    for (let i = 0; i <= actualSamples; i++) {
      const ratio = i / actualSamples;

      // 线性插值计算位置
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;

      // 根据模式生成精度
      const accuracy = this.simulateAccuracy(ratio, accuracyPattern);

      positions.push({
        latitude: lat,
        longitude: lng,
        accuracy,
        timestamp: Date.now() + i * 1000 // 预设时间戳，实际会被覆盖
      });
    }

    logger.info(`✅ 自定义路线生成完成: ${positions.length.toLocaleString()}个位置点，覆盖约${calculatedSamples.toLocaleString()}个像素格子`);
    return positions;
  }

  /**
   * 生成广州塔到北京天安门的测试路线
   * @param samples 采样点数量（默认自动计算覆盖所有像素格子）
   * @param accuracyPattern 精度模式：'good'(5-15m) | 'medium'(10-30m) | 'poor'(20-50m) | 'mixed'(混合)
   */
  static generateGuangzhouToBeijing(
    samples?: number,
    accuracyPattern: 'good' | 'medium' | 'poor' | 'mixed' = 'good'
  ): GPSPosition[] {
    const start = { lat: 23.1291, lng: 113.2644 }; // 广州塔
    const end = { lat: 39.9042, lng: 116.4074 };   // 北京天安门

    return this.generateStraightRoute(start, end, samples, accuracyPattern);
  }

  /**
   * 生成城市漫游路线（适合快速测试）
   * @param center 中心点
   * @param radius 半径（米）
   * @param points 点数
   * @param pattern 路线模式
   */
  static generateCityWalkRoute(options: {
    center: { lat: number; lng: number };
    radius: number;
    points: number;
    pattern?: 'circle' | 'random' | 'grid';
    accuracyPattern?: 'good' | 'medium' | 'poor' | 'mixed';
  }): GPSPosition[] {
    const {
      center,
      radius,
      points,
      pattern = 'random',
      accuracyPattern = 'good'
    } = options;

    logger.info(`🗺️ 生成城市漫游路线`, {
      center: `(${center.lat}, ${center.lng})`,
      radius: `${radius}m`,
      points,
      pattern
    });

    const positions: GPSPosition[] = [];

    if (pattern === 'circle') {
      // 圆形路线
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const latOffset = (radius / 111000) * Math.cos(angle);
        const lngOffset = (radius / (111000 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);

        positions.push({
          latitude: center.lat + latOffset,
          longitude: center.lng + lngOffset,
          accuracy: this.simulateAccuracy(i / points, accuracyPattern),
          timestamp: Date.now() + i * 1000
        });
      }
    } else if (pattern === 'grid') {
      // 网格路线（之字形扫描）
      const gridSize = Math.ceil(Math.sqrt(points));
      const step = (radius * 2) / gridSize;
      let pointIndex = 0;

      for (let row = 0; row < gridSize && pointIndex < points; row++) {
        for (let col = 0; col < gridSize && pointIndex < points; col++) {
          const xOffset = (col * step - radius) / 111000;
          const yOffset = (row * step - radius) / (111000 * Math.cos(center.lat * Math.PI / 180));

          positions.push({
            latitude: center.lat + xOffset,
            longitude: center.lng + yOffset,
            accuracy: this.simulateAccuracy(pointIndex / points, accuracyPattern),
            timestamp: Date.now() + pointIndex * 1000
          });
          pointIndex++;
        }
      }
    } else {
      // 随机游走
      let currentLat = center.lat;
      let currentLng = center.lng;

      for (let i = 0; i < points; i++) {
        positions.push({
          latitude: currentLat,
          longitude: currentLng,
          accuracy: this.simulateAccuracy(i / points, accuracyPattern),
          timestamp: Date.now() + i * 1000
        });

        // 随机移动11-50米（覆盖1-5个网格）
        const distance = (11 + Math.random() * 39) / 111000;
        const angle = Math.random() * 2 * Math.PI;
        currentLat += distance * Math.cos(angle);
        currentLng += distance * Math.sin(angle);

        // 限制在radius范围内
        const distFromCenter = this.haversineDistance(
          center.lat, center.lng, currentLat, currentLng
        );
        if (distFromCenter > radius) {
          // 拉回到中心方向
          const angleToCenter = Math.atan2(
            center.lat - currentLat,
            center.lng - currentLng
          );
          currentLat = center.lat - (radius / 111000) * Math.cos(angleToCenter) * 0.8;
          currentLng = center.lng - (radius / (111000 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angleToCenter) * 0.8;
        }
      }
    }

    logger.info(`✅ 城市漫游路线生成完成: ${positions.length}个位置点`);
    return positions;
  }

  /**
   * 生成网格边界测试路线
   * 用于测试跨越网格边界时的绘制行为
   */
  static generateGridBoundaryRoute(options: {
    gridCenter: { lat: number; lng: number };
    crossPattern?: 'horizontal' | 'vertical' | 'cross' | 'circle';
    points?: number;
  }): GPSPosition[] {
    const {
      gridCenter,
      crossPattern = 'cross',
      points = 20
    } = options;

    const GRID_SIZE = 0.0001; // 0.0001度 ≈ 11米
    const positions: GPSPosition[] = [];

    logger.info(`🗺️ 生成网格边界测试路线`, {
      gridCenter: `(${gridCenter.lat}, ${gridCenter.lng})`,
      pattern: crossPattern,
      points
    });

    if (crossPattern === 'horizontal') {
      // 水平穿越3个网格
      for (let i = 0; i < points; i++) {
        const ratio = i / (points - 1);
        const lng = gridCenter.lng - GRID_SIZE * 1.5 + GRID_SIZE * 3 * ratio;
        positions.push({
          latitude: gridCenter.lat,
          longitude: lng,
          accuracy: 5,
          timestamp: Date.now() + i * 1000
        });
      }
    } else if (crossPattern === 'vertical') {
      // 垂直穿越3个网格
      for (let i = 0; i < points; i++) {
        const ratio = i / (points - 1);
        const lat = gridCenter.lat - GRID_SIZE * 1.5 + GRID_SIZE * 3 * ratio;
        positions.push({
          latitude: lat,
          longitude: gridCenter.lng,
          accuracy: 5,
          timestamp: Date.now() + i * 1000
        });
      }
    } else if (crossPattern === 'circle') {
      // 围绕网格中心转圈（穿越多个网格）
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const radius = GRID_SIZE * 2; // 2个网格的半径
        positions.push({
          latitude: gridCenter.lat + radius * Math.cos(angle),
          longitude: gridCenter.lng + radius * Math.sin(angle),
          accuracy: 5,
          timestamp: Date.now() + i * 1000
        });
      }
    } else {
      // 十字交叉模式
      const halfPoints = Math.floor(points / 2);

      // 先水平
      for (let i = 0; i < halfPoints; i++) {
        const ratio = i / (halfPoints - 1);
        const lng = gridCenter.lng - GRID_SIZE * 1.5 + GRID_SIZE * 3 * ratio;
        positions.push({
          latitude: gridCenter.lat,
          longitude: lng,
          accuracy: 5,
          timestamp: Date.now() + i * 1000
        });
      }

      // 再垂直
      for (let i = 0; i < halfPoints; i++) {
        const ratio = i / (halfPoints - 1);
        const lat = gridCenter.lat - GRID_SIZE * 1.5 + GRID_SIZE * 3 * ratio;
        positions.push({
          latitude: lat,
          longitude: gridCenter.lng,
          accuracy: 5,
          timestamp: Date.now() + (halfPoints + i) * 1000
        });
      }
    }

    logger.info(`✅ 网格边界测试路线生成完成: ${positions.length}个位置点`);
    return positions;
  }

  /**
   * 模拟真实GPS精度变化
   */
  private static simulateAccuracy(
    ratio: number,
    pattern: 'good' | 'medium' | 'poor' | 'mixed'
  ): number {
    let base: number;
    let variance: number;

    switch (pattern) {
      case 'good':
        base = 5;
        variance = 10;
        break;
      case 'medium':
        base = 15;
        variance = 15;
        break;
      case 'poor':
        base = 30;
        variance = 20;
        break;
      case 'mixed':
        // 周期性变化：好 → 中 → 差 → 中 → 好
        const cycle = Math.sin(ratio * Math.PI * 4); // 4个周期
        base = 15 + cycle * 20; // 5-35米
        variance = 10;
        break;
    }

    // 随机波动
    const noise = (Math.random() - 0.5) * variance;

    return Math.max(5, Math.round(base + noise));
  }

  /**
   * 生成广州地铁测试路线（大学城南站→海傍站）
   * 广州地铁5号线从大学城南站到海傍站的路线
   */
  static generateGuangzhouMetroLine5(): GPSPosition[] {
    // 广州地铁5号线 - 大学城南站（番禺区广州大学城）
    const start = { lat: 22.8025, lng: 113.4189 };
    // 广州地铁5号线 - 海傍站（番禺区石碁镇）
    const end = { lat: 22.9433, lng: 113.4709 };

    const totalDistance = this.haversineDistance(start.lat, start.lng, end.lat, end.lng);

    // 大学城南站到海傍站约16.5公里
    // 为了控制在2-3分钟内完成，使用稀疏采样（约每150-200米一个点）
    const SAMPLE_INTERVAL_METERS = 180; // 180米一个采样点 = 16.5km / 180m ≈ 91个点
    const actualSamples = Math.ceil(totalDistance / SAMPLE_INTERVAL_METERS);

    logger.info(`🚇 生成广州地铁5号线路线: 大学城南站 → 海傍站`, {
      totalDistance: `${(totalDistance / 1000).toFixed(2)}km`,
      samples: actualSamples.toLocaleString(),
      metersPerSample: (totalDistance / actualSamples).toFixed(2)
    });

    const positions: GPSPosition[] = [];

    // 模拟地铁5号线的实际路径（从大学城南站到海傍站）
    for (let i = 0; i <= actualSamples; i++) {
      const ratio = i / actualSamples;

      // 基础线性插值
      let lat = start.lat + (end.lat - start.lat) * ratio;
      let lng = start.lng + (end.lng - start.lng) * ratio;

      // 添加地铁路线的自然曲线（模拟5号线的实际曲线变化）
      // 5号线大体呈弧形，从西南向东北方向延伸
      const curveFactor = Math.sin(ratio * Math.PI) * 0.0004;
      lng += curveFactor;

      // 模拟地铁GPS信号变化（经过地下站点和地面路段）
      let accuracy: number;
      if (ratio < 0.1 || ratio > 0.9) {
        // 起始和终点区域信号较好
        accuracy = 10 + Math.random() * 8;
      } else if ((ratio > 0.3 && ratio < 0.4) || (ratio > 0.6 && ratio < 0.7)) {
        // 换乘站和地下路段信号可能受影响
        accuracy = 20 + Math.random() * 15;
      } else {
        // 一般路段信号中等
        accuracy = 15 + Math.random() * 10;
      }

      positions.push({
        latitude: lat,
        longitude: lng,
        accuracy,
        timestamp: Date.now() + i * 1200 // 地铁运行速度，1.2秒一个采样点
      });
    }

    logger.info(`✅ 广州地铁5号线路线生成完成: ${positions.length}个位置点，覆盖${(totalDistance / 1000).toFixed(2)}公里`);
    return positions;
  }

  /**
   * 获取预定义的测试路线列表
   */
  static getTestRoutes(): Array<{
    id: string;
    name: string;
    description: string;
    generator: () => GPSPosition[];
    interval: number;
    expectedDuration: string;
  }> {
    return [
      {
        id: 'cityWalk',
        name: '城市漫游测试',
        description: '在北京市区随机游走，测试基本绘制功能',
        generator: () => this.generateCityWalkRoute({
          center: { lat: 39.9042, lng: 116.4074 }, // 北京天安门
          radius: 500,
          points: 50,
          pattern: 'random',
          accuracyPattern: 'good'
        }),
        interval: 2000,
        expectedDuration: '1分40秒'
      },
      {
        id: 'gridBoundary',
        name: '网格边界测试',
        description: '十字交叉穿越网格边界，测试网格切换',
        generator: () => this.generateGridBoundaryRoute({
          gridCenter: { lat: 39.9042, lng: 116.4074 },
          crossPattern: 'cross',
          points: 20
        }),
        interval: 2000,
        expectedDuration: '40秒'
      },
      {
        id: 'accuracyTest',
        name: '精度变化测试',
        description: '模拟精度从好到差的变化，测试绘制条件',
        generator: () => this.generateCityWalkRoute({
          center: { lat: 39.9042, lng: 116.4074 },
          radius: 300,
          points: 30,
          pattern: 'circle',
          accuracyPattern: 'mixed'
        }),
        interval: 3000,
        expectedDuration: '1分30秒'
      },
      {
        id: 'longDistance',
        name: '长距离测试（广州→北京）',
        description: '广州塔到北京天安门，测试长距离连续绘制',
        generator: () => this.generateGuangzhouToBeijing(undefined, 'good'), // 不抽样，覆盖每个像素点
        interval: 3000, // 3秒一个点，便于观察像素绘制
        expectedDuration: '约根据总距离自动计算（每11米一个点）'
      },
      {
        id: 'highSpeed',
        name: '高速移动测试',
        description: '快速移动场景，测试绘制性能',
        generator: () => this.generateCityWalkRoute({
          center: { lat: 39.9042, lng: 116.4074 },
          radius: 1000,
          points: 100,
          pattern: 'random',
          accuracyPattern: 'good'
        }),
        interval: 500,
        expectedDuration: '50秒'
      },
      {
        id: 'guangzhouMetro',
        name: '广州地铁5号线测试（大学城南站→海傍站）',
        description: '模拟广州地铁5号线从大学城南站到海傍站的完整路线，测试长距离GPS轨迹绘制和多地铁站覆盖',
        generator: () => this.generateGuangzhouMetroLine5(),
        interval: 1200, // 1.2秒一个点，模拟地铁运行速度
        expectedDuration: '约2-3分钟'
      },
      {
        id: 'customRoute',
        name: '自由测试（自定义路线）',
        description: '用户自定义起点和终点，生成两点之间的直线路径',
        generator: () => {
          // 从localStorage读取自定义坐标
          const startStr = localStorage.getItem('gps_custom_start');
          const endStr = localStorage.getItem('gps_custom_end');

          if (!startStr || !endStr) {
            logger.error('❌ 未找到自定义路线坐标');
            return [];
          }

          try {
            const start = JSON.parse(startStr);
            const end = JSON.parse(endStr);

            logger.info('🎯 加载自定义路线:', { start, end });

            return this.generateStraightRoute(start, end, undefined, 'good');
          } catch (error) {
            logger.error('❌ 解析自定义路线坐标失败:', error);
            return [];
          }
        },
        interval: 2000,
        expectedDuration: '自动计算'
      }
    ];
  }
}

// 导出到全局（仅开发环境）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).RouteGenerator = RouteGenerator;
  logger.info('🗺️ RouteGenerator 已加载到全局对象');
}
