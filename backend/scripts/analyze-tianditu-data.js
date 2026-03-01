#!/usr/bin/env node

/**
 * 分析天地图行政区划数据的适用性
 */

const fs = require('fs');
const path = require('path');

async function analyzeTiandituData() {
  console.log('🗺️ 分析天地图行政区划数据适用性...\n');
  
  const dataFiles = [
    { name: 'china_provice2', level: '省级', file: 'china_provice2.geojson' },
    { name: 'china_city2', level: '市级', file: 'china_city2.geojson' },
    { name: 'china_district2', level: '县级', file: 'china_district2.geojson' }
  ];
  
  const dataDir = path.join(__dirname, '../data');
  
  for (const dataFile of dataFiles) {
    console.log(`📊 分析 ${dataFile.level}数据 (${dataFile.name}):`);
    
    const filePath = path.join(dataDir, dataFile.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ 文件不存在: ${dataFile.file}`);
      console.log(`  💡 请将 ${dataFile.file} 下载到 backend/data/ 目录`);
      continue;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 分析数据结构
      console.log(`  ✅ 文件存在: ${dataFile.file}`);
      console.log(`  📋 数据类型: ${data.type}`);
      console.log(`  📊 要素数量: ${data.features ? data.features.length : '未知'}`);
      
      if (data.features && data.features.length > 0) {
        const firstFeature = data.features[0];
        console.log(`  🏗️ 要素结构:`);
        console.log(`    - 类型: ${firstFeature.type}`);
        console.log(`    - 几何类型: ${firstFeature.geometry ? firstFeature.geometry.type : '未知'}`);
        console.log(`    - 属性字段: ${firstFeature.properties ? Object.keys(firstFeature.properties).join(', ') : '未知'}`);
        
        // 检查坐标系
        if (data.crs) {
          console.log(`  🌍 坐标系: ${JSON.stringify(data.crs)}`);
        } else {
          console.log(`  🌍 坐标系: 未指定 (通常为WGS84)`);
        }
        
        // 检查边界数据质量
        if (firstFeature.geometry && firstFeature.geometry.coordinates) {
          const coords = firstFeature.geometry.coordinates;
          console.log(`  📐 几何数据:`);
          console.log(`    - 坐标维度: ${coords[0] ? coords[0][0].length : '未知'}`);
          console.log(`    - 坐标示例: [${coords[0] ? coords[0][0][0].join(', ') : '未知'}]`);
        }
        
        // 检查属性数据
        if (firstFeature.properties) {
          console.log(`  🏷️ 属性数据示例:`);
          Object.entries(firstFeature.properties).forEach(([key, value]) => {
            console.log(`    - ${key}: ${value}`);
          });
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ 解析失败: ${error.message}`);
      console.log('');
    }
  }
  
  // 分析数据适用性
  console.log('🎯 数据适用性分析:');
  console.log('');
  
  console.log('✅ 优势:');
  console.log('  - 数据来源权威: 国家地理信息局官方数据');
  console.log('  - 数据更新及时: 根据民政部最新调整更新');
  console.log('  - 格式标准: GeoJSON格式，便于处理');
  console.log('  - 层级完整: 省、市、县三级数据齐全');
  console.log('');
  
  console.log('⚠️ 需要注意的问题:');
  console.log('  - 坐标系确认: 需要确认是否为WGS84坐标系');
  console.log('  - 数据精度: 需要验证边界数据的精度是否足够');
  console.log('  - 属性字段: 需要确认是否包含行政区划代码和名称');
  console.log('  - 数据量: 县级数据量可能很大，需要考虑性能');
  console.log('');
  
  console.log('🔧 技术实现建议:');
  console.log('  1. 使用PostGIS的ST_Contains函数进行精确匹配');
  console.log('  2. 建立空间索引提高查询性能');
  console.log('  3. 实现多级匹配: 先匹配县，再匹配市，最后匹配省');
  console.log('  4. 缓存匹配结果减少重复计算');
  console.log('  5. 处理边界情况: 像素点在边界上的归属问题');
  console.log('');
  
  console.log('📋 下一步行动:');
  console.log('  1. 下载三份GeoJSON数据文件');
  console.log('  2. 导入到PostgreSQL数据库');
  console.log('  3. 建立空间索引');
  console.log('  4. 测试像素坐标匹配精度');
  console.log('  5. 优化查询性能');
}

analyzeTiandituData().catch(console.error);
