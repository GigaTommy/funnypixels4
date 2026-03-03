const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

/**
 * 语言代码映射表
 * 将浏览器发送的简短/变体代码统一映射到项目使用的标准代码
 */
const LANG_CODE_MAP = {
  'zh': 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-tw': 'zh-Hans',
  'zh-hk': 'zh-Hans',
  'zh-hans': 'zh-Hans',
  'pt': 'pt-BR',
  'pt-pt': 'pt-BR',
  'pt-br': 'pt-BR',
  'en-us': 'en',
  'en-gb': 'en',
  'ja-jp': 'ja',
  'ko-kr': 'ko',
  'es-es': 'es',
  'es-mx': 'es',
};

/**
 * i18n 配置
 * 支持多语言错误消息和响应
 */

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // 默认语言
    fallbackLng: 'zh-Hans',

    // 支持的语言
    supportedLngs: ['zh-Hans', 'en', 'ja', 'ko', 'es', 'pt-BR'],

    // 仅加载精确匹配的语言，不做层级解析（避免 zh-Hans → zh 的回退警告）
    load: 'currentOnly',

    // 预加载语言
    preload: ['zh-Hans', 'en', 'ja', 'ko', 'es', 'pt-BR'],

    // 命名空间（添加 notifications, feed）
    ns: ['common', 'errors', 'validation', 'success', 'notifications', 'feed'],
    defaultNS: 'common',

    // Backend 配置
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      addPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.missing.json')
    },

    // 检测选项
    detection: {
      // 检测顺序
      order: ['header', 'querystring', 'cookie'],

      // 从这些来源检测语言
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',

      // 将浏览器检测到的语言代码规范化为项目支持的代码
      convertDetectedLanguage: (lng) => {
        if (!lng) return 'zh-Hans';
        const lower = lng.toLowerCase();
        return LANG_CODE_MAP[lower] || LANG_CODE_MAP[lower.split('-')[0]] || lng;
      },

      // 缓存用户语言
      caches: ['cookie'],

      // Cookie 选项
      cookieOptions: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        httpOnly: false // 需要客户端访问
      }
    },

    // 插值选项
    interpolation: {
      escapeValue: false, // React/Vue 已经转义
      format: function(value, format, lng) {
        // 自定义格式化
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (value instanceof Date) {
          if (format === 'short') {
            return value.toLocaleDateString(lng);
          }
          return value.toLocaleString(lng);
        }
        return value;
      }
    },

    // 性能优化
    saveMissing: false, // 生产环境设为 false
    updateMissing: false,

    // 调试
    debug: process.env.NODE_ENV === 'development'
  });

module.exports = {
  i18next,
  middleware
};
