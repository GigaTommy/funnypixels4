
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { Input, Button, Card, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

// Fix Leaflet Default Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface EventMapProps {
    value?: any; // GeoJSON
    onChange?: (value: any) => void;
}

// Map Controller to handle panning
const MapController: React.FC<{ center?: [number, number], zoom?: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, zoom || 14);
        }
    }, [center, zoom, map]);
    return null;
};

// Draw Control Component (Manual implementation to avoid react-leaflet-draw issues)
const DrawControl: React.FC<{ onChange: (val: any) => void; initialValue?: any }> = ({ onChange, initialValue }) => {
    const map = useMap();
    const mounted = useRef(false);
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        const drawnItems = new L.FeatureGroup();
        drawnItemsRef.current = drawnItems;
        map.addLayer(drawnItems);

        // Init Draw Control
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
                        message: '<strong>错误:</strong> 本次绘制自相交!'
                    },
                    shapeOptions: {
                        color: '#1677ff'
                    }
                }
            }
        });
        map.addControl(drawControl);

        // Load initial value
        if (initialValue && (initialValue.type === 'Polygon' || initialValue.type === 'MultiPolygon')) {
            const layer = L.geoJSON(initialValue, {
                style: { color: '#1677ff' }
            });
            layer.eachLayer((l: any) => {
                drawnItems.addLayer(l);
            });
        }

        // Events
        map.on(L.Draw.Event.CREATED, (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers(); // Only allow one polygon
            drawnItems.addLayer(layer);
            const geoJSON = layer.toGeoJSON();
            onChange(geoJSON.geometry);
        });

        map.on(L.Draw.Event.EDITED, (e: any) => {
            const layers = e.layers;
            layers.eachLayer((layer: any) => {
                const geoJSON = layer.toGeoJSON();
                onChange(geoJSON.geometry);
            });
        });

        map.on(L.Draw.Event.DELETED, (e: any) => {
            onChange(null);
        });

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(drawnItems);
        };
    }, []); // Run once

    return null;
};

const EventMap: React.FC<EventMapProps> = ({ value, onChange }) => {
    const [mapCenter, setMapCenter] = useState<[number, number]>([30.29, 120.08]); // Default: Hangzhou
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);

    // Initial center update logic could be added here if needed, 
    // but typically we trust the user navigation or search.
    // If we want to center on the initial value, we can do it once.
    useEffect(() => {
        if (value && value.coordinates && value.coordinates.length > 0) {
            // Simple center estimation
            const firstCoord = value.coordinates[0][0]; // [lng, lat]
            if (firstCoord) {
                setMapCenter([firstCoord[1], firstCoord[0]]);
            }
        }
    }, []);

    const handleSearch = async () => {
        if (!searchText) return;
        setSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const newCenter: [number, number] = [parseFloat(lat), parseFloat(lon)];
                setMapCenter(newCenter);
                message.success(`已定位到: ${data[0].display_name}`);
            } else {
                message.warning('未找到相关地点');
            }
        } catch (error) {
            console.error(error);
            message.error('搜索失败');
        } finally {
            setSearching(false);
        }
    };

    return (
        <Card size="small" title="活动区域配置 (支持搜索与绘制)" style={{ width: '100%', marginBottom: 24 }}>
            <div style={{ marginBottom: 16, display: 'flex' }}>
                <Input
                    placeholder="搜索地点 (例如: 浙江大学)"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ marginRight: 8 }}
                />
                <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
                    定位
                </Button>
            </div>

            <div style={{ height: '500px', width: '100%', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController center={mapCenter} />
                    <DrawControl onChange={onChange!} initialValue={value} />
                </MapContainer>
            </div>
            <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                操作提示: 使用右上角工具栏的多边形图标绘制区域。绘制完成后点击完成。
            </div>
        </Card>
    );
};

export default EventMap;
