/**
 * 简单的国际化支持
 * 自动检测浏览器语言
 */

interface Translations {
  hero: {
    title: string;
    subtitle: string;
    download: string;
    stats: {
      players: string;
      pixels: string;
      cities: string;
    };
  };
  features: {
    title: string;
    subtitle: string;
    gps: {
      title: string;
      description: string;
    };
    alliance: {
      title: string;
      description: string;
    };
    health: {
      title: string;
      description: string;
    };
  };
  cta: {
    title: string;
    subtitle: string;
    download: string;
    note: string;
  };
  footer: {
    slogan: string;
    quickLinks: string;
    tryNow: string;
    support: string;
    legal: string;
    privacy: string;
    terms: string;
  };
}

const zhCN: Translations = {
  hero: {
    title: '边走边画\n用脚步绘制世界',
    subtitle: '一款结合GPS定位的运动像素游戏。散步、跑步、骑行，每一步都成为你的艺术作品。',
    download: '在 App Store 下载',
    stats: {
      players: '全球玩家',
      pixels: '已绘像素',
      cities: '覆盖城市',
    },
  },
  features: {
    title: '核心功能',
    subtitle: '简单上手，趣味无穷',
    gps: {
      title: 'GPS 自动绘制',
      description: '打开GPS，边走边画。散步、跑步、骑行，自动记录轨迹并转化为彩色像素地图。',
    },
    alliance: {
      title: '联盟战争',
      description: '创建或加入联盟，自定义旗帜，与全球玩家协同作战，占领城市。',
    },
    health: {
      title: '运动健康',
      description: '追踪步数和距离，计算卡路里消耗，用运动解锁更多像素。',
    },
  },
  cta: {
    title: '准备好开始你的像素冒险了吗？',
    subtitle: '现在下载，加入全球10万+玩家的行列',
    download: 'App Store',
    note: '完全免费 · 无广告 · iOS 14.0+',
  },
  footer: {
    slogan: '边走边画，用脚步绘制世界',
    quickLinks: '快速链接',
    tryNow: '立即试玩',
    support: '帮助中心',
    legal: '法律信息',
    privacy: '隐私政策',
    terms: '服务条款',
  },
};

const enUS: Translations = {
  hero: {
    title: 'Walk and Draw\nPaint the World with Your Steps',
    subtitle: 'A motion pixel game with GPS tracking. Walk, run, cycle - every step becomes your artwork.',
    download: 'Download on App Store',
    stats: {
      players: 'Players',
      pixels: 'Pixels',
      cities: 'Cities',
    },
  },
  features: {
    title: 'Core Features',
    subtitle: 'Simple to start, endless fun',
    gps: {
      title: 'GPS Auto-Drawing',
      description: 'Turn on GPS and draw while you move. Walking, running, cycling - automatically record your path as colorful pixels.',
    },
    alliance: {
      title: 'Alliance Wars',
      description: 'Create or join alliances, customize flags, cooperate with global players to conquer cities.',
    },
    health: {
      title: 'Health & Fitness',
      description: 'Track steps and distance, calculate calories, unlock more pixels through exercise.',
    },
  },
  cta: {
    title: 'Ready for Your Pixel Adventure?',
    subtitle: 'Download now and join 100K+ players worldwide',
    download: 'App Store',
    note: 'Free · No Ads · iOS 14.0+',
  },
  footer: {
    slogan: 'Walk and draw, paint the world with your steps',
    quickLinks: 'Quick Links',
    tryNow: 'Try Now',
    support: 'Support',
    legal: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  },
};

/**
 * 检测浏览器语言
 */
export function detectLanguage(): 'zh-CN' | 'en-US' {
  const browserLang = navigator.language || (navigator as any).userLanguage;

  // 检测中文
  if (browserLang.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }

  // 默认英文
  return 'en-US';
}

/**
 * 获取翻译
 */
export function getTranslations(lang?: 'zh-CN' | 'en-US'): Translations {
  const detectedLang = lang || detectLanguage();
  return detectedLang === 'zh-CN' ? zhCN : enUS;
}

/**
 * React Hook
 */
export function useTranslations() {
  const [lang, setLang] = React.useState<'zh-CN' | 'en-US'>(detectLanguage());
  const t = getTranslations(lang);

  return { t, lang, setLang };
}
