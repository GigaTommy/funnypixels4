/**
 * Cluster mode entry point
 *
 * Forks multiple worker processes to utilize multiple CPU cores.
 * Each worker runs a full server.js instance.
 *
 * Usage:
 *   CLUSTER_WORKERS=2 node src/cluster.js
 *
 * Environment variables set for each worker:
 *   CLUSTER_MODE=true          - Indicates cluster mode is active
 *   CLUSTER_WORKER_ID=1|2|...  - Worker ID (1-based), worker 1 is the "primary worker"
 *   CLUSTER_WORKERS=N          - Total number of workers
 *
 * Worker 1 is designated as the "primary worker" and runs global singleton tasks
 * (cron jobs, leaderboard maintenance, etc.). All workers handle HTTP requests.
 *
 * Note: Socket.IO requires Redis adapter for multi-worker broadcast.
 */

const cluster = require('cluster');

const numWorkers = parseInt(process.env.CLUSTER_WORKERS || '2');

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary ${process.pid} starting ${numWorkers} workers...`);

  let nextId = 1;
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork({
      CLUSTER_MODE: 'true',
      CLUSTER_WORKER_ID: String(nextId++),
      CLUSTER_WORKERS: String(numWorkers)
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Restarting...`);
    cluster.fork({
      CLUSTER_MODE: 'true',
      CLUSTER_WORKER_ID: String(nextId++),
      CLUSTER_WORKERS: String(numWorkers)
    });
  });

  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });
} else {
  require('./server');
}
