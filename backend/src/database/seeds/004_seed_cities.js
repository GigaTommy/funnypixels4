const path = require('path');
const fs = require('fs');

function parseCitiesData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    const cities = [];
    let processedCount = 0;
    
    for (const line of lines) {
      if (line.trim() === '' || processedCount >= 100) break; // 限制处理数量
      
      const parts = line.split('\t');
      if (parts.length < 19) continue;
      
      const name = parts[1];
      const latitude = parts[4];
      const longitude = parts[5];
      const population = parseInt(parts[14]) || 0;
      const countryCode = parts[8];
      
      if (population < 100000) continue; // 只处理人口超过10万的城市
      
      const code = generateCityCode(name, countryCode);
      const flag = getCountryFlag(countryCode);
      const color = getRandomColor();
      
      cities.push({
        name: name,
        country: getCountryName(countryCode),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        population: population,
        timezone: getTimezone(countryCode)
      });
      
      processedCount++;
    }
    
    console.log(`处理了 ${cities.length} 个城市`);
    return cities;
    
  } catch (error) {
    console.error('读取城市数据文件失败:', error);
    return [];
  }
}

function generateCityCode(name, countryCode) {
  // 生成城市代码：城市名拼音 + 国家代码
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${cleanName}_${countryCode.toLowerCase()}`;
}

function getCountryName(countryCode) {
  const countries = {
    'CN': '中国',
    'US': '美国',
    'JP': '日本',
    'KR': '韩国',
    'IN': '印度',
    'BR': '巴西',
    'RU': '俄罗斯',
    'DE': '德国',
    'FR': '法国',
    'GB': '英国'
  };
  return countries[countryCode] || '未知';
}

function getCountryFlag(countryCode) {
  const flags = {
    'CN': '🇨🇳',
    'US': '🇺🇸',
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'IN': '🇮🇳',
    'BR': '🇧🇷',
    'RU': '🇷🇺',
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'GB': '🇬🇧'
  };
  return flags[countryCode] || '🏳️';
}

function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getTimezone(countryCode) {
  const timezones = {
    'CN': 'Asia/Shanghai',
    'US': 'America/New_York',
    'JP': 'Asia/Tokyo',
    'KR': 'Asia/Seoul',
    'IN': 'Asia/Kolkata',
    'BR': 'America/Sao_Paulo',
    'RU': 'Europe/Moscow',
    'DE': 'Europe/Berlin',
    'FR': 'Europe/Paris',
    'GB': 'Europe/London'
  };
  return timezones[countryCode] || 'UTC';
}

exports.seed = async function(knex) {
  console.log('开始处理城市数据...');
  
  // 清空地区表
  await knex('regions').del();
  
  // 读取城市数据文件 - 尝试多个可能的路径
  const possiblePaths = [
    path.join(__dirname, '../../../database/seeds/cities15000.txt'), // backend/database/seeds/
    path.join(__dirname, '../../../../database/seeds/cities15000.txt'), // 项目根目录
    path.join(process.cwd(), 'database/seeds/cities15000.txt'),
    '/app/database/seeds/cities15000.txt'
  ];
  
  let citiesFilePath = null;
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      citiesFilePath = filePath;
      console.log('找到城市数据文件:', filePath);
      break;
    }
  }
  
  let cities = [];
  if (citiesFilePath) {
    cities = parseCitiesData(citiesFilePath);
  } else {
    console.log('未找到城市数据文件，尝试的路径:', possiblePaths);
  }
  
  if (cities.length === 0) {
    console.log('没有找到有效的城市数据，使用默认数据');
    // 插入默认的地区数据
    const defaultCities = [
      {
        name: '北京',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
        population: 21540000,
        timezone: 'Asia/Shanghai'
      },
      {
        name: '上海',
        country: '中国',
        latitude: 31.2304,
        longitude: 121.4737,
        population: 24280000,
        timezone: 'Asia/Shanghai'
      },
      {
        name: '广州',
        country: '中国',
        latitude: 23.1291,
        longitude: 113.2644,
        population: 15300000,
        timezone: 'Asia/Shanghai'
      },
      {
        name: '深圳',
        country: '中国',
        latitude: 22.5431,
        longitude: 114.0579,
        population: 17560000,
        timezone: 'Asia/Shanghai'
      },
      {
        name: '杭州',
        country: '中国',
        latitude: 30.2741,
        longitude: 120.1551,
        population: 11940000,
        timezone: 'Asia/Shanghai'
      }
    ];
    
    await knex('regions').insert(defaultCities);
    console.log('✅ 默认城市数据插入成功，共', defaultCities.length, '个城市');
    return;
  }
  
  // 分批插入数据，避免一次性插入过多数据
  const batchSize = 100;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    await knex('regions').insert(batch);
    console.log(`已插入 ${Math.min(i + batchSize, cities.length)} / ${cities.length} 个城市`);
  }
  
  console.log('城市数据插入完成！');
};
