import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Loader2, Eye, Check, X, Clock, User, Calendar, Image, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';

interface CustomFlagOrder {
  id: string;
  pattern_name: string;
  pattern_description: string;
  original_image_url: string;
  status: string;
  price: number;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

interface CustomFlagReviewPanelProps {
  className?: string;
}

export const CustomFlagReviewPanel: React.FC<CustomFlagReviewPanelProps> = ({
  className = ''
}) => {
  const toast = useToast();
  const [orders, setOrders] = useState<CustomFlagOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CustomFlagOrder | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  // 加载待审核订单
  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/custom-flags/admin/orders');

      if (response.data.success) {
        setOrders(response.data.orders);
      } else {
        logger.error('加载订单失败:', response.data.message);
      }
    } catch (error) {
      logger.error('加载待审核订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, []);

  // 处理审核
  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      const response = await api.post('/custom-flags/admin/review', {
        orderId: selectedOrder.id,
        action,
        adminNotes: adminNotes.trim()
      });

      if (response.data.success) {
        // 移除已处理的订单
        setOrders(prev => prev.filter(order => order.id !== selectedOrder.id));

        // 关闭对话框
        setShowReviewDialog(false);
        setSelectedOrder(null);
        setReviewAction(null);
        setAdminNotes('');

        // 显示成功消息
        toast.success(`订单已${action === 'approve' ? '批准' : '拒绝'}`);
      } else {
        // ✅ 改进：显示更详细的错误信息
        const errorMessage = response.data.details?.errorMessage
          ? `${response.data.message}\n详情: ${response.data.details.errorMessage}`
          : response.data.message || '操作失败';

        toast.error(errorMessage);

        // 刷新订单列表以获取最新状态
        logger.warn('审核返回错误，刷新订单列表:', response.data);
        await loadPendingOrders();
      }
    } catch (error: any) {
      logger.error('审核失败:', error);

      // ✅ 改进：显示更详细的错误信息
      const errorMessage = error.response?.data?.details?.errorMessage
        ? `${error.response.data.message}\n详情: ${error.response.data.details.errorMessage}`
        : error.response?.data?.message || '操作失败，请稍后重试';

      toast.error(errorMessage);

      // 刷新订单列表以获取最新状态
      logger.error('审核异常，刷新订单列表:', error);
      await loadPendingOrders();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 打开审核对话框
  const openReviewDialog = (order: CustomFlagOrder, action: 'approve' | 'reject') => {
    setSelectedOrder(order);
    setReviewAction(action);
    setAdminNotes('');
    setShowReviewDialog(true);
  };

  // 关闭审核对话框
  const closeReviewDialog = () => {
    if (!isSubmitting) {
      setShowReviewDialog(false);
      setSelectedOrder(null);
      setReviewAction(null);
      setAdminNotes('');
    }
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <div style={{ display: 'inline-block', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>待审核</div>;
      case 'processing':
        return <div style={{ display: 'inline-block', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>处理中</div>;
      case 'approved':
        return <div style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>已批准</div>;
      case 'rejected':
        return <div style={{ display: 'inline-block', backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>已拒绝</div>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: className ? undefined : '0' }}>
        <div style={{ padding: '24px' }}>
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Loader2
              style={{
                width: '24px',
                height: '24px',
                marginRight: '8px',
                color: '#3b82f6',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={{ color: '#4b5563' }}>加载中...</span>
          </div>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 标题区域 */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#111827',
            marginBottom: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
          }}
        >
          自定义旗帜审核
        </h2>
        <p style={{ color: '#4b5563', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif' }}>
          审核用户提交的自定义联盟旗帜订单
        </p>
      </div>

      {orders.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Card>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
            }}
          >
            暂无待审核订单
          </h3>
          <p style={{ color: '#4b5563', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif' }}>
            所有自定义旗帜订单都已处理完成
          </p>
        </Card>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map((order) => (
            <div key={order.id} style={{ padding: '24px' }}>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                {/* 用户信息 */}
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {order.user.avatar_url ? (
                      <img
                        src={order.user.avatar_url}
                        alt={order.user.username}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '50%'
                        }}
                      />
                    ) : (
                      <User style={{ width: '24px', height: '24px', color: '#9ca3af' }} />
                    )}
                  </div>
                </div>

                {/* 订单信息 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          color: '#111827',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                        }}
                      >
                        {order.pattern_name}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {new Date(order.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <p
                      style={{
                        fontSize: '14px',
                        color: '#4b5563',
                        marginBottom: '4px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>用户:</span> {order.user.display_name || order.user.username}
                    </p>
                    {order.pattern_description && (
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#4b5563',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>描述:</span> {order.pattern_description}
                      </p>
                    )}
                  </div>

                  {/* 图片预览 */}
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <Image style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#374151',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                        }}
                      >
                        上传的图片
                      </span>
                    </div>
                    <div
                      onClick={() => setViewImageUrl(order.original_image_url)}
                      style={{
                        width: '120px',
                        height: '120px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                      }}
                    >
                      <img
                        src={order.original_image_url}
                        alt="用户上传的图片"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px'
                    }}
                  >
                    <Button
                      onClick={() => openReviewDialog(order, 'approve')}
                      style={{
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      size="sm"
                    >
                      <Check style={{ width: '16px', height: '16px' }} />
                      批准
                    </Button>
                    <Button
                      onClick={() => openReviewDialog(order, 'reject')}
                      style={{
                        backgroundColor: 'white',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <X style={{ width: '16px', height: '16px' }} />
                      拒绝
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>
      )}

      {/* 全屏图片查看器 */}
      {viewImageUrl && (
        <div
          onClick={() => setViewImageUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            cursor: 'pointer',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '90vw',
              maxHeight: '90vh'
            }}
          >
            <img
              src={viewImageUrl}
              alt="全屏查看"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
            <button
              onClick={() => setViewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.3s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
              title="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 审核对话框 */}
      <Dialog open={showReviewDialog} onOpenChange={closeReviewDialog}>
        <div style={{ maxWidth: '512px' }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check style={{ width: '20px', height: '20px', color: '#22c55e' }} />
                  <span>批准订单</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <X style={{ width: '20px', height: '20px', color: '#dc2626' }} />
                  <span>拒绝订单</span>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? '批准后将通过AI处理生成自定义旗帜，用户可在创建联盟时使用'
                : '拒绝后将退还用户积分，请说明拒绝原因'
              }
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 订单信息 */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}
              >
                <h4
                  style={{
                    fontWeight: 500,
                    color: '#111827',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                  }}
                >
                  {selectedOrder.pattern_name}
                </h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#4b5563',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                  }}
                >
                  用户: {selectedOrder.user.display_name || selectedOrder.user.username}
                </p>
                {selectedOrder.pattern_description && (
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                    }}
                  >
                    描述: {selectedOrder.pattern_description}
                  </p>
                )}
              </div>

              {/* 图片预览 */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                  }}
                >
                  上传的图片
                </label>
                <div
                  onClick={() => setViewImageUrl(selectedOrder.original_image_url)}
                  style={{
                    width: '140px',
                    height: '140px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f9fafb',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  <img
                    src={selectedOrder.original_image_url}
                    alt="用户上传的图片"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              </div>

              {/* 管理员备注 */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "思源黑体", "Noto Sans CJK SC", "Noto Sans SC", Roboto, sans-serif'
                  }}
                >
                  管理员备注 <span style={{ color: '#6b7280' }}>(可选)</span>
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={setAdminNotes}
                  placeholder={
                    reviewAction === 'approve'
                      ? '添加备注信息...'
                      : '请说明拒绝原因...'
                  }
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeReviewDialog}
              disabled={isSubmitting}
              style={{
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s ease',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => handleReview(reviewAction!)}
              disabled={isSubmitting}
              style={{
                backgroundColor: reviewAction === 'approve' ? '#22c55e' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s ease',
                opacity: isSubmitting ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  处理中...
                </>
              ) : (
                <>
                  {reviewAction === 'approve' ? (
                    <>
                      <Check style={{ width: '16px', height: '16px' }} />
                      批准订单
                    </>
                  ) : (
                    <>
                      <X style={{ width: '16px', height: '16px' }} />
                      拒绝订单
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
        </div>
      </Dialog>
    </div>
  );
};
