
import request from './request'

export interface PresetRegion {
    id: number
    name: string
    code?: string
    level?: string
    category?: string
    boundary?: any // GeoJSON
    center_lat?: number
    center_lng?: number
    area_km2?: number
    source?: string
    source_id?: string
    source_name?: string
    tags?: string[]
    description?: string
    address?: string
    city?: string
    province?: string
    color?: string
    icon_url?: string
    cover_url?: string
    usage_count?: number
    is_active?: boolean
    is_featured?: boolean
    sort_order?: number
    created_at?: string
    updated_at?: string
}

export interface RegionSearchResult {
    name: string
    source_id: string
    source: string
    address: string
    city: string
    province: string
    adcode: string
    category: string
    center_lng: number
    center_lat: number
    level: string
    tags: string[]
    boundary?: any
}

export interface RegionSearchParams {
    keyword: string
    city?: string
}

export interface PresetRegionListParams {
    category?: string
    level?: string
    city?: string
    source?: string
    is_featured?: boolean
    page?: number
    pageSize?: number
    keyword?: string
}

export const regionService = {
    // Search regions via Amap API
    searchRegions: async (params: RegionSearchParams) => {
        const response = await request.get('/admin/regions/search', { params })
        return response.data.data as RegionSearchResult[]
    },

    // Get boundary for a specific adcode
    getBoundary: async (adcode: string) => {
        const response = await request.get(`/admin/regions/boundary/${adcode}`)
        return response.data.data
    },

    // Search and get boundary in one call
    searchWithBoundary: async (params: RegionSearchParams) => {
        const response = await request.get('/admin/regions/search-with-boundary', { params })
        return response.data.data
    },

    // List preset regions
    listPresetRegions: async (params: PresetRegionListParams) => {
        const response = await request.get('/admin/regions/presets', { params })
        return response.data.data
    },

    // Get single preset region
    getPresetRegion: async (id: number) => {
        const response = await request.get(`/admin/regions/presets/${id}`)
        return response.data.data as PresetRegion
    },

    // Save preset region
    savePresetRegion: async (data: Partial<PresetRegion>) => {
        const response = await request.post('/admin/regions/presets', data)
        return response.data.data as PresetRegion
    },

    // Update preset region
    updatePresetRegion: async (id: number, data: Partial<PresetRegion>) => {
        const response = await request.put(`/admin/regions/presets/${id}`, data)
        return response.data.data as PresetRegion
    },

    // Delete preset region
    deletePresetRegion: async (id: number) => {
        const response = await request.delete(`/admin/regions/presets/${id}`)
        return response.data
    },

    // Import from Amap search result
    importFromAmap: async (data: { keyword: string; city?: string; category?: string; tags?: string[] }) => {
        const response = await request.post('/admin/regions/import-from-amap', data)
        return response.data.data as PresetRegion
    },

    // Get featured regions
    getFeaturedRegions: async (city?: string) => {
        const response = await request.get('/admin/regions/featured', { params: { city } })
        return response.data.data as PresetRegion[]
    },

    // Toggle featured status
    toggleFeatured: async (id: number) => {
        const response = await request.post(`/admin/regions/presets/${id}/toggle-featured`)
        return response.data.data as PresetRegion
    }
}
