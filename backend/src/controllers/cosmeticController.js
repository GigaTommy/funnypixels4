const Cosmetic = require('../models/Cosmetic');
const Store = require('../models/Store');
const { db } = require('../config/database');

class CosmeticController {
  // 获取用户的所有装饰品
  static async getUserCosmetics(req, res) {
    try {
      const userId = req.user.id;
      const cosmetics = await Cosmetic.getUserCosmetics(userId);
      
      res.json({
        success: true,
        cosmetics: cosmetics
      });
    } catch (error) {
      console.error('获取用户装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户装饰品失败',
        error: error.message
      });
    }
  }

  // 获取用户装备的装饰品
  static async getEquippedCosmetics(req, res) {
    try {
      const userId = req.user.id;
      const cosmetics = await Cosmetic.getEquippedCosmetics(userId);
      
      res.json({
        success: true,
        cosmetics: cosmetics
      });
    } catch (error) {
      console.error('获取装备装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '获取装备装饰品失败',
        error: error.message
      });
    }
  }

  // 获取用户特定类型的装饰品
  static async getUserCosmeticsByType(req, res) {
    try {
      const userId = req.user.id;
      const { cosmeticType } = req.params;
      
      const cosmetics = await Cosmetic.getUserCosmeticsByType(userId, cosmeticType);
      
      res.json({
        success: true,
        cosmetics: cosmetics
      });
    } catch (error) {
      console.error('获取特定类型装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '获取特定类型装饰品失败',
        error: error.message
      });
    }
  }

  // 装备装饰品
  static async equipCosmetic(req, res) {
    try {
      const userId = req.user.id;
      const { cosmeticId } = req.params;
      
      await Cosmetic.equipCosmetic(userId, cosmeticId);
      
      res.json({
        success: true,
        message: '装饰品装备成功'
      });
    } catch (error) {
      console.error('装备装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '装备装饰品失败',
        error: error.message
      });
    }
  }

  // 取消装备装饰品
  static async unequipCosmetic(req, res) {
    try {
      const userId = req.user.id;
      const { cosmeticType } = req.params;
      
      await Cosmetic.unequipCosmetic(userId, cosmeticType);
      
      res.json({
        success: true,
        message: '装饰品取消装备成功'
      });
    } catch (error) {
      console.error('取消装备装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '取消装备装饰品失败',
        error: error.message
      });
    }
  }

  // 删除装饰品
  static async deleteCosmetic(req, res) {
    try {
      const userId = req.user.id;
      const { cosmeticId } = req.params;
      
      await Cosmetic.deleteCosmetic(userId, cosmeticId);
      
      res.json({
        success: true,
        message: '装饰品删除成功'
      });
    } catch (error) {
      console.error('删除装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '删除装饰品失败',
        error: error.message
      });
    }
  }

  // 获取装饰品预览
  static async getCosmeticPreview(req, res) {
    try {
      const { cosmeticType, cosmeticName } = req.params;
      
      const preview = await Cosmetic.getCosmeticPreview(cosmeticType, cosmeticName);
      
      if (!preview) {
        return res.status(404).json({
          success: false,
          message: '装饰品预览不存在'
        });
      }
      
      res.json({
        success: true,
        preview: preview
      });
    } catch (error) {
      console.error('获取装饰品预览失败:', error);
      res.status(500).json({
        success: false,
        message: '获取装饰品预览失败',
        error: error.message
      });
    }
  }

  // 获取所有装饰品类型
  static async getCosmeticTypes(req, res) {
    try {
      const types = await Cosmetic.getCosmeticTypes();
      
      res.json({
        success: true,
        types: types
      });
    } catch (error) {
      console.error('获取装饰品类型失败:', error);
      res.status(500).json({
        success: false,
        message: '获取装饰品类型失败',
        error: error.message
      });
    }
  }

  // 从商店购买装饰品
  static async purchaseCosmetic(req, res) {
    try {
      const userId = req.user.id;
      const { itemId } = req.body;
      
      // 获取商店商品信息
      const item = await Store.getItemById(itemId);
      if (!item || item.item_type !== 'cosmetic') {
        return res.status(400).json({
          success: false,
          message: '商品不存在或不是装饰品'
        });
      }
      
      const metadata = item.metadata || {};
      const cosmeticType = metadata.effect;
      // 根据装饰品类型获取对应的名称字段
      let cosmeticName;
      switch (cosmeticType) {
      case 'avatar_frame':
        cosmeticName = metadata.frame_type;
        break;
      case 'chat_bubble':
        cosmeticName = metadata.bubble_type;
        break;
      case 'badge':
        cosmeticName = metadata.badge_type;
        break;
      case 'background':
        cosmeticName = metadata.background_type;
        break;
      default:
        cosmeticName = metadata[`${cosmeticType}_type`];
      }
      
      if (!cosmeticType || !cosmeticName) {
        return res.status(400).json({
          success: false,
          message: '装饰品信息不完整'
        });
      }
      
      // 检查用户是否已拥有该装饰品
      const hasCosmetic = await Cosmetic.hasCosmetic(userId, cosmeticType, cosmeticName);
      if (hasCosmetic) {
        return res.status(400).json({
          success: false,
          message: '您已拥有该装饰品'
        });
      }
      
      // 开始事务
      const { db } = require('../config/database');
      await db.transaction(async (trx) => {
        // 购买商品
        await Store.purchaseItem(userId, itemId, 1, trx);
        
        // 创建装饰品
        const preview = await Cosmetic.getCosmeticPreview(cosmeticType, cosmeticName);
        if (preview) {
          await Cosmetic.create({
            user_id: userId,
            cosmetic_type: cosmeticType,
            cosmetic_name: cosmeticName,
            cosmetic_data: preview,
            is_equipped: false
          });
        }
      });
      
      res.json({
        success: true,
        message: '装饰品购买成功'
      });
    } catch (error) {
      console.error('购买装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '购买装饰品失败',
        error: error.message
      });
    }
  }

  // 检查用户是否拥有特定装饰品
  static async checkHasCosmetic(req, res) {
    try {
      const userId = req.user.id;
      const { cosmeticType, cosmeticName } = req.params;
      
      const hasCosmetic = await Cosmetic.hasCosmetic(userId, cosmeticType, cosmeticName);
      
      res.json({
        success: true,
        hasCosmetic: hasCosmetic
      });
    } catch (error) {
      console.error('检查装饰品拥有状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查装饰品拥有状态失败',
        error: error.message
      });
    }
  }

  // 使用装饰品（从商店库存中使用）
  static async useCosmeticFromInventory(req, res) {
    try {
      const userId = req.user.id;
      const { itemId } = req.body;
      
      console.log('🎨 使用装饰品API被调用:', { userId, itemId, itemIdType: typeof itemId });
      
      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: '道具ID为必填项'
        });
      }

      // 获取用户库存中的道具
      const { db } = require('../config/database');
      const inventoryItem = await db('user_inventory')
        .join('store_items', 'user_inventory.item_id', 'store_items.id')
        .where('user_inventory.user_id', userId)
        .where('user_inventory.item_id', parseInt(itemId)) // 确保itemId是整数
        .where('user_inventory.quantity', '>', 0)
        .select('store_items.*', 'user_inventory.quantity')
        .first();

      console.log('🎨 查询到的库存道具:', inventoryItem);
      
      if (!inventoryItem) {
        console.log('🎨 道具不存在或数量不足');
        return res.status(400).json({
          success: false,
          message: '道具不存在或数量不足'
        });
      }

      // 检查是否为装饰品
      if (inventoryItem.item_type !== 'cosmetic') {
        return res.status(400).json({
          success: false,
          message: '该道具不是装饰品'
        });
      }

      // 根据装饰品名称确定类型和名称
      let cosmeticType, cosmeticName;
      switch (inventoryItem.name) {
      case '金色头像框':
        cosmeticType = 'avatar_frame';
        cosmeticName = 'golden';
        break;
      case '彩虹聊天气泡':
        cosmeticType = 'chat_bubble';
        cosmeticName = 'rainbow';
        break;
      case '像素大师徽章':
        cosmeticType = 'badge';
        cosmeticName = 'pixel_master';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的装饰品类型'
        });
      }

      // 检查用户是否已拥有该装饰品
      const hasCosmetic = await Cosmetic.hasCosmetic(userId, cosmeticType, cosmeticName);
      if (hasCosmetic) {
        return res.status(400).json({
          success: false,
          message: '您已拥有该装饰品'
        });
      }

      // 开始事务
      await db.transaction(async (trx) => {
        console.log('🎨 开始事务处理');
        
        // 减少库存数量
        console.log('🎨 减少库存数量:', { userId, itemId: parseInt(itemId) });
        const inventoryResult = await trx('user_inventory')
          .where('user_id', userId)
          .where('item_id', parseInt(itemId)) // 确保itemId是整数
          .decrement('quantity', 1);
        console.log('🎨 库存减少结果:', inventoryResult);

        // 创建装饰品记录
        const cosmeticData = {
          user_id: userId,
          cosmetic_type: cosmeticType,
          cosmetic_name: cosmeticName,
          cosmetic_data: JSON.stringify({
            item_id: parseInt(itemId),
            original_name: inventoryItem.name,
            description: inventoryItem.description,
            equipped_at: new Date().toISOString()
          }),
          is_equipped: true, // 自动装备
          is_active: true
        };

        console.log('🎨 准备插入装饰品数据:', cosmeticData);
        const cosmeticResult = await trx('cosmetics').insert(cosmeticData);
        console.log('🎨 装饰品插入结果:', cosmeticResult);
      });

      res.json({
        success: true,
        message: '装饰品使用成功',
        cosmetic: {
          type: cosmeticType,
          name: cosmeticName,
          display_name: inventoryItem.name
        }
      });
    } catch (error) {
      console.error('使用装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '使用装饰品失败',
        error: error.message
      });
    }
  }

  // 获取用户最新使用的装饰品
  static async getLatestUsedCosmetic(req, res) {
    try {
      const userId = req.user.id;
      
      const latestCosmetic = await db('cosmetics')
        .where('user_id', userId)
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .first();

      if (!latestCosmetic) {
        return res.json({
          success: true,
          cosmetic: null
        });
      }

      res.json({
        success: true,
        cosmetic: {
          id: latestCosmetic.id,
          type: latestCosmetic.cosmetic_type,
          name: latestCosmetic.cosmetic_name,
          data: typeof latestCosmetic.cosmetic_data === 'string' 
            ? JSON.parse(latestCosmetic.cosmetic_data) 
            : latestCosmetic.cosmetic_data,
          is_equipped: latestCosmetic.is_equipped,
          created_at: latestCosmetic.created_at
        }
      });
    } catch (error) {
      console.error('获取最新装饰品失败:', error);
      res.status(500).json({
        success: false,
        message: '获取最新装饰品失败',
        error: error.message
      });
    }
  }
}

module.exports = CosmeticController;
