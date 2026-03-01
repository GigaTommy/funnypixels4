import React, { useState } from 'react';
import { logger } from '../../utils/logger';
import { motion } from 'framer-motion';
import { ShoppingCart, Coins, Star } from 'lucide-react';
import UnifiedPaymentModal from '../payment/UnifiedPaymentModal';
import toast from 'react-hot-toast';
import { config } from '../../config/env';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price_points: number;
  price_rmb?: number;
  type: string;
  metadata?: any;
}

interface StoreItemCardProps {
  item: StoreItem;
  userPoints: number;
  onPurchaseSuccess: () => void;
}

export default function StoreItemCard({ item, userPoints, onPurchaseSuccess }: StoreItemCardProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePurchase = () => {
    // 检查积分是否足够
    if (item.price_points > userPoints) {
      // 积分不足，显示充值选项
      setShowPaymentModal(true);
    } else {
      // 积分足够，直接购买
      handlePointsPurchase();
    }
  };

  const handlePointsPurchase = async () => {
    setLoading(true);
    try {
      // 这里调用积分购买API
      const response = await fetch(`${config.API_BASE_URL}/api/store/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 1,
          paymentMethod: 'points'
        })
      });

      if (response.ok) {
        toast.success('购买成功！');
        onPurchaseSuccess();
      } else {
        const error = await response.json();
        toast.error(error.message || '购买失败');
      }
    } catch (error) {
      logger.error('购买失败:', error);
      toast.error('购买失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (result: any) => {
    toast.success('支付成功！');
    setShowPaymentModal(false);
    onPurchaseSuccess();
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'pixel_boost':
        return '⚡';
      case 'pattern':
        return '🎨';
      case 'frame':
        return '🖼️';
      case 'bomb':
        return '💣';
      case 'ad':
        return '📢';
      default:
        return '🎁';
    }
  };

  const getItemColor = (type: string) => {
    switch (type) {
      case 'pixel_boost':
        return 'bg-gradient-to-br from-yellow-400 to-orange-500';
      case 'pattern':
        return 'bg-gradient-to-br from-purple-400 to-pink-500';
      case 'frame':
        return 'bg-gradient-to-br from-blue-400 to-indigo-500';
      case 'bomb':
        return 'bg-gradient-to-br from-red-400 to-pink-500';
      case 'ad':
        return 'bg-gradient-to-br from-green-400 to-teal-500';
      default:
        return 'bg-gradient-to-br from-gray-400 to-gray-500';
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
      >
        {/* 商品图标 */}
        <div className={`h-32 ${getItemColor(item.type)} flex items-center justify-center`}>
          <div className="text-4xl">{getItemIcon(item.type)}</div>
        </div>

        {/* 商品信息 */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
            {item.metadata?.rarity === 'rare' && (
              <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{item.description}</p>

          {/* 价格信息 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="font-bold text-gray-800">{item.price_points}</span>
              <span className="text-gray-500 text-sm">积分</span>
            </div>
            
            {item.price_rmb && (
              <div className="text-sm text-gray-500">
                或 ¥{item.price_rmb}
              </div>
            )}
          </div>

          {/* 购买按钮 */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
              item.price_points <= userPoints
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                处理中...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 mr-2" />
                {item.price_points <= userPoints ? '立即购买' : '充值购买'}
              </div>
            )}
          </button>

          {/* 积分不足提示 */}
          {item.price_points > userPoints && (
            <div className="mt-2 text-xs text-orange-600 text-center">
              积分不足，需要 {item.price_points - userPoints} 积分
            </div>
          )}
        </div>
      </motion.div>

      {/* 支付模态框 */}
      <UnifiedPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={item.price_rmb || Math.ceil(item.price_points / 10)} // 1积分 = 0.1元
        description={`购买 ${item.name}`}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </>
  );
}
