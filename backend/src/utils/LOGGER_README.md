# Logger 模块使用指南

## 概述

这是一个基于 Pino 的统一日志管理模块，支持不同环境的日志输出格式和级别控制。

## 特性

- ✅ 使用 Pino 高性能日志库
- ✅ 支持 6 个日志级别：trace, debug, info, warn, error, fatal
- ✅ 开发环境彩色输出（pino-pretty）
- ✅ 生产环境 JSON 结构化输出
- ✅ 环境变量控制日志级别
- ✅ 自动隐藏 pid/hostname 信息

## 安装依赖

```bash
cd backend
npm install pino pino-pretty
```

## 基本用法

```javascript
import logger from './utils/logger.js';

// 基本日志
logger.info('用户登录成功', { userId: 123 });
logger.warn('Redis 连接超时', { host: 'localhost' });
logger.error('数据库查询失败', { error: err.message });
```

## 环境配置

### 开发环境
```bash
NODE_ENV=development LOG_LEVEL=debug node app.js
```

### 生产环境
```bash
NODE_ENV=production LOG_LEVEL=info node app.js
```

### 临时提高日志级别
```bash
LOG_LEVEL=debug pm2 restart pixelwar
```

## 日志级别说明

| 级别 | 数值 | 说明 |
|------|------|------|
| trace | 10 | 最详细的调试信息 |
| debug | 20 | 调试信息 |
| info  | 30 | 一般信息 |
| warn  | 40 | 警告信息 |
| error | 50 | 错误信息 |
| fatal | 60 | 致命错误 |

## 输出格式

### 开发环境
```
[2024-01-15 10:30:45.123] INFO: 用户登录成功
    userId: 123
    username: "testuser"
```

### 生产环境
```json
{"level":30,"time":1705294245123,"env":"production","msg":"用户登录成功","userId":123,"username":"testuser"}
```

## 使用示例

### 像素绘制日志
```javascript
logger.debug('进入像素绘制逻辑', { userId, pixelId });
logger.info('用户完成绘制', { userId, pixelId, color });
logger.warn('Redis 缓存未命中', { key: `pixel:${pixelId}` });
```

### 错误处理日志
```javascript
try {
  // 业务逻辑
} catch (error) {
  logger.error('像素写入数据库失败', { 
    error: error.message, 
    stack: error.stack,
    userId,
    pixelId 
  });
}
```

### 性能监控日志
```javascript
const start = Date.now();
// 执行操作
const duration = Date.now() - start;

if (duration > 1000) {
  logger.warn('操作耗时过长', { operation: 'pixelDraw', duration });
} else {
  logger.debug('操作完成', { operation: 'pixelDraw', duration });
}
```

## 最佳实践

1. **使用合适的日志级别**
   - `trace/debug`: 开发调试
   - `info`: 重要业务事件
   - `warn`: 需要关注但不影响运行
   - `error/fatal`: 错误和异常

2. **包含上下文信息**
   ```javascript
   // ✅ 好的做法
   logger.info('用户完成绘制', { userId, pixelId, color, timestamp });
   
   // ❌ 避免
   logger.info('用户完成绘制');
   ```

3. **避免敏感信息**
   ```javascript
   // ❌ 避免记录密码等敏感信息
   logger.info('用户登录', { username, password }); // 危险！
   
   // ✅ 安全的做法
   logger.info('用户登录', { username, loginTime });
   ```

4. **结构化日志**
   ```javascript
   // ✅ 使用对象传递结构化数据
   logger.error('API 调用失败', {
     endpoint: '/api/pixels',
     method: 'POST',
     statusCode: 500,
     responseTime: 1200,
     userId: 123
   });
   ```

## 测试

运行测试文件验证 logger 功能：

```bash
cd backend
node test-logger.js
```

## 注意事项

- 生产环境建议设置 `LOG_LEVEL=info` 或更高
- 开发环境可以使用 `LOG_LEVEL=debug` 查看详细信息
- 日志文件会自动根据环境变量调整格式
- 确保在生产环境中配置适当的日志轮转策略
