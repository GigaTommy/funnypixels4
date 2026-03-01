const { db } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class PaymentAdminController {
  static async getTransactions(req, res) {
    try {
      const { current = 1, pageSize = 20, user_id, username, reason, start_date, end_date } = req.query;

      let query = db('wallet_ledger as wl')
        .leftJoin('users as u', 'wl.user_id', 'u.id');

      if (user_id) query = query.where('wl.user_id', user_id);
      if (username) {
        query = query.where(function() {
          this.where('u.username', 'ilike', `%${username}%`)
            .orWhere('u.display_name', 'ilike', `%${username}%`);
        });
      }
      if (reason) query = query.where('wl.reason', 'ilike', `%${reason}%`);
      if (start_date) query = query.where('wl.created_at', '>=', start_date);
      if (end_date) query = query.where('wl.created_at', '<=', end_date);

      const countResult = await query.clone().count('wl.id as total').first();
      const total = parseInt(countResult.total);

      const offset = (parseInt(current) - 1) * parseInt(pageSize);
      const list = await query.clone()
        .select('wl.*', 'u.username', 'u.display_name', 'u.avatar_url')
        .orderBy('wl.created_at', 'desc')
        .offset(offset).limit(parseInt(pageSize));

      res.json({
        success: true,
        data: { list, total, current: parseInt(current), pageSize: parseInt(pageSize) }
      });
    } catch (error) {
      logger.error('Get transactions error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getRechargeOrders(req, res) {
    try {
      const { current = 1, pageSize = 20, status, channel, start_date, end_date } = req.query;

      let query = db('recharge_orders as ro')
        .leftJoin('users as u', 'ro.user_id', 'u.id');

      if (status) query = query.where('ro.status', status);
      if (channel) query = query.where('ro.channel', channel);
      if (start_date) query = query.where('ro.created_at', '>=', start_date);
      if (end_date) query = query.where('ro.created_at', '<=', end_date);

      const countResult = await query.clone().count('ro.id as total').first();
      const total = parseInt(countResult.total);

      const offset = (parseInt(current) - 1) * parseInt(pageSize);
      const list = await query.clone()
        .select('ro.*', 'u.username', 'u.display_name', 'u.avatar_url')
        .orderBy('ro.created_at', 'desc')
        .offset(offset).limit(parseInt(pageSize));

      res.json({
        success: true,
        data: { list, total, current: parseInt(current), pageSize: parseInt(pageSize) }
      });
    } catch (error) {
      logger.error('Get recharge orders error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async processRefund(req, res) {
    try {
      const { order_id, reason } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.display_name || req.user.username;

      if (!order_id || !reason) {
        return res.status(400).json({ success: false, message: '订单ID和退款原因必填' });
      }

      // Verify order exists and is paid
      const order = await db('recharge_orders').where('id', order_id).first();
      if (!order) {
        return res.status(404).json({ success: false, message: '订单不存在' });
      }
      if (order.status !== 'paid') {
        return res.status(400).json({ success: false, message: '只有已支付订单可以退款' });
      }
      if (order.refund_status) {
        return res.status(400).json({ success: false, message: '该订单已退款' });
      }

      await db.transaction(async (trx) => {
        // Deduct user points
        await trx('wallet_ledger').insert({
          id: uuidv4(),
          user_id: order.user_id,
          delta_points: -order.points,
          reason: `退款: ${reason}`,
          ref_id: order_id,
          created_at: new Date()
        });

        // Update user points balance
        await trx('users')
          .where('id', order.user_id)
          .decrement('points', order.points);

        // Update order refund fields
        await trx('recharge_orders')
          .where('id', order_id)
          .update({
            refund_status: 'refunded',
            refund_amount: order.amount_rmb,
            refund_reason: reason,
            refunded_by: adminId,
            refunded_at: new Date()
          });

        // Write refund log
        await trx('admin_refund_logs').insert({
          id: uuidv4(),
          order_id: order_id,
          admin_id: adminId,
          admin_name: adminName,
          user_id: order.user_id,
          refund_points: order.points,
          reason: reason,
          status: 'completed',
          created_at: new Date()
        });
      });

      res.json({ success: true, message: '退款成功' });
    } catch (error) {
      logger.error('Process refund error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPaymentStats(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const [totalRevenue] = await db('recharge_orders')
        .where('status', 'paid')
        .sum('amount_rmb as total');

      const [todayRevenue] = await db('recharge_orders')
        .where('status', 'paid')
        .where('created_at', '>=', today)
        .sum('amount_rmb as total');

      const [weekRevenue] = await db('recharge_orders')
        .where('status', 'paid')
        .where('created_at', '>=', weekAgo)
        .sum('amount_rmb as total');

      const [monthRevenue] = await db('recharge_orders')
        .where('status', 'paid')
        .where('created_at', '>=', monthAgo)
        .sum('amount_rmb as total');

      const [totalRefund] = await db('admin_refund_logs')
        .where('status', 'completed')
        .count('* as count');

      const channelStats = await db('recharge_orders')
        .where('status', 'paid')
        .select('channel')
        .sum('amount_rmb as total')
        .count('* as count')
        .groupBy('channel');

      const [avgOrder] = await db('recharge_orders')
        .where('status', 'paid')
        .avg('amount_rmb as avg_amount');

      res.json({
        success: true,
        data: {
          total_revenue: parseFloat(totalRevenue.total) || 0,
          today_revenue: parseFloat(todayRevenue.total) || 0,
          week_revenue: parseFloat(weekRevenue.total) || 0,
          month_revenue: parseFloat(monthRevenue.total) || 0,
          total_refunds: parseInt(totalRefund.count),
          avg_order_amount: parseFloat(avgOrder.avg_amount || 0).toFixed(2),
          channel_stats: channelStats
        }
      });
    } catch (error) {
      logger.error('Get payment stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUserPaymentHistory(req, res) {
    try {
      const { userId } = req.params;
      const { current = 1, pageSize = 20 } = req.query;

      const ledger = await db('wallet_ledger')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .offset((parseInt(current) - 1) * parseInt(pageSize))
        .limit(parseInt(pageSize));

      const [countResult] = await db('wallet_ledger')
        .where('user_id', userId)
        .count('* as total');

      res.json({
        success: true,
        data: {
          list: ledger,
          total: parseInt(countResult.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('Get user payment history error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = PaymentAdminController;
