const path = require('path');
const { Worker } = require('bullmq');
const { Worker: ThreadWorker } = require('worker_threads');
const IORedis = require('ioredis');
const TileSnapshotService = require('../services/tileSnapshotService');
const TileCacheService = require('../services/tileCacheService');
const prometheusMetrics = require('../monitoring/prometheusMetrics');
const performanceMetrics = require('../monitoring/performanceMetrics');

const TILE_RENDER_QUEUE = process.env.TILE_RENDER_QUEUE || 'tile-render-queue';
const WORKER_CONCURRENCY = parseInt(process.env.TILE_RENDER_WORKER_CONCURRENCY || '2', 10);

function createConnection() {
  // BullMQ Worker 需要 ioredis 作为客户端
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

function runThread({ z, x, y, format }) {
  return new Promise((resolve, reject) => {
    const worker = new ThreadWorker(path.join(__dirname, 'renderer', 'tileRendererThread.js'), {
      workerData: { z, x, y, format }
    });
    let settled = false;

    worker.once('message', message => {
      if (message.error) {
        settled = true;
        worker.terminate().finally(() => reject(new Error(message.error)));
      } else {
        settled = true;
        worker.terminate().finally(() => {
          resolve({
            buffer: Buffer.from(message.buffer, 'base64'),
            renderTimeMs: message.renderTimeMs,
            materialVersions: message.materialVersions || {}
          });
        });
      }
    });

    worker.once('error', error => {
      if (settled) {
        return;
      }
      settled = true;
      worker.terminate().finally(() => reject(error));
    });

    worker.once('exit', code => {
      if (!settled && code !== 0) {
        reject(new Error(`Renderer thread exited with code ${code}`));
      }
    });
  });
}

const worker = new Worker(
  TILE_RENDER_QUEUE,
  async job => {
    const { z, x, y, tileId: providedTileId, format = 'image/png' } = job.data;
    const tileId = providedTileId || `${z}/${x}/${y}`;

    const { buffer, renderTimeMs, materialVersions } = await runThread({ z, x, y, format });

    const snapshot = await TileSnapshotService.createSnapshot({
      tileId,
      zoom: z,
      buffer,
      format,
      renderTimeMs,
      materialVersions
    });

    const metadata = TileSnapshotService.toMetadata(snapshot);
    await TileCacheService.setTile(tileId, buffer, metadata);

    await TileCacheService.clearRendering(tileId);

    performanceMetrics.recordTileRenderTime(tileId, renderTimeMs);
    prometheusMetrics.recordTileRenderDuration(z, renderTimeMs);

    return {
      tileId,
      version: snapshot.version,
      renderTimeMs,
      size: buffer.length
    };
  },
  {
    connection: createConnection(),
    concurrency: WORKER_CONCURRENCY
  }
);

worker.on('completed', async job => {
  const counts = await job.queue.getJobCounts();
  prometheusMetrics.updateQueueDepth(counts);
});

worker.on('failed', async (job, error) => {
  console.error('Tile render job failed', { tileId: job?.data?.tileId, error: error?.message });
  await TileCacheService.clearRendering(job?.data?.tileId);
  const counts = await job.queue.getJobCounts();
  prometheusMetrics.updateQueueDepth(counts);
});

console.log(`🚀 Tile render worker started. Queue: ${TILE_RENDER_QUEUE}, concurrency: ${WORKER_CONCURRENCY}`);

process.on('SIGINT', async () => {
  console.log('🛑 Stopping tile render worker (SIGINT)');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Stopping tile render worker (SIGTERM)');
  await worker.close();
  process.exit(0);
});
