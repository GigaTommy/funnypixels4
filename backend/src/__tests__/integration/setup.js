/**
 * 集成测试环境设置
 */

const { db } = require('../../config/database');
const { initializeRedis, closeRedis } = require('../../config/redis');

/**
 * 测试数据库设置
 */
let testDb;

/**
 * 在所有集成测试前运行
 */
async function setupTestEnvironment() {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-testing-32chars';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-integration-32chars';

  // 初始化测试数据库连接
  try {
    // 检查数据库连接
    await db.raw('SELECT 1');
    console.log('✅ 测试数据库连接成功');
  } catch (error) {
    console.warn('⚠️ 测试数据库连接失败，某些测试可能会跳过:', error.message);
  }

  // 初始化 Redis（可选）
  try {
    await initializeRedis();
    console.log('✅ 测试 Redis 连接成功');
  } catch (error) {
    console.warn('⚠️ 测试 Redis 连接失败，某些测试可能会跳过:', error.message);
  }
}

/**
 * 在所有集成测试后运行
 */
async function teardownTestEnvironment() {
  // 关闭数据库连接
  if (db) {
    await db.destroy();
    console.log('✅ 测试数据库连接已关闭');
  }

  // 关闭 Redis 连接
  try {
    await closeRedis();
    console.log('✅ 测试 Redis 连接已关闭');
  } catch (error) {
    console.warn('⚠️ 关闭 Redis 连接失败:', error.message);
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  try {
    // 清理测试用户数据（保留真实数据）
    await db('users').where('email', 'like', 'test%@test.com').del();

    // 清理测试像素数据
    await db('pixels').where('grid_id', 'like', 'test_%').del();

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.warn('⚠️ 清理测试数据失败:', error.message);
  }
}

/**
 * 创建测试用户
 */
async function createTestUser(userData = {}) {
  const bcrypt = require('bcrypt');
  const defaultUser = {
    email: 'test@test.com',
    username: 'testuser',
    display_name: 'Test User',
    password_hash: await bcrypt.hash('password123', 10),
    created_at: new Date(),
    updated_at: new Date()
  };

  const [user] = await db('users')
    .insert({ ...defaultUser, ...userData })
    .returning('*');

  return user;
}

/**
 * 生成测试 JWT Token
 */
function generateTestToken(userId) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: userId, email: 'test@test.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  cleanupTestData,
  createTestUser,
  generateTestToken,
  db
};
