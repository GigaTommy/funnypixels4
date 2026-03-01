import { FlagItem } from '../types/alliance';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export const allianceService = {
  // 获取颜色旗帜
  async getColorFlags(): Promise<FlagItem[]> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/flags/colors`);
      if (!response.ok) {
        throw new Error('Failed to fetch color flags');
      }
      return await response.json();
    } catch (error) {
      logger.error('获取颜色旗帜失败:', error);
      throw error;
    }
  },

  // 获取图案旗帜
  async getPatternFlags(): Promise<FlagItem[]> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/flags/patterns`);
      if (!response.ok) {
        throw new Error('Failed to fetch pattern flags');
      }
      return await response.json();
    } catch (error) {
      logger.error('获取图案旗帜失败:', error);
      throw error;
    }
  },

  // 购买旗帜
  async purchaseFlag(flagId: string): Promise<boolean> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/flags/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flagId }),
      });
      return response.ok;
    } catch (error) {
      logger.error('购买旗帜失败:', error);
      return false;
    }
  }
};