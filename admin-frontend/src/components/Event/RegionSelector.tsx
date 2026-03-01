
import React, { useState, useEffect, useCallback } from 'react'
import { Card, Segmented, Input, List, Button, Space, Tag, Empty, Spin, message, Typography } from 'antd'
import { SearchOutlined, EnvironmentOutlined, StarOutlined, StarFilled, PlusOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { regionService, RegionSearchResult, PresetRegion } from '@/services/region'
import { debounce } from 'lodash-es'

const { Text } = Typography

// Fix Leaflet Default Icon
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

interface RegionSelectorProps {
    value?: any // GeoJSON
    onChange?: (value: any) => void
}

// Map Controller
const MapController: React.FC<{ center?: [number, number]; zoom?: number; boundary?: any }> = ({ center, zoom, boundary }) => {
    const map = useMap()

    useEffect(() => {
        if (boundary) {
            try {
                const geoJson = L.geoJSON(boundary)
                const bounds = geoJson.getBounds()
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50] })
                }
            } catch (e) {
                console.error('Failed to fit bounds:', e)
            }
        } else if (center) {
            map.setView(center, zoom || 13)
        }
    }, [center, zoom, boundary, map])

    return null
}

// Draw Control Component for manual drawing mode
const DrawControl: React.FC<{ onChange: (val: any) => void; initialValue?: any }> = ({ onChange, initialValue }) => {
    const map = useMap()
    const mounted = React.useRef(false)
    const drawnItemsRef = React.useRef<L.FeatureGroup | null>(null)

    useEffect(() => {
        if (mounted.current) return
        mounted.current = true

        const drawnItems = new L.FeatureGroup()
        drawnItemsRef.current = drawnItems
        map.addLayer(drawnItems)

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
                remove: true,
            },
            draw: {
                marker: false,
                circle: false,
                circlemarker: false,
                polyline: false,
                rectangle: false,
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#e1e100',
                        message: '<strong>Error:</strong> Self-intersection!'
                    },
                    shapeOptions: {
                        color: '#1677ff'
                    }
                }
            }
        })
        map.addControl(drawControl)

        // Load initial value
        if (initialValue && (initialValue.type === 'Polygon' || initialValue.type === 'MultiPolygon')) {
            const layer = L.geoJSON(initialValue, {
                style: { color: '#1677ff' }
            })
            layer.eachLayer((l: any) => {
                drawnItems.addLayer(l)
            })
        }

        map.on(L.Draw.Event.CREATED, (e: any) => {
            const layer = e.layer
            drawnItems.clearLayers()
            drawnItems.addLayer(layer)
            const geoJSON = layer.toGeoJSON()
            onChange(geoJSON.geometry)
        })

        map.on(L.Draw.Event.EDITED, (e: any) => {
            const layers = e.layers
            layers.eachLayer((layer: any) => {
                const geoJSON = layer.toGeoJSON()
                onChange(geoJSON.geometry)
            })
        })

        map.on(L.Draw.Event.DELETED, () => {
            onChange(null)
        })

        return () => {
            map.removeControl(drawControl)
            map.removeLayer(drawnItems)
        }
    }, [])

    return null
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ value, onChange }) => {
    const [mode, setMode] = useState<'preset' | 'draw'>('preset')
    const [searchText, setSearchText] = useState('')
    const [searchCity, setSearchCity] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<RegionSearchResult[]>([])
    const [presetRegions, setPresetRegions] = useState<PresetRegion[]>([])
    const [loadingPresets, setLoadingPresets] = useState(false)
    const [selectedBoundary, setSelectedBoundary] = useState<any>(null)
    const [mapCenter, setMapCenter] = useState<[number, number]>([30.29, 120.08])

    // Load preset regions on mount
    useEffect(() => {
        loadPresetRegions()
    }, [])

    // Set initial boundary from value
    useEffect(() => {
        if (value && (value.type === 'Polygon' || value.type === 'MultiPolygon')) {
            setSelectedBoundary(value)
            // Calculate center from boundary
            try {
                const coords = value.type === 'Polygon' ? value.coordinates[0][0] : value.coordinates[0][0][0]
                if (coords) {
                    setMapCenter([coords[1], coords[0]])
                }
            } catch (e) {
                // Ignore center calculation errors
            }
        }
    }, [])

    const loadPresetRegions = async () => {
        setLoadingPresets(true)
        try {
            const result = await regionService.listPresetRegions({ pageSize: 50 })
            setPresetRegions(result.list || [])
        } catch (error) {
            console.error('Failed to load preset regions:', error)
        } finally {
            setLoadingPresets(false)
        }
    }

    const handleSearch = async () => {
        if (!searchText.trim()) return

        setSearching(true)
        try {
            const results = await regionService.searchRegions({
                keyword: searchText,
                city: searchCity
            })
            setSearchResults(results || [])
            if (results.length === 0) {
                message.info('No results found')
            }
        } catch (error) {
            console.error('Search failed:', error)
            message.error('Search failed')
        } finally {
            setSearching(false)
        }
    }

    const handleSelectSearchResult = async (item: RegionSearchResult) => {
        message.loading({ content: 'Loading boundary...', key: 'loadBoundary' })
        try {
            // Try to get boundary from adcode
            if (item.adcode) {
                const boundaryData = await regionService.getBoundary(item.adcode)
                if (boundaryData && boundaryData.boundary) {
                    setSelectedBoundary(boundaryData.boundary)
                    onChange?.(boundaryData.boundary)
                    message.success({ content: `Selected: ${item.name}`, key: 'loadBoundary' })
                    return
                }
            }

            // Fallback: search with boundary
            const result = await regionService.searchWithBoundary({
                keyword: item.name,
                city: item.city
            })
            if (result && result.boundary) {
                setSelectedBoundary(result.boundary)
                onChange?.(result.boundary)
                message.success({ content: `Selected: ${item.name}`, key: 'loadBoundary' })
            } else {
                message.warning({ content: 'Boundary not available, please use manual drawing', key: 'loadBoundary' })
            }
        } catch (error) {
            console.error('Failed to get boundary:', error)
            message.error({ content: 'Failed to load boundary', key: 'loadBoundary' })
        }
    }

    const handleSelectPreset = (region: PresetRegion) => {
        if (region.boundary) {
            setSelectedBoundary(region.boundary)
            onChange?.(region.boundary)
            if (region.center_lat && region.center_lng) {
                setMapCenter([region.center_lat, region.center_lng])
            }
            message.success(`Selected: ${region.name}`)
        }
    }

    const handleSaveAsPreset = async (item: RegionSearchResult) => {
        try {
            const result = await regionService.importFromAmap({
                keyword: item.name,
                city: item.city,
                category: item.category
            })
            message.success(`Saved "${result.name}" to presets`)
            loadPresetRegions()
        } catch (error) {
            console.error('Failed to save preset:', error)
            message.error('Failed to save preset')
        }
    }

    const handleDrawChange = (boundary: any) => {
        setSelectedBoundary(boundary)
        onChange?.(boundary)
    }

    const handleModeChange = (newMode: string | number) => {
        setMode(newMode as 'preset' | 'draw')
    }

    const categoryColors: Record<string, string> = {
        tourist: 'blue',
        park: 'green',
        shopping: 'orange',
        business: 'purple',
        sports: 'cyan',
        education: 'magenta',
        administrative: 'gold',
        other: 'default'
    }

    return (
        <Card
            size="small"
            title="Area Configuration (Supports preset selection and manual drawing)"
            style={{ width: '100%', marginBottom: 24 }}
        >
            <Segmented
                options={[
                    { label: 'Select Preset Region', value: 'preset' },
                    { label: 'Manual Drawing', value: 'draw' }
                ]}
                value={mode}
                onChange={handleModeChange}
                style={{ marginBottom: 16 }}
            />

            {mode === 'preset' ? (
                <div>
                    {/* Search Bar */}
                    <Space style={{ marginBottom: 16, width: '100%' }}>
                        <Input
                            placeholder="Search region (e.g., West Lake, Wanda Plaza)"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            style={{ width: 280 }}
                            prefix={<EnvironmentOutlined />}
                        />
                        <Input
                            placeholder="City (optional)"
                            value={searchCity}
                            onChange={e => setSearchCity(e.target.value)}
                            style={{ width: 120 }}
                        />
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            loading={searching}
                            onClick={handleSearch}
                        >
                            Search
                        </Button>
                    </Space>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <Card size="small" title="Search Results" style={{ marginBottom: 16 }}>
                            <List
                                size="small"
                                dataSource={searchResults.slice(0, 10)}
                                renderItem={item => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                type="link"
                                                size="small"
                                                onClick={() => handleSelectSearchResult(item)}
                                            >
                                                Select
                                            </Button>,
                                            <Button
                                                type="link"
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={() => handleSaveAsPreset(item)}
                                            >
                                                Save
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={item.name}
                                            description={
                                                <Space>
                                                    <Tag color={categoryColors[item.category] || 'default'}>
                                                        {item.category}
                                                    </Tag>
                                                    <Text type="secondary">{item.address || item.city}</Text>
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    )}

                    {/* Preset Regions */}
                    <Card size="small" title="Preset Regions" style={{ marginBottom: 16 }}>
                        {loadingPresets ? (
                            <Spin />
                        ) : presetRegions.length === 0 ? (
                            <Empty description="No preset regions. Search and save regions above." />
                        ) : (
                            <List
                                size="small"
                                dataSource={presetRegions.slice(0, 20)}
                                renderItem={region => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                type="link"
                                                size="small"
                                                onClick={() => handleSelectPreset(region)}
                                            >
                                                Select
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <Space>
                                                    {region.name}
                                                    {region.is_featured && <StarFilled style={{ color: '#faad14' }} />}
                                                </Space>
                                            }
                                            description={
                                                <Space>
                                                    <Tag color={categoryColors[region.category || 'other']}>
                                                        {region.category || 'other'}
                                                    </Tag>
                                                    <Text type="secondary">{region.city}</Text>
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>

                    {/* Preview Map */}
                    <div style={{ height: '350px', width: '100%', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapController center={mapCenter} boundary={selectedBoundary} />
                            {selectedBoundary && (
                                <GeoJSON
                                    key={JSON.stringify(selectedBoundary)}
                                    data={selectedBoundary}
                                    style={{ color: '#1677ff', fillOpacity: 0.3 }}
                                />
                            )}
                        </MapContainer>
                    </div>
                </div>
            ) : (
                /* Manual Drawing Mode */
                <div>
                    <div style={{ marginBottom: 16, display: 'flex' }}>
                        <Input
                            placeholder="Search location (e.g., Zhejiang University)"
                            onPressEnter={async (e) => {
                                const text = (e.target as HTMLInputElement).value
                                if (!text) return
                                try {
                                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`)
                                    const data = await response.json()
                                    if (data && data.length > 0) {
                                        const { lat, lon } = data[0]
                                        setMapCenter([parseFloat(lat), parseFloat(lon)])
                                        message.success(`Located: ${data[0].display_name}`)
                                    } else {
                                        message.warning('Location not found')
                                    }
                                } catch (error) {
                                    message.error('Search failed')
                                }
                            }}
                            style={{ marginRight: 8 }}
                        />
                        <Button type="primary" icon={<SearchOutlined />}>
                            Locate
                        </Button>
                    </div>

                    <div style={{ height: '500px', width: '100%', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapController center={mapCenter} />
                            <DrawControl onChange={handleDrawChange} initialValue={selectedBoundary} />
                        </MapContainer>
                    </div>
                    <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                        Tip: Use the polygon tool in the top-right toolbar to draw the area. Click to complete.
                    </div>
                </div>
            )}

            {/* Selected Boundary Info */}
            {selectedBoundary && (
                <div style={{ marginTop: 16 }}>
                    <Tag color="success">Area selected</Tag>
                    <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => {
                            setSelectedBoundary(null)
                            onChange?.(null)
                        }}
                    >
                        Clear
                    </Button>
                </div>
            )}
        </Card>
    )
}

export default RegionSelector
