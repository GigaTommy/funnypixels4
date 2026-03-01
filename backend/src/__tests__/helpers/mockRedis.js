/**
 * Redis 模拟工具
 * @module tests/helpers/mockRedis
 */

/**
 * 创建模拟的 Redis 客户端
 */
function createMockRedis() {
  // 内存存储
  const storage = new Map();

  const mockRedis = {
    // 存储引用（用于测试验证）
    _storage: storage,

    // 字符串操作
    get: jest.fn((key) => {
      return Promise.resolve(storage.get(key) || null);
    }),

    set: jest.fn((key, value, ...args) => {
      storage.set(key, value);
      return Promise.resolve('OK');
    }),

    setex: jest.fn((key, seconds, value) => {
      storage.set(key, value);
      return Promise.resolve('OK');
    }),

    del: jest.fn((...keys) => {
      let deleted = 0;
      for (const key of keys) {
        if (storage.delete(key)) {
          deleted++;
        }
      }
      return Promise.resolve(deleted);
    }),

    exists: jest.fn((key) => {
      return Promise.resolve(storage.has(key) ? 1 : 0);
    }),

    expire: jest.fn((key, seconds) => {
      return Promise.resolve(storage.has(key) ? 1 : 0);
    }),

    ttl: jest.fn((key) => {
      return Promise.resolve(storage.has(key) ? 3600 : -2);
    }),

    pttl: jest.fn((key) => {
      return Promise.resolve(storage.has(key) ? 3600000 : -2);
    }),

    // 哈希操作
    hget: jest.fn((key, field) => {
      const hash = storage.get(key);
      return Promise.resolve(hash?.[field] || null);
    }),

    hset: jest.fn((key, field, value) => {
      let hash = storage.get(key);
      if (!hash) {
        hash = {};
        storage.set(key, hash);
      }
      hash[field] = value;
      return Promise.resolve(1);
    }),

    hgetall: jest.fn((key) => {
      return Promise.resolve(storage.get(key) || {});
    }),

    hdel: jest.fn((key, ...fields) => {
      const hash = storage.get(key);
      if (!hash) return Promise.resolve(0);
      let deleted = 0;
      for (const field of fields) {
        if (delete hash[field]) deleted++;
      }
      return Promise.resolve(deleted);
    }),

    // 列表操作
    lpush: jest.fn((key, ...values) => {
      let list = storage.get(key);
      if (!Array.isArray(list)) {
        list = [];
        storage.set(key, list);
      }
      list.unshift(...values);
      return Promise.resolve(list.length);
    }),

    rpush: jest.fn((key, ...values) => {
      let list = storage.get(key);
      if (!Array.isArray(list)) {
        list = [];
        storage.set(key, list);
      }
      list.push(...values);
      return Promise.resolve(list.length);
    }),

    lpop: jest.fn((key) => {
      const list = storage.get(key);
      return Promise.resolve(Array.isArray(list) ? list.shift() : null);
    }),

    rpop: jest.fn((key) => {
      const list = storage.get(key);
      return Promise.resolve(Array.isArray(list) ? list.pop() : null);
    }),

    lrange: jest.fn((key, start, stop) => {
      const list = storage.get(key);
      return Promise.resolve(Array.isArray(list) ? list.slice(start, stop + 1) : []);
    }),

    // 集合操作
    sadd: jest.fn((key, ...members) => {
      let set = storage.get(key);
      if (!(set instanceof Set)) {
        set = new Set();
        storage.set(key, set);
      }
      members.forEach(m => set.add(m));
      return Promise.resolve(members.length);
    }),

    smembers: jest.fn((key) => {
      const set = storage.get(key);
      return Promise.resolve(set instanceof Set ? Array.from(set) : []);
    }),

    sismember: jest.fn((key, member) => {
      const set = storage.get(key);
      return Promise.resolve(set instanceof Set && set.has(member) ? 1 : 0);
    }),

    // 有序集合操作
    zadd: jest.fn((key, score, member) => {
      let zset = storage.get(key);
      if (!zset) {
        zset = new Map();
        storage.set(key, zset);
      }
      zset.set(member, score);
      return Promise.resolve(1);
    }),

    zrange: jest.fn((key, start, stop) => {
      const zset = storage.get(key);
      if (!zset) return Promise.resolve([]);
      const sorted = Array.from(zset.entries())
        .sort((a, b) => a[1] - b[1])
        .map(e => e[0]);
      return Promise.resolve(sorted.slice(start, stop + 1));
    }),

    // 计数器操作
    incr: jest.fn((key) => {
      const current = parseInt(storage.get(key) || '0');
      const newValue = current + 1;
      storage.set(key, String(newValue));
      return Promise.resolve(newValue);
    }),

    decr: jest.fn((key) => {
      const current = parseInt(storage.get(key) || '0');
      const newValue = current - 1;
      storage.set(key, String(newValue));
      return Promise.resolve(newValue);
    }),

    incrby: jest.fn((key, increment) => {
      const current = parseInt(storage.get(key) || '0');
      const newValue = current + increment;
      storage.set(key, String(newValue));
      return Promise.resolve(newValue);
    }),

    // SCAN 操作
    scan: jest.fn((cursor, ...args) => {
      const keys = Array.from(storage.keys());
      return Promise.resolve([String(keys.length > 0 ? '0' : cursor), keys]);
    }),

    // 批量操作
    multi: jest.fn(() => {
      const commands = [];
      const multiInstance = {
        get: jest.fn((...args) => { commands.push({ method: 'get', args }); return multiInstance; }),
        set: jest.fn((...args) => { commands.push({ method: 'set', args }); return multiInstance; }),
        incr: jest.fn((...args) => { commands.push({ method: 'incr', args }); return multiInstance; }),
        pttl: jest.fn((...args) => { commands.push({ method: 'pttl', args }); return multiInstance; }),
        expire: jest.fn((...args) => { commands.push({ method: 'expire', args }); return multiInstance; }),
        exec: jest.fn(async () => {
          const results = [];
          for (const cmd of commands) {
            const result = await mockRedis[cmd.method](...cmd.args);
            results.push(result);
          }
          return results;
        })
      };
      return multiInstance;
    }),

    // 连接管理
    quit: jest.fn(() => Promise.resolve('OK')),
    disconnect: jest.fn(() => Promise.resolve()),
    ping: jest.fn(() => Promise.resolve('PONG')),

    // 测试辅助方法
    _clear: () => {
      storage.clear();
    },
    _getStorage: () => storage
  };

  return mockRedis;
}

module.exports = {
  createMockRedis
};
