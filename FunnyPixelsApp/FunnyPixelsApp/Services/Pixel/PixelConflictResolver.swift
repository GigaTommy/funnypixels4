import Foundation
import Combine

/// Pixel Conflict Resolver
/// Resolves conflicts when multiple users try to update the same pixel
public class PixelConflictResolver {
    public static let shared = PixelConflictResolver()

    private init() {}

    /// Resolve a conflict between two pixel updates
    public func resolveConflict(local: Pixel, remote: Pixel) -> Pixel {
        // Record conflict
        PixelSyncMetrics.shared.recordConflict()
        
        // Last-write-wins strategy based on updatedAt timestamp
        return local.updatedAt > remote.updatedAt ? local : remote
    }

    /// Merge multiple pixel updates
    public func merge(_ pixels: [Pixel]) -> Pixel? {
        pixels.max(by: { $0.updatedAt < $1.updatedAt })
    }
}
