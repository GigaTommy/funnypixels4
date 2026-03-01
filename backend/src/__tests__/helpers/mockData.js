/**
 * 测试用模拟数据
 * @module tests/helpers/mockData
 */

/**
 * 模拟用户数据
 * @returns {import('../../types/common').User}
 */
function createMockUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyMK5JgOXS72', // 'password123'
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    is_admin: false,
    avatar_url: null,
    ...overrides
  };
}

/**
 * 模拟像素数据
 * @returns {import('../../types/common').Pixel}
 */
function createMockPixel(overrides = {}) {
  return {
    id: 1,
    grid_id: 'grid_100_200',
    user_id: 1,
    color: '#FF0000',
    latitude: 40.7128,
    longitude: -74.0060,
    pattern_id: null,
    pattern_anchor_x: 0,
    pattern_anchor_y: 0,
    pattern_rotation: 0,
    pattern_mirror: false,
    pixel_type: 'basic',
    related_id: null,
    session_id: null,
    alliance_id: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides
  };
}

/**
 * 模拟联盟数据
 * @returns {import('../../types/common').Alliance}
 */
function createMockAlliance(overrides = {}) {
  return {
    id: 1,
    name: 'Test Alliance',
    description: 'A test alliance',
    color: '#0000FF',
    founder_id: 1,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides
  };
}

/**
 * 模拟 JWT 载荷
 * @returns {import('../../types/common').JWTPayload}
 */
function createMockJWTPayload(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  };
}

/**
 * 模拟 Express 请求对象
 */
function createMockRequest(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null,
    language: 'zh',
    ...overrides
  };
}

/**
 * 模拟 Express 响应对象
 */
function createMockResponse() {
  const res = {
    statusCode: 200,
    _data: null,
    _headers: {},
    status: jest.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function(data) {
      this._data = data;
      return this;
    }),
    send: jest.fn(function(data) {
      this._data = data;
      return this;
    }),
    setHeader: jest.fn(function(name, value) {
      this._headers[name] = value;
      return this;
    }),
    cookie: jest.fn(function() {
      return this;
    }),
    clearCookie: jest.fn(function() {
      return this;
    })
  };
  return res;
}

/**
 * 模拟 Next 函数
 */
function createMockNext() {
  return jest.fn();
}

module.exports = {
  createMockUser,
  createMockPixel,
  createMockAlliance,
  createMockJWTPayload,
  createMockRequest,
  createMockResponse,
  createMockNext
};
