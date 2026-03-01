#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error('Usage: pseudo_localize.js <input.json> <output.json>');
  process.exit(1);
}

const map = {
  a: 'à', A: 'Á', b: 'ƀ', B: 'ß', c: 'ç', C: 'Ç', d: 'ď', D: 'Ð',
  e: 'ë', E: 'Ë', f: 'ƒ', F: 'Ƒ', g: 'ğ', G: 'Ğ', h: 'ħ', H: 'Ħ',
  i: 'ï', I: 'Ï', j: 'ĵ', J: 'Ĵ', k: 'ķ', K: 'Ķ', l: 'ľ', L: 'Ľ',
  m: 'ṃ', M: 'Ṁ', n: 'ñ', N: 'Ñ', o: 'ô', O: 'Ô', p: 'þ', P: 'Þ',
  q: 'ɋ', Q: 'Ɋ', r: 'ř', R: 'Ř', s: 'ş', S: 'Ş', t: 'ť', T: 'Ť',
  u: 'û', U: 'Û', v: 'ṽ', V: 'Ṽ', w: 'ŵ', W: 'Ŵ', x: 'ẋ', X: 'Ẋ',
  y: 'ÿ', Y: 'Ÿ', z: 'ž', Z: 'Ž'
};

function pseudo(str) {
  const stretched = str.replace(/[A-Za-z]/g, ch => map[ch] || ch);
  return `⟦${stretched}⟧`;
}

const data = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const out = {};

for (const [key, value] of Object.entries(data)) {
  const text = String(value);
  out[key] = pseudo(text);
}

fs.writeFileSync(path.resolve(output), JSON.stringify(out, null, 2));
console.log(`Pseudo-localized ${Object.keys(out).length} keys to ${output}`);
