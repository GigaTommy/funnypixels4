/**
 * i18n 工具函数测试
 */

const {
  t,
  getTranslator,
  createErrorResponse,
  createSuccessResponse,
  errors,
  success
} = require('../../utils/i18n');
const { createMockRequest } = require('../helpers/mockData');

describe('i18n Utils', () => {
  describe('t() - 基础翻译函数', () => {
    test('应该翻译中文错误消息', () => {
      const result = t('errors:common.internalServerError', 'zh');
      expect(result).toBe('服务器内部错误');
    });

    test('应该翻译英文错误消息', () => {
      const result = t('errors:common.internalServerError', 'en');
      expect(result).toBe('Internal server error');
    });

    test('应该支持插值', () => {
      const result = t('errors:rateLimit.tooManyRequests', 'zh', { retryAfter: 60 });
      expect(result).toContain('60');
      expect(result).toContain('秒后再试');
    });

    test('应该使用默认语言（中文）', () => {
      const result = t('errors:common.notFound');
      expect(result).toBe('资源未找到');
    });
  });

  describe('getTranslator() - 从请求获取翻译器', () => {
    test('应该从请求的 language 属性获取语言', () => {
      const req = createMockRequest({ language: 'en' });
      const translator = getTranslator(req);
      const result = translator('errors:common.notFound');
      expect(result).toBe('Resource not found');
    });

    test('应该从 Accept-Language 头获取语言', () => {
      const req = createMockRequest({
        headers: { 'accept-language': 'en-US,en;q=0.9' }
      });
      const translator = getTranslator(req);
      const result = translator('errors:common.notFound');
      expect(result).toBe('Resource not found');
    });

    test('应该使用默认语言当没有语言信息时', () => {
      const req = createMockRequest({});
      const translator = getTranslator(req);
      const result = translator('errors:common.notFound');
      expect(result).toBe('资源未找到');
    });

    test('翻译器应该支持插值', () => {
      const req = createMockRequest({ language: 'zh' });
      const translator = getTranslator(req);
      const result = translator('errors:rateLimit.tooManyRequests', { retryAfter: 30 });
      expect(result).toContain('30');
    });
  });

  describe('createErrorResponse() - 创建错误响应', () => {
    test('应该创建标准错误响应', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = createErrorResponse(req, 'common.notFound', 404);

      expect(response).toEqual({
        success: false,
        error: 'COMMON_NOT_FOUND',
        message: '资源未找到',
        statusCode: 404
      });
    });

    test('应该使用默认状态码 400', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = createErrorResponse(req, 'common.badRequest');

      expect(response.statusCode).toBe(400);
    });

    test('应该支持插值选项', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = createErrorResponse(
        req,
        'rateLimit.tooManyRequests',
        429,
        { retryAfter: 60 }
      );

      expect(response.statusCode).toBe(429);
      expect(response.message).toContain('60');
    });

    test('应该根据请求语言返回相应翻译', () => {
      const reqZh = createMockRequest({ language: 'zh' });
      const reqEn = createMockRequest({ language: 'en' });

      const responseZh = createErrorResponse(reqZh, 'auth.invalidCredentials', 401);
      const responseEn = createErrorResponse(reqEn, 'auth.invalidCredentials', 401);

      expect(responseZh.message).toBe('用户名或密码错误');
      expect(responseEn.message).toBe('Invalid username or password');
    });
  });

  describe('createSuccessResponse() - 创建成功响应', () => {
    test('应该创建不带数据的成功响应', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = createSuccessResponse(req, 'auth.logoutSuccess');

      expect(response).toEqual({
        success: true,
        message: '登出成功'
      });
    });

    test('应该创建带数据的成功响应', () => {
      const req = createMockRequest({ language: 'zh' });
      const data = { user: { id: 1, email: 'test@example.com' } };
      const response = createSuccessResponse(req, 'auth.loginSuccess', data);

      expect(response).toEqual({
        success: true,
        message: '登录成功',
        data
      });
    });

    test('应该支持插值选项', () => {
      const req = createMockRequest({ language: 'zh' });
      const pixels = [{}, {}, {}];
      const response = createSuccessResponse(
        req,
        'pixel.batchCreated',
        pixels,
        { count: pixels.length }
      );

      expect(response.message).toContain('3');
    });

    test('应该根据请求语言返回相应翻译', () => {
      const reqZh = createMockRequest({ language: 'zh' });
      const reqEn = createMockRequest({ language: 'en' });

      const responseZh = createSuccessResponse(reqZh, 'auth.loginSuccess');
      const responseEn = createSuccessResponse(reqEn, 'auth.loginSuccess');

      expect(responseZh.message).toBe('登录成功');
      expect(responseEn.message).toBe('Login successful');
    });
  });

  describe('errors - 快捷错误方法', () => {
    test('internalServerError 应该返回 500 错误', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = errors.internalServerError(req);

      expect(response.statusCode).toBe(500);
      expect(response.error).toBe('COMMON_INTERNAL_SERVER_ERROR');
      expect(response.success).toBe(false);
    });

    test('notFound 应该返回 404 错误', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = errors.notFound(req);

      expect(response.statusCode).toBe(404);
      expect(response.error).toBe('COMMON_NOT_FOUND');
    });

    test('unauthorized 应该返回 401 错误', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = errors.unauthorized(req);

      expect(response.statusCode).toBe(401);
      expect(response.error).toBe('COMMON_UNAUTHORIZED');
    });

    test('invalidCredentials 应该返回正确的认证错误', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = errors.invalidCredentials(req);

      expect(response.statusCode).toBe(401);
      expect(response.error).toBe('AUTH_INVALID_CREDENTIALS');
      expect(response.message).toBe('用户名或密码错误');
    });

    test('tooManyRequests 应该支持自定义重试时间', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = errors.tooManyRequests(req, 120);

      expect(response.statusCode).toBe(429);
      expect(response.message).toContain('120');
    });
  });

  describe('success - 快捷成功方法', () => {
    test('loginSuccess 应该返回登录成功消息', () => {
      const req = createMockRequest({ language: 'zh' });
      const data = { token: 'xyz' };
      const response = success.loginSuccess(req, data);

      expect(response.success).toBe(true);
      expect(response.message).toBe('登录成功');
      expect(response.data).toEqual(data);
    });

    test('pixelCreated 应该返回像素创建成功消息', () => {
      const req = createMockRequest({ language: 'zh' });
      const pixel = { id: 1, color: '#FF0000' };
      const response = success.pixelCreated(req, pixel);

      expect(response.success).toBe(true);
      expect(response.message).toBe('像素创建成功');
      expect(response.data).toEqual(pixel);
    });

    test('logoutSuccess 应该返回不带数据的成功响应', () => {
      const req = createMockRequest({ language: 'zh' });
      const response = success.logoutSuccess(req);

      expect(response.success).toBe(true);
      expect(response.message).toBe('登出成功');
      expect(response.data).toBeUndefined();
    });
  });

  describe('多语言支持', () => {
    test('所有错误消息应该在中英文版本中都存在', () => {
      const req = createMockRequest();
      const errorKeys = [
        'internalServerError',
        'notFound',
        'unauthorized',
        'forbidden',
        'invalidCredentials',
        'emailNotFound'
      ];

      errorKeys.forEach(key => {
        const errorFn = errors[key];
        if (errorFn) {
          req.language = 'zh';
          const zhResponse = errorFn(req);
          expect(zhResponse.message).toBeTruthy();
          expect(zhResponse.message).not.toContain('undefined');

          req.language = 'en';
          const enResponse = errorFn(req);
          expect(enResponse.message).toBeTruthy();
          expect(enResponse.message).not.toContain('undefined');
        }
      });
    });

    test('所有成功消息应该在中英文版本中都存在', () => {
      const req = createMockRequest();
      const successKeys = [
        'loginSuccess',
        'registerSuccess',
        'logoutSuccess',
        'pixelCreated'
      ];

      successKeys.forEach(key => {
        const successFn = success[key];
        if (successFn) {
          req.language = 'zh';
          const zhResponse = successFn(req, null);
          expect(zhResponse.message).toBeTruthy();
          expect(zhResponse.message).not.toContain('undefined');

          req.language = 'en';
          const enResponse = successFn(req, null);
          expect(enResponse.message).toBeTruthy();
          expect(enResponse.message).not.toContain('undefined');
        }
      });
    });
  });
});
