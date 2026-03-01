/**
 * Middleware to extract language preference from request.
 * Sets req.lang based on:
 * 1. ?lang= query parameter
 * 2. Accept-Language header
 * 3. Falls back to 'en'
 */

const SUPPORTED_LANGUAGES = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];

function extractLanguage(req, res, next) {
  // Check query param first
  if (req.query.lang && SUPPORTED_LANGUAGES.includes(req.query.lang)) {
    req.lang = req.query.lang;
    return next();
  }

  // Check Accept-Language header
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    // Simple parsing: take the first matching language
    const parts = acceptLang.split(',').map(p => p.trim().split(';')[0].trim());
    for (const part of parts) {
      if (SUPPORTED_LANGUAGES.includes(part)) {
        req.lang = part;
        return next();
      }
      // Try base language match (e.g., "zh" -> "zh-Hans")
      const base = part.split('-')[0];
      const match = SUPPORTED_LANGUAGES.find(l => l.startsWith(base));
      if (match) {
        req.lang = match;
        return next();
      }
    }
  }

  req.lang = 'en';
  next();
}

module.exports = { extractLanguage, SUPPORTED_LANGUAGES };
