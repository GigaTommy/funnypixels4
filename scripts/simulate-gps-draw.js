#!/usr/bin/env node
'use strict';

const axios = require('axios');
const io = require('socket.io-client');

/* ================== 配置区域 ================== */
const CONFIG = {
  // 🔧 后端API配置 - 请根据你的实际环境修改
  BACKEND_API: 'http://localhost:3001/api/pixel-draw/gps', // GPS绘制接口
  SOCKET_URL: 'http://localhost:3001',                     // Socket.IO地址
  JWT: 'REPLACE_WITH_YOUR_JWT_TOKEN',                      // 替换为有效的JWT token
  TEST_USER: {
    username: 'bbb',
    password: 'bbbbbb'
  },
  
  // 🗺️ 坐标系统配置
  CONVERT_TO_GCJ02: true,      // 是否转换WGS84到GCJ02（高德地图坐标系）
  GRID_SIZE: 0.0001,           // 网格大小（度）- 与前端后端一致
  
  // 🎨 绘制参数
  PATTERN_ID: 1,               // 图案ID
  ANCHOR_X: 0,                 // 锚点X
  ANCHOR_Y: 0,                 // 锚点Y
  ROTATION: 0,                 // 旋转角度
  MIRROR: false,               // 是否镜像
  
  // ⏱️ 模拟参数
  INTERVAL_MS: 2000,           // 每个模拟点发送间隔（毫秒）
  SPEED_MPS: 1.5,              // 模拟移动速度（米/秒）
  RETRIES: 3,                  // 网络失败重试次数

  // 🎯 GPS绘制等待参数
  GRID_STAY_TIME: 2500,        // 在每个网格内停留时间（毫秒）- 超过500ms确保满足条件
  MIN_GRID_INTERVAL: 500,      // 最小网格间隔时间（毫秒）- 匹配GPS服务要求
  
  // 📊 调试配置
  LOG_VERBOSE: true,           // 详细日志
  SKIP_DUPLICATE_GRID: true,   // 跳过重复网格（避免重复绘制）
  ENABLE_SOCKET_LISTENER: true, // 启用WebSocket监听
};

/* ============ 示例测试路径 ============ 
   格式：[{ lat, lng }, ...] 
   脚本会在这些点之间插值生成连续轨迹
*/
const TEST_PATHS = {
  // 北京天安门附近小范围测试
  beijing_small: [
    { lat: 39.90923, lng: 116.397428 }, // 天安门
    { lat: 39.90945, lng: 116.398200 }, // 向东移动
    { lat: 39.90980, lng: 116.399000 }, // 继续向东
    { lat: 39.91020, lng: 116.399800 }, // 再向东
  ],
  
  // 上海外滩附近测试
  shanghai_bund: [
    { lat: 31.239663, lng: 121.499809 }, // 外滩
    { lat: 31.240000, lng: 121.500500 }, // 向北移动
    { lat: 31.240500, lng: 121.501200 }, // 继续向北
  ],
  
  // 深圳南山科技园测试
  shenzhen_nanshan: [
    { lat: 22.540503, lng: 113.934528 }, // 科技园
    { lat: 22.541000, lng: 113.935200 }, // 向北移动
    { lat: 22.541500, lng: 113.935800 }, // 继续向北
  ],
  
  // 自定义路径（可修改）
  custom: [
    { lat: 39.90923, lng: 116.397428 }, // 起点
    { lat: 39.90945, lng: 116.398200 }, // 终点
  ]
};

// 选择要使用的测试路径
const SELECTED_PATH = TEST_PATHS.beijing_small;

/* ============ 工具函数 ============ */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (...args) => {
  if (CONFIG.LOG_VERBOSE) {
    const timestamp = new Date().toISOString().substr(11, 12);
    console.log(`[${timestamp}]`, ...args);
  }
};

const logError = (...args) => {
  const timestamp = new Date().toISOString().substr(11, 12);
  console.error(`[${timestamp}] ❌`, ...args);
};

const logSuccess = (...args) => {
  const timestamp = new Date().toISOString().substr(11, 12);
  console.log(`[${timestamp}] ✅`, ...args);
};

/* ============ 距离计算 ============ */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ============ 轨迹插值 ============ */
function interpolatePoints(a, b, steps) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }
  return points;
}

/* ============ 网格对齐算法 ============ 
   与前端后端完全一致的网格计算
*/
function snapToGrid(lat, lng, gridSize = CONFIG.GRID_SIZE) {
  // 计算网格索引
  const gridX = Math.floor((lng + 180) / gridSize);
  const gridY = Math.floor((lat + 90) / gridSize);
  
  // 计算网格中心坐标
  const snappedLat = (gridY * gridSize) - 90 + (gridSize / 2);
  const snappedLng = (gridX * gridSize) - 180 + (gridSize / 2);
  
  // 生成网格ID - 与后端一致
  const gridId = `grid_${gridX}_${gridY}`;
  
  return { 
    lat: snappedLat, 
    lng: snappedLng, 
    gridId 
  };
}

/* ============ WGS84 -> GCJ-02 坐标转换 ============ */
const a = 6378245.0;
const ee = 0.00669342162296594323;

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLon(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLon = transformLon(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  const mgLat = lat + dLat;
  const mgLon = lng + dLon;
  return { lat: mgLat, lng: mgLon };
}

/* ============ 获取JWT Token ============ */
async function getJWTToken() {
  try {
    log('🔐 正在获取JWT token...');
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: CONFIG.TEST_USER.username,
      password: CONFIG.TEST_USER.password
    });
    
    if (response.data && response.data.tokens && response.data.tokens.accessToken) {
      log('✅ 登录成功，获取到accessToken');
      return response.data.tokens.accessToken;
    } else if (response.data && response.data.token) {
      log('✅ 登录成功，获取到token');
      return response.data.token;
    } else if (response.data && response.data.accessToken) {
      log('✅ 登录成功，获取到accessToken');
      return response.data.accessToken;
    } else {
      log('❌ 登录响应中没有token或accessToken');
      return null;
    }
  } catch (error) {
    log('❌ 登录失败:', error.response?.data?.error || error.message);
    return null;
  }
}

/* ============ HTTP 请求处理 ============ */
async function postDraw(payload, retries = CONFIG.RETRIES) {
  const headers = {
    'Authorization': `Bearer ${CONFIG.JWT}`,
    'Content-Type': 'application/json',
  };
  
  let attempt = 0;
  const start = Date.now();
  
  while (attempt <= retries) {
    try {
      log(`📤 发送绘制请求 (尝试 ${attempt + 1}/${retries + 1}):`, {
        lat: payload.lat.toFixed(6),
        lng: payload.lng.toFixed(6),
        gridId: payload.gridId
      });
      
      const response = await axios.post(CONFIG.BACKEND_API, payload, { 
        headers, 
        timeout: 10000 
      });
      
      const latency = Date.now() - start;
      return { 
        ok: true, 
        data: response.data, 
        status: response.status, 
        latency 
      };
      
    } catch (error) {
      attempt++;
      const errorMsg = error.response 
        ? `${error.response.status} ${error.response.data?.message || error.response.data?.error || ''}` 
        : error.message;
      
      logError(`POST请求失败 (尝试 ${attempt}/${retries + 1}):`, errorMsg);
      
      if (attempt > retries) {
        return { 
          ok: false, 
          error: errorMsg,
          status: error.response?.status || 0
        };
      }
      
      // 指数退避
      const delay = 500 * Math.pow(2, attempt - 1);
      log(`⏳ 等待 ${delay}ms 后重试...`);
      await sleep(delay);
    }
  }
}

/* ============ WebSocket 监听 ============ */
function startSocketListener() {
  if (!CONFIG.ENABLE_SOCKET_LISTENER || !CONFIG.SOCKET_URL || !CONFIG.JWT) {
    log('⚠️ WebSocket监听已禁用或配置不完整');
    return null;
  }
  
  log('🔌 正在连接WebSocket...');
  
  const socket = io(CONFIG.SOCKET_URL, {
    transports: ['websocket'],
    auth: { token: CONFIG.JWT },
    autoConnect: true,
    timeout: 10000,
  });

  socket.on('connect', () => {
    logSuccess('WebSocket连接成功:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    logError('WebSocket连接失败:', error.message || error);
  });
  
  socket.on('disconnect', (reason) => {
    log('🔌 WebSocket断开连接:', reason);
  });
  
  // 监听像素更新事件
  socket.on('pixelUpdate', (data) => {
    logSuccess('📡 收到像素更新广播:', {
      gridId: data.gridId,
      lat: data.lat?.toFixed(6),
      lng: data.lng?.toFixed(6),
      userId: data.userId,
      drawType: data.drawType,
      timestamp: new Date(data.timestamp).toLocaleTimeString()
    });
  });
  
  // 监听瓦片更新事件
  socket.on('tile_updated', (data) => {
    log('🗺️ 收到瓦片更新:', {
      tileId: data.tileId,
      pixelCount: data.pixelCount || 0,
      userId: data.userId || 'unknown'
    });
  });

  // 监听像素diff事件（瓦片房间）
  socket.on('pixel_diff', (data) => {
    log('🎨 收到像素diff（瓦片）:', {
      tileId: data.tileId,
      pixels: data.pixels?.length || 0,
      timestamp: new Date(data.timestamp).toLocaleTimeString()
    });
  });
  
  return socket;
}

/* ============ 主模拟逻辑 ============ */
async function runSimulation() {
  console.log('🚀 开始GPS绘制模拟测试');
  console.log('='.repeat(60));
  
  // 获取JWT token
  let jwtToken = CONFIG.JWT;
  if (jwtToken === 'REPLACE_WITH_YOUR_JWT_TOKEN') {
    jwtToken = await getJWTToken();
    if (!jwtToken) {
      logError('无法获取JWT token！');
      process.exit(1);
    }
    // 更新CONFIG中的JWT
    CONFIG.JWT = jwtToken;
  }
  
  if (SELECTED_PATH.length < 2) {
    logError('测试路径至少需要2个点！');
    process.exit(1);
  }
  
  // 启动WebSocket监听
  const socket = startSocketListener();
  
  // 等待WebSocket连接
  if (socket) {
    await new Promise((resolve) => {
      if (socket.connected) {
        resolve();
      } else {
        socket.on('connect', resolve);
        setTimeout(resolve, 3000); // 3秒超时
      }
    });
  }
  
  // 统计信息
  const metrics = {
    sent: 0,
    success: 0,
    failed: 0,
    totalLatency: 0,
    uniqueGrids: new Set(),
    errors: []
  };

  let lastGrid = null;
  let currentGridEntryTime = null;  // 当前网格进入时间
  
  console.log(`📍 开始模拟轨迹，共 ${SELECTED_PATH.length} 个路径点`);
  console.log(`⚙️ 配置: 间隔${CONFIG.INTERVAL_MS}ms, 速度${CONFIG.SPEED_MPS}m/s, 网格${CONFIG.GRID_SIZE}°`);
  console.log('-'.repeat(60));
  
  // 遍历路径段
  for (let i = 0; i < SELECTED_PATH.length - 1; i++) {
    const pointA = SELECTED_PATH[i];
    const pointB = SELECTED_PATH[i + 1];
    
    const distance = haversineDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const seconds = distance / (CONFIG.SPEED_MPS || 1);
    const steps = Math.max(1, Math.ceil((seconds * 1000) / CONFIG.INTERVAL_MS));
    
    log(`🛣️ 路径段 ${i + 1}: ${distance.toFixed(1)}m, ${seconds.toFixed(1)}s, ${steps}步`);
    
    const interpolatedPoints = interpolatePoints(pointA, pointB, steps);
    
    // 遍历插值点
    for (const point of interpolatedPoints) {
      // 坐标转换
      let sendLat = point.lat;
      let sendLng = point.lng;
      
      if (CONFIG.CONVERT_TO_GCJ02) {
        const converted = wgs84ToGcj02(point.lat, point.lng);
        sendLat = converted.lat;
        sendLng = converted.lng;
        log(`🔄 坐标转换: WGS84(${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}) -> GCJ02(${sendLat.toFixed(6)}, ${sendLng.toFixed(6)})`);
      }
      
      // 网格对齐
      const snapped = snapToGrid(sendLat, sendLng, CONFIG.GRID_SIZE);
      
      // 检查是否进入新网格
      const isNewGrid = snapped.gridId !== lastGrid;

      if (isNewGrid) {
        // 进入新网格，记录进入时间
        currentGridEntryTime = Date.now();
        lastGrid = snapped.gridId;
        metrics.uniqueGrids.add(snapped.gridId);
        log(`🆕 进入新网格: ${snapped.gridId}`);
      }

      // 确保在当前网格停留足够时间
      if (currentGridEntryTime) {
        const timeInGrid = Date.now() - currentGridEntryTime;
        const remainingWaitTime = Math.max(0, CONFIG.GRID_STAY_TIME - timeInGrid);

        if (remainingWaitTime > 0) {
          log(`⏳ 网格内等待: 还需等待 ${remainingWaitTime}ms (已停留 ${timeInGrid}ms)`);
          await sleep(remainingWaitTime);
        }

        log(`✅ 网格停留条件满足: ${snapped.gridId} (总计停留 ${Date.now() - currentGridEntryTime}ms)`);
      }

      // 构建请求载荷
      const payload = {
        lat: sendLat,
        lng: sendLng,
        patternId: CONFIG.PATTERN_ID,
        anchorX: CONFIG.ANCHOR_X,
        anchorY: CONFIG.ANCHOR_Y,
        rotation: CONFIG.ROTATION,
        mirror: CONFIG.MIRROR,
        gridId: snapped.gridId // 添加网格ID用于调试
      };

      // 发送绘制请求
      metrics.sent++;
      const result = await postDraw(payload);

      if (result.ok && result.data && result.data.success) {
        metrics.success++;
        metrics.totalLatency += result.latency || 0;
        logSuccess(`绘制成功: ${snapped.gridId} (${result.latency}ms)`, {
          pixel: result.data.data?.pixel?.id,
          remainingPoints: result.data.data?.consumptionResult?.remainingPoints
        });
      } else {
        metrics.failed++;
        const errorInfo = {
          gridId: snapped.gridId,
          error: result.error,
          status: result.status
        };
        metrics.errors.push(errorInfo);
        logError(`绘制失败: ${snapped.gridId}`, errorInfo);

        // 如果是"等待稳定"相关的错误，额外等待并重试
        if (result.error && result.error.includes('等待稳定')) {
          log(`🔄 检测到等待稳定错误，额外等待 ${CONFIG.MIN_GRID_INTERVAL}ms 后重试...`);
          await sleep(CONFIG.MIN_GRID_INTERVAL);

          // 重试一次
          log(`🔄 重试绘制: ${snapped.gridId}`);
          const retryResult = await postDraw(payload);
          if (retryResult.ok && retryResult.data && retryResult.data.success) {
            metrics.success++;
            logSuccess(`重试绘制成功: ${snapped.gridId}`);
          } else {
            logError(`重试绘制失败: ${snapped.gridId}`);
          }
        }
      }

      // 等待下一个点
      await sleep(CONFIG.INTERVAL_MS);
    }
  }
  
  // 输出统计结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 模拟测试完成 - 统计结果');
  console.log('='.repeat(60));
  console.log(`📤 总发送: ${metrics.sent}`);
  console.log(`✅ 成功: ${metrics.success}`);
  console.log(`❌ 失败: ${metrics.failed}`);
  console.log(`🎯 唯一网格: ${metrics.uniqueGrids.size}`);
  console.log(`⏱️ 平均延迟: ${metrics.success ? (metrics.totalLatency / metrics.success).toFixed(1) : '-'}ms`);
  console.log(`📈 成功率: ${metrics.sent ? ((metrics.success / metrics.sent) * 100).toFixed(1) : 0}%`);
  
  if (metrics.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    metrics.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.gridId}: ${error.error} (状态码: ${error.status})`);
    });
  }
  
  // 关闭WebSocket
  if (socket) {
    socket.close();
    log('🔌 WebSocket连接已关闭');
  }
  
  console.log('\n🎉 测试完成！');
  
  // 返回测试结果
  return {
    success: metrics.success > 0,
    metrics,
    hasErrors: metrics.errors.length > 0
  };
}

/* ============ 错误处理 ============ */
process.on('unhandledRejection', (reason, promise) => {
  logError('未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError('未捕获的异常:', error);
  process.exit(1);
});

/* ============ 启动脚本 ============ */
if (require.main === module) {
  runSimulation()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ 测试成功完成！');
        process.exit(0);
      } else {
        console.log('\n❌ 测试失败！');
        process.exit(1);
      }
    })
    .catch((error) => {
      logError('模拟测试崩溃:', error);
      process.exit(1);
    });
}

module.exports = {
  runSimulation,
  CONFIG,
  TEST_PATHS,
  snapToGrid,
  wgs84ToGcj02
};
