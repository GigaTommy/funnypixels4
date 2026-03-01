#!/usr/bin/env node
/**
 * Verify that format specifiers (%d, %@, %1$@, etc.) match across all translations.
 * Usage: node scripts/localization/check_format_specifiers.js
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

function extractSpecifiers(str) {
  const regex = /%[@dfs]|%\d+\$[@dfs]|%dx%d/g;
  return (str.match(regex) || []).sort();
}

const baseFile = path.join(RESOURCES_BASE, `${BASE_LANG}.lproj`, 'Localizable.strings');
const baseKeys = parseStringsFile(baseFile);
let issues = 0;
let checked = 0;

for (const lang of LANGUAGES) {
  if (lang === BASE_LANG) continue;

  const langFile = path.join(RESOURCES_BASE, `${lang}.lproj`, 'Localizable.strings');
  const langKeys = parseStringsFile(langFile);

  for (const [key, baseValue] of Object.entries(baseKeys)) {
    const langValue = langKeys[key];
    if (!langValue) continue;

    const baseSpecs = extractSpecifiers(baseValue);
    const langSpecs = extractSpecifiers(langValue);
    checked++;

    if (baseSpecs.join(',') !== langSpecs.join(',')) {
      console.log(`MISMATCH ${lang}:${key}`);
      console.log(`  en:   [${baseSpecs.join(', ')}]`);
      console.log(`  ${lang}: [${langSpecs.join(', ')}]`);
      issues++;
    }
  }
}

console.log(`\nChecked ${checked} key-language pairs across ${LANGUAGES.length - 1} languages.`);
if (issues === 0) {
  console.log('All format specifiers match!');
} else {
  console.log(`Found ${issues} mismatches.`);
  process.exit(1);
}
