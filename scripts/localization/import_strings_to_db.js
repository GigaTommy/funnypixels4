#!/usr/bin/env node
/**
 * Import existing .strings files into the localization database.
 * Usage: node scripts/localization/import_strings_to_db.js
 *
 * This reads en.lproj/Localizable.strings and zh-Hans.lproj/Localizable.strings
 * and inserts them into the localization_strings table.
 */

const fs = require('fs');
const path = require('path');

// Load backend environment
const envPath = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const resourcesBase = path.resolve(__dirname, '../../FunnyPixelsApp/FunnyPixelsApp/Resources');

function parseStringsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const entries = {};
  const keyRegex = /^\s*"([^"]+)"\s*=\s*"(.*)"\s*;\s*$/;

  for (const line of lines) {
    const match = line.match(keyRegex);
    if (match) {
      entries[match[1]] = match[2].replace(/\\"/g, '"');
    }
  }
  return entries;
}

async function main() {
  const { db } = require(path.resolve(__dirname, '../../backend/src/config/database'));

  const languages = [
    { code: 'en', dir: 'en.lproj' },
    { code: 'zh-Hans', dir: 'zh-Hans.lproj' }
  ];

  for (const lang of languages) {
    const filePath = path.join(resourcesBase, lang.dir, 'Localizable.strings');
    console.log(`Parsing ${filePath}...`);
    const entries = parseStringsFile(filePath);
    const keys = Object.keys(entries);
    console.log(`  Found ${keys.length} keys for ${lang.code}`);

    if (keys.length === 0) continue;

    // Batch insert using raw SQL for PostgreSQL upsert
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await db.transaction(async (trx) => {
        for (const key of batch) {
          const value = entries[key];
          const existing = await trx('localization_strings')
            .where({ key, lang_code: lang.code })
            .first();

          if (existing) {
            await trx('localization_strings')
              .where({ key, lang_code: lang.code })
              .update({ value, updated_at: db.fn.now() });
          } else {
            await trx('localization_strings')
              .insert({ key, lang_code: lang.code, value });
          }
          imported++;
        }
      });
      process.stdout.write(`\r  Imported ${imported}/${keys.length} for ${lang.code}`);
    }
    console.log(` ✓`);
  }

  console.log('Done! Closing database connection...');
  await db.destroy();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
