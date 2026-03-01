// @ts-check
/**
 * 基础 Repository 类
 *
 * 提供通用的 CRUD 操作和查询方法
 * 所有具体的 Repository 都应该继承此类
 *
 * @template T - 实体类型
 */
class BaseRepository {
  /**
   * @param {import('knex').Knex} db - 数据库连接
   * @param {string} tableName - 表名
   */
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * 获取查询构建器
   * @returns {import('knex').Knex.QueryBuilder}
   */
  query() {
    return this.db(this.tableName);
  }

  /**
   * 根据ID查找记录
   * @param {number|string} id - 记录ID
   * @returns {Promise<T|undefined>}
   */
  async findById(id) {
    return await this.query().where({ id }).first();
  }

  /**
   * 根据条件查找单个记录
   * @param {Object} conditions - 查询条件
   * @returns {Promise<T|undefined>}
   */
  async findOne(conditions) {
    return await this.query().where(conditions).first();
  }

  /**
   * 根据条件查找多个记录
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项
   * @param {number} [options.limit] - 限制数量
   * @param {number} [options.offset] - 偏移量
   * @param {string|string[]} [options.orderBy] - 排序字段
   * @param {string} [options.order='asc'] - 排序方向
   * @returns {Promise<T[]>}
   */
  async findMany(conditions, options = {}) {
    let query = this.query().where(conditions);

    if (options.orderBy) {
      const orderBy = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      orderBy.forEach(field => {
        query = query.orderBy(field, options.order || 'asc');
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  /**
   * 查找所有记录
   * @param {Object} options - 查询选项
   * @returns {Promise<T[]>}
   */
  async findAll(options = {}) {
    return await this.findMany({}, options);
  }

  /**
   * 创建记录
   * @param {Partial<T>} data - 要创建的数据
   * @returns {Promise<T>}
   */
  async create(data) {
    const [record] = await this.query()
      .insert(this._prepareForInsert(data))
      .returning('*');
    return record;
  }

  /**
   * 批量创建记录
   * @param {Array<Partial<T>>} dataArray - 要创建的数据数组
   * @returns {Promise<T[]>}
   */
  async createMany(dataArray) {
    const preparedData = dataArray.map(data => this._prepareForInsert(data));
    return await this.query()
      .insert(preparedData)
      .returning('*');
  }

  /**
   * 更新记录
   * @param {number|string} id - 记录ID
   * @param {Partial<T>} data - 要更新的数据
   * @returns {Promise<T|undefined>}
   */
  async update(id, data) {
    const [updated] = await this.query()
      .where({ id })
      .update(this._prepareForUpdate(data))
      .returning('*');
    return updated;
  }

  /**
   * 根据条件更新记录
   * @param {Object} conditions - 更新条件
   * @param {Partial<T>} data - 要更新的数据
   * @returns {Promise<number>} 受影响的行数
   */
  async updateMany(conditions, data) {
    return await this.query()
      .where(conditions)
      .update(this._prepareForUpdate(data));
  }

  /**
   * 删除记录
   * @param {number|string} id - 记录ID
   * @returns {Promise<number>} 受影响的行数
   */
  async delete(id) {
    return await this.query().where({ id }).del();
  }

  /**
   * 根据条件删除记录
   * @param {Object} conditions - 删除条件
   * @returns {Promise<number>} 受影响的行数
   */
  async deleteMany(conditions) {
    return await this.query().where(conditions).del();
  }

  /**
   * 检查记录是否存在
   * @param {Object} conditions - 查询条件
   * @returns {Promise<boolean>}
   */
  async exists(conditions) {
    const record = await this.query().where(conditions).first();
    return !!record;
  }

  /**
   * 计数
   * @param {Object} conditions - 查询条件
   * @returns {Promise<number>}
   */
  async count(conditions = {}) {
    const [{ count }] = await this.query()
      .where(conditions)
      .count('* as count');
    return parseInt(count, 10);
  }

  /**
   * 分页查询
   * @param {Object} conditions - 查询条件
   * @param {number} page - 页码（从1开始）
   * @param {number} pageSize - 每页数量
   * @param {Object} options - 其他查询选项
   * @returns {Promise<{data: T[], total: number, page: number, pageSize: number, totalPages: number}>}
   */
  async paginate(conditions, page, pageSize, options = {}) {
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.findMany(conditions, {
        ...options,
        limit: pageSize,
        offset
      }),
      this.count(conditions)
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * 使用事务执行操作
   * @param {Function} callback - 事务回调函数
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    return await this.db.transaction(callback);
  }

  /**
   * 准备插入数据（可被子类覆盖）
   * @protected
   * @param {Partial<T>} data
   * @returns {Partial<T>}
   */
  _prepareForInsert(data) {
    const now = new Date();
    return {
      ...data,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now
    };
  }

  /**
   * 准备更新数据（可被子类覆盖）
   * @protected
   * @param {Partial<T>} data
   * @returns {Partial<T>}
   */
  _prepareForUpdate(data) {
    return {
      ...data,
      updated_at: new Date()
    };
  }

  /**
   * 原始查询（用于复杂查询）
   * @param {string} sql - SQL 语句
   * @param {any[]} bindings - 参数绑定
   * @returns {Promise<any>}
   */
  async raw(sql, bindings = []) {
    return await this.db.raw(sql, bindings);
  }
}

module.exports = BaseRepository;
