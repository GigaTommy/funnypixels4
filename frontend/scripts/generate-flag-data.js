import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从 flag-icons 库获取所有国旗数据
const flagIconsPath = path.join(__dirname, '../node_modules/flag-icons');
const flagsPath = path.join(flagIconsPath, 'flags', '4x3'); // 使用 4x3 比例的国旗
const countryJsonPath = path.join(flagIconsPath, 'country.json');

// 读取国家数据
let countryData = {};
try {
  const countryJson = fs.readFileSync(countryJsonPath, 'utf8');
  countryData = JSON.parse(countryJson);
} catch (error) {
  console.error('无法读取 country.json:', error);
}

// 获取所有国旗文件
const flagFiles = fs.readdirSync(flagsPath).filter(file => file.endsWith('.svg'));

// 生成国旗数据
const flagData = {};

flagFiles.forEach(file => {
  const countryCode = file.replace('.svg', '').toLowerCase();
  const countryName = countryData[countryCode] || countryCode.toUpperCase();
  
  // 读取 SVG 内容
  const svgPath = path.join(flagsPath, file);
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // 提取 SVG 的 viewBox 和路径数据
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 640 480';
  
  // 获取 SVG 内容（去除 XML 声明和 doctype）
  const cleanSvgContent = svgContent
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .trim();
  
  flagData[countryCode] = {
    key: `flag_${countryCode}`,
    name: `${countryName}国旗`,
    description: `${countryName}国旗图案`,
    country_code: countryCode,
    country_name: countryName,
    category: 'country',
    tags: ['flag', 'country', '国旗'],
    is_public: true,
    created_by: null,
    download_count: 0,
    rating: 0,
    review_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    width: 32,
    height: 24,
    encoding: 'svg',
    payload: cleanSvgContent,
    verified: true,
    unicode_char: getCountryEmoji(countryCode),
    render_type: 'svg',
    deleted_at: null,
    viewBox: viewBox,
    svg_content: cleanSvgContent
  };
});

// 国家代码到 emoji 的映射
function getCountryEmoji(countryCode) {
  const emojiMap = {
    'ad': '🇦🇩', 'ae': '🇦🇪', 'af': '🇦🇫', 'ag': '🇦🇬', 'ai': '🇦🇮', 'al': '🇦🇱', 'am': '🇦🇲', 'ao': '🇦🇴',
    'aq': '🇦🇶', 'ar': '🇦🇷', 'as': '🇦🇸', 'at': '🇦🇹', 'au': '🇦🇺', 'aw': '🇦🇼', 'ax': '🇦🇽', 'az': '🇦🇿',
    'ba': '🇧🇦', 'bb': '🇧🇧', 'bd': '🇧🇩', 'be': '🇧🇪', 'bf': '🇧🇫', 'bg': '🇧🇬', 'bh': '🇧🇭', 'bi': '🇧🇮',
    'bj': '🇧🇯', 'bl': '🇧🇱', 'bm': '🇧🇲', 'bn': '🇧🇳', 'bo': '🇧🇴', 'bq': '🇧🇶', 'br': '🇧🇷', 'bs': '🇧🇸',
    'bt': '🇧🇹', 'bv': '🇧🇻', 'bw': '🇧🇼', 'by': '🇧🇾', 'bz': '🇧🇿', 'ca': '🇨🇦', 'cc': '🇨🇨', 'cd': '🇨🇩',
    'cf': '🇨🇫', 'cg': '🇨🇬', 'ch': '🇨🇭', 'ci': '🇨🇮', 'ck': '🇨🇰', 'cl': '🇨🇱', 'cm': '🇨🇲', 'cn': '🇨🇳',
    'co': '🇨🇴', 'cr': '🇨🇷', 'cu': '🇨🇺', 'cv': '🇨🇻', 'cw': '🇨🇼', 'cx': '🇨🇽', 'cy': '🇨🇾', 'cz': '🇨🇿',
    'de': '🇩🇪', 'dj': '🇩🇯', 'dk': '🇩🇰', 'dm': '🇩🇲', 'do': '🇩🇴', 'dz': '🇩🇿', 'ec': '🇪🇨', 'ee': '🇪🇪',
    'eg': '🇪🇬', 'eh': '🇪🇭', 'er': '🇪🇷', 'es': '🇪🇸', 'et': '🇪🇹', 'fi': '🇫🇮', 'fj': '🇫🇯', 'fk': '🇫🇰',
    'fm': '🇫🇲', 'fo': '🇫🇴', 'fr': '🇫🇷', 'ga': '🇬🇦', 'gb': '🇬🇧', 'gd': '🇬🇩', 'ge': '🇬🇪', 'gf': '🇬🇫',
    'gg': '🇬🇬', 'gh': '🇬🇭', 'gi': '🇬🇮', 'gl': '🇬🇱', 'gm': '🇬🇲', 'gn': '🇬🇳', 'gp': '🇬🇵', 'gq': '🇬🇶',
    'gr': '🇬🇷', 'gs': '🇬🇸', 'gt': '🇬🇹', 'gu': '🇬🇺', 'gw': '🇬🇼', 'gy': '🇬🇾', 'hk': '🇭🇰', 'hm': '🇭🇲',
    'hn': '🇭🇳', 'hr': '🇭🇷', 'ht': '🇭🇹', 'hu': '🇭🇺', 'id': '🇮🇩', 'ie': '🇮🇪', 'il': '🇮🇱', 'im': '🇮🇲',
    'in': '🇮🇳', 'io': '🇮🇴', 'iq': '🇮🇶', 'ir': '🇮🇷', 'is': '🇮🇸', 'it': '🇮🇹', 'je': '🇯🇪', 'jm': '🇯🇲',
    'jo': '🇯🇴', 'jp': '🇯🇵', 'ke': '🇰🇪', 'kg': '🇰🇬', 'kh': '🇰🇭', 'ki': '🇰🇮', 'km': '🇰🇲', 'kn': '🇰🇳',
    'kp': '🇰🇵', 'kr': '🇰🇷', 'kw': '🇰🇼', 'ky': '🇰🇾', 'kz': '🇰🇿', 'la': '🇱🇦', 'lb': '🇱🇧', 'lc': '🇱🇨',
    'li': '🇱🇮', 'lk': '🇱🇰', 'lr': '🇱🇷', 'ls': '🇱🇸', 'lt': '🇱🇹', 'lu': '🇱🇺', 'lv': '🇱🇻', 'ly': '🇱🇾',
    'ma': '🇲🇦', 'mc': '🇲🇨', 'md': '🇲🇩', 'me': '🇲🇪', 'mf': '🇲🇫', 'mg': '🇲🇬', 'mh': '🇲🇭', 'mk': '🇲🇰',
    'ml': '🇲🇱', 'mm': '🇲🇲', 'mn': '🇲🇳', 'mo': '🇲🇴', 'mp': '🇲🇵', 'mq': '🇲🇶', 'mr': '🇲🇷', 'ms': '🇲🇸',
    'mt': '🇲🇹', 'mu': '🇲🇺', 'mv': '🇲🇻', 'mw': '🇲🇼', 'mx': '🇲🇽', 'my': '🇲🇾', 'mz': '🇲🇿', 'na': '🇳🇦',
    'nc': '🇳🇨', 'ne': '🇳🇪', 'nf': '🇳🇫', 'ng': '🇳🇬', 'ni': '🇳🇮', 'nl': '🇳🇱', 'no': '🇳🇴', 'np': '🇳🇵',
    'nr': '🇳🇷', 'nu': '🇳🇺', 'nz': '🇳🇿', 'om': '🇴🇲', 'pa': '🇵🇦', 'pe': '🇵🇪', 'pf': '🇵🇫', 'pg': '🇵🇬',
    'ph': '🇵🇭', 'pk': '🇵🇰', 'pl': '🇵🇱', 'pm': '🇵🇲', 'pn': '🇵🇳', 'pr': '🇵🇷', 'ps': '🇵🇸', 'pt': '🇵🇹',
    'pw': '🇵🇼', 'py': '🇵🇾', 'qa': '🇶🇦', 're': '🇷🇪', 'ro': '🇷🇴', 'rs': '🇷🇸', 'ru': '🇷🇺', 'rw': '🇷🇼',
    'sa': '🇸🇦', 'sb': '🇸🇧', 'sc': '🇸🇨', 'sd': '🇸🇩', 'se': '🇸🇪', 'sg': '🇸🇬', 'sh': '🇸🇭', 'si': '🇸🇮',
    'sj': '🇸🇯', 'sk': '🇸🇰', 'sl': '🇸🇱', 'sm': '🇸🇲', 'sn': '🇸🇳', 'so': '🇸🇴', 'sr': '🇸🇷', 'ss': '🇸🇸',
    'st': '🇸🇹', 'sv': '🇸🇻', 'sx': '🇸🇽', 'sy': '🇸🇾', 'sz': '🇸🇿', 'tc': '🇹🇨', 'td': '🇹🇩', 'tf': '🇹🇫',
    'tg': '🇹🇬', 'th': '🇹🇭', 'tj': '🇹🇯', 'tk': '🇹🇰', 'tl': '🇹🇱', 'tm': '🇹🇲', 'tn': '🇹🇳', 'to': '🇹🇴',
    'tr': '🇹🇷', 'tt': '🇹🇹', 'tv': '🇹🇻', 'tw': '🇹🇼', 'tz': '🇹🇿', 'ua': '🇺🇦', 'ug': '🇺🇬', 'um': '🇺🇲',
    'us': '🇺🇸', 'uy': '🇺🇾', 'uz': '🇺🇿', 'va': '🇻🇦', 'vc': '🇻🇨', 've': '🇻🇪', 'vg': '🇻🇬', 'vi': '🇻🇮',
    'vn': '🇻🇳', 'vu': '🇻🇺', 'wf': '🇼🇫', 'ws': '🇼🇸', 'ye': '🇾🇪', 'yt': '🇾🇹', 'za': '🇿🇦', 'zm': '🇿🇲',
    'zw': '🇿🇼'
  };
  
  return emojiMap[countryCode] || '🏳️';
}

// 生成输出文件
const outputPath = path.join(__dirname, '../src/data/country-flags.json');
const outputDir = path.dirname(outputPath);

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 写入文件
fs.writeFileSync(outputPath, JSON.stringify(flagData, null, 2), 'utf8');

console.log(`✅ 成功生成国旗数据文件: ${outputPath}`);
console.log(`📊 总共处理了 ${Object.keys(flagData).length} 个国家的国旗`);
console.log(`🌍 包含的国家: ${Object.keys(flagData).slice(0, 10).join(', ')}...`);

// 生成简化的映射文件
const simpleMapping = {};
Object.keys(flagData).forEach(code => {
  simpleMapping[code] = {
    name: flagData[code].name,
    emoji: flagData[code].unicode_char,
    key: flagData[code].key
  };
});

const mappingPath = path.join(__dirname, '../src/data/country-flag-mapping.json');
fs.writeFileSync(mappingPath, JSON.stringify(simpleMapping, null, 2), 'utf8');

console.log(`✅ 成功生成简化映射文件: ${mappingPath}`);
