/**
 * Jest 测试环境设置
 * 在所有测试运行前执行
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-32';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'funnypixels_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// 设置全局超时
jest.setTimeout(10000);

// 全局测试钩子
beforeAll(() => {
  // 在所有测试开始前执行
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  // 在所有测试结束后执行
  console.log('✅ Test suite completed');
});

// 全局错误处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in test:', error);
});
