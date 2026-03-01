import Foundation

/// P2-3: Event Cache Manager
/// Handles offline caching of events for improved experience in poor network conditions
class EventCache {
    static let shared = EventCache()

    private let defaults = UserDefaults.standard
    private let cacheValidityDuration: TimeInterval = 300 // 5 minutes

    // Cache keys
    private enum CacheKey {
        static let activeEvents = "cache.events.active"
        static let activeEventsTimestamp = "cache.events.active.timestamp"
        static let userEvents = "cache.events.user"
        static let userEventsTimestamp = "cache.events.user.timestamp"
        static let eventDetails = "cache.event.details." // Append eventId
        static let eventDetailsTimestamp = "cache.event.details.timestamp." // Append eventId
    }

    private init() {}

    // MARK: - Active Events Cache

    /// Save active events to cache
    func saveActiveEvents(_ events: [EventService.Event]) {
        do {
            let data = try JSONEncoder().encode(events)
            defaults.set(data, forKey: CacheKey.activeEvents)
            defaults.set(Date(), forKey: CacheKey.activeEventsTimestamp)
            Logger.info("💾 Cached \(events.count) active events")
        } catch {
            Logger.error("❌ Failed to cache active events: \(error)")
        }
    }

    /// Load cached active events (if valid)
    func loadCachedActiveEvents() -> [EventService.Event]? {
        guard let timestamp = defaults.object(forKey: CacheKey.activeEventsTimestamp) as? Date else {
            return nil
        }

        // Check if cache is still valid (within 5 minutes)
        guard Date().timeIntervalSince(timestamp) < cacheValidityDuration else {
            Logger.info("⚠️ Active events cache expired")
            return nil
        }

        guard let data = defaults.data(forKey: CacheKey.activeEvents) else {
            return nil
        }

        do {
            let events = try JSONDecoder().decode([EventService.Event].self, from: data)
            Logger.info("✅ Loaded \(events.count) active events from cache")
            return events
        } catch {
            Logger.error("❌ Failed to decode cached active events: \(error)")
            return nil
        }
    }

    // MARK: - User Events Cache

    /// Save user events to cache
    func saveUserEvents(_ events: [EventService.UserEvent]) {
        do {
            let data = try JSONEncoder().encode(events)
            defaults.set(data, forKey: CacheKey.userEvents)
            defaults.set(Date(), forKey: CacheKey.userEventsTimestamp)
            Logger.info("💾 Cached \(events.count) user events")
        } catch {
            Logger.error("❌ Failed to cache user events: \(error)")
        }
    }

    /// Load cached user events (if valid)
    func loadCachedUserEvents() -> [EventService.UserEvent]? {
        guard let timestamp = defaults.object(forKey: CacheKey.userEventsTimestamp) as? Date else {
            return nil
        }

        guard Date().timeIntervalSince(timestamp) < cacheValidityDuration else {
            Logger.info("⚠️ User events cache expired")
            return nil
        }

        guard let data = defaults.data(forKey: CacheKey.userEvents) else {
            return nil
        }

        do {
            let events = try JSONDecoder().decode([EventService.UserEvent].self, from: data)
            Logger.info("✅ Loaded \(events.count) user events from cache")
            return events
        } catch {
            Logger.error("❌ Failed to decode cached user events: \(error)")
            return nil
        }
    }

    // MARK: - Event Details Cache

    /// Save event details to cache
    func saveEventDetails(_ event: EventService.Event, eventId: String) {
        do {
            let data = try JSONEncoder().encode(event)
            defaults.set(data, forKey: CacheKey.eventDetails + eventId)
            defaults.set(Date(), forKey: CacheKey.eventDetailsTimestamp + eventId)
            Logger.info("💾 Cached event details for: \(eventId)")
        } catch {
            Logger.error("❌ Failed to cache event details: \(error)")
        }
    }

    /// Load cached event details (if valid)
    func loadCachedEventDetails(eventId: String) -> EventService.Event? {
        guard let timestamp = defaults.object(forKey: CacheKey.eventDetailsTimestamp + eventId) as? Date else {
            return nil
        }

        guard Date().timeIntervalSince(timestamp) < cacheValidityDuration else {
            Logger.info("⚠️ Event details cache expired for: \(eventId)")
            return nil
        }

        guard let data = defaults.data(forKey: CacheKey.eventDetails + eventId) else {
            return nil
        }

        do {
            let event = try JSONDecoder().decode(EventService.Event.self, from: data)
            Logger.info("✅ Loaded event details from cache: \(eventId)")
            return event
        } catch {
            Logger.error("❌ Failed to decode cached event details: \(error)")
            return nil
        }
    }

    // MARK: - Cache Management

    /// Clear all event caches
    func clearAllCaches() {
        defaults.removeObject(forKey: CacheKey.activeEvents)
        defaults.removeObject(forKey: CacheKey.activeEventsTimestamp)
        defaults.removeObject(forKey: CacheKey.userEvents)
        defaults.removeObject(forKey: CacheKey.userEventsTimestamp)

        // Clear all event details caches (scan UserDefaults)
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys {
            if key.hasPrefix(CacheKey.eventDetails) || key.hasPrefix(CacheKey.eventDetailsTimestamp) {
                defaults.removeObject(forKey: key)
            }
        }

        Logger.info("🗑️ Cleared all event caches")
    }

    /// Clear cache for specific event
    func clearEventCache(eventId: String) {
        defaults.removeObject(forKey: CacheKey.eventDetails + eventId)
        defaults.removeObject(forKey: CacheKey.eventDetailsTimestamp + eventId)
        Logger.info("🗑️ Cleared cache for event: \(eventId)")
    }

    /// Check if cache is available (valid and not expired)
    func hasCachedActiveEvents() -> Bool {
        guard let timestamp = defaults.object(forKey: CacheKey.activeEventsTimestamp) as? Date else {
            return false
        }
        return Date().timeIntervalSince(timestamp) < cacheValidityDuration
    }

    func hasCachedUserEvents() -> Bool {
        guard let timestamp = defaults.object(forKey: CacheKey.userEventsTimestamp) as? Date else {
            return false
        }
        return Date().timeIntervalSince(timestamp) < cacheValidityDuration
    }

    func hasCachedEventDetails(eventId: String) -> Bool {
        guard let timestamp = defaults.object(forKey: CacheKey.eventDetailsTimestamp + eventId) as? Date else {
            return false
        }
        return Date().timeIntervalSince(timestamp) < cacheValidityDuration
    }
}
