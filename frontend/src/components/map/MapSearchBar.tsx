import React, { useState, useRef, useEffect } from 'react';
import { Search, Scan } from 'lucide-react';
import ZXingScannerModern from '../qr-treasure/ZXingScannerModern';
import { logger } from '../../utils/logger';

interface MapSearchBarProps {
  onLocationSearch: (keyword: string, location: { lng: number; lat: number }) => void;
  isAuthenticated?: boolean; // 添加用户认证状态
}

export default function MapSearchBar({ onLocationSearch, isAuthenticated = false }: MapSearchBarProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchService, setSearchService] = useState<any>(null);
  const [autocompleteService, setAutocompleteService] = useState<any>(null);
  const [searchError, setSearchError] = useState<string>('');

  // 响应式状态管理
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isExtraSmallScreen, setIsExtraSmallScreen] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setWindowSize({ width, height });

      // 更新响应式状态
      setIsMobile(width <= 768);
      setIsSmallScreen(width <= 480);
      setIsExtraSmallScreen(width <= 320);
    };

    // 初始化
    handleResize();

    // 添加事件监听
    window.addEventListener('resize', handleResize);

    // 清理
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理扫一扫按钮点击
  const handleScanClick = () => {
    if (!isAuthenticated) {
      logger.warn('用户未登录，无法使用扫一扫功能');
      return;
    }

    try {
      setShowQRScanner(true);
      logger.info('QR扫描器已打开');
    } catch (error) {
      logger.error('打开QR扫描器失败:', error);
    }
  };

  // 初始化高德地图搜索服务 - 添加延迟和重试机制
  useEffect(() => {
    const initSearchService = (retryCount = 0) => {
      // 延迟初始化，等待地图API加载完成
      const delay = Math.min(1000 * retryCount, 3000); // 最大延迟3秒

      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).AMap) {
          const AMap = (window as any).AMap;
          const apiKey = import.meta.env.VITE_AMAP_API_KEY;
          const webServiceKey = import.meta.env.VITE_AMAP_WEB_SERVICE_KEY;

          // 检查API密钥配置
          if (!apiKey && !webServiceKey) {
            setSearchError('地图API密钥未配置，搜索功能不可用');
            logger.error('地图API密钥未配置');
            return;
          }

          // 加载搜索插件
          AMap.plugin(['AMap.AutoComplete', 'AMap.PlaceSearch'], () => {
            try {
              // 创建自动填充服务
              const autocomplete = new AMap.AutoComplete({
                city: '全国'
              });
              setAutocompleteService(autocomplete);

              // 创建地点搜索服务
              const placeSearch = new AMap.PlaceSearch({
                city: '全国',
                pageSize: 10
              });
              setSearchService(placeSearch);

              logger.info('✅ 高德地图搜索服务初始化成功');
              setSearchError('');
            } catch (error) {
              logger.error('❌ 高德地图搜索服务初始化失败:', error);
              if (webServiceKey) {
                setSearchError('JavaScript API不可用，使用Web API备选方案');
                logger.info('🔄 将使用Web API作为备选搜索方案');
              } else {
                setSearchError('搜索服务初始化失败');
              }
            }
          });
        } else {
          // 如果API还未加载，重试
          if (retryCount < 3) {
            logger.warn(`⚠️ 高德地图API未加载，${delay/1000}秒后重试 (${retryCount + 1}/3)`);
            initSearchService(retryCount + 1);
          } else {
            logger.warn('⚠️ 高德地图API加载超时，搜索功能暂时不可用');
            setSearchError('地图服务加载中，请稍后再试');
          }
        }
      }, delay);
    };

    initSearchService();
  }, []);

  // 搜索建议
  const handleSearchInput = (value: string) => {
    setSearchKeyword(value);

    if (value.trim() && autocompleteService) {
      autocompleteService.search(value, (status: string, result: any) => {
        logger.info('AutoComplete结果:', { status, result });

        if (status === 'complete' && result.tips && result.tips.length > 0) {
          setSearchSuggestions(result.tips);
          setShowSuggestions(true);
        } else if (status === 'error' || status === 'no_data') {
          logger.warn('AutoComplete失败，尝试使用Web API获取建议:', { status, value });
          handleWebApiSuggestions(value);
        } else {
          setSearchSuggestions([]);
          setShowSuggestions(false);
        }
      });
    } else if (value.trim()) {
      // 如果AutoComplete服务不可用，尝试使用Web API
      logger.warn('AutoComplete服务未初始化，尝试使用Web API获取建议:', { value });
      handleWebApiSuggestions(value);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 使用Web API获取搜索建议
  const handleWebApiSuggestions = (keyword: string) => {
    const webServiceKey = import.meta.env.VITE_AMAP_WEB_SERVICE_KEY;
    if (!webServiceKey) {
      logger.warn('Web服务密钥未配置，无法获取搜索建议');
      return;
    }

    logger.info('使用Web API获取搜索建议:', { keyword });

    fetch(`https://restapi.amap.com/v3/assistant/inputtips?key=${webServiceKey}&keywords=${encodeURIComponent(keyword)}&city=全国`)
      .then(response => response.json())
      .then(data => {
        logger.info('Web API建议结果:', data);

        if (data.status === '1' && data.tips && data.tips.length > 0) {
          // 转换Web API的结果格式以匹配AutoComplete的格式
          const tips = data.tips.map((tip: any) => ({
            name: tip.name || tip.district,
            address: tip.address,
            location: tip.location ? { lng: tip.location.split(',')[0], lat: tip.location.split(',')[1] } : null,
            district: tip.district
          }));

          setSearchSuggestions(tips);
          setShowSuggestions(true);
        } else {
          setSearchSuggestions([]);
          setShowSuggestions(false);
        }
      })
      .catch(error => {
        // 降低日志级别，避免过多错误日志
        logger.warn('Web API建议请求失败，将隐藏搜索建议:', error.message);
        setSearchSuggestions([]);
        setShowSuggestions(false);
      });
  };

  // 执行搜索
  const handleSearch = (keyword?: string) => {
    const searchValue = keyword || searchKeyword;

    if (!searchValue.trim()) return;

    setIsSearching(true);
    setShowSuggestions(false);

    // 检查搜索服务是否可用
    if (!searchService) {
      logger.warn('搜索服务未初始化，尝试使用Web API作为备选方案');
      handleWebApiSearch(searchValue);
      return;
    }

    searchService.search(searchValue, (status: string, result: any) => {
      setIsSearching(false);

      logger.info('JavaScript API搜索结果:', { status, result });

      if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
        const firstPoi = result.poiList.pois[0];
        const location = {
          lng: parseFloat(firstPoi.location.lng),
          lat: parseFloat(firstPoi.location.lat)
        };

        logger.info('搜索到位置:', {
          keyword: searchValue,
          name: firstPoi.name,
          address: firstPoi.address,
          location: location
        });

        onLocationSearch(searchValue, location);
        setSearchKeyword(firstPoi.name);
        searchInputRef.current?.blur();
      } else if (status === 'error' || status === 'no_data') {
        logger.warn('JavaScript API搜索失败，尝试使用Web API作为备选方案:', { status, keyword: searchValue });
        handleWebApiSearch(searchValue);
      } else {
        logger.warn('未找到搜索结果:', { keyword: searchValue, status });
        // 可以在这里显示未找到结果的提示
      }
    });
  };

  // 备选方案：使用Web API进行搜索
  const handleWebApiSearch = (keyword: string) => {
    const webServiceKey = import.meta.env.VITE_AMAP_WEB_SERVICE_KEY;
    if (!webServiceKey) {
      logger.error('Web服务密钥未配置，无法进行搜索');
      setIsSearching(false);
      return;
    }

    logger.info('使用Web API搜索:', { keyword });

    fetch(`https://restapi.amap.com/v3/place/text?key=${webServiceKey}&keywords=${encodeURIComponent(keyword)}&city=全国&offset=5&page=1`)
      .then(response => response.json())
      .then(data => {
        setIsSearching(false);
        logger.info('Web API搜索结果:', data);

        if (data.status === '1' && data.count && parseInt(data.count) > 0 && data.pois && data.pois.length > 0) {
          const firstPoi = data.pois[0];
          const location = {
            lng: parseFloat(firstPoi.location.split(',')[0]),
            lat: parseFloat(firstPoi.location.split(',')[1])
          };

          logger.info('Web API搜索到位置:', {
            keyword: keyword,
            name: firstPoi.name,
            address: firstPoi.address,
            location: location
          });

          onLocationSearch(keyword, location);
          setSearchKeyword(firstPoi.name);
          searchInputRef.current?.blur();
        } else {
          logger.warn('Web API也未找到搜索结果:', { keyword, data });
          // 显示简单的搜索失败提示
          alert(`未找到"${keyword}"的搜索结果，请尝试其他关键词`);
        }
      })
      .catch(error => {
        setIsSearching(false);
        // 降低日志级别，避免过多错误日志
        logger.warn('Web API搜索请求失败:', error.message);
      });
  };

  // 处理建议项点击
  const handleSuggestionClick = (suggestion: any) => {
    setSearchKeyword(suggestion.name || suggestion.district);
    setShowSuggestions(false);

    if (suggestion.location) {
      const location = {
        lng: parseFloat(suggestion.location.lng),
        lat: parseFloat(suggestion.location.lat)
      };

      logger.info('选择搜索建议:', {
        name: suggestion.name,
        address: suggestion.address,
        location: location
      });

      onLocationSearch(suggestion.name, location);
    } else {
      // 如果建议项没有具体坐标，使用完整的搜索
      handleSearch(suggestion.name || suggestion.district);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    }
  };

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-bar-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div
        className="search-bar-container"
        style={{
          position: 'fixed',
          top: isExtraSmallScreen ? '6px' : (isMobile ? '8px' : '16px'), // 更小的顶部间距
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100, // 🔥 优化：使用标准z-index规范，地图搜索栏
          // 精细的宽度控制
          width: isExtraSmallScreen
            ? 'calc(100% - 20px)' // 超小屏：320px以下
            : isSmallScreen
            ? 'calc(100% - 24px)' // 小屏：480px以下
            : isMobile
            ? 'calc(100% - 32px)' // 移动端：768px以下
            : 'min(85%, 440px)', // 桌面端
          maxWidth: isExtraSmallScreen
            ? '280px' // 超小屏最大宽度
            : isSmallScreen
            ? '380px' // 小屏最大宽度
            : isMobile
            ? '450px' // 移动端最大宽度
            : '440px', // 桌面端最大宽度
          minWidth: isExtraSmallScreen
            ? '180px' // 超小屏最小宽度
            : isSmallScreen
            ? '220px' // 小屏最小宽度
            : '280px' // 其他情况最小宽度
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: isExtraSmallScreen ? '20px' : (isSmallScreen ? '22px' : (isMobile ? '24px' : '24px')), // 与底部菜单栏一致的圆角
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            height: isExtraSmallScreen ? '40px' : (isSmallScreen ? '44px' : (isMobile ? '48px' : '48px')) // 与底部菜单栏按钮高度一致
          }}
        >
          {/* 搜索输入框 */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: isExtraSmallScreen
              ? '10px 12px'
              : (isSmallScreen
                ? '11px 12px'
                : (isMobile
                  ? '12px 14px'
                  : '12px 16px')) // 适应新高度的内边距
          }}>
            <Search
              size={isExtraSmallScreen
                ? 14
                : (isSmallScreen
                  ? 15
                  : (isMobile
                    ? 16
                    : 18))}
              color="#6b7280"
              style={{
                marginRight: isExtraSmallScreen
                  ? '8px'
                  : (isSmallScreen
                    ? '9px'
                    : (isMobile
                      ? '10px'
                      : '12px'))
              }}
            /> 

            <input
              ref={searchInputRef}
              type="text"
              value={searchKeyword}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="搜索地点和地址"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: isExtraSmallScreen
                  ? '12px'
                  : (isSmallScreen
                    ? '13px'
                    : (isMobile
                      ? '14px'
                      : '16px')), // 适应新高度的字体大小
                color: '#1f2937',
                padding: 0,
                height: isExtraSmallScreen
                  ? '20px'
                  : (isSmallScreen
                    ? '22px'
                    : (isMobile
                      ? '24px'
                      : '24px')) // 适应新高度的输入框高度
              }}
            />

            {isSearching && (
              <div
                style={{
                  width: isExtraSmallScreen
                    ? '16px'
                    : (isSmallScreen
                      ? '17px'
                      : (isMobile
                        ? '18px'
                        : '20px')),
                  height: isExtraSmallScreen
                    ? '16px'
                    : (isSmallScreen
                      ? '17px'
                      : (isMobile
                        ? '18px'
                        : '20px')),
                  borderRadius: '50%',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #3b82f6',
                  animation: 'spin 1s linear infinite',
                  marginLeft: isExtraSmallScreen
                    ? '6px'
                    : (isSmallScreen
                      ? '7px'
                      : (isMobile
                        ? '8px'
                        : '10px'))
                }}
              />
            )}

            {!isSearching && searchError && (
              <div
                style={{
                  width: isExtraSmallScreen
                    ? '14px'
                    : (isSmallScreen
                      ? '15px'
                      : (isMobile
                        ? '16px'
                        : '18px')),
                  height: isExtraSmallScreen
                    ? '14px'
                    : (isSmallScreen
                      ? '15px'
                      : (isMobile
                        ? '16px'
                        : '18px')),
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  marginLeft: isExtraSmallScreen
                    ? '6px'
                    : (isSmallScreen
                      ? '7px'
                      : (isMobile
                        ? '8px'
                        : '10px')),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: isExtraSmallScreen
                    ? '8px'
                    : (isSmallScreen
                      ? '9px'
                      : (isMobile
                        ? '10px'
                        : '12px')),
                  fontWeight: 'bold',
                  cursor: 'help'
                }}
              >
                !
              </div>
            )}
          </div>

          {/* 扫一扫按钮 - 仅在用户登录时显示 */}
          {isAuthenticated && (
            <button
              onClick={handleScanClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isExtraSmallScreen
                  ? '40px'
                  : (isSmallScreen
                    ? '44px'
                    : (isMobile
                      ? '48px'
                      : '48px')), // 与搜索栏高度一致
                height: isExtraSmallScreen
                  ? '40px'
                  : (isSmallScreen
                    ? '44px'
                    : (isMobile
                      ? '48px'
                      : '48px')), // 与搜索栏高度一致
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: '1px solid rgba(229, 231, 235, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: '#6b7280',
                borderRadius: `0 ${isExtraSmallScreen ? '20px' : (isSmallScreen ? '22px' : (isMobile ? '24px' : '24px'))} ${isExtraSmallScreen ? '20px' : (isSmallScreen ? '22px' : (isMobile ? '24px' : '24px'))} 0` // 与搜索栏圆角一致
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.6)';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              title="扫一扫"
            >
              <Scan
              size={isExtraSmallScreen
                ? 16
                : (isSmallScreen
                  ? 17
                  : (isMobile
                    ? 18
                    : 20))}
            />
            </button>
          )}
        </div>

        {/* 搜索建议列表 */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              right: '0',
              marginTop: '6px', // 减少间距
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              borderRadius: '12px', // 减少圆角
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', // 减少阴影
              border: '1px solid rgba(229, 231, 235, 0.4)',
              backdropFilter: 'blur(12px)',
              maxHeight: '260px', // 减少最大高度
              overflow: 'auto',
              zIndex: 105 // 🔥 优化：使用标准z-index规范，搜索建议下拉框
            }}
          >
            {searchSuggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '10px 16px', // 减少内边距
                  borderBottom: index < searchSuggestions.length - 1 ? '1px solid rgba(229, 231, 235, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{
                  fontSize: '14px', // 减小字体
                  fontWeight: '500',
                  color: '#1f2937',
                  marginBottom: '2px' // 减少间距
                }}>
                  {suggestion.name || suggestion.district}
                </div>
                {suggestion.address && (
                  <div style={{
                    fontSize: '12px', // 减小字体
                    color: '#6b7280',
                    lineHeight: '1.3'
                  }}>
                    {suggestion.address}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 搜索动画样式 */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* 二维码扫描模态框 */}
      <ZXingScannerModern
        isOpen={showQRScanner}
        onClose={() => {
          logger.info('QR扫描器已关闭');
          setShowQRScanner(false);
        }}
        onSuccess={(result) => {
          logger.info('QR扫描成功:', result);
          // 不要在这里关闭扫描器，让用户在扫描器内处理宝藏拾取/埋藏逻辑
          // 扫描器内部会处理显示结果界面
        }}
        onViewBackpack={() => {
          // 关闭扫描器并打开百宝箱面板
          setShowQRScanner(false);
          logger.info('打开百宝箱面板查看藏宝');
          // TODO: 这里应该调用打开百宝箱面板的方法
          // 可能需要通过props传递或者使用全局状态管理
        }}
      />
    </>
  );
}