const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class AdminAuditLog {
  static async create(data) {
    const log = {
      id: uuidv4(),
      admin_id: data.admin_id,
      admin_name: data.admin_name,
      action: data.action,
      module: data.module,
      target_type: data.target_type || null,
      target_id: data.target_id || null,
      description: data.description || null,
      request_method: data.request_method || null,
      request_path: data.request_path || null,
      request_body: data.request_body ? JSON.stringify(data.request_body) : '{}',
      response_status: data.response_status || null,
      ip_address: data.ip_address || null,
      created_at: new Date()
    };

    const [inserted] = await db('admin_audit_logs').insert(log).returning('*');
    return inserted;
  }

  static async find(params = {}) {
    const {
      current = 1,
      pageSize = 20,
      admin_id,
      module,
      action,
      start_date,
      end_date
    } = params;

    let query = db('admin_audit_logs').orderBy('created_at', 'desc');

    if (admin_id) {
      query = query.where('admin_id', admin_id);
    }
    if (module) {
      query = query.where('module', module);
    }
    if (action) {
      query = query.where('action', action);
    }
    if (start_date) {
      query = query.where('created_at', '>=', start_date);
    }
    if (end_date) {
      query = query.where('created_at', '<=', end_date);
    }

    const countQuery = query.clone().count('* as total').first();
    const total = (await countQuery).total;

    const offset = (current - 1) * pageSize;
    const list = await query.offset(offset).limit(pageSize);

    return {
      list,
      total: parseInt(total),
      current: parseInt(current),
      pageSize: parseInt(pageSize)
    };
  }

  static async getStats() {
    const today = new Date().toISOString().split('T')[0];

    const [todayCount] = await db('admin_audit_logs')
      .where('created_at', '>=', today)
      .count('* as count');

    const moduleStats = await db('admin_audit_logs')
      .select('module')
      .count('* as count')
      .groupBy('module')
      .orderBy('count', 'desc');

    const adminStats = await db('admin_audit_logs')
      .select('admin_name')
      .count('* as count')
      .groupBy('admin_name')
      .orderBy('count', 'desc')
      .limit(10);

    const actionStats = await db('admin_audit_logs')
      .select('action')
      .count('* as count')
      .groupBy('action')
      .orderBy('count', 'desc');

    return {
      today_count: parseInt(todayCount.count),
      module_stats: moduleStats,
      admin_stats: adminStats,
      action_stats: actionStats
    };
  }

  static async clear(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const deleted = await db('admin_audit_logs')
      .where('created_at', '<', cutoffDate)
      .del();
    return deleted;
  }
}

module.exports = AdminAuditLog;
