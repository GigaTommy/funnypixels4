
const express = require('express');
const router = express.Router();
const presetRegionService = require('../../services/presetRegionService');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

/**
 * Search regions via Amap POI API
 * GET /api/admin/regions/search?keyword=西湖&city=杭州
 */
router.get('/search', async (req, res) => {
    try {
        const { keyword, city } = req.query;
        if (!keyword) {
            return res.status(400).json({ success: false, message: 'Keyword is required' });
        }
        const results = await presetRegionService.searchRegions(keyword, city);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Region search error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Get region boundary by adcode (Amap administrative code)
 * GET /api/admin/regions/boundary/:adcode
 */
router.get('/boundary/:adcode', async (req, res) => {
    try {
        const { adcode } = req.params;
        const boundary = await presetRegionService.fetchDistrictBoundary(adcode);
        if (!boundary) {
            return res.status(404).json({ success: false, message: 'Boundary not found' });
        }
        res.json({ success: true, data: boundary });
    } catch (error) {
        console.error('Fetch boundary error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Search and get boundary in one call
 * GET /api/admin/regions/search-with-boundary?keyword=西湖&city=杭州
 */
router.get('/search-with-boundary', async (req, res) => {
    try {
        const { keyword, city } = req.query;
        if (!keyword) {
            return res.status(400).json({ success: false, message: 'Keyword is required' });
        }
        const result = await presetRegionService.searchAndGetBoundary(keyword, city);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Region not found' });
        }
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Search with boundary error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * List preset regions
 * GET /api/admin/regions/presets?category=park&city=杭州&page=1&pageSize=20
 */
router.get('/presets', async (req, res) => {
    try {
        const { category, level, city, source, is_featured, page, pageSize, keyword } = req.query;
        const result = await presetRegionService.listPresetRegions({
            category,
            level,
            city,
            source,
            is_featured: is_featured === 'true' ? true : is_featured === 'false' ? false : undefined,
            page: parseInt(page) || 1,
            pageSize: parseInt(pageSize) || 20,
            keyword
        });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('List preset regions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Get single preset region
 * GET /api/admin/regions/presets/:id
 */
router.get('/presets/:id', async (req, res) => {
    try {
        const region = await presetRegionService.getPresetRegion(req.params.id);
        if (!region) {
            return res.status(404).json({ success: false, message: 'Preset region not found' });
        }
        res.json({ success: true, data: region });
    } catch (error) {
        console.error('Get preset region error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Save a preset region
 * POST /api/admin/regions/presets
 */
router.post('/presets', async (req, res) => {
    try {
        const regionData = req.body;
        if (!regionData.name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        const region = await presetRegionService.savePresetRegion(regionData);
        res.json({ success: true, data: region });
    } catch (error) {
        console.error('Save preset region error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Update a preset region
 * PUT /api/admin/regions/presets/:id
 */
router.put('/presets/:id', async (req, res) => {
    try {
        const region = await presetRegionService.updatePresetRegion(req.params.id, req.body);
        if (!region) {
            return res.status(404).json({ success: false, message: 'Preset region not found' });
        }
        res.json({ success: true, data: region });
    } catch (error) {
        console.error('Update preset region error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Delete a preset region
 * DELETE /api/admin/regions/presets/:id
 */
router.delete('/presets/:id', async (req, res) => {
    try {
        await presetRegionService.deletePresetRegion(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete preset region error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Import region from Amap search result directly to presets
 * POST /api/admin/regions/import-from-amap
 * Body: { keyword, city, category?, tags? }
 */
router.post('/import-from-amap', async (req, res) => {
    try {
        const { keyword, city, category, tags } = req.body;
        if (!keyword) {
            return res.status(400).json({ success: false, message: 'Keyword is required' });
        }

        // Search and get boundary
        const searchResult = await presetRegionService.searchAndGetBoundary(keyword, city);
        if (!searchResult || !searchResult.boundary) {
            return res.status(404).json({ success: false, message: 'Region boundary not found' });
        }

        // Save as preset region
        const regionData = {
            name: searchResult.name,
            code: searchResult.adcode,
            level: searchResult.level,
            category: category || 'poi_area',
            boundary: searchResult.boundary,
            center_lat: searchResult.center?.lat,
            center_lng: searchResult.center?.lng,
            source: 'amap',
            source_id: searchResult.id,
            source_name: searchResult.name,
            address: searchResult.address,
            city: searchResult.cityname || city,
            province: searchResult.pname,
            tags: tags || []
        };

        const region = await presetRegionService.savePresetRegion(regionData);
        res.json({ success: true, data: region });
    } catch (error) {
        console.error('Import from Amap error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Get featured regions for quick selection
 * GET /api/admin/regions/featured?city=杭州
 */
router.get('/featured', async (req, res) => {
    try {
        const { city } = req.query;
        const result = await presetRegionService.listPresetRegions({
            is_featured: true,
            city,
            pageSize: 50
        });
        res.json({ success: true, data: result.list });
    } catch (error) {
        console.error('Get featured regions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Toggle featured status
 * POST /api/admin/regions/presets/:id/toggle-featured
 */
router.post('/presets/:id/toggle-featured', async (req, res) => {
    try {
        const region = await presetRegionService.getPresetRegion(req.params.id);
        if (!region) {
            return res.status(404).json({ success: false, message: 'Preset region not found' });
        }
        const updated = await presetRegionService.updatePresetRegion(req.params.id, {
            is_featured: !region.is_featured
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Toggle featured error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
