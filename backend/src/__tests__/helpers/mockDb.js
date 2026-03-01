/**
 * 数据库模拟工具
 * @module tests/helpers/mockDb
 */

/**
 * 创建模拟的 Knex 查询构建器
 */
function createMockQueryBuilder() {
  const mockQueryBuilder = {
    _chainedMethods: [],
    _finalResult: [],

    // 查询方法
    select: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'select', args });
      return this;
    }),
    where: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'where', args });
      return this;
    }),
    whereIn: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'whereIn', args });
      return this;
    }),
    whereNot: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'whereNot', args });
      return this;
    }),
    andWhere: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'andWhere', args });
      return this;
    }),
    orWhere: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'orWhere', args });
      return this;
    }),
    orderBy: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'orderBy', args });
      return this;
    }),
    limit: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'limit', args });
      return this;
    }),
    offset: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'offset', args });
      return this;
    }),
    join: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'join', args });
      return this;
    }),
    leftJoin: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'leftJoin', args });
      return this;
    }),

    // 聚合方法
    count: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'count', args });
      return this;
    }),
    sum: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'sum', args });
      return this;
    }),
    avg: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'avg', args });
      return this;
    }),

    // 执行方法
    first: jest.fn(function() {
      return Promise.resolve(this._finalResult[0] || null);
    }),
    then: jest.fn(function(resolve) {
      return Promise.resolve(this._finalResult).then(resolve);
    }),
    catch: jest.fn(function(reject) {
      return Promise.resolve(this._finalResult).catch(reject);
    }),

    // 修改方法
    insert: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'insert', args });
      return this;
    }),
    update: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'update', args });
      return this;
    }),
    del: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'del', args });
      return this;
    }),
    delete: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'delete', args });
      return this;
    }),
    returning: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'returning', args });
      return this;
    }),
    onConflict: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'onConflict', args });
      return this;
    }),
    merge: jest.fn(function(...args) {
      this._chainedMethods.push({ method: 'merge', args });
      return this;
    }),

    // 事务方法
    transacting: jest.fn(function(trx) {
      return this;
    }),

    // 设置返回结果的辅助方法
    mockResolvedValue: function(value) {
      this._finalResult = Array.isArray(value) ? value : [value];
      return this;
    },
    mockRejectedValue: function(error) {
      this.then = jest.fn(() => Promise.reject(error));
      this.first = jest.fn(() => Promise.reject(error));
      return this;
    }
  };

  return mockQueryBuilder;
}

/**
 * 创建模拟的 Knex 实例
 */
function createMockDb() {
  const mockDb = jest.fn((tableName) => {
    const queryBuilder = createMockQueryBuilder();
    queryBuilder.tableName = tableName;
    return queryBuilder;
  });

  // 添加常用的 Knex 方法
  mockDb.raw = jest.fn((query, bindings) => {
    return Promise.resolve({ rows: [] });
  });

  mockDb.transaction = jest.fn(async (callback) => {
    const mockTrx = createMockDb();
    mockTrx.commit = jest.fn(() => Promise.resolve());
    mockTrx.rollback = jest.fn(() => Promise.resolve());
    return await callback(mockTrx);
  });

  mockDb.schema = {
    hasTable: jest.fn(() => Promise.resolve(true)),
    createTable: jest.fn(() => Promise.resolve()),
    dropTable: jest.fn(() => Promise.resolve())
  };

  return mockDb;
}

module.exports = {
  createMockQueryBuilder,
  createMockDb
};
