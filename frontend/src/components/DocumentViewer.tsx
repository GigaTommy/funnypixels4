import React, { useState, useEffect } from 'react';

interface DocumentViewerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  apiUrl: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  visible,
  onClose,
  title,
  apiUrl
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<{
    content: string;
    fileUrl: string;
    fileName: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (visible && apiUrl) {
      loadDocument();
    }
  }, [visible, apiUrl]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (result.success) {
        setDocumentData(result.data);
      } else {
        setError('获取文档失败');
      }
    } catch (err) {
      setError('加载文档时发生错误');
    } finally {
      setLoading(false);
    }
  };

  
  const handleClose = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '50px',
        zIndex: 1000
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '0', height: 'calc(85vh - 80px)', overflow: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
              <p style={{ margin: 0, color: '#666' }}>正在加载文档...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '20px',
              margin: '20px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626'
            }}>
              <strong>错误：</strong> {error}
            </div>
          )}

          {documentData && !loading && !error && (
            <div style={{ height: '100%' }}>
              {documentData.type === 'file' && documentData.fileUrl ? (
                <iframe
                  src={documentData.fileUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '0'
                  }}
                  title={title}
                />
              ) : (
                <div
                  style={{
                    padding: '24px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: '#374151',
                    overflow: 'auto'
                  }}
                >
                  {documentData.content}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;