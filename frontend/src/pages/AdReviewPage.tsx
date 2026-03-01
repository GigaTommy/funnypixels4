import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';

interface PendingAdOrder {
  id: string;
  adTitle: string;
  adDescription: string;
  originalImageUrl: string;
  status: string;
  price: number;
  productName: string;
  sizeType: string;
  width: number;
  height: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

const AdReviewPage: React.FC = () => {
  const [orders, setOrders] = useState<PendingAdOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PendingAdOrder | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    action: 'approve' as 'approve' | 'reject',
    adminNotes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // 加载待审核订单
  const loadPendingOrders = async () => {
    try {
      const response = await fetch('/api/ads/admin/orders/pending', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders);
      } else {
        toast.error('加载待审核订单失败');
      }
    } catch (error) {
      logger.error('加载待审核订单失败:', error);
      toast.error('加载待审核订单失败');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadPendingOrders();
      setLoading(false);
    };
    
    loadData();
  }, []);

  // 开始审核订单
  const handleReviewOrder = (order: PendingAdOrder) => {
    setSelectedOrder(order);
    setReviewForm({ action: 'approve', adminNotes: '' });
    setShowReviewModal(true);
  };

  // 提交审核结果
  const handleSubmitReview = async () => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/ads/admin/orders/${selectedOrder.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: reviewForm.action,
          adminNotes: reviewForm.adminNotes
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`订单已${reviewForm.action === 'approve' ? '批准' : '拒绝'}`);
        setShowReviewModal(false);
        setSelectedOrder(null);
        await loadPendingOrders();
      } else {
        toast.error(data.message || '审核失败');
      }
    } catch (error) {
      logger.error('审核失败:', error);
      toast.error('审核失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">广告审核</h1>
          <p className="mt-2 text-gray-600">审核用户提交的广告订单</p>
        </div>

        {/* 待审核订单列表 */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">暂无待审核的广告订单</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      {order.user.avatarUrl ? (
                        <img
                          src={order.user.avatarUrl}
                          alt={order.user.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-500 font-medium">
                          {order.user.displayName?.charAt(0) || order.user.username.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{order.adTitle}</h3>
                      <p className="text-sm text-gray-600">
                        用户: {order.user.displayName || order.user.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        提交时间: {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{order.price} 积分</div>
                    <div className="text-sm text-gray-500">{order.productName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* 广告图片 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">广告图片</h4>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <img
                        src={order.originalImageUrl}
                        alt={order.adTitle}
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  </div>

                  {/* 订单信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">订单信息</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">广告标题:</span>
                        <span className="font-medium">{order.adTitle}</span>
                      </div>
                      {order.adDescription && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">广告描述:</span>
                          <span className="font-medium">{order.adDescription}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">广告尺寸:</span>
                        <span className="font-medium">{order.width} × {order.height} 像素</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">广告类型:</span>
                        <span className="font-medium">
                          {order.sizeType === 'rectangle' ? '长方形' : '方形'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">价格:</span>
                        <span className="font-medium">{order.price} 积分</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => handleReviewOrder(order)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    审核订单
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 审核模态框 */}
      {showReviewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              审核广告订单: {selectedOrder.adTitle}
            </h3>
            
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <img
                  src={selectedOrder.originalImageUrl}
                  alt={selectedOrder.adTitle}
                  className="w-24 h-16 object-cover rounded border"
                />
                <div>
                  <div className="text-sm text-gray-600">用户: {selectedOrder.user.displayName || selectedOrder.user.username}</div>
                  <div className="text-sm text-gray-600">尺寸: {selectedOrder.width} × {selectedOrder.height}</div>
                  <div className="text-sm text-gray-600">价格: {selectedOrder.price} 积分</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  审核结果
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="approve"
                      checked={reviewForm.action === 'approve'}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, action: e.target.value as 'approve' | 'reject' }))}
                      className="mr-2"
                    />
                    <span className="text-green-600 font-medium">批准</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="reject"
                      checked={reviewForm.action === 'reject'}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, action: e.target.value as 'approve' | 'reject' }))}
                      className="mr-2"
                    />
                    <span className="text-red-600 font-medium">拒绝</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  审核备注
                </label>
                <textarea
                  value={reviewForm.adminNotes}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入审核备注（可选）"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 ${
                  reviewForm.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? '处理中...' : (reviewForm.action === 'approve' ? '批准订单' : '拒绝订单')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdReviewPage;
