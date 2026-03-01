import Foundation
import MapKit
import UIKit

/// Utility for generating map snapshots from session pixel data
@MainActor
class MapSnapshotGenerator {
    
    /// Generate a map snapshot from session pixels
    /// - Parameters:
    ///   - pixels: Array of session pixels
    ///   - size: Size of the snapshot image
    ///   - showRoute: Whether to draw route lines between pixels
    /// - Returns: Tuple of (Generated map snapshot image, MKMapSnapshotter instance, Snapshot for lifecycle management)
    static func generateSnapshot(
        from pixels: [SessionPixel],
        size: CGSize = CGSize(width: 335, height: 335),
        showRoute: Bool = true
    ) async throws -> (image: UIImage, snapshotter: MKMapSnapshotter, snapshot: MKMapSnapshotter.Snapshot) {
        guard !pixels.isEmpty else {
            throw SnapshotError.noPixels
        }

        // Calculate map region from pixels
        let coordinates = pixels.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        let region = calculateRegion(from: coordinates)

        // Configure snapshotter
        let options = MKMapSnapshotter.Options()
        options.region = region
        options.size = size

        // Use a safe way to get scale without UIScreen.main (deprecated in iOS 26.0)
        if let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
            options.scale = windowScene.screen.scale
        } else {
            options.scale = 2.0 // Fallback to standard @2x scale if no active scene found
        }

        // Generate base snapshot
        let snapshotter = MKMapSnapshotter(options: options)
        let snapshot = try await snapshotter.start()
        
        // Load flag image for primary alliance pattern
        let flagImage = await loadFlagImage(from: pixels)

        // Draw pixels and route on snapshot
        // ✅ FIX: Use CoreGraphics instead of UIGraphicsImageRenderer to avoid Metal crashes
        // UIGraphicsImageRenderer uses Metal internally, which can cause resource lifecycle issues
        let image: UIImage = autoreleasepool {
            // Use CoreGraphics for stable rendering without Metal
            UIGraphicsBeginImageContextWithOptions(size, false, options.scale)
            defer { UIGraphicsEndImageContext() }

            guard let cgContext = UIGraphicsGetCurrentContext() else {
                Logger.error("❌ MapSnapshotGenerator: Failed to get graphics context")
                return UIImage()
            }

            // Draw base map
            snapshot.image.draw(at: .zero)

            // Draw route if enabled and multiple pixels
            if showRoute && pixels.count > 1 {
                drawRoute(on: cgContext, coordinates: coordinates, snapshot: snapshot)
            }

            // Draw pixel points (with alliance flag if available)
            drawPixels(on: cgContext, coordinates: coordinates, snapshot: snapshot, flagImage: flagImage)

            // Draw start/end markers
            if let first = coordinates.first {
                drawStartMarker(on: cgContext, at: first, snapshot: snapshot)
            }
            if let last = coordinates.last, coordinates.count > 1 {
                drawEndMarker(on: cgContext, at: last, snapshot: snapshot)
            }

            // Get rendered image
            guard let renderedImage = UIGraphicsGetImageFromCurrentImageContext() else {
                Logger.error("❌ MapSnapshotGenerator: Failed to get image from context")
                return UIImage()
            }

            return renderedImage
        }

        // ✅ FIX: Return snapshotter AND snapshot to maintain strong references
        // This prevents Metal objects from being deallocated while command buffer is still active
        return (image: image, snapshotter: snapshotter, snapshot: snapshot)
    }
    
    // MARK: - Private Helpers
    
    private static func calculateRegion(from coordinates: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        let minLat = coordinates.map { $0.latitude }.min() ?? 0
        let maxLat = coordinates.map { $0.latitude }.max() ?? 0
        let minLon = coordinates.map { $0.longitude }.min() ?? 0
        let maxLon = coordinates.map { $0.longitude }.max() ?? 0
        
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )
        
        let span = MKCoordinateSpan(
            latitudeDelta: max(maxLat - minLat, 0.001) * 1.5,
            longitudeDelta: max(maxLon - minLon, 0.001) * 1.5
        )
        
        return MKCoordinateRegion(center: center, span: span)
    }
    
    private static func drawRoute(
        on context: CGContext,
        coordinates: [CLLocationCoordinate2D],
        snapshot: MKMapSnapshotter.Snapshot
    ) {
        context.setStrokeColor(UIColor.systemBlue.cgColor)
        context.setLineWidth(3.0)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        
        let points = coordinates.map { snapshot.point(for: $0) }
        
        guard let firstPoint = points.first else { return }
        context.move(to: firstPoint)
        
        for point in points.dropFirst() {
            context.addLine(to: point)
        }
        
        context.strokePath()
    }
    
    private static func drawPixels(
        on context: CGContext,
        coordinates: [CLLocationCoordinate2D],
        snapshot: MKMapSnapshotter.Snapshot,
        flagImage: UIImage? = nil
    ) {
        let flagSize: CGFloat = 14
        let borderWidth: CGFloat = 2

        for coordinate in coordinates {
            let point = snapshot.point(for: coordinate)

            if let flagImage = flagImage {
                let totalSize = flagSize + borderWidth * 2

                // Draw white circle border
                context.setFillColor(UIColor.white.cgColor)
                context.fillEllipse(in: CGRect(
                    x: point.x - totalSize / 2,
                    y: point.y - totalSize / 2,
                    width: totalSize,
                    height: totalSize
                ))

                // Draw flag image clipped to circle
                let flagRect = CGRect(
                    x: point.x - flagSize / 2,
                    y: point.y - flagSize / 2,
                    width: flagSize,
                    height: flagSize
                )
                context.saveGState()
                context.addEllipse(in: flagRect)
                context.clip()
                flagImage.draw(in: flagRect)
                context.restoreGState()
            } else {
                // Fallback to red dot
                context.setFillColor(UIColor.white.cgColor)
                context.fillEllipse(in: CGRect(x: point.x - 5, y: point.y - 5, width: 10, height: 10))

                context.setFillColor(UIColor.systemRed.cgColor)
                context.fillEllipse(in: CGRect(x: point.x - 3, y: point.y - 3, width: 6, height: 6))
            }
        }
    }
    
    private static func drawStartMarker(
        on context: CGContext,
        at coordinate: CLLocationCoordinate2D,
        snapshot: MKMapSnapshotter.Snapshot
    ) {
        let point = snapshot.point(for: coordinate)
        
        // Draw green circle
        context.setFillColor(UIColor.systemGreen.cgColor)
        context.fillEllipse(in: CGRect(x: point.x - 10, y: point.y - 10, width: 20, height: 20))
        
        // Draw flag icon (simplified)
        context.setStrokeColor(UIColor.white.cgColor)
        context.setLineWidth(2.0)
        context.move(to: CGPoint(x: point.x - 3, y: point.y - 5))
        context.addLine(to: CGPoint(x: point.x - 3, y: point.y + 5))
        context.move(to: CGPoint(x: point.x - 3, y: point.y - 5))
        context.addLine(to: CGPoint(x: point.x + 4, y: point.y - 2))
        context.addLine(to: CGPoint(x: point.x - 3, y: point.y + 1))
        context.strokePath()
    }
    
    private static func drawEndMarker(
        on context: CGContext,
        at coordinate: CLLocationCoordinate2D,
        snapshot: MKMapSnapshotter.Snapshot
    ) {
        let point = snapshot.point(for: coordinate)
        
        // Draw red circle
        context.setFillColor(UIColor.systemRed.cgColor)
        context.fillEllipse(in: CGRect(x: point.x - 10, y: point.y - 10, width: 20, height: 20))
        
        // Draw checkered flag icon (simplified)
        context.setStrokeColor(UIColor.white.cgColor)
        context.setLineWidth(2.0)
        context.move(to: CGPoint(x: point.x - 3, y: point.y - 5))
        context.addLine(to: CGPoint(x: point.x - 3, y: point.y + 5))
        context.move(to: CGPoint(x: point.x - 3, y: point.y - 5))
        context.addLine(to: CGPoint(x: point.x + 4, y: point.y - 2))
        context.addLine(to: CGPoint(x: point.x - 3, y: point.y + 1))
        context.strokePath()
    }
    
    /// Load the alliance flag image for the primary pattern used in this session
    private static func loadFlagImage(from pixels: [SessionPixel]) async -> UIImage? {
        // Find primary pattern ID (most common across pixels)
        var patternCounts: [String: Int] = [:]
        for pixel in pixels {
            if let patternId = pixel.patternId, !patternId.isEmpty {
                patternCounts[patternId, default: 0] += 1
            }
        }
        guard let primaryPatternId = patternCounts.max(by: { $0.value < $1.value })?.key else {
            return nil
        }

        let baseUrl = APIEndpoint.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(baseUrl)/sprites/icon/2/complex/\(primaryPatternId).png") else {
            return nil
        }

        do {
            var request = URLRequest(url: url)
            if primaryPatternId.hasPrefix("user_avatar_") {
                request.cachePolicy = .reloadIgnoringLocalCacheData
            }
            let (data, _) = try await URLSession.shared.data(for: request)
            return UIImage(data: data)
        } catch {
            Logger.error("❌ MapSnapshotGenerator: Failed to load flag image for \(primaryPatternId): \(error)")
            return nil
        }
    }

    enum SnapshotError: LocalizedError {
        case noPixels
        case generationFailed
        
        var errorDescription: String? {
            switch self {
            case .noPixels:
                return "No pixels to generate snapshot"
            case .generationFailed:
                return "Failed to generate map snapshot"
            }
        }
    }
}
