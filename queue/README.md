# 队列服务 (Queue)

基于 Bull Queue 的分布式任务队列系统，处理异步任务和后台作业。

## 技术栈

- **Bull Queue** - Redis-based队列系统
- **Node.js** - JavaScript运行时
- **TypeScript** - 类型安全
- **Redis** - 队列存储后端
- **Docker** - 容器化部署

## 目录结构

```
queue/
├── src/
│   ├── workers/             # 工作进程
│   ├── queues/              # 队列定义
│   └── handlers/            # 任务处理器
├── jobs/                    # 任务定义
├── processors/              # 任务处理器
├── package.json             # 依赖配置
├── tsconfig.json            # TypeScript配置
└── README.md                # 说明文档
```

## 队列设计

### 主要队列类型

#### 1. 像素处理队列 (pixel-processing)
- **任务类型**: 像素创建、更新、删除
- **优先级**: 高
- **并发数**: 10
- **重试策略**: 3次重试，指数退避

#### 2. 用户活动队列 (user-activity)
- **任务类型**: 用户行为记录、统计更新
- **优先级**: 中
- **并发数**: 5
- **重试策略**: 2次重试

#### 3. 数据同步队列 (data-sync)
- **任务类型**: 数据库同步、缓存更新
- **优先级**: 低
- **并发数**: 3
- **重试策略**: 5次重试

#### 4. 通知队列 (notifications)
- **任务类型**: 邮件通知、推送消息
- **优先级**: 中
- **并发数**: 2
- **重试策略**: 3次重试

## 任务处理器

### 像素处理任务

```typescript
// 像素创建任务
interface PixelCreateJob {
  gridId: string;
  lat: number;
  lng: number;
  color: string;
  userId: string;
  timestamp: number;
}

// 像素更新任务
interface PixelUpdateJob {
  pixelId: string;
  color: string;
  userId: string;
  timestamp: number;
}

// 像素删除任务
interface PixelDeleteJob {
  pixelId: string;
  userId: string;
  reason: string;
}
```

### 用户活动任务

```typescript
// 用户登录记录
interface UserLoginJob {
  userId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
}

// 用户行为统计
interface UserActivityJob {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any>;
}
```

### 数据同步任务

```typescript
// 缓存更新任务
interface CacheUpdateJob {
  cacheKey: string;
  data: any;
  ttl: number;
  operation: 'set' | 'delete' | 'invalidate';
}

// 数据库同步任务
interface DatabaseSyncJob {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  conditions?: Record<string, any>;
}
```

## 开发指南

### 安装依赖
```bash
npm install
```

### 启动队列服务
```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 监控队列
```bash
# 启动Bull Board监控界面
npm run monitor
```

## 队列配置

### 基础配置
```typescript
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};
```

### 队列特定配置
```typescript
// 像素处理队列 - 高优先级
const pixelQueue = new Queue('pixel-processing', {
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    priority: 1,
    attempts: 3,
  },
});

// 用户活动队列 - 中优先级
const userActivityQueue = new Queue('user-activity', {
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    priority: 5,
    attempts: 2,
  },
});
```

## 错误处理

### 任务失败处理
```typescript
pixelQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  
  // 记录错误日志
  logger.error('Queue job failed', {
    jobId: job.id,
    queueName: job.queue.name,
    error: err.message,
    data: job.data,
  });
  
  // 发送告警通知
  if (job.attemptsMade >= job.opts.attempts) {
    notifyAdmin('Queue job permanently failed', {
      jobId: job.id,
      queueName: job.queue.name,
      error: err.message,
    });
  }
});
```

### 重试策略
```typescript
const retryStrategies = {
  exponential: {
    type: 'exponential',
    delay: 2000,
  },
  fixed: {
    type: 'fixed',
    delay: 5000,
  },
  custom: (attemptsMade: number) => {
    return Math.min(attemptsMade * 1000, 10000);
  },
};
```

## 监控和指标

### Bull Board 监控
- 实时队列状态
- 任务执行情况
- 失败任务查看
- 队列性能指标

### 自定义指标
```typescript
// 任务处理时间
queue.on('completed', (job) => {
  const processingTime = Date.now() - job.timestamp;
  metrics.histogram('queue.processing_time', processingTime, {
    queue: job.queue.name,
    job_type: job.name,
  });
});

// 队列长度监控
setInterval(() => {
  queue.getJobCounts().then((counts) => {
    metrics.gauge('queue.job_count', counts.waiting, {
      queue: queue.name,
      status: 'waiting',
    });
  });
}, 30000);
```

## 部署配置

### Docker配置
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY node_modules ./node_modules

EXPOSE 3002
CMD ["node", "dist/index.js"]
```

### 环境变量
```bash
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
NODE_ENV=production
LOG_LEVEL=info
METRICS_PORT=9090
```
