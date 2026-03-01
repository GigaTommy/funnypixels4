#!/usr/bin/env node

/**
 * 导入天地图行政区划数据到PostgreSQL
 */

const { db } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function importTiandituData() {
  console.log('🗺️ 导入天地图行政区划数据...\n');
  
  try {
    // 1. 创建天地图数据表
    console.log('1️⃣ 创建天地图数据表...');
    
    await db.raw(`
      CREATE TABLE IF NOT EXISTS tianditu_regions (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        gb_code VARCHAR(20) NOT NULL,
        level VARCHAR(20) NOT NULL,
        geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建空间索引
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_tianditu_regions_geometry 
      ON tianditu_regions USING GIST (geometry)
    `);
    
    // 创建其他索引
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_tianditu_regions_level 
      ON tianditu_regions (level)
    `);
    
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_tianditu_regions_gb_code 
      ON tianditu_regions (gb_code)
    `);
    
    console.log('✅ 天地图数据表创建完成');
    
    // 2. 导入省级数据
    console.log('2️⃣ 导入省级数据...');
    const provinceDataPath = path.join(__dirname, '../data/china_provice2.geojson');
    
    if (fs.existsSync(provinceDataPath)) {
      const provinceData = JSON.parse(fs.readFileSync(provinceDataPath, 'utf8'));
      console.log(`📊 省级数据: ${provinceData.features.length} 个省份`);
      
      // 清空现有省级数据
      await db('tianditu_regions').where('level', 'province').del();
      
      // 批量插入省级数据
      const provinceInserts = provinceData.features.map(feature => ({
        name: feature.properties.name,
        gb_code: feature.properties.gb,
        level: 'province',
        geometry: db.raw(`ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)`, [JSON.stringify(feature.geometry)])
      }));
      
      await db('tianditu_regions').insert(provinceInserts);
      console.log('✅ 省级数据导入完成');
    } else {
      console.log('❌ 省级数据文件不存在');
    }
    
    // 3. 导入市级数据
    console.log('3️⃣ 导入市级数据...');
    const cityDataPath = path.join(__dirname, '../data/china_city2.geojson');
    
    if (fs.existsSync(cityDataPath)) {
      const cityData = JSON.parse(fs.readFileSync(cityDataPath, 'utf8'));
      console.log(`📊 市级数据: ${cityData.features.length} 个城市`);
      
      // 清空现有市级数据
      await db('tianditu_regions').where('level', 'city').del();
      
      // 批量插入市级数据
      const cityInserts = cityData.features.map(feature => ({
        name: feature.properties.name,
        gb_code: feature.properties.gb,
        level: 'city',
        geometry: db.raw(`ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)`, [JSON.stringify(feature.geometry)])
      }));
      
      // 分批插入，避免内存问题
      const batchSize = 100;
      for (let i = 0; i < cityInserts.length; i += batchSize) {
        const batch = cityInserts.slice(i, i + batchSize);
        await db('tianditu_regions').insert(batch);
        console.log(`  ✅ 已导入 ${Math.min(i + batchSize, cityInserts.length)}/${cityInserts.length} 个城市`);
      }
      
      console.log('✅ 市级数据导入完成');
    } else {
      console.log('❌ 市级数据文件不存在');
    }
    
    // 4. 导入县级数据
    console.log('4️⃣ 导入县级数据...');
    const districtDataPath = path.join(__dirname, '../data/china_district2.geojson');
    
    if (fs.existsSync(districtDataPath)) {
      const districtData = JSON.parse(fs.readFileSync(districtDataPath, 'utf8'));
      console.log(`📊 县级数据: ${districtData.features.length} 个县区`);
      
      // 清空现有县级数据
      await db('tianditu_regions').where('level', 'district').del();
      
      // 批量插入县级数据
      const districtInserts = districtData.features.map(feature => ({
        name: feature.properties.name,
        gb_code: feature.properties.gb,
        level: 'district',
        geometry: db.raw(`ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)`, [JSON.stringify(feature.geometry)])
      }));
      
      // 分批插入
      const batchSize = 50; // 县级数据量大，减小批次
      for (let i = 0; i < districtInserts.length; i += batchSize) {
        const batch = districtInserts.slice(i, i + batchSize);
        await db('tianditu_regions').insert(batch);
        console.log(`  ✅ 已导入 ${Math.min(i + batchSize, districtInserts.length)}/${districtInserts.length} 个县区`);
      }
      
      console.log('✅ 县级数据导入完成');
    } else {
      console.log('❌ 县级数据文件不存在');
    }
    
    // 5. 统计导入结果
    console.log('5️⃣ 统计导入结果...');
    const stats = await db('tianditu_regions')
      .select('level')
      .count('* as count')
      .groupBy('level');
    
    console.log('📊 导入统计:');
    stats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat.count} 条记录`);
    });
    
    console.log('\n🎉 天地图数据导入完成！');
    
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    process.exit(0);
  }
}

importTiandituData();
