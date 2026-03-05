#!/usr/bin/env node

/**
 * Seed World Content
 *
 * Places pre-designed pixel art at key world cities so that the map
 * is not empty when users first open the app.
 *
 * This script is idempotent: running it multiple times will not create
 * duplicate pixels (it checks before placing each pattern).
 *
 * Usage:
 *   node backend/scripts/seed_world_content.js
 *
 * Options:
 *   --force    Clear existing patterns and re-place them
 *   --dry-run  Show what would be placed without writing to DB
 */

const path = require('path');
const { db } = require('../src/config/database');
const {
  SYSTEM_USER_ID,
  ensureSystemUser,
  drawPattern,
  hasPatternAt,
  clearPatternAt,
  updateSystemUserStats
} = require('../src/services/systemBrushService');

// Parse CLI args
const args = process.argv.slice(2);
const forceMode = args.includes('--force');
const dryRun = args.includes('--dry-run');

// Load pattern files
function loadPattern(name) {
  const filePath = path.join(__dirname, 'patterns', `${name}.json`);
  const data = require(filePath);
  return data.pixels;
}

// City placement definitions
// Each city can have multiple patterns placed with offsets from the center
const CITY_PLACEMENTS = [
  {
    city: 'Beijing',
    lat: 39.9042,
    lng: 116.4074,
    patterns: [
      { name: 'heart', offsetLat: 0.002, offsetLng: -0.003 },
      { name: 'star', offsetLat: -0.002, offsetLng: 0.003 }
    ]
  },
  {
    city: 'Shanghai',
    lat: 31.2304,
    lng: 121.4737,
    patterns: [
      { name: 'smiley', offsetLat: 0.001, offsetLng: 0.001 }
    ]
  },
  {
    city: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    patterns: [
      { name: 'pixelcat', offsetLat: 0.001, offsetLng: -0.001 }
    ]
  },
  {
    city: 'New York',
    lat: 40.7128,
    lng: -74.0060,
    patterns: [
      { name: 'star', offsetLat: 0.002, offsetLng: -0.002 },
      { name: 'earth', offsetLat: -0.003, offsetLng: 0.003 }
    ]
  },
  {
    city: 'London',
    lat: 51.5074,
    lng: -0.1278,
    patterns: [
      { name: 'heart', offsetLat: 0.001, offsetLng: 0.001 }
    ]
  },
  {
    city: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    patterns: [
      { name: 'earth', offsetLat: 0.001, offsetLng: -0.001 }
    ]
  },
  {
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    patterns: [
      { name: 'smiley', offsetLat: 0.002, offsetLng: -0.002 },
      { name: 'star', offsetLat: -0.002, offsetLng: 0.002 }
    ]
  },
  {
    city: 'Sydney',
    lat: -33.8688,
    lng: 151.2093,
    patterns: [
      { name: 'pixelcat', offsetLat: 0.001, offsetLng: 0.001 }
    ]
  }
];

async function seedWorldContent() {
  console.log('========================================');
  console.log('  FunnyPixels World Content Seeder');
  console.log('========================================');
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] No changes will be written to the database.\n');
  }

  if (forceMode) {
    console.log('[FORCE] Existing patterns will be cleared and re-placed.\n');
  }

  try {
    // Step 1: Ensure system user exists
    console.log('Step 1: Ensuring system user exists...');
    if (!dryRun) {
      await ensureSystemUser();
    }
    console.log(`  System user ID: ${SYSTEM_USER_ID}`);
    console.log('');

    // Step 2: Place patterns at each city
    console.log('Step 2: Placing pixel art at world cities...');
    console.log('');

    let totalPixelsPlaced = 0;
    let patternsSkipped = 0;
    let patternsPlaced = 0;

    for (const placement of CITY_PLACEMENTS) {
      console.log(`  ${placement.city} (${placement.lat}, ${placement.lng}):`);

      for (const patternDef of placement.patterns) {
        const targetLat = placement.lat + patternDef.offsetLat;
        const targetLng = placement.lng + patternDef.offsetLng;
        const patternName = patternDef.name;

        // Check if pattern already exists at this location
        if (!forceMode) {
          const exists = await hasPatternAt(targetLat, targetLng);
          if (exists) {
            console.log(`    [SKIP] ${patternName} - already placed at (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`);
            patternsSkipped++;
            continue;
          }
        }

        if (dryRun) {
          const pattern = loadPattern(patternName);
          const pixelCount = pattern.reduce((sum, row) => sum + row.filter(c => c !== null).length, 0);
          console.log(`    [DRY] ${patternName} - would place ${pixelCount} pixels at (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`);
          patternsPlaced++;
          totalPixelsPlaced += pixelCount;
          continue;
        }

        // Force mode: clear existing patterns first
        if (forceMode) {
          const cleared = await clearPatternAt(targetLat, targetLng);
          if (cleared > 0) {
            console.log(`    [CLEAR] Removed ${cleared} existing pixels`);
          }
        }

        // Load and draw the pattern
        const pattern = loadPattern(patternName);
        const result = await drawPattern(pattern, targetLat, targetLng, {
          userId: SYSTEM_USER_ID,
          allianceId: null,
          scale: 1
        });

        console.log(`    [OK] ${patternName} - placed ${result.pixelsDrawn} pixels at (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`);
        totalPixelsPlaced += result.pixelsDrawn;
        patternsPlaced++;
      }

      console.log('');
    }

    // Step 3: Update system user stats
    if (!dryRun) {
      console.log('Step 3: Updating system user statistics...');
      const totalSystemPixels = await updateSystemUserStats();
      console.log(`  Total system pixels: ${totalSystemPixels}`);
      console.log('');
    }

    // Summary
    console.log('========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Patterns placed:  ${patternsPlaced}`);
    console.log(`  Patterns skipped: ${patternsSkipped}`);
    console.log(`  Total pixels:     ${totalPixelsPlaced}`);
    console.log(`  Mode:             ${dryRun ? 'DRY RUN' : forceMode ? 'FORCE' : 'NORMAL'}`);
    console.log('========================================');
    console.log('');
    console.log('World content seeding complete.');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
seedWorldContent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
