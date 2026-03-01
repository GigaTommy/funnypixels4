import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { api } from '../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { Badge } from './ui/Badge';
import { Loader2, Lock, Check, ShoppingCart, Palette, Grid3X3, Sparkles } from 'lucide-react';
import { CustomPatternRenderer } from './ui/CustomPatternRenderer';

// 旗帜数据类型定义
interface FlagItem {
  id: string;
  type: 'color' | 'pattern';
  label: string;
  value: string;
  locked: boolean;
  price?: number;
  currency?: 'points' | 'coins';
  category?: string;
  isColorCard?: boolean;
  isCustom?: boolean;
  payload?: string;
  encoding?: string;
}

interface AllianceFlagPickerProps {
  value?: string;
  onChange: (id: string) => void;
  className?: string;
}

// 从API获取旗帜数据，而不是硬编码
const useFlagData = () => {
  const [colors, setColors] = useState<FlagItem[]>([]);
  const [patterns, setPatterns] = useState<FlagItem[]>([]);
  const [customFlags, setCustomFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlagData = async () => {
      try {
        // 并行获取所有可用图案和自定义图案
        const [flagPatternsResponse, customPatternsResponse] = await Promise.all([
          api.get('/alliances/flag-patterns'),
          api.get('/custom-flags/patterns')
        ]);
        
        if (flagPatternsResponse.status === 200) {
          const data = flagPatternsResponse.data;
          
          // 转换颜色数据
          const colorItems = data.patterns.colors.map((pattern: any) => ({
            id: pattern.key,
            type: 'color' as const,
            label: pattern.name,
            value: pattern.color || pattern.unicode_char || pattern.name,
            locked: !pattern.is_free,
            price: pattern.price || 0,
            currency: 'points' as const,
            category: pattern.is_free ? '基础' : '高级',
            isColorCard: !!pattern.color
          }));
          
          // 转换emoji数据
          const emojiItems = data.patterns.emojis.map((pattern: any) => ({
            id: pattern.key,
            type: 'pattern' as const,
            label: pattern.unicode_char || pattern.name,
            value: pattern.unicode_char || pattern.name,
            locked: !pattern.is_free,
            price: pattern.price || 0,
            currency: 'points' as const,
            category: '表情'
          }));
          
          setColors(colorItems);
          setPatterns(emojiItems);
        }
        
        if (customPatternsResponse.status === 200) {
          const customData = customPatternsResponse.data;

          // 转换自定义图案数据
          const customItems = customData.patterns.map((pattern: any) => ({
            id: pattern.key,
            type: 'pattern' as const,
            label: pattern.name,
            value: pattern.name,
            locked: false,
            price: 0,
            currency: 'points' as const,
            category: '自定义',
            isCustom: true,
            payload: pattern.payload,
            encoding: pattern.encoding
          }));

          setCustomFlags(customItems);
        }
      } catch (error) {
        logger.error('加载旗帜数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadFlagData();
  }, []);

  return { colors, patterns, customFlags, loading };
};

export const AllianceFlagPicker: React.FC<AllianceFlagPickerProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'colors' | 'patterns' | 'custom'>('colors');
  const [selectedFlag, setSelectedFlag] = useState<string | undefined>(value);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchaseFlag, setPurchaseFlag] = useState<FlagItem | null>(null);
  
  // 使用自定义hook获取旗帜数据
  const { colors, patterns, customFlags, loading } = useFlagData();

  // 数据加载由useFlagData hook处理

  useEffect(() => {
    setSelectedFlag(value);
  }, [value]);

  // 处理旗帜选择
  const handleFlagSelect = (flag: FlagItem) => {
    if (flag.locked) {
      setPurchaseFlag(flag);
      setShowPurchaseDialog(true);
      return;
    }

    setSelectedFlag(flag.id);
    onChange(flag.id);
  };

  // 处理购买确认
  const handlePurchase = () => {
    if (purchaseFlag) {
      // 跳转到商店页面
      window.location.href = '/store';
    }
    setShowPurchaseDialog(false);
    setPurchaseFlag(null);
  };

  // 渲染旗帜项
  const renderFlagItem = (flag: FlagItem) => {
    const isSelected = selectedFlag === flag.id;
    const isLocked = flag.locked;

    return (
      <div
        key={flag.id}
        style={{
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.3s ease-out',
          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
          zIndex: isSelected ? 10 : 1
        }}
        onClick={() => handleFlagSelect(flag)}
      >
        {/* 卡片背景 */}
        <div style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          backgroundColor: isSelected ? '#4f46e5' : 'white',
          border: isSelected ? '2px solid #4f46e5' : '1px solid #e5e7eb',
          boxShadow: isSelected
            ? '0 4px 12px rgba(79,70,229,0.3)'
            : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.3s ease',
          opacity: isLocked ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* 旗帜内容 */}
          {flag.type === 'color' ? (
            (flag as any).isColorCard ? (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: flag.value,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
            ) : (
              <div style={{
                fontSize: '20px',
                textShadow: isSelected ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                color: isSelected ? 'white' : 'inherit'
              }}>
                {flag.value}
              </div>
            )
          ) : flag.isCustom ? (
            <div style={{ width: '36px', height: '36px' }}>
              <CustomPatternRenderer
                encoding={flag.encoding || 'rle'}
                payload={flag.payload || ''}
                name={flag.label}
                size="md"
                className="w-full h-full"
              />
            </div>
          ) : (
            <div style={{
              fontSize: '16px',
              textShadow: isSelected ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
              color: isSelected ? 'white' : 'inherit'
            }}>
              {flag.label}
            </div>
          )}

          {/* 锁定标记 */}
          {isLocked && (
            <div style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '20px',
              height: '20px',
              backgroundColor: '#4b5563',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              <Lock style={{ width: '12px', height: '12px', color: 'white' }} />
            </div>
          )}

          {/* 价格标记 */}
          {isLocked && flag.price && (
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              padding: '2px 6px',
              backgroundColor: '#f97316',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {flag.price}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染旗帜网格 - 响应式布局
  const renderFlagGrid = (flags: FlagItem[]) => {
    if (flags.length === 0) {
      return (
        <div style={{
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#ef4444',
            fontWeight: 600,
            marginBottom: '8px'
          }}>⚠️ 没有找到旗帜数据</div>
          <div style={{
            color: '#6b7280',
            fontSize: '13px'
          }}>请检查API连接</div>
        </div>
      );
    }

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '8px',
        padding: '8px',
        minHeight: '200px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        {flags.map((flag) => renderFlagItem(flag))}
      </div>
    );
  };

  return (
    <div style={{ width: '100%' }} className={className}>
      {/* 旗帜选择容器 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'colors' | 'patterns' | 'custom')}>
          {/* 分段控制器 */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <TabsList style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              width: '100%',
              backgroundColor: '#f3f4f6',
              padding: '4px',
              borderRadius: '10px',
              gap: '4px'
            }}>
              <TabsTrigger
                value="colors"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'colors' ? 'white' : 'transparent',
                  color: activeTab === 'colors' ? '#111827' : '#6b7280',
                  border: activeTab === 'colors' ? '1px solid #e5e7eb' : 'none',
                  padding: '8px 4px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Palette size={16} />
                <span>颜色 ({colors.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="patterns"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'patterns' ? 'white' : 'transparent',
                  color: activeTab === 'patterns' ? '#111827' : '#6b7280',
                  border: activeTab === 'patterns' ? '1px solid #e5e7eb' : 'none',
                  padding: '8px 4px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Grid3X3 size={16} />
                <span>图案 ({patterns.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'custom' ? 'white' : 'transparent',
                  color: activeTab === 'custom' ? '#111827' : '#6b7280',
                  border: activeTab === 'custom' ? '1px solid #e5e7eb' : 'none',
                  padding: '8px 4px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={16} />
                <span>自定义 ({customFlags.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 旗帜内容区域 */}
          <div style={{ minHeight: '300px' }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
                  <span style={{ color: '#6b7280' }}>加载旗帜中...</span>
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="colors">
                  <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#111827',
                        marginBottom: '4px',
                        margin: '0 0 4px 0'
                      }}>颜色旗帜</h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>选择您喜欢的颜色</p>
                    </div>
                    {renderFlagGrid(colors)}
                  </div>
                </TabsContent>
                <TabsContent value="patterns">
                  <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#111827',
                        marginBottom: '4px',
                        margin: '0 0 4px 0'
                      }}>图案旗帜</h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>选择您喜欢的图案</p>
                    </div>
                    {renderFlagGrid(patterns)}
                  </div>
                </TabsContent>
                <TabsContent value="custom">
                  <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#111827',
                        marginBottom: '4px',
                        margin: '0 0 4px 0'
                      }}>自定义旗帜</h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>选择您上传的自定义图案</p>
                    </div>
                    {customFlags.length > 0 ? (
                      renderFlagGrid(customFlags)
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: '#9ca3af'
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎨</div>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0' }}>暂无自定义旗帜</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>前往商店购买自定义联盟旗帜</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </div>

          {/* 选中状态显示 */}
          {selectedFlag && (() => {
            // 从所有旗帜中查找当前选中的旗帜
            const allFlags = [...colors, ...patterns, ...customFlags];
            const selectedFlagInfo = allFlags.find(f => f.id === selectedFlag);

            return (
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderTop: '1px solid #e0f2fe'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check style={{ width: '16px', height: '16px', color: 'white' }} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#111827'
                    }}>已选择旗帜</div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginTop: '4px'
                    }}>
                      {selectedFlagInfo ? selectedFlagInfo.label : '未知'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Tabs>
      </div>

      {/* 购买对话框 - 现代化设计 */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="sm:max-w-md backdrop-blur-md bg-white/95 border border-white/20">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                <span>购买旗帜</span>
              </div>
            </DialogTitle>
            <DialogDescription>
              这个旗帜需要购买才能使用，点击下方按钮前往商店购买
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-4 py-6">
            {purchaseFlag && (
              <>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-lg">
                  {purchaseFlag.type === 'color' ? (
                    <div
                      className="w-12 h-12 rounded-xl shadow-inner"
                      style={{ background: purchaseFlag.value }}
                    />
                  ) : (
                    <div className="text-3xl">{purchaseFlag.label}</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{purchaseFlag.label}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    价格: <span className="font-medium text-orange-600">{purchaseFlag.price}</span> 
                    <span className="text-gray-500"> {purchaseFlag.currency === 'points' ? '积分' : '金币'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    分类: {purchaseFlag.category}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <div className="flex space-x-3 w-full">
              <Button 
                variant="outline" 
                onClick={() => setShowPurchaseDialog(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button 
                onClick={handlePurchase}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                去商店购买
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};