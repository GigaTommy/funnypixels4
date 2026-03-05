#if canImport(MapLibre)
import MapLibre
import UIKit
import Combine

/// Manages the heatmap visualization layer on the MapLibre map
/// Fetches data from the backend, creates a GeoJSON source and MLNHeatmapStyleLayer,
/// and updates when the viewport changes significantly (debounced).
@MainActor
class MapHeatmapLayerManager {
    // MARK: - Constants

    private static let sourceIdentifier = "heatmap-activity-source"
    private static let heatmapLayerIdentifier = "heatmap-activity-layer"
    private static let labelLayerIdentifier = "heatmap-activity-labels"

    // MARK: - Properties

    private weak var mapView: MLNMapView?
    private var isLayerAdded = false
    private var fetchTask: Task<Void, Never>?
    private var debounceWorkItem: DispatchWorkItem?
    private var cancellables = Set<AnyCancellable>()

    /// Tracks whether the heatmap is currently visible
    private(set) var isVisible = false

    // MARK: - Init

    init(mapView: MLNMapView) {
        self.mapView = mapView
        observeLayerToggle()
    }

    // MARK: - Layer Toggle Observation

    /// Observe the showHeatmap toggle via UserDefaults KVO
    /// (MapLayerSettings uses @AppStorage which writes to UserDefaults)
    private func observeLayerToggle() {
        UserDefaults.standard.publisher(for: \.mapLayerHeatmap)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] showHeatmap in
                guard let self else { return }
                if showHeatmap {
                    self.show()
                } else {
                    self.hide()
                }
            }
            .store(in: &cancellables)

        // Apply initial state
        if UserDefaults.standard.bool(forKey: "map.layer.heatmap") {
            show()
        }
    }

    // MARK: - Show / Hide

    /// Show the heatmap layer, adding it if necessary, then fetch data
    func show() {
        guard let mapView, let style = mapView.style else { return }
        isVisible = true

        if !isLayerAdded {
            addLayers(style: style)
        }

        setLayerVisibility(true, style: style)
        refreshData()
    }

    /// Hide the heatmap layer
    func hide() {
        guard let mapView, let style = mapView.style else { return }
        isVisible = false
        setLayerVisibility(false, style: style)
        fetchTask?.cancel()
        debounceWorkItem?.cancel()
    }

    // MARK: - Viewport Change (called from Coordinator.regionDidChange)

    /// Called when the map viewport changes. Debounces for 2 seconds before refreshing.
    func onViewportChanged() {
        guard isVisible else { return }

        debounceWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            self?.refreshData()
        }
        debounceWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0, execute: workItem)
    }

    // MARK: - Data Fetch

    private func refreshData() {
        fetchTask?.cancel()

        fetchTask = Task { [weak self] in
            guard let self, let mapView = self.mapView else { return }

            let bounds = mapView.visibleCoordinateBounds
            let zoom = Int(mapView.zoomLevel)

            do {
                let featureCollection = try await MapHeatmapService.shared.fetchHeatmapData(
                    zoom: zoom,
                    swLat: bounds.sw.latitude,
                    swLng: bounds.sw.longitude,
                    neLat: bounds.ne.latitude,
                    neLng: bounds.ne.longitude,
                    period: "24h"
                )

                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self.updateSource(with: featureCollection)
                }
            } catch {
                if !Task.isCancelled {
                    Logger.error("[Heatmap] Failed to fetch data: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Layer Setup

    private func addLayers(style: MLNStyle) {
        guard !isLayerAdded else { return }

        // 1. Add GeoJSON source (empty initially)
        let source = MLNShapeSource(
            identifier: Self.sourceIdentifier,
            shape: nil,
            options: nil
        )
        style.addSource(source)

        // 2. Add heatmap style layer
        let heatmapLayer = MLNHeatmapStyleLayer(
            identifier: Self.heatmapLayerIdentifier,
            source: source
        )

        // Weight property drives heatmap intensity per point
        heatmapLayer.heatmapWeight = NSExpression(
            forMLNInterpolating: NSExpression(forKeyPath: "weight"),
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: [
                NSNumber(value: 1): NSNumber(value: 0.1),
                NSNumber(value: 50): NSNumber(value: 0.5),
                NSNumber(value: 200): NSNumber(value: 1.0)
            ])
        )

        // Intensity increases at higher zoom levels
        heatmapLayer.heatmapIntensity = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: [
                NSNumber(value: 2): NSNumber(value: 0.5),
                NSNumber(value: 9): NSNumber(value: 1.5),
                NSNumber(value: 14): NSNumber(value: 3.0)
            ])
        )

        // Color gradient: transparent blue -> yellow-green -> orange-red
        heatmapLayer.heatmapColor = NSExpression(
            forMLNInterpolating: .heatmapDensityVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: [
                NSNumber(value: 0.0): UIColor(red: 0.13, green: 0.40, blue: 0.67, alpha: 0.0),
                NSNumber(value: 0.15): UIColor(red: 0.40, green: 0.66, blue: 0.81, alpha: 0.6),
                NSNumber(value: 0.35): UIColor(red: 0.40, green: 0.80, blue: 0.40, alpha: 0.7),
                NSNumber(value: 0.55): UIColor(red: 1.00, green: 0.85, blue: 0.20, alpha: 0.8),
                NSNumber(value: 0.75): UIColor(red: 1.00, green: 0.55, blue: 0.10, alpha: 0.9),
                NSNumber(value: 1.0): UIColor(red: 0.90, green: 0.15, blue: 0.10, alpha: 1.0)
            ])
        )

        // Radius scales with zoom
        heatmapLayer.heatmapRadius = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: [
                NSNumber(value: 2): NSNumber(value: 8),
                NSNumber(value: 9): NSNumber(value: 20),
                NSNumber(value: 14): NSNumber(value: 35),
                NSNumber(value: 18): NSNumber(value: 50)
            ])
        )

        // Slight fade at very high zoom where individual pixels are visible
        heatmapLayer.heatmapOpacity = NSExpression(
            forMLNInterpolating: .zoomLevelVariable,
            curveType: .linear,
            parameters: nil,
            stops: NSExpression(forConstantValue: [
                NSNumber(value: 2): NSNumber(value: 0.7),
                NSNumber(value: 14): NSNumber(value: 0.6),
                NSNumber(value: 18): NSNumber(value: 0.3)
            ])
        )

        // Insert below pixel layers so pixels show on top of heatmap
        if let colorLayer = style.layer(withIdentifier: "pixels-color-hotpatch") {
            style.insertLayer(heatmapLayer, below: colorLayer)
        } else {
            style.addLayer(heatmapLayer)
        }

        // 3. Add symbol layer for "X people drawing" labels on high-activity clusters
        let labelLayer = MLNSymbolStyleLayer(
            identifier: Self.labelLayerIdentifier,
            source: source
        )

        // Only show labels for high-activity points (weight >= 50)
        labelLayer.predicate = NSPredicate(format: "weight >= 50")

        // Build label text from the users property
        labelLayer.text = NSExpression(
            format: "CAST(users, 'NSString')"
        )
        // Prepend suffix for display -- since NSExpression concat is limited,
        // we use the format option to append text
        labelLayer.text = NSExpression(
            format: "mgl_join:({CAST(users, 'NSString'), %@})",
            NSLocalizedString("map.heatmap.people_drawing_suffix", comment: " people drawing")
        )

        labelLayer.textColor = NSExpression(forConstantValue: UIColor.white)
        labelLayer.textFontSize = NSExpression(forConstantValue: 12)
        labelLayer.textHaloColor = NSExpression(forConstantValue: UIColor.black.withAlphaComponent(0.6))
        labelLayer.textHaloWidth = NSExpression(forConstantValue: 1.0)
        labelLayer.textAllowsOverlap = NSExpression(forConstantValue: false)
        labelLayer.textIgnoresPlacement = NSExpression(forConstantValue: false)
        labelLayer.textOffset = NSExpression(forConstantValue: NSValue(cgVector: CGVector(dx: 0, dy: 1.5)))

        // Only show labels at medium-to-high zoom
        labelLayer.minimumZoomLevel = 8
        labelLayer.maximumZoomLevel = 16

        // Insert above heatmap layer
        style.insertLayer(labelLayer, above: heatmapLayer)

        isLayerAdded = true
        Logger.info("[Heatmap] Layers added to map style")
    }

    // MARK: - Update Source Data

    private func updateSource(with featureCollection: MapHeatmapService.GeoJSONFeatureCollection) {
        guard let style = mapView?.style,
              let source = style.source(withIdentifier: Self.sourceIdentifier) as? MLNShapeSource else {
            return
        }

        // Convert to MLN features
        var features: [MLNPointFeature] = []
        for feature in featureCollection.features {
            guard feature.geometry.coordinates.count >= 2 else { continue }
            let lng = feature.geometry.coordinates[0]
            let lat = feature.geometry.coordinates[1]

            let point = MLNPointFeature()
            point.coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            point.attributes = [
                "weight": feature.properties.weight,
                "users": feature.properties.users
            ]
            features.append(point)
        }

        let shape = MLNShapeCollectionFeature(shapes: features)
        source.shape = shape

        Logger.debug("[Heatmap] Updated source with \(features.count) features")
    }

    // MARK: - Layer Visibility

    private func setLayerVisibility(_ visible: Bool, style: MLNStyle) {
        if let heatmapLayer = style.layer(withIdentifier: Self.heatmapLayerIdentifier) {
            heatmapLayer.isVisible = visible
        }
        if let labelLayer = style.layer(withIdentifier: Self.labelLayerIdentifier) {
            labelLayer.isVisible = visible
        }
    }

    // MARK: - Cleanup

    /// Remove layers and source when the map is deallocated
    func cleanup() {
        fetchTask?.cancel()
        debounceWorkItem?.cancel()
        cancellables.removeAll()

        guard let style = mapView?.style else { return }

        if let labelLayer = style.layer(withIdentifier: Self.labelLayerIdentifier) {
            style.removeLayer(labelLayer)
        }
        if let heatmapLayer = style.layer(withIdentifier: Self.heatmapLayerIdentifier) {
            style.removeLayer(heatmapLayer)
        }
        if let source = style.source(withIdentifier: Self.sourceIdentifier) {
            style.removeSource(source)
        }

        isLayerAdded = false
    }
}

// MARK: - UserDefaults KVO Extension for heatmap toggle

extension UserDefaults {
    /// KVO-compatible property for the heatmap layer toggle
    /// Mirrors the @AppStorage("map.layer.heatmap") key
    @objc dynamic var mapLayerHeatmap: Bool {
        return bool(forKey: "map.layer.heatmap")
    }
}
#endif
