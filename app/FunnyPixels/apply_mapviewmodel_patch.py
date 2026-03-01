#!/usr/bin/env python3
"""Script to patch MapViewModel.swift with the new map region change handling methods"""

import sys

# Read the file
file_path = "/Users/ginochow/code/funnypixels3/app/FunnyPixels/Sources/FunnyPixels/ViewModels/MapViewModel.swift"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the old updateMapRegion method and replace it
old_code = '''    /// 更新地图区域
    func updateMapRegion(_ region: MKCoordinateRegion) {
        mapRegion = region

        // 加载新区域的像素
        Task {
            await loadPixels()
        }
    }

    /// 聚焦用户位置
    func focusOnUserLocation() {'''

new_code = '''    /// 更新地图区域（保留用于兼容性）
    func updateMapRegion(_ region: MKCoordinateRegion) {
        mapRegion = region

        // 加载新区域的像素
        Task {
            await mapRegionDidChange(region)
        }
    }

    /// 地图区域变化处理（带LOD策略）
    func mapRegionDidChange(_ region: MKCoordinateRegion) async {
        // 1. 计算缩放级别
        let zoomLevel = PixelLODStrategy.zoomLevel(from: region)
        currentZoomLevel = zoomLevel

        // 2. 获取渲染模式
        let renderMode = PixelLODStrategy.renderingMode(from: region)
        currentRenderMode = renderMode

        // 3. 计算需要的Tile边界
        let tileBounds = await tileManager.tilesForVisibleRegion(region, zoom: zoomLevel)

        // 4. 并发加载Tiles
        await withTaskGroup(of: PixelTile.self) { group in
            for bounds in tileBounds {
                group.addTask {
                    try? await self.tileManager.fetchTile(for: bounds, zoom: zoomLevel)
                }
            }
        }

        // 5. 更新WebSocket订阅
        await updateWebSocketSubscriptions(for: region)

        // 6. 刷新像素显示
        await refreshVisiblePixels(for: region, mode: renderMode)
    }

    /// 刷新可见像素
    func refreshVisiblePixels(for region: MKCoordinateRegion, mode: RenderingMode) async {
        let bounds = TileBounds(
            minLatitude: region.center.latitude - region.span.latitudeDelta / 2,
            maxLatitude: region.center.latitude + region.span.latitudeDelta / 2,
            minLongitude: region.center.longitude - region.span.longitudeDelta / 2,
            maxLongitude: region.center.longitude + region.span.longitudeDelta / 2
        )

        let tile = try? await tileManager.fetchTile(for: bounds, zoom: currentZoomLevel)

        switch mode {
        case .clustered(let gridSize):
            // 聚合显示
            let clusters = PixelLODStrategy.clusterPixels(tile?.pixels ?? [], gridSize: gridSize)
            pixelClusters = clusters
            pixels = []  // 聚合模式下清空原始像素
        case .simplified:
            // 简化显示（降采样）
            let sampled = (tile?.pixels ?? []).enumerated().filter { $0.offset % 2 == 0 }.map { $0.element }
            pixels = sampled
            pixelClusters = []  // 清空聚合
        case .full:
            // 完整显示
            pixels = tile?.pixels ?? []
            pixelClusters = []  // 清空聚合
        }

        Logger.info("Refreshed visible pixels: mode=\\(mode.description), count=\\(pixels.count)")
    }

    /// 更新WebSocket订阅
    func updateWebSocketSubscriptions(for region: MKCoordinateRegion) async {
        // 创建MapRegion对象
        let mapRegion = MapRegion(
            id: "visible_\\(UUID().uuidString)",
            minLat: region.center.latitude - region.span.latitudeDelta / 2,
            maxLat: region.center.latitude + region.span.latitudeDelta / 2,
            minLng: region.center.longitude - region.span.longitudeDelta / 2,
            maxLng: region.center.longitude + region.span.longitudeDelta / 2,
            zoom: currentZoomLevel,
            geoHash: GeoHash.encode(
                latitude: region.center.latitude,
                longitude: region.center.longitude,
                precision: 6
            ),
            priority: .visible,
            type: .visible
        )

        // 通过regionManager订阅新区域
        regionManager.subscribe(mapRegion, isPrimary: true)

        Logger.debug("Updated WebSocket subscriptions for region: \\(mapRegion.id)")
    }

    /// 聚焦用户位置
    func focusOnUserLocation() {'''

# Replace the old code with new code
if old_code in content:
    content = content.replace(old_code, new_code)
    print("Successfully patched MapViewModel.swift")
else:
    print("ERROR: Could not find the old code to replace")
    print("The file structure may have changed.")
    sys.exit(1)

# Write the file back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully!")
