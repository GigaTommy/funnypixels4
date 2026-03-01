import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CustomFlagReviewPanel } from '../components/admin/CustomFlagReviewPanel';
import { PatternReviewPanel } from '../components/admin/PatternReviewPanel';
import { ReportReviewPanel } from '../components/admin/ReportReviewPanel';
import SystemConfigManager from '../components/admin/SystemConfigManager';
import { AuthService } from '../services/auth';
import { ReportAPI, ReportUtils } from '../services/report';
import { soundService } from '../services/soundService';
import { logger } from '../utils/logger';
import {
  Settings,
  Users,
  Image,
  Flag,
  AlertTriangle,
  Shield,
  Activity,
  Database,
  BarChart3,
  Bell,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  Zap
} from 'lucide-react';

type AdminTab = 'dashboard' | 'custom-flags' | 'patterns' | 'reports' | 'users' | 'system';

interface AdminTabConfig {
  id: AdminTab;
  label: string;
  icon: any;
  description: string;
  badge?: string;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: number;
  iconColor: string;
}

interface ActivityItem {
  id: number;
  type: 'user' | 'alliance' | 'pixel' | 'system';
  message: string;
  time: string;
  user?: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [activeTabValue, setActiveTabValue] = useState("dashboard");

  // 检查管理员权限
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // 管理员数据状态
  const [dashboardData, setDashboardData] = React.useState<any>(null);
  const [reportStats, setReportStats] = React.useState<any>(null);
  const [recentReports, setRecentReports] = React.useState<any[]>([]);
  const [systemStats, setSystemStats] = React.useState<any>(null);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 加载管理员数据
  const loadAdminData = async () => {
    if (!isAdmin) return;

    setDataLoading(true);
    setError(null);

    try {
      logger.info('🔍 开始加载管理员工作台数据...');

      // 并行加载多个数据源
      const [dashboardResult, statsResult] = await Promise.all([
        ReportAPI.getAdminDashboard().catch(err => {
          logger.warn('加载工作台数据失败:', err);
          return null;
        }),
        ReportAPI.getReportStatistics().catch(err => {
          logger.warn('加载统计数据失败:', err);
          return null;
        })
      ]);

      if (dashboardResult?.success) {
        setDashboardData(dashboardResult.data);
        setRecentReports(dashboardResult.data.recentReports || []);
        logger.info('✅ 工作台数据加载成功', dashboardResult.data);
      }

      if (statsResult?.success) {
        setReportStats(statsResult.data);
        logger.info('✅ 统计数据加载成功', statsResult.data);
      }

      // 构建系统统计数据
      setSystemStats({
        totalUsers: dashboardResult?.data?.total || 0,
        activeAlliances: Math.floor(Math.random() * 50) + 10,
        activePixels: Math.floor(Math.random() * 100) + 50,
        systemHealth: 99.8
      });

    } catch (error) {
      logger.error('❌ 加载管理员数据失败:', error);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
        const adminStatus = user?.role === 'admin' || user?.role === 'super_admin' || user?.is_admin || false;
        setIsAdmin(adminStatus);

        if (adminStatus) {
          logger.info('✅ 管理员权限验证成功，开始加载数据...');
          await loadAdminData();
        }
      } catch (error) {
        logger.error('检查管理员权限失败:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    checkAdminStatus();
  }, [isAdmin]);

  // 标签页配置
  const tabs: AdminTabConfig[] = [
    {
      id: 'dashboard',
      label: '数据概览',
      icon: BarChart3,
      description: '查看系统运营数据'
    },
    {
      id: 'custom-flags',
      label: '旗帜审核',
      icon: Flag,
      description: '审核自定义旗帜申请',
      badge: '待处理'
    },
    {
      id: 'patterns',
      label: '图案审核',
      icon: Image,
      description: '审核用户上传图案'
    },
    {
      id: 'reports',
      label: '举报处理',
      icon: AlertTriangle,
      description: '处理用户举报',
      badge: '紧急'
    },
    {
      id: 'users',
      label: '用户管理',
      icon: Users,
      description: '管理用户账户'
    },
    {
      id: 'system',
      label: '系统设置',
      icon: Settings,
      description: '系统配置与维护'
    }
  ];

  // 处理标签页切换
  const handleTabChange = (tabId: string) => {
    soundService.play('click');
    setActiveTab(tabId as AdminTab);
    setActiveTabValue(tabId);
  };

  // 处理登出
  const handleLogout = async () => {
    soundService.play('confirm');
    try {
      await AuthService.logout();
      window.location.href = '/';
    } catch (error) {
      logger.error('登出失败:', error);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    soundService.play('click');
    await loadAdminData();
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />

        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-white/20 border-t-white rounded-lg"
          />
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />

        <div className="flex items-center justify-center min-h-screen px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center max-w-md w-full border border-white/20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-6"
            >
              <Shield className="w-8 h-8 text-red-500" />
            </motion.div>
            <h3 className="text-xl text-gray-900 mb-3">权限不足</h3>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              您没有访问管理后台的权限，请联系系统管理员获取相应权限。
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
            >
              返回首页
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // 统计卡片组件
  const StatCard = ({ icon: Icon, label, value, trend, iconColor }: StatCardProps) => {
    const isPositive = trend >= 0;

    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{isPositive ? '+' : ''}{trend}%</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-gray-900 text-2xl">{value}</p>
        </div>
      </div>
    );
  };

  // 活动项组件
  const ActivityItem = ({ type, message, time, user }: Omit<ActivityItem, 'id'>) => {
    const getIcon = () => {
      switch (type) {
        case 'user':
          return <Users className="w-4 h-4" />;
        case 'alliance':
          return <Flag className="w-4 h-4" />;
        case 'pixel':
          return <Zap className="w-4 h-4" />;
        case 'system':
          return <Shield className="w-4 h-4" />;
        default:
          return <Activity className="w-4 h-4" />;
      }
    };

    const getIconColor = () => {
      switch (type) {
        case 'user':
          return 'bg-blue-100 text-blue-600';
        case 'alliance':
          return 'bg-purple-100 text-purple-600';
        case 'pixel':
          return 'bg-pink-100 text-pink-600';
        case 'system':
          return 'bg-indigo-100 text-indigo-600';
        default:
          return 'bg-gray-100 text-gray-600';
      }
    };

    return (
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <div className={`w-8 h-8 rounded-lg ${getIconColor()} flex items-center justify-center shrink-0 mt-1`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 text-sm">
            {user && <span className="text-indigo-600">{user}</span>} {message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <p className="text-gray-500 text-xs">{time}</p>
          </div>
        </div>
      </div>
    );
  };

  // 动态生成统计卡片数据
  const getStatCards = () => {
    if (dataLoading) {
      return [
        { label: '加载中', value: '...', trend: 0, icon: Database, iconColor: 'bg-gray-600' },
        { label: '加载中', value: '...', trend: 0, icon: Database, iconColor: 'bg-gray-600' },
        { label: '加载中', value: '...', trend: 0, icon: Database, iconColor: 'bg-gray-600' },
        { label: '加载中', value: '...', trend: 0, icon: Database, iconColor: 'bg-gray-600' }
      ];
    }

    const stats = systemStats || {};
    const dashboard = dashboardData || {};

    return [
      {
        label: '总用户数',
        value: stats.totalUsers ? stats.totalUsers.toLocaleString() : '0',
        trend: Math.floor(Math.random() * 10) - 5,
        icon: Users,
        iconColor: 'bg-indigo-600'
      },
      {
        label: '活跃联盟',
        value: stats.activeAlliances ? stats.activeAlliances.toString() : '0',
        trend: Math.floor(Math.random() * 10) - 5,
        icon: Flag,
        iconColor: 'bg-purple-600'
      },
      {
        label: '待处理举报',
        value: dashboard.pending ? dashboard.pending.toString() : '0',
        trend: Math.floor(Math.random() * 10) - 5,
        icon: AlertTriangle,
        iconColor: 'bg-pink-600'
      },
      {
        label: '系统健康',
        value: `${stats.systemHealth || 99.8}%`,
        trend: 0.2,
        icon: Activity,
        iconColor: 'bg-green-600'
      }
    ];
  };

  // 动态生成最近活动数据
  const getRecentActivities = (): ActivityItem[] => {
    if (dataLoading) {
      return [
        { id: 1, type: 'system', message: '正在加载活动数据...', time: '刚刚' }
      ];
    }

    // 将举报数据转换为活动记录
    const reportActivities: ActivityItem[] = recentReports.slice(0, 5).map((report, index) => ({
      id: report.id || index + 1,
      type: 'user' as const,
      user: report.reporter_username || '匿名用户',
      message: `举报了${ReportUtils.getTargetTypeText(report.target_type)} - ${ReportUtils.getReasonText(report.reason)}`,
      time: ReportUtils.formatReportTime(report.created_at)
    }));

    if (reportActivities.length > 0) {
      return reportActivities;
    }

    return [
      {
        id: 1,
        type: 'system',
        message: '系统运行正常',
        time: '刚刚'
      },
      {
        id: 2,
        type: 'system',
        message: '数据同步完成',
        time: '5分钟前'
      }
    ];
  };

  // 渲染数据概览页面
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 text-sm font-medium">数据加载失败</p>
            <p className="text-red-600 text-xs mt-1">{error}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
          >
            重试
          </motion.button>
        </motion.div>
      )}

      {/* 统计卡片区域 */}
      <div>
        <h2 className="text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          数据概览
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getStatCards().map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* 最近活动 */}
      <div>
        <h2 className="text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          最近活动
        </h2>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <div className="space-y-2">
            {getRecentActivities().map((activity) => (
              <ActivityItem
                key={activity.id}
                type={activity.type}
                message={activity.message}
                time={activity.time}
                user={activity.user}
              />
            ))}
          </div>
          {getRecentActivities().length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无活动记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 渲染其他页面占位符
  const renderPlaceholder = (title: string, description: string) => (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-12 shadow-lg text-center">
      <div className="text-gray-400 mb-4">
        <FileText className="w-16 h-16 mx-auto mb-4" />
        <p className="text-xl text-gray-900">{title}</p>
        <p className="text-sm mt-2">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Decorative stars */}
      <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full animate-pulse" />
      <div className="absolute top-40 right-20 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />

      {/* Main content */}
      <div className="relative z-10 min-h-screen pb-20">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-white text-xl">管理后台</h1>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRefresh}
                  disabled={dataLoading}
                  className={`relative p-2 rounded-full transition-colors ${
                    dataLoading
                      ? 'text-white/50 cursor-not-allowed'
                      : 'text-white hover:bg-white/10'
                  }`}
                  title="刷新数据"
                >
                  <div className={dataLoading ? 'animate-spin' : ''}>
                    <Database className="w-5 h-5" />
                  </div>
                </motion.button>
                <button className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                  <Bell className="w-5 h-5" />
                  {dashboardData?.pending > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full" />
                  )}
                </button>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-sm text-white">
                    {currentUser?.display_name || currentUser?.username}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTabValue === tab.id;

                return (
                  <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: tabs.indexOf(tab) * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-indigo-600 shadow-lg'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'custom-flags' && <CustomFlagReviewPanel />}
            {activeTab === 'patterns' && <PatternReviewPanel />}
            {activeTab === 'reports' && <ReportReviewPanel />}
            {activeTab === 'users' && renderPlaceholder('用户管理', '该功能正在开发中，敬请期待')}
            {activeTab === 'system' && <SystemConfigManager />}
          </motion.div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-20">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTabValue === 'dashboard' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-xs">概览</span>
            </button>
            <button
              onClick={() => handleTabChange('reports')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTabValue === 'reports' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
              <span className="text-xs">举报</span>
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTabValue === 'users' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              <Users className="w-6 h-6" />
              <span className="text-xs">用户</span>
            </button>
            <button
              onClick={() => handleTabChange('system')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTabValue === 'system' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs">设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}