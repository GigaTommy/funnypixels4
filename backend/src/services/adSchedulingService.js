/**
 * 广告定时投放服务
 * 定期轮询已审批但尚未投放的定时广告订单，到达预定时间后自动投放
 */

const { db } = require('../config/database');
const cron = require('node-cron');
const AdOrder = require('../models/AdOrder');
const UserAdInventory = require('../models/UserAdInventory');
const AdPlacement = require('../models/AdPlacement');
const AdPixelRenderer = require('./AdPixelRenderer');

class AdSchedulingService {
  constructor() {
    this.isRunning = false;
    this.isProcessing = false;
    this.cronTask = null;
  }

  /**
   * 启动广告定时投放服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ [AdScheduling] 广告定时投放服务已在运行中');
      return;
    }

    console.log('🚀 [AdScheduling] 启动广告定时投放服务...');
    this.isRunning = true;

    // 每分钟轮询一次
    this.cronTask = cron.schedule('* * * * *', async () => {
      await this.processScheduledOrders();
    });
  }

  /**
   * 停止广告定时投放服务
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ [AdScheduling] 广告定时投放服务未运行');
      return;
    }

    console.log('🛑 [AdScheduling] 停止广告定时投放服务...');
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    this.isRunning = false;
  }

  /**
   * 处理到期的定时广告订单
   */
  async processScheduledOrders() {
    if (this.isProcessing) {
      console.log('⏳ [AdScheduling] 上一轮处理尚未完成，跳过本轮');
      return;
    }

    this.isProcessing = true;

    try {
      // 查询已审批、定时时间已到、但尚未投放的订单
      const orders = await db('ad_orders')
        .where('ad_orders.status', 'approved')
        .whereNotNull('ad_orders.scheduled_time')
        .where('ad_orders.scheduled_time', '<=', db.fn.now())
        .whereNotExists(function () {
          this.select(db.raw(1))
            .from('user_ad_inventory')
            .join('ad_placements', 'ad_placements.ad_inventory_id', 'user_ad_inventory.id')
            .whereRaw('user_ad_inventory.ad_order_id = ad_orders.id');
        })
        .whereNotNull('ad_orders.target_location')
        .orderBy('ad_orders.scheduled_time', 'asc')
        .limit(10)
        .select('ad_orders.*');

      if (orders.length === 0) {
        return;
      }

      console.log(`📋 [AdScheduling] 发现 ${orders.length} 个待投放的定时广告订单`);

      for (const orderRow of orders) {
        try {
          await this.placeOrder(orderRow);
        } catch (err) {
          console.error(`❌ [AdScheduling] 投放订单 ${orderRow.id} 失败:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ [AdScheduling] 轮询处理出错:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 投放单个广告订单
   */
  async placeOrder(orderRow) {
    const orderId = orderRow.id;

    // 查找对应的库存记录
    const inventoryRow = await db('user_ad_inventory')
      .where('ad_order_id', orderId)
      .first();

    if (!inventoryRow) {
      console.warn(`⚠️ [AdScheduling] 订单 ${orderId} 无对应库存记录，跳过`);
      return;
    }

    const inventory = new UserAdInventory(inventoryRow);

    // 已被其他方式投放
    if (inventory.isUsed) {
      console.log(`ℹ️ [AdScheduling] 订单 ${orderId} 库存已使用，跳过`);
      return;
    }

    // 解析投放位置
    let targetLocation = orderRow.target_location;
    if (typeof targetLocation === 'string') {
      try {
        targetLocation = JSON.parse(targetLocation);
      } catch (e) {
        console.warn(`⚠️ [AdScheduling] 订单 ${orderId} target_location 解析失败:`, e.message);
        return;
      }
    }

    if (!targetLocation || targetLocation.lat === undefined || targetLocation.lng === undefined) {
      console.warn(`⚠️ [AdScheduling] 订单 ${orderId} 无有效投放位置，跳过`);
      return;
    }

    // 解析像素数据
    let pixelData = inventory.processedImageData;
    if (typeof pixelData === 'string') {
      pixelData = JSON.parse(pixelData);
    }

    console.log(`📍 [AdScheduling] 投放订单 ${orderId} 到 (${targetLocation.lat}, ${targetLocation.lng})`);

    // 创建广告放置记录
    const placement = await AdPlacement.create({
      userId: inventory.userId,
      adInventoryId: inventory.id,
      centerLat: targetLocation.lat,
      centerLng: targetLocation.lng,
      width: inventory.width,
      height: inventory.height,
      pixelData: JSON.stringify(pixelData),
      pixelCount: Array.isArray(pixelData) ? pixelData.length : 0
    });

    // 标记库存为已使用
    await inventory.markAsUsed();

    console.log(`✅ [AdScheduling] 放置记录已创建: ${placement.id}`);

    // 渲染像素
    try {
      console.log(`🎨 [AdScheduling] 渲染像素: placement ${placement.id}`);
      await AdPixelRenderer.processAdPlacement(placement.id);
      console.log(`🎉 [AdScheduling] 像素渲染完成: placement ${placement.id}`);
    } catch (renderError) {
      console.error(`❌ [AdScheduling] 像素渲染失败: placement ${placement.id}`, renderError.message);
      // 不抛出 — 放置已创建，像素可以后续重新渲染
    }
  }
}

module.exports = new AdSchedulingService();
