// @ts-check
/**
 * 依赖注入容器
 *
 * 简单但强大的依赖注入实现，支持：
 * - 单例服务（singleton）
 * - 工厂服务（factory）
 * - 值注入（value）
 * - 循环依赖检测
 * - 懒加载
 *
 * @example
 * ```javascript
 * const container = new Container();
 *
 * // 注册单例服务
 * container.singleton('db', () => require('../config/database').db);
 * container.singleton('logger', () => require('../utils/logger'));
 *
 * // 注册类服务
 * container.singleton('userService', (c) => {
 *   return new UserService(c.get('db'), c.get('logger'));
 * });
 *
 * // 获取服务
 * const userService = container.get('userService');
 * ```
 */
class Container {
  constructor() {
    /** @type {Map<string, {type: 'singleton'|'factory'|'value', factory: Function|any, instance?: any}>} */
    this._bindings = new Map();

    /** @type {Set<string>} */
    this._resolving = new Set();
  }

  /**
   * 注册单例服务（只创建一次）
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数，接收 container 作为参数
   * @returns {Container} 返回 this 支持链式调用
   */
  singleton(name, factory) {
    this._bindings.set(name, {
      type: 'singleton',
      factory
    });
    return this;
  }

  /**
   * 注册工厂服务（每次都创建新实例）
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数，接收 container 作为参数
   * @returns {Container} 返回 this 支持链式调用
   */
  factory(name, factory) {
    this._bindings.set(name, {
      type: 'factory',
      factory
    });
    return this;
  }

  /**
   * 注册值（常量、配置等）
   * @param {string} name - 值名称
   * @param {any} value - 值
   * @returns {Container} 返回 this 支持链式调用
   */
  value(name, value) {
    this._bindings.set(name, {
      type: 'value',
      factory: value
    });
    return this;
  }

  /**
   * 获取服务
   * @param {string} name - 服务名称
   * @returns {any} 服务实例
   * @throws {Error} 如果服务未注册或发生循环依赖
   */
  get(name) {
    const binding = this._bindings.get(name);

    if (!binding) {
      throw new Error(`服务未注册: ${name}`);
    }

    // 值类型直接返回
    if (binding.type === 'value') {
      return binding.factory;
    }

    // 单例类型：检查是否已创建实例
    if (binding.type === 'singleton' && binding.instance) {
      return binding.instance;
    }

    // 检测循环依赖
    if (this._resolving.has(name)) {
      throw new Error(`检测到循环依赖: ${Array.from(this._resolving).join(' -> ')} -> ${name}`);
    }

    try {
      this._resolving.add(name);

      // 调用工厂函数创建实例
      const instance = binding.factory(this);

      // 单例类型：缓存实例
      if (binding.type === 'singleton') {
        binding.instance = instance;
      }

      return instance;
    } catch (error) {
      throw new Error(`创建服务 ${name} 时出错: ${error.message}`);
    } finally {
      this._resolving.delete(name);
    }
  }

  /**
   * 检查服务是否已注册
   * @param {string} name - 服务名称
   * @returns {boolean}
   */
  has(name) {
    return this._bindings.has(name);
  }

  /**
   * 清除所有服务（主要用于测试）
   */
  clear() {
    this._bindings.clear();
    this._resolving.clear();
  }

  /**
   * 清除单例实例（保留注册，但清除缓存的实例）
   * 主要用于测试时重置状态
   */
  clearInstances() {
    for (const [name, binding] of this._bindings) {
      if (binding.type === 'singleton') {
        delete binding.instance;
      }
    }
  }

  /**
   * 获取所有已注册的服务名称
   * @returns {string[]}
   */
  getRegisteredServices() {
    return Array.from(this._bindings.keys());
  }
}

module.exports = Container;
