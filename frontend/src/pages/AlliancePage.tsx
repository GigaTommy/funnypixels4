import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { createPortal } from 'react-dom';
import { Home, Plus, Search, Settings, Users, FileText, Link2 } from 'lucide-react';
import { AllianceAPI } from '../services/alliance';
import { AuthService } from '../services/auth';
import { avatarService } from '../services/avatarService';
import PatternSelector from '../components/pattern/PatternSelector';
import { AllianceFlagPicker } from '../components/AllianceFlagPicker';
import { AllianceFlag } from '../components/AllianceFlag';
import { replaceAlert } from '../utils/toastHelper';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import ConfirmDialog from '../components/ui/ConfirmDialog';

import { Alliance, AllianceMember } from '../services/alliance';

// API响应类型定义
interface MembersResponse {
  members: AllianceMember[];
}

interface ApplicationsResponse {
  applications: any[];
}

interface StatsResponse {
  success: boolean;
  stats: any;
}

export default function AlliancePage() {
  const { dialogState, showConfirm, hideDialog, handleConfirm } = useConfirmDialog();
  const [userAlliance, setUserAlliance] = useState<Alliance | null>(null);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [allianceStats, setAllianceStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'create' | 'join' | 'manage'>('my');
  const [manageSubTab, setManageSubTab] = useState<'members' | 'applications' | 'settings' | 'invites'>('members');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    flagPatternId: '',
    is_public: true,
    approval_required: true
  });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    flagPatternId: '',
    is_public: true,
    approval_required: true
  });
  const [joinForm, setJoinForm] = useState({
    allianceId: '',
    message: ''
  });
  const [memberAvatarUrls, setMemberAvatarUrls] = useState<Map<string, string>>(new Map());
  const [loadingMemberAvatars, setLoadingMemberAvatars] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // 带指数退避的重试机制
  const loadAllianceDataWithRetry = async (searchQuery = '', maxRetries = 3) => {
    setIsRetrying(true);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        logger.info(`🔄 联盟数据加载尝试 ${attempt}/${maxRetries}`);
        await loadAllianceData(searchQuery);
        setRetryCount(0); // 成功后重置重试计数
        setIsRetrying(false);
        return; // 成功则退出重试循环
      } catch (error: any) {
        logger.warn(`第${attempt}次加载失败:`, error.message);

        if (attempt === maxRetries) {
          // 最后一次尝试失败，显示错误并停止重试
          logger.error('所有重试均失败，停止尝试');
          setRetryCount(maxRetries);
          setIsRetrying(false);
          replaceAlert.error('加载失败，请检查网络连接或稍后重试');
          return;
        }

        // 指数退避：1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        logger.info(`等待${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  useEffect(() => {
    loadAllianceDataWithRetry('');
  }, []);

  // 加载成员头像
  const loadMemberAvatar = useCallback(async (memberId: string, avatarData?: string) => {
    if (!avatarData || loadingMemberAvatars.has(memberId)) {
      return;
    }

    setLoadingMemberAvatars(prev => new Set(prev).add(memberId));

    try {
      logger.info('🎨 开始加载联盟成员头像:', { memberId, hasAvatarData: !!avatarData });

      // 使用新的头像服务获取头像URL
      const avatarUrl = await avatarService.getAvatarUrl(
        memberId,
        avatarData,
        'small' // 联盟页面使用小尺寸头像
      );

      if (avatarUrl) {
        setMemberAvatarUrls(prev => new Map(prev).set(memberId, avatarUrl));
        logger.info('✅ 联盟成员头像URL已获取:', { memberId, avatarUrl });
      }
    } catch (error) {
      logger.error('❌ 加载联盟成员头像失败:', error);
    } finally {
      setLoadingMemberAvatars(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  }, [loadingMemberAvatars]);

  // 初始化编辑表单数据
  useEffect(() => {
    if (userAlliance) {
      setEditForm({
        name: userAlliance.name,
        description: userAlliance.description || '',
        flagPatternId: userAlliance.flag_pattern_id || '',
        is_public: userAlliance.is_public,
        approval_required: userAlliance.approval_required
      });
    }
  }, [userAlliance]);

  // 当成员数据变化时，加载成员头像
  useEffect(() => {
    members.forEach(member => {
      if (member.avatar && !memberAvatarUrls.has(member.id)) {
        loadMemberAvatar(member.id, member.avatar);
      }
    });
  }, [members, memberAvatarUrls, loadMemberAvatar]);

  const loadAllianceData = async (searchQuery = '') => {
    try {
      setLoading(true);
      logger.info('🔍 开始加载联盟数据，搜索查询:', searchQuery);

      // 检查用户是否已登录
      if (!AuthService.isAuthenticated()) {
        logger.info('用户未登录，跳过加载联盟数据');
        setLoading(false);
        return;
      }

      // 主要API调用 - 设置较短超时时间避免页面卡死
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API请求超时')), 10000) // 10秒超时
      );

      const apiPromise = Promise.all([
        AllianceAPI.getUserAlliance(),
        AllianceAPI.searchAlliances(searchQuery, 20, 0)
      ]);

      const [userAllianceResponse, alliancesResponse] = await Promise.race([apiPromise, timeoutPromise]) as any;

      logger.info('搜索响应:', alliancesResponse);
      logger.info(`找到 ${alliancesResponse.alliances?.length || 0} 个联盟`);

      if (userAllianceResponse.alliance) {
        setUserAlliance(userAllianceResponse.alliance);

        // 并行加载次要数据，但设置超时保护
        const secondaryDataPromises = [
          // 加载联盟成员 - 5秒超时
          Promise.race([
            AllianceAPI.getAllianceMembers(userAllianceResponse.alliance.id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('成员数据加载超时')), 5000))
          ]).catch(error => {
            logger.warn('联盟成员加载失败:', error.message);
            return { members: [] };
          }),

          // 加载申请列表 - 5秒超时（仅管理员）
          (userAllianceResponse.alliance.user_role === 'leader' || userAllianceResponse.alliance.user_role === 'admin')
            ? Promise.race([
                AllianceAPI.getApplications(userAllianceResponse.alliance.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('申请数据加载超时')), 5000))
              ]).catch(error => {
                logger.warn('申请列表加载失败:', error.message);
                return { applications: [] };
              })
            : Promise.resolve({ applications: [] }),

          // 加载联盟统计数据 - 8秒超时（这是导致卡顿的主要原因）
          Promise.race([
            AllianceAPI.getAllianceStats(userAllianceResponse.alliance.id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('统计数据加载超时')), 8000))
          ]).catch(error => {
            logger.warn('联盟统计数据加载失败:', error.message);
            return { success: false, stats: null };
          })
        ];

        // 等待所有次要数据加载完成（或超时）
        const [membersResponse, applicationsResponse, statsResponse] = await Promise.all(secondaryDataPromises);

        // 设置数据 - 使用类型断言
        const membersResp = membersResponse as MembersResponse;
        const applicationsResp = applicationsResponse as ApplicationsResponse;
        const statsResp = statsResponse as StatsResponse;

        setMembers(membersResp?.members || []);
        setApplications(applicationsResp?.applications || []);

        if (statsResp?.success && statsResp?.stats) {
          setAllianceStats(statsResp.stats);
        } else {
          // 设置默认统计数据，避免界面空白
          setAllianceStats({
            totalPixels: 0,
            currentPixels: 0,
            memberCount: userAllianceResponse.alliance.member_count || 0,
            territory: 0,
            rank: 0
          });
          logger.warn('使用默认联盟统计数据');
        }
      }

      setAlliances(alliancesResponse.alliances || []);
    } catch (error: any) {
      logger.error('加载联盟数据失败:', error);

      // 特殊处理超时错误
      if (error.message === 'API请求超时') {
        logger.error('联盟数据加载超时，可能是网络问题或服务器响应慢');
        replaceAlert.error('网络连接超时，请稍后重试');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error('联盟数据加载超时:', error.message);
        replaceAlert.error('请求超时，请检查网络连接');
      }
      // 如果是认证错误，清除可能过期的token并停止重试
      else if (error.response?.status === 401 || error.response?.status === 403) {
        logger.info('认证失败，停止加载联盟数据');
        // 清除过期的认证状态
        try {
          await AuthService.logout();
        } catch (logoutError) {
          logger.info('清除认证状态失败:', logoutError);
        }
      } else {
        replaceAlert.error('加载联盟数据失败，请稍后重试');
      }

      // 设置空数据，避免无限重试
      setUserAlliance(null);
      setAlliances([]);
      setMembers([]);
      setAllianceStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlliance = async () => {
    try {
      const { name, description, flagPatternId, is_public, approval_required } = createForm;

      await AllianceAPI.createAlliance({
        name,
        description,
        flagPatternId,
        is_public,
        approval_required
      });
      replaceAlert.success('联盟创建成功');
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        description: '',
        flagPatternId: '',
        is_public: true,
        approval_required: true
      });
      loadAllianceData('');
    } catch (error) {
      logger.error('创建联盟失败:', error);
      replaceAlert.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateAlliance = async () => {
    if (!userAlliance) return;

    try {
      const { name, description, flagPatternId, is_public, approval_required } = editForm;
      const updateData: any = {
        name,
        description,
        is_public,
        approval_required
      };

      // 只有当旗帜发生变化时才包含旗帜信息
      if (flagPatternId && flagPatternId !== userAlliance.flag_pattern_id) {
        updateData.flagPatternId = flagPatternId;
      }

      await AllianceAPI.updateAlliance(userAlliance.id, updateData);
      replaceAlert.success('联盟信息更新成功');
      // 重新加载联盟数据会触发editForm的重新初始化
      loadAllianceData('');
    } catch (error) {
      replaceAlert.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleJoinAlliance = async () => {
    try {
      await AllianceAPI.joinAlliance(joinForm.allianceId, joinForm.message);
      replaceAlert.success('申请已发送');
      setShowJoinForm(false);
      setJoinForm({ allianceId: '', message: '' });
      loadAllianceData('');
    } catch (error) {
      replaceAlert.error(`申请失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleLeaveAlliance = async () => {
    if (!userAlliance) return;

    if (userAlliance.user_role === 'leader' && userAlliance.member_count > 1) {
      replaceAlert.warning('盟主需要先转让盟主位置才能退出联盟');
      return;
    }

    showConfirm(
      '退出联盟',
      '确定要退出联盟吗？',
      async () => {
        try {
          await AllianceAPI.leaveAlliance();
          replaceAlert.success('已退出联盟');
          loadAllianceData('');
        } catch (error) {
          replaceAlert.error(`退出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      { type: 'warning', confirmText: '退出', cancelText: '取消' }
    );
  };

  const handleKickMember = async (memberId: string) => {
    if (!userAlliance) return;

    showConfirm(
      '踢出成员',
      '确定要踢出该成员吗？',
      async () => {
        try {
          await AllianceAPI.kickMember(memberId);
          replaceAlert.success('成员已踢出');
          loadAllianceData('');
        } catch (error) {
          replaceAlert.error(`踢出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      { type: 'danger', confirmText: '踢出', cancelText: '取消' }
    );
  };

  const handlePromoteMember = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!userAlliance) return;

    try {
      await AllianceAPI.updateMemberRole(userAlliance.id, memberId, newRole);
      replaceAlert.success('成员角色已更新');
      loadAllianceData('');
    } catch (error) {
      replaceAlert.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleReviewApplication = async (applicationId: string, action: 'approve' | 'reject', message: string) => {
    if (!userAlliance) return;

    try {
      await AllianceAPI.reviewApplication(applicationId, action, message);
      replaceAlert.success(`申请已${action === 'approve' ? '批准' : '拒绝'}`);
      loadAllianceData('');
    } catch (error) {
      replaceAlert.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!userAlliance) return;

    try {
      const response = await AllianceAPI.generateInviteLink(userAlliance.id);
      replaceAlert.success(`邀请链接已生成: ${response.data.invite_link}`);
    } catch (error) {
      replaceAlert.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 选择图案 - 创建联盟用
  const handlePatternSelect = (patternId: string) => {
    setCreateForm(prev => ({ ...prev, flagPatternId: patternId }));
  };

  // 选择旗帜 - 编辑联盟用
  const handleEditFlagSelect = (patternId: string) => {
    setEditForm(prev => ({ ...prev, flagPatternId: patternId }));
  };


  const filteredAlliances = alliances.filter(alliance =>
    alliance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (alliance.description && alliance.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const recommendedAlliances = alliances
    .filter(alliance => alliance.is_public)
    .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
    .slice(0, 3);
  const showQuickJoin = !userAlliance && recommendedAlliances.length > 0;

  const handleQuickJoin = async (alliance: Alliance) => {
    if (alliance.approval_required) {
      setJoinForm({ allianceId: alliance.id, message: '' });
      setShowJoinForm(true);
      return;
    }

    try {
      await AllianceAPI.joinAlliance(alliance.id, '');
      replaceAlert.success('已加入联盟');
      loadAllianceData('');
    } catch (error) {
      replaceAlert.error(`加入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 如果用户未登录，显示登录提示
  if (!AuthService.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">需要登录</h3>
          <p className="text-gray-600 mb-6">请先登录以访问联盟功能</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            返回首页登录
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {isRetrying ? `重试中... (${retryCount}/3)` : '加载联盟数据中...'}
          </p>
          {retryCount >= 3 && (
            <div className="mt-4">
              <p className="text-red-600 mb-2">多次加载失败，请检查网络连接</p>
              <button
                onClick={() => {
                  setRetryCount(0);
                  setIsRetrying(false);
                  loadAllianceDataWithRetry('');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                重新加载
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      {/* 顶部信息栏 */}
      <div style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '1024px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#111827',
            margin: '0'
          }}>
            联盟
          </h1>
        </div>
      </div>

      <div style={{
        maxWidth: '1024px',
        margin: '0 auto',
        padding: '24px 16px'
      }}>
        {/* 主标签页 - 药丸按钮组 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          {[
            { id: 'my', label: '我的联盟', icon: Home },
            { id: 'create', label: '创建联盟', icon: Plus },
            { id: 'join', label: '加入联盟', icon: Search },
            { id: 'manage', label: '联盟管理', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: activeTab === tab.id ? 'none' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: activeTab === tab.id ? '#4f46e5' : 'white',
                  color: activeTab === tab.id ? 'white' : '#6b7280',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(79,70,229,0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (activeTab !== tab.id) {
                    target.style.backgroundColor = '#f3f4f6';
                    target.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  if (activeTab !== tab.id) {
                    target.style.backgroundColor = 'white';
                    target.style.color = '#6b7280';
                  }
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 我的联盟 */}
        {activeTab === 'my' && (
          <div>
            {userAlliance ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <AllianceFlag
                      flagPatternId={userAlliance.flag_pattern_id}
                      size="lg"
                    />
                    <div>
                      <h2 style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#111827',
                        margin: '0'
                      }}>{userAlliance.name}</h2>
                      <p style={{
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>{userAlliance.description || '暂无描述'}</p>
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'right'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}>成员数量</div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      color: '#4f46e5'
                    }}>{userAlliance.member_count}</div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: '#eef2ff',
                    borderRadius: '10px',
                    border: '1px solid #c7d2fe'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#4f46e5'
                    }}>
                      {allianceStats?.totalPixels?.toLocaleString() || '0'}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginTop: '8px'
                    }}>累计像素</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      marginTop: '4px'
                    }}>历史上所有像素总数</div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '10px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#10b981'
                    }}>
                      {allianceStats?.currentPixels?.toLocaleString() || '0'}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginTop: '8px'
                    }}>当前像素</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      marginTop: '4px'
                    }}>当前实际占有的像素</div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: '#f3e8ff',
                    borderRadius: '10px',
                    border: '1px solid #e9d5ff'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#a855f7'
                    }}>{userAlliance.user_role || 'member'}</div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginTop: '8px'
                    }}>我的角色</div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={handleLeaveAlliance}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444';
                    }}
                  >
                    退出联盟
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: '48px 24px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px'
                }}>🏠</div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#111827',
                  marginBottom: '8px',
                  margin: '0 0 8px 0'
                }}>您还没有加入联盟</h3>
                <p style={{
                  color: '#6b7280',
                  marginBottom: '24px',
                  margin: '8px 0 24px 0'
                }}>加入联盟与其他玩家一起征服像素世界</p>
                {showQuickJoin && (
                  <div style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    textAlign: 'left'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: '12px'
                    }}>
                      推荐联盟（活跃度优先）
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {recommendedAlliances.map(alliance => (
                        <div key={alliance.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AllianceFlag flagPatternId={alliance.flag_pattern_id} size="sm" />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                {alliance.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {alliance.member_count} 成员
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleQuickJoin(alliance)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#111827',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {alliance.approval_required ? '申请加入' : '立即加入'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px'
                }}>
                  <button
                    onClick={() => setActiveTab('create')}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                    }}
                  >
                    创建联盟
                  </button>
                  <button
                    onClick={() => setActiveTab('join')}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
                    }}
                  >
                    加入联盟
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 创建联盟 */}
        {activeTab === 'create' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '24px',
              margin: '0 0 24px 0'
            }}>创建联盟</h2>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>联盟名称</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="输入联盟名称"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>联盟旗帜</label>
                <div style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease'
                }}>
                  <AllianceFlagPicker
                    value={createForm.flagPatternId}
                    onChange={handlePatternSelect}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>联盟描述</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                  placeholder="描述您的联盟..."
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={createForm.is_public}
                      onChange={(e) => setCreateForm({ ...createForm, is_public: e.target.checked })}
                      style={{
                        marginRight: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <label htmlFor="is_public" style={{
                      fontSize: '14px',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      公开联盟（其他用户可以搜索到）
                    </label>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type="checkbox"
                      id="approval_required"
                      checked={createForm.approval_required}
                      onChange={(e) => setCreateForm({ ...createForm, approval_required: e.target.checked })}
                      style={{
                        marginRight: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <label htmlFor="approval_required" style={{
                      fontSize: '14px',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      需要审批（加入申请需要盟主批准）
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              marginTop: '24px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleCreateAlliance}
                disabled={!createForm.name || !createForm.flagPatternId}
                style={{
                  padding: '8px 24px',
                  backgroundColor: !createForm.name || !createForm.flagPatternId ? '#d1d5db' : '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !createForm.name || !createForm.flagPatternId ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (!createForm.name || !createForm.flagPatternId) return;
                  (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                }}
                onMouseLeave={(e) => {
                  if (!createForm.name || !createForm.flagPatternId) return;
                  (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                }}
              >
                创建联盟
              </button>
            </div>
          </div>
        )}

        {/* 加入联盟 */}
        {activeTab === 'join' && (
          <div>
            {showQuickJoin && (
              <div style={{
                backgroundColor: '#0f172a',
                color: 'white',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.3)'
              }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
                  快速加入推荐联盟
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5f5', marginBottom: '12px' }}>
                  选择活跃度高的联盟，立刻参与区域争夺
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {recommendedAlliances.map(alliance => (
                    <div key={alliance.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(148, 163, 184, 0.12)',
                      borderRadius: '10px',
                      padding: '10px 12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AllianceFlag flagPatternId={alliance.flag_pattern_id} size="sm" />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{alliance.name}</div>
                          <div style={{ fontSize: '12px', color: '#cbd5f5' }}>{alliance.member_count} 成员</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickJoin(alliance)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#22c55e',
                          color: '#0f172a',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                      >
                        {alliance.approval_required ? '申请加入' : '立即加入'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '16px',
                margin: '0 0 16px 0'
              }}>搜索联盟</h2>
              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="搜索联盟名称或描述..."
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  onClick={() => {
                    logger.info('🔍 点击搜索按钮，搜索词:', searchTerm);
                    loadAllianceData(searchTerm);
                  }}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                  }}
                >
                  搜索
                </button>
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                找到 {alliances.length} 个联盟
              </div>
            </div>

            {alliances.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: '48px 24px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px'
                }}>🔍</div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#111827',
                  marginBottom: '8px',
                  margin: '0 0 8px 0'
                }}>
                  {searchTerm ? '没有找到匹配的联盟' : '暂无公开联盟'}
                </h3>
                <p style={{
                  color: '#6b7280',
                  marginBottom: '24px',
                  margin: '8px 0 24px 0'
                }}>
                  {searchTerm
                    ? '请尝试使用其他关键词搜索，或创建自己的联盟'
                    : '目前还没有公开的联盟，您可以创建第一个联盟'
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setActiveTab('create')}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                    }}
                  >
                    创建联盟
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {alliances.map(alliance => (
                  <div key={alliance.id} style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    padding: '16px',
                    transition: 'all 0.3s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    el.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                    el.style.transform = 'translateY(0)';
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <AllianceFlag
                          flagPatternId={alliance.flag_pattern_id}
                          size="md"
                        />
                        <div>
                          <h3 style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#111827',
                            margin: '0'
                          }}>{alliance.name}</h3>
                          <p style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            margin: '4px 0 0 0'
                          }}>联盟</p>
                        </div>
                      </div>
                      <div style={{
                        textAlign: 'right'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>成员</div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#4f46e5'
                        }}>{alliance.member_count}</div>
                      </div>
                    </div>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '13px',
                      marginBottom: '12px',
                      margin: '12px 0'
                    }}>
                      {alliance.description || '暂无描述'}
                    </p>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af'
                      }}>
                        创建于 {new Date(alliance.created_at).toLocaleDateString()}
                      </div>
                      <button
                        onClick={() => {
                          if (alliance.approval_required) {
                            setJoinForm({ ...joinForm, allianceId: alliance.id });
                            setShowJoinForm(true);
                          } else {
                            handleQuickJoin(alliance);
                          }
                        }}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
                        }}
                      >
                        {alliance.approval_required ? '申请加入' : '立即加入'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 联盟管理 */}
        {activeTab === 'manage' && userAlliance && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '24px',
              margin: '0 0 24px 0'
            }}>联盟管理</h2>

            {/* 管理子标签页 - 药丸按钮组 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '24px'
            }}>
              {[
                { id: 'members', label: '成员管理', icon: Users },
                { id: 'applications', label: '申请审批', icon: FileText },
                { id: 'settings', label: '联盟设置', icon: Settings },
                { id: 'invites', label: '邀请链接', icon: Link2 }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setManageSubTab(tab.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: manageSubTab === tab.id ? 'none' : '1px solid #d1d5db',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backgroundColor: manageSubTab === tab.id ? '#4f46e5' : 'white',
                      color: manageSubTab === tab.id ? 'white' : '#6b7280',
                      boxShadow: manageSubTab === tab.id ? '0 2px 8px rgba(79,70,229,0.2)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget as HTMLButtonElement;
                      if (manageSubTab !== tab.id) {
                        target.style.backgroundColor = '#f3f4f6';
                        target.style.color = '#374151';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.currentTarget as HTMLButtonElement;
                      if (manageSubTab !== tab.id) {
                        target.style.backgroundColor = 'white';
                        target.style.color = '#6b7280';
                      }
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 成员管理 */}
            {manageSubTab === 'members' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {members.map(member => (
                  <div key={member.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    backgroundColor: '#f9fafb'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        {memberAvatarUrls.has(member.id) ? (
                          <img
                            src={memberAvatarUrls.get(member.id)!}
                            alt={`${member.username}头像`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '50%'
                            }}
                            onError={(e) => {
                              logger.error('❌ 联盟成员头像加载失败:', member.id, memberAvatarUrls.get(member.id));
                              // 加载失败时回退到默认头像
                              setMemberAvatarUrls(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(member.id);
                                return newMap;
                              });
                            }}
                          />
                        ) : loadingMemberAvatars.has(member.id) ? (
                          // 加载中显示动画
                          <div style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid #d1d5db',
                            borderTop: '2px solid #3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        ) : member.avatar_url ? (
                          // 回退到原有的avatar_url
                          <img
                            src={member.avatar_url}
                            alt={`${member.username}头像`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '50%'
                            }}
                            onError={(e) => {
                              logger.error('❌ 联盟成员旧头像加载失败:', member.id, member.avatar_url);
                            }}
                          />
                        ) : (
                          // 默认头像
                          '👤'
                        )}
                      </div>
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            fontWeight: 500,
                            color: '#111827'
                          }}>{member.username}</span>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: member.role === 'leader' ? '#fee2e2' : member.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                            color: member.role === 'leader' ? '#991b1b' : member.role === 'admin' ? '#1e40af' : '#4b5563'
                          }}>
                            {member.role === 'leader' ? '盟主' : member.role === 'admin' ? '管理员' : '成员'}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          marginTop: '4px'
                        }}>
                          像素: 0 | 加入: {new Date(member.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      {(userAlliance.user_role === 'leader' || userAlliance.user_role === 'admin') && member.role !== 'leader' && (
                        <>
                          {member.role === 'admin' ? (
                            <button
                              onClick={() => handlePromoteMember(member.id, 'member')}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: '#eab308',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#ca8a04';
                              }}
                              onMouseLeave={(e) => {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#eab308';
                              }}
                            >
                              取消管理员
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePromoteMember(member.id, 'admin')}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                              }}
                              onMouseLeave={(e) => {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                              }}
                            >
                              设为管理员
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(member.id)}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444';
                            }}
                          >
                            踢出
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 申请审批 */}
            {manageSubTab === 'applications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {applications.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '32px 16px',
                    color: '#9ca3af'
                  }}>
                    暂无待审批的申请
                  </div>
                ) : (
                  applications.map(application => (
                    <div key={application.id} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '16px',
                      backgroundColor: '#f9fafb'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                          }}>
                            👤
                          </div>
                          <div>
                            <div style={{
                              fontWeight: 500,
                              color: '#111827'
                            }}>{application.username}</div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280'
                            }}>
                              申请时间: {new Date(application.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '8px'
                        }}>
                          <button
                            onClick={() => handleReviewApplication(application.id, 'approve', '欢迎加入联盟！')}
                            style={{
                              padding: '6px 16px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
                            }}
                          >
                            批准
                          </button>
                          <button
                            onClick={() => handleReviewApplication(application.id, 'reject', '抱歉，申请被拒绝')}
                            style={{
                              padding: '6px 16px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444';
                            }}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: '#f3f4f6',
                        padding: '12px',
                        borderRadius: '6px'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>申请消息:</div>
                        <div style={{
                          color: '#111827'
                        }}>{application.message}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 联盟设置 */}
            {manageSubTab === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: '16px',
                    margin: '0 0 16px 0'
                  }}>联盟信息</h3>

                  {/* 联盟旗帜选择 */}
                  <div style={{
                    marginBottom: '16px'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>联盟旗帜</label>
                    <AllianceFlagPicker
                      value={editForm.flagPatternId || userAlliance.flag_pattern_id}
                      onChange={handleEditFlagSelect}
                    />
                    {editForm.flagPatternId && editForm.flagPatternId !== userAlliance.flag_pattern_id && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#0284c7'
                      }}>
                        ⚠️ 旗帜已更改，点击"保存设置"后生效
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px'
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#374151',
                        marginBottom: '8px'
                      }}>联盟名称</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#4f46e5';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#374151',
                        marginBottom: '8px'
                      }}>联盟描述</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#4f46e5';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: '16px',
                    margin: '0 0 16px 0'
                  }}>联盟设置</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input
                        type="checkbox"
                        id="edit_is_public"
                        checked={editForm.is_public}
                        onChange={(e) => setEditForm({ ...editForm, is_public: e.target.checked })}
                        style={{
                          marginRight: '8px',
                          cursor: 'pointer'
                        }}
                      />
                      <label htmlFor="edit_is_public" style={{
                        fontSize: '14px',
                        color: '#374151',
                        cursor: 'pointer'
                      }}>
                        公开联盟（其他用户可以搜索到）
                      </label>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input
                        type="checkbox"
                        id="edit_approval_required"
                        checked={editForm.approval_required}
                        onChange={(e) => setEditForm({ ...editForm, approval_required: e.target.checked })}
                        style={{
                          marginRight: '8px',
                          cursor: 'pointer'
                        }}
                      />
                      <label htmlFor="edit_approval_required" style={{
                        fontSize: '14px',
                        color: '#374151',
                        cursor: 'pointer'
                      }}>
                        需要审批（加入申请需要盟主批准）
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={handleUpdateAlliance}
                    style={{
                      padding: '8px 24px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                    }}
                  >
                    保存设置
                  </button>
                </div>
              </div>
            )}

            {/* 邀请链接 */}
            {manageSubTab === 'invites' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  backgroundColor: '#dbeafe',
                  border: '1px solid #93c5fd',
                  borderRadius: '10px',
                  padding: '16px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1e3a8a',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}>邀请链接</h3>
                  <p style={{
                    color: '#1e40af',
                    fontSize: '14px',
                    marginBottom: '16px',
                    margin: '8px 0 16px 0'
                  }}>
                    生成邀请链接，让其他用户可以直接加入联盟而无需申请
                  </p>
                  <button
                    onClick={handleGenerateInviteLink}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4338ca';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = '#4f46e5';
                    }}
                  >
                    生成邀请链接
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 加入联盟弹窗 */}
      {showJoinForm && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1f2937',
                flex: 1,
                margin: '0'
              }}>
                申请加入联盟
              </h3>
              <button
                onClick={() => setShowJoinForm(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  (e.currentTarget as HTMLButtonElement).style.color = '#4b5563';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 显示联盟信息 */}
            {(() => {
              const targetAlliance = alliances.find(a => a.id === joinForm.allianceId);
              return targetAlliance ? (
                <div style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <AllianceFlag
                      flagPatternId={targetAlliance.flag_pattern_id}
                      size="md"
                    />
                    <div>
                      <h4 style={{
                        fontWeight: 500,
                        color: '#111827',
                        margin: '0'
                      }}>{targetAlliance.name}</h4>
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>
                        {targetAlliance.member_count} 个成员
                      </p>
                    </div>
                  </div>
                  {targetAlliance.description && (
                    <p style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginTop: '8px',
                      margin: '8px 0 0 0'
                    }}>{targetAlliance.description}</p>
                  )}
                </div>
              ) : null;
            })()}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '8px'
              }}>
                申请消息 <span style={{ color: '#9ca3af' }}>(可选)</span>
              </label>
              <textarea
                value={joinForm.message}
                onChange={(e) => setJoinForm({ ...joinForm, message: e.target.value })}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
                placeholder="写一段申请消息，介绍自己或说明加入原因..."
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#4f46e5';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <p style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginTop: '4px',
                margin: '4px 0 0 0'
              }}>
                申请消息将发送给联盟管理员，帮助您获得批准
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowJoinForm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                }}
              >
                取消
              </button>
              <button
                onClick={handleJoinAlliance}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
                }}
              >
                发送申请
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={hideDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
    </div>
  );
}
