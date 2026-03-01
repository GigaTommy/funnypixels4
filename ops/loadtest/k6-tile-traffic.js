import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://api.funnypixels.local';
const WRITE_URL = __ENV.WRITE_URL || `${BASE_URL}/api/tiles`;

const readLatency = new Trend('tile_read_latency', true);
const writeLatency = new Trend('tile_write_latency', true);
const readFailures = new Counter('tile_read_failures');
const writeFailures = new Counter('tile_write_failures');

export const options = {
  scenarios: {
    tile_reads: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.READ_QPS || 100000),
      timeUnit: '1s',
      duration: __ENV.TEST_DURATION || '5m',
      preAllocatedVUs: Number(__ENV.READ_VUS || 2000),
      maxVUs: Number(__ENV.MAX_READ_VUS || 4000)
    },
    tile_writes: {
      executor: 'constant-arrival-rate',
      startTime: '10s',
      rate: Number(__ENV.WRITE_QPS || 10000),
      timeUnit: '1s',
      duration: __ENV.TEST_DURATION || '5m',
      preAllocatedVUs: Number(__ENV.WRITE_VUS || 500),
      maxVUs: Number(__ENV.MAX_WRITE_VUS || 1000)
    }
  },
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
    tile_read_latency: ['p(99)<180', 'avg<100'],
    tile_write_latency: ['p(99)<180', 'avg<120']
  },
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max']
};

function buildTilePath() {
  const z = Math.floor(Math.random() * 5) + 10; // zoom 10-14
  const x = Math.floor(Math.random() * 1024);
  const y = Math.floor(Math.random() * 1024);
  return `${BASE_URL}/api/tiles/${z}/${x}/${y}.png`;
}

function buildWritePayload() {
  return JSON.stringify({
    tileId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: Math.floor(Math.random() * 1024),
    y: Math.floor(Math.random() * 1024),
    color: Math.floor(Math.random() * 256),
    userId: `perf-${Math.random().toString(36).slice(2, 10)}`,
    checksum: Math.random().toString(36).slice(2, 10)
  });
}

export function tile_reads() {
  const url = buildTilePath();
  const res = http.get(url, { tags: { endpoint: 'tile_read' } });

  if (!check(res, { 'status is 200': r => r.status === 200 })) {
    readFailures.add(1);
  }

  readLatency.add(res.timings.duration);
  sleep(0); // allow scheduler to progress
}

export function tile_writes() {
  const payload = buildWritePayload();
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: __ENV.WRITE_BEARER ? `Bearer ${__ENV.WRITE_BEARER}` : undefined
    },
    tags: { endpoint: 'tile_write' }
  };

  const res = http.post(WRITE_URL, payload, params);

  if (!check(res, { 'write status 200/202': r => r.status === 200 || r.status === 202 })) {
    writeFailures.add(1);
  }

  writeLatency.add(res.timings.duration);
  sleep(0);
}

export function handleSummary(data) {
  const summary = JSON.stringify(data, null, 2);
  const outputs = { stdout: summary };
  if (__ENV.SUMMARY_PATH) {
    outputs[__ENV.SUMMARY_PATH] = summary;
  }
  return outputs;
}
