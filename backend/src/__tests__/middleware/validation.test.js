/**
 * 验证中间件测试
 */

const { validate, validateMultiple } = require('../../middleware/validation');
const { createMockRequest, createMockResponse, createMockNext } = require('../helpers/mockData');
const Joi = require('joi');

describe('Validation Middleware', () => {
  describe('validate() - 单一数据源验证', () => {
    test('应该验证有效的请求体', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该拒绝无效的请求体', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const req = createMockRequest({
        body: {
          email: 'invalid-email',
          password: '123'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      const response = res._data;
      expect(response.success).toBe(false);
      expect(response.error).toBe('VALIDATION_ERROR');
      expect(response.details).toBeInstanceOf(Array);
      expect(response.details.length).toBeGreaterThan(0);
    });

    test('应该验证查询参数', () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).required(),
        limit: Joi.number().integer().min(1).max(100).required()
      });

      const req = createMockRequest({
        query: {
          page: '1',
          limit: '20'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // 应该自动转换类型
      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(20);
    });

    test('应该验证路径参数', () => {
      const schema = Joi.object({
        id: Joi.number().integer().positive().required()
      });

      const req = createMockRequest({
        params: {
          id: '123'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'params');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.params.id).toBe(123);
    });

    test('应该移除未知字段', () => {
      const schema = Joi.object({
        email: Joi.string().email().required()
      });

      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          unknownField: 'should be removed'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.email).toBe('test@example.com');
      expect(req.body.unknownField).toBeUndefined();
    });

    test('应该返回所有验证错误', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        age: Joi.number().min(18).required()
      });

      const req = createMockRequest({
        body: {
          email: 'invalid',
          password: '123',
          age: 10
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      const response = res._data;
      expect(response.details).toHaveLength(3);
    });
  });

  describe('validateMultiple() - 多数据源验证', () => {
    test('应该同时验证多个数据源', () => {
      const schemas = {
        body: Joi.object({
          name: Joi.string().required()
        }),
        query: Joi.object({
          page: Joi.number().integer().min(1).default(1)
        }),
        params: Joi.object({
          id: Joi.number().integer().positive().required()
        })
      };

      const req = createMockRequest({
        body: { name: 'Test' },
        query: { page: '2' },
        params: { id: '123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateMultiple(schemas);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Test');
      expect(req.query.page).toBe(2);
      expect(req.params.id).toBe(123);
    });

    test('应该收集所有数据源的错误', () => {
      const schemas = {
        body: Joi.object({
          email: Joi.string().email().required()
        }),
        query: Joi.object({
          page: Joi.number().integer().min(1).required()
        })
      };

      const req = createMockRequest({
        body: { email: 'invalid' },
        query: { page: '0' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateMultiple(schemas);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      const response = res._data;
      expect(response.details).toHaveLength(2);

      const sources = response.details.map(d => d.source);
      expect(sources).toContain('body');
      expect(sources).toContain('query');
    });

    test('应该在部分验证失败时仍处理成功的部分', () => {
      const schemas = {
        body: Joi.object({
          name: Joi.string().required()
        }),
        query: Joi.object({
          page: Joi.number().integer().min(1).required()
        })
      };

      const req = createMockRequest({
        body: { name: 'Valid' },
        query: { page: 'invalid' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validateMultiple(schemas);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      // body 应该被成功处理
      expect(req.body.name).toBe('Valid');
    });
  });

  describe('自动类型转换', () => {
    test('应该将字符串转换为数字', () => {
      const schema = Joi.object({
        age: Joi.number().integer().required()
      });

      const req = createMockRequest({
        body: { age: '25' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.age).toBe(25);
      expect(typeof req.body.age).toBe('number');
    });

    test('应该将字符串转换为布尔值', () => {
      const schema = Joi.object({
        active: Joi.boolean().required()
      });

      const req = createMockRequest({
        body: { active: 'true' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.active).toBe(true);
      expect(typeof req.body.active).toBe('boolean');
    });
  });

  describe('默认值', () => {
    test('应该应用默认值', () => {
      const schema = Joi.object({
        page: Joi.number().integer().default(1),
        limit: Joi.number().integer().default(20)
      });

      const req = createMockRequest({
        query: {}
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(20);
    });

    test('应该允许覆盖默认值', () => {
      const schema = Joi.object({
        page: Joi.number().integer().default(1)
      });

      const req = createMockRequest({
        query: { page: '5' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(5);
    });
  });

  describe('可选字段', () => {
    test('应该允许可选字段缺失', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        nickname: Joi.string().optional()
      });

      const req = createMockRequest({
        body: { email: 'test@example.com' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.email).toBe('test@example.com');
    });

    test('应该验证提供的可选字段', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        nickname: Joi.string().min(3).optional()
      });

      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          nickname: 'ab' // 太短
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = validate(schema, 'body');
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
