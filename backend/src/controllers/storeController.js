const Store = require('../models/Store');
const Achievement = require('../models/Achievement');
const { authenticateToken } = require('../middleware/auth');
const UnifiedPaymentProvider = require('../payments/providers/unified-payment');
const { v4: uuidv4 } = require('uuid');

const paymentProvider = new UnifiedPaymentProvider();

class StoreController {
  // 获取所有商品
  static async getAllItems(req, res) {
    try {
      const { active = '1' } = req.query;
      const items = await Store.getAllItems(active === '1');

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('获取商品列表失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  // 根据类型获取商品
  static async getItemsByType(req, res) {
    try {
      const { type } = req.params;
      const items = await Store.getItemsByType(type);

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('获取商品失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  // 购买商品（集成统一支付）
  static async purchaseItem(req, res) {
    try {
      const { itemId, quantity = 1, paymentMethod = 'points', adTitle, adDescription, imageData, imageUrl } = req.body;
      const userId = req.user.id;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          error: '商品ID为必填项'
        });
      }

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          error: '购买数量必须大于0'
        });
      }

      // 获取商品信息
      const item = await Store.getItemById(itemId);
      if (!item || !item.active) {
        return res.status(400).json({
          success: false,
          error: '商品不存在或已下架'
        });
      }

      // 如果是广告商品，验证必需字段
      if (item.item_type === 'advertisement') {
        if (!adTitle || (!imageData && !imageUrl)) {
          return res.status(400).json({
            success: false,
            error: '广告商品需要提供标题和图片(或URL)'
          });
        }
      }

      // 计算总价
      const totalPrice = item.price_points * quantity;

      // 如果使用积分支付，直接处理
      if (paymentMethod === 'points') {
        const { targetLocation, scheduledTime } = req.body;
        const additionalData = {
          adTitle,
          adDescription,
          imageData,
          imageUrl,
          targetLocation,
          scheduledTime
        };

        const result = await Store.purchaseWithPoints(userId, itemId, quantity, additionalData);

        if (result.isAdOrder) {
          res.json({
            success: true,
            data: {
              message: '广告订单创建成功，等待管理员审核',
              item: result.item,
              quantity: result.quantity,
              totalPrice: result.totalPrice,
              remainingPoints: result.remainingPoints,
              order: result.order,
              isAdOrder: true
            }
          });
        } else {
          // 触发成就：购买商品
          await Achievement.updateUserStats(userId, {
            shop_purchases_count: quantity,
            total_spent_gold: totalPrice
          });

          res.json({
            success: true,
            data: {
              message: '购买成功',
              item: result.item,
              quantity: result.quantity,
              totalPrice: result.totalPrice,
              remainingPoints: result.remainingPoints,
              isAdOrder: false
            }
          });
        }
      } else {
        // 使用其他支付方式，创建支付订单
        const orderData = {
          method: paymentMethod,
          amount: totalPrice / 10, // 1积分 = 0.1元
          description: `购买 ${item.name} x${quantity}`,
          metadata: {
            userId,
            itemId,
            quantity,
            totalPrice
          }
        };

        const paymentOrder = await paymentProvider.createPayment(orderData);

        res.json({
          success: true,
          data: {
            orderId: paymentOrder.id,
            paymentUrl: paymentOrder.paymentUrl,
            qrCode: paymentOrder.qrCode,
            amount: orderData.amount,
            description: orderData.description
          }
        });
      }

    } catch (error) {
      console.error('购买商品失败:', error);

      // 过滤技术性错误信息，返回友好的提示
      let userFriendlyError = '购买失败，请稍后再试';
      if (error.message && !error.message.includes('select *') && !error.message.includes('invalid input')) {
        userFriendlyError = error.message;
      }

      res.status(400).json({
        success: false,
        error: userFriendlyError
      });
    }
  }

  // 处理支付回调，完成商品购买
  static async handlePaymentCallback(req, res) {
    try {
      const { orderId } = req.params;
      const { method } = req.body;

      // 验证支付结果
      const paymentResult = await paymentProvider.queryOrder(orderId, method);

      if (paymentResult.status === 'SUCCESS' || paymentResult.status === 'TRADE_SUCCESS') {
        // 支付成功，完成商品购买
        const metadata = paymentResult.metadata;
        const result = await Store.purchaseWithPoints(
          metadata.userId,
          metadata.itemId,
          metadata.quantity
        );

        // 触发成就：购买商品
        await Achievement.updateUserStats(metadata.userId, {
          shop_purchases_count: metadata.quantity,
          total_spent_gold: metadata.totalPrice || (result.item.price_points * metadata.quantity)
        });

        res.json({
          success: true,
          data: {
            message: '支付成功，商品已添加到库存',
            item: result.item,
            quantity: result.quantity
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: '支付失败'
        });
      }
    } catch (error) {
      console.error('处理支付回调失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '处理支付回调失败'
      });
    }
  }

  // 获取用户库存
  static async getUserInventory(req, res) {
    try {
      const userId = req.user.id;
      const inventory = await Store.getUserInventory(userId);

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      console.error('获取用户库存失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  // 使用道具
  static async useItem(req, res) {
    try {
      const { itemId, quantity = 1, targetId } = req.body;
      const userId = req.user.id;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          error: '道具ID为必填项'
        });
      }

      const result = await Store.useItem(userId, itemId, quantity, targetId);

      res.json({
        success: true,
        data: {
          message: '道具使用成功',
          effects: result.effects,
          remainingQuantity: result.remainingQuantity
        }
      });

    } catch (error) {
      console.error('使用道具失败:', error);
      res.status(400).json({
        success: false,
        error: error.message || '使用道具失败'
      });
    }
  }

  // 获取用户积分
  static async getUserPoints(req, res) {
    try {
      const userId = req.user.id;
      const points = await Store.getUserPoints(userId);

      res.json({
        success: true,
        data: { points }
      });
    } catch (error) {
      console.error('获取用户积分失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  // 获取可用的联盟旗帜图案（从库存中）
  static async getAvailableFlagPatterns(req, res) {
    try {
      const userId = req.user.id;
      const patterns = await Store.getUserFlagPatterns(userId);

      res.json({
        success: true,
        data: patterns
      });
    } catch (error) {
      console.error('获取可用旗帜图案失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }

  // 获取用户装饰品（头像框、聊天气泡等）
  static async getUserCosmetics(req, res) {
    try {
      const userId = req.user.id;
      const cosmetics = await Store.getUserCosmetics(userId);

      res.json({
        success: true,
        data: cosmetics
      });
    } catch (error) {
      console.error('获取用户装饰品失败:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }
}

module.exports = StoreController;
