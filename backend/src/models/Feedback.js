const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Feedback {
  static async create(data) {
    const feedback = {
      id: uuidv4(),
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      content: data.content,
      screenshots: JSON.stringify(data.screenshots || []),
      app_version: data.app_version || null,
      device_info: data.device_info || null,
      status: 'pending',
      priority: data.priority || 'normal',
      created_at: new Date(),
      updated_at: new Date()
    };

    const [inserted] = await db('user_feedback').insert(feedback).returning('*');
    return inserted;
  }

  static async findById(id) {
    const feedback = await db('user_feedback as f')
      .leftJoin('users as u', 'f.user_id', 'u.id')
      .leftJoin('users as a', 'f.assigned_to', 'a.id')
      .select(
        'f.*',
        'u.username',
        'u.display_name',
        'u.avatar_url',
        'a.display_name as assigned_name'
      )
      .where('f.id', id)
      .first();
    return feedback;
  }

  static async find(params = {}) {
    const {
      current = 1,
      pageSize = 20,
      status,
      type,
      priority,
      keyword,
      start_date,
      end_date,
      user_id
    } = params;

    let query = db('user_feedback as f')
      .leftJoin('users as u', 'f.user_id', 'u.id');

    if (status) query = query.where('f.status', status);
    if (type) query = query.where('f.type', type);
    if (priority) query = query.where('f.priority', priority);
    if (user_id) query = query.where('f.user_id', user_id);
    if (keyword) {
      query = query.where(function() {
        this.where('f.title', 'ilike', `%${keyword}%`)
          .orWhere('f.content', 'ilike', `%${keyword}%`);
      });
    }
    if (start_date) query = query.where('f.created_at', '>=', start_date);
    if (end_date) query = query.where('f.created_at', '<=', end_date);

    const countResult = await query.clone().count('f.id as total').first();
    const total = parseInt(countResult.total);

    const offset = (current - 1) * pageSize;
    const list = await query.clone()
      .select('f.*', 'u.username', 'u.display_name', 'u.avatar_url')
      .orderBy('f.created_at', 'desc')
      .offset(offset).limit(pageSize);

    return { list, total, current: parseInt(current), pageSize: parseInt(pageSize) };
  }

  static async reply(id, adminId, replyText) {
    const [updated] = await db('user_feedback')
      .where('id', id)
      .update({
        admin_reply: replyText,
        assigned_to: adminId,
        replied_at: new Date(),
        status: 'in_progress',
        updated_at: new Date()
      })
      .returning('*');
    return updated;
  }

  static async updateStatus(id, data) {
    const updateData = { updated_at: new Date() };
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'resolved') updateData.resolved_at = new Date();
    }
    if (data.priority) updateData.priority = data.priority;
    if (data.assigned_to) updateData.assigned_to = data.assigned_to;

    const [updated] = await db('user_feedback')
      .where('id', id)
      .update(updateData)
      .returning('*');
    return updated;
  }

  static async delete(id) {
    return db('user_feedback').where('id', id).del();
  }

  static async getStats() {
    const today = new Date().toISOString().split('T')[0];

    const statusCounts = await db('user_feedback')
      .select('status')
      .count('* as count')
      .groupBy('status');

    const typeCounts = await db('user_feedback')
      .select('type')
      .count('* as count')
      .groupBy('type');

    const [todayResolved] = await db('user_feedback')
      .where('resolved_at', '>=', today)
      .count('* as count');

    const [avgResponseTime] = await db('user_feedback')
      .whereNotNull('replied_at')
      .select(
        db.raw("AVG(EXTRACT(EPOCH FROM (replied_at - created_at)) / 3600) as avg_hours")
      );

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s.status] = parseInt(s.count); });

    return {
      pending: statusMap.pending || 0,
      in_progress: statusMap.in_progress || 0,
      resolved: statusMap.resolved || 0,
      closed: statusMap.closed || 0,
      today_resolved: parseInt(todayResolved.count),
      avg_response_hours: avgResponseTime.avg_hours ? parseFloat(avgResponseTime.avg_hours).toFixed(1) : '0',
      type_stats: typeCounts
    };
  }
}

module.exports = Feedback;
