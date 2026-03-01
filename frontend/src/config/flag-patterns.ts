// 国旗图案配置
// 由于后端API暂未实现国旗图案，这里配置哪些国旗可以尝试从API加载

export const FLAG_PATTERN_CONFIG = {
  // 是否启用API加载国旗图案
  enableApiLoading: false,

  // 可以从API加载的国旗白名单（当enableApiLoading为true时生效）
  allowedPatterns: new Set([
    // 这里可以添加已知可用的国旗图案key
    // 'flag_cn',
    // 'flag_us',
    // 'flag_jp',
  ]),

  // 总是使用emoji的国家代码（不尝试API加载）
  emojiOnlyCountries: new Set([
    // 对于已知没有图案或经常出错的国家，可以直接使用emoji
    'cn', 'us', 'jp', 'kr', 'gb', 'fr', 'de', 'it', 'es', 'ru'
  ])
};

// 检查是否应该尝试从API加载国旗图案
export function shouldLoadFlagPatternFromAPI(countryCode: string, patternKey: string): boolean {
  if (!FLAG_PATTERN_CONFIG.enableApiLoading) {
    return false;
  }

  if (FLAG_PATTERN_CONFIG.emojiOnlyCountries.has(countryCode.toLowerCase())) {
    return false;
  }

  return FLAG_PATTERN_CONFIG.allowedPatterns.has(patternKey);
}