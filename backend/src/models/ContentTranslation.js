const { db } = require('../config/database');

class ContentTranslation {
  /**
   * Get all translations for a content type + ID + language
   */
  static async getTranslations(contentType, contentId, langCode) {
    const rows = await db('content_translations')
      .where({ content_type: contentType, content_id: contentId, lang_code: langCode });
    const map = {};
    for (const row of rows) {
      map[row.field_name] = row.value;
    }
    return map;
  }

  /**
   * Apply translations to an array of items.
   * Falls back to original values when no translation exists.
   * @param {string} contentType - e.g. 'achievement', 'event', 'store_item', 'announcement'
   * @param {Array} items - array of objects with `id` field
   * @param {string} langCode - target language
   * @param {string[]} fields - field names to translate (e.g. ['name', 'description'])
   */
  static async applyTranslations(contentType, items, langCode, fields = ['name', 'description']) {
    if (!items || items.length === 0 || !langCode || langCode === 'en') {
      return items;
    }

    const ids = items.map(item => item.id).filter(id => id != null);
    if (ids.length === 0) return items;
    const rows = await db('content_translations')
      .where('content_type', contentType)
      .whereIn('content_id', ids)
      .where('lang_code', langCode)
      .whereIn('field_name', fields);

    // Build lookup: { contentId: { fieldName: value } }
    const lookup = {};
    for (const row of rows) {
      if (!lookup[row.content_id]) lookup[row.content_id] = {};
      lookup[row.content_id][row.field_name] = row.value;
    }

    // Apply translations
    return items.map(item => {
      const translations = lookup[item.id];
      if (!translations) return item;
      const translated = { ...item };
      for (const field of fields) {
        if (translations[field]) {
          translated[field] = translations[field];
        }
      }
      return translated;
    });
  }

  /**
   * Upsert a single translation
   */
  static async upsert(contentType, contentId, langCode, fieldName, value) {
    await db('content_translations')
      .insert({ content_type: contentType, content_id: contentId, lang_code: langCode, field_name: fieldName, value })
      .onConflict(['content_type', 'content_id', 'lang_code', 'field_name'])
      .merge({ value, updated_at: db.fn.now() });
  }

  /**
   * Bulk upsert translations
   */
  static async bulkUpsert(entries) {
    if (!entries || entries.length === 0) return 0;

    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await db('content_translations')
        .insert(batch)
        .onConflict(['content_type', 'content_id', 'lang_code', 'field_name'])
        .merge({
          value: db.raw('EXCLUDED.value'),
          updated_at: db.fn.now()
        });
    }

    return entries.length;
  }

  /**
   * Delete all translations for a content item
   */
  static async deleteForContent(contentType, contentId) {
    return db('content_translations')
      .where({ content_type: contentType, content_id: contentId })
      .del();
  }
}

module.exports = ContentTranslation;
