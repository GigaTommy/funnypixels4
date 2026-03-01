import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Grid, List, Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface PatternMarketProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (patternId: string) => void;
}

interface MarketPattern {
  id: string;
  name: string;
  description: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  preview_url: string;
  price: number;
  category: string;
  tags: string[];
  rating: number;
  review_count: number;
  purchase_count: number;
  created_at: string;
  is_featured: boolean;
  is_new: boolean;
}

export const PatternMarket: React.FC<PatternMarketProps> = ({
  isOpen,
  onClose,
  onPurchase
}) => {
  const [patterns, setPatterns] = useState<MarketPattern[]>([]);
  const [filteredPatterns, setFilteredPatterns] = useState<MarketPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating' | 'price'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [hasMore, setHasMore] = useState(true);

  // 模拟数据 - 实际项目中应该从API获取
  const mockPatterns: MarketPattern[] = [
    {
      id: '1',
      name: '可爱猫咪',
      description: '一只可爱的像素猫咪，适合作为联盟旗帜',
      author: {
        id: 'user1',
        username: '像素艺术家',
        avatar: 'https://via.placeholder.com/32x32'
      },
      preview_url: 'https://via.placeholder.com/64x64/FF6B6B/FFFFFF?text=🐱',
      price: 100,
      category: '动物',
      tags: ['猫咪', '可爱', '像素'],
      rating: 4.8,
      review_count: 25,
      purchase_count: 156,
      created_at: '2024-01-15T10:30:00Z',
      is_featured: true,
      is_new: false
    },
    {
      id: '2',
      name: '中国龙',
      description: '传统中国龙图案，气势磅礴',
      author: {
        id: 'user2',
        username: '传统文化爱好者',
        avatar: 'https://via.placeholder.com/32x32'
      },
      preview_url: 'https://via.placeholder.com/64x64/FFD700/000000?text=🐉',
      price: 200,
      category: '传统文化',
      tags: ['龙', '中国', '传统'],
      rating: 4.9,
      review_count: 42,
      purchase_count: 89,
      created_at: '2024-01-20T14:20:00Z',
      is_featured: true,
      is_new: true
    },
    {
      id: '3',
      name: '科技未来',
      description: '充满科技感的未来风格图案',
      author: {
        id: 'user3',
        username: '科幻迷',
        avatar: 'https://via.placeholder.com/32x32'
      },
      preview_url: 'https://via.placeholder.com/64x64/00D4FF/000000?text=⚡',
      price: 150,
      category: '科技',
      tags: ['科技', '未来', '科幻'],
      rating: 4.6,
      review_count: 18,
      purchase_count: 67,
      created_at: '2024-01-18T09:15:00Z',
      is_featured: false,
      is_new: false
    },
    {
      id: '4',
      name: '樱花季节',
      description: '美丽的樱花图案，充满春天的气息',
      author: {
        id: 'user4',
        username: '自然爱好者',
        avatar: 'https://via.placeholder.com/32x32'
      },
      preview_url: 'https://via.placeholder.com/64x64/FFB6C1/FFFFFF?text=🌸',
      price: 120,
      category: '自然',
      tags: ['樱花', '春天', '自然'],
      rating: 4.7,
      review_count: 31,
      purchase_count: 98,
      created_at: '2024-01-22T16:45:00Z',
      is_featured: false,
      is_new: true
    }
  ];

  // 加载图案数据
  const loadPatterns = useCallback(async () => {
    try {
      setLoading(true);
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPatterns(mockPatterns);
      setFilteredPatterns(mockPatterns);
      setHasMore(mockPatterns.length > itemsPerPage);
    } catch (error) {
      logger.error('加载图案失败:', error);
      setError('加载图案失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

  // 搜索和筛选
  const applyFilters = useCallback(() => {
    let filtered = [...patterns];

    // 搜索筛选
    if (searchTerm) {
      filtered = filtered.filter(pattern =>
        pattern.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pattern.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 分类筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(pattern => pattern.category === selectedCategory);
    }

    // 价格范围筛选
    if (selectedPriceRange !== 'all') {
      const [min, max] = selectedPriceRange.split('-').map(Number);
      filtered = filtered.filter(pattern => {
        if (max) {
          return pattern.price >= min && pattern.price <= max;
        } else {
          return pattern.price >= min;
        }
      });
    }

    // 评分筛选
    if (selectedRating > 0) {
      filtered = filtered.filter(pattern => pattern.rating >= selectedRating);
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'popular':
          return b.purchase_count - a.purchase_count;
        case 'rating':
          return b.rating - a.rating;
        case 'price':
          return a.price - b.price;
        default:
          return 0;
      }
    });

    setFilteredPatterns(filtered);
    setCurrentPage(1);
  }, [patterns, searchTerm, selectedCategory, selectedPriceRange, selectedRating, sortBy]);

  // 应用筛选
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      loadPatterns();
    }
  }, [isOpen, loadPatterns]);

  // 处理购买
  const handlePurchase = useCallback((patternId: string) => {
    onPurchase(patternId);
  }, [onPurchase]);

  // 处理收藏（模拟）
  const handleFavorite = useCallback((patternId: string) => {
    logger.info('收藏图案:', patternId);
    // 实际项目中应该调用API
  }, []);

  // 获取当前页的图案
  const getCurrentPagePatterns = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPatterns.slice(startIndex, startIndex + itemsPerPage);
  };

  // 获取分类列表
  const categories = ['all', '动物', '传统文化', '科技', '自然', '游戏', '艺术'];

  // 获取价格范围选项
  const priceRanges = [
    { value: 'all', label: '全部价格' },
    { value: '0-50', label: '50元以下' },
    { value: '50-100', label: '50-100元' },
    { value: '100-200', label: '100-200元' },
    { value: '200-', label: '200元以上' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col"
      >
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">图案市场</h2>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* 搜索和筛选栏 */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchTerm}
                onChange={(value) => setSearchTerm(value)}
                placeholder="搜索图案..."
                className="pl-10"
              />
            </div>

            {/* 分类筛选 */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2 border rounded-md"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? '全部分类' : category}
                </option>
              ))}
            </select>

            {/* 价格范围 */}
            <select
              value={selectedPriceRange}
              onChange={(e) => setSelectedPriceRange(e.target.value)}
              className="p-2 border rounded-md"
            >
              {priceRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>

            {/* 排序 */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="p-2 border rounded-md"
            >
              <option value="newest">最新发布</option>
              <option value="popular">最受欢迎</option>
              <option value="rating">评分最高</option>
              <option value="price">价格最低</option>
            </select>
          </div>

          {/* 评分筛选 */}
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm font-medium">最低评分:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => setSelectedRating(selectedRating === rating ? 0 : rating)}
                  className={`p-1 rounded ${
                    selectedRating >= rating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  <Star size={16} fill={selectedRating >= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            {selectedRating > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRating(0)}
              >
                清除
              </Button>
            )}
          </div>
        </div>

        {/* 视图切换 */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="text-sm text-gray-600">
            找到 {filteredPatterns.length} 个图案
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              icon={Grid}
            >
              网格
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              icon={List}
            >
              列表
            </Button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">加载中...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <Button onClick={loadPatterns}>重试</Button>
              </div>
            </div>
          ) : getCurrentPagePatterns().length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-600 mb-4">没有找到匹配的图案</p>
                <Button onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedPriceRange('all');
                  setSelectedRating(0);
                }}>
                  清除筛选
                </Button>
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
              <AnimatePresence>
                {getCurrentPagePatterns().map((pattern, index) => (
                  <motion.div
                    key={pattern.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={`h-full ${viewMode === 'list' ? 'flex' : ''}`}>
                      <CardHeader className={viewMode === 'list' ? 'w-1/3' : ''}>
                        <div className="relative">
                          <img
                            src={pattern.preview_url}
                            alt={pattern.name}
                            className={`w-full ${viewMode === 'list' ? 'h-32' : 'h-48'} object-cover rounded-lg`}
                          />
                          {pattern.is_featured && (
                            <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-medium">
                              精选
                            </div>
                          )}
                          {pattern.is_new && (
                            <div className="absolute top-2 right-2 bg-green-400 text-green-900 px-2 py-1 rounded text-xs font-medium">
                              新品
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={viewMode === 'list' ? 'w-2/3' : ''}>
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg">{pattern.name}</h3>
                            <p className="text-gray-600 text-sm line-clamp-2">{pattern.description}</p>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img
                                src={pattern.author.avatar}
                                alt={pattern.author.username}
                                className="w-6 h-6 rounded-full"
                              />
                              <span className="text-sm text-gray-600">{pattern.author.username}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star size={14} className="text-yellow-400" fill="currentColor" />
                              <span className="text-sm">{pattern.rating}</span>
                              <span className="text-xs text-gray-500">({pattern.review_count})</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {pattern.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-lg font-bold text-blue-600">
                              ¥{pattern.price}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleFavorite(pattern.id)}
                                icon={Heart}
                              >
                                收藏
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePurchase(pattern.id)}
                                icon={ShoppingCart}
                              >
                                购买
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>已售 {pattern.purchase_count}</span>
                            <span>{new Date(pattern.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 分页 */}
        {!loading && !error && filteredPatterns.length > itemsPerPage && (
          <div className="flex justify-center items-center p-6 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <span className="px-4 py-2 text-sm">
                第 {currentPage} 页，共 {Math.ceil(filteredPatterns.length / itemsPerPage)} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!hasMore}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
