const axios = require('axios');
const { db } = require('../config/database');
const CustomFlagProcessor = require('../services/customFlagProcessor');
const ImageProcessor = require('../services/imageProcessor');
const UserPixelState = require('../models/UserPixelState');
const UserPoints = require('../models/UserPoints');
const PatternAsset = require('../models/PatternAsset');
const ImageStorageService = require('../services/imageStorageService');
const logger = require('../utils/logger');

/**
 * 自定义联盟旗帜控制器
 */
class CustomFlagController {

  /**
   * 获取用户可用的自定义图案
   */
  static async getUserCustomPatterns(req, res) {
    try {
      const userId = req.user.id;

      console.log(`🔍 获取用户 ${userId} 的自定义图案`);

      // 查询用户有权限的自定义图案
      const customPatterns = await db('user_custom_patterns')
        .join('pattern_assets', 'user_custom_patterns.pattern_id', 'pattern_assets.id')
        .join('custom_flag_orders', 'user_custom_patterns.order_id', 'custom_flag_orders.id')
        .where('user_custom_patterns.user_id', userId)
        .where('custom_flag_orders.status', 'approved')
        .select(
          'pattern_assets.*',
          'custom_flag_orders.pattern_name',
          'custom_flag_orders.pattern_description'
        );

      console.log(`✅ 找到 ${customPatterns.length} 个自定义图案`);

      res.json({
        success: true,
        patterns: customPatterns.map(pattern => ({
          key: pattern.key,
          name: pattern.pattern_name || pattern.name,
          description: pattern.pattern_description || pattern.description,
          width: pattern.width,
          height: pattern.height,
          encoding: pattern.encoding,
          payload: pattern.payload,
          verified: pattern.verified,
          is_custom: true,
          created_at: pattern.created_at
        }))
      });
    } catch (error) {
      console.error('❌ 获取用户自定义图案失败:', error);
      res.status(500).json({
        success: false,
        message: '获取自定义图案失败'
      });
    }
  }

  /**
   * 创建自定义旗帜订单
   */
  static async createCustomFlagOrder(req, res) {
    try {
      const userId = req.user.id;
      const { patternName, patternDescription, imageData, imageUrl } = req.body;

      console.log(`🎨 用户 ${userId} 创建自定义旗帜订单`);

      // 验证输入
      if (!patternName || (!imageData && !imageUrl)) {
        return res.status(400).json({
          success: false,
          message: '图案名称和图像数据(或URL)不能为空'
        });
      }

      // 验证图案名称长度
      if (patternName.length > 20) {
        return res.status(400).json({
          success: false,
          message: '图案名称不能超过20个字符'
        });
      }

      if (patternName.length < 2) {
        return res.status(400).json({
          success: false,
          message: '图案名称至少需要2个字符'
        });
      }

      // 验证图像格式（如果是直接上传的数据）
      if (imageData && !ImageProcessor.validateImage(imageData)) {
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

      console.log('📊 用户积分查询结果:', userPoints);

      if (!userPoints) {
        console.log('❌ 用户积分记录不存在');
        return res.status(400).json({
          success: false,
          message: '积分不足，需要2000积分'
        });
      }

      console.log(`💰 用户当前积分: ${userPoints.total_points}, 需要积分: 2000`);

      if (userPoints.total_points < 2000) {
        console.log('❌ 积分不足');
        return res.status(400).json({
          success: false,
          message: '积分不足，需要2000积分'
        });
      }

      console.log('✅ 积分检查通过');

      // 使用数据库事务确保数据一致性
      const result = await db.transaction(async (trx) => {
        try {
          // 创建订单
          const [order] = await trx('custom_flag_orders')
            .insert({
              user_id: userId,
              pattern_name: patternName,
              pattern_description: patternDescription,
              original_image_url: imageUrl || imageData,
              status: 'pending'
            })
            .returning('*');

          console.log('✅ 订单创建成功:', order.id);

          // 处理用户上传的图像并保存到临时存储
          console.log('🖼️ 处理用户上传的图像...');

          let processInput = imageData;
          if (imageUrl) {
            console.log(`📥 从 URL 下载图像: ${imageUrl}`);
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            processInput = Buffer.from(response.data);
          }

          const processedResult = await ImageProcessor.processUserImage(processInput);
          console.log('✅ 图像处理完成');

          // 保存到临时存储
          const TempPatternStorageService = require('../services/tempPatternStorageService');
          const tempStorageResult = await TempPatternStorageService.saveTempPattern(order, processedResult, trx);
          console.log(`✅ 临时图案数据已保存: ${tempStorageResult.tempPatternId}`);

          // 扣减积分
          await UserPoints.deductPoints(userId, 2000, '购买自定义旗帜', order.id);
          console.log(`💰 用户 ${userId} 积分已扣减2000点`);

          return order;
        } catch (error) {
          console.error('❌ 事务中的错误:', error);
          throw error;
        }
      });

      const order = result;

      console.log(`✅ 自定义旗帜订单创建成功: ${order.id}`);

      res.json({
        success: true,
        order: {
          id: order.id,
          pattern_name: order.pattern_name,
          pattern_description: order.pattern_description,
          status: order.status,
          price: order.price,
          created_at: order.created_at
        },
        message: '订单创建成功，等待客服处理'
      });
    } catch (error) {
      console.error('❌ 创建自定义旗帜订单失败:', error);
      res.status(500).json({
        success: false,
        message: '创建订单失败'
      });
    }
  }

  /**
   * 获取用户的自定义旗帜订单
   */
  static async getUserCustomFlagOrders(req, res) {
    try {
      const userId = req.user.id;

      const orders = await db('custom_flag_orders')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .select('*');

      res.json({
        success: true,
        orders: orders.map(order => ({
          id: order.id,
          pattern_name: order.pattern_name,
          pattern_description: order.pattern_description,
          status: order.status,
          price: order.price,
          admin_notes: order.admin_notes,
          created_at: order.created_at,
          processed_at: order.processed_at
        }))
      });
    } catch (error) {
      console.error('❌ 获取用户订单失败:', error);
      res.status(500).json({
        success: false,
        message: '获取订单失败'
      });
    }
  }

  /**
   * 管理员：获取自定义旗帜订单（支持按状态筛选）
   */
  static async getPendingOrders(req, res) {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }

      const { status, current = 1, pageSize = 10 } = req.query;

      let query = db('custom_flag_orders')
        .join('users', 'custom_flag_orders.user_id', 'users.id')
        .leftJoin('users as admin_users', 'custom_flag_orders.processed_by', 'admin_users.id')
        .select(
          'custom_flag_orders.*',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'admin_users.username as processed_by_name'
        )
        .orderBy('custom_flag_orders.created_at', 'desc');

      if (status) {
        query = query.where('custom_flag_orders.status', status);
      }

      // Count total
      const countQuery = db('custom_flag_orders');
      if (status) {
        countQuery.where('status', status);
      }
      const [{ count: total }] = await countQuery.count('* as count');

      // Paginate
      const page = parseInt(current);
      const size = parseInt(pageSize);
      const offset = (page - 1) * size;
      const orders = await query.limit(size).offset(offset);

      res.json({
        success: true,
        list: orders.map(order => ({
          id: order.id,
          pattern_name: order.pattern_name,
          pattern_description: order.pattern_description,
          original_image_url: order.original_image_url,
          status: order.status,
          price: order.price,
          admin_notes: order.admin_notes,
          processed_at: order.processed_at,
          processedByName: order.processed_by_name,
          created_at: order.created_at,
          user_id: order.user_id,
          applicantName: order.display_name || order.username,
          applicantAvatar: order.avatar_url,
          submittedAt: order.created_at,
          user: {
            id: order.user_id,
            username: order.username,
            display_name: order.display_name,
            avatar_url: order.avatar_url
          }
        })),
        total: parseInt(total),
        current: page,
        pageSize: size
      });
    } catch (error) {
      console.error('❌ 获取订单失败:', error);
      res.status(500).json({
        success: false,
        message: '获取订单失败'
      });
    }
  }

  /**
   * 管理员：审核自定义旗帜订单
   */
  static async reviewCustomFlagOrder(req, res) {
    try {
      const { orderId, action, adminNotes } = req.body;
      const adminId = req.user.id;

      console.log(`🔍 管理员 ${adminId} 审核订单 ${orderId}: ${action}`);
      console.log('📋 请求数据:', { orderId, action, adminNotes });

      // 检查管理员权限
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        console.log('❌ 权限不足:', req.user.role);
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }

      // 先查询订单是否存在（不限制状态）
      const allOrders = await db('custom_flag_orders')
        .where('id', orderId)
        .select('*');

      console.log('📋 订单查询结果:', allOrders.length > 0 ? allOrders[0] : '未找到');

      if (allOrders.length === 0) {
        console.log('❌ 订单不存在:', orderId);
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      const order = allOrders[0];

      // 允许处理pending和rejected状态的订单
      if (order.status !== 'pending' && order.status !== 'rejected') {
        console.log('❌ 订单状态不允许处理:', order.status);
        return res.status(400).json({
          success: false,
          message: `订单状态为${order.status}，无法处理`
        });
      }

      console.log('✅ 订单验证通过，开始处理...');

      if (action === 'approve') {
        try {
          // 处理原始图像
          console.log('🔄 处理原始图像...');
          const ImageProcessor = require('../services/imageProcessor');

          let processInput;
          let rawImageBuffer; // 保存原始图像buffer供后续使用

          if (order.original_image_url && order.original_image_url.startsWith('http')) {
            console.log(`📥 从 URL 下载图像: ${order.original_image_url}`);
            const response = await axios.get(order.original_image_url, { responseType: 'arraybuffer' });
            rawImageBuffer = Buffer.from(response.data);
            processInput = rawImageBuffer;
          } else {
            processInput = order.original_image_url;
            // 如果是base64，也解析出buffer备用
            const base64Data = (order.original_image_url && order.original_image_url.includes(',')) ? order.original_image_url.split(',')[1] : order.original_image_url;
            if (base64Data) {
              rawImageBuffer = Buffer.from(base64Data, 'base64');
            }
          }

          const processedResult = await ImageProcessor.processUserImage(processInput);
          console.log('✅ 图像处理完成');

          // 如果是RLE格式，转换为PNG base64以避免编码验证错误
          let finalPayload, finalEncoding;
          if (processedResult.encoding === 'rle') {
            console.log('🔄 转换RLE到PNG base64格式...');
            const sharp = require('sharp');

            // 使用之前获取的 rawImageBuffer
            if (!rawImageBuffer) {
              throw new Error('无法获取原始图像Buffer');
            }

            const resizedBuffer = await sharp(rawImageBuffer)
              .resize(64, 64, {
                kernel: 'nearest',
                fit: 'fill'
              })
              .png({ compressionLevel: 9 })
              .toBuffer();

            finalPayload = `data:image/png;base64,${resizedBuffer.toString('base64')}`;
            finalEncoding = 'png_base64';
            console.log('✅ RLE已转换为PNG base64格式');
          } else {
            finalPayload = processedResult.data || processedResult;
            finalEncoding = processedResult.encoding || 'png_base64';
          }

          // CDN上传处理 - 生成双版本图像
          let cdnResult = null;
          try {
            const CDNService = require('../services/cdnService');
            const cdnService = new CDNService();

            logger.info(`🚀 开始上传自定义旗帜到CDN: ${orderId}`, {
              orderName: order.pattern_name,
              userId: order.user_id,
              payloadSize: finalPayload.length
            });

            // 上传到CDN（自动生成高清版和缩略图）
            cdnResult = await cdnService.uploadCustomFlag({
              data: finalPayload,
              orderId: orderId,
              userId: order.user_id
            });

            logger.info(`✅ 自定义旗帜CDN上传成功: ${orderId}`, {
              cdnUrl: cdnResult.cdnUrl,
              storagePath: cdnResult.storagePath,
              fileSize: cdnResult.size,
              thumbnailSize: cdnResult.thumbnailBase64.length
            });

          } catch (cdnError) {
            logger.error(`❌ CDN上传失败，使用降级模式: ${orderId}`, cdnError);
            // CDN失败时仍继续创建PatternAsset，只是没有CDN字段
          }

          // 创建图案资源
          const PatternAsset = require('../models/PatternAsset');
          const patternKey = `custom_flag_${orderId}`;
          const patternAsset = await PatternAsset.create({
            key: patternKey,
            name: order.pattern_name,
            category: 'custom_flag',
            width: 64, // 统一为64x64（CDN高清版）
            height: 64,
            encoding: 'png_base64',
            payload: finalPayload, // 始终使用64x64 PNG，CDN缩略图(12x12)不满足Material系统最小16px要求
            render_type: 'complex',
            // CDN相关字段
            file_url: cdnResult ? cdnResult.cdnUrl : null,
            file_path: cdnResult ? cdnResult.storagePath : null,
            file_hash: cdnResult ? cdnResult.hash : null,
            file_size: cdnResult ? cdnResult.size : null,
            created_by: order.user_id,
            verified: true
          });

          logger.info(`✅ 图案资源创建成功: ${patternAsset.id}`, {
            patternKey,
            hasCdnUrl: !!cdnResult?.cdnUrl,
            payloadType: 'full_base64'
          });

          // 添加到用户库存
          await db('user_custom_patterns').insert({
            id: require('crypto').randomUUID(),
            user_id: order.user_id,
            pattern_id: patternAsset.id,
            order_id: orderId,
            created_at: new Date()
          });

          // 更新订单状态
          await db('custom_flag_orders')
            .where('id', orderId)
            .update({
              status: 'approved',
              processed_by: adminId,
              processed_at: db.fn.now(),
              admin_notes: adminNotes || '已批准'
            });

          console.log(`✅ 订单审核通过，图案已添加到用户库存: ${orderId}`);

        } catch (processError) {
          console.error('❌ 图案处理失败:', processError);
          console.error('📋 错误详情:', {
            message: processError.message,
            stack: processError.stack,
            orderId: orderId,
            orderStatus: order.status
          });

          // 处理失败，只有在订单不是rejected状态时才退还积分
          if (order.status !== 'rejected') {
            await UserPoints.addPoints(order.user_id, 2000, '自定义旗帜处理失败，退还积分', order.id);
            console.log(`💰 用户 ${order.user_id} 积分已退还2000点`);
          } else {
            console.log('ℹ️ 订单已经是rejected状态，跳过积分退还');
          }

          // 生成详细的错误信息
          const errorDetails = {
            type: processError.name || 'ProcessError',
            message: processError.message || '未知错误',
            timestamp: new Date().toISOString()
          };

          await db('custom_flag_orders')
            .where('id', orderId)
            .update({
              status: 'rejected',
              processed_by: adminId,
              processed_at: db.fn.now(),
              admin_notes: `⚠️ 图案处理失败\n错误类型: ${errorDetails.type}\n错误信息: ${errorDetails.message}\n时间: ${errorDetails.timestamp}`
            });

          console.log(`❌ 订单已标记为拒绝: ${orderId}`);

          return res.status(500).json({
            success: false,
            message: `图案处理失败: ${processError.message}，已退还积分`,
            // 返回错误详情供管理员查看
            details: {
              errorType: errorDetails.type,
              errorMessage: errorDetails.message,
              orderId: orderId,
              recommendation: '请检查后端日志获取更详细信息'
            }
          });
        }

      } else if (action === 'reject') {
        // 拒绝订单，只有在订单不是rejected状态时才退还积分
        if (order.status !== 'rejected') {
          await UserPoints.addPoints(order.user_id, 2000, '自定义旗帜订单被拒绝，退还积分', order.id);
          console.log(`💰 用户 ${order.user_id} 积分已退还2000点`);
        } else {
          console.log('ℹ️ 订单已经是rejected状态，跳过积分退还');
        }

        await db('custom_flag_orders')
          .where('id', orderId)
          .update({
            status: 'rejected',
            processed_by: adminId,
            processed_at: db.fn.now(),
            admin_notes: adminNotes
          });

        console.log(`❌ 订单已拒绝: ${orderId}`);
      }

      res.json({
        success: true,
        message: `订单已${action === 'approve' ? '批准' : '拒绝'}`
      });
    } catch (error) {
      console.error('❌ 审核自定义旗帜订单失败:', error);
      res.status(500).json({
        success: false,
        message: '审核失败'
      });
    }
  }

  /**
   * 获取自定义旗帜订单详情
   */
  static async getOrderDetails(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await db('custom_flag_orders')
        .where('id', orderId)
        .first();

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      // 检查权限：只有订单所有者或管理员可以查看
      if (order.user_id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin' && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          pattern_name: order.pattern_name,
          pattern_description: order.pattern_description,
          original_image_url: order.original_image_url,
          ai_processed_image_url: order.ai_processed_image_url,
          emoji_version: order.emoji_version,
          status: order.status,
          price: order.price,
          admin_notes: order.admin_notes,
          created_at: order.created_at,
          processed_at: order.processed_at
        }
      });
    } catch (error) {
      console.error('❌ 获取订单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取订单详情失败'
      });
    }
  }
}

module.exports = CustomFlagController;
