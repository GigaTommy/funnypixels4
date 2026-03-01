import React, { useState } from 'react';
import qrTreasureService from '../../services/qrTreasureService';
import { logger } from '../../utils/logger';

interface HideTreasureFormProps {
  qrContent: string;
  userLocation: { lat: number; lng: number };
  onSuccess: () => void;
  onCancel: () => void;
}

const HideTreasureForm: React.FC<HideTreasureFormProps> = ({
  qrContent,
  userLocation,
  onSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hint, setHint] = useState('');
  const [rewardPoints, setRewardPoints] = useState(50);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasTreasureItem, setHasTreasureItem] = useState(false);
  const [isLoadingItem, setIsLoadingItem] = useState(true);

  // 检查用户库存是否有寻宝道具
  React.useEffect(() => {
    const checkTreasureItem = async () => {
      try {
        const response = await fetch('/api/store/inventory', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const treasureItems = data.inventory?.filter((item: any) =>
            item.item_type === 'qr_treasure' && item.quantity > 0
          );
          setHasTreasureItem(treasureItems && treasureItems.length > 0);
        }
      } catch (error) {
        logger.error('检查库存失败:', error);
      } finally {
        setIsLoadingItem(false);
      }
    };

    checkTreasureItem();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('图片大小不能超过5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('只能上传图片文件');
        return;
      }
      setImage(file);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入宝藏标题');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await qrTreasureService.hideTreasure({
        qrContent,
        lat: userLocation.lat,
        lng: userLocation.lng,
        title: title.trim(),
        description: description.trim(),
        hint: hint.trim(),
        rewardPoints,
        image: image || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || '藏宝失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseReward = 50;
  let totalCost = 0;
  let extraReward = 0;
  if (hasTreasureItem) {
    extraReward = Math.max(0, rewardPoints - baseReward);
    totalCost = extraReward;
  } else {
    totalCost = 50 + rewardPoints;
  }

  const quickPoints = [50, 100, 150, 200];
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  };
  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '4px'
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 标题 */}
      <div>
        <label style={labelStyle as any}>
          宝藏标题 <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给你的宝藏起个名字"
          maxLength={50}
          style={inputStyle}
          required
          disabled={isSubmitting}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{title.length}/50</p>
      </div>

      {/* 线索/描述 */}
      <div>
        <label style={labelStyle as any}>
          线索或描述 <span style={{ fontSize: '12px', color: '#9ca3af' }}>(选填)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="留下一些线索，帮助寻宝者找到..."
          maxLength={200}
          rows={3}
          style={{ ...inputStyle, resize: 'none' }}
          disabled={isSubmitting}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{description.length}/200</p>
      </div>

      {/* 提示 */}
      <div>
        <label style={labelStyle as any}>
          距离提示 <span style={{ fontSize: '12px', color: '#9ca3af' }}>(选填)</span>
        </label>
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="距离不够时显示的提示..."
          maxLength={100}
          style={inputStyle}
          disabled={isSubmitting}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>例如："就在咖啡店旁边"</p>
      </div>

      {/* 照片上传 */}
      <div>
        <label style={labelStyle as any}>
          宝藏照片 <span style={{ fontSize: '12px', color: '#9ca3af' }}>(选填，最大5MB)</span>
        </label>
        {!imagePreview ? (
          <div style={{ marginTop: '4px' }}>
            <label style={{ cursor: 'pointer' }}>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}>
                <svg style={{ width: '48px', height: '48px', margin: '0 auto', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p style={{ marginTop: '8px', fontSize: '14px', color: '#4b5563' }}>
                  <span style={{ color: '#a855f7', fontWeight: 500 }}>点击上传图片</span>
                  <span style={{ color: '#6b7280' }}> 或拖拽到此处</span>
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  支持 JPG、PNG、GIF、WEBP
                </p>
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} disabled={isSubmitting} />
            </label>
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: '4px' }}>
            <img src={imagePreview} alt="预览" style={{ width: '100%', height: '192px', objectFit: 'cover', borderRadius: '8px' }} />
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '4px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              disabled={isSubmitting}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 奖励积分 */}
      <div>
        <label style={labelStyle as any}>
          {hasTreasureItem ? '总奖励积分（道具已包含50基础奖励）' : '奖励积分'}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {quickPoints.map((points) => (
            <button
              key={points}
              type="button"
              onClick={() => setRewardPoints(points)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: rewardPoints === points ? '#a855f7' : '#f3f4f6',
                color: rewardPoints === points ? 'white' : '#374151',
                boxShadow: rewardPoints === points ? '0 4px 6px rgba(168, 85, 247, 0.3)' : 'none'
              }}
              disabled={isSubmitting}
            >
              {points}
              {hasTreasureItem && points > 50 && (
                <span style={{ fontSize: '12px', marginLeft: '4px' }}>(+{points - 50})</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={rewardPoints}
            onChange={(e) => setRewardPoints(parseInt(e.target.value))}
            style={{
              flex: 1,
              height: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              appearance: 'none',
              background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((rewardPoints - 50) / 450) * 100}%, #e5e7eb ${((rewardPoints - 50) / 450) * 100}%, #e5e7eb 100%)`
            }}
            disabled={isSubmitting}
          />
          <div style={{ minWidth: '100px', textAlign: 'right' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#a855f7' }}>{rewardPoints}</span>
            <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '4px' }}>积分</span>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          寻宝者找到后将获得 {rewardPoints} 积分
          {hasTreasureItem && extraReward > 0 && (
            <span style={{ color: '#a855f7' }}> （基础50 + 额外{extraReward}）</span>
          )}
        </p>
      </div>

      {/* 库存状态提示 */}
      {!isLoadingItem && hasTreasureItem && (
        <div style={{
          background: 'linear-gradient(to right, #f0fdf4, #d1fae5)',
          border: '2px solid #86efac',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              <svg style={{ width: '24px', height: '24px', color: '#16a34a' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div style={{ marginLeft: '12px', flex: 1 }}>
              <h4 style={{ fontSize: '14px', fontWeight: 500, color: '#15803d', marginBottom: '4px' }}>
                已拥有寻宝道具
              </h4>
              <p style={{ fontSize: '12px', color: '#166534' }}>
                使用道具藏宝可节省 50 积分基础费用，仅需支付奖励积分
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 消耗提示 */}
      <div style={{
        background: 'linear-gradient(to right, #fef3c7, #fed7aa)',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <svg style={{ width: '24px', height: '24px', color: '#d97706' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div style={{ marginLeft: '12px', flex: 1 }}>
            <h4 style={{ fontSize: '14px', fontWeight: 500, color: '#92400e', marginBottom: '4px' }}>藏宝消耗</h4>
            <div style={{ fontSize: '14px', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hasTreasureItem ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>使用道具：</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>-1 个寻宝道具</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563' }}>
                    <span>基础奖励（道具包含）：</span>
                    <span>50 积分</span>
                  </div>
                  {extraReward > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>额外奖励：</span>
                      <span style={{ fontWeight: 600 }}>{extraReward} 积分</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a' }}>
                    <span>总奖励：</span>
                    <span style={{ fontWeight: 600 }}>{rewardPoints} 积分</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>道具费用：</span>
                    <span style={{ fontWeight: 600 }}>50 积分</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>奖励积分：</span>
                    <span style={{ fontWeight: 600 }}>{rewardPoints} 积分</span>
                  </div>
                </>
              )}
              <div style={{
                borderTop: '1px solid #fbbf24',
                paddingTop: '4px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 500 }}>消耗积分：</span>
                <span style={{ fontWeight: 700, fontSize: '18px' }}>{totalCost} 积分</span>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#ca8a04', marginTop: '8px', display: 'flex', alignItems: 'center' }}>
              <svg style={{ width: '14px', height: '14px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              宝藏被找到后，你将获得 5 积分反馈奖励
            </p>
            {!hasTreasureItem && (
              <p style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                <svg style={{ width: '14px', height: '14px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                在商店购买"寻宝道具"可节省基础费用
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #f87171',
          color: '#7f1d1d',
          padding: '12px 16px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg style={{ width: '20px', height: '20px', marginRight: '8px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            color: '#374151',
            fontWeight: 500,
            backgroundColor: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
          disabled={isSubmitting}
        >
          取消
        </button>
        <button
          type="submit"
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'linear-gradient(to right, #a855f7, #6366f1)',
            color: 'white',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
            boxShadow: isSubmitting ? 'none' : '0 4px 6px rgba(168, 85, 247, 0.3)',
            transition: 'all 0.3s ease'
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginRight: '8px'
              }}></div>
              藏宝中...
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              立即藏宝
            </div>
          )}
        </button>
      </div>

      {/* 提示信息 */}
      <div style={{
        backgroundColor: '#dbeafe',
        border: '1px solid #93c5fd',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <svg style={{ width: '20px', height: '20px', color: '#3b82f6', marginRight: '8px', marginTop: '2px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div style={{ flex: 1, fontSize: '12px', color: '#1e40af' }}>
            <p style={{ fontWeight: 500, marginBottom: '4px' }}>藏宝小贴士</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li>宝藏将绑定在当前二维码和位置上</li>
              <li>其他用户扫描同一二维码即可发现</li>
              <li>宝藏有效期为 7 天，过期后自动失效</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
};

export default HideTreasureForm;
