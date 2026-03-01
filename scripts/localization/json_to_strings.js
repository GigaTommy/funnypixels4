#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error('Usage: json_to_strings.js <input.json> <output.strings>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const keys = Object.keys(data).sort();
const lines = [];

for (const key of keys) {
  const value = String(data[key]).replace(/"/g, '\\"');
  lines.push(`"${key}" = "${value}";`);
}

fs.writeFileSync(path.resolve(output), lines.join('\n') + '\n');
console.log(`Wrote ${keys.length} keys to ${output}`);
