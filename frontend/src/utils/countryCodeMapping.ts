// 国家代码到ISO 3166-1 alpha-2的映射
export const countryCodeMapping: { [key: string]: string } = {
  // 中文国家名到ISO代码的映射
  '中国': 'CN',
  '美国': 'US',
  '日本': 'JP',
  '韩国': 'KR',
  '英国': 'GB',
  '法国': 'FR',
  '德国': 'DE',
  '意大利': 'IT',
  '西班牙': 'ES',
  '俄罗斯': 'RU',
  '加拿大': 'CA',
  '澳大利亚': 'AU',
  '巴西': 'BR',
  '印度': 'IN',
  '墨西哥': 'MX',
  '阿根廷': 'AR',
  '南非': 'ZA',
  '新西兰': 'NZ',
  '新加坡': 'SG',
  '马来西亚': 'MY',
  '泰国': 'TH',
  '越南': 'VN',
  '印度尼西亚': 'ID',
  '菲律宾': 'PH',
  '荷兰': 'NL',
  '比利时': 'BE',
  '瑞士': 'CH',
  '奥地利': 'AT',
  '瑞典': 'SE',
  '挪威': 'NO',
  '丹麦': 'DK',
  '芬兰': 'FI',
  '波兰': 'PL',
  '捷克': 'CZ',
  '匈牙利': 'HU',
  '罗马尼亚': 'RO',
  '保加利亚': 'BG',
  '希腊': 'GR',
  '葡萄牙': 'PT',
  '土耳其': 'TR',
  '以色列': 'IL',
  '沙特阿拉伯': 'SA',
  '阿联酋': 'AE',
  '埃及': 'EG',
  '尼日利亚': 'NG',
  '肯尼亚': 'KE',

  // 常见的别名映射
  'china': 'CN',
  'usa': 'US',
  'uk': 'GB',
  'england': 'GB',
  'russia': 'RU',
  'south korea': 'KR',
  'north korea': 'KP',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'macau': 'MO'
};

// 标准化国家代码
export function normalizeCountryCode(countryInput: string | null | undefined): string {
  if (!countryInput) {
    return 'CN'; // 默认中国
  }

  const code = countryInput.toString().trim().toLowerCase();

  // 如果已经是2-3字母的标准ISO代码，直接返回大写
  if (code.length <= 3 && /^[a-z]+$/.test(code)) {
    return code.toUpperCase();
  }

  // 尝试从映射表中查找
  const mappedCode = countryCodeMapping[countryInput] || countryCodeMapping[code];
  if (mappedCode) {
    return mappedCode;
  }

  // 如果找不到匹配，返回默认
  return 'CN';
}