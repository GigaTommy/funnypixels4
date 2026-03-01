#!/usr/bin/env node
/**
 * Local Translation Memory (TM) for suggesting previously translated similar strings.
 * Builds a simple similarity index from existing translations.
 *
 * Usage:
 *   node translation_memory.js build    - Build TM from existing .strings files
 *   node translation_memory.js suggest "text to translate" --lang=ja
 */

const fs = require('fs');
const path = require('path');

const RESOURCES_BASE = path.resolve(__dirname, '../../FunnyPixelsApp/FunnyPixelsApp/Resources');
const TM_FILE = path.resolve(__dirname, '../../.translation_memory.json');
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

function stringsFilePath(lang) {
  return path.join(RESOURCES_BASE, `${lang}.lproj`, 'Localizable.strings');
}

// Simple word-level similarity (Jaccard)
function similarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

const commands = {
  build() {
    console.log('Building translation memory...');
    const baseStrings = parseStringsFile(stringsFilePath(BASE_LANG));
    const tm = {};

    for (const lang of LANGUAGES) {
      if (lang === BASE_LANG) continue;
      const langStrings = parseStringsFile(stringsFilePath(lang));
      tm[lang] = {};

      for (const [key, enValue] of Object.entries(baseStrings)) {
        const translation = langStrings[key];
        if (translation) {
          tm[lang][enValue] = translation;
        }
      }
    }

    fs.writeFileSync(TM_FILE, JSON.stringify(tm, null, 2));
    const langCount = Object.keys(tm).length;
    const pairsPerLang = Object.values(tm).map(l => Object.keys(l).length);
    console.log(`Built TM for ${langCount} languages.`);
    console.log(`Pairs per language: ${pairsPerLang.join(', ')}`);
    console.log(`Saved to ${TM_FILE}`);
  },

  suggest(text, lang) {
    if (!fs.existsSync(TM_FILE)) {
      console.log('TM not built yet. Run: node translation_memory.js build');
      process.exit(1);
    }

    const tm = JSON.parse(fs.readFileSync(TM_FILE, 'utf8'));
    const langTM = tm[lang];
    if (!langTM) {
      console.log(`No TM data for language: ${lang}`);
      process.exit(1);
    }

    const scored = Object.entries(langTM)
      .map(([source, target]) => ({
        source,
        target,
        score: similarity(text, source)
      }))
      .filter(entry => entry.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) {
      console.log('No similar translations found.');
      return;
    }

    console.log(`Top ${scored.length} suggestions for "${text}" (${lang}):\n`);
    for (const entry of scored) {
      console.log(`  [${Math.round(entry.score * 100)}%] "${entry.source}"`);
      console.log(`       -> "${entry.target}"\n`);
    }
  }
};

const command = process.argv[2];

if (command === 'build') {
  commands.build();
} else if (command === 'suggest') {
  const text = process.argv[3];
  const langArg = process.argv.find(a => a.startsWith('--lang='));
  const lang = langArg ? langArg.split('=')[1] : 'ja';
  if (!text) {
    console.log('Usage: node translation_memory.js suggest "text" --lang=ja');
    process.exit(1);
  }
  commands.suggest(text, lang);
} else {
  console.log('Usage: node translation_memory.js <build|suggest>');
  process.exit(1);
}
