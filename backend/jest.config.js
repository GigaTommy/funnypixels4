/**
 * Jest 配置
 * @type {import('jest').Config}
 */
module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],

  // 覆盖率收集
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!src/server.js',
    '!src/types/**',
    '!**/node_modules/**'
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html'],

  // 测试超时（毫秒）
  testTimeout: 10000,

  // 设置文件（在每个测试文件运行前执行）
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],

  // 清除模拟
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // 详细输出
  verbose: true,

  // 模块路径别名
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/src/__tests__/$1'
  },

  // 忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(supertest)/)'
  ]
};
