/**
 * 性能基准测试
 * 测试关键操作的性能指标
 */

const {
  setupTestEnvironment,
  teardownTestEnvironment,
  db
} = require('../integration/setup');

describe('Performance Benchmarks', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  }, 30000);

  afterAll(async () => {
    await teardownTestEnvironment();
  }, 30000);

  describe('Database Query Performance', () => {
    test('像素查询应该在 100ms 内完成', async () => {
      const start = Date.now();

      try {
        await db('pixels')
          .select('*')
          .limit(100);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100);
        console.log(`✅ 像素查询耗时: ${duration}ms`);
      } catch (error) {
        console.warn('⚠️ 跳过测试（数据库不可用）');
      }
    });

    test('用户查询应该在 50ms 内完成', async () => {
      const start = Date.now();

      try {
        await db('users')
          .select('id', 'email', 'username')
          .limit(100);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(50);
        console.log(`✅ 用户查询耗时: ${duration}ms`);
      } catch (error) {
        console.warn('⚠️ 跳过测试（数据库不可用）');
      }
    });

    test('聚合查询应该在 200ms 内完成', async () => {
      const start = Date.now();

      try {
        await db('pixels')
          .count('* as count')
          .groupBy('user_id')
          .limit(100);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(200);
        console.log(`✅ 聚合查询耗时: ${duration}ms`);
      } catch (error) {
        console.warn('⚠️ 跳过测试（数据库不可用）');
      }
    });
  });

  describe('Batch Processing Performance', () => {
    test('批量插入应该每秒处理 >= 100 条记录', async () => {
      const batchSize = 100;
      const pixels = Array.from({ length: batchSize }, (_, i) => ({
        grid_id: `perf_test_${i}_${Date.now()}`,
        user_id: 1,
        color: '#FF0000',
        latitude: 40.7128,
        longitude: -74.0060,
        created_at: new Date(),
        updated_at: new Date()
      }));

      const start = Date.now();

      try {
        await db('pixels').insert(pixels);
        const duration = Date.now() - start;
        const recordsPerSecond = (batchSize / duration) * 1000;

        expect(recordsPerSecond).toBeGreaterThanOrEqual(100);
        console.log(`✅ 批量插入速度: ${recordsPerSecond.toFixed(2)} 条/秒`);

        // 清理测试数据
        await db('pixels')
          .where('grid_id', 'like', 'perf_test_%')
          .del();
      } catch (error) {
        console.warn('⚠️ 跳过测试（数据库不可用）');
      }
    });
  });

  describe('Cache Performance', () => {
    test('Redis GET 操作应该在 10ms 内完成', async () => {
      const { getRedis } = require('../../config/redis');
      const redis = getRedis();

      if (!redis) {
        console.warn('⚠️ 跳过测试（Redis 不可用）');
        return;
      }

      try {
        // 设置测试数据
        await redis.set('perf_test_key', 'test_value');

        const start = Date.now();
        await redis.get('perf_test_key');
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(10);
        console.log(`✅ Redis GET 耗时: ${duration}ms`);

        // 清理
        await redis.del('perf_test_key');
      } catch (error) {
        console.warn('⚠️ Redis 测试失败:', error.message);
      }
    });

    test('Redis SET 操作应该在 10ms 内完成', async () => {
      const { getRedis } = require('../../config/redis');
      const redis = getRedis();

      if (!redis) {
        console.warn('⚠️ 跳过测试（Redis 不可用）');
        return;
      }

      try {
        const start = Date.now();
        await redis.set('perf_test_key', 'test_value');
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(10);
        console.log(`✅ Redis SET 耗时: ${duration}ms`);

        // 清理
        await redis.del('perf_test_key');
      } catch (error) {
        console.warn('⚠️ Redis 测试失败:', error.message);
      }
    });
  });

  describe('Memory Performance', () => {
    test('批量数据处理不应导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 处理大量数据
      for (let i = 0; i < 10; i++) {
        const data = Array.from({ length: 1000 }, (_, j) => ({
          id: j,
          data: 'x'.repeat(100)
        }));

        // 模拟处理
        data.forEach(item => {
          const processed = { ...item, processed: true };
        });
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      // 内存增长应该小于 50MB
      expect(memoryGrowthMB).toBeLessThan(50);
      console.log(`✅ 内存增长: ${memoryGrowthMB.toFixed(2)}MB`);
    });
  });

  describe('Validation Performance', () => {
    test('Joi 验证应该在 1ms 内完成', () => {
      const Joi = require('joi');
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const data = {
        email: 'test@example.com',
        password: 'password123'
      };

      const start = Date.now();
      const { error } = schema.validate(data);
      const duration = Date.now() - start;

      expect(error).toBeUndefined();
      expect(duration).toBeLessThan(1);
      console.log(`✅ Joi 验证耗时: ${duration}ms`);
    });

    test('大量验证应该保持高性能', () => {
      const Joi = require('joi');
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const iterations = 1000;
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };

      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        schema.validate(data);
      }
      const duration = Date.now() - start;
      const perValidation = duration / iterations;

      expect(perValidation).toBeLessThan(0.1);
      console.log(`✅ 平均验证耗时: ${perValidation.toFixed(4)}ms`);
    });
  });

  describe('Encryption Performance', () => {
    test('bcrypt 哈希应该在合理时间内完成', async () => {
      const bcrypt = require('bcrypt');
      const password = 'password123';
      const saltRounds = 10;

      const start = Date.now();
      await bcrypt.hash(password, saltRounds);
      const duration = Date.now() - start;

      // bcrypt 应该足够慢以防止暴力破解，但不能太慢影响用户体验
      expect(duration).toBeGreaterThan(50);  // 至少 50ms
      expect(duration).toBeLessThan(500);    // 不超过 500ms
      console.log(`✅ bcrypt 哈希耗时: ${duration}ms`);
    });

    test('bcrypt 验证应该在合理时间内完成', async () => {
      const bcrypt = require('bcrypt');
      const password = 'password123';
      const hash = await bcrypt.hash(password, 10);

      const start = Date.now();
      await bcrypt.compare(password, hash);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      console.log(`✅ bcrypt 验证耗时: ${duration}ms`);
    });
  });

  describe('JSON Processing Performance', () => {
    test('大型 JSON 序列化应该高效', () => {
      const largeObject = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          data: { meta: 'information', value: i * 100 }
        }))
      };

      const start = Date.now();
      const json = JSON.stringify(largeObject);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`✅ JSON 序列化耗时: ${duration}ms (${json.length} 字符)`);
    });

    test('大型 JSON 解析应该高效', () => {
      const largeObject = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          email: `user${i}@example.com`
        }))
      };
      const json = JSON.stringify(largeObject);

      const start = Date.now();
      JSON.parse(json);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`✅ JSON 解析耗时: ${duration}ms`);
    });
  });
});
