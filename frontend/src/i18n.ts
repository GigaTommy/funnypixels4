export type Locale = 'zh-CN' | 'en';

const LOCALE_STORAGE_KEY = 'funnypixels_locale';

const translations = {
  'zh-CN': {
    quickstart_progress: '新手快速上手 {current}/{total}',
    quickstart_skip: '跳过',
    quickstart_prev: '上一步',
    quickstart_next: '下一步',
    quickstart_finish: '完成引导',
    quickstart_step1_title: '开启 GPS 绘制',
    quickstart_step1_desc: '开启后会根据你的移动轨迹自动绘制像素。',
    quickstart_step1_action: '开启 GPS 自动绘制',
    quickstart_step2_title: '快速找到战区',
    quickstart_step2_desc: '定位到当前位置或漫游到热点区域，马上加入争夺。',
    quickstart_step2_locate: '定位到我',
    quickstart_step2_roam: '去热点',
    quickstart_step3_title: '开始移动即可绘制',
    quickstart_step3_desc: '开始移动，系统会自动留下你的像素足迹。',
    quickstart_step3_done: '我知道了',
    controls_help: '新手快速上手',
    controls_zoom_in: '放大',
    controls_zoom_out: '缩小',
    controls_roam: '漫游到热点',
    controls_locate: '定位到当前位置',
    controls_gps: 'GPS 自动绘制',
    gps_on: 'GPS 自动模式已开启',
    gps_off: 'GPS 自动模式已关闭',
    gps_hint: '移动中会自动绘制像素。',
    gps_on_failed: '开启 GPS 模式失败',
    gps_off_failed: '关闭 GPS 模式失败',
    manual_on: '手动绘制模式已开启',
    manual_off: '手动绘制模式已关闭',
    manual_on_failed: '开启手动绘制失败',
    manual_off_failed: '关闭手动绘制失败',
    manual_hint: '点击地图即可绘制像素。',
    operation_failed: '操作失败，请重试'
  },
  'en': {
    quickstart_progress: 'Quick Start {current}/{total}',
    quickstart_skip: 'Skip',
    quickstart_prev: 'Back',
    quickstart_next: 'Next',
    quickstart_finish: 'Finish',
    quickstart_step1_title: 'Enable GPS Drawing',
    quickstart_step1_desc: 'Pixels will be drawn automatically as you move.',
    quickstart_step1_action: 'Start GPS Auto Draw',
    quickstart_step2_title: 'Find a Hot Zone',
    quickstart_step2_desc: 'Locate yourself or roam to a hotspot and join the battle.',
    quickstart_step2_locate: 'Locate Me',
    quickstart_step2_roam: 'Go to Hotspot',
    quickstart_step3_title: 'Move to Draw',
    quickstart_step3_desc: 'Start moving and leave your pixel footprints.',
    quickstart_step3_done: 'Got it',
    controls_help: 'Quick Start',
    controls_zoom_in: 'Zoom in',
    controls_zoom_out: 'Zoom out',
    controls_roam: 'Roam to hotspot',
    controls_locate: 'Locate me',
    controls_gps: 'GPS auto draw',
    gps_on: 'GPS auto mode enabled',
    gps_off: 'GPS auto mode disabled',
    gps_hint: 'Pixels will be drawn automatically while you move.',
    gps_on_failed: 'Failed to enable GPS mode',
    gps_off_failed: 'Failed to disable GPS mode',
    manual_on: 'Manual draw enabled',
    manual_off: 'Manual draw disabled',
    manual_on_failed: 'Failed to enable manual draw',
    manual_off_failed: 'Failed to disable manual draw',
    manual_hint: 'Tap the map to draw pixels.',
    operation_failed: 'Operation failed, please try again'
  }
} as const;

export type TranslationKey = keyof typeof translations['zh-CN'];

export function getLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en') {
    return stored;
  }

  const navLang = navigator.language || 'en';
  return navLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function t(key: TranslationKey, params?: Record<string, string | number>) {
  const locale = getLocale();
  const template = translations[locale][key] || translations['en'][key] || key;
  if (!params) return template;

  return Object.keys(params).reduce((result, paramKey) => {
    return result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
  }, template);
}
