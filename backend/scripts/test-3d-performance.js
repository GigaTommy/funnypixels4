#!/usr/bin/env node
/**
 * 3D Pixel Performance Testing Script
 * Task: #22
 * Purpose: Automated performance testing for 3D pixel rendering API
 *
 * Usage:
 *   node scripts/test-3d-performance.js [options]
 *
 * Options:
 *   --host <url>      API host (default: http://localhost:3001)
 *   --iterations <n>  Number of test iterations (default: 10)
 *   --zoom <level>    Zoom level to test (default: 15)
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  host: process.argv.includes('--host')
    ? process.argv[process.argv.indexOf('--host') + 1]
    : 'http://localhost:3001',
  iterations: process.argv.includes('--iterations')
    ? parseInt(process.argv[process.argv.indexOf('--iterations') + 1])
    : 10,
  zoom: process.argv.includes('--zoom')
    ? parseInt(process.argv[process.argv.indexOf('--zoom') + 1])
    : 15
};

// Test scenarios
const testScenarios = [
  {
    name: 'City Level (L2 - Zoom 10)',
    zoom: 10,
    bounds: { minLat: 39.85, maxLat: 39.95, minLng: 116.35, maxLng: 116.45 }
  },
  {
    name: 'Block Level (L3 - Zoom 15)',
    zoom: 15,
    bounds: { minLat: 39.90, maxLat: 39.91, minLng: 116.40, maxLng: 116.41 }
  },
  {
    name: 'Pixel Level (L1 - Zoom 18)',
    zoom: 18,
    bounds: { minLat: 39.905, maxLat: 39.906, minLng: 116.405, maxLng: 116.406 }
  }
];

// Statistics collector
class PerformanceStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.times = [];
    this.errors = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  addTime(duration, cached = false) {
    this.times.push(duration);
    if (cached) this.cacheHits++;
    else this.cacheMisses++;
  }

  addError() {
    this.errors++;
  }

  getStats() {
    if (this.times.length === 0) {
      return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      avg: (sum / sorted.length).toFixed(2),
      min: sorted[0].toFixed(2),
      max: sorted[sorted.length - 1].toFixed(2),
      p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
      total: sorted.length,
      errors: this.errors,
      cacheHitRate: ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1)
    };
  }
}

// HTTP request wrapper
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({ duration, data: json, statusCode: res.statusCode });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Run test scenario
async function runScenario(scenario, iterations) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Testing: ${scenario.name}`);
  console.log(`${'='.repeat(60)}`);

  const stats = new PerformanceStats();
  const { minLat, maxLat, minLng, maxLng } = scenario.bounds;
  const url = `${config.host}/api/pixels-3d/viewport?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&zoom=${scenario.zoom}&limit=10000`;

  console.log(`URL: ${url}`);
  console.log(`Iterations: ${iterations}\n`);

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await makeRequest(url);

      if (result.statusCode === 200 && result.data.success) {
        const { data } = result.data;
        stats.addTime(result.duration);

        if (i === 0) {
          console.log(`First response:`);
          console.log(`  - LOD Level: ${data.lodLevel}`);
          console.log(`  - Pixel Count: ${data.count}`);
          console.log(`  - Response Time: ${result.duration}ms\n`);
        }

        process.stdout.write(`  Request ${i + 1}/${iterations}: ${result.duration}ms ✓\r`);
      } else {
        stats.addError();
        console.log(`  Request ${i + 1}/${iterations}: ERROR ✗`);
      }
    } catch (error) {
      stats.addError();
      console.log(`  Request ${i + 1}/${iterations}: ${error.message} ✗`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const results = stats.getStats();
  console.log(`\n\n📈 Results:`);
  console.log(`  Average: ${results.avg}ms`);
  console.log(`  Min: ${results.min}ms`);
  console.log(`  Max: ${results.max}ms`);
  console.log(`  P50: ${results.p50}ms`);
  console.log(`  P95: ${results.p95}ms`);
  console.log(`  P99: ${results.p99}ms`);
  console.log(`  Errors: ${results.errors}/${results.total}`);
  console.log(`  Success Rate: ${((1 - results.errors / results.total) * 100).toFixed(1)}%`);

  return results;
}

// Main execution
async function main() {
  console.log(`\n🎯 3D Pixel Performance Testing`);
  console.log(`Host: ${config.host}`);
  console.log(`Iterations per scenario: ${config.iterations}\n`);

  const allResults = [];

  for (const scenario of testScenarios) {
    const results = await runScenario(scenario, config.iterations);
    allResults.push({ scenario: scenario.name, ...results });
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 SUMMARY`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Scenario                          Avg      P95      P99    Success`);
  console.log(`${'-'.repeat(60)}`);

  allResults.forEach(result => {
    const name = result.scenario.padEnd(30);
    const avg = `${result.avg}ms`.padStart(8);
    const p95 = `${result.p95}ms`.padStart(8);
    const p99 = `${result.p99}ms`.padStart(8);
    const success = `${((1 - result.errors / result.total) * 100).toFixed(1)}%`.padStart(8);
    console.log(`${name} ${avg} ${p95} ${p99} ${success}`);
  });

  console.log(`\n✅ Performance testing completed!\n`);
}

// Run tests
main().catch(error => {
  console.error(`\n❌ Test failed: ${error.message}\n`);
  process.exit(1);
});
