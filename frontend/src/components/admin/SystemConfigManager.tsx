import React, { useState, useEffect } from 'react';
import { Save, FileText, Shield, Clock, History, AlertCircle } from 'lucide-react';
import { logger } from '../../utils/logger';
import { dialogService } from '../../services/dialogService';

interface SystemConfig {
  id?: number;
  config_key: string;
  config_value: string;
  config_type: 'text' | 'html' | 'json';
  description?: string;
  updated_at?: string;
  updated_by_user?: {
    id: number;
    username: string;
    display_name: string;
  };
}

interface ConfigHistory {
  id: number;
  config_key: string;
  old_value?: string;
  new_value?: string;
  updated_by_user?: {
    id: number;
    username: string;
    display_name: string;
  };
  update_reason?: string;
  created_at: string;
}

const SystemConfigManager: React.FC = () => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 配置项定义
  const configDefinitions = [
    {
      key: 'user_agreement',
      name: '用户协议',
      icon: FileText,
      type: 'html',
      description: '用户服务协议内容',
      placeholder: '请输入用户协议内容...'
    },
    {
      key: 'privacy_policy',
      name: '隐私政策',
      icon: Shield,
      type: 'html',
      description: '隐私保护政策内容',
      placeholder: '请输入隐私政策内容...'
    },
    {
      key: 'about_us',
      name: '关于我们',
      icon: FileText,
      type: 'html',
      description: '关于我们页面内容',
      placeholder: '请输入关于我们内容...'
    },
    {
      key: 'contact_info',
      name: '联系方式',
      icon: FileText,
      type: 'html',
      description: '联系信息页面内容',
      placeholder: '请输入联系方式内容...'
    }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/system-config/configs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取配置失败');
      }

      const result = await response.json();
      if (result.success) {
        setConfigs(result.data);
      } else {
        throw new Error(result.error || '获取配置失败');
      }
    } catch (error) {
      logger.error('加载系统配置失败:', error);
      setError(error instanceof Error ? error.message : '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (configKey?: string) => {
    try {
      const token = localStorage.getItem('token');
      const url = configKey
        ? `/api/admin/system-config/configs/${configKey}/history`
        : '/api/admin/system-config/config-history';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取历史记录失败');
      }

      const result = await response.json();
      if (result.success) {
        setHistory(result.data);
      } else {
        throw new Error(result.error || '获取历史记录失败');
      }
    } catch (error) {
      logger.error('加载配置历史失败:', error);
      setError(error instanceof Error ? error.message : '获取历史记录失败');
    }
  };

  const startEdit = (config: SystemConfig) => {
    setEditingConfig(config);
    setEditValue(config.config_value);
    setEditReason('');
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingConfig(null);
    setEditValue('');
    setEditReason('');
    setError(null);
    setSuccess(null);
  };

  const saveConfig = async () => {
    if (!editingConfig) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/system-config/configs/${editingConfig.config_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          config_value: editValue,
          config_type: editingConfig.config_type,
          description: editingConfig.description,
          update_reason: editReason || '更新配置内容'
        })
      });

      if (!response.ok) {
        throw new Error('保存配置失败');
      }

      const result = await response.json();
      if (result.success) {
        setSuccess('配置保存成功！');
        setConfigs(configs.map(config =>
          config.config_key === editingConfig.config_key
            ? { ...config, config_value: editValue, updated_at: new Date().toISOString() }
            : config
        ));
        cancelEdit();

        // 刷新历史记录
        if (showHistory) {
          loadHistory(editingConfig.config_key);
        }
      } else {
        throw new Error(result.error || '保存配置失败');
      }
    } catch (error) {
      logger.error('保存配置失败:', error);
      setError(error instanceof Error ? error.message : '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const initializeDefaults = async () => {
    const confirmed = await dialogService.confirm('确定要初始化默认配置吗？这将覆盖现有的配置。', {
      title: '确认初始化',
      type: 'warning'
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/system-config/initialize-defaults', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('初始化失败');
      }

      const result = await response.json();
      if (result.success) {
        setSuccess('默认配置初始化成功！');
        loadConfigs();
      } else {
        throw new Error(result.error || '初始化失败');
      }
    } catch (error) {
      logger.error('初始化默认配置失败:', error);
      setError(error instanceof Error ? error.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  };

  const showConfigHistory = (configKey: string) => {
    loadHistory(configKey);
    setShowHistory(true);
  };

  const getConfigValue = (key: string) => {
    const config = configs.find(c => c.config_key === key);
    return config?.config_value || '';
  };

  const getConfigLastUpdate = (key: string) => {
    const config = configs.find(c => c.config_key === key);
    return config?.updated_at ? new Date(config.updated_at).toLocaleString() : '从未更新';
  };

  if (loading && configs.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '16px', color: '#6b7280' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{
        marginBottom: '32px',
        padding: '24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              系统配置管理
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0'
            }}>
              管理用户协议、隐私政策等系统配置内容
            </p>
          </div>
          <button
            onClick={initializeDefaults}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '初始化中...' : '初始化默认配置'}
          </button>
        </div>
      </div>

      {/* 错误和成功提示 */}
      {error && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} color="#dc2626" />
          <span style={{ color: '#dc2626', fontSize: '14px' }}>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} color="#16a34a" />
          <span style={{ color: '#16a34a', fontSize: '14px' }}>{success}</span>
        </div>
      )}

      {/* 配置列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {configDefinitions.map((def) => {
          const Icon = def.icon;
          const config = configs.find(c => c.config_key === def.key);
          const isEditing = editingConfig?.config_key === def.key;

          return (
            <div
              key={def.key}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}
            >
              {/* 配置项头部 */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#e0e7ff',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={20} color="#6366f1" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937',
                      margin: '0 0 4px 0'
                    }}>
                      {def.name}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      margin: '0'
                    }}>
                      {def.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 配置内容区域 */}
              <div style={{ padding: '20px' }}>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={def.placeholder}
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: def.type === 'html' ? 'monospace' : 'inherit',
                        resize: 'vertical',
                        marginBottom: '16px'
                      }}
                    />

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        更新原因：
                      </label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="请输入更新原因..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={saveConfig}
                        disabled={saving}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: saving ? '#9ca3af' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <Save size={16} />
                        {saving ? '保存中...' : '保存'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      minHeight: '100px',
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      marginBottom: '16px',
                      fontFamily: def.type === 'html' ? 'monospace' : 'inherit',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto'
                    }}>
                      {getConfigValue(def.key) || (
                        <span style={{ color: '#9ca3af' }}>暂无内容，点击编辑按钮添加内容</span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '16px'
                    }}>
                      <span>最后更新: {getConfigLastUpdate(def.key)}</span>
                      <button
                        onClick={() => showConfigHistory(def.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#6b7280',
                          cursor: 'pointer'
                        }}
                      >
                        <History size={12} />
                        历史记录
                      </button>
                    </div>

                    <button
                      onClick={() => startEdit(config || {
                        config_key: def.key,
                        config_value: '',
                        config_type: def.type as 'text' | 'html' | 'json',
                        description: def.description
                      })}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      编辑内容
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 历史记录模态框 */}
      {showHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                配置变更历史
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              padding: '24px',
              overflow: 'auto',
              flex: 1
            }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                  暂无历史记录
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {history.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        padding: '16px',
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1f2937',
                            marginBottom: '4px'
                          }}>
                            {record.config_key}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>
                            {new Date(record.created_at).toLocaleString()}
                            {record.updated_by_user && (
                              <span> • {record.updated_by_user.username}</span>
                            )}
                          </div>
                        </div>
                        {record.update_reason && (
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: '#e0e7ff',
                            color: '#6366f1',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {record.update_reason}
                          </div>
                        )}
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                      }}>
                        {record.old_value && (
                          <div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px'
                            }}>
                              修改前：
                            </div>
                            <div style={{
                              padding: '8px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#374151',
                              maxHeight: '100px',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {record.old_value}
                            </div>
                          </div>
                        )}
                        {record.new_value && (
                          <div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px'
                            }}>
                              修改后：
                            </div>
                            <div style={{
                              padding: '8px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#374151',
                              maxHeight: '100px',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {record.new_value}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemConfigManager;