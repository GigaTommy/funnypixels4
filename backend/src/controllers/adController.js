const { db } = require('../config/database');
const AdProduct = require('../models/AdProduct');
const AdOrder = require('../models/AdOrder');
const UserAdInventory = require('../models/UserAdInventory');
const AdPlacement = require('../models/AdPlacement');
const UserPoints = require('../models/UserPoints');
const ImageProcessor = require('../services/imageProcessor');
const AdPixelRenderer = require('../services/AdPixelRenderer');

/**
 * 广告系统控制器
 */
class AdController {
  
  /**
   * 获取广告商品列表
   */
  static async getAdProducts(req, res) {
    try {
      const products = await AdProduct.getActiveProducts();
      
      res.json({
        success: true,
        products: products.map(product => ({
          id: product.id,
          name: product.name,
          sizeType: product.sizeType,
          width: product.width,
          height: product.height,
          price: product.price,
          description: product.description
        }))
      });
    } catch (error) {
      console.error('❌ 获取广告商品失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取广告商品失败' 
      });
    }
  }

  /**
   * 创建广告订单
   */
  static async createAdOrder(req, res) {
    try {
      const userId = req.user.id;
      const { adProductId, adTitle, adDescription, imageData } = req.body;
      
      console.log(`📢 用户 ${userId} 创建广告订单`);
      
      // 验证输入
      if (!adProductId || !adTitle || !imageData) {
        return res.status(400).json({
          success: false,
          message: '广告商品ID、标题和图像数据不能为空'
        });
      }
      
      // 验证广告标题长度
      if (adTitle.length > 50) {
        return res.status(400).json({
          success: false,
          message: '广告标题不能超过50个字符'
        });
      }
      
      // 获取广告商品信息
      const adProduct = await AdProduct.findById(adProductId);
      if (!adProduct || !adProduct.active) {
        return res.status(400).json({
          success: false,
          message: '广告商品不存在或已下架'
        });
      }
      
      // 验证图像格式和尺寸
      if (!ImageProcessor.validateImage(imageData)) {
        return res.status(400).json({
          success: false,
          message: '图像格式不支持或文件过大（支持jpg、png、gif、webp，最大5MB）'
        });
      }
      
      // 检查用户积分
      console.log(`🔍 检查用户 ${userId} 的积分状态...`);
      const userPoints = await db('user_points')
        .where('user_id', userId)
        .first();
      
      if (!userPoints) {
        console.log('❌ 用户积分记录不存在');
        return res.status(400).json({
          success: false,
          message: `积分不足，需要${adProduct.price}积分`
        });
      }
      
      console.log(`💰 用户当前积分: ${userPoints.total_points}, 需要积分: ${adProduct.price}`);
      
      if (userPoints.total_points < adProduct.price) {
        console.log('❌ 积分不足');
        return res.status(400).json({
          success: false,
          message: `积分不足，需要${adProduct.price}积分`
        });
      }
      
      console.log('✅ 积分检查通过');
      
      // 创建订单
      const order = await AdOrder.create({
        userId,
        adProductId,
        adTitle,
        adDescription,
        originalImageUrl: imageData,
        price: adProduct.price
      });
      
      // 扣减积分
      await UserPoints.deductPoints(userId, adProduct.price, `购买广告: ${adTitle}`, order.id);
      console.log(`💰 用户 ${userId} 积分已扣减${adProduct.price}点`);
      
      console.log(`✅ 广告订单创建成功: ${order.id}`);
      
      res.json({
        success: true,
        order: {
          id: order.id,
          adTitle: order.adTitle,
          adDescription: order.adDescription,
          status: order.status,
          price: order.price,
          productName: adProduct.name,
          sizeType: adProduct.sizeType,
          width: adProduct.width,
          height: adProduct.height,
          createdAt: order.createdAt
        },
        message: '订单创建成功，等待管理员审核'
      });
    } catch (error) {
      console.error('❌ 创建广告订单失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '创建订单失败' 
      });
    }
  }

  /**
   * 获取用户的广告订单
   */
  static async getUserAdOrders(req, res) {
    try {
      const userId = req.user.id;
      const { status } = req.query;
      
      const orders = await AdOrder.getUserOrders(userId, status);
      
      res.json({
        success: true,
        orders: orders.map(order => ({
          id: order.id,
          adTitle: order.adTitle,
          adDescription: order.adDescription,
          status: order.status,
          price: order.price,
          productName: order.product_name,
          sizeType: order.size_type,
          width: order.product_width,
          height: order.product_height,
          adminNotes: order.adminNotes,
          createdAt: order.createdAt,
          processedAt: order.processedAt
        }))
      });
    } catch (error) {
      console.error('❌ 获取用户广告订单失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取订单失败' 
      });
    }
  }

  /**
   * 获取用户的广告库存
   */
  static async getUserAdInventory(req, res) {
    try {
      const userId = req.user.id;
      const { includeUsed } = req.query;
      
      const inventory = await UserAdInventory.getUserInventory(userId, includeUsed === 'true');
      
      res.json({
        success: true,
        inventory: inventory.map(item => ({
          id: item.id,
          adTitle: item.adTitle,
          productName: item.product_name,
          sizeType: item.size_type,
          width: item.width,
          height: item.height,
          isUsed: item.isUsed,
          usedAt: item.usedAt,
          createdAt: item.createdAt
        }))
      });
    } catch (error) {
      console.error('❌ 获取用户广告库存失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取库存失败' 
      });
    }
  }

  /**
   * 使用广告道具
   */
  static async useAdItem(req, res) {
    try {
      const userId = req.user.id;
      const { inventoryId, centerLat, centerLng } = req.body;

      console.log(`📢 用户 ${userId} 使用广告道具`);
      console.log('📋 请求参数:', {
        inventoryId,
        centerLat,
        centerLng,
        inventoryIdType: typeof inventoryId,
        centerLatType: typeof centerLat,
        centerLngType: typeof centerLng
      });

      // 验证输入
      if (!inventoryId || centerLat === undefined || centerLng === undefined) {
        console.log('❌ 参数验证失败:', {
          hasInventoryId: !!inventoryId,
          hasCenterLat: centerLat !== undefined,
          hasCenterLng: centerLng !== undefined
        });
        return res.status(400).json({
          success: false,
          message: '库存ID和位置坐标不能为空'
        });
      }
      
      // 获取库存记录
      const inventory = await UserAdInventory.findById(inventoryId);
      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: '广告库存不存在'
        });
      }
      
      // 检查权限
      if (inventory.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }
      
      // 检查是否已使用
      if (inventory.isUsed) {
        return res.status(400).json({
          success: false,
          message: '该广告已使用'
        });
      }
      
      // 检查位置是否被占用
      const isOccupied = await AdPlacement.isLocationOccupied(
        centerLat, centerLng, inventory.width, inventory.height
      );
      
      if (isOccupied) {
        return res.status(400).json({
          success: false,
          message: '该位置已被其他广告占用'
        });
      }
      
      // 使用已经处理过的像素数据
      console.log('🎨 使用已处理的广告像素数据...');
      let pixelData;
      try {
        pixelData = JSON.parse(inventory.processedImageData);
      } catch (error) {
        console.error('❌ 解析像素数据失败:', error);
        return res.status(500).json({
          success: false,
          message: '广告数据格式错误'
        });
      }
      
      if (!Array.isArray(pixelData) || pixelData.length === 0) {
        console.error('❌ 像素数据为空或格式错误');
        return res.status(500).json({
          success: false,
          message: '广告像素数据无效'
        });
      }
      
      const processedResult = {
        width: inventory.width,
        height: inventory.height,
        pixelData: pixelData,
        pixelCount: pixelData.length,
        encoding: 'pixel_points',
        render_type: 'advertisement'
      };
      
      // 创建广告放置记录
      const placement = await AdPlacement.create({
        userId,
        adInventoryId: inventoryId,
        centerLat,
        centerLng,
        width: inventory.width,
        height: inventory.height,
        pixelData: JSON.stringify(processedResult.pixelData),
        pixelCount: processedResult.pixelCount
      });
      
      // 标记库存为已使用
      await inventory.markAsUsed();
      
      console.log(`✅ 广告放置成功: ${placement.id}, 像素点数量: ${processedResult.pixelCount}`);
      
      // 异步处理像素渲染（不阻塞响应）
      setImmediate(async () => {
        try {
          console.log(`🎨 开始异步渲染广告像素: ${placement.id}`);
          await AdPixelRenderer.processAdPlacement(placement.id);
          console.log(`🎉 广告像素渲染完成: ${placement.id}`);
        } catch (error) {
          console.error(`❌ 广告像素渲染失败: ${placement.id}`, error);
        }
      });
      
      res.json({
        success: true,
        placement: {
          id: placement.id,
          centerLat: placement.centerLat,
          centerLng: placement.centerLng,
          width: placement.width,
          height: placement.height,
          pixelCount: placement.pixelCount,
          createdAt: placement.createdAt
        },
        message: `广告放置成功！共放置了${processedResult.pixelCount}个像素点`
      });
    } catch (error) {
      console.error('❌ 使用广告道具失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '使用广告道具失败' 
      });
    }
  }

  /**
   * 获取用户的广告放置记录
   */
  static async getUserAdPlacements(req, res) {
    try {
      const userId = req.user.id;
      const { includeInactive } = req.query;
      
      const placements = await AdPlacement.getUserPlacements(userId, includeInactive === 'true');
      
      res.json({
        success: true,
        placements: placements.map(placement => ({
          id: placement.id,
          adTitle: placement.ad_title,
          centerLat: placement.centerLat,
          centerLng: placement.centerLng,
          width: placement.width,
          height: placement.height,
          pixelCount: placement.pixelCount,
          isActive: placement.isActive,
          expiresAt: placement.expiresAt,
          createdAt: placement.createdAt
        }))
      });
    } catch (error) {
      console.error('❌ 获取用户广告放置记录失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取放置记录失败' 
      });
    }
  }

  /**
   * 管理员：获取广告订单（支持按状态筛选）
   */
  static async getPendingAdOrders(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }

      const { status, current = 1, pageSize = 10 } = req.query;

      const result = await AdOrder.getAllOrders({
        status: status || undefined,
        current: parseInt(current),
        pageSize: parseInt(pageSize)
      });

      res.json({
        success: true,
        orders: result.orders.map(order => ({
          id: order.id,
          adTitle: order.adTitle,
          adDescription: order.adDescription,
          originalImageUrl: order.originalImageUrl,
          status: order.status,
          price: order.price,
          productName: order.product_name,
          sizeType: order.size_type,
          width: order.product_width,
          height: order.product_height,
          targetLocation: order.targetLocation,
          scheduledTime: order.scheduledTime,
          adminNotes: order.adminNotes,
          processedAt: order.processedAt,
          processedByName: order.processed_by_name,
          createdAt: order.createdAt,
          user: {
            id: order.userId,
            username: order.username,
            displayName: order.display_name,
            avatarUrl: order.avatar_url
          }
        })),
        total: result.total,
        current: result.current,
        pageSize: result.pageSize
      });
    } catch (error) {
      console.error('❌ 获取广告订单失败:', error);
      res.status(500).json({
        success: false,
        message: '获取订单失败'
      });
    }
  }

  /**
   * 管理员：审核广告订单
   */
  static async reviewAdOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { action, adminNotes, notes } = req.body;
      const finalNotes = adminNotes || notes;
      const adminId = req.user.id;
      
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }
      
      console.log(`🔍 管理员 ${adminId} 审核广告订单 ${orderId}: ${action}`);
      
      const order = await AdOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      console.log(`📋 Order targetLocation:`, order.targetLocation, `type:`, typeof order.targetLocation);

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '订单已处理'
        });
      }
      
      if (action === 'approve') {
        try {
          // 获取广告商品的尺寸信息
          const adProduct = await AdProduct.findById(order.adProductId);
          if (!adProduct) {
            return res.status(404).json({
              success: false,
              message: '广告商品不存在'
            });
          }
          
          console.log(`🎨 开始处理广告图片: ${adProduct.name} (${adProduct.width}x${adProduct.height})`);
          
          // 处理用户上传的图片，使用广告商品规定的尺寸
          const processedResult = await ImageProcessor.processAdImage(
            order.originalImageUrl,
            adProduct.width,  // 使用广告商品规定的宽度
            adProduct.height  // 使用广告商品规定的高度
          );
          
          console.log('📊 广告图片处理结果:', {
            width: processedResult.width,
            height: processedResult.height,
            pixelCount: processedResult.pixelCount
          });
          
          // 更新订单状态
          await order.updateStatus('approved', adminId, finalNotes, JSON.stringify(processedResult.pixelData));
          
          // 创建用户库存记录
          const inventory = await UserAdInventory.create({
            userId: order.userId,
            adOrderId: order.id,
            adProductId: order.adProductId,
            adTitle: order.adTitle,
            processedImageData: JSON.stringify(processedResult.pixelData),
            width: processedResult.width,
            height: processedResult.height
          });

          // 检查是否需要延迟投放（定时广告）
          const scheduledTime = order.scheduledTime || order.scheduled_time;
          const shouldDeferPlacement = scheduledTime && new Date(scheduledTime) > new Date();

          if (shouldDeferPlacement) {
            console.log(`⏰ [auto-place] Deferred — scheduled for ${scheduledTime}`);
          } else {
          // 自动放置广告：如果订单包含投放位置信息，审批通过后直接放置
          // Resolve targetLocation defensively: try camelCase (constructor), snake_case (Object.assign), and raw DB query
          let rawLocation = order.targetLocation || order.target_location;
          console.log(`📍 [auto-place] rawLocation from order instance:`, rawLocation, `type:`, typeof rawLocation);

          // If instance properties are both empty, re-read directly from DB as final fallback
          if (!rawLocation) {
            console.log(`📍 [auto-place] Instance properties empty, querying DB directly for order ${orderId}...`);
            const freshRow = await db('ad_orders').where('id', orderId).select('target_location').first();
            rawLocation = freshRow?.target_location;
            console.log(`📍 [auto-place] DB query result:`, rawLocation, `type:`, typeof rawLocation);
          }

          let targetLocation = null;
          if (rawLocation) {
            try {
              targetLocation = typeof rawLocation === 'string'
                ? JSON.parse(rawLocation)
                : rawLocation;
            } catch (e) {
              console.warn('⚠️ [auto-place] Failed to parse targetLocation:', e.message, 'raw:', rawLocation);
            }
          }

          console.log(`📍 [auto-place] Resolved targetLocation:`, targetLocation);

          if (targetLocation && targetLocation.lat !== undefined && targetLocation.lng !== undefined) {
            console.log(`📍 [auto-place] Creating placement at (${targetLocation.lat}, ${targetLocation.lng})`);

            try {
              // 创建广告放置记录
              const placement = await AdPlacement.create({
                userId: order.userId,
                adInventoryId: inventory.id,
                centerLat: targetLocation.lat,
                centerLng: targetLocation.lng,
                width: processedResult.width,
                height: processedResult.height,
                pixelData: JSON.stringify(processedResult.pixelData),
                pixelCount: processedResult.pixelCount
              });

              // 标记库存为已使用
              await inventory.markAsUsed();

              console.log(`✅ [auto-place] Placement created: ${placement.id}, pixels: ${processedResult.pixelCount}`);

              // Synchronous pixel rendering (ensures pixels are written before response)
              try {
                console.log(`🎨 [auto-place] Rendering pixels for placement: ${placement.id}`);
                await AdPixelRenderer.processAdPlacement(placement.id);
                console.log(`🎉 [auto-place] Pixel rendering complete: ${placement.id}`);
              } catch (renderError) {
                console.error(`❌ [auto-place] Pixel rendering failed: ${placement.id}`, renderError);
                // Don't throw — placement was created, pixels can be re-rendered later
              }
            } catch (placementError) {
              console.error('⚠️ [auto-place] Placement creation failed (inventory created, user can place manually):', placementError.message, placementError.stack);
            }
          } else {
            console.log(`📦 [auto-place] No valid targetLocation — order goes to inventory for manual placement.`,
              `rawLocation was:`, rawLocation, `parsed was:`, targetLocation);
          }
          } // end of !shouldDeferPlacement

          console.log(`✅ 广告订单审核通过: ${orderId}`);
          
        } catch (processError) {
          console.error('❌ 广告图片处理失败:', processError);
          
          // 处理失败，退还积分
          await UserPoints.addPoints(order.userId, order.price, '广告处理失败，退还积分', order.id);
          
          await order.updateStatus('rejected', adminId, `广告处理失败: ${processError.message}`);
          
          return res.status(500).json({
            success: false,
            message: '广告处理失败，已退还积分'
          });
        }
        
      } else if (action === 'reject') {
        // 拒绝订单，退还积分
        await UserPoints.addPoints(order.userId, order.price, '广告订单被拒绝，退还积分', order.id);
        console.log(`💰 用户 ${order.userId} 积分已退还${order.price}点`);
        
        await order.updateStatus('rejected', adminId, finalNotes);
        
        console.log(`❌ 广告订单已拒绝: ${orderId}`);
      }
      
      res.json({
        success: true,
        message: `订单已${action === 'approve' ? '批准' : '拒绝'}`
      });
    } catch (error) {
      console.error('❌ 审核广告订单失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '审核失败' 
      });
    }
  }

  /**
   * 获取广告订单详情
   */
  static async getAdOrderDetails(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      
      const order = await AdOrder.getOrderDetails(orderId, userId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      res.json({
        success: true,
        order: {
          id: order.id,
          adTitle: order.adTitle,
          adDescription: order.adDescription,
          originalImageUrl: order.originalImageUrl,
          processedImageData: order.processedImageData,
          status: order.status,
          price: order.price,
          productName: order.product_name,
          sizeType: order.size_type,
          width: order.product_width,
          height: order.product_height,
          adminNotes: order.adminNotes,
          createdAt: order.createdAt,
          processedAt: order.processedAt
        }
      });
    } catch (error) {
      console.error('❌ 获取广告订单详情失败:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取订单详情失败' 
      });
    }
  }
}

module.exports = AdController;