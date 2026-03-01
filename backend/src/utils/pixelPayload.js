const DEFAULT_COLOR = '#4ECDC4'; // 默认绿色，与iOS前端一致

// 导入网格计算函数
const { calculateGridId } = require('../../shared/utils/gridUtils');

function parseNumber(value, fallback = 0, { integer = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = integer ? parseInt(value, 10) : parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function resolveBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return Boolean(value);
}

function normalizePixelWritePayload(payload, context = {}) {
  const rawLatitude = payload.latitude ?? payload.lat;
  const rawLongitude = payload.longitude ?? payload.lng;

  const latitude = typeof rawLatitude === 'string' ? parseFloat(rawLatitude) : rawLatitude;
  const longitude = typeof rawLongitude === 'string' ? parseFloat(rawLongitude) : rawLongitude;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude value');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude value');
  }

  const userId = payload.userId ?? context.userId;
  if (!userId) {
    throw new Error('Missing userId for pixel write');
  }

  const drawType = payload.drawType ?? context.drawType ?? 'manual';

  // 🔧 修复：生成grid_id
  const gridId = calculateGridId(latitude, longitude);

  return {
    latitude,
    longitude,
    userId,
    drawType,
    gridId, // 🎉 添加缺失的gridId字段
    color: payload.color ?? context.color ?? null,
    patternId: payload.patternId ?? payload.pattern_id ?? context.patternId ?? null,
    anchorX: parseNumber(payload.anchorX ?? payload.pattern_anchor_x ?? context.anchorX, 0, { integer: true }),
    anchorY: parseNumber(payload.anchorY ?? payload.pattern_anchor_y ?? context.anchorY, 0, { integer: true }),
    rotation: parseNumber(payload.rotation ?? payload.pattern_rotation ?? context.rotation, 0),
    mirror: resolveBoolean(payload.mirror ?? payload.pattern_mirror ?? context.mirror, false),
    pixelType: payload.pixelType ?? payload.pixel_type ?? context.pixelType ?? 'basic',
    relatedId: payload.relatedId ?? payload.related_id ?? context.relatedId ?? null,
    sessionId: payload.sessionId ?? payload.session_id ?? context.sessionId ?? null, // 🆕 添加session_id字段
    allianceId: payload.allianceId ?? payload.alliance_id ?? context.allianceId ?? null // 🆕 添加alliance_id字段
  };
}

function applyDefaultsToPixel(pixel) {
  return {
    ...pixel,
    color: pixel.color || DEFAULT_COLOR
  };
}

module.exports = {
  DEFAULT_COLOR,
  normalizePixelWritePayload,
  applyDefaultsToPixel
};
