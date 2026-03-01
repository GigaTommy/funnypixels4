/**
 * Parse MVT tile and check layer contents
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Use @mapbox/vector-tile which is the standard library
let VectorTile, Protobuf;

try {
  VectorTile = require('@mapbox/vector-tile').VectorTile;
  const pbfModule = require('pbf');
  Protobuf = pbfModule.default || pbfModule;
} catch (e) {
  console.error('Missing dependencies. Install with:');
  console.error('  npm install @mapbox/vector-tile pbf');
  process.exit(1);
}

// Tile coordinates - check multiple zoom levels
// z=16: 53398, 28441
// z=17: 106796, 56882 (2x of z16)
const TILE_Z = process.argv[2] ? parseInt(process.argv[2]) : 16;
const TILE_X = process.argv[3] ? parseInt(process.argv[3]) : 53398;
const TILE_Y = process.argv[4] ? parseInt(process.argv[4]) : 28441;

// Backend URL (adjust if different)
const TILE_URL = `http://localhost:3001/api/tiles/pixels/${TILE_Z}/${TILE_X}/${TILE_Y}.pbf`;

async function fetchTile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MVT Tile Parser - Layer Analysis                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Fetching tile: ${TILE_URL}\n`);

  try {
    const buffer = await fetchTile(TILE_URL);
    console.log(`✅ Tile fetched: ${buffer.length} bytes\n`);

    // Parse MVT
    const pbf = new Protobuf(buffer);
    const tile = new VectorTile(pbf);

    console.log('═'.repeat(60));
    console.log('📊 Layer Summary:');
    console.log('─'.repeat(60));

    const layerNames = Object.keys(tile.layers);
    console.log(`  Found ${layerNames.length} layers: ${layerNames.join(', ')}\n`);

    // Analyze each layer
    for (const layerName of layerNames) {
      const layer = tile.layers[layerName];
      console.log(`\n🔹 Layer: "${layerName}"`);
      console.log(`   Features: ${layer.length}`);

      if (layer.length > 0) {
        // Sample first few features
        const sampleCount = Math.min(3, layer.length);
        console.log(`   Sample features (first ${sampleCount}):`);

        for (let i = 0; i < sampleCount; i++) {
          const feature = layer.feature(i);
          const props = feature.properties;
          console.log(`   [${i}] type=${feature.type}, props:`, JSON.stringify(props, null, 2).substring(0, 200));
        }

        // Check for emoji field in emoji layer
        if (layerName === 'pixels-emoji') {
          console.log('\n   🔍 Emoji layer detailed analysis:');
          for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            const props = feature.properties;
            console.log(`   [${i}] emoji="${props.emoji}" grid_id=${props.grid_id}`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📈 Summary:');
    console.log('─'.repeat(60));

    const colorCount = tile.layers['pixels-color']?.length || 0;
    const emojiCount = tile.layers['pixels-emoji']?.length || 0;
    const complexCount = tile.layers['pixels-complex']?.length || 0;
    const adCount = tile.layers['pixels-ad']?.length || 0;

    console.log(`  pixels-color:   ${colorCount} features`);
    console.log(`  pixels-emoji:   ${emojiCount} features`);
    console.log(`  pixels-complex: ${complexCount} features`);
    console.log(`  pixels-ad:      ${adCount} features`);
    console.log(`  Total:          ${colorCount + emojiCount + complexCount + adCount} features`);

    if (emojiCount === 0) {
      console.log('\n  ⚠️ WARNING: pixels-emoji layer is EMPTY!');
      console.log('  This confirms the problem is in MVT generation, not iOS rendering.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   Make sure the backend server is running on port 3002');
    }
  }
}

main();
