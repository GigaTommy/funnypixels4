const { validateEventBoundary, validatePoint } = require('../../utils/geojsonValidator');

describe('GeoJSON Validator', () => {
    describe('validateEventBoundary', () => {
        it('should accept valid polygon', () => {
            const validPolygon = {
                type: 'Polygon',
                coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
            };
            const result = validateEventBoundary(validPolygon);
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBeDefined();
        });

        it('should accept valid polygon as JSON string', () => {
            const validPolygon = JSON.stringify({
                type: 'Polygon',
                coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
            });
            const result = validateEventBoundary(validPolygon);
            expect(result.valid).toBe(true);
        });

        it('should reject self-intersecting polygon', () => {
            const invalid = {
                type: 'Polygon',
                coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]] // self-intersection
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('self-intersect');
        });

        it('should reject out-of-range coordinates', () => {
            const invalid = {
                type: 'Polygon',
                coordinates: [[[200, 30], [201, 30], [201, 31], [200, 31], [200, 30]]]
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('out of range');
        });

        it('should reject non-closed ring', () => {
            const invalid = {
                type: 'Polygon',
                coordinates: [[[120, 30], [121, 30], [121, 31], [120, 31]]] // not closed
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not closed');
        });

        it('should reject polygon with insufficient coordinates', () => {
            const invalid = {
                type: 'Polygon',
                coordinates: [[[120, 30], [121, 30], [120, 30]]] // only 3 points
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
        });

        it('should reject non-Polygon types', () => {
            const invalid = {
                type: 'Point',
                coordinates: [120, 30]
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a Polygon');
        });

        it('should reject polygon with area too small', () => {
            // Very tiny polygon (< 100 m²) - approximately 1m x 1m
            const invalid = {
                type: 'Polygon',
                coordinates: [[[120.0, 30.0], [120.00001, 30.0], [120.00001, 30.00001], [120.0, 30.00001], [120.0, 30.0]]]
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('too small');
        });

        it('should reject empty coordinates', () => {
            const invalid = {
                type: 'Polygon',
                coordinates: []
            };
            const result = validateEventBoundary(invalid);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should reject invalid JSON', () => {
            const result = validateEventBoundary('invalid json {');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid GeoJSON');
        });
    });

    describe('validatePoint', () => {
        it('should accept valid coordinates', () => {
            const result = validatePoint(30.2489, 120.1365);
            expect(result.valid).toBe(true);
        });

        it('should accept boundary coordinates', () => {
            expect(validatePoint(-90, -180).valid).toBe(true);
            expect(validatePoint(90, 180).valid).toBe(true);
            expect(validatePoint(0, 0).valid).toBe(true);
        });

        it('should reject latitude out of range', () => {
            expect(validatePoint(91, 120).valid).toBe(false);
            expect(validatePoint(-91, 120).valid).toBe(false);
        });

        it('should reject longitude out of range', () => {
            expect(validatePoint(30, 181).valid).toBe(false);
            expect(validatePoint(30, -181).valid).toBe(false);
        });

        it('should reject non-number coordinates', () => {
            expect(validatePoint('30', 120).valid).toBe(false);
            expect(validatePoint(30, '120').valid).toBe(false);
        });

        it('should reject NaN coordinates', () => {
            expect(validatePoint(NaN, 120).valid).toBe(false);
            expect(validatePoint(30, NaN).valid).toBe(false);
        });
    });
});
