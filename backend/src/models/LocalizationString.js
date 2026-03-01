const { db } = require('../config/database');

class LocalizationString {
  /**
   * Get all translation entries for a language
   */
  static async getAllForLanguage(langCode) {
    return db('localization_strings')
      .where('lang_code', langCode)
      .select('key', 'value', 'context', 'updated_at');
  }

  /**
   * Get a flat {key: value} bundle for a language
   */
  static async getBundleForLanguage(langCode) {
    const rows = await db('localization_strings')
      .where('lang_code', langCode)
      .select('key', 'value');

    const bundle = {};
    for (const row of rows) {
      bundle[row.key] = row.value;
    }
    return bundle;
  }

  /**
   * Get the current version number for a language
   */
  static async getVersion(langCode) {
    const row = await db('localization_versions')
      .where('lang_code', langCode)
      .first();
    return row ? row.version : 0;
  }

  /**
   * Upsert a single translation entry
   */
  static async upsert(key, langCode, value, context) {
    await db('localization_strings')
      .insert({ key, lang_code: langCode, value, context })
      .onConflict(['key', 'lang_code'])
      .merge({ value, context, updated_at: db.fn.now() });
  }

  /**
   * Bulk upsert translation entries
   * @param {Array<{key: string, lang_code: string, value: string, context?: string}>} entries
   */
  static async bulkUpsert(entries) {
    if (!entries || entries.length === 0) return 0;

    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const rows = batch.map(entry => ({
        key: entry.key,
        lang_code: entry.lang_code,
        value: entry.value,
        context: entry.context || null
      }));
      await db('localization_strings')
        .insert(rows)
        .onConflict(['key', 'lang_code'])
        .merge({
          value: db.raw('EXCLUDED.value'),
          context: db.raw('EXCLUDED.context'),
          updated_at: db.fn.now()
        });
    }
    return entries.length;
  }

  /**
   * Find keys present in baseLanguage but missing in langCode
   */
  static async getMissingKeysForLanguage(langCode, baseLanguage = 'en') {
    const baseKeys = await db('localization_strings')
      .where('lang_code', baseLanguage)
      .select('key');

    const targetKeys = await db('localization_strings')
      .where('lang_code', langCode)
      .select('key');

    const targetSet = new Set(targetKeys.map(r => r.key));
    return baseKeys.filter(r => !targetSet.has(r.key)).map(r => r.key);
  }

  /**
   * Bump the version for a language (after import/update)
   */
  static async bumpVersion(langCode) {
    const updated = await db('localization_versions')
      .where('lang_code', langCode)
      .update({
        version: db.raw('version + 1'),
        updated_at: db.fn.now()
      });

    if (updated) {
      const row = await db('localization_versions')
        .where('lang_code', langCode)
        .first();
      return row.version;
    } else {
      await db('localization_versions')
        .insert({ lang_code: langCode, version: 1 });
      return 1;
    }
  }

  /**
   * Delete a single key for a language
   */
  static async deleteKey(key, langCode) {
    return db('localization_strings')
      .where({ key, lang_code: langCode })
      .del();
  }

  /**
   * Get all supported languages (from versions table)
   */
  static async getSupportedLanguages() {
    return db('localization_versions')
      .select('lang_code', 'version', 'updated_at')
      .orderBy('lang_code');
  }
}

module.exports = LocalizationString;
