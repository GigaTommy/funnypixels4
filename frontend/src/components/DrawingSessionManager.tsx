import React, { useState, useEffect } from 'react';
import { drawingSessionService, DrawingSession, SessionStatistics } from '../services/drawingSessionService';
import { logger } from '../utils/logger';
import ShareModal from './ShareModal';

interface DrawingSessionManagerProps {
  onSessionStart?: (session: DrawingSession) => void;
  onSessionEnd?: (session: DrawingSession) => void;
  onSessionUpdate?: (session: DrawingSession | null) => void;
  showControls?: boolean;
  compact?: boolean;
}

const DrawingSessionManager: React.FC<DrawingSessionManagerProps> = ({
  onSessionStart,
  onSessionEnd,
  onSessionUpdate,
  showControls = true,
  compact = false
}) => {
  const [activeSession, setActiveSession] = useState<DrawingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lastEndedSession, setLastEndedSession] = useState<DrawingSession | null>(null);

  // 加载活跃会话
  useEffect(() => {
    loadActiveSession();
  }, []);

  // 定期刷新会话统计
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;

    const interval = setInterval(async () => {
      try {
        const statsResult = await drawingSessionService.getSessionStatistics(activeSession.id);
        if (statsResult.success && statsResult.data) {
          setSessionStats(statsResult.data);
        }
      } catch (error) {
        logger.error('刷新会话统计失败:', error);
      }
    }, 5000); // 每5秒刷新一次

    return () => clearInterval(interval);
  }, [activeSession]);

  const loadActiveSession = async () => {
    try {
      setIsLoading(true);
      const result = await drawingSessionService.getActiveSession();
      if (result.success && result.data) {
        setActiveSession(result.data);
        onSessionUpdate?.(result.data);
      }
    } catch (error) {
      logger.error('加载活跃会话失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const sessionName = drawingSessionService.generateSessionName();

      // 获取当前位置（如果有）
      let startLocation = undefined;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            startLocation = {
              longitude: position.coords.longitude,
              latitude: position.coords.latitude
            };
          },
          (error) => {
            logger.warn('获取位置失败:', error);
          }
        );
      }

      const result = await drawingSessionService.startSession({
        sessionName,
        drawingType: 'manual',
        startLocation
      });

      if (result.success && result.data) {
        setActiveSession(result.data);
        onSessionStart?.(result.data);
        onSessionUpdate?.(result.data);
      } else {
        setError(result.message || '开始会话失败');
      }
    } catch (error) {
      logger.error('开始会话失败:', error);
      setError('开始会话失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    try {
      setError(null);
      setIsLoading(true);

      const result = await drawingSessionService.endSession(activeSession.id);

      if (result.success && result.data) {
        setLastEndedSession(result.data);
        setActiveSession(null);
        setSessionStats(null);
        onSessionEnd?.(result.data);
        onSessionUpdate?.(null);

        // 显示分享弹窗
        setShowShareModal(true);
      } else {
        setError(result.message || '结束会话失败');
      }
    } catch (error) {
      logger.error('结束会话失败:', error);
      setError('结束会话失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSession = async () => {
    if (!activeSession) return;

    try {
      setError(null);
      const result = await drawingSessionService.pauseSession(activeSession.id);
      if (result.success && result.data) {
        setActiveSession(result.data);
        onSessionUpdate?.(result.data);
      }
    } catch (error) {
      logger.error('暂停会话失败:', error);
      setError('暂停会话失败');
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;

    try {
      setError(null);
      const result = await drawingSessionService.resumeSession(activeSession.id);
      if (result.success && result.data) {
        setActiveSession(result.data);
        onSessionUpdate?.(result.data);
      }
    } catch (error) {
      logger.error('恢复会话失败:', error);
      setError('恢复会话失败');
    }
  };

  if (compact) {
    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        {activeSession ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              color: drawingSessionService.getSessionStatusColor(activeSession.status),
              fontWeight: 'bold'
            }}>
              ● {drawingSessionService.getSessionStatusText(activeSession.status)}
            </span>
            <span>{activeSession.sessionName}</span>
            {sessionStats && (
              <span style={{ color: '#6b7280' }}>
                {sessionStats.statistics.pixelCount}像素
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: '#9ca3af' }}>无活跃会话</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        margin: '16px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#1f2937'
        }}>
          绘制会话管理
        </h3>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* 活跃会话信息 */}
      {activeSession ? (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>
                {activeSession.sessionName}
              </h4>
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#6b7280'
              }}>
                开始时间: {drawingSessionService.formatTime(activeSession.startTime)}
              </p>
            </div>
            <span style={{
              padding: '4px 8px',
              backgroundColor: drawingSessionService.getSessionStatusColor(activeSession.status) + '20',
              color: drawingSessionService.getSessionStatusColor(activeSession.status),
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {drawingSessionService.getSessionStatusText(activeSession.status)}
            </span>
          </div>

          {/* 会话统计 */}
          {sessionStats && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                    {sessionStats.statistics.pixelCount}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>像素数量</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                    {sessionStats.statistics.uniqueGrids}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>独特网格</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                    {drawingSessionService.formatSessionDuration(sessionStats.statistics.duration)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>持续时间</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                    {drawingSessionService.calculateSessionEfficiency(
                      sessionStats.statistics.pixelCount,
                      sessionStats.statistics.duration
                    ).toFixed(1)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>像素/分钟</div>
                </div>
              </div>
            </div>
          )}

          {/* 会话控制按钮 */}
          {showControls && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {activeSession.status === 'active' ? (
                <>
                  <button
                    onClick={handlePauseSession}
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? '处理中...' : '暂停'}
                  </button>
                  <button
                    onClick={handleEndSession}
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? '处理中...' : '结束会话'}
                  </button>
                </>
              ) : activeSession.status === 'paused' ? (
                <button
                  onClick={handleResumeSession}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1
                  }}
                >
                  {isLoading ? '处理中...' : '恢复'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            当前没有活跃的绘制会话
          </p>
          {showControls && (
            <button
              onClick={handleStartSession}
              disabled={isLoading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              {isLoading ? '处理中...' : '开始新会话'}
            </button>
          )}
        </div>
      )}
    </div>

      {/* 分享弹窗 */}
      {lastEndedSession && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setLastEndedSession(null);
          }}
          sessionId={lastEndedSession.id}
          sessionData={lastEndedSession as any}
        />
      )}
    </>
  );
};

export default DrawingSessionManager;