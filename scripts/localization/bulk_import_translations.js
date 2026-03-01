#!/usr/bin/env node
/**
 * Bulk import all .strings files (all languages) into the backend DB.
 * Usage: node scripts/localization/bulk_import_translations.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const resourcesBase = path.resolve(__dirname, '../../FunnyPixelsApp/FunnyPixelsApp/Resources');

const LANGUAGES = [
  { code: 'en', dir: 'en.lproj' },
  { code: 'zh-Hans', dir: 'zh-Hans.lproj' },
  { code: 'ja', dir: 'ja.lproj' },
  { code: 'ko', dir: 'ko.lproj' },
  { code: 'es', dir: 'es.lproj' },
  { code: 'pt-BR', dir: 'pt-BR.lproj' }
];

function parseStringsFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const entries = {};
  const keyRegex = /^\s*"([^"]+)"\s*=\s*"(.*)"\s*;\s*$/;
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(keyRegex);
    if (match) {
      entries[match[1]] = match[2].replace(/\\"/g, '"');
    }
  }
  return entries;
}

async function main() {
  const { db } = require(path.resolve(__dirname, '../../backend/src/config/database'));

  for (const lang of LANGUAGES) {
    const filePath = path.join(resourcesBase, lang.dir, 'Localizable.strings');
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${lang.code} - file not found`);
      continue;
    }

    console.log(`Importing ${lang.code}...`);
    const entries = parseStringsFile(filePath);
    const keys = Object.keys(entries);

    if (keys.length === 0) {
      console.log(`  No keys found, skipping`);
      continue;
    }

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
      process.stdout.write(`\r  ${imported}/${keys.length}`);
    }

    // Bump version
    const existing = await db('localization_versions').where('lang_code', lang.code).first();
    if (existing) {
      await db('localization_versions').where('lang_code', lang.code).update({
        version: existing.version + 1,
        updated_at: db.fn.now()
      });
    } else {
      await db('localization_versions').insert({ lang_code: lang.code, version: 1 });
    }

    console.log(` ✓ (${imported} keys)`);
  }

  console.log('Done!');
  await db.destroy();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
