/**
 * Geo Utilities
 *
 * Provides geographic calculation helpers
 */

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a point is within a circle
 */
function isPointInCircle(pointLat, pointLng, centerLat, centerLng, radiusMeters) {
  const distance = calculateDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusMeters;
}

/**
 * Generate random point within radius
 */
function randomPointInRadius(centerLat, centerLng, radiusMeters) {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusMeters;

  const latOffset = (distance * Math.cos(angle)) / 111320;
  const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));

  return {
    lat: centerLat + latOffset,
    lng: centerLng + lngOffset
  };
}

module.exports = {
  calculateDistance,
  isPointInCircle,
  randomPointInRadius
};
