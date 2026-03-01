const turf = require('@turf/turf');
const logger = require('./logger');

/**
 * 验证赛事边界GeoJSON
 * @param {Object|string} boundary - GeoJSON对象或字符串
 * @returns {Object} { valid: boolean, error?: string, sanitized?: Object }
 */
function validateEventBoundary(boundary) {
    try {
        // 1. 解析JSON
        const geojson = typeof boundary === 'string'
            ? JSON.parse(boundary)
            : boundary;

        // 2. 检查类型
        if (geojson.type !== 'Polygon') {
            return { valid: false, error: 'Event boundary must be a Polygon' };
        }

        // 3. 检查coordinates
        if (!geojson.coordinates || geojson.coordinates.length === 0) {
            return { valid: false, error: 'Invalid or empty coordinates' };
        }

        // 4. 检查闭合环（首尾坐标相同）
        const ring = geojson.coordinates[0];
        if (ring.length < 4) {
            return { valid: false, error: 'Polygon must have at least 4 coordinates' };
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            return { valid: false, error: 'Polygon ring is not closed' };
        }

        // 5. 检查坐标范围
        for (const coord of ring) {
            const [lng, lat] = coord;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return { valid: false, error: `Coordinates out of range: [${lng}, ${lat}]` };
            }
        }

        // 6. 使用Turf.js验证几何有效性
        const polygon = turf.polygon(geojson.coordinates);

        // 检查自相交
        const kinks = turf.kinks(polygon);
        if (kinks.features.length > 0) {
            return { valid: false, error: 'Polygon has self-intersections' };
        }

        // 7. 计算面积（防止极小或极大的多边形）
        const area = turf.area(polygon); // square meters
        if (area < 100) { // 小于100平方米
            return { valid: false, error: 'Event area too small (< 100 m²)' };
        }
        if (area > 1e10) { // 大于10,000 km²
            return { valid: false, error: 'Event area too large (> 10,000 km²)' };
        }

        return { valid: true, sanitized: geojson };

    } catch (err) {
        return { valid: false, error: `Invalid GeoJSON: ${err.message}` };
    }
}

/**
 * 验证点坐标是否有效
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {Object} { valid: boolean, error?: string }
 */
function validatePoint(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { valid: false, error: 'Coordinates must be numbers' };
    }

    if (isNaN(lat) || isNaN(lng)) {
        return { valid: false, error: 'Coordinates cannot be NaN' };
    }

    if (lat < -90 || lat > 90) {
        return { valid: false, error: `Latitude out of range: ${lat} (must be -90 to 90)` };
    }

    if (lng < -180 || lng > 180) {
        return { valid: false, error: `Longitude out of range: ${lng} (must be -180 to 180)` };
    }

    return { valid: true };
}

module.exports = {
    validateEventBoundary,
    validatePoint
};
