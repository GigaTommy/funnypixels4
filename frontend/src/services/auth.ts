import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const API_BASE_URL = config.API_BASE_URL;

// 用户认证接口
export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  avatar?: string; // 添加avatar字段，用于存储像素头像数据
  display_name?: string;
  motto?: string;
  privacy_mode?: boolean;
  points?: number;
  total_pixels?: number;
  current_pixels?: number;
  is_admin?: boolean; // 添加管理员权限字段
  role?: string; // 添加角色字段
  created_at: string;
  updated_at: string;
}

// 登录请求接口
export interface LoginRequest {
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  verificationCode?: string;
}

// 发送验证码请求接口
export interface SendCodeRequest {
  phone: string;
  type: 'login' | 'register';
}

// 注册请求接口
export interface RegisterRequest {
  email: string;
  password: string;
  verificationCode: string;
}

// 修改密码请求接口
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// 微信登录请求接口
export interface WeChatLoginRequest {
  code: string;
  state: string;
}

// 微信用户信息接口
export interface WeChatUserInfo {
  openid: string;
  unionid?: string;
  nickname: string;
  headimgurl: string;
  sex: number;
  province: string;
  city: string;
  country: string;
}

// 认证响应接口
export interface AuthResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

// JWT Token管理
class TokenManager {
  private static readonly TOKEN_KEY = 'funnypixels_token';
  private static readonly REFRESH_TOKEN_KEY = 'funnypixels_refresh_token';
  private static readonly USER_KEY = 'funnypixels_user';
  private static readonly AUTH_VERSION_KEY = 'funnypixels_auth_version';
  private static readonly GUEST_ID_KEY = 'funnypixels_guest_id';

  static setTokens(token: string, refreshToken?: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
    // 设置认证版本（包含时间戳，用于检测部署变化）
    const authVersion = `v1_${Date.now()}`;
    localStorage.setItem(this.AUTH_VERSION_KEY, authVersion);
    
    logger.debug('🔐 Token已保存:', {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      version: authVersion
    });
  }

  static getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);

    // 🎯 关键修复：只做基本格式检查，不检查过期
    // 让上层调用者（AuthService.isAuthenticated）处理过期逻辑
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          logger.warn('⚠️ Token格式无效，清除缓存');
          this.clearTokens();
          return null;
        }

        // 不再在这里检查过期，只检查格式
        // 过期检查移到 AuthService.isAuthenticated() 中
        return token;
      } catch (error) {
        logger.debug('⚠️ Token解析失败，清除缓存:', error);
        this.clearTokens();
        return null;
      }
    }

    return token; // 返回null如果没有token
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static clearTokens() {
    // 清除所有认证相关的localStorage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.AUTH_VERSION_KEY);
    localStorage.removeItem(this.GUEST_ID_KEY);
    localStorage.removeItem('funnypixels_user_cache_time'); // 清除缓存时间戳

    // 清除可能遗留的旧版本缓存
    localStorage.removeItem('funnypixels_user_id');
    localStorage.removeItem('funnypixels_user_version');
    localStorage.removeItem('csrf_token');

    // 清除sessionStorage中的认证信息
    sessionStorage.removeItem('funnypixels_token');
    sessionStorage.removeItem('funnypixels_refresh_token');
    sessionStorage.removeItem('funnypixels_user');

    logger.debug('🧹 已清除所有认证缓存');
  }

  static setUser(user: AuthUser) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    // 自动设置缓存时间戳
    localStorage.setItem('funnypixels_user_cache_time', Date.now().toString());
  }

  static getUser(): AuthUser | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // 检查认证版本
  static isAuthVersionValid(): boolean {
    const version = localStorage.getItem(this.AUTH_VERSION_KEY);
    // 检查版本格式是否为 v1_时间戳 格式
    return version ? version.startsWith('v1_') : false;
  }

  // 游客ID管理
  static getGuestId(): string | null {
    return localStorage.getItem(this.GUEST_ID_KEY);
  }

  static setGuestId(guestId: string) {
    localStorage.setItem(this.GUEST_ID_KEY, guestId);
  }

  static clearGuestId() {
    localStorage.removeItem(this.GUEST_ID_KEY);
  }

  // 生成游客ID
  static generateGuestId(): string {
    // 使用UUID v4格式生成游客ID
    return 'guest_' + this.generateUUID();
  }

  // 生成UUID v4
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 确保游客ID存在
  static ensureGuestId(): string {
    let guestId = this.getGuestId();
    if (!guestId) {
      guestId = this.generateGuestId();
      this.setGuestId(guestId);
      logger.debug('🆕 生成新的游客ID:', guestId);
    }
    return guestId;
  }
}

// 创建axios实例
const authApi = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加token
authApi.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理token过期
authApi.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token过期，尝试刷新
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          const response = await authApi.post('/refresh', { refreshToken });
          const { tokens } = response.data;
          TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
          
          // 重试原请求
          const originalRequest = error.config;
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return authApi(originalRequest);
        } catch (refreshError) {
          // 刷新失败，清除token并跳转到登录页
          logger.debug('Token刷新失败，用户需要重新登录');
          TokenManager.clearTokens();
          // 使用更安全的方式跳转，避免无限循环
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        logger.debug('无刷新token，用户需要重新登录');
        TokenManager.clearTokens();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// 用户认证服务
export class AuthService {
  // 用户注册
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await authApi.post('/register', data);
      const { user, tokens } = response.data;
      
      // 保存token和用户信息
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
      TokenManager.setUser(user);
      
      // 清除游客ID
      TokenManager.clearGuestId();
      
      // 初始化用户像素状态（如果不存在）- 非阻塞执行
      this.initializeUserPixelState(user.id).catch(error => {
        logger.warn('用户像素状态初始化失败，但不影响注册:', error);
      });
      
      return response.data;
    } catch (error) {
      logger.error('注册失败:', error);
      throw error;
    }
  }

  // 用户登录
  static async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await authApi.post('/login', data);
      const { user, tokens } = response.data;
      
      // 保存token和用户信息
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
      TokenManager.setUser(user);
      
      // 清除游客ID
      TokenManager.clearGuestId();
      
      // 初始化用户像素状态（如果不存在）- 非阻塞执行
      this.initializeUserPixelState(user.id).catch(error => {
        logger.warn('用户像素状态初始化失败，但不影响登录:', error);
      });
      
      return response.data;
    } catch (error) {
      logger.error('登录失败:', error);
      throw error;
    }
  }

  // 初始化用户像素状态
  private static async initializeUserPixelState(userId: string): Promise<void> {
    try {
      // 如果是游客用户，跳过初始化
      if (userId.startsWith('guest_')) {
        logger.debug('游客用户，跳过像素状态初始化');
        return;
      }
      
      const api = axios.create({
        baseURL: API_BASE_URL,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenManager.getToken()}`
        }
      });
      
      await api.post('/api/pixel/init', { userId });
      logger.debug('用户像素状态初始化成功');
    } catch (error) {
      logger.error('用户像素状态初始化失败:', error);
    }
  }

  // 获取当前用户
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      // 防抖检查：避免短时间内重复调用
      const now = Date.now();
      if (now - this.lastGetCurrentUserCall < this.GET_CURRENT_USER_COOLDOWN) {
        logger.debug('🔄 getCurrentUser调用过于频繁，使用缓存');
        // 返回缓存用户，即使过期也返回以减少服务器压力
        const cachedUser = TokenManager.getUser();
        return cachedUser;
      }
      this.lastGetCurrentUserCall = now;

      // 首先尝试从本地存储获取
      const cachedUser = TokenManager.getUser();
      if (cachedUser) {
        // 检查缓存时间，如果缓存较新（1分钟内），直接返回
        const lastUpdate = localStorage.getItem('funnypixels_user_cache_time');
        if (lastUpdate && (now - parseInt(lastUpdate)) < 60000) {
          return cachedUser;
        }
      }

      // 如果本地没有缓存或缓存过期，从服务器获取
      const response = await authApi.get('/me');
      const user = response.data.user;
      TokenManager.setUser(user);
      // 更新缓存时间戳
      localStorage.setItem('funnypixels_user_cache_time', Date.now().toString());
      return user;
    } catch (error) {
      logger.error('获取当前用户失败:', error);
      return null;
    }
  }

  // 强制从服务器刷新当前用户信息（不使用缓存）
  static async refreshCurrentUser(): Promise<AuthUser | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      // 防抖检查：避免短时间内重复调用
      const now = Date.now();
      if (now - this.lastRefreshCurrentUserCall < this.REFRESH_CURRENT_USER_COOLDOWN) {
        logger.debug('🔄 refreshCurrentUser调用过于频繁，使用现有缓存');
        // 返回缓存用户
        const cachedUser = TokenManager.getUser();
        return cachedUser;
      }
      this.lastRefreshCurrentUserCall = now;

      logger.debug('🔄 强制刷新用户信息...');

      // 直接从服务器获取最新数据
      const response = await authApi.get('/me');
      const user = response.data.user;

      // 更新本地缓存
      TokenManager.setUser(user);

      logger.debug('✅ 用户信息已刷新:', {
        userId: user.id,
        total_pixels: user.total_pixels,
        current_pixels: user.current_pixels
      });

      return user;
    } catch (error) {
      logger.error('❌ 刷新用户信息失败:', error);
      return null;
    }
  }

  // 真正强制刷新，绕过所有防抖和缓存机制
  static async forceRefreshCurrentUser(): Promise<AuthUser | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      logger.debug('🔄 真正强制刷新用户信息，绕过所有缓存...');

      // 清除前端缓存时间戳
      localStorage.removeItem('funnypixels_user_cache_time');

      // 🔧 修复：直接从服务器获取最新数据，传递强制刷新参数
      const response = await authApi.get('/me', {
        params: { force_refresh: 'true' },
        headers: { 'X-Force-Refresh': 'true' }
      });
      const user = response.data.user;

      // 强制更新本地缓存
      TokenManager.setUser(user);

      logger.debug('✅ 用户信息已强制刷新 (带force_refresh参数):', {
        userId: user.id,
        total_pixels: user.total_pixels,
        current_pixels: user.current_pixels
      });

      return user;
    } catch (error) {
      logger.error('❌ 强制刷新用户信息失败:', error);
      return null;
    }
  }

  // 获取用户ID
  static getUserId(): string | null {
    if (this.isAuthenticated()) {
      const user = TokenManager.getUser();
      return user?.id || null;
    }
    return null;
  }

  // 获取当前token
  static getToken(): string | null {
    return TokenManager.getToken();
  }

  // 清除所有认证缓存
  static clearTokens(): void {
    TokenManager.clearTokens();
  }

  // 检查是否已认证
  static isAuthenticated(): boolean {
    // 🎯 关键修复：直接检查localStorage，避免过早清除过期token
    const token = localStorage.getItem('funnypixels_token');
    if (!token) {
      return false;
    }

    // 基本格式检查
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.warn('⚠️ Token格式无效，清除缓存');
        this.clearTokens();
        return false;
      }

      // 检查token是否真正过期（而不是即将过期）
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000; // 转换为毫秒
      const now = Date.now();

      if (exp < now) {
        logger.debug('⚠️ Token已过期，清除缓存');
        this.clearTokens();
        return false;
      }

      // 检查令牌是否即将过期（提前5分钟续期），但不因此返回false
      const fiveMinutes = 5 * 60 * 1000;
      if (exp - now < fiveMinutes) {
        logger.debug('🔄 令牌即将过期，尝试自动续期');
        this.refreshTokenIfNeeded();
      }

      return true;
    } catch (error) {
      logger.warn('令牌解析失败:', error);
      // 解析失败时清除无效token
      this.clearTokens();
      return false;
    }
  }

  // 检查是否为游客
  static isGuest(): boolean {
    // 如果未认证，检查是否有游客ID
    if (!this.isAuthenticated()) {
      const guestId = TokenManager.getGuestId();
      // 只有在游客ID存在时才返回true
      return !!guestId;
    }
    return false;
  }

  // 获取游客ID
  static getGuestId(): string {
    // 如果未认证，返回游客ID（如果存在）
    if (!this.isAuthenticated()) {
      return TokenManager.getGuestId() || '';
    }
    // 如果已认证，返回空字符串
    return '';
  }

  // 确保游客ID存在（用于初始化）
  static ensureGuestId(): string {
    if (!this.isAuthenticated()) {
      return TokenManager.ensureGuestId();
    }
    return '';
  }

  // 确保用户身份（登录用户或游客）
  static ensureUserIdentity(): { userId: string; isGuest: boolean } {
    if (this.isAuthenticated()) {
      const userId = this.getUserId();
      logger.debug('🔍 AuthService.ensureUserIdentity - 认证用户:', { userId, isAuthenticated: true });
      
      if (userId) {
        // 验证UUID格式
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(userId)) {
          logger.debug('✅ 用户ID格式正确:', userId);
          return { userId, isGuest: false };
        } else {
          logger.warn('⚠️ 用户ID格式不正确，可能是游客ID:', userId);
        }
      } else {
        logger.warn('⚠️ 用户已认证但无法获取用户ID');
      }
    }
    
    // 返回游客ID
    const guestId = this.getGuestId();
    logger.debug('🔍 AuthService.ensureUserIdentity - 游客模式:', { guestId, isAuthenticated: false });
    return { userId: guestId, isGuest: true };
  }

  // 登出
  static async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await authApi.post('/logout');
      }
    } catch (error) {
      logger.error('登出请求失败:', error);
    } finally {
      // 清除所有认证信息
      TokenManager.clearTokens();
      TokenManager.clearGuestId();
    }
  }

  // 刷新token
  static async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      if (!refreshToken) {
        logger.debug('❌ 无刷新令牌');
        return false;
      }

      const response = await authApi.post('/refresh', { refreshToken });
      const { tokens } = response.data;
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
      logger.debug('✅ 令牌刷新成功');
      return true;
    } catch (error: any) {
      logger.error('刷新token失败:', error);
      
      // 如果是签名验证失败，清除所有令牌
      if (error.response?.status === 403) {
        logger.debug('🔑 JWT签名验证失败，清除所有令牌');
        this.logout();
      }
      
      return false;
    }
  }

  // 防抖标志，避免频繁续期
  private static refreshInProgress = false;
  private static lastRefreshTime = 0;
  private static readonly REFRESH_COOLDOWN = 30000; // 30秒冷却时间

  // 防止频繁调用getCurrentUser的机制
  private static lastGetCurrentUserCall = 0;
  private static readonly GET_CURRENT_USER_COOLDOWN = 1000; // 1秒冷却时间

  // 防止频繁调用refreshCurrentUser的机制
  private static lastRefreshCurrentUserCall = 0;
  private static readonly REFRESH_CURRENT_USER_COOLDOWN = 2000; // 2秒冷却时间

  // 检查并自动续期令牌（如果需要）
  static async refreshTokenIfNeeded(): Promise<void> {
    try {
      const token = TokenManager.getToken();
      if (!token) {
        return;
      }

      // 防抖检查
      const now = Date.now();
      if (this.refreshInProgress || (now - this.lastRefreshTime) < this.REFRESH_COOLDOWN) {
        logger.debug('🔄 令牌续期正在处理中或冷却期内，跳过');
        return;
      }

      // 解析令牌
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const fiveMinutes = 5 * 60 * 1000;

      // 如果令牌在5分钟内过期，自动续期
      if (exp - now < fiveMinutes) {
        logger.debug('🔄 令牌即将过期，自动续期...');
        this.refreshInProgress = true;
        this.lastRefreshTime = now;
        
        const success = await this.refreshToken();
        if (success) {
          logger.debug('✅ 令牌自动续期成功');
        } else {
          logger.debug('❌ 令牌自动续期失败');
        }
        
        this.refreshInProgress = false;
      }
    } catch (error) {
      logger.warn('令牌自动续期检查失败:', error);
      this.refreshInProgress = false;
    }
  }

  // 检查认证版本
  static isAuthVersionValid(): boolean {
    return TokenManager.isAuthVersionValid();
  }

  // 清除认证版本（用于强制重新认证）
  static clearAuthVersion(): void {
    localStorage.removeItem(TokenManager['AUTH_VERSION_KEY']);
  }

  // 检查昵称修改限制
  static async checkNicknameChangeLimit(): Promise<any> {
    try {
      // 使用正确的API端点路径
      const response = await axios.get(`${API_BASE_URL}/api/profile/nickname/limit`, {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error('检查昵称修改限制失败:', error);
      throw error;
    }
  }

  // 更新用户资料
  static async updateProfile(data: { username?: string; display_name?: string; motto?: string; avatar?: string; privacy?: any }): Promise<any> {
    try {
      logger.debug('🔄 AuthService.updateProfile 开始执行，数据:', data);
      
      // 使用profile API端点更新用户资料
      const response = await axios.put(`${API_BASE_URL}/api/profile/update`, data, {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      logger.debug('✅ AuthService.updateProfile 执行成功');
      
      // 如果更新成功，更新本地存储的用户信息
      if (response.data.success) {
        const currentUser = TokenManager.getUser();
        if (currentUser) {
          const updatedUser = { ...currentUser, ...data };
          TokenManager.setUser(updatedUser);
          logger.debug('🔄 本地用户信息已更新');
        }
      }
      
      return response.data;
    } catch (error) {
      logger.error('❌ AuthService.updateProfile 执行失败:', error);
      throw error;
    }
  }

  // 修改密码
  static async changePassword(data: ChangePasswordRequest): Promise<any> {
    try {
      logger.debug('🔄 AuthService.changePassword 开始执行，数据:', data);
      
      const response = await axios.put(`${API_BASE_URL}/api/auth/change-password`, data, {
        headers: {
          'Authorization': `Bearer ${TokenManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      logger.debug('✅ AuthService.changePassword 执行成功');
      return response.data;
    } catch (error) {
      logger.error('❌ AuthService.changePassword 执行失败:', error);
      throw error;
    }
  }

  // 删除账户
  static async deleteAccount(): Promise<void> {
    try {
      logger.debug('🗑️ AuthService.deleteAccount 开始执行');

      const token = TokenManager.getToken();
      if (!token) {
        throw new Error('用户未登录');
      }

      const response = await authApi.delete('/account', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      logger.debug('✅ AuthService.deleteAccount 执行成功');

      // 删除账户后清除本地数据
      this.logout();

      return response.data;
    } catch (error) {
      logger.error('❌ AuthService.deleteAccount 执行失败:', error);
      throw error;
    }
  }

  // 发送短信验证码
  static async sendVerificationCode(data: SendCodeRequest): Promise<any> {
    try {
      logger.debug('📱 发送短信验证码:', data);

      const response = await authApi.post('/send-code', data);
      logger.debug('✅ 验证码发送成功:', response.data);

      return response.data;
    } catch (error) {
      logger.error('❌ 发送验证码失败:', error);
      throw error;
    }
  }

  // 手机号验证码登录
  static async loginWithPhoneCode(phone: string, verificationCode: string): Promise<AuthResponse> {
    try {
      logger.debug('📱 手机号验证码登录:', { phone });

      const response = await authApi.post('/login', {
        phone,
        verificationCode
      });

      const { user, tokens } = response.data;

      // 保存token和用户信息
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
      TokenManager.setUser(user);

      // 清除游客ID
      TokenManager.clearGuestId();

      // 初始化用户像素状态（如果不存在）- 非阻塞执行
      this.initializeUserPixelState(user.id).catch(error => {
        logger.warn('用户像素状态初始化失败，但不影响登录:', error);
      });

      return response.data;
    } catch (error) {
      logger.error('❌ 手机号验证码登录失败:', error);
      throw error;
    }
  }

  // 微信扫码登录
  static async loginWithWeChat(code: string, state: string): Promise<AuthResponse> {
    try {
      logger.debug('🔐 微信扫码登录:', { code, state });

      const response = await authApi.post('/wechat/login', {
        code,
        state
      });

      const { user, tokens } = response.data;

      // 保存token和用户信息
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
      TokenManager.setUser(user);

      // 清除游客ID
      TokenManager.clearGuestId();

      // 初始化用户像素状态（如果不存在）- 非阻塞执行
      this.initializeUserPixelState(user.id).catch(error => {
        logger.warn('用户像素状态初始化失败，但不影响微信登录:', error);
      });

      logger.debug('✅ 微信登录成功:', { userId: user.id, username: user.username });
      return response.data;

    } catch (error) {
      logger.error('❌ 微信登录失败:', error);

      // 处理常见的微信登录错误
      if (error instanceof Error && 'response' in error && (error as any).response?.data?.error) {
        const errorMessage = (error as any).response.data.error;

        // 特殊错误处理
        if (errorMessage.includes('code been used')) {
          throw new Error('授权码已使用，请重新扫码');
        } else if (errorMessage.includes('code invalid')) {
          throw new Error('授权码无效，请重新扫码');
        } else if (errorMessage.includes('state not match')) {
          throw new Error('状态验证失败，请重试');
        } else if (errorMessage.includes('user denied')) {
          throw new Error('用户拒绝授权登录');
        }
      }

      throw error;
    }
  }

  // 检查微信登录状态
  static async checkWeChatLoginStatus(state: string): Promise<any> {
    try {
      logger.debug('🔍 检查微信登录状态:', { state });

      const response = await authApi.get(`/wechat/status?state=${state}`);

      if (!response.data) {
        return { status: 'waiting', message: '等待扫码' };
      }

      return response.data;

    } catch (error) {
      logger.error('❌ 检查微信登录状态失败:', error);

      // 如果是网络错误，返回等待状态
      if (error instanceof Error && ((error as any).code === 'NETWORK_ERROR' || (error as any).code === 'ECONNABORTED')) {
        return { status: 'waiting', message: '网络连接异常，请重试' };
      }

      return { status: 'error', message: '检查登录状态失败' };
    }
  }

  // 处理微信授权回调（用于授权页面重定向）
  static async handleWeChatCallback(code: string, state: string): Promise<AuthResponse> {
    try {
      logger.debug('🔄 处理微信授权回调:', { code, state });

      // 直接使用微信登录方法
      return await this.loginWithWeChat(code, state);

    } catch (error) {
      logger.error('❌ 处理微信授权回调失败:', error);
      throw error;
    }
  }

  // 获取微信用户信息（已登录时使用）
  static async getWeChatUserInfo(): Promise<WeChatUserInfo | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      const response = await authApi.get('/wechat/userinfo');
      return response.data;

    } catch (error) {
      logger.error('❌ 获取微信用户信息失败:', error);
      return null;
    }
  }

  // 绑定微信账号到现有账号
  static async bindWeChatAccount(code: string, state: string): Promise<any> {
    try {
      logger.debug('🔗 绑定微信账号:', { code, state });

      const response = await authApi.post('/wechat/bind', {
        code,
        state
      });

      logger.debug('✅ 微信账号绑定成功');
      return response.data;

    } catch (error) {
      logger.error('❌ 绑定微信账号失败:', error);
      throw error;
    }
  }

  // 解绑微信账号
  static async unbindWeChatAccount(): Promise<any> {
    try {
      logger.debug('🔓 解绑微信账号');

      const response = await authApi.post('/wechat/unbind');

      logger.debug('✅ 微信账号解绑成功');
      return response.data;

    } catch (error) {
      logger.error('❌ 解绑微信账号失败:', error);
      throw error;
    }
  }
}

// 导出TokenManager类供其他服务使用
export { TokenManager };
