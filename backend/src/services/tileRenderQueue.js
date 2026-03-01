const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const TileCacheService = require('./tileCacheService');
const prometheusMetrics = require('../monitoring/prometheusMetrics');

const TILE_RENDER_QUEUE = process.env.TILE_RENDER_QUEUE || 'tile-render-queue';

function createConnection() {
  // BullMQ 需要 ioredis 作为客户端
  // 使用与主 Redis 配置相同的参数
  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null,
    // Sentinel 配置（生产环境）
    sentinels: process.env.REDIS_SENTINEL_ENABLED === 'true'
      ? (process.env.REDIS_SENTINEL_HOSTS || 'localhost:26379').split(',').map(h => {
          const [host, port] = h.split(':');
          return { host, port: parseInt(port || '26379') };
        })
      : undefined,
    name: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
    enableReadyCheck: true,
    lazyConnect: false
  });
}

class TileRenderQueueService {
  constructor() {
    this.connection = createConnection();

    if (this.connection) {
      this.queue = new Queue(TILE_RENDER_QUEUE, {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }
      });
    } else {
      console.warn('⚠️ TileRenderQueue: 无法创建连接，瓦片渲染队列将被禁用');
      this.queue = null;
    }
    // BullMQ v4+ 不再需要单独的 QueueScheduler，调度功能已集成到 Queue 中
  }

  async enqueueTileRender({ tileId, z, x, y, priority = 5, reason = 'manual' }) {
    // 如果队列被禁用，直接返回
    if (!this.queue) {
      console.warn('⚠️ TileRenderQueue: 队列被禁用，跳过瓦片渲染任务');
      return { enqueued: false, alreadyRendering: false, disabled: true };
    }

    const dedupeKey = `${tileId}`;
    const acquired = await TileCacheService.markRendering(tileId);

    if (acquired) {
      try {
        await this.queue.add(
          'tile-render',
          { tileId, z, x, y, reason },
          {
            jobId: dedupeKey,
            priority,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 1000 }
          }
        );
      } catch (error) {
        await TileCacheService.clearRendering(tileId);
        throw error;
      }
    }

    if (this.queue) {
      const counts = await this.queue.getJobCounts();
      prometheusMetrics.updateQueueDepth(counts);
    }
    return { enqueued: acquired, alreadyRendering: !acquired };
  }

  async getQueueMetrics() {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const counts = await this.queue.getJobCounts();
    prometheusMetrics.updateQueueDepth(counts);
    return counts;
  }
}

module.exports = new TileRenderQueueService();
