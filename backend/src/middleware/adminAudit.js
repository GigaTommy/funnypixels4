const AdminAuditLog = require('../models/AdminAuditLog');
const logger = require('../utils/logger');

// Sensitive fields to filter from request body
const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'secret', 'access_token', 'refresh_token'];

// Parse module and action from URL path
function parseRouteInfo(method, path) {
  // Remove /api/admin/ prefix
  const cleanPath = path.replace(/^\/api\/admin\//, '');
  const parts = cleanPath.split('/').filter(Boolean);

  let module = parts[0] || 'unknown';
  let action = 'unknown';
  let target_type = null;
  let target_id = null;

  // Map module names
  const moduleMap = {
    'users': 'user',
    'alliances': 'alliance',
    'achievements': 'achievement',
    'announcements': 'announcement',
    'ads': 'ad',
    'custom-flags': 'custom_flag',
    'checkin': 'checkin',
    'challenges': 'challenge',
    'payment': 'payment',
    'feedback': 'feedback',
    'audit-logs': 'audit',
    'system-messages': 'system_mail',
    'reports': 'report',
    'roles': 'role',
    'store-orders': 'order',
    'products': 'product',
    'events': 'event',
    'regions': 'region',
    'todos': 'todo'
  };

  module = moduleMap[module] || module;

  // Determine action based on method and path
  if (method === 'POST') {
    if (cleanPath.includes('approve')) action = 'approve';
    else if (cleanPath.includes('reject')) action = 'reject';
    else if (cleanPath.includes('ban')) action = 'ban';
    else if (cleanPath.includes('unban')) action = 'unban';
    else if (cleanPath.includes('warn')) action = 'warn';
    else if (cleanPath.includes('suspend')) action = 'suspend';
    else if (cleanPath.includes('disband')) action = 'disband';
    else if (cleanPath.includes('kick')) action = 'kick';
    else if (cleanPath.includes('refund')) action = 'refund';
    else if (cleanPath.includes('reply')) action = 'reply';
    else action = 'create';
  } else if (method === 'PUT' || method === 'PATCH') {
    if (cleanPath.includes('toggle')) action = 'toggle';
    else if (cleanPath.includes('status')) action = 'update_status';
    else action = 'update';
  } else if (method === 'DELETE') {
    action = 'delete';
  }

  // Extract target ID (UUID or numeric ID in URL)
  const idMatch = cleanPath.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)/i);
  if (idMatch) {
    target_id = idMatch[1];
    target_type = module;
  }

  return { module, action, target_type, target_id };
}

// Filter sensitive fields from request body
function filterSensitiveData(body) {
  if (!body || typeof body !== 'object') return body;
  const filtered = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (filtered[field]) {
      filtered[field] = '***FILTERED***';
    }
  }
  return filtered;
}

function adminAuditMiddleware(req, res, next) {
  // Only intercept write operations
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Skip auth routes
  if (req.path.includes('/auth/')) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    // Async write - don't block response
    setImmediate(async () => {
      try {
        const { module, action, target_type, target_id } = parseRouteInfo(req.method, req.originalUrl);
        const filteredBody = filterSensitiveData(req.body);

        await AdminAuditLog.create({
          admin_id: req.user?.id,
          admin_name: req.user?.display_name || req.user?.username,
          action,
          module,
          target_type,
          target_id,
          description: `${req.method} ${req.originalUrl}`,
          request_method: req.method,
          request_path: req.originalUrl,
          request_body: filteredBody,
          response_status: res.statusCode,
          ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress
        });
      } catch (error) {
        logger.error('Failed to write audit log:', error);
      }
    });
  });

  next();
}

module.exports = adminAuditMiddleware;
