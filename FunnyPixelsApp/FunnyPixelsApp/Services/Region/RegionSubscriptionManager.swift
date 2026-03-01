import Foundation
import Combine

/// Region Subscription Manager
/// Manages WebSocket subscriptions to map regions
public class RegionSubscriptionManager {
    public static let shared = RegionSubscriptionManager()

    private var subscribedRegions: Set<String> = []
    @Published public var isActive: Bool = false

    private init() {}

    /// Subscribe to a region
    public func subscribe(to regionId: String) {
        subscribedRegions.insert(regionId)
        Logger.info("Subscribed to region: \(regionId)")
    }

    /// Unsubscribe from a region
    public func unsubscribe(from regionId: String) {
        subscribedRegions.remove(regionId)
        Logger.info("Unsubscribed from region: \(regionId)")
    }

    /// Unsubscribe from all regions
    public func unsubscribeAll() {
        subscribedRegions.removeAll()
        isActive = false
    }

    /// Get all subscribed regions
    public var subscriptions: [String] {
        Array(subscribedRegions)
    }
}
