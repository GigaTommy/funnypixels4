const {
    snapToGrid,
    calculateGridId,
    isValidCoordinate,
    gridIndexToLatLng,
    isValidGridId,
    parseGridId
} = require('../../utils/gridUtils');

describe('Grid Utils', () => {
    describe('snapToGrid', () => {
        it('should snap coordinates to 0.0001 degree grid', () => {
            const result = snapToGrid(30.24891, 120.13654);
            expect(result.lat).toBe(30.2489);
            expect(result.lng).toBe(120.1365);
            expect(result.gridId).toMatch(/^grid_\d+_\d+$/);
        });

        it('should handle boundary pixels correctly', () => {
            const result = snapToGrid(0.00001, 0.00001);
            expect(result.lat).toBe(0.0000);
            expect(result.lng).toBe(0.0000);
        });

        it('should handle negative coordinates', () => {
            const result = snapToGrid(-30.24891, -120.13654);
            // Floor behavior for negative numbers
            expect(result.lat).toBeCloseTo(-30.249, 3);
            expect(result.lng).toBeCloseTo(-120.1366, 4);
            expect(result.gridId).toMatch(/^grid_\d+_\d+$/);
        });

        it('should be reversible with gridIndexToLatLng', () => {
            const original = { lat: 30.2489, lng: 120.1365 };
            const snapped = snapToGrid(original.lat, original.lng);
            const reversed = gridIndexToLatLng(snapped.gridIndex.x, snapped.gridIndex.y);

            expect(reversed.lat).toBeCloseTo(snapped.lat, 6);
            expect(reversed.lng).toBeCloseTo(snapped.lng, 6);
        });

        it('should return grid index', () => {
            const result = snapToGrid(30.2489, 120.1365);
            expect(result.gridIndex).toBeDefined();
            expect(result.gridIndex.x).toBeGreaterThan(0);
            expect(result.gridIndex.y).toBeGreaterThan(0);
        });

        it('should handle extreme coordinates', () => {
            const north = snapToGrid(89.9999, 0);
            expect(north.lat).toBeLessThanOrEqual(90);

            const south = snapToGrid(-89.9999, 0);
            expect(south.lat).toBeGreaterThanOrEqual(-90);

            const east = snapToGrid(0, 179.9999);
            expect(east.lng).toBeLessThanOrEqual(180);

            const west = snapToGrid(0, -179.9999);
            expect(west.lng).toBeGreaterThanOrEqual(-180);
        });
    });

    describe('calculateGridId', () => {
        it('should calculate grid ID correctly', () => {
            const gridId = calculateGridId(30.2489, 120.1365);
            expect(gridId).toMatch(/^grid_\d+_\d+$/);
        });

        it('should match snapToGrid result', () => {
            const lat = 30.2489;
            const lng = 120.1365;
            const snapped = snapToGrid(lat, lng);
            const calculated = calculateGridId(lat, lng);
            expect(calculated).toBe(snapped.gridId);
        });

        it('should handle negative coordinates', () => {
            const gridId = calculateGridId(-30.2489, -120.1365);
            // Grid indices are always positive due to offset calculation
            expect(gridId).toMatch(/^grid_\d+_\d+$/);
            expect(gridId).toBeTruthy();
        });
    });

    describe('isValidCoordinate', () => {
        it('should accept valid coordinates', () => {
            expect(isValidCoordinate(30.2489, 120.1365)).toBe(true);
            expect(isValidCoordinate(0, 0)).toBe(true);
            expect(isValidCoordinate(-90, -180)).toBe(true);
            expect(isValidCoordinate(90, 180)).toBe(true);
        });

        it('should reject out of range coordinates', () => {
            expect(isValidCoordinate(91, 0)).toBe(false);
            expect(isValidCoordinate(-91, 0)).toBe(false);
            expect(isValidCoordinate(0, 181)).toBe(false);
            expect(isValidCoordinate(0, -181)).toBe(false);
        });

        it('should reject non-number coordinates', () => {
            expect(isValidCoordinate('30', 120)).toBe(false);
            expect(isValidCoordinate(30, '120')).toBe(false);
            expect(isValidCoordinate(null, 120)).toBe(false);
            expect(isValidCoordinate(30, undefined)).toBe(false);
        });

        it('should reject NaN coordinates', () => {
            expect(isValidCoordinate(NaN, 120)).toBe(false);
            expect(isValidCoordinate(30, NaN)).toBe(false);
        });
    });

    describe('gridIndexToLatLng', () => {
        it('should convert grid index to lat/lng', () => {
            // First snap to get the actual grid indices
            const snapped = snapToGrid(30.2489, 120.1365);
            const result = gridIndexToLatLng(snapped.gridIndex.x, snapped.gridIndex.y);
            // Should match the snapped coordinates
            expect(result.lat).toBe(snapped.lat);
            expect(result.lng).toBe(snapped.lng);
        });

        it('should handle zero index', () => {
            const result = gridIndexToLatLng(0, 0);
            expect(result.lat).toBe(-90.0);
            expect(result.lng).toBe(-180.0);
        });

        it('should handle negative indices', () => {
            const result = gridIndexToLatLng(-100, -200);
            expect(result.lat).toBeCloseTo(-90.02, 2);
            expect(result.lng).toBeCloseTo(-180.01, 2);
        });

        it('should round trip with snapToGrid', () => {
            const original = snapToGrid(30.2489, 120.1365);
            const reversed = gridIndexToLatLng(original.gridIndex.x, original.gridIndex.y);
            expect(reversed.lat).toBeCloseTo(original.lat, 6);
            expect(reversed.lng).toBeCloseTo(original.lng, 6);
        });
    });

    describe('isValidGridId', () => {
        it('should accept valid grid IDs', () => {
            expect(isValidGridId('grid_1201365_1202489')).toBe(true);
            expect(isValidGridId('grid_0_0')).toBe(true);
            expect(isValidGridId('grid_-100_-200')).toBe(true);
        });

        it('should reject invalid grid IDs', () => {
            expect(isValidGridId('invalid')).toBe(false);
            expect(isValidGridId('grid_abc_def')).toBe(false);
            expect(isValidGridId('grid_123')).toBe(false);
            expect(isValidGridId('123_456')).toBe(false);
            expect(isValidGridId(null)).toBe(false);
            expect(isValidGridId(undefined)).toBe(false);
            expect(isValidGridId(123)).toBe(false);
        });

        it('should reject grid IDs with extra characters', () => {
            expect(isValidGridId('grid_123_456_extra')).toBe(false);
            expect(isValidGridId('prefix_grid_123_456')).toBe(false);
        });
    });

    describe('parseGridId', () => {
        it('should parse valid grid ID', () => {
            const result = parseGridId('grid_1201365_1202489');
            expect(result).toEqual({ x: 1201365, y: 1202489 });
        });

        it('should handle negative indices', () => {
            const result = parseGridId('grid_-100_-200');
            expect(result).toEqual({ x: -100, y: -200 });
        });

        it('should handle zero indices', () => {
            const result = parseGridId('grid_0_0');
            expect(result).toEqual({ x: 0, y: 0 });
        });

        it('should return null for invalid grid ID', () => {
            expect(parseGridId('invalid')).toBeNull();
            expect(parseGridId('grid_abc_def')).toBeNull();
            expect(parseGridId('grid_123')).toBeNull();
            expect(parseGridId(null)).toBeNull();
        });

        it('should match snapToGrid indices', () => {
            const snapped = snapToGrid(30.2489, 120.1365);
            const parsed = parseGridId(snapped.gridId);
            expect(parsed.x).toBe(snapped.gridIndex.x);
            expect(parsed.y).toBe(snapped.gridIndex.y);
        });
    });
});
