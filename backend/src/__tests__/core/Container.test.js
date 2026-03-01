/**
 * 依赖注入容器测试
 */

const Container = require('../../core/Container');

describe('Container', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(() => {
    container.clear();
  });

  describe('singleton()', () => {
    test('应该注册单例服务', () => {
      let createCount = 0;

      container.singleton('testService', () => {
        createCount++;
        return { name: 'Test Service' };
      });

      const service1 = container.get('testService');
      const service2 = container.get('testService');

      // 应该只创建一次
      expect(createCount).toBe(1);
      // 应该返回同一个实例
      expect(service1).toBe(service2);
      expect(service1.name).toBe('Test Service');
    });

    test('应该支持链式调用', () => {
      const result = container
        .singleton('service1', () => ({ name: 'Service 1' }))
        .singleton('service2', () => ({ name: 'Service 2' }));

      expect(result).toBe(container);
      expect(container.has('service1')).toBe(true);
      expect(container.has('service2')).toBe(true);
    });

    test('应该将容器传递给工厂函数', () => {
      container.singleton('logger', () => ({ log: jest.fn() }));
      container.singleton('userService', (c) => {
        const logger = c.get('logger');
        return { logger, findUser: jest.fn() };
      });

      const userService = container.get('userService');
      const logger = container.get('logger');

      expect(userService.logger).toBe(logger);
    });
  });

  describe('factory()', () => {
    test('应该每次创建新实例', () => {
      let createCount = 0;

      container.factory('requestContext', () => {
        createCount++;
        return { id: Math.random() };
      });

      const ctx1 = container.get('requestContext');
      const ctx2 = container.get('requestContext');

      // 应该创建两次
      expect(createCount).toBe(2);
      // 应该是不同的实例
      expect(ctx1).not.toBe(ctx2);
      expect(ctx1.id).not.toBe(ctx2.id);
    });
  });

  describe('value()', () => {
    test('应该注册值', () => {
      const config = {
        appName: 'FunnyPixels',
        version: '1.0.0'
      };

      container.value('config', config);

      const retrievedConfig = container.get('config');
      expect(retrievedConfig).toBe(config);
      expect(retrievedConfig.appName).toBe('FunnyPixels');
    });

    test('应该直接返回值而不调用工厂函数', () => {
      const mockFn = jest.fn();
      container.value('constant', mockFn);

      const result = container.get('constant');

      // 应该返回函数本身，而不是调用它
      expect(result).toBe(mockFn);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('get()', () => {
    test('应该获取已注册的服务', () => {
      container.singleton('testService', () => ({ name: 'Test' }));

      const service = container.get('testService');
      expect(service.name).toBe('Test');
    });

    test('应该在服务未注册时抛出错误', () => {
      expect(() => {
        container.get('nonexistentService');
      }).toThrow('服务未注册: nonexistentService');
    });

    test('应该检测循环依赖', () => {
      container.singleton('serviceA', (c) => {
        return { serviceB: c.get('serviceB') };
      });

      container.singleton('serviceB', (c) => {
        return { serviceA: c.get('serviceA') };
      });

      expect(() => {
        container.get('serviceA');
      }).toThrow(/检测到循环依赖/);
    });

    test('应该在工厂函数出错时提供有用的错误信息', () => {
      container.singleton('buggyService', () => {
        throw new Error('Something went wrong');
      });

      expect(() => {
        container.get('buggyService');
      }).toThrow('创建服务 buggyService 时出错: Something went wrong');
    });
  });

  describe('has()', () => {
    test('应该检查服务是否已注册', () => {
      container.singleton('testService', () => ({ name: 'Test' }));

      expect(container.has('testService')).toBe(true);
      expect(container.has('nonexistent')).toBe(false);
    });
  });

  describe('clear()', () => {
    test('应该清除所有服务', () => {
      container.singleton('service1', () => ({ name: 'Service 1' }));
      container.singleton('service2', () => ({ name: 'Service 2' }));

      expect(container.has('service1')).toBe(true);
      expect(container.has('service2')).toBe(true);

      container.clear();

      expect(container.has('service1')).toBe(false);
      expect(container.has('service2')).toBe(false);
    });
  });

  describe('clearInstances()', () => {
    test('应该清除单例实例但保留注册', () => {
      let createCount = 0;

      container.singleton('testService', () => {
        createCount++;
        return { name: 'Test', count: createCount };
      });

      // 第一次获取
      const service1 = container.get('testService');
      expect(service1.count).toBe(1);

      // 第二次获取（应该是缓存的实例）
      const service2 = container.get('testService');
      expect(service2.count).toBe(1);
      expect(service2).toBe(service1);

      // 清除实例
      container.clearInstances();

      // 第三次获取（应该重新创建）
      const service3 = container.get('testService');
      expect(service3.count).toBe(2);
      expect(service3).not.toBe(service1);

      // 服务应该仍然注册
      expect(container.has('testService')).toBe(true);
    });

    test('不应该影响工厂服务', () => {
      let createCount = 0;

      container.factory('factoryService', () => {
        createCount++;
        return { count: createCount };
      });

      container.get('factoryService');
      container.get('factoryService');

      expect(createCount).toBe(2);

      container.clearInstances();

      container.get('factoryService');
      expect(createCount).toBe(3);
    });

    test('不应该影响值', () => {
      const config = { appName: 'Test' };
      container.value('config', config);

      const config1 = container.get('config');
      container.clearInstances();
      const config2 = container.get('config');

      expect(config1).toBe(config);
      expect(config2).toBe(config);
      expect(config1).toBe(config2);
    });
  });

  describe('getRegisteredServices()', () => {
    test('应该返回所有已注册的服务名称', () => {
      container.singleton('service1', () => ({}));
      container.factory('service2', () => ({}));
      container.value('config', {});

      const services = container.getRegisteredServices();

      expect(services).toContain('service1');
      expect(services).toContain('service2');
      expect(services).toContain('config');
      expect(services.length).toBe(3);
    });

    test('应该在容器为空时返回空数组', () => {
      const services = container.getRegisteredServices();
      expect(services).toEqual([]);
    });
  });

  describe('复杂依赖场景', () => {
    test('应该处理多层依赖', () => {
      container.singleton('db', () => ({ query: jest.fn() }));
      container.singleton('logger', () => ({ log: jest.fn() }));

      container.singleton('userRepository', (c) => {
        return {
          db: c.get('db'),
          findById: jest.fn()
        };
      });

      container.singleton('userService', (c) => {
        return {
          repository: c.get('userRepository'),
          logger: c.get('logger'),
          getUser: jest.fn()
        };
      });

      const userService = container.get('userService');
      const db = container.get('db');

      expect(userService.repository.db).toBe(db);
      expect(userService.logger).toBeDefined();
    });

    test('应该支持可选依赖', () => {
      container.singleton('optionalService', (c) => {
        // 使用 has() 检查可选依赖
        const cache = c.has('cache') ? c.get('cache') : null;
        return { cache };
      });

      // 没有注册 cache
      const service1 = container.get('optionalService');
      expect(service1.cache).toBeNull();

      // 注册 cache
      container.singleton('cache', () => ({ get: jest.fn() }));

      // 清除实例以重新创建
      container.clearInstances();

      const service2 = container.get('optionalService');
      expect(service2.cache).toBeDefined();
      expect(service2.cache.get).toBeDefined();
    });
  });

  describe('真实使用场景', () => {
    test('应该模拟真实的服务依赖关系', () => {
      // 注册基础设施
      container.singleton('db', () => ({
        query: jest.fn().mockResolvedValue([{ id: 1, name: 'Test' }])
      }));

      container.singleton('redis', () => ({
        get: jest.fn(),
        set: jest.fn()
      }));

      container.singleton('logger', () => ({
        info: jest.fn(),
        error: jest.fn()
      }));

      // 注册服务
      container.singleton('cacheService', (c) => {
        const redis = c.get('redis');
        const logger = c.get('logger');

        return {
          get: async (key) => {
            logger.info(`Cache get: ${key}`);
            return await redis.get(key);
          },
          set: async (key, value) => {
            logger.info(`Cache set: ${key}`);
            return await redis.set(key, value);
          }
        };
      });

      container.singleton('userService', (c) => {
        const db = c.get('db');
        const cache = c.get('cacheService');
        const logger = c.get('logger');

        return {
          findById: async (id) => {
            logger.info(`Finding user: ${id}`);
            const cached = await cache.get(`user:${id}`);
            if (cached) return cached;

            const users = await db.query(`SELECT * FROM users WHERE id = ${id}`);
            if (users[0]) {
              await cache.set(`user:${id}`, users[0]);
            }
            return users[0];
          }
        };
      });

      // 使用服务
      const userService = container.get('userService');
      expect(userService.findById).toBeDefined();

      // 验证依赖注入正确
      const logger = container.get('logger');
      const redis = container.get('redis');

      expect(logger.info).toBeDefined();
      expect(redis.get).toBeDefined();
    });
  });
});
