const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SystemLog {
    static tableName = 'system_logs';

    static async create(data) {
        const id = uuidv4();
        const log = {
            id,
            level: data.level || 'info',
            module: data.module,
            message: data.message,
            user_id: data.user_id,
            ip_address: data.ip_address,
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            created_at: new Date()
        };

        await db(this.tableName).insert(log);
        return log;
    }

    static async find(params = {}) {
        const {
            current = 1,
            pageSize = 20,
            level,
            module,
            start_date,
            end_date,
            user_id
        } = params;

        let query = db(this.tableName);

        if (level) {
            query = query.where('level', level);
        }

        if (module) {
            query = query.where('module', module);
        }

        if (user_id) {
            query = query.where('user_id', user_id);
        }

        if (start_date) {
            query = query.where('created_at', '>=', start_date);
        }

        if (end_date) {
            query = query.where('created_at', '<=', end_date);
        }

        // 获取总数
        const countRes = await query.clone().count('id as total').first();
        const total = parseInt(countRes.total);

        // 分页查询
        const list = await query
            .orderBy('created_at', 'desc')
            .limit(pageSize)
            .offset((current - 1) * pageSize);

        return {
            list,
            total,
            current: parseInt(current),
            pageSize: parseInt(pageSize)
        };
    }

    static async clear(days = 30) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        return db(this.tableName)
            .where('created_at', '<', date)
            .del();
    }
}

module.exports = SystemLog;
