const { db } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const turf = require('@turf/turf');
const h3 = require('h3-js');

/**
 * 行政区边界数据导入服务
 * 支持多种数据源：高德地图、国家统计局、OSM等
 */
class RegionDataImportService {
  constructor() {
    this.dataSources = {
      amap: '高德地图',
      nbs: '国家统计局', 
      osm: 'OpenStreetMap',
      modood: 'modood/administrative-divisions-of-china'
    };
  }

  /**
   * 导入中国行政区划数据
   * @param {string} source 数据源类型
   * @param {string} filePath 数据文件路径
   * @param {boolean} clearExisting 是否清空现有数据
   */
  async importChinaRegions(source = 'amap', filePath = null, clearExisting = false) {
    console.log(`🗺️ 开始导入中国行政区划数据 (${this.dataSources[source]})...`);
    
    try {
      let regionsData = [];
      
      switch (source) {
      case 'amap':
        regionsData = await this.importAmapData(filePath);
        break;
      case 'nbs':
        regionsData = await this.importNBSData(filePath);
        break;
      case 'osm':
        regionsData = await this.importOSMData(filePath);
        break;
      case 'modood':
        regionsData = await this.importModoodData(filePath);
        break;
      default:
        throw new Error(`不支持的数据源: ${source}`);
      }
      
      // 批量插入数据
      await this.batchInsertRegions(regionsData, clearExisting);
      
      console.log(`✅ 成功导入 ${regionsData.length} 个行政区划数据`);
      return regionsData.length;
      
    } catch (error) {
      console.error('❌ 导入行政区划数据失败:', error);
      throw error;
    }
  }

  /**
   * 导入高德地图数据
   * @param {string} filePath GeoJSON文件路径
   */
  async importAmapData(filePath) {
    if (!filePath) {
      // 使用默认的高德地图数据文件
      filePath = path.join(__dirname, '../../data/amap-china-regions.geojson');
    }
    
    console.log(`  📁 读取高德地图数据: ${filePath}`);
    const geoJsonData = await this.loadGeoJSONFile(filePath);
    
    const regions = [];
    
    for (const feature of geoJsonData.features) {
      const properties = feature.properties;
      const geometry = feature.geometry;
      
      // 解析高德地图的行政区划信息
      const region = {
        code: properties.adcode || properties.code,
        name: properties.name,
        level: this.mapAmapLevel(properties.level),
        parent_code: properties.parent_adcode || properties.parent_code,
        boundary: JSON.stringify(geometry),
        geometry: this.convertToPostGISGeometry(geometry),
        center_lat: properties.center ? properties.center.split(',')[1] : null,
        center_lng: properties.center ? properties.center.split(',')[0] : null,
        population: properties.population || null,
        timezone: 'Asia/Shanghai',
        is_active: true
      };
      
      regions.push(region);
    }
    
    return regions;
  }

  /**
   * 导入国家统计局数据
   * @param {string} filePath Shapefile转换后的GeoJSON文件路径
   */
  async importNBSData(filePath) {
    if (!filePath) {
      filePath = path.join(__dirname, '../../data/nbs-china-regions.geojson');
    }
    
    console.log(`  📁 读取国家统计局数据: ${filePath}`);
    const geoJsonData = await this.loadGeoJSONFile(filePath);
    
    const regions = [];
    
    for (const feature of geoJsonData.features) {
      const properties = feature.properties;
      const geometry = feature.geometry;
      
      const region = {
        code: properties.CODE || properties.code,
        name: properties.NAME || properties.name,
        level: this.mapNBSLevel(properties.LEVEL || properties.level),
        parent_code: properties.PARENT_CODE || properties.parent_code,
        boundary: JSON.stringify(geometry),
        geometry: this.convertToPostGISGeometry(geometry),
        center_lat: this.calculateCentroid(geometry)[1],
        center_lng: this.calculateCentroid(geometry)[0],
        population: properties.POPULATION || properties.population || null,
        timezone: 'Asia/Shanghai',
        is_active: true
      };
      
      regions.push(region);
    }
    
    return regions;
  }

  /**
   * 导入OSM数据
   * @param {string} filePath OSM GeoJSON文件路径
   */
  async importOSMData(filePath) {
    if (!filePath) {
      filePath = path.join(__dirname, '../../data/osm-china-regions.geojson');
    }
    
    console.log(`  📁 读取OSM数据: ${filePath}`);
    const geoJsonData = await this.loadGeoJSONFile(filePath);
    
    const regions = [];
    
    for (const feature of geoJsonData.features) {
      const properties = feature.properties;
      const geometry = feature.geometry;
      
      const region = {
        code: properties.iso_3166_2 || properties.code,
        name: properties.name || properties.NAME,
        level: this.mapOSMLevel(properties.admin_level),
        parent_code: properties.parent_code,
        boundary: JSON.stringify(geometry),
        geometry: this.convertToPostGISGeometry(geometry),
        center_lat: this.calculateCentroid(geometry)[1],
        center_lng: this.calculateCentroid(geometry)[0],
        population: properties.population || null,
        timezone: 'Asia/Shanghai',
        is_active: true
      };
      
      regions.push(region);
    }
    
    return regions;
  }

  /**
   * 导入modood行政区划数据
   * @param {string} filePath JSON文件路径
   */
  async importModoodData(filePath) {
    if (!filePath) {
      // 默认导入省级数据
      filePath = path.join(__dirname, '../../data/provinces.json');
    }
    
    console.log(`  📁 读取modood数据: ${filePath}`);
    const jsonData = await this.loadJSONFile(filePath);
    
    const regions = [];
    
    for (const item of jsonData) {
      // 根据文件名判断级别
      const fileName = path.basename(filePath, '.json');
      let level = 'city';
      let parentCode = null;
      
      switch (fileName) {
      case 'provinces':
        level = 'province';
        parentCode = null;
        break;
      case 'cities':
        level = 'city';
        parentCode = item.provinceCode;
        break;
      case 'areas':
        level = 'area';
        parentCode = item.cityCode;
        break;
      case 'streets':
        level = 'street';
        parentCode = item.areaCode;
        break;
      case 'villages':
        level = 'village';
        parentCode = item.streetCode;
        break;
      }
      
      const region = {
        code: item.code,
        name: item.name,
        level: level,
        parent_code: parentCode,
        boundary: null, // modood数据不包含边界信息
        geometry: null, // 需要从其他数据源获取边界
        center_lat: null, // 需要从其他数据源获取中心点
        center_lng: null,
        population: null,
        timezone: 'Asia/Shanghai',
        is_active: true
      };
      
      regions.push(region);
    }
    
    return regions;
  }

  /**
   * 加载JSON文件
   * @param {string} filePath 文件路径
   */
  async loadJSONFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️ 数据文件不存在: ${filePath}`);
        console.log('  💡 请将行政区划JSON文件放置在指定路径');
        return [];
      }
      throw error;
    }
  }

  /**
   * 加载GeoJSON文件
   * @param {string} filePath 文件路径
   */
  async loadGeoJSONFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️ 数据文件不存在: ${filePath}`);
        console.log('  💡 请将行政区划GeoJSON文件放置在指定路径');
        return { features: [] };
      }
      throw error;
    }
  }

  /**
   * 批量插入行政区划数据
   * @param {Array} regions 行政区划数据数组
   * @param {boolean} clearExisting 是否清空现有数据
   */
  async batchInsertRegions(regions, clearExisting = false) {
    if (regions.length === 0) {
      console.log('  ⚠️ 没有数据需要插入');
      return;
    }
    
    // 如果需要清空现有数据
    if (clearExisting) {
      console.log('  🗑️ 清空现有regions表数据...');
      await db('regions').del();
      console.log('  ✅ regions表已清空');
      
      console.log('  🗑️ 清空现有region_codes表数据...');
      await db('region_codes').del();
      console.log('  ✅ region_codes表已清空');
    }
    
    console.log(`  💾 批量插入 ${regions.length} 条行政区划数据...`);
    
    // 分批插入，避免单次插入数据过多
    const batchSize = 100;
    for (let i = 0; i < regions.length; i += batchSize) {
      const batch = regions.slice(i, i + batchSize);
      
      try {
        await db('regions').insert(batch);
        console.log(`  ✅ 已插入 ${Math.min(i + batchSize, regions.length)}/${regions.length} 条数据`);
      } catch (error) {
        console.error(`  ❌ 插入第 ${i + 1}-${Math.min(i + batchSize, regions.length)} 条数据失败:`, error.message);
        // 继续处理下一批
      }
    }
    
    // 同时更新region_codes表
    await this.updateRegionCodes(regions);
  }

  /**
   * 更新region_codes表
   * @param {Array} regions 行政区划数据数组
   */
  async updateRegionCodes(regions) {
    console.log('  📝 更新region_codes表...');
    
    const codesData = regions.map(region => ({
      code: region.code,
      name: region.name,
      level: region.level,
      parent_code: region.parent_code,
      full_name: this.buildFullName(region, regions),
      is_active: region.is_active
    }));
    
    // 清空现有数据
    await db('region_codes').del();
    
    // 批量插入
    await db('region_codes').insert(codesData);
    
    console.log(`  ✅ 已更新 ${codesData.length} 条行政区划编码数据`);
  }

  /**
   * 构建完整名称路径
   * @param {Object} region 当前区域
   * @param {Array} allRegions 所有区域数据
   */
  buildFullName(region, allRegions) {
    const nameParts = [region.name];
    let currentRegion = region;
    
    while (currentRegion.parent_code) {
      const parent = allRegions.find(r => r.code === currentRegion.parent_code);
      if (parent) {
        nameParts.unshift(parent.name);
        currentRegion = parent;
      } else {
        break;
      }
    }
    
    return nameParts.join(' > ');
  }

  /**
   * 映射高德地图级别
   * @param {string} level 高德地图级别
   */
  mapAmapLevel(level) {
    const levelMap = {
      'country': 'country',
      'province': 'province', 
      'city': 'city',
      'district': 'city',
      'street': 'city'
    };
    return levelMap[level] || 'city';
  }

  /**
   * 映射国家统计局级别
   * @param {string} level 国家统计局级别
   */
  mapNBSLevel(level) {
    const levelMap = {
      '1': 'country',
      '2': 'province',
      '3': 'city',
      '4': 'city'
    };
    return levelMap[level] || 'city';
  }

  /**
   * 映射OSM级别
   * @param {string} adminLevel OSM管理级别
   */
  mapOSMLevel(adminLevel) {
    const levelMap = {
      '2': 'country',
      '4': 'province',
      '6': 'city',
      '8': 'city'
    };
    return levelMap[adminLevel] || 'city';
  }

  /**
   * 转换为PostGIS几何格式
   * @param {Object} geometry GeoJSON几何对象
   */
  convertToPostGISGeometry(geometry) {
    // 将GeoJSON几何转换为PostGIS WKT格式
    const wkt = this.geoJSONToWKT(geometry);
    return db.raw('ST_GeomFromText(?, 4326)', [wkt]);
  }

  /**
   * GeoJSON转WKT
   * @param {Object} geometry GeoJSON几何对象
   */
  geoJSONToWKT(geometry) {
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      const wktCoords = coords.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
      return `POLYGON((${wktCoords}))`;
    } else if (geometry.type === 'MultiPolygon') {
      const polygons = geometry.coordinates.map(polygon => {
        const coords = polygon[0];
        const wktCoords = coords.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
        return `(${wktCoords})`;
      });
      return `MULTIPOLYGON(${polygons.join(', ')})`;
    }
    return null;
  }

  /**
   * 计算几何中心点
   * @param {Object} geometry GeoJSON几何对象
   */
  calculateCentroid(geometry) {
    try {
      const centroid = turf.centroid(geometry);
      return centroid.geometry.coordinates;
    } catch (error) {
      console.warn('  ⚠️ 计算中心点失败:', error.message);
      return [0, 0];
    }
  }

  /**
   * 验证导入的数据
   */
  async validateImportedData() {
    console.log('🔍 验证导入的行政区划数据...');
    
    try {
      const stats = await db('regions')
        .select('level')
        .count('* as count')
        .groupBy('level');
      
      console.log('📊 行政区划数据统计:');
      stats.forEach(stat => {
        console.log(`  ${stat.level}: ${stat.count} 个`);
      });
      
      const totalCount = await db('regions').count('* as count').first();
      console.log(`  总计: ${totalCount.count} 个行政区划`);
      
      return stats;
      
    } catch (error) {
      console.error('❌ 验证数据失败:', error);
      throw error;
    }
  }
}

module.exports = RegionDataImportService;
