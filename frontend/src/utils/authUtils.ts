/**
 * 统一的认证工具
 * 解决不同服务使用不同token获取方式的问题
 */

import { logger } from './logger';

/**
 * 统一获取token的方法
 * 所有服务都应该使用这个方法获取token
 */
export function getAuthToken(): string | null {
  try {
    const token = localStorage.getItem('funnypixels_token');
    if (!token) {
      return null;
    }

    // 基本格式检查
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.debug('⚠️ Token格式无效');
      return null;
    }

    // 解析payload检查过期（但不立即清除）
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp * 1000; // 转换为毫秒
    const now = Date.now();

    if (exp < now) {
      logger.debug('⚠️ Token已过期');
      return null;
    }

    return token;
  } catch (error) {
    logger.debug('⚠️ Token解析失败:', error);
    return null;
  }
}

/**
 * 检查用户是否已认证
 * 使用统一的token检查逻辑
 */
export function isUserAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * 获取token剩余有效时间（毫秒）
 */
export function getTokenRemainingTime(): number {
  try {
    const token = getAuthToken();
    if (!token) {
      return 0;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const now = Date.now();

    return Math.max(0, exp - now);
  } catch (error) {
    return 0;
  }
}

/**
 * 检查token是否即将过期（5分钟内）
 */
export function isTokenExpiringSoon(): boolean {
  const remainingTime = getTokenRemainingTime();
  const fiveMinutes = 5 * 60 * 1000;
  return remainingTime > 0 && remainingTime < fiveMinutes;
}

/**
 * 认证状态信息
 */
export interface AuthStatus {
  isAuthenticated: boolean;
  hasToken: boolean;
  hasRefreshToken: boolean;
  hasUserInfo: boolean;
  tokenRemainingTime: number; // 毫秒
  isExpiringSoon: boolean;
}

/**
 * 获取详细的认证状态信息
 */
export function getAuthStatus(): AuthStatus {
  const hasToken = !!localStorage.getItem('funnypixels_token');
  const hasRefreshToken = !!localStorage.getItem('funnypixels_refresh_token');
  const hasUserInfo = !!localStorage.getItem('funnypixels_user');
  const tokenRemainingTime = getTokenRemainingTime();

  return {
    isAuthenticated: isUserAuthenticated(),
    hasToken,
    hasRefreshToken,
    hasUserInfo,
    tokenRemainingTime,
    isExpiringSoon: isTokenExpiringSoon()
  };
}