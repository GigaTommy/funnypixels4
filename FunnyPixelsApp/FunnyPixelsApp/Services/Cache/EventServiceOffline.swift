import Foundation

/// P2-3: EventService Offline Support Extension
/// Adds caching and retry logic to EventService for improved offline experience
extension EventService {

    // MARK: - Offline Mode State

    /// Check if the app is in offline mode (last request failed)
    private static var _isOfflineMode: Bool = false
    static var isOfflineMode: Bool {
        get { _isOfflineMode }
        set { _isOfflineMode = newValue }
    }

    /// Get active events with offline cache fallback
    func getActiveEventsWithCache() async throws -> (events: [Event], isFromCache: Bool) {
        do {
            // Try to fetch from network with retry
            let events = try await getActiveEventsWithRetry()

            // Save to cache on success
            EventCache.shared.saveActiveEvents(events)

            // Clear offline mode
            await MainActor.run {
                EventService.isOfflineMode = false
            }

            return (events, false)
        } catch {
            Logger.warning("⚠️ Network request failed, attempting to load from cache: \(error)")

            // Try to load from cache
            if let cachedEvents = EventCache.shared.loadCachedActiveEvents() {
                await MainActor.run {
                    EventService.isOfflineMode = true
                }
                return (cachedEvents, true)
            }

            // No cache available, throw error
            throw error
        }
    }

    /// Get user events with offline cache fallback
    func getMyEventsWithCache() async throws -> (events: [UserEvent], isFromCache: Bool) {
        do {
            // Try to fetch from network with retry
            let eventsData = try await getMyEventsWithRetry()
            let events = eventsData.list

            // Save to cache on success
            EventCache.shared.saveUserEvents(events)

            // Clear offline mode
            await MainActor.run {
                EventService.isOfflineMode = false
            }

            return (events, false)
        } catch {
            Logger.warning("⚠️ Network request failed, attempting to load from cache: \(error)")

            // Try to load from cache
            if let cachedEvents = EventCache.shared.loadCachedUserEvents() {
                await MainActor.run {
                    EventService.isOfflineMode = true
                }
                return (cachedEvents, true)
            }

            // No cache available, throw error
            throw error
        }
    }

    // MARK: - Smart Retry with Exponential Backoff

    /// Retry active events request with exponential backoff
    private func getActiveEventsWithRetry(maxRetries: Int = 3) async throws -> [Event] {
        var lastError: Error?

        for attempt in 0..<maxRetries {
            do {
                return try await getActiveEvents()
            } catch {
                lastError = error

                // Only retry on network errors
                guard isRetryableError(error) else {
                    throw error
                }

                // Don't wait after last attempt
                guard attempt < maxRetries - 1 else {
                    break
                }

                // Exponential backoff: 1s, 2s, 4s
                let delay = pow(2.0, Double(attempt))
                Logger.info("🔄 Retry attempt \(attempt + 1)/\(maxRetries) after \(delay)s delay")

                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        // All retries failed
        throw lastError ?? NetworkError.unknownError
    }

    /// Retry user events request with exponential backoff
    private func getMyEventsWithRetry(maxRetries: Int = 3) async throws -> UserEventsData {
        var lastError: Error?

        for attempt in 0..<maxRetries {
            do {
                return try await getMyEvents()
            } catch {
                lastError = error

                guard isRetryableError(error) else {
                    throw error
                }

                guard attempt < maxRetries - 1 else {
                    break
                }

                let delay = pow(2.0, Double(attempt))
                Logger.info("🔄 Retry attempt \(attempt + 1)/\(maxRetries) after \(delay)s delay")

                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        throw lastError ?? NetworkError.unknownError
    }

    // MARK: - Error Handling

    /// Check if error is retryable (network error, timeout, etc.)
    private func isRetryableError(_ error: Error) -> Bool {
        // Check for URLError types that are retryable
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet,
                 .networkConnectionLost,
                 .timedOut,
                 .cannotFindHost,
                 .cannotConnectToHost,
                 .dnsLookupFailed:
                return true
            default:
                return false
            }
        }

        // Check for NetworkError types
        if let networkError = error as? NetworkError {
            switch networkError {
            case .networkUnavailable, .timeout:
                return true
            default:
                return false
            }
        }

        return false
    }
}
