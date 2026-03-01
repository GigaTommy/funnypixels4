import React, { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, Shield } from 'lucide-react';
import { logger } from '../../utils/logger';

interface PolicyViewerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'user-agreement' | 'privacy-policy';
}

const PolicyViewer: React.FC<PolicyViewerProps> = ({ isOpen, onClose, type }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadPolicyContent();
      setScrollTop(0);
    }
  }, [isOpen, type]);

  const loadPolicyContent = async () => {
    setLoading(true);
    setError(null);
    setContent('');

    try {
      const apiEndpoint = type === 'user-agreement'
        ? '/api/system-config/public/user-agreement'
        : '/api/system-config/public/privacy-policy';

      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        throw new Error('获取政策内容失败');
      }

      const result = await response.json();
      if (result.success) {
        setContent(result.data.content || '');
      } else {
        throw new Error(result.error || '获取政策内容失败');
      }
    } catch (error) {
      logger.error('加载政策内容失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const isScrolledToBottom = (element: HTMLDivElement) => {
    return Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 5;
  };

  const getTitle = () => {
    return type === 'user-agreement' ? '用户服务协议' : '隐私政策';
  };

  const getIcon = () => {
    return type === 'user-agreement' ? FileText : Shield;
  };

  const Icon = getIcon();

  if (!isOpen) return null;

  return (
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
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '90vw',
        maxWidth: '800px',
        height: '80vh',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '24px 24px 16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#e0e7ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={18} color="#6366f1" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {getTitle()}
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '4px 0 0 0'
            }}>
              请仔细阅读以下条款，了解您的权利和义务
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6b7280',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '14px', color: '#6b7280' }}>加载中...</span>
            </div>
          ) : error ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <X size={24} color="#dc2626" />
              </div>
              <div>
                <p style={{
                  fontSize: '16px',
                  color: '#dc2626',
                  margin: '0 0 8px 0'
                }}>
                  加载失败
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: '0 0 16px 0'
                }}>
                  {error}
                </p>
                <button
                  onClick={loadPolicyContent}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  重新加载
                </button>
              </div>
            </div>
          ) : content ? (
            <div
              style={{
                height: '100%',
                overflow: 'auto',
                padding: '16px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              onScroll={handleScroll}
            >
              <div
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#374151'
                }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#f3f4f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={24} color="#9ca3af" />
              </div>
              <div>
                <p style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  margin: '0 0 8px 0'
                }}>
                  暂无内容
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#9ca3af',
                  margin: '0'
                }}>
                  管理员还未添加{getTitle()}内容
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '16px 24px 24px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          borderRadius: '0 0 16px 16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              最后更新时间：{new Date().toLocaleDateString()}
            </div>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  // 在新标签页打开政策内容
                  const newWindow = window.open('', '_blank');
                  if (newWindow) {
                    newWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>${getTitle()}</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            color: #374151;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9fafb;
                          }
                          h1, h2, h3 { color: #1f2937; }
                          .header {
                            background: white;
                            padding: 20px;
                            margin: -20px -20px 20px -20px;
                            border-bottom: 1px solid #e5e7eb;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>${getTitle()}</h1>
                        </div>
                        <div>${content || '暂无内容'}</div>
                      </body>
                      </html>
                    `);
                    newWindow.document.close();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                <ExternalLink size={14} />
                新窗口打开
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4f46e5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#6366f1';
                }}
              >
                我已阅读
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 添加动画样式 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PolicyViewer;