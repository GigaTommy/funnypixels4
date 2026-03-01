import React, { useState, useEffect } from 'react';
import { X, Shield, Users, CheckCircle, Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

import { replaceAlert } from '../../utils/toastHelper';
import { logger } from '../../utils/logger';

interface PrivacySettings {
  dm_receive_from: 'anyone' | 'followers' | 'verified';
  allow_message_requests: boolean;
  filter_low_quality: boolean;
  read_receipts_enabled: boolean;
  hide_nickname: boolean;
  hide_alliance: boolean;
  hide_alliance_flag: boolean;
}

interface PrivacyOption {
  value: string;
  label: string;
  description: string;
}

interface PrivacyOptions {
  dm_receive_from: PrivacyOption[];
  message_requests: PrivacyOption[];
  quality_filter: PrivacyOption[];
  read_receipts: PrivacyOption[];
}

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<PrivacySettings>({
    dm_receive_from: 'anyone',
    allow_message_requests: true,
    filter_low_quality: true,
    read_receipts_enabled: true,
    hide_nickname: false,
    hide_alliance: false,
    hide_alliance_flag: false
  });
  const [options, setOptions] = useState<PrivacyOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPrivacySettings();
    }
  }, [isOpen]);

  const loadPrivacySettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data.settings);
        setOptions(data.data.options);
      }
    } catch (error) {
      logger.error('加载隐私设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        onClose();
      } else {
        const errorData = await response.json();
        alert(errorData.message || '保存失败');
      }
    } catch (error) {
      logger.error('保存设置失败:', error);
      replaceAlert.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof PrivacySettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">隐私设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">加载中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 消息接收设置 */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  消息接收权限
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  控制谁可以给你发送私信
                </p>

                {options?.dm_receive_from.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="dm_receive_from"
                      value={option.value}
                      checked={settings.dm_receive_from === option.value}
                      onChange={(e) => updateSetting('dm_receive_from', e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* 像素隐私设置 */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  像素隐私设置
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  控制其他用户在点击您绘制的像素时能看到什么信息
                </p>

                <div className="space-y-4">
                  {/* 隐藏昵称 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">隐藏昵称</div>
                      <div className="text-sm text-gray-600">
                        绘制像素时不显示您的昵称
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.hide_nickname}
                        onChange={(e) => updateSetting('hide_nickname', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* 隐藏联盟信息 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">隐藏联盟信息</div>
                      <div className="text-sm text-gray-600">
                        绘制像素时不显示您的联盟名称
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.hide_alliance}
                        onChange={(e) => updateSetting('hide_alliance', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* 隐藏联盟旗帜 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">隐藏联盟旗帜</div>
                      <div className="text-sm text-gray-600">
                        绘制像素时不显示您的联盟旗帜
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.hide_alliance_flag}
                        onChange={(e) => updateSetting('hide_alliance_flag', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 消息请求设置 */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  高级设置
                </h3>

                <div className="space-y-4">
                  {/* 消息请求 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">允许消息请求</div>
                      <div className="text-sm text-gray-600">
                        不符合条件的消息会进入请求文件夹等待审核
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.allow_message_requests}
                        onChange={(e) => updateSetting('allow_message_requests', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* 质量过滤 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">过滤低质量消息</div>
                      <div className="text-sm text-gray-600">
                        自动过滤可能的垃圾消息和骚扰内容
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.filter_low_quality}
                        onChange={(e) => updateSetting('filter_low_quality', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* 已读回执 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">发送已读回执</div>
                      <div className="text-sm text-gray-600">
                        让对方知道你已经阅读了他们的消息
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.read_receipts_enabled}
                        onChange={(e) => updateSetting('read_receipts_enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 保存按钮 */}
            <div className="flex justify-end space-x-3">
              <Button
                onClick={onClose}
                variant="outline"
                disabled={saving}
              >
                取消
              </Button>
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {saving ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    保存中...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    保存设置
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};