import { api } from './api';

export interface Cosmetic {
  id: string;
  type: string;
  name: string;
  data: any;
  is_equipped: boolean;
  created_at: string;
}

export interface CosmeticPreview {
  name: string;
  description: string;
  preview_url?: string;
  style?: any;
}

export class CosmeticAPI {
  // 获取用户的所有装饰品
  static async getUserCosmetics(): Promise<{ success: boolean; cosmetics: Cosmetic[] }> {
    const response = await api.get('/cosmetics/user');
    return response.data;
  }

  // 获取用户装备的装饰品
  static async getEquippedCosmetics(): Promise<{ success: boolean; cosmetics: Cosmetic[] }> {
    const response = await api.get('/cosmetics/equipped');
    return response.data;
  }

  // 获取用户特定类型的装饰品
  static async getUserCosmeticsByType(cosmeticType: string): Promise<{ success: boolean; cosmetics: Cosmetic[] }> {
    const response = await api.get(`/cosmetics/type/${cosmeticType}`);
    return response.data;
  }

  // 装备装饰品
  static async equipCosmetic(cosmeticId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/cosmetics/equip/${cosmeticId}`);
    return response.data;
  }

  // 取消装备装饰品
  static async unequipCosmetic(cosmeticType: string): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/cosmetics/unequip/${cosmeticType}`);
    return response.data;
  }

  // 删除装饰品
  static async deleteCosmetic(cosmeticId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/cosmetics/${cosmeticId}`);
    return response.data;
  }

  // 获取装饰品预览
  static async getCosmeticPreview(cosmeticType: string, cosmeticName: string): Promise<{ success: boolean; preview: CosmeticPreview }> {
    const response = await api.get(`/cosmetics/preview/${cosmeticType}/${cosmeticName}`);
    return response.data;
  }

  // 获取所有装饰品类型
  static async getCosmeticTypes(): Promise<{ success: boolean; types: Array<{ type: string; name: string; description: string }> }> {
    const response = await api.get('/cosmetics/types');
    return response.data;
  }

  // 从商店购买装饰品
  static async purchaseCosmetic(itemId: string): Promise<{ success: boolean; message: string; cosmetic: Cosmetic }> {
    const response = await api.post('/cosmetics/purchase', { itemId });
    return response.data;
  }

  // 检查用户是否拥有特定装饰品
  static async checkHasCosmetic(cosmeticType: string, cosmeticName: string): Promise<{ success: boolean; hasCosmetic: boolean }> {
    const response = await api.get(`/cosmetics/check/${cosmeticType}/${cosmeticName}`);
    return response.data;
  }

  // 使用装饰品（从商店库存中使用）
  static async useCosmeticFromInventory(itemId: string): Promise<{ success: boolean; message: string; cosmetic: { type: string; name: string; display_name: string } }> {
    const response = await api.post('/cosmetics/use-from-inventory', { itemId });
    return response.data;
  }

  // 获取用户最新使用的装饰品
  static async getLatestUsedCosmetic(): Promise<{ success: boolean; cosmetic: Cosmetic | null }> {
    const response = await api.get('/cosmetics/latest');
    return response.data;
  }
}
