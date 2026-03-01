#!/usr/bin/env node
/**
 * Generate .stringsdict files from plural definitions.
 * Plural rules are defined inline per language.
 *
 * Usage: node scripts/localization/generate_stringsdict.js
 */

const fs = require('fs');
const path = require('path');

const RESOURCES_BASE = path.resolve(__dirname, '../../FunnyPixelsApp/FunnyPixelsApp/Resources');

// Plural keys and their templates per language
// Languages like ja, ko, zh-Hans have no grammatical plural (only "other")
// Languages like en, es, pt-BR have "one" and "other"

const PLURAL_KEYS = [
  {
    key: 'drawing.gps.session_pixels',
    templates: {
      en: { format: 'Drawn %#@count@ pixels', one: '%d pixel', other: '%d pixels' },
      'zh-Hans': { format: '已绘制 %#@count@ 个像素', other: '%d' },
      ja: { format: '%#@count@ ピクセル描画済み', other: '%d' },
      ko: { format: '%#@count@ 픽셀 그림', other: '%d' },
      es: { format: 'Dibujados %#@count@ pixeles', one: '%d pixel', other: '%d' },
      'pt-BR': { format: 'Desenhou %#@count@ pixels', one: '%d pixel', other: '%d' }
    }
  },
  {
    key: 'summary.stats.pixels_label',
    templates: {
      en: { format: 'This session: %#@count@', one: '%d pixel', other: '%d pixels' },
      'zh-Hans': { format: '本次绘制：%#@count@ 个像素', other: '%d' },
      ja: { format: '本セッション：%#@count@ ピクセル', other: '%d' },
      ko: { format: '이번 세션: %#@count@ 픽셀', other: '%d' },
      es: { format: 'Esta sesion: %#@count@', one: '%d pixel', other: '%d pixeles' },
      'pt-BR': { format: 'Nesta sessao: %#@count@', one: '%d pixel', other: '%d pixels' }
    }
  },
  {
    key: 'map.mode.drawing',
    templates: {
      en: { format: '%#@count@', one: '%d pixel', other: '%d pixels' },
      'zh-Hans': { format: '%#@count@ 像素', other: '%d' },
      ja: { format: '%#@count@ ピクセル', other: '%d' },
      ko: { format: '%#@count@ 픽셀', other: '%d' },
      es: { format: '%#@count@', one: '%d pixel', other: '%d pixeles' },
      'pt-BR': { format: '%#@count@', one: '%d pixel', other: '%d pixels' }
    }
  },
  {
    key: 'checkin.rewards.day',
    templates: {
      en: { format: 'Day %#@count@', one: '%d', other: '%d' },
      'zh-Hans': { format: '第%#@count@天', other: '%d' },
      ja: { format: '%#@count@日目', other: '%d' },
      ko: { format: '%#@count@일차', other: '%d' },
      es: { format: 'Dia %#@count@', one: '%d', other: '%d' },
      'pt-BR': { format: 'Dia %#@count@', one: '%d', other: '%d' }
    }
  },
  {
    key: 'drift_bottle.open.days',
    templates: {
      en: { format: '%#@count@', one: '%d day', other: '%d days' },
      'zh-Hans': { format: '%#@count@天', other: '%d' },
      ja: { format: '%#@count@日間', other: '%d' },
      ko: { format: '%#@count@일', other: '%d' },
      es: { format: '%#@count@', one: '%d dia', other: '%d dias' },
      'pt-BR': { format: '%#@count@', one: '%d dia', other: '%d dias' }
    }
  },
  {
    key: 'drift_bottle.days_count',
    templates: {
      en: { format: '%#@count@', one: '%d day', other: '%d days' },
      'zh-Hans': { format: '%#@count@天', other: '%d' },
      ja: { format: '%#@count@日間', other: '%d' },
      ko: { format: '%#@count@일', other: '%d' },
      es: { format: '%#@count@', one: '%d dia', other: '%d dias' },
      'pt-BR': { format: '%#@count@', one: '%d dia', other: '%d dias' }
    }
  },
  {
    key: 'drift_bottle.journey.stations',
    templates: {
      en: { format: '%#@count@', one: '%d stop', other: '%d stops' },
      'zh-Hans': { format: '%#@count@站', other: '%d' },
      ja: { format: '%#@count@停留所', other: '%d' },
      ko: { format: '%#@count@ 정류장', other: '%d' },
      es: { format: '%#@count@', one: '%d parada', other: '%d paradas' },
      'pt-BR': { format: '%#@count@', one: '%d parada', other: '%d paradas' }
    }
  },
  {
    key: 'drift_bottle.journey.days',
    templates: {
      en: { format: '%#@count@', one: '%d day', other: '%d days' },
      'zh-Hans': { format: '%#@count@天', other: '%d' },
      ja: { format: '%#@count@日間', other: '%d' },
      ko: { format: '%#@count@일', other: '%d' },
      es: { format: '%#@count@', one: '%d dia', other: '%d dias' },
      'pt-BR': { format: '%#@count@', one: '%d dia', other: '%d dias' }
    }
  }
];

const LANGUAGES = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateStringsdict(lang) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>\n`;

  for (const entry of PLURAL_KEYS) {
    const tmpl = entry.templates[lang];
    if (!tmpl) continue;

    xml += `    <key>${escapeXml(entry.key)}</key>
    <dict>
        <key>NSStringLocalizedFormatKey</key>
        <string>${escapeXml(tmpl.format)}</string>
        <key>count</key>
        <dict>
            <key>NSStringFormatSpecTypeKey</key>
            <string>NSStringPluralRuleType</string>
            <key>NSStringFormatValueTypeKey</key>
            <string>d</string>\n`;

    if (tmpl.one) {
      xml += `            <key>one</key>
            <string>${escapeXml(tmpl.one)}</string>\n`;
    }

    xml += `            <key>other</key>
            <string>${escapeXml(tmpl.other)}</string>
        </dict>
    </dict>\n\n`;
  }

  xml += `</dict>
</plist>
`;
  return xml;
}

for (const lang of LANGUAGES) {
  const outputPath = path.join(RESOURCES_BASE, `${lang}.lproj`, 'Localizable.stringsdict');
  const content = generateStringsdict(lang);
  fs.writeFileSync(outputPath, content);
  console.log(`Generated ${outputPath}`);
}

console.log('Done! Generated stringsdict for all languages.');
