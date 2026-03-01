#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const basePath = process.argv[2];
const comparePath = process.argv[3];

if (!basePath || !comparePath) {
  console.error('Usage: check_missing_translations.js <base.strings> <compare.strings>');
  process.exit(1);
}

function parseStrings(filePath) {
  const content = fs.readFileSync(path.resolve(filePath), 'utf8');
  const lines = content.split(/\r?\n/);
  const keys = new Set();
  const keyRegex = /^\s*"([^"]+)"\s*=\s*".*"\s*;\s*$/;

  for (const line of lines) {
    const match = line.match(keyRegex);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

const baseKeys = parseStrings(basePath);
const compareKeys = parseStrings(comparePath);

const missing = [...baseKeys].filter(key => !compareKeys.has(key));
if (missing.length === 0) {
  console.log('No missing keys');
  process.exit(0);
}

console.log(`Missing ${missing.length} keys:`);
for (const key of missing) {
  console.log(`- ${key}`);
}
process.exit(1);
