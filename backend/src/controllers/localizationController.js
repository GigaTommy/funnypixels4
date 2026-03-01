const LocalizationService = require('../services/localizationService');
const LocalizationString = require('../models/LocalizationString');
const logger = require('../utils/logger');
const { SUPPORTED_LANGUAGES } = require('../middleware/localization');

const localizationController = {
  /**
   * GET /api/v1/localization?lang=xx&version=yy
   * Public endpoint: returns localization bundle for a language
   */
  async getBundle(req, res) {
    try {
      const lang = req.query.lang || 'en';
      if (!SUPPORTED_LANGUAGES.includes(lang)) {
        return res.status(400).json({ error: `Unsupported language: ${lang}` });
      }
      const version = req.query.version ? parseInt(req.query.version, 10) : null;

      const bundle = await LocalizationService.getBundle(lang, version);
      res.json(bundle);
    } catch (error) {
      logger.error('Failed to get localization bundle', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch localization bundle' });
    }
  },

  /**
   * GET /api/v1/localization/languages
   * Public endpoint: returns list of supported languages
   */
  async getLanguages(req, res) {
    try {
      const languages = await LocalizationString.getSupportedLanguages();
      res.json({
        languages: languages.map(l => ({
          code: l.lang_code,
          version: l.version,
          updated_at: l.updated_at
        }))
      });
    } catch (error) {
      logger.error('Failed to get supported languages', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch languages' });
    }
  },

  // ---- Admin endpoints ----

  /**
   * GET /api/v1/admin/localization/strings?lang=xx
   * List all strings for a language
   */
  async adminListStrings(req, res) {
    try {
      const lang = req.query.lang || 'en';
      const strings = await LocalizationString.getAllForLanguage(lang);
      res.json({ lang, count: strings.length, strings });
    } catch (error) {
      logger.error('Admin: failed to list strings', { error: error.message });
      res.status(500).json({ error: 'Failed to list strings' });
    }
  },

  /**
   * PUT /api/v1/admin/localization/strings
   * Upsert a single string
   */
  async adminUpsertString(req, res) {
    try {
      const { key, lang_code, value, context } = req.body;
      if (!key || !lang_code || !value) {
        return res.status(400).json({ error: 'key, lang_code, and value are required' });
      }
      await LocalizationString.upsert(key, lang_code, value, context);
      await LocalizationString.bumpVersion(lang_code);
      await LocalizationService.invalidateCache(lang_code);
      res.json({ success: true });
    } catch (error) {
      logger.error('Admin: failed to upsert string', { error: error.message });
      res.status(500).json({ error: 'Failed to upsert string' });
    }
  },

  /**
   * POST /api/v1/admin/localization/bulk-upsert
   * Bulk upsert strings
   */
  async adminBulkUpsert(req, res) {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: 'entries must be an array' });
      }
      if (entries.length > 10000) {
        return res.status(400).json({ error: 'entries array too large, maximum 10000 entries per request' });
      }
      const invalid = entries.find(e => !e.key || !e.lang_code || !e.value);
      if (invalid) {
        return res.status(400).json({ error: 'Each entry must have key, lang_code, and value fields' });
      }
      const count = await LocalizationString.bulkUpsert(entries);
      // Bump version and invalidate cache for each affected language
      const affectedLangs = [...new Set(entries.map(e => e.lang_code).filter(Boolean))];
      for (const lang of affectedLangs) {
        await LocalizationString.bumpVersion(lang);
        await LocalizationService.invalidateCache(lang);
      }
      res.json({ success: true, count });
    } catch (error) {
      logger.error('Admin: failed to bulk upsert', { error: error.message });
      res.status(500).json({ error: 'Failed to bulk upsert' });
    }
  },

  /**
   * DELETE /api/v1/admin/localization/strings
   * Delete a single string
   */
  async adminDeleteString(req, res) {
    try {
      const { key, lang_code } = req.body;
      if (!key || !lang_code) {
        return res.status(400).json({ error: 'key and lang_code are required' });
      }
      const deleted = await LocalizationString.deleteKey(key, lang_code);
      if (deleted > 0) {
        await LocalizationString.bumpVersion(lang_code);
        await LocalizationService.invalidateCache(lang_code);
      }
      res.json({ success: true, deleted });
    } catch (error) {
      logger.error('Admin: failed to delete string', { error: error.message });
      res.status(500).json({ error: 'Failed to delete string' });
    }
  },

  /**
   * POST /api/v1/admin/localization/import/json
   * Import a JSON bundle for a language
   */
  async adminImportJSON(req, res) {
    try {
      const { lang_code, data } = req.body;
      if (!lang_code || !data || typeof data !== 'object') {
        return res.status(400).json({ error: 'lang_code and data object are required' });
      }
      const count = await LocalizationService.importFromJSON(lang_code, data);
      res.json({ success: true, lang_code, imported: count });
    } catch (error) {
      logger.error('Admin: failed to import JSON', { error: error.message });
      res.status(500).json({ error: 'Failed to import' });
    }
  },

  /**
   * GET /api/v1/admin/localization/export/json?lang=xx
   * Export a language bundle as JSON
   */
  async adminExportJSON(req, res) {
    try {
      const lang = req.query.lang || 'en';
      const data = await LocalizationService.exportToJSON(lang);
      res.json(data);
    } catch (error) {
      logger.error('Admin: failed to export JSON', { error: error.message });
      res.status(500).json({ error: 'Failed to export' });
    }
  },

  /**
   * GET /api/v1/admin/localization/export/xliff?lang=xx&base=en
   * Export XLIFF for translation tools
   */
  async adminExportXLIFF(req, res) {
    try {
      const lang = req.query.lang || 'ja';
      const base = req.query.base || 'en';
      const xliff = await LocalizationService.exportToXLIFF(lang, base);
      res.set('Content-Type', 'application/xml');
      res.set('Content-Disposition', `attachment; filename="localization_${lang}.xliff"`);
      res.send(xliff);
    } catch (error) {
      logger.error('Admin: failed to export XLIFF', { error: error.message });
      res.status(500).json({ error: 'Failed to export XLIFF' });
    }
  },

  /**
   * POST /api/v1/admin/localization/import/xliff
   * Import XLIFF data
   */
  async adminImportXLIFF(req, res) {
    try {
      const { xliff } = req.body;
      if (!xliff) {
        return res.status(400).json({ error: 'xliff data is required' });
      }
      const result = await LocalizationService.importFromXLIFF(xliff);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Admin: failed to import XLIFF', { error: error.message });
      res.status(500).json({ error: 'Failed to import XLIFF' });
    }
  },

  /**
   * GET /api/v1/admin/localization/missing?lang=xx&base=en
   * Check for missing keys in a language compared to base
   */
  async adminCheckMissing(req, res) {
    try {
      const lang = req.query.lang;
      const base = req.query.base || 'en';
      if (!lang) {
        return res.status(400).json({ error: 'lang is required' });
      }
      const missing = await LocalizationString.getMissingKeysForLanguage(lang, base);
      res.json({ lang, base, missing_count: missing.length, missing });
    } catch (error) {
      logger.error('Admin: failed to check missing keys', { error: error.message });
      res.status(500).json({ error: 'Failed to check missing keys' });
    }
  },

  /**
   * POST /api/v1/admin/localization/bump-version
   * Manually bump version for a language
   */
  async adminBumpVersion(req, res) {
    try {
      const { lang_code } = req.body;
      if (!lang_code) {
        return res.status(400).json({ error: 'lang_code is required' });
      }
      const newVersion = await LocalizationString.bumpVersion(lang_code);
      await LocalizationService.invalidateCache(lang_code);
      res.json({ success: true, lang_code, version: newVersion });
    } catch (error) {
      logger.error('Admin: failed to bump version', { error: error.message });
      res.status(500).json({ error: 'Failed to bump version' });
    }
  }
};

module.exports = localizationController;
