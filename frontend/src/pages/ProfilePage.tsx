import React, { useState, useEffect, useCallback, useMemo } from "react";
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Edit3,
  Shield,
  LogOut,
  Trash2,
  Camera,
  Save,
  X,
  Crown,
  Users,
  Clock,
  MapPin,
  Award,
  Settings,
  Heart,
  Star,
  Trophy,
  MessageCircle,
  Lock,
  CheckCircle,
} from "lucide-react";
import PixelSessionHistory from '../components/PixelSessionHistory';
import TravelHistory from '../components/TravelHistory';
import DrawingHistory from '../components/DrawingHistory';
import { BiSolidToggleLeft, BiSolidToggleRight } from "react-icons/bi";
import { AuthService } from "../services/auth";
import { AllianceAPI } from "../services/alliance";
import { CosmeticAPI } from "../services/cosmetic";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import AvatarEditor from "../components/AvatarEditor";
import { AllianceFlag } from "../components/AllianceFlag";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { Badge } from "../components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { soundService } from '../services/soundService';
import { toast } from '../services/toast';
import { avatarService } from '../services/avatarService';
import CustomerService from '../components/CustomerService';

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  motto?: string;
  alliance?: {
    id: string;
    name: string;
    flag: string;
    color?: string;
    pattern_id?: string;
  };
  privacy: {
    hideNickname: boolean;
    hideAlliance: boolean;
    hideAllianceFlag: boolean;
  };
  stats: {
    totalPixels: number;
    currentPixels: number;
    drawTime: number;
  };
  nicknameChangeLimit?: {
    canChange: boolean;
    daysSinceLastChange: number;
    changeCount: number;
    lastChange: string | null;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [equippedCosmetics, setEquippedCosmetics] = useState<any[]>([]);
  const [latestCosmetic, setLatestCosmetic] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    display_name: "",
    motto: "",
    privacy: {
      hideNickname: false,
      hideAlliance: false,
      hideAllianceFlag: false,
    },
  });

  
  // 优化性能：缓存统计数据格式化
  const formattedStats = useMemo(() => {
    if (!profile) return null;

    return {
      totalPixels: profile.stats.totalPixels.toLocaleString(),
      currentPixels: profile.stats.currentPixels.toLocaleString(),
      drawTimeMinutes: Math.floor(profile.stats.drawTime / 60).toLocaleString(),
      drawTimeHours: (profile.stats.drawTime / 3600).toFixed(1),
    };
  }, [profile]);

  useEffect(() => {
    // 检查认证状态
    const checkAuthStatus = async () => {
      try {
        const isAuth = AuthService.isAuthenticated();
        setIsAuthenticated(isAuth);

        if (isAuth) {
          await loadProfile();
          await loadCosmetics();
        } else {
          // 游客模式下只加载基本信息
          await loadGuestProfile();
        }
      } catch (error) {
        logger.error("检查认证状态失败:", error);
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const loadGuestProfile = useCallback(async () => {
    try {
      setLoading(true);
      logger.info("👤 游客模式，加载基本信息");

      // 游客模式下的基本信息
      const guestProfile: UserProfile = {
        id: "guest",
        username: "游客",
        display_name: "游客",
        privacy: {
          hideNickname: false,
          hideAlliance: false,
          hideAllianceFlag: false,
        },
        stats: {
          totalPixels: 0,
          currentPixels: 0,
          drawTime: 0,
        },
      };

      setProfile(guestProfile);
      setLoading(false);
    } catch (error) {
      logger.error("加载游客信息失败:", error);
      setLoading(false);
    }
  }, []);

  const loadCosmetics = useCallback(async () => {
    try {
      // 加载装备的装饰品
      const equippedResponse = await CosmeticAPI.getEquippedCosmetics();
      if (equippedResponse.success) {
        setEquippedCosmetics(equippedResponse.cosmetics);
      }

      // 加载最新使用的装饰品
      const latestResponse = await CosmeticAPI.getLatestUsedCosmetic();
      if (latestResponse.success) {
        setLatestCosmetic(latestResponse.cosmetic);
      }
    } catch (error) {
      logger.error("加载装饰品失败:", error);
    }
  }, []);

  // 加载用户头像
  const loadUserAvatar = useCallback(async (userId: string, avatarData?: string) => {
    if (!avatarData) {
      setAvatarUrl(null);
      return;
    }

    setIsLoadingAvatar(true);
    try {
      logger.info('🎨 开始加载用户头像:', { userId, hasAvatarData: !!avatarData });

      // 使用新的头像服务获取头像URL
      const url = await avatarService.getAvatarUrl(
        userId,
        avatarData,
        'medium' // 个人资料使用中等尺寸头像
      );

      if (url) {
        setAvatarUrl(url);
        logger.info('✅ 用户头像URL已获取:', { userId, avatarUrl: url });
      } else {
        // 如果无法获取新头像，保持null状态，使用默认头像
        setAvatarUrl(null);
        logger.info('⚠️ 使用默认头像');
      }
    } catch (error) {
      logger.error('❌ 加载用户头像失败:', error);
      setAvatarUrl(null);
    } finally {
      setIsLoadingAvatar(false);
    }
  }, []);

  
  // 加载隐私设置的函数
  const loadPrivacySettings = useCallback(async () => {
    try {
      logger.info("🔄 Loading privacy settings...");

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.info("✅ Privacy settings loaded:", data.data.settings);
        return data.data.settings;
      } else {
        logger.error("❌ Failed to load privacy settings:", await response.text());
        return null;
      }
    } catch (error) {
      logger.error("❌ Error loading privacy settings:", error);
      return null;
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const user = await AuthService.getCurrentUser();
      if (user) {
        let allianceInfo = null;
        try {
          const allianceResponse = await AllianceAPI.getUserAlliance();
          if (allianceResponse.alliance) {
            // 获取联盟旗帜信息
            let flagInfo = null;
            try {
              const flagResponse = await AllianceAPI.getUserAllianceFlag();
              if (flagResponse.success && flagResponse.flag) {
                flagInfo = flagResponse.flag;
              }
            } catch (error) {
              logger.info("获取联盟旗帜失败:", error);
            }

            allianceInfo = {
              id: allianceResponse.alliance.id,
              name: allianceResponse.alliance.name,
              flag: flagInfo?.unicode_char || "🏴", // 使用unicode_char作为旗帜，如果没有则使用默认旗帜
              pattern_id:
                allianceResponse.alliance.flag_pattern_id ||
                "default-pattern-id",
            };
          }
        } catch (error) {
          logger.info("用户未加入联盟");
        }

        // 获取昵称修改限制信息
        let nicknameChangeLimit = null;
        try {
          const limitResponse = await AuthService.checkNicknameChangeLimit();
          nicknameChangeLimit = limitResponse;
        } catch (error) {
          logger.info("获取昵称修改限制失败:", error);
        }

        // 加载隐私设置
        const privacySettings = await loadPrivacySettings();

        const userProfile: UserProfile = {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || user.avatar_url, // 优先使用avatar字段，兼容avatar_url
          motto: user.motto,
          alliance: allianceInfo || undefined,
          privacy: {
            hideNickname: privacySettings?.hide_nickname || false,
            hideAlliance: privacySettings?.hide_alliance || false,
            hideAllianceFlag: privacySettings?.hide_alliance_flag || false,
          },
          stats: {
            totalPixels:
              user.total_pixels || Math.floor(Math.random() * 1000) + 100,
            currentPixels:
              user.current_pixels || Math.floor(Math.random() * 500) + 50,
            drawTime: Math.floor(Math.random() * 7200) + 300,
          },
          nicknameChangeLimit: nicknameChangeLimit || undefined,
        };

        logger.info("🔄 Loaded privacy settings from backend:", privacySettings);
        logger.info("🔄 Converted to frontend format:", userProfile.privacy);

        logger.info("🔄 Setting profile with privacy:", userProfile.privacy);
        setProfile(userProfile);

        // 加载用户头像
        await loadUserAvatar(userProfile.id, user.avatar);

        setFormData({
          username: userProfile.username,
          display_name: userProfile.display_name || "",
          motto: userProfile.motto || "",
          privacy: { ...userProfile.privacy },
        });
      }
    } catch (error) {
      logger.error("加载个人资料失败:", error);
    } finally {
      setLoading(false);
    }
  }, [loadPrivacySettings]);

  const handleSave = useCallback(async () => {
    if (saving) return;

    // 播放确认音效
    soundService.play('confirm');

    try {
      setSaving(true);
      await AuthService.updateProfile(formData);
      setEditing(false);
      await loadProfile();

      // 成功提示
      const notification = document.createElement("div");
      notification.className =
        "fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300";
      notification.textContent = "✅ 保存成功！";
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 2000);
    } catch (error) {
      const notification = document.createElement("div");
      notification.className =
        "fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50";
      notification.textContent = `❌ 保存失败: ${error instanceof Error ? error.message : "未知错误"}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    } finally {
      setSaving(false);
    }
  }, [saving, formData, loadProfile]);

  // 标签切换处理函数
  const handleProfileTabChange = useCallback((tabId: string) => {
    // 播放点击音效
    soundService.play('click');
    setActiveTab(tabId as any);
  }, []);

  
  // 编辑模式切换处理函数
  const handleToggleEdit = useCallback((editing: boolean) => {
    // 播放点击音效
    soundService.play('click');
    setEditing(editing);
  }, []);

  // 显示模态框处理函数
  const handleShowModal = useCallback((modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    // 播放点击音效
    soundService.play('click');
    modalSetter(true);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    // 播放错误音效（删除操作是危险操作）
    soundService.play('error');

    try {
      await AuthService.deleteAccount();
      window.location.reload();
    } catch (error) {
      const notification = document.createElement("div");
      notification.className =
        "fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50";
      notification.textContent = `❌ 删除失败: ${error instanceof Error ? error.message : "未知错误"}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    // 播放取消音效
    soundService.play('cancel');

    try {
      await AuthService.logout();
      window.location.reload();
    } catch (error) {
      logger.error("登出失败:", error);
    }
  }, []);

  // 将压缩的像素数据转换为图片URL用于显示
  const convertPixelDataToImage = useCallback((pixelData: string) => {
    if (!pixelData || !pixelData.includes(",")) {
      return pixelData; // 如果不是压缩数据，直接返回
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return pixelData;

      const AVATAR_SIZE = 32;
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;

      // 填充白色背景
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

      // 解析像素数据并绘制
      const colorArray = pixelData.split(",");
      for (let y = 0; y < AVATAR_SIZE; y++) {
        for (let x = 0; x < AVATAR_SIZE; x++) {
          const index = y * AVATAR_SIZE + x;
          const color = colorArray[index] || "#FFFFFF";
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      return canvas.toDataURL("image/png");
    } catch (error) {
      logger.warn("⚠️ 像素数据转换失败:", error);
      return pixelData;
    }
  }, []);

  const handleAvatarSave = useCallback(
    async (avatarData: any) => {
      logger.info("🔄 ProfilePage.handleAvatarSave 开始执行");
      logger.info("📊 头像数据类型:", typeof avatarData);
      logger.info("📊 头像数据长度:", avatarData?.length || "undefined");
      logger.info(
        "📊 头像数据前100字符:",
        avatarData?.substring?.(0, 100) || "无法截取",
      );

      try {
        logger.info("🔄 调用AuthService.updateProfile...");
        // 保存压缩的像素数组数据到后端
        await AuthService.updateProfile({ avatar: avatarData });
        logger.info("✅ AuthService.updateProfile 调用成功");

        // 立即更新本地profile状态，避免等待重新加载
        if (profile) {
          const updatedProfile = { ...profile, avatar: avatarData };
          logger.info("🔄 立即更新本地profile状态:", updatedProfile);
          setProfile(updatedProfile);
        }

        logger.info("🔄 设置showAvatarEditor为false...");
        setShowAvatarEditor(false);
        logger.info("✅ showAvatarEditor已设置为false");

        logger.info("🔄 重新加载个人资料...");
        await loadProfile();
        logger.info("✅ 个人资料重新加载完成");

        // 成功提示
        const notification = document.createElement("div");
        notification.className =
          "fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300";
        notification.textContent = "✅ 头像保存成功！";
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } catch (error) {
        logger.error("❌ ProfilePage.handleAvatarSave 执行失败:", error);
        const notification = document.createElement("div");
        notification.className =
          "fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50";
        notification.textContent = `❌ 头像保存失败: ${error instanceof Error ? error.message : "未知错误"}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
      }
    },
    [loadProfile, profile],
  );

  // 保存隐私设置的函数
  const savePrivacySettings = useCallback(async (privacyData: any) => {
    try {
      logger.info("🔄 Saving privacy settings:", privacyData);

      // 转换字段名以匹配后端期望的格式
      const backendData = {
        hide_nickname: privacyData.hideNickname,
        hide_alliance: privacyData.hideAlliance,
        hide_alliance_flag: privacyData.hideAllianceFlag
      };

      logger.info("🔄 Converted to backend format:", backendData);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/privacy/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('funnypixels_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backendData)
      });

      if (response.ok) {
        const result = await response.json();
        logger.info("✅ Privacy settings saved successfully:", result);

        // 显示成功提示
        const notification = document.createElement("div");
        notification.className =
          "fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300";
        notification.textContent = "✅ 隐私设置已保存！";
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } else {
        const errorData = await response.json();
        logger.error("❌ Failed to save privacy settings:", errorData);

        // 显示错误提示
        const notification = document.createElement("div");
        notification.className =
          "fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50";
        notification.textContent = `❌ 保存失败: ${errorData.message || '未知错误'}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
      }
    } catch (error) {
      logger.error("❌ Error saving privacy settings:", error);

      // 显示错误提示
      const notification = document.createElement("div");
      notification.className =
        "fixed top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50";
      notification.textContent = "❌ 保存失败，请重试";
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  }, []);

  const handleInputChange = useCallback((field: string, value: any) => {
    logger.info("🔄 handleInputChange called:", { field, value });

    if (field.startsWith("privacy.")) {
      const privacyField = field.split(".")[1];
      logger.info("🔄 Updating privacy field:", privacyField, "to:", value);
      setFormData((prev) => {
        const newFormData = {
          ...prev,
          privacy: {
            ...prev.privacy,
            [privacyField]: value,
          },
        };
        logger.info("🔄 New formData privacy:", newFormData.privacy);
        return newFormData;
      });

      // 立即保存隐私设置
      savePrivacySettings({
        ...formData.privacy,
        [privacyField]: value,
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  }, [formData.privacy, savePrivacySettings]);

      
  // 渲染装饰品
  const renderCosmetic = (cosmetic: any) => {
    switch (cosmetic.type) {
      case "avatar_frame":
        return (
          <div className="flex items-center space-x-1 bg-yellow-100 px-2 py-1 rounded-full text-xs">
            <Crown className="w-3 h-3 text-yellow-600" />
            <span className="text-yellow-800 font-medium">金色头像框</span>
          </div>
        );
      case "chat_bubble":
        return (
          <div className="flex items-center space-x-1 bg-blue-100 px-2 py-1 rounded-full text-xs">
            <MessageCircle className="w-3 h-3 text-blue-600" />
            <span className="text-blue-800 font-medium">彩虹聊天气泡</span>
          </div>
        );
      case "badge":
        return (
          <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-full text-xs">
            <Award className="w-3 h-3 text-green-600" />
            <span className="text-green-800 font-medium">像素大师徽章</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm font-medium">加载个人资料...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-3">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">无法加载个人资料</p>
          <p className="text-gray-400 text-sm">请重试或联系客服</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* 顶部导航 */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            gap: '12px',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          {[
            { id: 'profile', label: '个人资料' },
            { id: 'travel-history', label: '探索记录' },
            { id: 'drawing-history', label: '绘制历史' },
            { id: 'customer-service', label: '官方客服' },
            { id: 'settings', label: '设置' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleProfileTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: activeTab === tab.id ? '#4f46e5' : 'white',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(79,70,229,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                border: activeTab === tab.id ? 'none' : '1px solid #d1d5db'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
                  (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
                  (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 个人信息 */}
        {activeTab === "profile" && (
          <div style={{
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb'
          }}>
            {/* 头部：头像、用户名、编辑按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
              {/* 左侧：头像区域 */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => handleShowModal(setShowAvatarEditor)}
                  style={{
                    width: '96px',
                    height: '96px',
                    background: 'linear-gradient(to bottom right, #3b82f6, #a855f7)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '30px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    border: 'none',
                    padding: 0
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(59,130,246,0.4)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  {avatarUrl ? (
                    <>
                      {logger.info("🔄 显示CDN头像:", avatarUrl)}
                      <img
                        src={avatarUrl}
                        alt="头像"
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          logger.error('❌ CDN头像加载失败:', avatarUrl);
                          // 加载失败时回退到默认头像
                          setAvatarUrl(null);
                        }}
                        onLoad={() => {
                          logger.info('✅ CDN头像加载成功:', avatarUrl);
                        }}
                      />
                    </>
                  ) : profile.avatar ? (
                    <>
                      {logger.info("🔄 显示本地转换头像:", profile.avatar)}
                      {logger.info("🔄 头像数据类型:", typeof profile.avatar)}
                      {logger.info("🔄 头像数据长度:", profile.avatar?.length)}
                      {logger.info(
                        "🔄 头像数据前50字符:",
                        profile.avatar?.substring?.(0, 50),
                      )}
                      <img
                        src={convertPixelDataToImage(profile.avatar)}
                        alt="头像"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </>
                  ) : (
                    <>
                      {logger.info(
                        "🔄 显示默认头像，用户名首字母:",
                        profile.username.charAt(0).toUpperCase(),
                      )}
                      {logger.info("🔄 profile.avatar 值:", profile.avatar)}
                      {logger.info("🔄 profile 对象:", profile)}
                      {profile.username.charAt(0).toUpperCase()}
                    </>
                  )}
                </button>
              </div>

              {/* 右侧：用户信息和编辑模式切换 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    {/* 昵称 - 可编辑 */}
                    <div style={{ marginBottom: '12px' }}>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          style={{
                            fontSize: '28px',
                            fontWeight: 'bold',
                            color: '#111827',
                            border: '2px solid #4f46e5',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            width: '100%',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box'
                          }}
                          placeholder="请输入昵称"
                        />
                      ) : (
                        <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                          {profile.username}
                        </h2>
                      )}
                    </div>

                    {/* 联盟信息 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      {profile.alliance ? (
                        <>
                          <AllianceFlag
                            flagPatternId={
                              profile.alliance.pattern_id ||
                              profile.alliance.flag ||
                              ""
                            }
                            size="md"
                            className="flex-shrink-0"
                          />
                          <span className="text-lg font-semibold text-blue-600">
                            {profile.alliance.name}
                          </span>
                          {/* 显示装备的装饰品 */}
                          {isAuthenticated &&
                            equippedCosmetics.map((cosmetic, index) => (
                              <div key={index}>{renderCosmetic(cosmetic)}</div>
                            ))}
                        </>
                      ) : (
                        <>
                          <span className="text-lg">🏴</span>
                          <span className="text-lg font-semibold text-gray-500">
                            未加入联盟
                          </span>
                          {/* 显示装备的装饰品 */}
                          {isAuthenticated &&
                            equippedCosmetics.map((cosmetic, index) => (
                              <div key={index}>{renderCosmetic(cosmetic)}</div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>

                  {isAuthenticated && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
                      {editing ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '10px 20px',
                              borderRadius: '12px',
                              backgroundColor: '#16a34a',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '14px',
                              border: 'none',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                              transition: 'all 0.2s ease',
                              opacity: saving ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!saving) {
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(22,163,74,0.4)';
                                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(22,163,74,0.3)';
                              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                            }}
                          >
                            <CheckCircle size={18} style={{ flexShrink: 0 }} />
                            {saving ? '保存中...' : '保存'}
                          </button>
                          <button
                            onClick={() => handleToggleEdit(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '10px 20px',
                              borderRadius: '12px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '14px',
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(107,114,128,0.3)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(107,114,128,0.4)';
                              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(107,114,128,0.3)';
                              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                            }}
                          >
                            <X size={18} style={{ flexShrink: 0 }} />
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleToggleEdit(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            borderRadius: '12px',
                            backgroundColor: '#4f46e5',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '14px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(79,70,229,0.4)';
                            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(79,70,229,0.3)';
                            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                          }}
                        >
                          <Edit3 size={18} style={{ flexShrink: 0 }} />
                          编辑
                        </button>
                      )}
                    </div>
                  )}
                  {!isAuthenticated && (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
                        游客模式下无法编辑个人资料
                      </p>
                      <button
                        onClick={() => (window.location.href = "/login")}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '12px',
                          background: 'linear-gradient(to right, #16a34a, #2563eb)',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '14px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(22,163,74,0.4)';
                          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(22,163,74,0.3)';
                          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                        }}
                      >
                        登录以编辑资料
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 格言区域 - 可编辑 */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>格言：</h3>
                {isAuthenticated && !editing && (
                  <button
                    onClick={() => handleToggleEdit(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(79,70,229,0.4)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(79,70,229,0.3)';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    }}
                  >
                    <Edit3 size={18} style={{ flexShrink: 0 }} />
                    编辑
                  </button>
                )}
              </div>
              {editing && isAuthenticated ? (
                <>
                  <textarea
                    value={formData.motto}
                    onChange={(e) => handleInputChange('motto', e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      color: '#374151',
                      fontSize: '16px',
                      lineHeight: '1.6',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '2px solid #4f46e5',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      marginBottom: '12px'
                    }}
                    placeholder="写一段话描述自己..."
                  />
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '12px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '14px',
                        border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                        transition: 'all 0.2s ease',
                        opacity: saving ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(22,163,74,0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(22,163,74,0.3)';
                      }}
                    >
                      <CheckCircle size={18} style={{ flexShrink: 0 }} />
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => handleToggleEdit(false)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(107,114,128,0.3)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(107,114,128,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(107,114,128,0.3)';
                      }}
                    >
                      <X size={18} style={{ flexShrink: 0 }} />
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <p style={{
                  color: '#374151',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e5e7eb',
                  margin: 0
                }}>
                  {profile.motto || "这个人很懒，什么都没留下..."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 探索记录 */}
        {activeTab === "travel-history" && (
          <TravelHistory isAuthenticated={isAuthenticated} />
        )}

        {/* 绘制历史 - 绘制会话（使用DrawingHistory组件，包含足迹图功能） */}
        {activeTab === "drawing-history" && (
          <DrawingHistory isAuthenticated={isAuthenticated} />
        )}

        {/* 官方客服 */}
        {activeTab === "customer-service" && (
          <CustomerService />
        )}

        {/* 设置页面 */}
        {activeTab === "settings" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 隐私设置 */}
            <div style={{
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              padding: '24px',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Shield size={20} style={{ color: '#6b7280' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>隐私设置</h3>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                {
                  key: "hideNickname",
                  label: "绘制像素时不显示昵称",
                  icon: User,
                },
                {
                  key: "hideAlliance",
                  label: "绘制像素时不显示联盟",
                  icon: Users,
                },
                {
                  key: "hideAllianceFlag",
                  label: "绘制像素时不显示联盟旗帜",
                  icon: Crown,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f9fafb';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <item.icon size={20} style={{ color: '#6b7280' }} />
                    <span style={{ color: '#374151', fontWeight: 500 }}>
                      {item.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = formData.privacy[item.key as keyof typeof formData.privacy];
                      handleInputChange(`privacy.${item.key}`, !currentValue);
                    }}
                    className="flex items-center justify-center transition-colors duration-200 border-none bg-transparent"
                    style={{
                      width: '4rem',
                      height: '2.5rem',
                      border: 'none',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {formData.privacy[item.key as keyof typeof formData.privacy] ? (
                      <BiSolidToggleRight
                        className="w-full h-full"
                        style={{ color: '#10b981' }}
                      />
                    ) : (
                      <BiSolidToggleLeft
                        className="w-full h-full"
                        style={{ color: '#9ca3af' }}
                      />
                    )}
                  </button>
                </div>
              ))}
            </div>
            </div>

        {/* 账户安全 - 仅认证用户可见 */}
        {isAuthenticated && (
          <div style={{
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Settings size={20} style={{ color: '#6b7280' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>账户安全</h3>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => handleShowModal(setShowChangePassword)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(59,130,246,0.3)';
                }}
              >
                <Lock size={18} />
                修改密码
              </button>
            </div>
          </div>
        )}

        {/* 危险操作 - 仅认证用户可见 */}
        {isAuthenticated && (
          <div style={{
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '24px',
            backgroundColor: 'white',
            border: '2px solid #fecaca'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Trash2 size={20} style={{ color: '#dc2626' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>危险操作</h3>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => handleShowModal(setShowDeleteConfirm)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#dc2626';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(239,68,68,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ef4444';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(239,68,68,0.3)';
                }}
              >
                <Trash2 size={18} />
                删除账号
              </button>
              <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                删除后无法恢复，请谨慎操作
              </p>
            </div>
          </div>
        )}

        {/* 退出登录 - 仅认证用户可见 */}
        {isAuthenticated && (
          <div style={{
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb'
          }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#6b7280',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(107,114,128,0.3)'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4b5563';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(107,114,128,0.4)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6b7280';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(107,114,128,0.3)';
              }}
            >
              <LogOut size={18} />
              退出登录
            </button>
          </div>
        )}
          </div>
        )}


        {/* 删除确认弹窗 */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    确认删除账号
                  </h3>
                  <p className="text-gray-600 text-sm">此操作无法撤销</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>累计像素:</span>
                      <span className="font-medium">
                        {formattedStats?.totalPixels}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>当前像素:</span>
                      <span className="font-medium">
                        {formattedStats?.currentPixels}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>绘制时长:</span>
                      <span className="font-medium">
                        {formattedStats?.drawTimeHours}小时
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleDeleteAccount}
                    className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    确认删除
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 头像编辑器 - 移到最外层确保弹窗覆盖整个视口 */}
      <AvatarEditor
        currentAvatar={profile?.avatar}
        onSave={handleAvatarSave}
        onCancel={() => setShowAvatarEditor(false)}
        isOpen={showAvatarEditor}
      />

      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSuccess={() => {
          logger.info("密码修改成功");
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}
