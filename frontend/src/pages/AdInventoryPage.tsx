import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';

interface AdInventoryItem {
  id: string;
  adTitle: string;
  productName: string;
  sizeType: string;
  width: number;
  height: number;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

interface AdPlacement {
  id: string;
  adTitle: string;
  centerLat: number;
  centerLng: number;
  width: number;
  height: number;
  pixelCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

const AdInventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<AdInventoryItem[]>([]);
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AdInventoryItem | null>(null);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [placementForm, setPlacementForm] = useState({
    centerLat: '',
    centerLng: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // 加载广告库存
  const loadInventory = async () => {
    try {
      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        toast.error('用户未登录，请先登录');
        return;
      }

      const response = await fetch('/api/ads/inventory', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setInventory(data.inventory);
      } else {
        toast.error('加载广告库存失败');
      }
    } catch (error) {
      logger.error('加载广告库存失败:', error);
      toast.error('加载广告库存失败');
    }
  };

  // 加载广告放置记录
  const loadPlacements = async () => {
    try {
      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        toast.error('用户未登录，请先登录');
        return;
      }

      const response = await fetch('/api/ads/placements', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setPlacements(data.placements);
      } else {
        toast.error('加载广告放置记录失败');
      }
    } catch (error) {
      logger.error('加载广告放置记录失败:', error);
      toast.error('加载广告放置记录失败');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadInventory(), loadPlacements()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  // 使用广告道具
  const handleUseAdItem = (item: AdInventoryItem) => {
    if (item.isUsed) {
      toast.error('该广告已使用');
      return;
    }
    
    setSelectedItem(item);
    setShowPlacementModal(true);
  };

  // 提交广告放置
  const handleSubmitPlacement = async () => {
    if (!selectedItem) return;

    const lat = parseFloat(placementForm.centerLat);
    const lng = parseFloat(placementForm.centerLng);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('请输入有效的地理坐标');
      return;
    }

    if (lat < -90 || lat > 90) {
      toast.error('纬度必须在-90到90之间');
      return;
    }

    if (lng < -180 || lng > 180) {
      toast.error('经度必须在-180到180之间');
      return;
    }

    setSubmitting(true);
    try {
      // 获取认证token
      const token = localStorage.getItem('funnypixels_token');
      if (!token) {
        toast.error('用户未登录，请先登录');
        return;
      }
      
      const response = await fetch('/api/ads/inventory/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          inventoryId: selectedItem.id,
          centerLat: lat,
          centerLng: lng
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`广告放置成功！共放置了${data.placement.pixelCount}个像素点`);
        setShowPlacementModal(false);
        setPlacementForm({ centerLat: '', centerLng: '' });
        setSelectedItem(null);
        await Promise.all([loadInventory(), loadPlacements()]);
      } else {
        toast.error(data.message || '广告放置失败');
      }
    } catch (error) {
      logger.error('广告放置失败:', error);
      toast.error('广告放置失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 获取可用库存
  const availableInventory = inventory.filter(item => !item.isUsed);
  const usedInventory = inventory.filter(item => item.isUsed);

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
          <h1 className="text-3xl font-bold text-gray-900">广告库存</h1>
          <p className="mt-2 text-gray-600">管理您的广告道具和放置记录</p>
        </div>

        {/* 可用广告库存 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">可用广告</h2>
          {availableInventory.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">暂无可用广告</p>
              <p className="text-sm text-gray-400 mt-2">前往广告商店购买广告位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableInventory.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{item.adTitle}</h3>
                    <span className="text-sm text-gray-500">
                      {item.sizeType === 'rectangle' ? '长方形' : '方形'}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="text-sm text-gray-600">尺寸:</span>
                      <span className="font-medium">{item.width} × {item.height} 像素</span>
                    </div>
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="text-sm text-gray-600">商品:</span>
                      <span className="font-medium">{item.productName}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleUseAdItem(item)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    使用广告
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 已使用广告 */}
        {usedInventory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">已使用广告</h2>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        广告标题
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        尺寸
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        使用时间
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usedInventory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.adTitle}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.width} × {item.height}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.usedAt ? new Date(item.usedAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 广告放置记录 */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">广告放置记录</h2>
          {placements.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">暂无广告放置记录</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        广告标题
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        位置
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        像素数量
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        放置时间
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {placements.map((placement) => (
                      <tr key={placement.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{placement.adTitle}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {placement.centerLat.toFixed(6)}, {placement.centerLng.toFixed(6)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {placement.pixelCount} 像素
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            placement.isActive 
                              ? 'text-green-600 bg-green-100' 
                              : 'text-red-600 bg-red-100'
                          }`}>
                            {placement.isActive ? '活跃' : '已停用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(placement.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 广告放置模态框 */}
      {showPlacementModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              放置广告: {selectedItem.adTitle}
            </h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">广告信息:</div>
              <div className="text-sm">
                <div>尺寸: {selectedItem.width} × {selectedItem.height} 像素</div>
                <div>类型: {selectedItem.sizeType === 'rectangle' ? '长方形' : '方形'}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  中心纬度 *
                </label>
                <input
                  type="number"
                  step="any"
                  value={placementForm.centerLat}
                  onChange={(e) => setPlacementForm(prev => ({ ...prev, centerLat: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 39.9042"
                />
                <p className="text-xs text-gray-500 mt-1">范围: -90 到 90</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  中心经度 *
                </label>
                <input
                  type="number"
                  step="any"
                  value={placementForm.centerLng}
                  onChange={(e) => setPlacementForm(prev => ({ ...prev, centerLng: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 116.4074"
                />
                <p className="text-xs text-gray-500 mt-1">范围: -180 到 180</p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">注意事项:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>广告将转换为像素点集合放置在地图上</li>
                  <li>请确保选择的位置没有被其他广告占用</li>
                  <li>放置后无法撤销，请谨慎选择位置</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPlacementModal(false);
                  setPlacementForm({ centerLat: '', centerLng: '' });
                  setSelectedItem(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmitPlacement}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '放置中...' : '确认放置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdInventoryPage;
