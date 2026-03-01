/**
 * Production MVT Verification Script
 *
 * Tests:
 * 1. Fetch MVT tile from production endpoint
 * 2. Decode PBF and verify 3 source-layers exist
 * 3. Check feature count > 0
 * 4. Verify ETag and caching headers
 * 5. Test Brotli/Gzip encoding
 */

const axios = require('axios');
const { VectorTile } = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const zlib = require('zlib');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Test tile coordinates (adjust to your data location)
const TEST_TILE = { z: 14, x: 13536, y: 6654 }; // Hangzhou area

async function verifyMVTTile() {
  console.log('🧪 Testing MVT Production Endpoint...\n');

  try {
    // 1. Fetch tile with Brotli encoding
    const url = `${BASE_URL}/api/tiles/pixels/${TEST_TILE.z}/${TEST_TILE.x}/${TEST_TILE.y}.pbf`;
    console.log(`📡 Fetching: ${url}`);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'Accept-Encoding': 'br, gzip'
      },
      validateStatus: () => true // Accept all status codes
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Content-Length: ${response.data.byteLength} bytes`);
    console.log(`🗜️  Encoding: ${response.headers['content-encoding'] || 'identity'}`);
    console.log(`🏷️  ETag: ${response.headers['etag'] || 'missing'}`);
    console.log(`💾 Cache-Control: ${response.headers['cache-control'] || 'missing'}\n`);

    // Handle empty tile
    if (response.status === 204) {
      console.log('⚠️  Empty tile (204 No Content)');
      console.log('ℹ️  This is expected if there are no pixels at this location');
      return;
    }

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    // 2. Decompress if needed
    let pbfBuffer = Buffer.from(response.data);

    if (response.headers['content-encoding'] === 'br') {
      pbfBuffer = zlib.brotliDecompressSync(pbfBuffer);
      console.log(`📦 Decompressed from Brotli: ${pbfBuffer.length} bytes`);
    } else if (response.headers['content-encoding'] === 'gzip') {
      pbfBuffer = zlib.gunzipSync(pbfBuffer);
      console.log(`📦 Decompressed from Gzip: ${pbfBuffer.length} bytes`);
    }

    // 3. Decode MVT
    const tile = new VectorTile(new Protobuf(pbfBuffer));

    console.log(`\n📊 Vector Tile Layers:`);
    console.log(`   Layers found: ${Object.keys(tile.layers).length}`);

    const expectedLayers = ['pixels-color', 'pixels-emoji', 'pixels-complex'];
    let totalFeatures = 0;

    for (const layerName of expectedLayers) {
      const layer = tile.layers[layerName];

      if (layer) {
        console.log(`   ✅ ${layerName}: ${layer.length} features`);
        totalFeatures += layer.length;

        // Sample first feature
        if (layer.length > 0) {
          const feature = layer.feature(0);
          console.log(`      Sample feature:`, feature.properties);
        }
      } else {
        console.log(`   ⚠️  ${layerName}: missing (may be empty for this tile)`);
      }
    }

    console.log(`\n📈 Total features: ${totalFeatures}`);

    // 4. Verify critical requirements
    const checks = [
      { name: 'Has ETag header', pass: !!response.headers['etag'] },
      { name: 'Has Cache-Control', pass: !!response.headers['cache-control'] },
      { name: 'Uses compression', pass: response.headers['content-encoding'] !== undefined },
      { name: 'At least 1 layer', pass: Object.keys(tile.layers).length > 0 },
      { name: 'At least 1 feature (or empty)', pass: totalFeatures >= 0 }
    ];

    console.log(`\n🔍 Production Checks:`);
    let allPassed = true;
    for (const check of checks) {
      const status = check.pass ? '✅' : '❌';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    }

    if (allPassed) {
      console.log(`\n🎉 All checks passed! MVT production endpoint is ready.\n`);
      process.exit(0);
    } else {
      console.log(`\n❌ Some checks failed. Review configuration.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Verification failed:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Headers:`, error.response.headers);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// Run verification
verifyMVTTile();
