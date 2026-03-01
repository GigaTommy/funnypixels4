import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { motion } from 'framer-motion';
import { 
  Package, 
  Zap, 
  Palette, 
  Crown, 
  MessageCircle, 
  Award, 
  Bomb, 
  Megaphone,
  Plus,
  Minus,
  Trash2
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { StoreAPI } from '../services/store';
import { CosmeticAPI } from '../services/cosmetic';
import { toast } from 'react-hot-toast';
import { ItemUsageToast } from '../components/ItemUsageToast';
import BombUsageModal from '../components/BombUsageModal';

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  type: string;
  metadata?: any;
  price: number;
  purchasedAt: string;
  expiresAt?: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingItem, setUsingItem] = useState<string | null>(null);
  const [showBombModal, setShowBombModal] = useState(false);
  const [selectedBombItem, setSelectedBombItem] = useState<InventoryItem | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查认证状态
    const checkAuthStatus = async () => {
      try {
        const isAuth = AuthService.isAuthenticated();
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
          await loadInventory();
        } else {
          // 游客模式下不加载库存
          logger.info('👤 游客模式，跳过库存加载');
          setLoading(false);
        }
      } catch (error) {
        logger.error('检查认证状态失败:', error);
        setLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await StoreAPI.getInventory();
      setInventory(response.data || []);
    } catch (error) {
      logger.error('加载库存失败:', error);
      toast.error('加载库存失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUseItem = useCallback(async (item: InventoryItem) => {
    if (usingItem) return;

    try {
      setUsingItem(item.id);
      
      // 根据道具类型执行不同的使用逻辑
      switch (item.type) {
        case 'pixel_boost':
        case 'consumable':
          // 直接使用像素加速器或消耗品
          const response = await StoreAPI.useItem(item.id, 1);
          if (response.success) {
            ItemUsageToast.showSuccess(item.name, response.effects);
          }
          break;
          
        case 'bomb':
          // 显示炸弹使用模态框
          setSelectedBombItem(item);
          setShowBombModal(true);
          return; // 不重新加载库存，等模态框关闭后再加载
          
        case 'pattern':
        case 'frame':
        case 'bubble':
        case 'badge':
          // 装饰道具，使用装饰品API
          try {
            const cosmeticResponse = await CosmeticAPI.useCosmeticFromInventory(item.id);
            if (cosmeticResponse.success) {
              toast.success(`${cosmeticResponse.cosmetic.display_name} 使用成功！`);
              ItemUsageToast.showSuccess(cosmeticResponse.cosmetic.display_name, {
                message: '装饰品已装备到个人资料',
                type: 'cosmetic'
              });
            }
          } catch (cosmeticError: any) {
            logger.error('使用装饰品失败:', cosmeticError);
            ItemUsageToast.showError(cosmeticError.message || '使用装饰品失败', item.name);
            return; // 装饰品使用失败时不重新加载库存
          }
          break;
          
        case 'ad':
          // 广告道具，跳转到广告页面
          window.location.href = '/advertising';
          return;
          
        default:
          // 默认直接使用
          const defaultResponse = await StoreAPI.useItem(item.id, 1);
          if (defaultResponse.success) {
            ItemUsageToast.showSuccess(item.name, defaultResponse.effects);
          }
      }
      
      await loadInventory(); // 重新加载库存
    } catch (error: any) {
      logger.error('使用道具失败:', error);
      ItemUsageToast.showError(error.message || '使用道具失败', item.name);
    } finally {
      setUsingItem(null);
    }
  }, [usingItem, loadInventory]);

  const handleBombUse = useCallback(async (lat: number, lng: number) => {
    if (!selectedBombItem) return;
    
    try {
      // 炸弹使用逻辑已在模态框中处理
      toast.success(`${selectedBombItem.name} 使用成功！坐标: (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      await loadInventory(); // 重新加载库存
    } catch (error) {
      logger.error('炸弹使用失败:', error);
      toast.error('炸弹使用失败');
    }
  }, [selectedBombItem, loadInventory]);

  const handleCloseBombModal = useCallback(() => {
    setShowBombModal(false);
    setSelectedBombItem(null);
    loadInventory(); // 重新加载库存
  }, [loadInventory]);

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'pixel_boost':
        return <Zap className="w-6 h-6 text-yellow-500" />;
      case 'pattern':
        return <Palette className="w-6 h-6 text-purple-500" />;
      case 'frame':
        return <Crown className="w-6 h-6 text-yellow-600" />;
      case 'bubble':
        return <MessageCircle className="w-6 h-6 text-blue-500" />;
      case 'badge':
        return <Award className="w-6 h-6 text-green-500" />;
      case 'bomb':
        return <Bomb className="w-6 h-6 text-red-500" />;
      case 'ad':
        return <Megaphone className="w-6 h-6 text-orange-500" />;
      default:
        return <Package className="w-6 h-6 text-gray-500" />;
    }
  };

  const getItemColor = (type: string) => {
    switch (type) {
      case 'pixel_boost':
        return 'bg-yellow-50 border-yellow-200';
      case 'pattern':
        return 'bg-purple-50 border-purple-200';
      case 'frame':
        return 'bg-yellow-50 border-yellow-200';
      case 'bubble':
        return 'bg-blue-50 border-blue-200';
      case 'badge':
        return 'bg-green-50 border-green-200';
      case 'bomb':
        return 'bg-red-50 border-red-200';
      case 'ad':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getItemTypeName = (type: string) => {
    switch (type) {
      case 'pixel_boost':
        return '像素加速器';
      case 'pattern':
        return '图案';
      case 'frame':
        return '头像框';
      case 'bubble':
        return '聊天气泡';
      case 'badge':
        return '徽章';
      case 'bomb':
        return '炸弹';
      case 'ad':
        return '广告';
      default:
        return '道具';
    }
  };

  const getUseAction = (item: InventoryItem) => {
    switch (item.type) {
      case 'pixel_boost':
        return {
          text: '立即使用',
          action: () => handleUseItem(item),
          description: '恢复像素点数',
          disabled: false
        };
      case 'pattern':
        return {
          text: '设置旗帜',
          action: () => window.location.href = '/alliances',
          description: '在联盟设置中使用',
          disabled: false
        };
      case 'frame':
        return {
          text: '使用道具',
          action: () => handleUseItem(item),
          description: '装备到个人资料',
          disabled: false
        };
      case 'bubble':
        return {
          text: '使用道具',
          action: () => handleUseItem(item),
          description: '装备到个人资料',
          disabled: false
        };
      case 'badge':
        return {
          text: '使用道具',
          action: () => handleUseItem(item),
          description: '装备到个人资料',
          disabled: false
        };
      case 'bomb':
        return {
          text: '使用炸弹',
          action: () => {
            setSelectedBombItem(item);
            setShowBombModal(true);
          },
          description: '在地图上使用',
          disabled: false
        };
      case 'ad':
        return {
          text: '投放广告',
          action: () => window.location.href = '/advertising',
          description: '在广告系统中使用',
          disabled: false
        };
      default:
        return {
          text: '使用道具',
          action: () => handleUseItem(item),
          description: '使用道具',
          disabled: false
        };
    }
  };

  const groupItemsByType = (items: InventoryItem[]) => {
    const groups: Record<string, InventoryItem[]> = {};
    items.forEach(item => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
    });
    return groups;
  };

  const groupedInventory = groupItemsByType(inventory);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // 游客模式提示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">我的库存</h1>
            <p className="text-gray-600">管理您的道具和装备</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">游客模式下无法查看库存</h2>
            <p className="text-gray-600 mb-6">请登录以查看和管理您的道具库存</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              立即登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">我的库存</h1>
          <p className="text-gray-600">管理您的道具和装备</p>
        </div>

        {/* 库存统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">总道具数</p>
                <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">可消耗道具</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {inventory.filter(item => item.type === 'pixel_boost').length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">炸弹道具</p>
                <p className="text-2xl font-bold text-red-600">
                  {inventory.filter(item => item.type === 'bomb').length}
                </p>
              </div>
              <Bomb className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">装饰道具</p>
                <p className="text-2xl font-bold text-purple-600">
                  {inventory.filter(item => ['frame', 'bubble', 'badge', 'pattern'].includes(item.type)).length}
                </p>
              </div>
              <Crown className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* 道具分类展示 */}
        {Object.keys(groupedInventory).length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">库存为空</h3>
            <p className="text-gray-500 mb-4">您还没有任何道具，去商店购买一些吧！</p>
            <button
              onClick={() => window.location.href = '/store'}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              前往商店
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedInventory).map(([type, items]) => (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-6">
                  {getItemIcon(type)}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{getItemTypeName(type)}</h2>
                    <p className="text-sm text-gray-500">{items.length} 个道具</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const useAction = getUseAction(item);
                    return (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.02 }}
                        className={`border rounded-xl p-4 ${getItemColor(item.type)}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getItemIcon(item.type)}
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                          </div>
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-xs font-medium">
                            <span>{item.quantity}</span>
                            <Package className="w-3 h-3" />
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {useAction.description}
                          </span>
                          <button
                            onClick={useAction.action}
                            disabled={useAction.disabled || usingItem === item.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              useAction.disabled || usingItem === item.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            {usingItem === item.id ? (
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                使用中...
                              </div>
                            ) : (
                              useAction.text
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 炸弹使用模态框 */}
      {selectedBombItem && (
        <BombUsageModal
          isOpen={showBombModal}
          onClose={handleCloseBombModal}
          bombItem={selectedBombItem}
          onUseBomb={handleBombUse}
        />
      )}
    </div>
  );
}
