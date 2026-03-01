const LocalizationString = require('../models/LocalizationString');
const logger = require('../utils/logger');

// Try to get Redis client; gracefully degrade if unavailable
let getRedisClient;
try {
  const redisModule = require('../config/redis');
  getRedisClient = () => {
    try { return redisModule.getClient && redisModule.getClient(); } catch { return null; }
  };
} catch {
  getRedisClient = () => null;
}

const CACHE_PREFIX = 'l10n:bundle:';
const CACHE_TTL = 3600; // 1 hour

class LocalizationService {
  /**
   * Get a localization bundle for a language.
   * If clientVersion matches current version, returns {not_modified: true}.
   * Otherwise returns full bundle from Redis cache or DB.
   */
  static async getBundle(langCode, clientVersion) {
    const currentVersion = await LocalizationString.getVersion(langCode);

    if (clientVersion != null && Number(clientVersion) >= currentVersion) {
      return {
        lang: langCode,
        version: currentVersion,
        not_modified: true
      };
    }

    // Try Redis cache first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(CACHE_PREFIX + langCode);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.version === currentVersion) {
            return parsed;
          }
        }
      } catch (err) {
        logger.warn('Redis cache read failed for l10n bundle', { lang: langCode, error: err.message });
      }
    }

    // Fetch from DB
    const strings = await LocalizationString.getBundleForLanguage(langCode);
    const bundle = {
      lang: langCode,
      version: currentVersion,
      updated_at: new Date().toISOString(),
      strings
    };

    // Cache to Redis
    if (redis) {
      try {
        await redis.set(CACHE_PREFIX + langCode, JSON.stringify(bundle), { EX: CACHE_TTL });
      } catch (err) {
        logger.warn('Redis cache write failed for l10n bundle', { lang: langCode, error: err.message });
      }
    }

    return bundle;
  }

  /**
   * Invalidate cached bundle for a language
   */
  static async invalidateCache(langCode) {
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(CACHE_PREFIX + langCode);
      } catch (err) {
        logger.warn('Redis cache invalidation failed', { lang: langCode, error: err.message });
      }
    }
  }

  /**
   * Export all strings for a language as JSON
   */
  static async exportToJSON(langCode) {
    return LocalizationString.getBundleForLanguage(langCode);
  }

  /**
   * Import a JSON {key: value} map for a language
   */
  static async importFromJSON(langCode, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('data must be a plain object of key-value pairs');
    }
    const entries = Object.entries(data).map(([key, value]) => ({
      key,
      lang_code: langCode,
      value: String(value)
    }));

    const count = await LocalizationString.bulkUpsert(entries);
    await LocalizationString.bumpVersion(langCode);
    await this.invalidateCache(langCode);
    return count;
  }

  /**
   * Export to XLIFF 1.2 format for professional translation tools
   */
  static async exportToXLIFF(langCode, baseLangCode = 'en') {
    const [sourceStrings, targetStrings] = await Promise.all([
      LocalizationString.getBundleForLanguage(baseLangCode),
      LocalizationString.getBundleForLanguage(langCode)
    ]);

    const escapeXml = (str) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    let xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${escapeXml(baseLangCode)}" target-language="${escapeXml(langCode)}" datatype="plaintext" original="Localizable.strings">
    <body>\n`;

    for (const [key, sourceValue] of Object.entries(sourceStrings)) {
      const targetValue = targetStrings[key] || '';
      xliff += `      <trans-unit id="${escapeXml(key)}">
        <source>${escapeXml(sourceValue)}</source>
        <target>${escapeXml(targetValue)}</target>
      </trans-unit>\n`;
    }

    xliff += `    </body>
  </file>
</xliff>`;

    return xliff;
  }

  /**
   * Import from XLIFF data string
   */
  static async importFromXLIFF(xliffData) {
    // Simple regex-based XLIFF parser
    const fileMatch = xliffData.match(/target-language="([^"]+)"/);
    if (!fileMatch) {
      throw new Error('Could not determine target language from XLIFF');
    }
    const langCode = fileMatch[1];

    const entries = [];
    const unitRegex = /<trans-unit id="([^"]+)">\s*<source>([^<]*)<\/source>\s*<target>([^<]*)<\/target>/g;
    let match;
    while ((match = unitRegex.exec(xliffData)) !== null) {
      const key = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const value = match[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      if (value) {
        entries.push({ key, lang_code: langCode, value });
      }
    }

    const count = await LocalizationString.bulkUpsert(entries);
    await LocalizationString.bumpVersion(langCode);
    await this.invalidateCache(langCode);
    return { langCode, count };
  }
}

module.exports = LocalizationService;
