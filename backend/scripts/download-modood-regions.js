#!/usr/bin/env node

/**
 * 从 modood/administrative-divisions-of-china 获取中国行政区划数据
 * 数据源：https://github.com/modood/administrative-divisions-of-china
 * 基于国家统计局官方数据，包含五级行政区划
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// 数据源配置 - 基于 modood/administrative-divisions-of-china
const DATA_SOURCES = {
  provinces: {
    name: '省级行政区划数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/provinces.json',
    description: '省级（省份、直辖市、自治区）数据，包含GB/T 2260编码'
  },
  cities: {
    name: '地级行政区划数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/cities.json',
    description: '地级（城市）数据，包含省级归属关系'
  },
  areas: {
    name: '县级行政区划数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/areas.json',
    description: '县级（区县）数据，包含地级归属关系'
  },
  streets: {
    name: '乡级行政区划数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/streets.json',
    description: '乡级（乡镇、街道）数据，包含县级归属关系'
  },
  villages: {
    name: '村级行政区划数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/villages.json',
    description: '村级（村委会、居委会）数据，包含乡级归属关系'
  },
  // 联动数据
  pc: {
    name: '省份城市二级联动数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pc.json',
    description: '省份-城市二级联动数据'
  },
  pca: {
    name: '省份城市区县三级联动数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca.json',
    description: '省份-城市-区县三级联动数据'
  },
  pcas: {
    name: '省份城市区县乡镇四级联动数据',
    url: 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pcas.json',
    description: '省份-城市-区县-乡镇四级联动数据'
  }
};

/**
 * 下载文件
 * @param {string} url 下载URL
 * @param {string} filePath 保存路径
 */
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 正在下载: ${url}`);
    
    const file = require('fs').createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ 下载完成: ${filePath}`);
        resolve();
      });
      
      file.on('error', (err) => {
        require('fs').unlink(filePath, () => {}); // 删除部分下载的文件
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 验证下载的JSON数据
 * @param {string} filePath 文件路径
 */
async function validateJsonData(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      console.log(`📊 数据条数: ${data.length}`);
      if (data.length > 0) {
        console.log(`📋 示例数据: ${JSON.stringify(data[0], null, 2)}`);
      }
    } else if (typeof data === 'object') {
      console.log(`📊 数据对象键: ${Object.keys(data).join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ JSON验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 创建数据合并脚本
 */
async function createDataMerger() {
  const mergerScript = `#!/usr/bin/env node

/**
 * 合并modood行政区划数据为GeoJSON格式
 * 用于导入到PostGIS数据库
 */

const fs = require('fs').promises;
const path = require('path');

async function mergeRegionData() {
  console.log('🔄 开始合并行政区划数据...');
  
  const dataDir = path.join(__dirname, '../data');
  const outputPath = path.join(dataDir, 'china-regions-complete.geojson');
  
  try {
    // 读取各级数据
    const provinces = JSON.parse(await fs.readFile(path.join(dataDir, 'provinces.json'), 'utf8'));
    const cities = JSON.parse(await fs.readFile(path.join(dataDir, 'cities.json'), 'utf8'));
    const areas = JSON.parse(await fs.readFile(path.join(dataDir, 'areas.json'), 'utf8'));
    
    console.log(\`📊 数据统计:\`);
    console.log(\`   省级: \${provinces.length} 个\`);
    console.log(\`   地级: \${cities.length} 个\`);
    console.log(\`   县级: \${areas.length} 个\`);
    
    // 创建GeoJSON结构
    const geojson = {
      type: "FeatureCollection",
      features: []
    };
    
    // 处理省级数据
    provinces.forEach(province => {
      geojson.features.push({
        type: "Feature",
        properties: {
          adcode: province.code,
          name: province.name,
          level: "province",
          parent_adcode: null,
          center: null, // 需要从其他数据源获取
          population: null
        },
        geometry: {
          type: "Polygon",
          coordinates: [[]] // 需要从其他数据源获取边界数据
        }
      });
    });
    
    // 处理地级数据
    cities.forEach(city => {
      geojson.features.push({
        type: "Feature",
        properties: {
          adcode: city.code,
          name: city.name,
          level: "city",
          parent_adcode: city.provinceCode,
          center: null,
          population: null
        },
        geometry: {
          type: "Polygon",
          coordinates: [[]]
        }
      });
    });
    
    // 处理县级数据
    areas.forEach(area => {
      geojson.features.push({
        type: "Feature",
        properties: {
          adcode: area.code,
          name: area.name,
          level: "area",
          parent_adcode: area.cityCode,
          center: null,
          population: null
        },
        geometry: {
          type: "Polygon",
          coordinates: [[]]
        }
      });
    });
    
    // 保存合并后的数据
    await fs.writeFile(outputPath, JSON.stringify(geojson, null, 2));
    console.log(\`✅ 合并完成: \${outputPath}\`);
    console.log(\`📊 总特征数: \${geojson.features.length}\`);
    
  } catch (error) {
    console.error(\`❌ 合并失败: \${error.message}\`);
  }
}

// 运行合并
mergeRegionData().catch(console.error);
`;

  const scriptPath = path.join(__dirname, 'merge-modood-data.js');
  await fs.writeFile(scriptPath, mergerScript);
  console.log(`✅ 数据合并脚本已创建: ${scriptPath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🗺️ 开始从 modood/administrative-divisions-of-china 下载中国行政区划数据...\n');
  console.log('📚 数据源信息:');
  console.log('   - 基于国家统计局官方数据');
  console.log('   - 包含五级行政区划（省、市、县、乡、村）');
  console.log('   - 使用GB/T 2260编码标准');
  console.log('   - 数据更新至2023年\n');
  
  // 确保数据目录存在
  const dataDir = path.join(__dirname, '../data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // 目录可能已存在
  }
  
  let successCount = 0;
  let totalCount = Object.keys(DATA_SOURCES).length;
  
  // 下载每个数据源
  for (const [key, source] of Object.entries(DATA_SOURCES)) {
    try {
      console.log(`\n📦 处理数据源: ${source.name}`);
      console.log(`📝 描述: ${source.description}`);
      
      const fileName = `${key}.json`;
      const filePath = path.join(dataDir, fileName);
      
      await downloadFile(source.url, filePath);
      
      // 验证下载的数据
      const isValid = await validateJsonData(filePath);
      if (isValid) {
        successCount++;
      }
      
    } catch (error) {
      console.log(`❌ 下载失败: ${error.message}`);
    }
  }
  
  // 创建数据合并脚本
  if (successCount > 0) {
    await createDataMerger();
  }
  
  console.log(`\n✅ 数据下载完成！成功: ${successCount}/${totalCount}`);
  
  if (successCount > 0) {
    console.log('\n💡 接下来可以运行以下命令:');
    console.log('   1. 合并数据: node scripts/merge-modood-data.js');
    console.log('   2. 导入数据: node scripts/import-region-data.js modood ./data/china-regions-complete.geojson');
  }
}

// 运行主函数
main().catch(console.error);
