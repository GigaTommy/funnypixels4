#!/usr/bin/env node
/**
 * Unified Localization CLI Tool
 *
 * Usage:
 *   node l10n_cli.js <command> [options]
 *
 * Commands:
 *   push       Push .strings files to backend DB
 *   pull       Pull translations from backend DB to .strings files
 *   translate  Export XLIFF for translation
 *   check      Check missing translations across all languages
 *   generate   Regenerate L10n.generated.swift
 *   pseudo     Generate pseudo-localized bundle
 */

const fs = require('fs');
const path = require('path');

const RESOURCES_BASE = path.resolve(__dirname, '../../FunnyPixelsApp/FunnyPixelsApp/Resources');
const LANGUAGES = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];
const BASE_LANG = 'en';

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

function writeStringsFile(filePath, entries) {
  const keys = Object.keys(entries).sort();
  const lines = keys.map(key => {
    const value = String(entries[key]).replace(/"/g, '\\"');
    return `"${key}" = "${value}";`;
  });
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

function stringsFilePath(lang) {
  return path.join(RESOURCES_BASE, `${lang}.lproj`, 'Localizable.strings');
}

const commands = {
  check() {
    console.log('Checking missing translations across all languages...\n');
    const baseKeys = parseStringsFile(stringsFilePath(BASE_LANG));
    const baseKeySet = new Set(Object.keys(baseKeys));
    let hasIssues = false;

    for (const lang of LANGUAGES) {
      if (lang === BASE_LANG) continue;
      const langKeys = parseStringsFile(stringsFilePath(lang));
      const langKeySet = new Set(Object.keys(langKeys));

      const missing = [...baseKeySet].filter(k => !langKeySet.has(k));
      const extra = [...langKeySet].filter(k => !baseKeySet.has(k));

      if (missing.length > 0 || extra.length > 0) {
        hasIssues = true;
        console.log(`${lang}: ${missing.length} missing, ${extra.length} extra`);
        if (missing.length > 0 && missing.length <= 20) {
          missing.forEach(k => console.log(`  - MISSING: ${k}`));
        }
      } else {
        console.log(`${lang}: ✓ OK (${Object.keys(langKeys).length} keys)`);
      }
    }

    // Check format specifiers
    console.log('\nChecking format specifiers...');
    const specRegex = /%[@dfs]|%\d+\$[@dfs]/g;
    let specIssues = 0;

    for (const lang of LANGUAGES) {
      if (lang === BASE_LANG) continue;
      const langKeys = parseStringsFile(stringsFilePath(lang));

      for (const [key, baseValue] of Object.entries(baseKeys)) {
        const langValue = langKeys[key];
        if (!langValue) continue;

        const baseSpecs = (baseValue.match(specRegex) || []).sort().join(',');
        const langSpecs = (langValue.match(specRegex) || []).sort().join(',');

        if (baseSpecs !== langSpecs) {
          console.log(`  ⚠ ${lang}:${key} - expected [${baseSpecs}] got [${langSpecs}]`);
          specIssues++;
        }
      }
    }

    if (specIssues === 0) {
      console.log('  ✓ All format specifiers match');
    }

    process.exit(hasIssues || specIssues > 0 ? 1 : 0);
  },

  generate() {
    console.log('Regenerating L10n.generated.swift...');
    require('./generate_l10n_swift');
  },

  pseudo() {
    const input = stringsFilePath(BASE_LANG);
    const entries = parseStringsFile(input);

    const map = {
      a: 'à', A: 'Á', b: 'ƀ', B: 'ß', c: 'ç', C: 'Ç', d: 'ď', D: 'Ð',
      e: 'ë', E: 'Ë', f: 'ƒ', F: 'Ƒ', g: 'ğ', G: 'Ğ', h: 'ħ', H: 'Ħ',
      i: 'ï', I: 'Ï', j: 'ĵ', J: 'Ĵ', k: 'ķ', K: 'Ķ', l: 'ľ', L: 'Ľ',
      m: 'ṃ', M: 'Ṁ', n: 'ñ', N: 'Ñ', o: 'ô', O: 'Ô', p: 'þ', P: 'Þ',
      q: 'ɋ', Q: 'Ɋ', r: 'ř', R: 'Ř', s: 'ş', S: 'Ş', t: 'ť', T: 'Ť',
      u: 'û', U: 'Û', v: 'ṽ', V: 'Ṽ', w: 'ŵ', W: 'Ŵ', x: 'ẋ', X: 'Ẋ',
      y: 'ÿ', Y: 'Ÿ', z: 'ž', Z: 'Ž'
    };

    const specRegex = /(%[@dfs]|%\d+\$[@dfs]|\\n)/g;

    function pseudo(str) {
      // Preserve format specifiers and escape sequences
      const parts = str.split(specRegex);
      const stretched = parts.map((part, i) => {
        if (i % 2 === 1) return part; // format specifier
        return part.replace(/[A-Za-z]/g, ch => map[ch] || ch);
      }).join('');
      // Add ~30% padding for text expansion testing
      const padding = '~'.repeat(Math.ceil(str.length * 0.3));
      return `⟦${stretched}${padding}⟧`;
    }

    const out = {};
    for (const [key, value] of Object.entries(entries)) {
      out[key] = pseudo(value);
    }

    const outputPath = path.join(RESOURCES_BASE, '..', '..', 'pseudo_localized.json');
    fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
    console.log(`Pseudo-localized ${Object.keys(out).length} keys to ${outputPath}`);
  },

  push() {
    console.log('Push: Use scripts/localization/import_strings_to_db.js for DB import');
    console.log('Or use the admin API: POST /api/v1/admin/localization/import/json');
  },

  pull() {
    console.log('Pull: Use the admin API to export:');
    console.log('  GET /api/v1/admin/localization/export/json?lang=<code>');
    console.log('Then convert with: node scripts/localization/json_to_strings.js <input.json> <output.strings>');
  },

  translate() {
    console.log('Export XLIFF for translation:');
    console.log('  GET /api/v1/admin/localization/export/xliff?lang=<target>&base=en');
    console.log('Import XLIFF after translation:');
    console.log('  POST /api/v1/admin/localization/import/xliff');
  }
};

const command = process.argv[2];
if (!command || !commands[command]) {
  console.log('Usage: node l10n_cli.js <command>');
  console.log('Commands: ' + Object.keys(commands).join(', '));
  process.exit(1);
}

commands[command]();
