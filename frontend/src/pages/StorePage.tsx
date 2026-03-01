import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Package,
  Coins,
  CreditCard,
  Wallet,
  CheckCircle,
  Zap,
  Paintbrush,
  MapPin,
  Sparkles,
  Bomb,
  Megaphone,
  Flag
} from 'lucide-react';
import { StoreAPI } from '../services/store';
import { CosmeticAPI } from '../services/cosmetic';
import { AuthService } from '../services/auth';
import { config } from '../config/env';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import BombUsageModal from '../components/BombUsageModal';
import AdUsageModal from '../components/AdUsageModal';
import { CustomFlagDialog } from '../components/CustomFlagDialog';
import { AdPurchaseDialog } from '../components/AdPurchaseDialog';
import { soundService } from '../services/soundService';
import { ThrowBottleModal, ThrowBottleData } from '../components/driftbottle/ThrowBottleModal';
import { driftBottleService } from '../services/driftBottle';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'consumable' | 'decoration' | 'special' | 'advertisement' | 'custom_flag';
  icon: string;
  category: string;
  effects?: string[];
  requirements?: string[];
  // 广告商品特有属性
  width?: number;
  height?: number;
  size_type?: string;
  ad_product_id?: string;
}

type TabType = 'shop' | 'inventory' | 'recharge' | 'orders';

interface StorePageProps {
  onAdPageNavigation?: (page: 'ad-inventory' | 'ad-review') => void;
}

export default function StorePage({ onAdPageNavigation }: StorePageProps) {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('shop');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTabValue, setActiveTabValue] = useState("shop");
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [rechargeChannel, setRechargeChannel] = useState<'wechat' | 'alipay' | 'mock'>('mock');
  const [recharging, setRecharging] = useState(false);
  const [rechargeOrders, setRechargeOrders] = useState<any[]>([]);
  const [showCustomFlagDialog, setShowCustomFlagDialog] = useState(false);
  const [customFlagOrders, setCustomFlagOrders] = useState<any[]>([]);
  const [allCustomFlagOrders, setAllCustomFlagOrders] = useState<any[]>([]);
  const [adOrders, setAdOrders] = useState<any[]>([]);
  const [allAdOrders, setAllAdOrders] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [selectedAdItem, setSelectedAdItem] = useState<StoreItem | null>(null);

  // 新的广告购买对话框状态
  const [showAdPurchaseDialog, setShowAdPurchaseDialog] = useState(false);

  // 炸弹使用模态框状态
  const [showBombModal, setShowBombModal] = useState(false);
  const [selectedBombItem, setSelectedBombItem] = useState<any>(null);

  // 广告使用模态框状态
  const [showAdUsageModal, setShowAdUsageModal] = useState(false);
  const [selectedAdUsageItem, setSelectedAdUsageItem] = useState<any>(null);

  // 漂流瓶使用模态框状态
  const [showThrowBottleModal, setShowThrowBottleModal] = useState(false);

  // 广告库存（来自 user_ad_inventory 表）
  const [adInventory, setAdInventory] = useState<any[]>([]);

  // 充值订单倒计时刷新
  const [countdownTrigger, setCountdownTrigger] = useState(0);

  // 将后端分类映射为前端分类
  const mapCategory = (backendCategory: string) => {
    switch (backendCategory) {
      case 'color':
      case 'emoji':
      case 'pixel_boost':
        return 'consumable'; // 消耗品：颜色和表情符号、像素加速器
      case 'cosmetic':
      case 'avatar_frame':
      case 'chat_bubble':
      case 'achievement_badge':
      case 'leadership_badge':
        return 'cosmetic'; // 装饰品：头像框、聊天气泡、徽章等
      case 'alliance_flags':
      case 'bomb':
        return 'special'; // 特殊道具：联盟旗帜、炸弹
      case 'custom':
        return 'custom-flags'; // 自定义旗帜
      case 'advertisement':
      case 'ad':
        return 'advertisement'; // 广告
      default:
        return backendCategory;
    }
  };

  // 获取分类图标
  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'all':
        return ShoppingBag;
      case 'consumable':
        return Zap;
      case 'cosmetic':
        return Paintbrush;
      case 'special':
        return Sparkles;
      case 'custom-flags':
        return Flag;
      case 'advertisement':
        return Megaphone;
      default:
        return ShoppingBag;
    }
  };

  // 优化性能：缓存分类和标签页选项
  const categories = useMemo(() => {
    // 订单页面显示订单类型筛选
    if (activeTabValue === 'orders') {
      return [
        { id: 'all', name: '全部订单', icon: Wallet },
        { id: 'custom_flag', name: '自定义旗帜', icon: Flag },
        { id: 'advertisement', name: '广告订单', icon: Megaphone },
        { id: 'recharge', name: '充值订单', icon: CreditCard }
      ];
    }

    // 充值页面不显示菜单
    if (activeTabValue === 'recharge') {
      return [];
    }

    // 其他页面显示商品分类
    return [
      { id: 'all', name: '全部', icon: getCategoryIcon('all') },
      { id: 'consumable', name: '消耗品', icon: getCategoryIcon('consumable') },
      { id: 'cosmetic', name: '装饰品', icon: getCategoryIcon('cosmetic') },
      { id: 'special', name: '特殊道具', icon: getCategoryIcon('special') },
      { id: 'custom-flags', name: '自定义旗帜', icon: getCategoryIcon('custom-flags') },
      { id: 'advertisement', name: '广告', icon: getCategoryIcon('advertisement') }
    ];
  }, [activeTabValue]);

  const tabs = useMemo(() => [
    { id: 'shop', label: '商店', icon: ShoppingBag },
    { id: 'inventory', label: '库存', icon: Package },
    { id: 'recharge', label: '充值', icon: CreditCard },
    { id: 'orders', label: '订单', icon: Wallet }
  ], []);

  // 优化性能：缓存过滤结果
  const filteredItems = useMemo(() => {
    const filtered = items.filter(item => selectedCategory === 'all' || item.category === selectedCategory);
    logger.info('🔍 商品过滤结果:', {
      activeTabValue,
      selectedCategory,
      totalItems: items.length,
      filteredCount: filtered.length,
      itemCategories: items.map(item => ({ id: item.id, category: item.category, name: item.name }))
    });
    return filtered;
  }, [items, selectedCategory, activeTabValue]);

  const filteredInventory = useMemo(() => {
    const filtered = inventory.filter(item => selectedCategory === 'all' || item.category === selectedCategory);
    logger.info('🔍 库存过滤结果:', {
      activeTabValue,
      selectedCategory,
      totalInventory: inventory.length,
      filteredCount: filtered.length,
      inventoryCategories: inventory.map(item => ({ id: item.id, name: item.name, category: item.category, item_type: item.item_type })),
      filteredItems: filtered.map(item => ({ id: item.id, name: item.name, category: item.category }))
    });
    return filtered;
  }, [inventory, selectedCategory, activeTabValue]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadStoreData();
    }
  }, [currentUser]);

  // 当标签页切换时，重置选择的分类
  useEffect(() => {
    if (activeTabValue === 'shop' || activeTabValue === 'inventory') {
      setSelectedCategory('all'); // 商店和库存页面默认选择全部
    } else if (activeTabValue === 'orders') {
      setSelectedCategory('all'); // 订单页面默认选择全部
    } else {
      setSelectedCategory('all'); // 其他页面默认选择全部
    }
  }, [activeTabValue]);

  // 调试：监控商店状态
  useEffect(() => {
    if (activeTabValue === 'shop') {
      logger.info('🏪 商店页面状态调试:', {
        activeTabValue,
        selectedCategory,
        itemsCount: items.length,
        filteredItemsCount: filteredItems.length,
        categoriesCount: categories.length,
        loading,
        categories: categories.map(c => c.id)
      });
    }
  }, [activeTabValue, selectedCategory, items.length, filteredItems.length, categories.length, loading]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const user = await AuthService.getCurrentUser();
      logger.info('🔍 StorePage 获取到用户信息:', user);
      setCurrentUser(user);
    } catch (error) {
      logger.error('获取当前用户失败:', error);
    }
  }, []);

  // 处理支付成功参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      setShowPaymentSuccess(true);
      // 重新加载用户积分
      loadStoreData();
      // 5秒后隐藏成功提示
      setTimeout(() => {
        setShowPaymentSuccess(false);
      }, 5000);
    }
  }, []);

  // 充值订单倒计时器 - 每秒更新一次
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTrigger(prev => prev + 1);
    }, 1000); // 每秒更新一次

    return () => clearInterval(timer);
  }, []);

  const loadStoreData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsResponse, inventoryResponse, userResponse, ordersResponse, customFlagOrdersResponse, adOrdersResponse, adInventoryResponse] = await Promise.all([
        StoreAPI.getItems(),
        StoreAPI.getInventory(),
        StoreAPI.getUserPoints(),
        StoreAPI.getRechargeOrders(),
        // 加载自定义旗帜订单
        fetch(`${config.API_BASE_URL}/api/custom-flags/orders`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}` }
        }).then(res => res.json()).catch(() => ({ orders: [] })),
        // 加载广告订单
        fetch(`${config.API_BASE_URL}/api/ads/orders`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}` }
        }).then(res => res.json()).catch(() => ({ orders: [] })),
        // 加载广告库存
        fetch(`${config.API_BASE_URL}/api/ads/inventory`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}` }
        }).then(res => res.json()).catch(() => ({ inventory: [] }))
      ]);

      logger.info('🛒 商店数据加载完成:', {
        itemsCount: itemsResponse.data?.length || 0,
        inventoryCount: inventoryResponse.data?.length || 0,
        userPoints: userResponse.points,
        itemsCategories: itemsResponse.data?.map((item: any) => item.category)
      });

      // 映射商品分类
      const mappedItems = (itemsResponse.data || []).map((item: any) => {
        // 优先使用metadata中的分类，如果没有则使用category字段
        const backendCategory = item.metadata?.category || item.category;
        return {
          ...item,
          category: mapCategory(backendCategory)
        };
      });

      // 映射库存商品分类
      logger.info('📦 原始库存数据:', inventoryResponse.data);

      const mappedInventory = (inventoryResponse.data || []).map((item: any) => {
        // 优先使用 metadata.category，然后是 item_type，最后是 category
        const backendCategory = item.metadata?.category || item.item_type || item.category;
        const mappedCategory = mapCategory(backendCategory);
        logger.info('🔍 库存项映射:', {
          name: item.name,
          original_item_type: item.item_type,
          original_category: item.category,
          metadata_category: item.metadata?.category,
          backend_category: backendCategory,
          mapped_category: mappedCategory
        });
        return {
          ...item,
          category: mappedCategory
        };
      });

      logger.info('🔄 分类映射完成:', {
        originalCategories: itemsResponse.data?.map((item: any) => item.category),
        mappedCategories: mappedItems.map((item: any) => item.category),
        inventoryOriginalTypes: inventoryResponse.data?.map((item: any) => item.item_type || item.category),
        inventoryMappedCategories: mappedInventory.map((item: any) => item.category)
      });

      setItems(mappedItems);
      setInventory(mappedInventory);
      setUserPoints(userResponse.points || 0);
      setRechargeOrders(ordersResponse.data || []);
      setCustomFlagOrders(customFlagOrdersResponse.orders || []);
      setAdOrders(adOrdersResponse.orders || []);
      setAdInventory(adInventoryResponse.inventory || []);

      // 如果是管理员，加载所有待审核的订单
      logger.info('🔍 检查管理员权限:', { currentUser, role: currentUser?.role });
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
        logger.info('✅ 检测到管理员用户，加载待审核订单...');
        try {
          const [allCustomOrdersResponse, allAdOrdersResponse] = await Promise.all([
            // 加载所有待审核的自定义旗帜订单
            fetch(`${config.API_BASE_URL}/api/custom-flags/admin/orders`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            }).then(async res => {
              logger.info('📋 自定义旗帜订单API响应状态:', res.status);
              if (!res.ok) {
                throw new Error(`API错误: ${res.status} ${res.statusText}`);
              }
              const data = await res.json();
              logger.info('📋 自定义旗帜订单API响应数据:', data);
              return data;
            }).catch(error => {
              logger.error('❌ 加载自定义旗帜订单失败:', error);
              return { success: false, orders: [], error: error.message };
            }),
            // 加载所有待审核的广告订单
            fetch(`${config.API_BASE_URL}/api/ads/admin/orders/pending`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}` }
            }).then(async res => {
              logger.info('📋 广告订单API响应状态:', res.status);
              if (!res.ok) {
                throw new Error(`API错误: ${res.status} ${res.statusText}`);
              }
              const data = await res.json();
              logger.info('📋 广告订单API响应数据:', data);
              return data;
            }).catch(error => {
              logger.error('❌ 加载广告订单失败:', error);
              return { success: false, orders: [], error: error.message };
            })
          ]);

          logger.info('📋 待审核自定义旗帜订单数据:', allCustomOrdersResponse);
          logger.info('📋 待审核广告订单数据:', allAdOrdersResponse);

          // 检查API响应是否成功
          if (allCustomOrdersResponse.success) {
            setAllCustomFlagOrders(allCustomOrdersResponse.orders || []);
          } else {
            logger.error('❌ 自定义旗帜订单API返回失败:', allCustomOrdersResponse.error);
            setAllCustomFlagOrders([]);
          }

          if (allAdOrdersResponse.success) {
            setAllAdOrders(allAdOrdersResponse.orders || []);
          } else {
            logger.error('❌ 广告订单API返回失败:', allAdOrdersResponse.error);
            setAllAdOrders([]);
          }
        } catch (error) {
          logger.error('❌ 加载所有待审核订单失败:', error);
          setAllCustomFlagOrders([]);
          setAllAdOrders([]);
        }
      } else {
        logger.info('❌ 非管理员用户，跳过加载待审核订单');
      }
    } catch (error) {
      logger.error('加载商店数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const handlePurchase = useCallback(async (item: StoreItem) => {
    if (purchasing || userPoints < item.price) return;

    // 播放点击音效
    soundService.play('click');

    // 如果是广告商品，显示新的广告购买对话框
    if (item.type === 'advertisement') {
      setSelectedAdItem(item);
      setShowAdPurchaseDialog(true);
      return;
    }

    // 如果是自定义旗帜商品，显示自定义旗帜对话框
    if (item.type === 'custom_flag' || item.id.startsWith('custom_flag_')) {
      setShowCustomFlagDialog(true);
      return;
    }

    try {
      setPurchasing(item.id);
      await StoreAPI.purchaseItem(item.id, 1);
      await loadStoreData();

      // 成功提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300';
      notification.innerHTML = `<div class="flex items-center space-x-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>${item.name} 购买成功！</span></div>`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 2000);
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `购买失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    } finally {
      setPurchasing(null);
    }
  }, [purchasing, userPoints, loadStoreData]);

  const handleUseItem = useCallback(async (itemId: string) => {
    // 播放点击音效
    soundService.play('click');

    try {
      // 首先获取道具信息，判断道具类型
      const inventoryItem = inventory.find(item => (item.item_id || item.id) === itemId);

      logger.info('🔍 查找库存道具:', { itemId, inventoryItem, inventory });

      // 检查是否为广告道具
      const isAdItem = inventoryItem && inventoryItem.item_type === 'advertisement';

      // 检查是否为炸弹道具（item_type为'bomb'或'special'且名称包含"炸弹"）
      const isBombItem = inventoryItem && (
        inventoryItem.item_type === 'bomb' ||
        (inventoryItem.item_type === 'special' && inventoryItem.name.includes('炸弹'))
      );

      // 检查是否为装饰品道具
      const isCosmeticItem = inventoryItem && inventoryItem.item_type === 'cosmetic';

      logger.info('🔍 道具类型检查:', {
        item_type: inventoryItem?.item_type,
        name: inventoryItem?.name,
        isAd: isAdItem,
        isBomb: isBombItem,
        isCosmetic: isCosmeticItem,
        allItemTypes: inventory.map(item => ({ name: item.name, type: item.item_type }))
      });

      if (isAdItem) {
        logger.info('📢 检测到广告道具，查找广告库存记录');
        // 广告道具，需要从广告库存中查找对应的记录
        // 查找第一个未使用的广告库存
        const adInventoryItem = adInventory.find(item => !item.isUsed);

        logger.info('🔍 广告库存查找结果:', {
          adInventory,
          adInventoryItem,
          totalAdInventory: adInventory.length,
          unusedAdInventory: adInventory.filter(item => !item.isUsed).length
        });

        if (!adInventoryItem) {
          const notification = document.createElement('div');
          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
          notification.textContent = '没有可用的广告库存，请先购买广告并等待审核';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 3000);
          return;
        }

        // 显示使用模态框，传递广告库存记录
        // 转换字段名以匹配 AdUsageModal 的期望格式
        const formattedAdItem = {
          ...adInventoryItem,
          name: adInventoryItem.adTitle || adInventoryItem.productName,
          size_type: adInventoryItem.sizeType
        };
        setSelectedAdUsageItem(formattedAdItem);
        setShowAdUsageModal(true);
        logger.info('📢 广告模态框状态已设置:', { showAdUsageModal: true, selectedAdUsageItem: formattedAdItem });
        return;
      }

      if (isBombItem) {
        logger.info('💣 检测到炸弹道具，显示模态框');
        // 炸弹道具，显示使用模态框
        setSelectedBombItem(inventoryItem);
        setShowBombModal(true);
        logger.info('💣 模态框状态已设置:', { showBombModal: true, selectedBombItem: inventoryItem });
        return;
      }

      if (isCosmeticItem) {
        logger.info('🎨 检测到装饰品道具，使用装饰品API');
        // 装饰品道具，使用装饰品API
        try {
          const cosmeticResponse = await CosmeticAPI.useCosmeticFromInventory(itemId);
          if (cosmeticResponse.success) {
            const notification = document.createElement('div');
            notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
            notification.textContent = `${cosmeticResponse.cosmetic.display_name} 使用成功！`;
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.style.opacity = '0';
              setTimeout(() => document.body.removeChild(notification), 300);
            }, 2000);

            await loadStoreData(); // 重新加载数据
          }
        } catch (cosmeticError: any) {
          logger.error('使用装饰品失败:', cosmeticError);
          const notification = document.createElement('div');
          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
          notification.textContent = `装饰品使用失败: ${cosmeticError.message || '未知错误'}`;
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 3000);
        }
        return;
      }

      // 检查是否为漂流瓶道具
      const isDriftBottleItem = inventoryItem && inventoryItem.item_type === 'drift_bottle';

      if (isDriftBottleItem) {
        logger.info('🌊 检测到漂流瓶道具，显示使用模态框');
        // 显示漂流瓶使用模态框
        setShowThrowBottleModal(true);
        return;
      }

      // 其他道具直接使用
      await StoreAPI.useItem(itemId);
      await loadStoreData();

      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = '道具使用成功！';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 2000);
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `使用失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [inventory, adInventory, loadStoreData, onAdPageNavigation]);

  const handleBombUse = useCallback(async (lat: number, lng: number) => {
    if (!selectedBombItem) return;

    try {
      // 炸弹使用逻辑已在模态框中处理
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `${selectedBombItem.name} 使用成功！坐标: (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);

      await loadStoreData(); // 重新加载库存
    } catch (error) {
      logger.error('炸弹使用失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = '炸弹使用失败';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [selectedBombItem, loadStoreData]);

  const handleCloseBombModal = useCallback(() => {
    setShowBombModal(false);
    setSelectedBombItem(null);
    loadStoreData(); // 重新加载库存
  }, [loadStoreData]);

  // 广告使用模态框处理函数
  const handleAdUsage = useCallback(async (lat: number, lng: number) => {
    if (!selectedAdUsageItem) return;

    try {
      // 获取认证token
      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        throw new Error('用户未登录，请先登录');
      }

      // 准备请求数据
      const requestData = {
        inventoryId: selectedAdUsageItem.id,
        centerLat: lat,
        centerLng: lng
      };

      logger.info('📢 准备使用广告道具:', {
        selectedAdUsageItem,
        requestData,
        lat,
        lng
      });

      // 调用广告使用API
      const response = await fetch('/api/ads/inventory/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      logger.info('📢 广告使用API响应:', {
        status: response.status,
        ok: response.ok,
        data
      });

      if (data.success) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = `${selectedAdUsageItem.name} 使用成功！共放置了${data.placement.pixelCount}个像素点`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);

        // 关闭模态框并重新加载数据
        setShowAdUsageModal(false);
        setSelectedAdUsageItem(null);
        await loadStoreData();
      } else {
        logger.error('❌ 广告使用失败，完整错误信息:', data);
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = `广告使用失败: ${data.message || '未知错误'}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
      }
    } catch (error) {
      logger.error('广告使用失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `广告使用失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [selectedAdUsageItem, loadStoreData]);

  const handleCloseAdUsageModal = useCallback(() => {
    setShowAdUsageModal(false);
    setSelectedAdUsageItem(null);
    loadStoreData(); // 重新加载库存
  }, [loadStoreData]);

  // 漂流瓶抛出处理函数
  const handleThrowBottle = useCallback(async (data: ThrowBottleData) => {
    try {
      logger.info('🌊 准备抛出漂流瓶:', data);

      // 尝试快速获取用户当前位置（不阻塞用户操作）
      let userLocation: { lat: number; lng: number } | null = null;

      try {
        userLocation = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          if (!navigator.geolocation) {
            logger.warn('浏览器不支持地理定位');
            resolve(null);
            return;
          }

          const timeout = setTimeout(() => {
            logger.warn('获取位置超时，使用随机位置');
            resolve(null);
          }, 2000); // 2秒超时

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              logger.info('📍 成功获取用户位置:', coords);
              resolve(coords);
            },
            (error) => {
              clearTimeout(timeout);
              logger.warn('获取位置失败，将使用随机位置:', error.message);
              resolve(null);
            },
            {
              enableHighAccuracy: false,
              timeout: 1500,
              maximumAge: 300000 // 5分钟缓存
            }
          );
        });
      } catch (error) {
        logger.error('位置获取异常:', error);
      }

      // 调用API，传递位置信息（如果有的话）
      const result = await driftBottleService.useBottle({
        title: data.title,
        content: data.content,
        image: data.image,
        lat: userLocation?.lat,
        lng: userLocation?.lng
      });

      if (result.success) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '🌊 漂流瓶已抛入大海，开始它的旅程！';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);

        // 关闭模态框并重新加载数据
        setShowThrowBottleModal(false);
        await loadStoreData();
      } else {
        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = `抛出失败: ${result.message || '未知错误'}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
      }
    } catch (error) {
      logger.error('抛出漂流瓶失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `抛出失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [loadStoreData]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    // 播放点击音效
    soundService.play('click');
    setSelectedCategory(category);
  }, []);

  // 标签切换处理函数
  const handleTabChangeClick = useCallback((tabId: string) => {
    // 播放点击音效
    soundService.play('click');
    setActiveTabValue(tabId);
  }, []);

  // 充值金额选择处理函数
  const handleRechargeAmountSelect = useCallback((amount: number) => {
    // 播放点击音效
    soundService.play('click');
    setRechargeAmount(amount);
  }, []);

  // 充值渠道选择处理函数
  const handleRechargeChannelSelect = useCallback((channel: 'wechat' | 'alipay' | 'mock') => {
    // 播放点击音效
    soundService.play('click');
    setRechargeChannel(channel);
  }, []);

  // 管理员审核订单
  const handleApproveOrder = useCallback(async (orderId: string) => {
    // 播放确认音效
    soundService.play('confirm');

    try {
      logger.info('🔄 开始审批订单:', orderId);

      // 先验证订单是否仍然存在且为pending状态
      const verifyResponse = await fetch(`${config.API_BASE_URL}/api/custom-flags/admin/orders`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!verifyResponse.ok) {
        throw new Error(`验证订单失败: ${verifyResponse.status}`);
      }

      const verifyData = await verifyResponse.json();
      logger.info('🔍 验证API返回的数据:', verifyData);
      logger.info('🔍 当前allCustomFlagOrders状态:', allCustomFlagOrders);

      const targetOrder = verifyData.orders?.find((order: any) => order.id === orderId);
      logger.info('🔍 在验证API中找到的目标订单:', targetOrder);

      if (!targetOrder) {
        logger.warn('⚠️ 订单不存在或已被处理:', orderId);
        logger.info('🔍 本地状态中的订单:', allCustomFlagOrders.find((order: any) => order.id === orderId));

        // 重新加载数据以更新界面
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '订单不存在或已被处理，已刷新数据';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
        return;
      }

      if (targetOrder.status !== 'pending') {
        logger.warn('⚠️ 订单状态不是pending:', targetOrder.status);
        // 重新加载数据以更新界面
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = `订单状态为${targetOrder.status}，已刷新数据`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
        return;
      }

      logger.info('✅ 订单验证通过，开始审批...');

      const response = await fetch(`${config.API_BASE_URL}/api/custom-flags/admin/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          action: 'approve'
        })
      });

      logger.info('📋 审批API响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        logger.info('📋 审批API响应数据:', result);

        // 重新加载数据
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '订单已批准';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('❌ 审批失败:', response.status, errorData);
        throw new Error(`批准失败: ${response.status} ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      logger.error('❌ 审批订单失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `批准失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [loadStoreData]);

  const handleRejectOrder = useCallback(async (orderId: string) => {
    // 播放取消音效（暂时使用click音效）
    soundService.play('cancel');

    try {
      logger.info('🔄 开始拒绝订单:', orderId);

      // 先验证订单是否仍然存在且为pending状态
      const verifyResponse = await fetch(`${config.API_BASE_URL}/api/custom-flags/admin/orders`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!verifyResponse.ok) {
        throw new Error(`验证订单失败: ${verifyResponse.status}`);
      }

      const verifyData = await verifyResponse.json();
      logger.info('🔍 验证API返回的数据:', verifyData);
      logger.info('🔍 当前allCustomFlagOrders状态:', allCustomFlagOrders);

      const targetOrder = verifyData.orders?.find((order: any) => order.id === orderId);
      logger.info('🔍 在验证API中找到的目标订单:', targetOrder);

      if (!targetOrder) {
        logger.warn('⚠️ 订单不存在或已被处理:', orderId);
        logger.info('🔍 本地状态中的订单:', allCustomFlagOrders.find((order: any) => order.id === orderId));

        // 重新加载数据以更新界面
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '订单不存在或已被处理，已刷新数据';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
        return;
      }

      if (targetOrder.status !== 'pending') {
        logger.warn('⚠️ 订单状态不是pending:', targetOrder.status);
        // 重新加载数据以更新界面
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = `订单状态为${targetOrder.status}，已刷新数据`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
        return;
      }

      logger.info('✅ 订单验证通过，开始拒绝...');

      const response = await fetch(`${config.API_BASE_URL}/api/custom-flags/admin/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          action: 'reject'
        })
      });

      logger.info('📋 拒绝API响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        logger.info('📋 拒绝API响应数据:', result);

        // 重新加载数据
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '订单已拒绝';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('❌ 拒绝失败:', response.status, errorData);
        throw new Error(`拒绝失败: ${response.status} ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      logger.error('❌ 拒绝订单失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `拒绝失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [loadStoreData]);

  // 广告订单处理函数
  const handleApproveAdOrder = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/ads/admin/orders/${orderId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'approve'
        })
      });

      if (response.ok) {
        // 重新加载数据
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '广告订单已批准';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } else {
        throw new Error('批准失败');
      }
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = '批准失败';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [loadStoreData]);

  const handleRejectAdOrder = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/ads/admin/orders/${orderId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reject'
        })
      });

      if (response.ok) {
        // 重新加载数据
        await loadStoreData();

        const notification = document.createElement('div');
        notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
        notification.textContent = '广告订单已拒绝';
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } else {
        throw new Error('拒绝失败');
      }
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = '拒绝失败';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, [loadStoreData]);

  const handleRecharge = useCallback(async () => {
    if (recharging) return;

    // 播放确认音效
    soundService.play('confirm');

    try {
      setRecharging(true);
      const result = await StoreAPI.createRechargeSession(rechargeAmount, rechargeChannel);

      if (result.success && result.data && result.data.paymentUrl) {
        // 跳转到支付页面
        window.location.href = result.data.paymentUrl;
      }
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
      notification.textContent = `充值失败: ${error instanceof Error ? error.message : '未知错误'}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    } finally {
      setRecharging(false);
    }
  }, [recharging, rechargeAmount, rechargeChannel]);

  // 获取商品图标
  const getItemIcon = (item: StoreItem) => {
    const iconMap: { [key: string]: any } = {
      'consumable': Zap,
      'decoration': Paintbrush,
      'cosmetic': Paintbrush,
      'special': Sparkles,
      'bomb': Bomb,
      'advertisement': Megaphone,
      'custom_flag': Flag
    };

    const IconComponent = iconMap[item.category] || iconMap[item.type] || ShoppingBag;
    return IconComponent;
  };

  // 行式商品项（贴合设计稿：左图标，中间文案，右侧价格+按钮）
  const ProductRow = React.memo(({ item }: { item: StoreItem }) => {
    const IconComponent = getItemIcon(item);
    const canPurchase = userPoints >= (item.price || 0);
    const isPurchasing = purchasing === item.id;
    const price = item.price || 0;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        cursor: 'pointer'
      }}>
        {/* 左侧图标 */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <IconComponent style={{ width: '20px', height: '20px', color: '#4f46e5' }} />
        </div>

        {/* 中间名称与描述 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: '600',
            color: '#1f2937',
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{item.name}</div>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{item.description}</div>
        </div>

        {/* 右侧价格与按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              marginBottom: '2px'
            }}>
              <Coins style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>{price}</span>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>积分</div>
          </div>
          <button
            onClick={() => handlePurchase(item)}
            disabled={!canPurchase || isPurchasing}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease',
              cursor: canPurchase && !isPurchasing ? 'pointer' : 'not-allowed',
              background: canPurchase && !isPurchasing ? '#4f46e5' : '#d1d5db',
              color: canPurchase && !isPurchasing ? 'white' : '#9ca3af',
              boxShadow: canPurchase && !isPurchasing ? '0 4px 12px rgba(79,70,229,0.2)' : 'none',
              opacity: canPurchase ? 1 : 0.6
            }}
          >
            {isPurchasing ? '购买中...' : '立即购买'}
          </button>
        </div>
      </div>
    );
  });

  // 像素风格的商品卡片组件
  const ProductCard = React.memo(({ item }: { item: StoreItem }) => {
    const canPurchase = userPoints >= (item.price || 0);
    const isPurchasing = purchasing === item.id;
    const price = item.price || 0;
    const IconComponent = getItemIcon(item);

    return (
      <div className="bg-white rounded-lg p-4 border-3 border-gray-800 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg border-2 border-gray-800 flex items-center justify-center">
            <IconComponent className="w-6 h-6 text-indigo-700" />
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end space-x-1">
              <Coins className="w-5 h-5 text-amber-500" />
              <span className="text-lg font-bold text-gray-900">{price}</span>
            </div>
            <div className="text-xs font-medium text-gray-500">积分</div>
          </div>
        </div>

        <h3 className="font-bold text-gray-900 mb-1 text-base">{item.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>

        {item.effects && item.effects.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-700 mb-1 flex items-center">
              <Sparkles className="w-3 h-3 mr-1" />
              效果
            </div>
            <div className="space-y-1">
              {item.effects.map((effect, index) => (
                <div key={index} className="text-xs text-gray-600 bg-gray-50 border border-gray-300 rounded px-2 py-1">
                  {effect}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => handlePurchase(item)}
          disabled={!canPurchase || isPurchasing}
          className={`w-full py-2 px-3 rounded border-2 border-gray-800 text-sm font-bold transition-all ${
            canPurchase && !isPurchasing
              ? 'bg-indigo-500 text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] hover:bg-indigo-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isPurchasing ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>购买中...</span>
            </div>
          ) : canPurchase ? '立即购买' : '积分不足'}
        </button>
      </div>
    );
  });

  // 现代风格的库存卡片组件
  const InventoryCard = React.memo(({ item }: { item: any }) => {
    const IconComponent = getItemIcon(item);
    const handleClick = () => {
      logger.info('🔍 InventoryCard点击:', { item, itemId: item.item_id || item.id });
      handleUseItem(item.item_id || item.id);
    };

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconComponent style={{ width: '20px', height: '20px', color: '#16a34a' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              x{item.quantity}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>数量</div>
          </div>
        </div>

        <h3 style={{
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '4px',
          fontSize: '14px'
        }}>{item.name}</h3>
        <p style={{
          color: '#4b5563',
          fontSize: '12px',
          marginBottom: '12px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>{item.description}</p>

        <button
          onClick={handleClick}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#16a34a',
            color: 'white',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(22,163,74,0.2)',
            transition: 'all 0.3s ease',
            transform: 'translateY(0)'
          }}
        >
          使用道具
        </button>
      </div>
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-lg animate-spin mx-auto mb-3"></div>
          <p className="text-white text-base font-bold">加载商店...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Decorative stars */}
      <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-sm animate-pulse" />
      <div className="absolute top-40 right-20 w-2 h-2 bg-white rounded-sm animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-white rounded-sm animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-sm animate-pulse" style={{ animationDelay: '1.5s' }} />

      {/* 支付成功提示 */}
      <AnimatePresence>
        {showPaymentSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-green-500 text-white px-6 py-3 rounded-lg border-2 border-gray-800 shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">支付成功！积分已到账</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 container mx-auto px-4 py-6 max-w-5xl"
      >
        {/* 顶部导航 - 标题 + 积分 */}
        <div style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px',
          marginBottom: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#111827',
            margin: '0'
          }}>商店</h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '8px',
            paddingBottom: '8px',
            borderRadius: '24px',
            border: '1px solid #d97706',
            boxShadow: '0 2px 6px rgba(251,146,60,0.2)'
          }}>
            <Coins style={{ width: '20px', height: '20px', color: 'white' }} />
            <span style={{
              fontWeight: 'bold',
              fontSize: '18px',
              color: 'white'
            }}>{userPoints.toLocaleString()}</span>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#fef3c7'
            }}>积分</span>
          </div>
        </div>

        {/* 第一级菜单 - 药丸按钮 */}
        <div style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTabValue === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChangeClick(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  fontSize: '14px',
                  backgroundColor: isActive ? '#4f46e5' : 'white',
                  color: isActive ? 'white' : '#6b7280',
                  border: isActive ? 'none' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(79,70,229,0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (!isActive) {
                    target.style.backgroundColor = '#f3f4f6';
                    target.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (!isActive) {
                    target.style.backgroundColor = 'white';
                    target.style.color = '#6b7280';
                  }
                }}
              >
                <Icon style={{ width: '18px', height: '18px' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 内容容器 - 包含第二级菜单（右对齐）和内容 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 第二级菜单 - 分类筛选（右对齐） */}
          {categories.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap-reverse',
              gap: '12px',
              padding: '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {categories.map(category => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.3s ease',
                      border: isSelected ? 'none' : '1px solid #d1d5db',
                      backgroundColor: isSelected ? '#4f46e5' : 'white',
                      color: isSelected ? 'white' : '#6b7280',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 8px rgba(79,70,229,0.2)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget as HTMLButtonElement;
                      if (!isSelected) {
                        target.style.backgroundColor = '#f3f4f6';
                        target.style.color = '#374151';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.currentTarget as HTMLButtonElement;
                      if (!isSelected) {
                        target.style.backgroundColor = 'white';
                        target.style.color = '#6b7280';
                      }
                    }}
                  >
                    <Icon style={{ width: '18px', height: '18px' }} />
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* 内容区域 */}
          {activeTabValue === 'shop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px' }}>
              {filteredItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  paddingTop: '40px',
                  paddingBottom: '40px'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}>
                    <ShoppingBag style={{ width: '28px', height: '28px', color: '#9ca3af' }} />
                  </div>
                  <p style={{
                    color: '#4b5563',
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '4px'
                  }}>暂无商品</p>
                  <p style={{
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>该分类下暂无商品</p>
                </div>
              ) : (
                <>
                  {/* 普通商品 */}
                  {filteredItems.map((item) => (
                    <ProductRow key={item.id} item={item} />
                  ))}
                </>
              )}
            </div>
          )}

          {activeTabValue === 'inventory' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px',
              padding: '20px'
            }}>
              {filteredInventory.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  paddingTop: '40px',
                  paddingBottom: '40px'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}>
                    <Package style={{ width: '28px', height: '28px', color: '#9ca3af' }} />
                  </div>
                  <p style={{
                    color: '#4b5563',
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '4px'
                  }}>库存为空</p>
                  <p style={{
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>快去商店购买道具吧！</p>
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <InventoryCard key={item.id} item={item} />
                ))
              )}
            </div>
          )}

          {activeTabValue === 'recharge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">积分充值</h3>
                  <CreditCard className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-gray-600 mb-6">
                  充值人民币获得积分，用于购买商店道具
                </p>

                <div className="space-y-4">
                  {/* 充值金额选择 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">充值金额</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 20, 50, 100, 200, 500].map(amount => (
                        <button
                          key={amount}
                          onClick={() => handleRechargeAmountSelect(amount)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            transition: 'all 0.3s ease',
                            border: '1px solid',
                            fontSize: '14px',
                            cursor: 'pointer',
                            ...(rechargeAmount === amount
                              ? {
                                  backgroundColor: '#16a34a',
                                  color: 'white',
                                  borderColor: '#16a34a',
                                  boxShadow: '0 2px 4px rgba(22,163,74,0.3)'
                                }
                              : {
                                  backgroundColor: 'white',
                                  color: '#374151',
                                  borderColor: '#e5e7eb',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              })
                          }}
                        >
                          ¥{amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 支付方式选择 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">支付方式</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleRechargeChannelSelect('mock')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          transition: 'all 0.3s ease',
                          border: '1px solid',
                          fontSize: '14px',
                          cursor: 'pointer',
                          ...(rechargeChannel === 'mock'
                            ? {
                                backgroundColor: '#16a34a',
                                color: 'white',
                                borderColor: '#16a34a',
                                boxShadow: '0 2px 4px rgba(22,163,74,0.3)'
                              }
                            : {
                                backgroundColor: 'white',
                                color: '#374151',
                                borderColor: '#e5e7eb',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            })
                        }}
                      >
                        模拟支付
                      </button>
                      <button
                        onClick={() => handleRechargeChannelSelect('wechat')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          transition: 'all 0.3s ease',
                          border: '1px solid',
                          fontSize: '14px',
                          cursor: 'pointer',
                          ...(rechargeChannel === 'wechat'
                            ? {
                                backgroundColor: '#16a34a',
                                color: 'white',
                                borderColor: '#16a34a',
                                boxShadow: '0 2px 4px rgba(22,163,74,0.3)'
                              }
                            : {
                                backgroundColor: 'white',
                                color: '#374151',
                                borderColor: '#e5e7eb',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            })
                        }}
                      >
                        微信支付
                      </button>
                      <button
                        onClick={() => handleRechargeChannelSelect('alipay')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          transition: 'all 0.3s ease',
                          border: '1px solid',
                          fontSize: '14px',
                          cursor: 'pointer',
                          ...(rechargeChannel === 'alipay'
                            ? {
                                backgroundColor: '#16a34a',
                                color: 'white',
                                borderColor: '#16a34a',
                                boxShadow: '0 2px 4px rgba(22,163,74,0.3)'
                              }
                            : {
                                backgroundColor: 'white',
                                color: '#374151',
                                borderColor: '#e5e7eb',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            })
                        }}
                      >
                        支付宝
                      </button>
                    </div>
                  </div>

                  {/* 充值按钮 */}
                  <button
                    onClick={handleRecharge}
                    disabled={recharging}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'white',
                      color: '#16a34a',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      border: '2px solid #16a34a',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.2)',
                      transition: 'all 0.3s ease',
                      cursor: recharging ? 'not-allowed' : 'pointer',
                      opacity: recharging ? 0.6 : 1,
                      transform: 'translateY(0)'
                    }}
                  >
                    {recharging ? '处理中...' : `前往支付 ¥${rechargeAmount}`}
                  </button>
                </div>
              </div>

              {/* 充值说明 */}
              <div style={{
                backgroundColor: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  充值说明
                </h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-sm mr-3"></div>
                    <span>充值比例：1元 = 20积分</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-sm mr-3"></div>
                    <span>充值金额：10元 - 500元</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-sm mr-3"></div>
                    <span>支付方式：微信支付、支付宝</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-sm mr-3"></div>
                    <span>到账时间：支付成功后立即到账</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTabValue === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              {/* 管理员：所有待审核的自定义旗帜订单 */}
              {(selectedCategory === 'all' || selectedCategory === 'custom_flag') && currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin') && allCustomFlagOrders.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
                    待审核订单 (管理员)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allCustomFlagOrders.map((order) => (
                      <div key={order.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #fed7aa',
                        boxShadow: '0 2px 6px rgba(251,146,60,0.1)'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {order.original_image_url && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-800">
                                <img
                                  src={order.original_image_url}
                                  alt={order.pattern_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-gray-800">{order.pattern_name}</h4>
                              <p className="text-sm text-gray-500">{order.pattern_description}</p>
                              <p className="text-sm text-gray-500">
                                用户: {order.user?.username || order.user?.email || '未知用户'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end space-x-1 mb-2">
                              <Coins className="w-4 h-4 text-amber-500" />
                              <span className="text-lg font-bold text-blue-600">{order.price}</span>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              borderRadius: '4px',
                              border: '1px solid',
                              fontWeight: 'bold',
                              ...(order.status === 'approved'
                                ? { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#10B981' }
                                : order.status === 'pending'
                                ? { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }
                                : order.status === 'rejected'
                                ? { backgroundColor: '#FEE2E2', color: '#7F1D1D', borderColor: '#EF4444' }
                                : { backgroundColor: '#DBEAFE', color: '#1E3A8A', borderColor: '#3B82F6' })
                            }}>
                              {order.status === 'approved' ? '已批准' :
                               order.status === 'pending' ? '待审核' :
                               order.status === 'rejected' ? '已拒绝' : '处理中'}
                            </div>
                            {order.status === 'pending' && (
                              <div className="mt-2 space-x-2">
                                <button
                                  onClick={() => handleApproveOrder(order.id)}
                                  className="px-3 py-1 bg-green-500 text-white text-xs rounded border-2 border-gray-800 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] hover:bg-green-600 transition-all"
                                >
                                  批准
                                </button>
                                <button
                                  onClick={() => handleRejectOrder(order.id)}
                                  className="px-3 py-1 bg-red-500 text-white text-xs rounded border-2 border-gray-800 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] hover:bg-red-600 transition-all"
                                >
                                  拒绝
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 用户：自己的自定义旗帜订单 */}
              {(selectedCategory === 'all' || selectedCategory === 'custom_flag') && customFlagOrders.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <Flag className="w-5 h-5 mr-2 text-purple-500" />
                    我的自定义旗帜订单
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {customFlagOrders.map((order) => (
                      <div key={order.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {order.original_image_url && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-800">
                                <img
                                  src={order.original_image_url}
                                  alt={order.pattern_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-gray-800">{order.pattern_name}</h4>
                              <p className="text-sm text-gray-500">{order.pattern_description}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end space-x-1 mb-2">
                              <Coins className="w-4 h-4 text-amber-500" />
                              <span className="text-lg font-bold text-blue-600">{order.price}</span>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              borderRadius: '4px',
                              border: '1px solid',
                              fontWeight: 'bold',
                              ...(order.status === 'approved'
                                ? { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#10B981' }
                                : order.status === 'pending'
                                ? { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }
                                : order.status === 'rejected'
                                ? { backgroundColor: '#FEE2E2', color: '#7F1D1D', borderColor: '#EF4444' }
                                : { backgroundColor: '#DBEAFE', color: '#1E3A8A', borderColor: '#3B82F6' })
                            }}>
                              {order.status === 'approved' ? '已批准' :
                               order.status === 'pending' ? '待审核' :
                               order.status === 'rejected' ? '已拒绝' : '处理中'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 管理员：所有待审核的广告订单 */}
              {(selectedCategory === 'all' || selectedCategory === 'advertisement') && currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin') && allAdOrders.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-blue-500" />
                    待审核广告订单 (管理员)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allAdOrders.map((order) => (
                      <div key={order.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #bfdbfe',
                        boxShadow: '0 2px 6px rgba(59,130,246,0.1)'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {order.originalImageUrl && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-800">
                                <img
                                  src={order.originalImageUrl}
                                  alt={order.adTitle}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-gray-800">{order.adTitle}</h4>
                              <p className="text-sm text-gray-500">{order.adDescription}</p>
                              <p className="text-sm text-gray-500">
                                用户: {order.user?.username || order.user?.email || '未知用户'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end space-x-1 mb-2">
                              <Coins className="w-4 h-4 text-amber-500" />
                              <span className="text-lg font-bold text-blue-600">{order.price}</span>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              borderRadius: '4px',
                              border: '1px solid',
                              fontWeight: 'bold',
                              ...(order.status === 'approved'
                                ? { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#10B981' }
                                : order.status === 'pending'
                                ? { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }
                                : order.status === 'rejected'
                                ? { backgroundColor: '#FEE2E2', color: '#7F1D1D', borderColor: '#EF4444' }
                                : { backgroundColor: '#DBEAFE', color: '#1E3A8A', borderColor: '#3B82F6' })
                            }}>
                              {order.status === 'approved' ? '已批准' :
                               order.status === 'pending' ? '待审核' :
                               order.status === 'rejected' ? '已拒绝' : '处理中'}
                            </div>
                            {order.status === 'pending' && (
                              <div className="mt-2 space-x-2">
                                <button
                                  onClick={() => handleApproveAdOrder(order.id)}
                                  className="px-3 py-1 bg-green-500 text-white text-xs rounded border-2 border-gray-800 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] hover:bg-green-600 transition-all"
                                >
                                  批准
                                </button>
                                <button
                                  onClick={() => handleRejectAdOrder(order.id)}
                                  className="px-3 py-1 bg-red-500 text-white text-xs rounded border-2 border-gray-800 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] hover:bg-red-600 transition-all"
                                >
                                  拒绝
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 用户：自己的广告订单 */}
              {(selectedCategory === 'all' || selectedCategory === 'advertisement') && adOrders.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <Megaphone className="w-5 h-5 mr-2 text-blue-500" />
                    我的广告订单
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {adOrders.map((order) => (
                      <div key={order.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {order.originalImageUrl && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-800">
                                <img
                                  src={order.originalImageUrl}
                                  alt={order.adTitle}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-gray-800">{order.adTitle}</h4>
                              <p className="text-sm text-gray-500">{order.adDescription}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end space-x-1 mb-2">
                              <Coins className="w-4 h-4 text-amber-500" />
                              <span className="text-lg font-bold text-blue-600">{order.price}</span>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              borderRadius: '4px',
                              border: '1px solid',
                              fontWeight: 'bold',
                              ...(order.status === 'approved'
                                ? { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#10B981' }
                                : order.status === 'pending'
                                ? { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }
                                : order.status === 'rejected'
                                ? { backgroundColor: '#FEE2E2', color: '#7F1D1D', borderColor: '#EF4444' }
                                : { backgroundColor: '#DBEAFE', color: '#1E3A8A', borderColor: '#3B82F6' })
                            }}>
                              {order.status === 'approved' ? '已批准' :
                               order.status === 'pending' ? '待审核' :
                               order.status === 'rejected' ? '已拒绝' : '处理中'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 充值订单 */}
              {(selectedCategory === 'all' || selectedCategory === 'recharge') && rechargeOrders.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <Wallet className="w-5 h-5 mr-2 text-green-500" />
                    充值订单
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rechargeOrders.map((order) => {
                      // 计算订单剩余时间（30分钟有效期）
                      // 使用countdownTrigger作为依赖，确保每秒重新计算
                      const createdTime = new Date(order.created_at).getTime();
                      const expiryTime = createdTime + 30 * 60 * 1000; // 30分钟
                      const currentTime = new Date().getTime();
                      const remainingMs = expiryTime - currentTime;
                      const isExpired = remainingMs <= 0;
                      const remainingMinutes = Math.floor(remainingMs / 60000);
                      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

                      // 确保依赖countdownTrigger（通过访问它触发重新渲染）
                      void countdownTrigger;

                      const handleContinuePayment = async () => {
                        if (isExpired) {
                          const notification = document.createElement('div');
                          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
                          notification.textContent = '订单已过期，请创建新订单';
                          document.body.appendChild(notification);
                          setTimeout(() => {
                            notification.style.opacity = '0';
                            setTimeout(() => document.body.removeChild(notification), 300);
                          }, 3000);
                          return;
                        }

                        try {
                          logger.info('💳 继续支付订单:', { orderId: order.id, amount: order.amount_rmb, channel: order.payment_channel });

                          // 获取订单的支付渠道（从订单对象推断）
                          // 如果没有保存，默认使用mock进行测试
                          const channel = order.payment_channel || 'mock';
                          const amountRmb = order.amount_rmb;

                          // 调用原有的createRechargeSession API来获取支付链接
                          const response = await fetch(`${config.API_BASE_URL}/api/store-payment/recharge/session`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`
                            },
                            body: JSON.stringify({
                              channel,
                              amountRmb
                            })
                          });

                          if (response.ok) {
                            const result = await response.json();
                            logger.info('💳 继续支付响应:', result);

                            // 导航到支付页面
                            if (result.data && result.data.paymentUrl) {
                              window.location.href = result.data.paymentUrl;
                            } else {
                              const notification = document.createElement('div');
                              notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
                              notification.textContent = '获取支付链接失败';
                              document.body.appendChild(notification);
                              setTimeout(() => {
                                notification.style.opacity = '0';
                                setTimeout(() => document.body.removeChild(notification), 300);
                              }, 3000);
                            }
                          } else {
                            const errorData = await response.json();
                            throw new Error(errorData.error || '继续支付失败');
                          }
                        } catch (error) {
                          logger.error('❌ 继续支付错误:', error);
                          const notification = document.createElement('div');
                          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50';
                          notification.textContent = `继续支付失败: ${error instanceof Error ? error.message : '未知错误'}`;
                          document.body.appendChild(notification);
                          setTimeout(() => {
                            notification.style.opacity = '0';
                            setTimeout(() => document.body.removeChild(notification), 300);
                          }, 3000);
                        }
                      };

                      return (
                        <div key={order.id} style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                        }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-gray-800">充值订单</h4>
                              <p className="text-sm text-gray-500">订单号：{order.id}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                              {order.status === 'pending' && !isExpired && (
                                <p style={{
                                  fontSize: '12px',
                                  color: '#f97316',
                                  marginTop: '4px',
                                  fontWeight: '500'
                                }}>
                                  剩余时间：{remainingMinutes}分{remainingSeconds}秒
                                </p>
                              )}
                              {order.status === 'pending' && isExpired && (
                                <p style={{
                                  fontSize: '12px',
                                  color: '#ef4444',
                                  marginTop: '4px',
                                  fontWeight: '500'
                                }}>
                                  订单已过期
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                ¥{order.amount_rmb}
                              </div>
                              <div className="text-sm text-gray-500">
                                +{order.points} 积分
                              </div>
                              <div style={{
                                fontSize: '12px',
                                paddingLeft: '8px',
                                paddingRight: '8px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                borderRadius: '4px',
                                border: '1px solid',
                                fontWeight: 'bold',
                                marginTop: '4px',
                                ...(order.status === 'paid'
                                  ? { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#10B981' }
                                  : order.status === 'pending'
                                  ? { backgroundColor: '#FED7AA', color: '#9A3412', borderColor: '#F97316' }
                                  : { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#9CA3AF' })
                              }}>
                                {order.status === 'paid' ? '已支付' :
                                 order.status === 'pending' ? '待支付' : '已取消'}
                              </div>
                              {order.status === 'pending' && !isExpired && (
                                <button
                                  onClick={handleContinuePayment}
                                  style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    padding: '6px 12px',
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.3s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                                >
                                  继续支付
                                </button>
                              )}
                              {order.status === 'pending' && isExpired && (
                                <button
                                  disabled
                                  style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    padding: '6px 12px',
                                    backgroundColor: '#d1d5db',
                                    color: '#9ca3af',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'not-allowed'
                                  }}
                                >
                                  已过期
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 无订单提示 */}
              {((selectedCategory === 'all' && rechargeOrders.length === 0 && customFlagOrders.length === 0 && allCustomFlagOrders.length === 0 && adOrders.length === 0 && allAdOrders.length === 0) ||
                (selectedCategory === 'recharge' && rechargeOrders.length === 0) ||
                (selectedCategory === 'custom_flag' && customFlagOrders.length === 0 && allCustomFlagOrders.length === 0) ||
                (selectedCategory === 'advertisement' && adOrders.length === 0 && allAdOrders.length === 0)) && (
                <div style={{
                  textAlign: 'center',
                  paddingTop: '48px',
                  paddingBottom: '48px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <Wallet style={{ width: '32px', height: '32px', color: '#9ca3af' }} />
                  </div>
                  <p style={{
                    color: '#4b5563',
                    fontWeight: '500',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}>暂无订单</p>
                  <p style={{
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>
                    {currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')
                      ? '当前没有待审核的订单'
                      : '快去购买商品或充值获得积分吧！'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 炸弹使用模态框 */}
      {selectedBombItem && (
        <BombUsageModal
          isOpen={showBombModal}
          onClose={handleCloseBombModal}
          bombItem={selectedBombItem}
          onUseBomb={handleBombUse}
        />
      )}

      {/* 广告使用模态框 */}
      {selectedAdUsageItem && (
        <AdUsageModal
          isOpen={showAdUsageModal}
          onClose={handleCloseAdUsageModal}
          adItem={selectedAdUsageItem}
          onUseAd={handleAdUsage}
        />
      )}

      {/* 漂流瓶使用模态框 */}
      {showThrowBottleModal && (
        <ThrowBottleModal
          onClose={() => setShowThrowBottleModal(false)}
          onThrow={handleThrowBottle}
        />
      )}

      {/* 自定义联盟旗帜对话框 */}
      <CustomFlagDialog
        open={showCustomFlagDialog}
        onOpenChange={setShowCustomFlagDialog}
        onSuccess={() => {
          // 重新加载数据
          loadStoreData();
          // 显示成功提示
          const notification = document.createElement('div');
          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300';
          notification.textContent = '自定义旗帜订单创建成功！';
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 3000);
        }}
      />

      {/* 新的广告购买对话框 */}
      <AdPurchaseDialog
        open={showAdPurchaseDialog}
        onOpenChange={setShowAdPurchaseDialog}
        onSuccess={() => {
          loadStoreData();
          const notification = document.createElement('div');
          notification.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300';
          notification.textContent = '广告订单创建成功，等待管理员审核！';
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 3000);
        }}
        adItem={selectedAdItem ? {
          id: selectedAdItem.id,
          name: selectedAdItem.name,
          description: selectedAdItem.description,
          price: selectedAdItem.price,
          width: selectedAdItem.width,
          height: selectedAdItem.height,
          size_type: selectedAdItem.size_type
        } : null}
      />
    </div>
  );
}
