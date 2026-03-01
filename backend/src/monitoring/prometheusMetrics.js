const client = require('prom-client');

// 收集默认指标（CPU、内存等）
client.collectDefaultMetrics();

// HTTP请求指标
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP请求响应时间（秒）',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5] // 10ms, 50ms, 100ms, 500ms, 1s, 2s, 5s
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP请求总数',
  labelNames: ['method', 'route', 'status_code']
});

// 瓦片渲染指标
const tileRenderDuration = new client.Histogram({
  name: 'tile_render_duration_seconds',
  help: 'Duration of tile rendering jobs',
  labelNames: ['zoom']
});

const tileCacheCounter = new client.Counter({
  name: 'tile_cache_events_total',
  help: 'Tile cache hits and misses by layer',
  labelNames: ['layer', 'status']
});

const tileQueueGauge = new client.Gauge({
  name: 'tile_render_queue_depth',
  help: 'Current depth of the tile render queue by job state',
  labelNames: ['state']
});

module.exports = {
  register: client.register,

  // HTTP请求跟踪
  recordHttpRequest(method, route, statusCode, durationMs) {
    const labels = {
      method,
      route: route || 'unknown',
      status_code: String(statusCode)
    };
    httpRequestDuration.observe(labels, durationMs / 1000);
    httpRequestTotal.inc(labels);
  },

  // 瓦片渲染跟踪
  recordTileRenderDuration(zoom, durationMs) {
    tileRenderDuration.observe({ zoom: String(zoom) }, durationMs / 1000);
  },
  recordTileCacheHit(layer, hit) {
    tileCacheCounter.inc({ layer, status: hit ? 'hit' : 'miss' });
  },
  updateQueueDepth(counts) {
    tileQueueGauge.set({ state: 'waiting' }, counts.waiting || 0);
    tileQueueGauge.set({ state: 'active' }, counts.active || 0);
    tileQueueGauge.set({ state: 'delayed' }, counts.delayed || 0);
    tileQueueGauge.set({ state: 'failed' }, counts.failed || 0);
  }
};
