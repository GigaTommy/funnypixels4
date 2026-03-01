const { db } = require('../config/database');
const logger = require('../utils/logger');
const ImageProcessor = require('./imageProcessor');

/**
 * 广告处理服务
 * 处理审批通过的广告订单
 */
class AdProcessor {

  /**
   * 处理已批准的广告订单
   * @param {string} orderId - 广告订单ID
   */
  static async processApprovedAd(orderId) {
    try {
      logger.info(`开始处理已批准的广告订单: ${orderId}`);

      // 获取订单详情
      const order = await db('ad_orders')
        .where('id', orderId)
        .first();

      if (!order) {
        throw new Error('广告订单不存在');
      }

      if (order.status !== 'approved') {
        throw new Error('订单状态不是已批准');
      }

      // 获取临时存储的广告数据（如果存在）
      const tempAdData = await db('temp_ad_storage')
        .where('order_id', orderId)
        .first();

      // 获取广告产品信息
      const product = await db('ad_products')
        .where('id', order.ad_product_id)
        .first();

      if (!product) {
        throw new Error('广告产品不存在');
      }

      // 使用订单中已处理的图像数据
      const processedImageData = order.processed_image_data;

      if (!processedImageData) {
        throw new Error('订单缺少已处理的图像数据');
      }

      await db.transaction(async (trx) => {
        // 添加到用户广告库存（使用正确的字段名）
        await trx('user_ad_inventory').insert({
          user_id: order.user_id,
          ad_order_id: order.id,
          ad_product_id: order.ad_product_id,
          ad_title: order.ad_title,
          processed_image_data: processedImageData,
          width: product.width,
          height: product.height,
          is_used: false,
          created_at: new Date()
        });

        logger.info(`广告已添加到用户 ${order.user_id} 的库存`);

        // 清理临时数据（可选，也可以保留一段时间）
        // await trx('temp_ad_storage').where('order_id', orderId).delete();
      });

      logger.info(`广告订单 ${orderId} 处理完成`);

      return {
        success: true,
        message: '广告订单处理成功'
      };

    } catch (error) {
      logger.error(`处理广告订单失败 ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 处理广告放置
   * @param {string} inventoryId - 库存ID
   * @param {object} placement - 放置信息 {grid_x, grid_y}
   */
  static async placeAd(inventoryId, placement) {
    try {
      const { grid_x, grid_y } = placement;

      logger.info(`放置广告: 库存ID ${inventoryId}, 位置 (${grid_x}, ${grid_y})`);

      // 获取库存项
      const inventoryItem = await db('user_ad_inventory')
        .where('id', inventoryId)
        .where('used', false)
        .first();

      if (!inventoryItem) {
        throw new Error('广告库存不存在或已使用');
      }

      await db.transaction(async (trx) => {
        // 创建广告放置记录
        const [placement] = await trx('ad_placements').insert({
          user_id: inventoryItem.user_id,
          inventory_id: inventoryId,
          ad_title: inventoryItem.ad_title,
          ad_description: inventoryItem.ad_description,
          target_url: inventoryItem.target_url,
          ad_data: inventoryItem.ad_data,
          preview_url: inventoryItem.preview_url,
          grid_x: grid_x,
          grid_y: grid_y,
          width: inventoryItem.width,
          height: inventoryItem.height,
          duration: inventoryItem.duration,
          start_time: new Date(),
          end_time: new Date(Date.now() + inventoryItem.duration * 1000),
          status: 'active',
          created_at: new Date()
        }).returning('*');

        // 标记库存为已使用
        await trx('user_ad_inventory')
          .where('id', inventoryId)
          .update({
            used: true,
            used_at: new Date()
          });

        logger.info(`广告放置成功: ${placement.id}`);

        return placement;
      });

      return {
        success: true,
        message: '广告放置成功'
      };

    } catch (error) {
      logger.error(`放置广告失败:`, error);
      throw error;
    }
  }

  /**
   * 检查并清理过期广告
   */
  static async cleanupExpiredAds() {
    try {
      const expiredAds = await db('ad_placements')
        .where('status', 'active')
        .where('end_time', '<', new Date())
        .select('id');

      if (expiredAds.length > 0) {
        await db('ad_placements')
          .whereIn('id', expiredAds.map(ad => ad.id))
          .update({
            status: 'expired',
            updated_at: new Date()
          });

        logger.info(`清理了 ${expiredAds.length} 个过期广告`);
      }

      return {
        success: true,
        cleaned: expiredAds.length
      };

    } catch (error) {
      logger.error('清理过期广告失败:', error);
      throw error;
    }
  }
}

module.exports = AdProcessor;
