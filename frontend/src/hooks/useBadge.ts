import { useState, useEffect, useCallback, useRef } from 'react';
import { BadgeAPI, BadgeCounts } from '../services/badge';
import { logger } from '../utils/logger';

const POLL_INTERVAL = 60000; // 60 秒

export interface UseBadgeResult {
  badges: BadgeCounts | null;
  refresh: () => Promise<void>;
}

/**
 * Badge 轮询 Hook
 * 60 秒定时刷新 + 页面可见性变化时刷新
 */
export function useBadge(isAuthenticated: boolean): UseBadgeResult {
  const [badges, setBadges] = useState<BadgeCounts | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await BadgeAPI.getBadgeCounts();
      setBadges(data);
    } catch {
      // 失败时保留现有数据
      logger.warn('Badge refresh failed');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBadges(null);
      return;
    }

    // 立即刷新
    refresh();

    // 60 秒轮询
    timerRef.current = setInterval(refresh, POLL_INTERVAL);

    // 页面可见性变化时刷新
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, refresh]);

  return { badges, refresh };
}
