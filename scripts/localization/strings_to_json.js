#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error('Usage: strings_to_json.js <input.strings> <output.json>');
  process.exit(1);
}

const content = fs.readFileSync(path.resolve(input), 'utf8');
const lines = content.split(/\r?\n/);
const entries = {};
const keyRegex = /^\s*"([^"]+)"\s*=\s*"(.*)"\s*;\s*$/;

for (const line of lines) {
  const match = line.match(keyRegex);
  if (match) {
    const key = match[1];
    const value = match[2].replace(/\\"/g, '"');
    entries[key] = value;
  }
}

fs.writeFileSync(path.resolve(output), JSON.stringify(entries, null, 2));
console.log(`Wrote ${Object.keys(entries).length} keys to ${output}`);
