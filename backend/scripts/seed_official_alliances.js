#!/usr/bin/env node

/**
 * Seed Official Alliances
 *
 * Creates a set of official "starter" alliances to pre-populate the alliance system.
 * Each alliance is assigned a color-based flag pattern from the existing pattern_assets table.
 * Some of the pre-seeded pixels (from seed_world_content.js) are then assigned to these alliances.
 *
 * This script is idempotent: running it multiple times will not create
 * duplicate alliances (it checks by name before creating).
 *
 * Usage:
 *   node backend/scripts/seed_official_alliances.js
 *
 * Options:
 *   --force       Delete and re-create official alliances
 *   --dry-run     Show what would be created without writing to DB
 *   --assign      Also assign pre-seeded pixels to the alliances
 */

const { db } = require('../src/config/database');
const {
  SYSTEM_USER_ID,
  ensureSystemUser
} = require('../src/services/systemBrushService');

// Parse CLI args
const args = process.argv.slice(2);
const forceMode = args.includes('--force');
const dryRun = args.includes('--dry-run');
const assignPixels = args.includes('--assign');

// Official alliance definitions
const OFFICIAL_ALLIANCES = [
  {
    name: 'Pixel Pioneers',
    description: 'The first explorers of the pixel frontier. Join us to paint the world blue!',
    color: '#1E90FF',
    flagPatternKey: 'color_blue',
    notice: 'Welcome to the Pixel Pioneers! Explore and draw everywhere.'
  },
  {
    name: 'Earth Artists',
    description: 'Dedicated to painting the beauty of our planet, one pixel at a time.',
    color: '#228B22',
    flagPatternKey: 'color_green',
    notice: 'Welcome to Earth Artists! Let us create beauty together.'
  },
  {
    name: 'Dawn Brigade',
    description: 'We rise with the sun and light up the map with warm colors.',
    color: '#FFA500',
    flagPatternKey: 'color_orange',
    notice: 'Welcome to the Dawn Brigade! Paint the world with warmth.'
  }
];

// City-to-alliance assignment mapping
// Maps city names to alliance names for pixel assignment
const CITY_ALLIANCE_MAP = {
  'Beijing': 'Dawn Brigade',
  'Shanghai': 'Dawn Brigade',
  'Tokyo': 'Pixel Pioneers',
  'New York': 'Earth Artists',
  'London': 'Pixel Pioneers',
  'Paris': 'Earth Artists',
  'San Francisco': 'Pixel Pioneers',
  'Sydney': 'Dawn Brigade'
};

// City coordinates (must match seed_world_content.js)
const CITY_COORDS = {
  'Beijing': { lat: 39.9042, lng: 116.4074 },
  'Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Sydney': { lat: -33.8688, lng: 151.2093 }
};

async function seedOfficialAlliances() {
  console.log('========================================');
  console.log('  FunnyPixels Official Alliances Seeder');
  console.log('========================================');
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] No changes will be written to the database.\n');
  }

  if (forceMode) {
    console.log('[FORCE] Existing official alliances will be deleted and re-created.\n');
  }

  try {
    // Step 1: Ensure system user exists (leader of official alliances)
    console.log('Step 1: Ensuring system user exists...');
    if (!dryRun) {
      await ensureSystemUser();
    }
    console.log(`  System user ID: ${SYSTEM_USER_ID}`);
    console.log('');

    // Step 2: Create official alliances
    console.log('Step 2: Creating official alliances...');
    console.log('');

    const createdAlliances = {};
    let alliancesCreated = 0;
    let alliancesSkipped = 0;

    for (const allianceDef of OFFICIAL_ALLIANCES) {
      // Check if alliance already exists
      const existing = await db('alliances')
        .where('name', allianceDef.name)
        .first();

      if (existing && !forceMode) {
        console.log(`  [SKIP] ${allianceDef.name} - already exists (id: ${existing.id})`);
        createdAlliances[allianceDef.name] = existing.id;
        alliancesSkipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [DRY] ${allianceDef.name} - would create with color ${allianceDef.color}, flag: ${allianceDef.flagPatternKey}`);
        alliancesCreated++;
        continue;
      }

      // Force mode: delete existing alliance and its members
      if (existing && forceMode) {
        await db('alliance_members').where('alliance_id', existing.id).del();
        await db('alliances').where('id', existing.id).del();
        console.log(`  [CLEAR] Deleted existing alliance: ${allianceDef.name}`);
      }

      // Look up the flag pattern in pattern_assets
      const patternAsset = await db('pattern_assets')
        .where('key', allianceDef.flagPatternKey)
        .select('key', 'render_type', 'unicode_char', 'payload', 'color')
        .first();

      // Prepare alliance data
      const allianceData = {
        name: allianceDef.name,
        description: allianceDef.description,
        color: allianceDef.color,
        notice: allianceDef.notice,
        leader_id: SYSTEM_USER_ID,
        member_count: 1,
        max_members: 500, // Large capacity for official alliances
        is_public: true,
        is_active: true,
        approval_required: false, // Easy to join
        flag_pattern_id: allianceDef.flagPatternKey,
        flag_render_type: patternAsset?.render_type || 'color',
        flag_unicode_char: patternAsset?.unicode_char || null,
        flag_payload: patternAsset?.payload || null,
        flag_pattern_anchor_x: 0,
        flag_pattern_anchor_y: 0,
        flag_pattern_rotation: 0,
        flag_pattern_mirror: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert the alliance
      const [alliance] = await db('alliances')
        .insert(allianceData)
        .returning('*');

      // Add system user as leader member
      await db('alliance_members').insert({
        alliance_id: alliance.id,
        user_id: SYSTEM_USER_ID,
        role: 'leader',
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      createdAlliances[allianceDef.name] = alliance.id;
      alliancesCreated++;
      console.log(`  [OK] ${allianceDef.name} - created (id: ${alliance.id}, color: ${allianceDef.color}, flag: ${allianceDef.flagPatternKey})`);
    }

    console.log('');

    // Step 3: Optionally assign pre-seeded pixels to alliances
    if (assignPixels && !dryRun) {
      console.log('Step 3: Assigning pre-seeded pixels to alliances...');
      console.log('');

      let totalAssigned = 0;

      for (const [cityName, allianceName] of Object.entries(CITY_ALLIANCE_MAP)) {
        const allianceId = createdAlliances[allianceName];
        if (!allianceId) {
          console.log(`  [SKIP] ${cityName} - alliance "${allianceName}" not found`);
          continue;
        }

        const coords = CITY_COORDS[cityName];
        if (!coords) continue;

        // Update system pixels near this city to belong to the alliance
        const searchRadius = 0.01; // ~1km radius in degrees
        const updated = await db('pixels')
          .where('user_id', SYSTEM_USER_ID)
          .whereBetween('latitude', [coords.lat - searchRadius, coords.lat + searchRadius])
          .whereBetween('longitude', [coords.lng - searchRadius, coords.lng + searchRadius])
          .update({
            alliance_id: allianceId,
            updated_at: new Date()
          });

        if (updated > 0) {
          console.log(`  [OK] ${cityName} -> ${allianceName} (${updated} pixels assigned)`);
          totalAssigned += updated;
        } else {
          console.log(`  [SKIP] ${cityName} - no system pixels found near this location`);
        }
      }

      console.log(`\n  Total pixels assigned to alliances: ${totalAssigned}`);
      console.log('');
    } else if (assignPixels && dryRun) {
      console.log('Step 3: [DRY RUN] Would assign pre-seeded pixels to alliances...');
      for (const [cityName, allianceName] of Object.entries(CITY_ALLIANCE_MAP)) {
        console.log(`  [DRY] ${cityName} -> ${allianceName}`);
      }
      console.log('');
    } else {
      console.log('Step 3: Pixel assignment skipped (use --assign to enable).');
      console.log('');
    }

    // Summary
    console.log('========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Alliances created: ${alliancesCreated}`);
    console.log(`  Alliances skipped: ${alliancesSkipped}`);
    console.log(`  Mode:              ${dryRun ? 'DRY RUN' : forceMode ? 'FORCE' : 'NORMAL'}`);
    console.log('========================================');
    console.log('');
    console.log('Official alliances seeding complete.');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
seedOfficialAlliances()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
