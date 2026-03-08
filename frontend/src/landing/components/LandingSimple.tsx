import React, { useState, useEffect } from 'react';

/**
 * 检测浏览器语言
 */
type SupportedLanguage = 'zh-CN' | 'en-US' | 'es' | 'ja' | 'ko' | 'pt-BR';

function detectLanguage(): SupportedLanguage {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  const lang = browserLang.toLowerCase();

  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('pt')) return 'pt-BR';

  return 'en-US'; // 默认英语
}

const LandingSimple: React.FC = () => {
  const [lang, setLang] = useState<SupportedLanguage>('en-US');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  useEffect(() => {
    // 优先级：localStorage > 浏览器检测
    const savedLang = localStorage.getItem('preferredLanguage') as SupportedLanguage;
    if (savedLang && ['zh-CN', 'en-US', 'es', 'ja', 'ko', 'pt-BR'].includes(savedLang)) {
      setLang(savedLang);
    } else {
      setLang(detectLanguage());
    }
  }, []);

  // 切换语言
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLang(newLang);
    localStorage.setItem('preferredLanguage', newLang);
    setIsLangMenuOpen(false);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-selector')) {
        setIsLangMenuOpen(false);
      }
    };

    if (isLangMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isLangMenuOpen]);

  const handleDownload = () => {
    window.open('https://apps.apple.com/app/funnypixels', '_blank');
  };

  const translations = {
    'zh-CN': {
      appName: '有趣的像素',
      pageTitle: '有趣的像素 - 边走边画，用脚步绘制世界',
      title1: '边走边画',
      title2: '用脚步绘制世界',
      subtitle: 'GPS 运动像素游戏。走路、跑步、骑行时自动记录轨迹，生成彩色像素地图。',
      download: '下载 iOS 版',
      downloadShort: 'App Store',
      stats: { players: '玩家', pixels: '像素', cities: '城市' },
      featuresTitle: '主要功能',
      feature1: { title: 'GPS 绘制', desc: '运动时自动记录轨迹，生成像素地图。支持步行、跑步、骑行。' },
      feature2: { title: '联盟系统', desc: '创建或加入联盟，自定义旗帜，与其他玩家协作占领城市。' },
      feature3: { title: '运动追踪', desc: '记录步数、距离、卡路里。通过运动解锁更多像素。' },
      ctaTitle: '开始绘制你的地图',
      ctaSubtitle: 'iOS 14.0 及以上版本',
      ctaNote: '免费 · 无广告',
      footer: { slogan: '边走边画，用脚步绘制世界', quickLinks: '链接', tryNow: '试玩', support: '帮助', legal: '法律', privacy: '隐私', terms: '条款' },
    },
    'en-US': {
      appName: 'FunnyPixels',
      pageTitle: 'FunnyPixels - Walk and Draw, Paint the World with Your Steps',
      title1: 'Walk and Draw',
      title2: 'Paint the World with Your Steps',
      subtitle: 'GPS motion pixel game. Automatically records your path while walking, running, or cycling, and generates colorful pixel maps.',
      download: 'Download for iOS',
      downloadShort: 'App Store',
      stats: { players: 'Players', pixels: 'Pixels', cities: 'Cities' },
      featuresTitle: 'Features',
      feature1: { title: 'GPS Drawing', desc: 'Automatically records your movement and generates pixel maps. Supports walking, running, cycling.' },
      feature2: { title: 'Alliance System', desc: 'Create or join alliances, customize flags, collaborate with other players to conquer cities.' },
      feature3: { title: 'Activity Tracking', desc: 'Track steps, distance, calories. Unlock more pixels through movement.' },
      ctaTitle: 'Start Drawing Your Map',
      ctaSubtitle: 'iOS 14.0 and above',
      ctaNote: 'Free · No Ads',
      footer: { slogan: 'Walk and draw, paint the world with your steps', quickLinks: 'Links', tryNow: 'Try', support: 'Help', legal: 'Legal', privacy: 'Privacy', terms: 'Terms' },
    },
    'es': {
      appName: 'Píxeles Divertidos',
      pageTitle: 'Píxeles Divertidos - Camina y Dibuja, Pinta el Mundo con tus Pasos',
      title1: 'Camina y Dibuja',
      title2: 'Pinta el Mundo con tus Pasos',
      subtitle: 'Juego de píxeles con GPS. Registra automáticamente tu ruta mientras caminas, corres o andas en bicicleta, y genera mapas de píxeles coloridos.',
      download: 'Descargar para iOS',
      downloadShort: 'App Store',
      stats: { players: 'Jugadores', pixels: 'Píxeles', cities: 'Ciudades' },
      featuresTitle: 'Características',
      feature1: { title: 'Dibujo GPS', desc: 'Registra automáticamente tu movimiento y genera mapas de píxeles. Compatible con caminar, correr, ciclismo.' },
      feature2: { title: 'Sistema de Alianzas', desc: 'Crea o únete a alianzas, personaliza banderas, colabora con otros jugadores para conquistar ciudades.' },
      feature3: { title: 'Seguimiento de Actividad', desc: 'Rastrea pasos, distancia, calorías. Desbloquea más píxeles a través del movimiento.' },
      ctaTitle: 'Comienza a Dibujar tu Mapa',
      ctaSubtitle: 'iOS 14.0 y superior',
      ctaNote: 'Gratis · Sin Anuncios',
      footer: { slogan: 'Camina y dibuja, pinta el mundo con tus pasos', quickLinks: 'Enlaces', tryNow: 'Probar', support: 'Ayuda', legal: 'Legal', privacy: 'Privacidad', terms: 'Términos' },
    },
    'ja': {
      appName: 'ファニーピクセルズ',
      pageTitle: 'ファニーピクセルズ - 歩いて描く、足跡で世界を描こう',
      title1: '歩いて描く',
      title2: '足跡で世界を描こう',
      subtitle: 'GPS モーションピクセルゲーム。歩く、走る、サイクリング中に自動的に経路を記録し、カラフルなピクセルマップを生成します。',
      download: 'iOS版をダウンロード',
      downloadShort: 'App Store',
      stats: { players: 'プレイヤー', pixels: 'ピクセル', cities: '都市' },
      featuresTitle: '主な機能',
      feature1: { title: 'GPS描画', desc: '移動を自動的に記録してピクセルマップを生成。ウォーキング、ランニング、サイクリングに対応。' },
      feature2: { title: 'アライアンスシステム', desc: 'アライアンスを作成または参加し、旗をカスタマイズして、他のプレイヤーと協力して都市を征服。' },
      feature3: { title: 'アクティビティ追跡', desc: '歩数、距離、カロリーを追跡。運動を通じてより多くのピクセルをアンロック。' },
      ctaTitle: 'あなたのマップを描き始めよう',
      ctaSubtitle: 'iOS 14.0以降',
      ctaNote: '無料 · 広告なし',
      footer: { slogan: '歩いて描く、足跡で世界を描こう', quickLinks: 'リンク', tryNow: '試す', support: 'ヘルプ', legal: '法的情報', privacy: 'プライバシー', terms: '利用規約' },
    },
    'ko': {
      appName: '재미있는 픽셀',
      pageTitle: '재미있는 픽셀 - 걸으며 그리기, 발걸음으로 세상을 그려요',
      title1: '걸으며 그리기',
      title2: '발걸음으로 세상을 그려요',
      subtitle: 'GPS 모션 픽셀 게임. 걷기, 달리기, 자전거 타기 중 경로를 자동으로 기록하고 컬러풀한 픽셀 지도를 생성합니다.',
      download: 'iOS용 다운로드',
      downloadShort: 'App Store',
      stats: { players: '플레이어', pixels: '픽셀', cities: '도시' },
      featuresTitle: '주요 기능',
      feature1: { title: 'GPS 그리기', desc: '이동을 자동으로 기록하고 픽셀 지도를 생성합니다. 걷기, 달리기, 사이클링 지원.' },
      feature2: { title: '얼라이언스 시스템', desc: '얼라이언스를 만들거나 참여하고, 깃발을 맞춤 설정하며, 다른 플레이어와 협력하여 도시를 정복하세요.' },
      feature3: { title: '활동 추적', desc: '걸음 수, 거리, 칼로리를 추적합니다. 움직임을 통해 더 많은 픽셀을 잠금 해제하세요.' },
      ctaTitle: '지도 그리기 시작하기',
      ctaSubtitle: 'iOS 14.0 이상',
      ctaNote: '무료 · 광고 없음',
      footer: { slogan: '걸으며 그리기, 발걸음으로 세상을 그려요', quickLinks: '링크', tryNow: '체험', support: '도움말', legal: '법적 정보', privacy: '개인정보', terms: '약관' },
    },
    'pt-BR': {
      appName: 'Pixels Divertidos',
      pageTitle: 'Pixels Divertidos - Caminhe e Desenhe, Pinte o Mundo com seus Passos',
      title1: 'Caminhe e Desenhe',
      title2: 'Pinte o Mundo com seus Passos',
      subtitle: 'Jogo de pixels com GPS. Registra automaticamente seu caminho enquanto você caminha, corre ou pedala, e gera mapas de pixels coloridos.',
      download: 'Baixar para iOS',
      downloadShort: 'App Store',
      stats: { players: 'Jogadores', pixels: 'Pixels', cities: 'Cidades' },
      featuresTitle: 'Recursos',
      feature1: { title: 'Desenho GPS', desc: 'Registra automaticamente seu movimento e gera mapas de pixels. Suporta caminhada, corrida, ciclismo.' },
      feature2: { title: 'Sistema de Alianças', desc: 'Crie ou participe de alianças, personalize bandeiras, colabore com outros jogadores para conquistar cidades.' },
      feature3: { title: 'Rastreamento de Atividade', desc: 'Rastreie passos, distância, calorias. Desbloqueie mais pixels através do movimento.' },
      ctaTitle: 'Comece a Desenhar seu Mapa',
      ctaSubtitle: 'iOS 14.0 e superior',
      ctaNote: 'Grátis · Sem Anúncios',
      footer: { slogan: 'Caminhe e desenhe, pinte o mundo com seus passos', quickLinks: 'Links', tryNow: 'Experimentar', support: 'Ajuda', legal: 'Legal', privacy: 'Privacidade', terms: 'Termos' },
    },
  };

  const t = translations[lang];

  // 语言选项配置
  const languageOptions = [
    { code: 'zh-CN' as SupportedLanguage, name: '简体中文', flag: '🇨🇳' },
    { code: 'en-US' as SupportedLanguage, name: 'English', flag: '🇺🇸' },
    { code: 'es' as SupportedLanguage, name: 'Español', flag: '🇪🇸' },
    { code: 'ja' as SupportedLanguage, name: '日本語', flag: '🇯🇵' },
    { code: 'ko' as SupportedLanguage, name: '한국어', flag: '🇰🇷' },
    { code: 'pt-BR' as SupportedLanguage, name: 'Português', flag: '🇧🇷' },
  ];

  const currentLanguage = languageOptions.find(opt => opt.code === lang) || languageOptions[1];

  // 截图轮播
  const screenshots = [
    '/assets/screenshots/onboarding_drawing_mode.png',
    '/assets/screenshots/onboarding_map_explore.png',
    '/assets/screenshots/onboarding_alliance_war.png',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentScreenshot((prev) => (prev + 1) % screenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // 动态设置页面标题和语言属性
  useEffect(() => {
    document.title = t.pageTitle;
    document.documentElement.lang = lang;
  }, [lang, t]);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      padding: 0,
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      minHeight: '100vh',
    }}>
      {/* 导航栏 */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e5e7eb',
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/assets/app-icon.png"
              alt={t.appName}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
              }}
            />
            <span style={{ fontWeight: '600', fontSize: '18px', color: '#000' }}>{t.appName}</span>
          </div>

          {/* 语言切换器 */}
          <div className="language-selector" style={{ position: 'relative' }}>
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#000',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>🌐</span>
              <span>{currentLanguage.name}</span>
              <span style={{ fontSize: '12px', transform: isLangMenuOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
            </button>

            {/* 下拉菜单 */}
            {isLangMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                minWidth: '160px',
                zIndex: 100,
              }}>
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleLanguageChange(option.code)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      backgroundColor: lang === option.code ? '#f5f5f5' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '14px',
                      color: lang === option.code ? '#000' : '#666',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: lang === option.code ? '600' : 'normal',
                    }}
                    onMouseEnter={(e) => {
                      if (lang !== option.code) {
                        e.currentTarget.style.backgroundColor = '#fafafa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (lang !== option.code) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{option.flag}</span>
                    <span>{option.name}</span>
                    {lang === option.code && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 英雄区 */}
      <div style={{
        padding: '128px 24px 80px',
        backgroundColor: '#ffffff',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'center',
        }}>
          {/* 左侧：文案 */}
          <div>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#000',
              marginBottom: '24px',
              lineHeight: '1.2',
              letterSpacing: '-0.02em',
            }}>
              {t.title1}
              <br />
              {t.title2}
            </h1>

            <p style={{
              fontSize: '20px',
              color: '#666',
              marginBottom: '32px',
              lineHeight: '1.6',
            }}>
              {t.subtitle}
            </p>

            {/* iOS 下载按钮 */}
            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#000',
                color: '#fff',
                padding: '16px 32px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span>{t.download}</span>
            </button>

            {/* 统计数据 */}
            <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000' }}>100K+</div>
                <div style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>{t.stats.players}</div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000' }}>50M+</div>
                <div style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>{t.stats.pixels}</div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000' }}>1K+</div>
                <div style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>{t.stats.cities}</div>
              </div>
            </div>
          </div>

          {/* 右侧：手机截图 */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '320px', position: 'relative' }}>
              {/* iPhone 框架 */}
              <div style={{
                backgroundColor: '#1f2937',
                borderRadius: '48px',
                padding: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}>
                <div style={{
                  backgroundColor: '#000',
                  borderRadius: '40px',
                  overflow: 'hidden',
                  aspectRatio: '9 / 19.5',
                  position: 'relative',
                }}>
                  {/* 刘海 */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '33%',
                    height: '24px',
                    backgroundColor: '#1f2937',
                    borderRadius: '0 0 16px 16px',
                    zIndex: 10,
                  }}></div>

                  {/* 真实截图 */}
                  <img
                    src={screenshots[currentScreenshot]}
                    alt="App Screenshot"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'opacity 0.5s',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能介绍 */}
      <div style={{ padding: '80px 24px', backgroundColor: '#fafafa' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#000', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              {t.featuresTitle}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
            {[t.feature1, t.feature2, t.feature3].map((feature, index) => (
              <div key={index} style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '32px',
                border: '1px solid #e5e5e5',
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#000', marginBottom: '12px' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: '16px', color: '#666', lineHeight: '1.6' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下载 CTA */}
      <div style={{
        padding: '80px 24px',
        backgroundColor: '#000',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', marginBottom: '24px', letterSpacing: '-0.02em' }}>
            {t.ctaTitle}
          </h2>
          <p style={{ fontSize: '20px', color: '#999', marginBottom: '32px' }}>
            {t.ctaSubtitle}
          </p>

          <button
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'white',
              color: '#000',
              padding: '20px 40px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <svg style={{ width: '28px', height: '28px' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>Download</div>
              <div>{t.downloadShort}</div>
            </div>
          </button>

          <p style={{ marginTop: '24px', color: '#666', fontSize: '14px' }}>
            {t.ctaNote}
          </p>
        </div>
      </div>

      {/* QR 码下载区 */}
      <div style={{
        padding: '60px 24px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e5e5',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', marginBottom: '16px' }}>
            {lang === 'zh-CN' ? '扫码下载' : 'Scan to Download'}
          </h3>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px' }}>
            {lang === 'zh-CN' ? '使用相机扫描二维码下载 iOS 应用' : 'Scan QR code with your camera to download iOS app'}
          </p>

          <div style={{
            display: 'inline-block',
            padding: '24px',
            backgroundColor: '#fff',
            borderRadius: '16px',
            border: '1px solid #e5e5e5',
          }}>
            {/* QR 码占位符 - 稍后替换为实际 QR 码 */}
            <div style={{
              width: '200px',
              height: '200px',
              backgroundColor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>📱</div>
                <div style={{ fontSize: '14px', color: '#999' }}>QR Code</div>
              </div>
            </div>
            <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>App Store</p>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer style={{ padding: '48px 24px', backgroundColor: '#0a0a0a', color: '#999' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px', marginBottom: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <img
                  src="/assets/app-icon.png"
                  alt={t.appName}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                  }}
                />
                <span style={{ fontWeight: '600', color: '#fff' }}>{t.appName}</span>
              </div>
              <p style={{ fontSize: '14px', color: '#666' }}>{t.footer.slogan}</p>
            </div>

            <div>
              <h3 style={{ fontWeight: '600', marginBottom: '16px', color: '#fff' }}>{t.footer.quickLinks}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px' }}>
                <li style={{ marginBottom: '8px' }}>
                  <a href="/app" style={{ color: '#999', textDecoration: 'none' }}>{t.footer.tryNow}</a>
                </li>
                <li>
                  <a href="/support" style={{ color: '#999', textDecoration: 'none' }}>{t.footer.support}</a>
                </li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontWeight: '600', marginBottom: '16px', color: '#fff' }}>{t.footer.legal}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px' }}>
                <li style={{ marginBottom: '8px' }}>
                  <a href="/privacy-policy" style={{ color: '#999', textDecoration: 'none' }}>{t.footer.privacy}</a>
                </li>
                <li>
                  <a href="/terms" style={{ color: '#999', textDecoration: 'none' }}>{t.footer.terms}</a>
                </li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontWeight: '600', marginBottom: '16px', color: '#fff' }}>
                {lang === 'zh-CN' ? '关注我们' : lang === 'ja' ? 'フォロー' : lang === 'ko' ? '팔로우' : lang === 'es' ? 'Síguenos' : lang === 'pt-BR' ? 'Siga-nos' : 'Follow Us'}
              </h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {/* 社交媒体图标 - 使用 emoji 占位 */}
                <a href="#" style={{ fontSize: '24px', opacity: '0.7', transition: 'opacity 0.2s', textDecoration: 'none' }}
                   onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                   onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                  <span title="Twitter">🐦</span>
                </a>
                <a href="#" style={{ fontSize: '24px', opacity: '0.7', transition: 'opacity 0.2s', textDecoration: 'none' }}
                   onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                   onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                  <span title="Discord">💬</span>
                </a>
                <a href="#" style={{ fontSize: '24px', opacity: '0.7', transition: 'opacity 0.2s', textDecoration: 'none' }}
                   onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                   onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                  <span title="Reddit">🤖</span>
                </a>
                <a href="#" style={{ fontSize: '24px', opacity: '0.7', transition: 'opacity 0.2s', textDecoration: 'none' }}
                   onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                   onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                  <span title="YouTube">📺</span>
                </a>
              </div>
            </div>
          </div>

          {/* 版权和公司信息 */}
          <div style={{
            paddingTop: '32px',
            marginTop: '32px',
            borderTop: '1px solid #222',
          }}>
            <div style={{ textAlign: 'center', fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              © 2026 FunnyPixels. All rights reserved.
            </div>
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#555' }}>
              {lang === 'zh-CN' && '让运动变得有趣，让世界变得多彩'}
              {lang === 'en-US' && 'Make exercise fun, make the world colorful'}
              {lang === 'es' && 'Haz que el ejercicio sea divertido, haz que el mundo sea colorido'}
              {lang === 'ja' && '運動を楽しく、世界をカラフルに'}
              {lang === 'ko' && '운동을 재미있게, 세상을 다채롭게'}
              {lang === 'pt-BR' && 'Torne o exercício divertido, torne o mundo colorido'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingSimple;
